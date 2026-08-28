import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from backend.models.conversation import Message, MessageRole
from backend.models.attachment import Attachment
from backend.services.conversation_service import ConversationService
from backend.utils.storage import read_json, write_json
from backend.config import settings

class ChatService:
    @staticmethod
    def _msg_file() -> Path:
        return settings.DATA_DIR / "messages.json"

    @classmethod
    def get_messages(cls, conv_id: str) -> List[Message]:
        all_msgs = read_json(cls._msg_file(), default_factory=dict)
        raw_msgs = all_msgs.get(conv_id, [])
        return [Message(**m) for m in raw_msgs]

    @classmethod
    def add_message(
        cls,
        conv_id: str,
        role: MessageRole,
        content: str,
        attachments: List[Attachment] = None,
        model: Optional[str] = None
    ) -> Message:
        all_msgs = read_json(cls._msg_file(), default_factory=dict)
        if conv_id not in all_msgs:
            all_msgs[conv_id] = []
            
        new_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            role=role,
            content=content,
            attachments=attachments or [],
            model=model,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        
        all_msgs[conv_id].append(new_msg.model_dump())
        write_json(cls._msg_file(), all_msgs)
        
        # Touch conversation timestamp
        ConversationService.touch_conversation(conv_id)
        
        return new_msg

    @classmethod
    def edit_message_and_truncate(
        cls,
        conv_id: str,
        msg_id: str,
        new_content: str,
        model: Optional[str] = None
    ) -> Optional[Tuple[Message, List[Dict[str, Any]]]]:
        """Edits a user message, removes all messages after it, and returns the updated message and prior context."""
        all_msgs = read_json(cls._msg_file(), default_factory=dict)
        raw_msgs = all_msgs.get(conv_id, [])
        
        target_idx = -1
        for i, m in enumerate(raw_msgs):
            if m.get("id") == msg_id:
                target_idx = i
                break
                
        if target_idx == -1:
            return None
            
        # Update target message
        raw_msgs[target_idx]["content"] = new_content
        raw_msgs[target_idx]["updated_at"] = datetime.now(timezone.utc).isoformat()
        if model:
            raw_msgs[target_idx]["model"] = model
            
        # Truncate messages after target
        truncated_msgs = raw_msgs[: target_idx + 1]
        all_msgs[conv_id] = truncated_msgs
        write_json(cls._msg_file(), all_msgs)
        
        ConversationService.touch_conversation(conv_id, count_increment=0)
        
        updated_msg = Message(**truncated_msgs[-1])
        return updated_msg, truncated_msgs

    @classmethod
    def truncate_for_regenerate(
        cls,
        conv_id: str,
        msg_id: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Prepares message history for regeneration. If msg_id is assistant reply, removes it and any later messages."""
        all_msgs = read_json(cls._msg_file(), default_factory=dict)
        raw_msgs = all_msgs.get(conv_id, [])
        
        target_idx = -1
        for i, m in enumerate(raw_msgs):
            if m.get("id") == msg_id:
                target_idx = i
                break
                
        if target_idx == -1:
            return None
            
        target_msg = raw_msgs[target_idx]
        if target_msg.get("role") == "assistant":
            # Remove this assistant message and anything after
            truncated_msgs = raw_msgs[:target_idx]
        else:
            # If user message was selected to regenerate, remove everything after it
            truncated_msgs = raw_msgs[:target_idx + 1]
            
        all_msgs[conv_id] = truncated_msgs
        write_json(cls._msg_file(), all_msgs)
        return truncated_msgs
