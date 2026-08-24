"""Compare the two EfficientNetV2B0 checkpoints: python compare_models.py

The early-stopping bug means the "final" save may have been rolled back to stage-1
weights while the checkpoint kept the fine-tuned ones. This shows whether they differ
and how each behaves on the same images.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import keras
import numpy as np
from PIL import Image

WEIGHTS_DIR = Path(__file__).parent / "weights"
IMAGE_DIR = Path(__file__).parent.parent / "ai-service" / "test-images"

CANDIDATES = {
    "final (early-stop restored)": "pneumonia_efficientnetv2b0_final.keras",
    "checkpoint (fine-tuned)": "best_model_finetuned.keras",
}
CANONICAL_CLASSES = ["Normal", "Bacterial Pneumonia", "Viral Pneumonia"]
IMG_SIZE = 224


def preprocess(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    return np.expand_dims(np.asarray(image, dtype=np.float32), axis=0)


def main() -> int:
    models: dict[str, keras.Model] = {}
    for name, filename in CANDIDATES.items():
        path = WEIGHTS_DIR / filename
        if not path.is_file():
            print(f"missing: {path}")
            return 1
        models[name] = keras.models.load_model(path, compile=False)
        print(f"loaded {name:<28} <- {filename}")

    names = list(models)
    a, b = models[names[0]], models[names[1]]

    print("\n=== weight comparison ===")
    wa, wb = a.get_weights(), b.get_weights()
    print(f"tensor count: {len(wa)} vs {len(wb)}")
    identical = len(wa) == len(wb) and all(
        x.shape == y.shape and np.array_equal(x, y) for x, y in zip(wa, wb)
    )
    if identical:
        print("IDENTICAL - the checkpoint carries the same weights as the final save.")
    else:
        diffs = [
            float(np.abs(x.astype(np.float64) - y.astype(np.float64)).max())
            for x, y in zip(wa, wb)
            if x.shape == y.shape
        ]
        changed = sum(1 for d in diffs if d > 0)
        print(f"DIFFERENT - {changed}/{len(diffs)} tensors changed, "
              f"max abs delta {max(diffs):.6f}")

    images = sorted(p for p in IMAGE_DIR.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"})
    for path in images:
        batch = preprocess(path)
        print(f"\n=== {path.name} ===")
        for name, model in models.items():
            probs = model.predict(batch, verbose=0)[0]
            top = int(np.argmax(probs))
            parts = "  ".join(
                f"{cls.split()[0]:<9}{probs[i]:.4f}" for i, cls in enumerate(CANONICAL_CLASSES)
            )
            print(f"  {name:<28} {parts}   -> {CANONICAL_CLASSES[top]} ({probs[top]:.4f})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
