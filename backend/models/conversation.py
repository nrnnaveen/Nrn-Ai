from datetime import datetime, timezone
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from backend.models.attachment import Attachment

MessageRole = Literal["user", "assistant", "system"]

class Message(BaseModel):
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    attachments: List[Attachment] = Field(default_factory=list)
    model: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None

class Conversation(BaseModel):
    id: str
    owner_id: str
    title: str
    model: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    message_count: int = 0

class ConversationCreate(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)
    model: Optional[str] = None
    attachment_ids: List[str] = Field(default_factory=list)

class EditMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)
    model: Optional[str] = None
