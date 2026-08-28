from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from fastapi.responses import FileResponse
from backend.models.user import UserInDB
from backend.models.attachment import Attachment
from backend.auth.dependencies import get_current_user
from backend.services.upload_service import UploadService
from backend.utils.storage import read_json
from backend.config import settings

router = APIRouter(tags=["uploads"])

@router.post("/api/conversations/{conversation_id}/upload", response_model=Attachment)
async def upload_attachment(
    conversation_id: str,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user)
):
    # Verify conversation ownership if not a new one
    if conversation_id != "new":
        conversations = read_json(settings.DATA_DIR / "conversations.json", default_factory=list)
        conv = next((c for c in conversations if c.get("id") == conversation_id and c.get("owner_id") == current_user.id), None)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    
    attachment = await UploadService.save_upload(file, current_user.id, conversation_id)
    return attachment

@router.get("/api/uploads/{attachment_id}")
async def serve_attachment(
    attachment_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    path_info = UploadService.get_upload_path(current_user.id, attachment_id)
    if not path_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found or access denied.")
    
    file_path, filename = path_info
    return FileResponse(file_path, filename=filename)
