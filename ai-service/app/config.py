"""Environment-driven settings for the inference service."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=SERVICE_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=(),
    )

    model_weights_path: str = "weights/best_model.pt"
    internal_api_token: str = ""
    device: str = "auto"
    enable_gradcam: bool = True
    max_image_dimension: int = 10000
    max_upload_bytes: int = 10 * 1024 * 1024
    allowed_origins: str = ""
    log_level: str = "INFO"

    # Matches PRETRAINED_SOURCE in the training notebook. Changing this invalidates
    # existing checkpoints because the backbone's input channels differ.
    pretrained_source: str = Field(default="cxr", pattern="^(cxr|imagenet)$")

    @field_validator("device")
    @classmethod
    def _validate_device(cls, value: str) -> str:
        normalized = value.lower().strip()
        if normalized not in {"auto", "cpu", "cuda"} and not normalized.startswith("cuda:"):
            raise ValueError("DEVICE must be one of: auto, cpu, cuda, cuda:N")
        return normalized

    @property
    def resolved_weights_path(self) -> Path:
        path = Path(self.model_weights_path).expanduser()
        return path if path.is_absolute() else (SERVICE_ROOT / path).resolve()

    @property
    def origins(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]


settings = Settings()
