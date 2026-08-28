from fastapi import APIRouter, Depends, HTTPException, status
from backend.models.user import UserInDB
from backend.models.feedback import FeedbackCreate
from backend.auth.dependencies import get_current_user
from backend.services.feedback_service import FeedbackService

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    payload: FeedbackCreate,
    current_user: UserInDB = Depends(get_current_user)
):
    clean = payload.feedback.strip()
    if not clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Feedback cannot be empty."
        )
        
    FeedbackService.append_feedback(current_user.username, clean)
    return {"message": "Thank you! Your feedback has been recorded."}
