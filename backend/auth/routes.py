import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Response, Request, Depends
from backend.models.user import UserCreate, UserLogin, UserInDB, UserPublic, TokenResponse
from backend.auth.security import hash_password, verify_password, create_access_token
from backend.auth.dependencies import get_user_by_username_or_email
from backend.utils.storage import read_json, write_json
from backend.utils.validation import validate_username, validate_email, validate_password
from backend.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, response: Response):
    # Validate username
    is_valid, err = validate_username(payload.username)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    
    # Validate email
    is_valid, err = validate_email(payload.email)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    
    # Validate password
    is_valid, err = validate_password(payload.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    
    users_file = settings.DATA_DIR / "users.json"
    users = read_json(users_file, default_factory=list)
    
    # Check duplicate username or email
    for u in users:
        if u.get("username", "").lower() == payload.username.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")
        if u.get("email", "").lower() == payload.email.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
    
    # Hash password & save user
    user_id = str(uuid.uuid4())
    hashed_pwd = hash_password(payload.password)
    
    new_user = UserInDB(
        id=user_id,
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=hashed_pwd,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    
    users.append(new_user.model_dump())
    write_json(users_file, users)
    
    # Create session token
    token = create_access_token({"sub": user_id, "username": new_user.username})
    
    # Set httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False  # Allow local HTTP testing
    )
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic(
            id=new_user.id,
            username=new_user.username,
            email=new_user.email,
            created_at=new_user.created_at
        )
    )

@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, response: Response):
    user = get_user_by_username_or_email(payload.login)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )
    
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )
    
    token = create_access_token({"sub": user.id, "username": user.username})
    
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False
    )
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at
        )
    )

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", httponly=True, samesite="lax")
    return {"message": "Logged out successfully."}
