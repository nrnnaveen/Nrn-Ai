from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from backend.models.user import UserInDB
from backend.models.conversation import Conversation, ConversationCreate, ConversationUpdate
from backend.auth.dependencies import get_current_user
from backend.services.conversation_service import ConversationService

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

@router.get("", response_model=List[Conversation])
async def list_conversations(current_user: UserInDB = Depends(get_current_user)):
    return ConversationService.list_conversations(current_user.id)

@router.post("", response_model=Conversation, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate,
    current_user: UserInDB = Depends(get_current_user)
):
    return ConversationService.create_conversation(
        user_id=current_user.id,
        title=payload.title,
        model=payload.model
    )

@router.get("/search")
async def search_conversations(
    q: str = Query(..., min_length=1, description="Search query"),
    current_user: UserInDB = Depends(get_current_user)
):
    return ConversationService.search_conversations(current_user.id, q)

@router.get("/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    conv = ConversationService.get_conversation(current_user.id, conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied."
        )
    return conv

@router.patch("/{conversation_id}", response_model=Conversation)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    current_user: UserInDB = Depends(get_current_user)
):
    conv = ConversationService.update_conversation(
        user_id=current_user.id,
        conv_id=conversation_id,
        title=payload.title,
        model=payload.model
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied."
        )
    return conv

@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    success = ConversationService.delete_conversation(current_user.id, conversation_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied."
        )
    return {"message": "Conversation permanently deleted."}
