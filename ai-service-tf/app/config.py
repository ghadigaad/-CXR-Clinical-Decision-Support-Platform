"""Environment-driven settings for the EfficientNetV2 inference service."""

from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=SERVICE_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=(),
    )

    model_weights_path: str = "weights/pneumonia_efficientnetv2b0_final.keras"
    internal_api_token: str = ""
    enable_gradcam: bool = True
    max_image_dimension: int = 10000
    max_upload_bytes: int = 10 * 1024 * 1024
    allowed_origins: str = ""
    log_level: str = "INFO"

    @field_validator("log_level")
    @classmethod
    def _validate_log_level(cls, value: str) -> str:
        normalized = value.upper().strip()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("LOG_LEVEL must be one of: DEBUG, INFO, WARNING, ERROR, CRITICAL")
        return normalized

    @property
    def resolved_weights_path(self) -> Path:
        path = Path(self.model_weights_path).expanduser()
        return path if path.is_absolute() else (SERVICE_ROOT / path).resolve()

    @property
    def origins(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]


settings = Settings()
