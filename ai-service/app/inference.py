"""Inference orchestration: preprocess, forward pass, Grad-CAM, response assembly."""

from __future__ import annotations

import logging
import threading
import time

import torch

from .model.architecture import CLASS_NAMES
from .model.gradcam import cam_to_png_data_url
from .model.loader import get_model
from .model.preprocessing import preprocess
from .schemas import ClassProbability, PredictionResponse

logger = logging.getLogger(__name__)

# Grad-CAM mutates shared hook state and gradients on the singleton model, so concurrent
# requests must not interleave. Inference is short, and serializing here is far cheaper
# than instantiating a model per worker thread.
_inference_lock = threading.Lock()


def analyze(image_bytes: bytes, max_dimension: int, want_gradcam: bool) -> PredictionResponse:
    started = time.perf_counter()

    loaded = get_model()
    tensor, image = preprocess(image_bytes, max_dimension)
    tensor = tensor.to(loaded.device)

    use_gradcam = want_gradcam and loaded.gradcam is not None

    with _inference_lock:
        if use_gradcam:
            cam, logits = loaded.gradcam.generate(tensor)
        else:
            cam = None
            with torch.no_grad():
                logits = loaded.model(tensor)

    probabilities = torch.softmax(logits, dim=1).squeeze(0).cpu()
    predicted_index = int(probabilities.argmax().item())

    overlay = None
    if cam is not None:
        try:
            overlay = cam_to_png_data_url(cam, image.size)
        except Exception:
            # An explainability failure should not discard a valid prediction; the UI
            # simply hides the visualization controls when no overlay is returned.
            logger.exception("Grad-CAM rendering failed; returning prediction without overlay")

    elapsed_ms = int((time.perf_counter() - started) * 1000)

    return PredictionResponse(
        predicted_label=CLASS_NAMES[predicted_index],
        predicted_index=predicted_index,
        confidence=float(probabilities[predicted_index]),
        probabilities=[
            ClassProbability(label=name, class_index=index, probability=float(probabilities[index]))
            for index, name in enumerate(CLASS_NAMES)
        ],
        gradcam=overlay,
        model_version=loaded.version,
        processing_time_ms=elapsed_ms,
        input_width=image.size[0],
        input_height=image.size[1],
    )
