"""FastAPI entry point for the CXR inference service.

This service is internal: only the backend should reach it, authenticated with a shared
token. It deliberately knows nothing about patients, reports, or clinicians - it takes
image bytes and returns model output.
"""

from __future__ import annotations

import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .inference import analyze
from .model.architecture import CLASS_NAMES
from .model.loader import ModelNotLoadedError, load_model, status as model_status, try_load
from .model.preprocessing import UnsupportedImageError
from .schemas import HealthResponse, PredictionResponse

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("cxr.ai")

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}
MAGIC_BYTES = ((b"\xff\xd8\xff", "JPEG"), (b"\x89PNG\r\n\x1a\n", "PNG"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    try_load()
    yield


app = FastAPI(
    title="CXR Inference Service",
    version="1.0.0",
    description=(
        "DenseNet-121 + CBAM pneumonia classifier. Decision-support output only; "
        "not a diagnostic device."
    ),
    lifespan=lifespan,
)

if settings.origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=False,
        allow_methods=["POST", "GET"],
        allow_headers=["X-Internal-Token", "Content-Type"],
    )


def require_internal_token(x_internal_token: str = Header(default="")) -> None:
    """Constant-time check of the shared secret between backend and AI service."""
    expected = settings.internal_api_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_API_TOKEN is not configured on the inference service.",
        )
    if not hmac.compare_digest(x_internal_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal token."
        )


def _validate_upload(data: bytes, content_type: str | None) -> None:
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload.")

    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_bytes // (1024 * 1024)}MB limit.",
        )

    if content_type and content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415, detail=f"Unsupported content type: {content_type}"
        )

    if not any(data.startswith(signature) for signature, _ in MAGIC_BYTES):
        raise HTTPException(
            status_code=415,
            detail="File contents are not a valid JPEG or PNG image.",
        )


@app.get("/", response_model=HealthResponse, tags=["system"], include_in_schema=False)
@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    state = model_status()
    return HealthResponse(
        status="ok" if state["model_loaded"] else "degraded",
        model_loaded=state["model_loaded"],
        model_version=state["model_version"],
        device=state["device"],
        gradcam_enabled=state["gradcam_enabled"],
        class_names=CLASS_NAMES,
        weights_path=state["weights_path"],
        error=state["error"],
    )


@app.post("/reload", tags=["system"], dependencies=[Depends(require_internal_token)])
def reload_model() -> JSONResponse:
    """Re-read the checkpoint without restarting, for when weights are added or replaced."""
    try:
        loaded = load_model(force=True)
    except ModelNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return JSONResponse({"model_loaded": True, "model_version": loaded.version})


@app.post(
    "/predict",
    response_model=PredictionResponse,
    tags=["inference"],
    dependencies=[Depends(require_internal_token)],
)
async def predict(
    image: UploadFile = File(...),
    gradcam: bool = Query(default=True, description="Render a Grad-CAM overlay."),
) -> PredictionResponse:
    data = await image.read()
    _validate_upload(data, image.content_type)

    try:
        return analyze(
            image_bytes=data,
            max_dimension=settings.max_image_dimension,
            want_gradcam=gradcam and settings.enable_gradcam,
        )
    except ModelNotLoadedError as exc:
        # No checkpoint means no prediction. Returning anything else here would be
        # fabricating a clinical result.
        raise HTTPException(
            status_code=503,
            detail=f"Model is not available: {exc}",
        ) from exc
    except UnsupportedImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Inference failed")
        raise HTTPException(status_code=500, detail="Inference failed.") from exc
