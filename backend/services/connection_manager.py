import json
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger("nrn_ai.connection_manager")

class ConnectionManager:
    def __init__(self):
        # Mapping from room_id -> set of active WebSockets
        self.active_rooms: Dict[str, Set[WebSocket]] = {}
        # Mapping from websocket -> user info
        self.socket_users: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_info: Dict[str, Any]):
        await websocket.accept()
        if room_id not in self.active_rooms:
            self.active_rooms[room_id] = set()
        self.active_rooms[room_id].add(websocket)
        self.socket_users[websocket] = user_info
        
        # Broadcast presence update
        await self.broadcast_presence(room_id)

    async def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_rooms:
            self.active_rooms[room_id].discard(websocket)
            if not self.active_rooms[room_id]:
                del self.active_rooms[room_id]
        
        if websocket in self.socket_users:
            del self.socket_users[websocket]
            
        await self.broadcast_presence(room_id)

    async def broadcast_to_room(self, room_id: str, event_type: str, data: Any):
        if room_id not in self.active_rooms:
            return
            
        payload = json.dumps({"type": event_type, "data": data})
        stale_sockets = set()
        
        for ws in self.active_rooms[room_id]:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"Error broadcasting to socket: {e}")
                stale_sockets.add(ws)
                
        for stale in stale_sockets:
            await self.disconnect(stale, room_id)

    async def broadcast_presence(self, room_id: str):
        if room_id not in self.active_rooms:
            return
            
        active_users = []
        for ws in self.active_rooms[room_id]:
            u = self.socket_users.get(ws)
            if u:
                active_users.append(u.get("username"))
                
        await self.broadcast_to_room(room_id, "presence", {
            "room_id": room_id,
            "online_count": len(self.active_rooms[room_id]),
            "users": list(set(active_users))
        })

manager = ConnectionManager()
