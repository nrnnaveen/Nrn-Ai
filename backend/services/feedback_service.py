from datetime import datetime, timezone
from pathlib import Path
from backend.utils.storage import append_text
from backend.config import settings

class FeedbackService:
    @staticmethod
    def append_feedback(username: str, feedback_text: str) -> None:
        clean_text = feedback_text.strip()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        entry = (
            "----------------------------------------\n"
            f"User: {username}\n"
            f"Timestamp: {timestamp}\n"
            f"Feedback: {clean_text}\n"
            "----------------------------------------\n"
        )
        
        append_text(settings.FEEDBACK_FILE, entry)
