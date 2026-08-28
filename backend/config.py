import os
import secrets
import logging
from pathlib import Path
from typing import List, Dict, Any, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

BASE_DIR = Path(__file__).resolve().parent.parent
logger = logging.getLogger("nrn_ai.config")

class Settings(BaseSettings):
    APP_NAME: str = "NRN AI"
    ENV: str = "development" # "development", "production", "testing"
    OPENROUTER_API_KEY: str = ""
    AI_MODEL: str = "nvidia/nemotron-3-super-120b-a12b:free"
    SECRET_KEY: str = "nrn-ai-insecure-default-change-in-production-key-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # CORS & Security
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://0.0.0.0:8000"
    ]
    SECURE_COOKIES: bool = False
    
    # Storage paths
    DATA_DIR: Path = BASE_DIR / "data"
    UPLOADS_DIR: Path = BASE_DIR / "data" / "uploads"
    FEEDBACK_FILE: Path = BASE_DIR / "feedback.txt"
    
    # Rate limits (requests per minute)
    RATE_LIMIT_AUTH_PER_MINUTE: int = 20
    RATE_LIMIT_MESSAGES_PER_MINUTE: int = 60
    RATE_LIMIT_UPLOADS_PER_MINUTE: int = 20
    RATE_LIMIT_FEEDBACK_PER_MINUTE: int = 10
    
    # Request & Upload limits
    MAX_REQUEST_BODY_BYTES: int = 2 * 1024 * 1024       # 2 MB for standard JSON requests
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024       # 10 MB for file uploads
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    ALLOWED_DOC_TYPES: List[str] = ["text/plain", "application/pdf", "text/markdown", "text/csv", "application/json"]
    
    # Complete catalog of OpenRouter free models
    AVAILABLE_MODELS: List[Dict[str, Any]] = [
        {
            "id": "nvidia/nemotron-3-super-120b-a12b:free",
            "name": "NVIDIA: Nemotron 3 Super (free)",
            "provider": "NVIDIA",
            "supports_vision": False,
            "context_length": 262144,
            "description": "Flagship 120B NVIDIA reasoning and code generation model."
        },
        {
            "id": "nvidia/nemotron-3.5-lightning:free",
            "name": "NVIDIA: Nemotron 3.5 Lightning (free)",
            "provider": "NVIDIA",
            "supports_vision": False,
            "context_length": 1000000,
            "description": "1M context ultra-fast conversational and reasoning model."
        },
        {
            "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
            "name": "NVIDIA: Nemotron 3 Ultra (free)",
            "provider": "NVIDIA",
            "supports_vision": False,
            "context_length": 1000000,
            "description": "Massive 550B powerhouse for advanced complex reasoning."
        },
        {
            "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
            "name": "NVIDIA: Nemotron 3 Nano Omni (free)",
            "provider": "NVIDIA",
            "supports_vision": True,
            "context_length": 256000,
            "description": "Multimodal visual reasoning, tool-use, and analytical model."
        },
        {
            "id": "dots-studio/dots-3-note-preview:free",
            "name": "Dots Studio: Dots3-Note Preview (free)",
            "provider": "Dots Studio",
            "supports_vision": True,
            "context_length": 512000,
            "description": "Multimodal note drafting, visual synthesis, and structured editing."
        },
        {
            "id": "inclusionai/ling-3.0-flash-fin:free",
            "name": "Ling 3.0 Flash Fin (free)",
            "provider": "InclusionAI",
            "supports_vision": False,
            "context_length": 262144,
            "description": "High-throughput coding, finance, and mathematical reasoning."
        },
        {
            "id": "cohere/north-mini-code:free",
            "name": "Cohere: North Mini Code (free)",
            "provider": "Cohere",
            "supports_vision": False,
            "context_length": 256000,
            "description": "Specialized programming and code architecture assistant."
        },
        {
            "id": "google/gemma-4-31b-it:free",
            "name": "Google: Gemma 4 31B (free)",
            "provider": "Google",
            "supports_vision": True,
            "context_length": 262144,
            "description": "Google Gemma 4 multimodal model with strong logic and instruction following."
        },
        {
            "id": "google/gemma-4-26b-a4b-it:free",
            "name": "Google: Gemma 4 26B A4B (free)",
            "provider": "Google",
            "supports_vision": True,
            "context_length": 262144,
            "description": "Efficient multimodal instruction tuned Gemma 4 architecture."
        },
        {
            "id": "minimax/minimax-m3:free",
            "name": "MiniMax: MiniMax M3 (free)",
            "provider": "MiniMax",
            "supports_vision": True,
            "context_length": 1048576,
            "description": "1M context multimodal reasoning and long document analysis."
        },
        {
            "id": "minimax/minimax-m2.7:free",
            "name": "MiniMax: MiniMax M2.7 (free)",
            "provider": "MiniMax",
            "supports_vision": False,
            "context_length": 196608,
            "description": "High performance conversational agent for dialogue and writing."
        },
        {
            "id": "thinkingmachines/inkling:free",
            "name": "Thinking Machines: Inkling (free)",
            "provider": "Thinking Machines",
            "supports_vision": True,
            "context_length": 1048576,
            "description": "1M context multimodal vision and reasoning assistant."
        },
        {
            "id": "thinkingmachines/inkling-small:free",
            "name": "Thinking Machines: Inkling Small (free)",
            "provider": "Thinking Machines",
            "supports_vision": True,
            "context_length": 1048576,
            "description": "Lightweight high-speed multimodal reasoning model."
        },
        {
            "id": "z-ai/glm-5.2:free",
            "name": "Z.ai: GLM 5.2 (free)",
            "provider": "Z.ai",
            "supports_vision": False,
            "context_length": 256000,
            "description": "High capability general intelligence and multilingual reasoning."
        },
        {
            "id": "liquid/lfm-2.5-2.6b:free",
            "name": "LiquidAI: LFM2.5-2.6B (free)",
            "provider": "LiquidAI",
            "supports_vision": False,
            "context_length": 65536,
            "description": "Liquid Neural Network foundation model for swift responses."
        },
        {
            "id": "poolside/laguna-s-2.1:free",
            "name": "Poolside: Laguna S 2.1 (free)",
            "provider": "Poolside",
            "supports_vision": False,
            "context_length": 262144,
            "description": "Advanced software engineering and code generation model."
        },
        {
            "id": "poolside/laguna-xs-2.1:free",
            "name": "Poolside: Laguna XS 2.1 (free)",
            "provider": "Poolside",
            "supports_vision": False,
            "context_length": 262144,
            "description": "Compact, fast coding assistant for rapid development."
        },
        {
            "id": "nvidia/nemotron-3.5-content-safety:free",
            "name": "NVIDIA: Nemotron 3.5 Content Safety (free)",
            "provider": "NVIDIA",
            "supports_vision": True,
            "context_length": 128000,
            "description": "Specialized moderation, analysis, and validation model."
        }
    ]

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Validate Secret Key strength on startup
if settings.SECRET_KEY == "nrn-ai-insecure-default-change-in-production-key-2026":
    if settings.ENV == "production":
        logger.critical("SECURITY WARNING: Using default SECRET_KEY in production! Generate a random secret immediately.")
    else:
        logger.warning("Using default development SECRET_KEY. Set SECRET_KEY in .env for production.")
