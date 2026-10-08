"""
FastAPI Local AI Server for WhatsApp Group Bot
Exposes REST endpoints for:
- /api/status & /health (Status diagnostics: available, busy, unavailable)
- /api/models (List of 6 Qwen 3.5 models)
- /api/models/download (Download model)
- /api/models/apply (Apply / switch active model)
- /api/models/delete (Delete downloaded model)
- /api/models/config (Update context length)
- /api/chat (.ask)
- /api/multimodal (.ask with image attachment / quoted image)
- /api/summarize (.summarize)
"""

import os
import io
import base64
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models_manager import AIModelsManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AIServer")

app = FastAPI(
    title="Local AI Microservice for WhatsApp Bot",
    description="On-device AI microservice powered by Qwen 3.5 with multimodal image recognition",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI Manager
models_manager = AIModelsManager()


# Request Schemas
class ChatRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.7
    sender_name: Optional[str] = "User"


class SummarizeRequest(BaseModel):
    messages: List[Dict[str, Any]]
    group_name: Optional[str] = "WhatsApp Group"
    max_tokens: Optional[int] = 768


class MultimodalJsonRequest(BaseModel):
    image_base64: str
    question: Optional[str] = "Describe what you see in this image."
    system_prompt: Optional[str] = None
    max_tokens: Optional[int] = 512


class ApplyModelRequest(BaseModel):
    model_id: str


class DownloadModelRequest(BaseModel):
    model_id: str


class DeleteModelRequest(BaseModel):
    model_id: str


class ConfigRequest(BaseModel):
    context_length: Optional[int] = None
    active_model_id: Optional[str] = None


# =============================================================================
# STATUS & MODEL MANAGEMENT ENDPOINTS
# =============================================================================

@app.get("/")
@app.get("/health")
@app.get("/api/status")
def health_check():
    """Returns AI model health, active model, context length, and status (available, busy, unavailable)."""
    return models_manager.get_status()


@app.get("/api/models")
def list_models():
    """Returns list of all 6 Qwen 3.5 AI models with download, active status, and specs."""
    return {
        "success": True,
        "models": models_manager.get_models_list(),
        "active_model_id": models_manager.active_model_id,
        "status": models_manager.status,
        "context_length": models_manager.context_length
    }


@app.post("/api/models/download")
def download_model_endpoint(req: DownloadModelRequest):
    """Starts downloading an AI model."""
    try:
        res = models_manager.download_model(req.model_id)
        return res
    except Exception as e:
        logger.error(f"Download model error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/models/apply")
def apply_model_endpoint(req: ApplyModelRequest):
    """Applies and activates a selected AI model."""
    try:
        res = models_manager.apply_model(req.model_id)
        return res
    except Exception as e:
        logger.error(f"Apply model error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/models/delete")
def delete_model_endpoint(req: DeleteModelRequest):
    """Deletes a downloaded model."""
    try:
        res = models_manager.delete_model(req.model_id)
        return res
    except Exception as e:
        logger.error(f"Delete model error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/models/config")
def update_config_endpoint(req: ConfigRequest):
    """Updates global AI configuration (e.g. context length)."""
    try:
        result = {}
        if req.context_length is not None:
            result = models_manager.set_context_length(req.context_length)
        if req.active_model_id is not None:
            result = models_manager.apply_model(req.active_model_id)
        return {
            "success": True,
            "context_length": models_manager.context_length,
            "active_model_id": models_manager.active_model_id,
            "status": models_manager.status
        }
    except Exception as e:
        logger.error(f"Update config error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# INFERENCE ENDPOINTS (Chat, Multimodal Image Recognition, Summarize)
# =============================================================================

@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    """Processes plain text questions (.ask) with the active Qwen 3.5 model."""
    try:
        reply = models_manager.chat(
            prompt=req.prompt,
            system_prompt=req.system_prompt,
            max_tokens=req.max_tokens or 512,
            temperature=req.temperature if req.temperature is not None else 0.7,
            sender_name=req.sender_name or "User"
        )
        return {
            "success": True,
            "response": reply,
            "model": models_manager.active_model_id,
            "model_name": AVAILABLE_MODELS.get(models_manager.active_model_id, {}).get("name", "Qwen 3.5")
        }
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/multimodal")
async def multimodal_endpoint(
    question: str = Form("Describe what you see in this image."),
    system_prompt: Optional[str] = Form(None),
    max_tokens: int = Form(512),
    image: UploadFile = File(...)
):
    """Processes multimodal image recognition (.ask with image upload)."""
    try:
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image uploaded.")

        reply = models_manager.multimodal_ask(
            image_input=image_bytes,
            question=question,
            system_prompt=system_prompt,
            max_tokens=max_tokens
        )
        return {
            "success": True,
            "response": reply,
            "model": models_manager.active_model_id,
            "model_name": AVAILABLE_MODELS.get(models_manager.active_model_id, {}).get("name", "Qwen 3.5")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Multimodal endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/multimodal/json")
def multimodal_json_endpoint(req: MultimodalJsonRequest):
    """Processes base64 image + question (.ask with image / reply to image)."""
    try:
        image_data = req.image_base64
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)

        reply = models_manager.multimodal_ask(
            image_input=image_bytes,
            question=req.question or "Describe this image.",
            system_prompt=req.system_prompt,
            max_tokens=req.max_tokens or 512
        )
        return {
            "success": True,
            "response": reply,
            "model": models_manager.active_model_id,
            "model_name": AVAILABLE_MODELS.get(models_manager.active_model_id, {}).get("name", "Qwen 3.5")
        }
    except Exception as e:
        logger.error(f"Multimodal JSON error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/summarize")
def summarize_endpoint(req: SummarizeRequest):
    """Summarizes up to 100 recent group chat messages (.summarize)."""
    try:
        summary = models_manager.summarize_messages(
            messages=req.messages,
            group_name=req.group_name or "WhatsApp Group",
            max_tokens=req.max_tokens or 768
        )
        return {
            "success": True,
            "summary": summary,
            "model": models_manager.active_model_id,
            "model_name": AVAILABLE_MODELS.get(models_manager.active_model_id, {}).get("name", "Qwen 3.5")
        }
    except Exception as e:
        logger.error(f"Summarize endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/shutdown")
def shutdown_endpoint():
    """Immediately stops the AI microservice process to release RAM."""
    import threading
    def kill_soon():
        import time
        time.sleep(0.3)
        os._exit(0)
    threading.Thread(target=kill_soon).start()
    return {"success": True, "message": "AI microservice shutting down"}


if __name__ == "__main__":
    import uvicorn
    from models_manager import AVAILABLE_MODELS
    port = int(os.getenv("AI_SERVICE_PORT", 5005))
    host = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    logger.info(f"Starting Local Qwen 3.5 AI Microservice on {host}:{port}...")
    uvicorn.run(app, host=host, port=port)
