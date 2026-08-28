import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from backend.config import settings

logger = logging.getLogger("nrn_ai.security_headers")

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Applies defense-in-depth HTTP security headers to all responses and
    validates incoming request body size limits.
    """
    async def dispatch(self, request: Request, call_next):
        # 1. Check Content-Length to prevent oversized request resource exhaustion
        content_length_header = request.headers.get("Content-Length")
        if content_length_header:
            try:
                content_length = int(content_length_header)
                # Allow higher limit for uploads
                max_bytes = settings.MAX_UPLOAD_SIZE_BYTES if "/upload" in request.url.path else settings.MAX_REQUEST_BODY_BYTES
                if content_length > max_bytes:
                    max_mb = max_bytes // (1024 * 1024)
                    return JSONResponse(
                        status_code=413,
                        content={"detail": f"Request body exceeds maximum allowed size of {max_mb}MB."}
                    )
            except ValueError:
                pass

        # 2. Process Request
        response: Response = await call_next(request)

        # 3. Apply Defensive Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        
        # CSP: strict allowlist compatible with modern static ES modules and SVG icons
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self'; "
            "connect-src 'self' ws: wss:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        response.headers["Content-Security-Policy"] = csp_policy

        # HSTS (Strict-Transport-Security) when running over HTTPS
        if request.url.scheme == "https" or settings.SECURE_COOKIES:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        return response
