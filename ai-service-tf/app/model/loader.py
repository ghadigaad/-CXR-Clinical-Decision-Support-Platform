"""Process-wide model singleton: load the checkpoint once, warm it up, version it."""

from __future__ import annotations

import hashlib
import logging
import threading
from dataclasses import dataclass
from pathlib import Path

import keras
import numpy as np

from ..config import settings
from .gradcam import GradCAM
from .preprocessing import INPUT_SIZE

logger = logging.getLogger(__name__)

ARCHITECTURE_ID = "efficientnetv2b0-3class"
ARCHITECTURE_REVISION = "v1"


class ModelNotLoadedError(RuntimeError):
    """Raised when inference is attempted without a usable checkpoint."""


@dataclass
class LoadedModel:
    model: keras.Model
    gradcam: GradCAM | None
    version: str
    weights_path: Path


_lock = threading.Lock()
_loaded: LoadedModel | None = None
_load_error: str | None = None


def _checkpoint_fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:8]


def load_model(force: bool = False) -> LoadedModel:
    """Load the checkpoint into a singleton. Raises ModelNotLoadedError on failure."""
    global _loaded, _load_error

    with _lock:
        if _loaded is not None and not force:
            return _loaded

        path = settings.resolved_weights_path
        if not path.is_file():
            _load_error = f"Checkpoint not found at {path}"
            raise ModelNotLoadedError(_load_error)

        try:
            # compile=False: we only ever run inference, and skipping the optimizer state
            # avoids version-coupling the service to the training setup.
            model = keras.models.load_model(path, compile=False)

            output_units = model.output_shape[-1]
            if output_units != 3:
                raise ValueError(
                    f"Expected a 3-class model, but the checkpoint outputs {output_units}."
                )

            gradcam = GradCAM(model) if settings.enable_gradcam else None
            version = (
                f"{ARCHITECTURE_ID}@{ARCHITECTURE_REVISION}+{_checkpoint_fingerprint(path)}"
            )

            # Warm up so the first clinical request does not absorb graph-tracing cost.
            model.predict(
                np.zeros((1, INPUT_SIZE, INPUT_SIZE, 3), dtype=np.float32), verbose=0
            )

            _loaded = LoadedModel(
                model=model, gradcam=gradcam, version=version, weights_path=path
            )
            _load_error = None
            logger.info("Loaded %s from %s", version, path)
            return _loaded

        except ModelNotLoadedError:
            raise
        except Exception as exc:
            _load_error = f"{type(exc).__name__}: {exc}"
            logger.exception("Failed to load model checkpoint")
            raise ModelNotLoadedError(_load_error) from exc


def get_model() -> LoadedModel:
    if _loaded is None:
        return load_model()
    return _loaded


def try_load() -> None:
    """Best-effort load used at startup: log and continue instead of crashing.

    A service that stays up with ``model_loaded: false`` is easier to diagnose than a
    boot loop, and /predict still refuses to answer, so nothing unsafe is served.
    """
    try:
        load_model()
    except ModelNotLoadedError as exc:
        logger.error("Model unavailable: %s", exc)


def status() -> dict:
    return {
        "model_loaded": _loaded is not None,
        "model_version": _loaded.version if _loaded else None,
        # TensorFlow CPU build: there is no device to negotiate.
        "device": "cpu",
        "weights_path": str(settings.resolved_weights_path),
        "gradcam_enabled": bool(_loaded and _loaded.gradcam is not None),
        "error": _load_error,
    }
