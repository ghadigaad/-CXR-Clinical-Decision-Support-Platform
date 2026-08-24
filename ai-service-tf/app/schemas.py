"""Wire contract between the backend and the inference service.

Intentionally identical to ai-service/app/schemas.py: the backend must be able to treat
both model services through one provider implementation.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ClassProbability(BaseModel):
    label: str
    class_index: int
    probability: float = Field(ge=0.0, le=1.0)


class PredictionResponse(BaseModel):
    predicted_label: str
    predicted_index: int
    confidence: float = Field(ge=0.0, le=1.0)
    probabilities: list[ClassProbability]
    gradcam: str | None = Field(
        default=None, description="RGBA PNG data URL sized to the uploaded image, or null."
    )
    model_version: str
    processing_time_ms: int
    input_width: int
    input_height: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str | None
    device: str
    gradcam_enabled: bool
    class_names: list[str]
    weights_path: str
    error: str | None = None


class ErrorResponse(BaseModel):
    detail: str
    code: str
