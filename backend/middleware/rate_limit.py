import time
import logging
from typing import Dict, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from backend.config import settings

logger = logging.getLogger("nrn_ai.rate_limit")

class RateLimitMiddleware(BaseHTTPMiddleware):
    # Class-level store to allow clean reset in tests
    request_records: Dict[str, List[float]] = {}
    last_cleanup: float = time.time()

    @classmethod
    def reset(cls):
        cls.request_records.clear()
        cls.last_cleanup = time.time()

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            if parts:
                return parts[0]
        
        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip:
            return cf_ip.strip()

        return request.client.host if request.client else "127.0.0.1"

    def _cleanup_all_records(self, window_seconds: float = 60.0):
        now = time.time()
        if now - self.last_cleanup < 300.0:
            return

        self.last_cleanup = now
        expired_keys = []
        for key, timestamps in list(self.request_records.items()):
            valid_timestamps = [t for t in timestamps if now - t < window_seconds]
            if valid_timestamps:
                self.request_records[key] = valid_timestamps
            else:
                expired_keys.append(key)

        for k in expired_keys:
            self.request_records.pop(k, None)

    def _clean_old_records(self, key: str, window_seconds: float = 60.0):
        now = time.time()
        if key in self.request_records:
            self.request_records[key] = [t for t in self.request_records[key] if now - t < window_seconds]
            if not self.request_records[key]:
                del self.request_records[key]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        self._cleanup_all_records()

        if not path.startswith("/api") or method not in ["POST", "PATCH", "DELETE"]:
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        limit = 60
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
            logger.warning(f"Rate limit exceeded for {client_ip} on category '{category}'")
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please wait a moment before trying again."}
            )

        records.append(time.time())
        self.request_records[key] = records

        return await call_next(request)
