from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class Attachment(BaseModel):
    id: str
    conversation_id: str
    owner_id: str
    original_name: str
    stored_name: str
    mime_type: str
    size_bytes: int
    url: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AttachmentPublic(BaseModel):
    id: str
    original_name: str
    mime_type: str
    size_bytes: int
    url: str
