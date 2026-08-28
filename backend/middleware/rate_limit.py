import time
from typing import Dict, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from backend.config import settings

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # Mapping from (client_ip, endpoint_category) -> list of timestamps
        self.request_records: Dict[str, List[float]] = {}
        
    def _clean_old_records(self, key: str, window_seconds: float = 60.0):
        now = time.time()
        if key in self.request_records:
            self.request_records[key] = [t for t in self.request_records[key] if now - t < window_seconds]
            if not self.request_records[key]:
                del self.request_records[key]

    async def dispatch(self, request: Request, call_next):
        # We only rate limit API mutating endpoints
        path = request.url.path
        method = request.method
        
        if not path.startswith("/api") or method not in ["POST", "PATCH", "DELETE"]:
            return await call_next(request)
            
        client_ip = request.client.host if request.client else "127.0.0.1"
        limit = 60 # default limit per minute
        category = "general"
        
        if path.startswith("/api/auth"):
            limit = settings.RATE_LIMIT_AUTH_PER_MINUTE
            category = "auth"
        elif "/messages" in path:
            limit = settings.RATE_LIMIT_MESSAGES_PER_MINUTE
            category = "messages"
        elif "/upload" in path:
            limit = settings.RATE_LIMIT_UPLOADS_PER_MINUTE
            category = "uploads"
        elif path.startswith("/api/feedback"):
            limit = settings.RATE_LIMIT_FEEDBACK_PER_MINUTE
            category = "feedback"
            
        key = f"{client_ip}:{category}"
        self._clean_old_records(key)
        
        records = self.request_records.get(key, [])
        if len(records) >= limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please wait a moment before trying again."}
            )
            
        records.append(time.time())
        self.request_records[key] = records
        
        return await call_next(request)
