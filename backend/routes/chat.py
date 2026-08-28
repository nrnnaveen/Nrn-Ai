import json
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from backend.models.user import UserInDB
from backend.models.conversation import Message, SendMessageRequest, EditMessageRequest
from backend.models.attachment import Attachment
from backend.auth.dependencies import get_current_user
from backend.services.conversation_service import ConversationService
from backend.services.chat_service import ChatService
from backend.services.ai_service import AIService
from backend.utils.storage import read_json
from backend.config import settings

router = APIRouter(prefix="/api/conversations", tags=["chat"])

def _resolve_attachments(user_id: str, attachment_ids: List[str]) -> List[Attachment]:
    if not attachment_ids:
        return []
    # Search attachments in uploads directory for this user
    resolved = []
    user_dir = settings.UPLOADS_DIR / user_id
    if not user_dir.exists():
        return []
        
    for att_id in attachment_ids:
        for p in user_dir.iterdir():
            if p.name.startswith(att_id):
                ext = p.suffix.lower()
                mime = "application/octet-stream"
                if ext in [".jpg", ".jpeg"]:
                    mime = "image/jpeg"
                elif ext == ".png":
                    mime = "image/png"
                elif ext == ".webp":
                    mime = "image/webp"
                elif ext == ".gif":
                    mime = "image/gif"
                elif ext == ".pdf":
                    mime = "application/pdf"
                elif ext in [".txt", ".md", ".csv", ".json"]:
                    mime = "text/plain"
                    
                resolved.append(Attachment(
                    id=att_id,
                    conversation_id="",
                    owner_id=user_id,
                    original_name=p.name,
                    stored_name=p.name,
                    mime_type=mime,
                    size_bytes=p.stat().st_size,
                    url=f"/api/uploads/{att_id}"
                ))
                break
    return resolved

@router.get("/{conversation_id}/messages", response_model=List[Message])
async def get_messages(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    conv = ConversationService.get_conversation(current_user.id, conversation_id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return ChatService.get_messages(conversation_id)

async def _stream_and_save_ai_response(
    conv_id: str,
    user_id: str,
    messages_context: List[Dict[str, Any]],
    model_to_use: str,
    new_title_if_generated: Optional[str] = None
):
    """Generator for SSE stream that also accumulates assistant reply and saves it upon completion."""
    accumulated_chunks = []
    try:
        async for chunk in AIService.stream_chat_completion(messages_context, model=model_to_use, user_id=user_id):
            accumulated_chunks.append(chunk)
            payload = {"delta": chunk, "done": False}
            yield f"data: {json.dumps(payload)}\n\n"
            # Small yield to ensure network flush
            await asyncio.sleep(0.001)
            
    except asyncio.CancelledError:
        # Stream aborted by client
        pass
    finally:
        full_response = "".join(accumulated_chunks).strip()
        if not full_response:
            full_response = "NRN AI couldn't respond right now — please try again."
            
        saved_msg = ChatService.add_message(
            conv_id=conv_id,
            role="assistant",
            content=full_response,
            model=model_to_use
        )
        
        final_payload = {
            "delta": "",
            "done": True,
            "message_id": saved_msg.id,
            "created_at": saved_msg.created_at,
            "title": new_title_if_generated
        }
        yield f"data: {json.dumps(final_payload)}\n\n"

@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    conv = ConversationService.get_conversation(current_user.id, conversation_id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    
    # Resolve attachments
    attachments = _resolve_attachments(current_user.id, payload.attachment_ids)
    
    # Add user message
    model_to_use = payload.model or conv.model or settings.AI_MODEL
    user_msg = ChatService.add_message(
        conv_id=conversation_id,
        role="user",
        content=payload.content,
        attachments=attachments,
        model=model_to_use
    )
    
    # Auto-generate title if default title
    generated_title = None
    all_current_msgs = ChatService.get_messages(conversation_id)
    if conv.title in ["New Conversation", "Untitled conversation"] or len(all_current_msgs) <= 2:
        generated_title = await AIService.generate_title(payload.content, model=model_to_use)
        ConversationService.update_conversation(current_user.id, conversation_id, title=generated_title, model=model_to_use)
    
    # Build context
    messages_context = [m.model_dump() for m in all_current_msgs]
    
    return StreamingResponse(
        _stream_and_save_ai_response(
            conv_id=conversation_id,
            user_id=current_user.id,
            messages_context=messages_context,
            model_to_use=model_to_use,
            new_title_if_generated=generated_title
        ),
        media_type="text/event-stream"
    )

@router.patch("/{conversation_id}/messages/{message_id}")
async def edit_message(
    conversation_id: str,
    message_id: str,
    payload: EditMessageRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    conv = ConversationService.get_conversation(current_user.id, conversation_id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        
    model_to_use = payload.model or conv.model or settings.AI_MODEL
    edit_result = ChatService.edit_message_and_truncate(
        conv_id=conversation_id,
        msg_id=message_id,
        new_content=payload.content,
        model=model_to_use
    )
    if not edit_result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
        
    _, truncated_context = edit_result
    
    return StreamingResponse(
        _stream_and_save_ai_response(
            conv_id=conversation_id,
            user_id=current_user.id,
            messages_context=truncated_context,
            model_to_use=model_to_use
        ),
        media_type="text/event-stream"
    )

@router.post("/{conversation_id}/messages/{message_id}/regenerate")
async def regenerate_message(
    conversation_id: str,
    message_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    conv = ConversationService.get_conversation(current_user.id, conversation_id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        
    truncated_context = ChatService.truncate_for_regenerate(conversation_id, message_id)
    if not truncated_context:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
        
    model_to_use = conv.model or settings.AI_MODEL
    
    return StreamingResponse(
        _stream_and_save_ai_response(
            conv_id=conversation_id,
            user_id=current_user.id,
            messages_context=truncated_context,
            model_to_use=model_to_use
        ),
        media_type="text/event-stream"
    )
