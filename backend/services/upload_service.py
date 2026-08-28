import os
import uuid
from pathlib import Path
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from backend.config import settings
from backend.models.attachment import Attachment
from backend.utils.validation import sanitize_filename

class UploadService:
    @staticmethod
    async def save_upload(file: UploadFile, user_id: str, conversation_id: str) -> Attachment:
        # Check content type
        content_type = file.content_type or "application/octet-stream"
        allowed_types = set(settings.ALLOWED_IMAGE_TYPES + settings.ALLOWED_DOC_TYPES)
        
        if content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{content_type}'. Allowed types: images (JPEG, PNG, GIF, WebP) and documents (TXT, PDF, MD, CSV, JSON)."
            )
        
        # Read content to check size
        contents = await file.read()
        size_bytes = len(contents)
        if size_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
            max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {max_mb}MB."
            )
        
        # Determine safe file extension
        orig_name = file.filename or "attachment"
        clean_orig_name = sanitize_filename(orig_name)
        ext = Path(clean_orig_name).suffix.lower()
        if not ext:
            if "image/jpeg" in content_type:
                ext = ".jpg"
            elif "image/png" in content_type:
                ext = ".png"
            elif "image/webp" in content_type:
                ext = ".webp"
            elif "image/gif" in content_type:
                ext = ".gif"
            elif "application/pdf" in content_type:
                ext = ".pdf"
            else:
                ext = ".txt"
        
        # User upload directory
        user_dir = settings.UPLOADS_DIR / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        
        attachment_id = str(uuid.uuid4())
        stored_filename = f"{attachment_id}{ext}"
        target_path = user_dir / stored_filename
        
        with open(target_path, "wb") as f:
            f.write(contents)
        
        url = f"/api/uploads/{attachment_id}"
        
        return Attachment(
            id=attachment_id,
            conversation_id=conversation_id,
            owner_id=user_id,
            original_name=clean_orig_name,
            stored_name=stored_filename,
            mime_type=content_type,
            size_bytes=size_bytes,
            url=url
        )

    @staticmethod
    def get_upload_path(user_id: str, attachment_id: str) -> Optional[Tuple[Path, str]]:
        user_dir = settings.UPLOADS_DIR / user_id
        if not user_dir.exists():
            return None
        
        for p in user_dir.iterdir():
            if p.name.startswith(attachment_id):
                return p, p.name
        return None
