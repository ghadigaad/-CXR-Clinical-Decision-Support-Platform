"""Inference preprocessing, mirroring the notebook's ``eval_tf`` pipeline.

Any divergence here silently degrades accuracy, so the steps are kept in the same
order as training: RGB decode -> grayscale -> resize 224x224 -> torchxrayvision
normalization -> (1, H, W) float tensor.
"""

from __future__ import annotations

import io

import numpy as np
import torch
from PIL import Image, ImageOps

from .architecture import INPUT_SIZE

# Pillow refuses very large images by default; we enforce our own explicit limit instead
# so the failure is a clear 4xx rather than a warning-turned-exception deep in decode.
Image.MAX_IMAGE_PIXELS = None

MAXVAL = 255.0


class UnsupportedImageError(ValueError):
    """Raised when the uploaded bytes are not a usable chest X-ray image."""


def _xrv_normalize(arr: np.ndarray) -> np.ndarray:
    """torchxrayvision's normalization: scale [0, maxval] into [-1024, 1024].

    Implemented locally rather than imported so preprocessing stays independent of the
    torchxrayvision import graph, and so the exact formula used at inference is visible
    in this repository. Verified against ``xrv.datasets.normalize``.
    """
    return (2 * (arr / MAXVAL) - 1.0) * 1024


def load_image(data: bytes, max_dimension: int) -> Image.Image:
    """Decode uploaded bytes into an RGB PIL image, applying EXIF orientation."""
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as exc:  # Pillow raises a wide range of decode errors
        raise UnsupportedImageError("The file could not be decoded as an image.") from exc

    width, height = image.size
    if width > max_dimension or height > max_dimension:
        raise UnsupportedImageError(
            f"Image is {width}x{height}px, which exceeds the {max_dimension}px limit."
        )
    if width < 32 or height < 32:
        raise UnsupportedImageError("Image is too small to be a diagnostic chest X-ray.")

    image = ImageOps.exif_transpose(image)
    return image.convert("RGB")


def to_model_tensor(image: Image.Image) -> torch.Tensor:
    """Convert an RGB PIL image to a batched (1, 1, 224, 224) model input tensor."""
    grayscale = image.convert("L").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
    arr = np.array(grayscale).astype(np.float32)
    arr = _xrv_normalize(arr)
    return torch.from_numpy(arr).unsqueeze(0).unsqueeze(0).float()


def preprocess(data: bytes, max_dimension: int) -> tuple[torch.Tensor, Image.Image]:
    """Return the model input tensor alongside the decoded image for overlay rendering."""
    image = load_image(data, max_dimension)
    return to_model_tensor(image), image
