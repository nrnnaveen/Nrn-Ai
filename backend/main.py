import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.config import settings
from backend.middleware.rate_limit import RateLimitMiddleware
from backend.auth.routes import router as auth_router
from backend.routes.users import router as users_router
from backend.routes.conversations import router as conversations_router
from backend.routes.chat import router as chat_router
from backend.routes.uploads import router as uploads_router
from backend.routes.models import router as models_router
from backend.routes.group import router as group_router
from backend.routes.ws import router as ws_router
from backend.routes.feedback import router as feedback_router
from backend.services.group_service import GroupService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nrn_ai")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Checks & Data Initialization
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Initialize groups room
    GroupService._ensure_default_room()
    
    if not settings.OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY is not set in environment or .env file.")
    else:
        logger.info("OpenRouter API key detected and configured.")
        
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="NRN AI - Production Multi-User AI Workspace & Group Collaboration",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

# Global Exception Handler to prevent stack trace leakage
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later."}
    )

# Register API Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(conversations_router)
app.include_router(chat_router)
app.include_router(uploads_router)
app.include_router(models_router)
app.include_router(group_router)
app.include_router(ws_router)
app.include_router(feedback_router)

# Mount Frontend Static Assets
frontend_dir = settings.DATA_DIR.parent / "frontend"
app.mount("/css", StaticFiles(directory=str(frontend_dir / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(frontend_dir / "js")), name="js")
app.mount("/assets", StaticFiles(directory=str(frontend_dir / "assets")), name="assets")

# Frontend Page Routes
@app.get("/")
async def serve_index():
    return FileResponse(frontend_dir / "index.html")

@app.get("/login")
async def serve_login():
    return FileResponse(frontend_dir / "login.html")

@app.get("/register")
async def serve_register():
    return FileResponse(frontend_dir / "register.html")

@app.get("/app")
async def serve_app():
    return FileResponse(frontend_dir / "app.html")

@app.get("/group")
async def serve_group():
    return FileResponse(frontend_dir / "group.html")

@app.get("/favicon.svg")
async def serve_favicon():
    return FileResponse(frontend_dir / "assets" / "favicon.svg")
