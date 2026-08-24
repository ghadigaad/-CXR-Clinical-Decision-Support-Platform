"""Smoke-test the real checkpoint end to end: python test_inference.py

Runs the same code path the /predict endpoint uses, so a pass here means the
service will answer correctly for the same image.
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.config import settings
from app.inference import analyze
from app.model.loader import status

IMAGE_DIR = Path(__file__).parent / "test-images"


def main() -> int:
    images = sorted(
        p for p in IMAGE_DIR.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )
    if not images:
        print(f"No test images in {IMAGE_DIR}")
        return 1

    failures = 0
    for path in images:
        result = analyze(
            path.read_bytes(),
            max_dimension=settings.max_image_dimension,
            want_gradcam=True,
        )
        total = sum(p.probability for p in result.probabilities)

        print(f"\n=== {path.name} ({result.input_width}x{result.input_height}) ===")
        for prob in result.probabilities:
            bar = "#" * int(round(prob.probability * 40))
            print(f"  {prob.label:<22} {prob.probability:6.4f}  {bar}")
        print(f"  -> {result.predicted_label} (confidence {result.confidence:.4f})")
        print(f"  probabilities sum : {total:.6f}")
        print(f"  grad-cam overlay  : {'yes' if result.gradcam else 'no'}"
              f" ({len(result.gradcam or '')} chars)")
        print(f"  latency           : {result.processing_time_ms} ms")

        if abs(total - 1.0) > 1e-4:
            print("  FAIL: probabilities do not sum to 1")
            failures += 1
        if len(result.probabilities) != 3:
            print("  FAIL: expected 3 classes")
            failures += 1
        if not result.gradcam:
            print("  FAIL: no Grad-CAM overlay produced")
            failures += 1

    print(f"\nmodel status: {status()}")
    print("\nFAILED" if failures else "\nOK: all inferences produced valid 3-class probabilities.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
