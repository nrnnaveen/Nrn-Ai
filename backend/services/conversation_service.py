import uuid
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any
from backend.models.conversation import Conversation, ConversationCreate, ConversationUpdate
from backend.utils.storage import read_json, write_json
from backend.config import settings

class ConversationService:
    @staticmethod
    def _conv_file() -> Path:
        return settings.DATA_DIR / "conversations.json"

    @staticmethod
    def _msg_file() -> Path:
        return settings.DATA_DIR / "messages.json"

    @classmethod
    def list_conversations(cls, user_id: str) -> List[Conversation]:
        convs = read_json(cls._conv_file(), default_factory=list)
        user_convs = [Conversation(**c) for c in convs if c.get("owner_id") == user_id]
        user_convs.sort(key=lambda x: x.updated_at, reverse=True)
        return user_convs

    @classmethod
    def get_conversation(cls, user_id: str, conv_id: str) -> Optional[Conversation]:
        convs = read_json(cls._conv_file(), default_factory=list)
        for c in convs:
            if c.get("id") == conv_id and c.get("owner_id") == user_id:
                return Conversation(**c)
        return None

    @classmethod
    def create_conversation(
        cls,
        user_id: str,
        title: Optional[str] = None,
        model: Optional[str] = None
    ) -> Conversation:
        convs = read_json(cls._conv_file(), default_factory=list)
        now = datetime.now(timezone.utc).isoformat()
        
        new_conv = Conversation(
            id=str(uuid.uuid4()),
            owner_id=user_id,
            title=title.strip() if title else "New Conversation",
            model=model or settings.AI_MODEL,
            created_at=now,
            updated_at=now,
            message_count=0
        )
        
        convs.append(new_conv.model_dump())
        write_json(cls._conv_file(), convs)
        return new_conv

    @classmethod
    def update_conversation(
        cls,
        user_id: str,
        conv_id: str,
        title: Optional[str] = None,
        model: Optional[str] = None
    ) -> Optional[Conversation]:
        convs = read_json(cls._conv_file(), default_factory=list)
        updated_conv = None
        
        for i, c in enumerate(convs):
            if c.get("id") == conv_id and c.get("owner_id") == user_id:
                if title is not None:
                    c["title"] = title.strip()
                if model is not None:
                    c["model"] = model
                c["updated_at"] = datetime.now(timezone.utc).isoformat()
                convs[i] = c
                updated_conv = Conversation(**c)
                break
                
        if updated_conv:
            write_json(cls._conv_file(), convs)
        return updated_conv

    @classmethod
    def touch_conversation(cls, conv_id: str, count_increment: int = 1) -> None:
        convs = read_json(cls._conv_file(), default_factory=list)
        for c in convs:
            if c.get("id") == conv_id:
                c["updated_at"] = datetime.now(timezone.utc).isoformat()
                c["message_count"] = c.get("message_count", 0) + count_increment
                break
        write_json(cls._conv_file(), convs)

    @classmethod
    def delete_conversation(cls, user_id: str, conv_id: str) -> bool:
        convs = read_json(cls._conv_file(), default_factory=list)
        initial_len = len(convs)
        convs = [c for c in convs if not (c.get("id") == conv_id and c.get("owner_id") == user_id)]
        
        if len(convs) == initial_len:
            return False
            
        write_json(cls._conv_file(), convs)
        
        # Cascade delete messages
        all_msgs = read_json(cls._msg_file(), default_factory=dict)
        if conv_id in all_msgs:
            # Delete attachments from disk
            messages = all_msgs[conv_id]
            for m in messages:
                for att in m.get("attachments", []):
                    stored_name = att.get("stored_name")
                    if stored_name:
                        att_path = settings.UPLOADS_DIR / user_id / stored_name
                        if att_path.exists():
                            try:
                                att_path.unlink()
                            except OSError:
                                pass
            del all_msgs[conv_id]
            write_json(cls._msg_file(), all_msgs)
            
        return True

    @classmethod
    def search_conversations(cls, user_id: str, query: str) -> List[Dict[str, Any]]:
        q = query.strip().lower()
        if not q:
            return []
            
        convs = cls.list_conversations(user_id)
        all_msgs = read_json(cls._msg_file(), default_factory=dict)
        
        results = []
        for conv in convs:
            title_match = q in conv.title.lower()
            matching_snippets = []
            
            conv_msgs = all_msgs.get(conv.id, [])
            for m in conv_msgs:
                content = m.get("content", "")
                if q in content.lower():
                    # extract small snippet around query
                    idx = content.lower().find(q)
                    start = max(0, idx - 40)
                    end = min(len(content), idx + len(q) + 40)
                    snippet = ("..." if start > 0 else "") + content[start:end] + ("..." if end < len(content) else "")
                    matching_snippets.append(snippet)
            
            if title_match or matching_snippets:
                results.append({
                    "conversation": conv.model_dump(),
                    "matched_in_title": title_match,
                    "snippets": matching_snippets[:3]
                })
                
        return results
