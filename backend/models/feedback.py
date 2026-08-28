from pydantic import BaseModel, Field

class FeedbackCreate(BaseModel):
    feedback: str = Field(..., min_length=2, max_length=5000)
