from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel, Field

SenderType = Literal["user", "ai", "system"]

class GroupMessage(BaseModel):
    id: str
    room_id: str
    sender_type: SenderType
    sender_id: Optional[str] = None
    sender_name: str
    content: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class GroupRoom(BaseModel):
    id: str
    name: str
    description: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SendGroupMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
