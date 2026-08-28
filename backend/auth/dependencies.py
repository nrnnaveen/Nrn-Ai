from typing import Optional
from fastapi import Request, HTTPException, status, Depends, Query, WebSocket
from backend.auth.security import decode_access_token
from backend.models.user import UserInDB, UserPublic
from backend.utils.storage import read_json
from backend.config import settings

def get_user_by_id(user_id: str) -> Optional[UserInDB]:
    users_data = read_json(settings.DATA_DIR / "users.json", default_factory=list)
    for u in users_data:
        if u.get("id") == user_id:
            return UserInDB(**u)
    return None

def get_user_by_username_or_email(identifier: str) -> Optional[UserInDB]:
    identifier = identifier.strip().lower()
    users_data = read_json(settings.DATA_DIR / "users.json", default_factory=list)
    for u in users_data:
        if u.get("username", "").lower() == identifier or u.get("email", "").lower() == identifier:
            return UserInDB(**u)
    return None

async def get_current_user(request: Request) -> UserInDB:
    token: Optional[str] = None
    
    # 1. Check httpOnly cookie
    if "access_token" in request.cookies:
        token = request.cookies.get("access_token")
    
    # 2. Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

async def get_current_user_ws(websocket: WebSocket, token: Optional[str] = Query(None)) -> Optional[UserInDB]:
    """Authenticates WebSocket connections using either cookie or query parameter."""
    auth_token = token
    if not auth_token and "access_token" in websocket.cookies:
        auth_token = websocket.cookies.get("access_token")
        
    if not auth_token:
        return None
        
    payload = decode_access_token(auth_token)
    if not payload or "sub" not in payload:
        return None
        
    return get_user_by_id(payload["sub"])
