import json
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from backend.auth.dependencies import get_current_user_ws
from backend.services.connection_manager import manager
from backend.services.group_service import GroupService

logger = logging.getLogger("nrn_ai.ws")

router = APIRouter(tags=["websocket"])

@router.websocket("/ws/group/{room_id}")
async def group_websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    token: Optional[str] = Query(None)
):
    user = await get_current_user_ws(websocket, token=token)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_info = {
        "id": user.id,
        "username": user.username
    }
    
    await manager.connect(websocket, room_id, user_info)
    
    try:
        while True:
            raw_data = await websocket.receive_text()
            if not raw_data.strip():
                continue
                
            try:
                msg_payload = json.loads(raw_data)
                content = msg_payload.get("content", "").strip()
            except json.JSONDecodeError:
                content = raw_data.strip()
                
            if not content:
                continue
                
            # 1. Save and broadcast user message
            user_msg = GroupService.add_message(
                room_id=room_id,
                sender_type="user",
                sender_id=user.id,
                sender_name=user.username,
                content=content
            )
            await manager.broadcast_to_room(room_id, "message", user_msg.model_dump())
            
            # 2. Automatically generate and broadcast AI reply for the group
            try:
                ai_msg = await GroupService.generate_ai_reply(room_id, user.id)
                await manager.broadcast_to_room(room_id, "message", ai_msg.model_dump())
            except Exception as e:
                logger.error(f"Error generating AI reply for group: {e}")
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket, room_id)
    except Exception as e:
        logger.warning(f"WebSocket error in room {room_id}: {e}")
        await manager.disconnect(websocket, room_id)
