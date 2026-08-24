"""Checkpoint check for the EfficientNetV2B0 model: python verify_model.py

Mirrors the notebook's eval path exactly - raw [0, 255] RGB at 224x224, because the
saved model carries its own Rescaling/Normalization layers.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import keras
import numpy as np
from PIL import Image

WEIGHTS = Path(__file__).parent / "weights" / "pneumonia_efficientnetv2b0_final.keras"
IMAGE_DIR = Path(__file__).parent.parent / "ai-service" / "test-images"

# Index order is fixed by the notebook's CLASSES list; the canonical names match the
# DenseNet service so downstream label matching stays consistent across both models.
NOTEBOOK_CLASSES = ["NORMAL", "BACTERIA", "VIRUS"]
CANONICAL_CLASSES = ["Normal", "Bacterial Pneumonia", "Viral Pneumonia"]
IMG_SIZE = 224


def preprocess(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    return np.expand_dims(np.asarray(image, dtype=np.float32), axis=0)


def find_last_conv_layer(model: keras.Model) -> str | None:
    for layer in reversed(model.layers):
        try:
            if len(layer.output.shape) == 4:
                return layer.name
        except AttributeError:
            continue
    return None


def main() -> int:
    print(f"Checkpoint : {WEIGHTS}")
    if not WEIGHTS.is_file():
        print("FAILED: weights not found.")
        return 1

    print(f"Keras      : {keras.__version__}")
    model = keras.models.load_model(WEIGHTS, compile=False)

    in_shape = model.input_shape
    out_shape = model.output_shape
    params = model.count_params()
    print(f"Input      : {in_shape}")
    print(f"Output     : {out_shape}")
    print(f"Parameters : {params:,}")
    print(f"Grad-CAM   : {find_last_conv_layer(model)}")

    if out_shape[-1] != 3:
        print(f"FAILED: expected 3 output classes, got {out_shape[-1]}.")
        return 1

    images = sorted(p for p in IMAGE_DIR.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"})
    if not images:
        print(f"No test images in {IMAGE_DIR}")
        return 1

    failures = 0
    for path in images:
        probs = model.predict(preprocess(path), verbose=0)[0]
        total = float(probs.sum())
        top = int(np.argmax(probs))

        print(f"\n=== {path.name} ===")
        for i, canonical in enumerate(CANONICAL_CLASSES):
            bar = "#" * int(round(float(probs[i]) * 40))
            print(f"  {canonical:<22} ({NOTEBOOK_CLASSES[i]:<8}) {probs[i]:6.4f}  {bar}")
        print(f"  -> {CANONICAL_CLASSES[top]} (confidence {probs[top]:.4f})")
        print(f"  probabilities sum : {total:.6f}")

        if abs(total - 1.0) > 1e-4:
            print("  FAIL: probabilities do not sum to 1")
            failures += 1

    print("\nFAILED" if failures else "\nOK: model loads and produces valid 3-class probabilities.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
