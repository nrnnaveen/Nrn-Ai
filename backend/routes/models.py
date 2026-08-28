import logging
import httpx
from fastapi import APIRouter
from backend.config import settings

logger = logging.getLogger("nrn_ai.models")

router = APIRouter(prefix="/api/models", tags=["models"])

@router.get("")
async def list_models():
    # Base list from config
    models_dict = {m["id"]: m for m in settings.AVAILABLE_MODELS}

    # Attempt to fetch live openrouter models if key configured to discover any newer free models
    if settings.OPENROUTER_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {settings.OPENROUTER_API_KEY.strip()}"}
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get("https://openrouter.ai/api/v1/models", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    for m in data.get("data", []):
                        m_id = m.get("id", "")
                        if ":free" in m_id and m_id not in models_dict:
                            arch = m.get("architecture", {})
                            modality = arch.get("modality", "")
                            has_vision = "image" in modality or "multimodal" in modality or "vision" in m_id
                            models_dict[m_id] = {
                                "id": m_id,
                                "name": m.get("name", m_id),
                                "provider": m_id.split("/")[0].capitalize() if "/" in m_id else "AI",
                                "supports_vision": has_vision,
                                "context_length": m.get("context_length", 32768),
                                "description": m.get("description", "OpenRouter free model.")[:140]
                            }
        except Exception as e:
            logger.debug(f"Live models fetch bypassed: {e}")

    return {
        "default": settings.AI_MODEL,
        "models": list(models_dict.values())
    }
