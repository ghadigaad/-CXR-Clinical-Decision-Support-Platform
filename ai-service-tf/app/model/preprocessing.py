"""Inference preprocessing, mirroring the notebook's evaluation path.

The saved model carries its own Rescaling(1/255) and Normalization layers, so the
network expects raw [0, 255] RGB. Applying any scaling here would double-normalize and
quietly wreck the predictions.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

INPUT_SIZE = 224
CLASS_NAMES = ["Normal", "Bacterial Pneumonia", "Viral Pneumonia"]
# The notebook trained against these raw folder/filename labels; index order is identical
# to CLASS_NAMES, so the canonical names above are a pure rename, not a remapping.
NOTEBOOK_CLASS_NAMES = ["NORMAL", "BACTERIA", "VIRUS"]


class UnsupportedImageError(ValueError):
    """Raised when the upload cannot be decoded as an image we can score."""


def load_image(data: bytes, max_dimension: int) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise UnsupportedImageError("The file could not be decoded as an image.") from exc

    width, height = image.size
    if width == 0 or height == 0:
        raise UnsupportedImageError("The image has zero width or height.")
    if max(width, height) > max_dimension:
        raise UnsupportedImageError(
            f"Image is {width}x{height}; the maximum supported dimension is {max_dimension}px."
        )

    # Honour EXIF rotation before resizing, otherwise a phone-captured film is scored
    # sideways relative to how the clinician sees it.
    return ImageOps.exif_transpose(image)


def to_model_batch(image: Image.Image) -> np.ndarray:
    """Match flow_from_dataframe(target_size=...) exactly: RGB first, then NEAREST resize.

    Keras' generators default to interpolation="nearest", so that is what the network saw
    for every training and test image. Nearest is the lower-quality choice in general, but
    switching to bilinear here shifted class probabilities by ~9 points on a sample film -
    train/serve skew, not an improvement. Convert-then-resize also mirrors load_img's order.
    """
    resized = image.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.NEAREST)
    return np.expand_dims(np.asarray(resized, dtype=np.float32), axis=0)


def preprocess(data: bytes, max_dimension: int) -> tuple[np.ndarray, Image.Image]:
    image = load_image(data, max_dimension)
    return to_model_batch(image), image
