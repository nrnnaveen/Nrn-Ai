import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.models.group import GroupRoom, GroupMessage
from backend.services.ai_service import AIService
from backend.utils.storage import read_json, write_json
from backend.config import settings

logger = logging.getLogger("nrn_ai.group_service")

class GroupService:
    @staticmethod
    def _groups_file() -> Path:
        return settings.DATA_DIR / "groups.json"

    @classmethod
    def _ensure_default_room(cls) -> Dict[str, Any]:
        data = read_json(cls._groups_file(), default_factory=lambda: {
            "rooms": [
                {
                    "id": "general",
                    "name": "General AI Group",
                    "description": "Shared collaborative room for all members and NRN AI.",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            ],
            "messages": {
                "general": []
            }
        })
        if "rooms" not in data or not data["rooms"]:
            data["rooms"] = [
                {
                    "id": "general",
                    "name": "General AI Group",
                    "description": "Shared collaborative room for all members and NRN AI.",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            ]
        if "messages" not in data:
            data["messages"] = {"general": []}
        return data

    @classmethod
    def list_rooms(cls) -> List[GroupRoom]:
        data = cls._ensure_default_room()
        return [GroupRoom(**r) for r in data.get("rooms", [])]

    @classmethod
    def get_room_messages(cls, room_id: str) -> List[GroupMessage]:
        data = cls._ensure_default_room()
        raw_msgs = data.get("messages", {}).get(room_id, [])
        return [GroupMessage(**m) for m in raw_msgs]

    @classmethod
    def add_message(
        cls,
        room_id: str,
        sender_type: str,
        sender_id: Optional[str],
        sender_name: str,
        content: str
    ) -> GroupMessage:
        data = cls._ensure_default_room()
        if room_id not in data.get("messages", {}):
            data["messages"][room_id] = []
            
        new_msg = GroupMessage(
            id=str(uuid.uuid4()),
            room_id=room_id,
            sender_type=sender_type,
            sender_id=sender_id,
            sender_name=sender_name,
            content=content,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        
        data["messages"][room_id].append(new_msg.model_dump())
        write_json(cls._groups_file(), data)
        return new_msg

    @classmethod
    async def generate_ai_reply(cls, room_id: str, user_id: str) -> GroupMessage:
        """Builds context from recent group messages and produces an AI response."""
        recent_msgs = cls.get_room_messages(room_id)[-12:]
        
        formatted_context = []
        for m in recent_msgs:
            if m.sender_type == "ai":
                formatted_context.append({"role": "assistant", "content": m.content})
            else:
                formatted_context.append({"role": "user", "content": f"[{m.sender_name}]: {m.content}"})
                
        ai_reply_chunks = []
        async for chunk in AIService.stream_chat_completion(formatted_context, model=settings.AI_MODEL, user_id=user_id):
            ai_reply_chunks.append(chunk)
            
        full_reply = "".join(ai_reply_chunks).strip()
        if not full_reply:
            full_reply = "NRN AI is participating in the group discussion."
            
        return cls.add_message(
            room_id=room_id,
            sender_type="ai",
            sender_id=None,
            sender_name="NRN AI",
            content=full_reply
        )
