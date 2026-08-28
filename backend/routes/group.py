from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from backend.models.user import UserInDB
from backend.models.group import GroupRoom, GroupMessage, SendGroupMessageRequest
from backend.auth.dependencies import get_current_user
from backend.services.group_service import GroupService
from backend.services.connection_manager import manager

router = APIRouter(prefix="/api/group", tags=["group"])

@router.get("/rooms", response_model=List[GroupRoom])
async def list_rooms(current_user: UserInDB = Depends(get_current_user)):
    return GroupService.list_rooms()

@router.get("/rooms/{room_id}/messages", response_model=List[GroupMessage])
async def get_room_messages(
    room_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    return GroupService.get_room_messages(room_id)

@router.post("/rooms/{room_id}/messages", response_model=GroupMessage)
async def send_http_message(
    room_id: str,
    payload: SendGroupMessageRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    # HTTP fallback endpoint for group messaging
    msg = GroupService.add_message(
        room_id=room_id,
        sender_type="user",
        sender_id=current_user.id,
        sender_name=current_user.username,
        content=payload.content
    )
    
    # Broadcast to live sockets
    await manager.broadcast_to_room(room_id, "message", msg.model_dump())
    
    # Trigger AI response in background task / async
    ai_msg = await GroupService.generate_ai_reply(room_id, current_user.id)
    await manager.broadcast_to_room(room_id, "message", ai_msg.model_dump())
    
    return msg
