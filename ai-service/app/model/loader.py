"""Process-wide model singleton: load the checkpoint once, warm it up, version it."""

from __future__ import annotations

import hashlib
import logging
import threading
from dataclasses import dataclass
from pathlib import Path

import torch

from ..config import settings
from .architecture import INPUT_SIZE, DenseNetCBAM3Class
from .gradcam import GradCAM

logger = logging.getLogger(__name__)

ARCHITECTURE_ID = "densenet121-cbam-3class"
ARCHITECTURE_REVISION = "v1"

_STATE_DICT_KEYS = ("state_dict", "model_state_dict", "model")


class ModelNotLoadedError(RuntimeError):
    """Raised when inference is attempted without a usable checkpoint."""


@dataclass
class LoadedModel:
    model: DenseNetCBAM3Class
    gradcam: GradCAM | None
    device: torch.device
    version: str
    weights_path: Path


_lock = threading.Lock()
_loaded: LoadedModel | None = None
_load_error: str | None = None


def resolve_device() -> torch.device:
    configured = settings.device.lower()
    if configured == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if configured == "cuda" and not torch.cuda.is_available():
        logger.warning("DEVICE=cuda requested but CUDA is unavailable; falling back to CPU.")
        return torch.device("cpu")
    return torch.device(configured)


def _checkpoint_fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:8]


def _extract_state_dict(payload: object) -> dict:
    """Accept a bare state dict or a common wrapper, and strip DataParallel prefixes."""
    state = payload
    if isinstance(payload, dict):
        for key in _STATE_DICT_KEYS:
            candidate = payload.get(key)
            if isinstance(candidate, dict):
                state = candidate
                break

    if not isinstance(state, dict):
        raise ValueError("Checkpoint does not contain a state dictionary.")

    if any(key.startswith("module.") for key in state):
        state = {key.removeprefix("module."): value for key, value in state.items()}

    return state


def build_model(device: torch.device) -> DenseNetCBAM3Class:
    model = DenseNetCBAM3Class(
        pretrained_source=settings.pretrained_source, download_pretrained=False
    )
    return model.to(device)


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
            device = resolve_device()
            model = build_model(device)

            payload = torch.load(path, map_location=device, weights_only=False)
            state = _extract_state_dict(payload)
            model.load_state_dict(state, strict=True)
            model.eval()

            gradcam = GradCAM(model, model.gradcam_layer) if settings.enable_gradcam else None
            version = (
                f"{ARCHITECTURE_ID}@{ARCHITECTURE_REVISION}+{_checkpoint_fingerprint(path)}"
            )

            # Warm up so the first clinical request does not absorb lazy-init cost.
            with torch.no_grad():
                model(torch.zeros(1, 1, INPUT_SIZE, INPUT_SIZE, device=device))

            _loaded = LoadedModel(
                model=model,
                gradcam=gradcam,
                device=device,
                version=version,
                weights_path=path,
            )
            _load_error = None
            logger.info("Loaded %s on %s from %s", version, device, path)
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
        "device": str(_loaded.device) if _loaded else str(resolve_device()),
        "weights_path": str(settings.resolved_weights_path),
        "gradcam_enabled": bool(_loaded and _loaded.gradcam is not None),
        "error": _load_error,
    }
