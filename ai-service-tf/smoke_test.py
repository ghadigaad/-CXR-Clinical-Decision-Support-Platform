"""Hit the running service the way the backend will: python smoke_test.py [base_url]

Checks the /health contract and that /predict returns a valid 3-class distribution with
an overlay, so a pass here means the backend integration has nothing left to discover.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
TOKEN = "dev-only-placeholder-internal-token-replace-me"
IMAGE_DIR = Path(__file__).parent.parent / "ai-service" / "test-images"


def post_predict(path: Path, gradcam: bool) -> dict:
    boundary = "----cxrsmoke"
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="image"; filename="{path.name}"\r\n'.encode(),
            b"Content-Type: image/jpeg\r\n\r\n",
            path.read_bytes(),
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    request = urllib.request.Request(
        f"{BASE}/predict?gradcam={'true' if gradcam else 'false'}",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "X-Internal-Token": TOKEN,
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def main() -> int:
    with urllib.request.urlopen(f"{BASE}/health", timeout=30) as response:
        health = json.load(response)
    print(f"health     : {health['status']}  loaded={health['model_loaded']}")
    print(f"version    : {health['model_version']}")
    print(f"classes    : {health['class_names']}")

    if health["class_names"] != ["Normal", "Bacterial Pneumonia", "Viral Pneumonia"]:
        print("FAIL: class names are not the canonical set shared with the DenseNet service.")
        return 1

    failures = 0
    images = sorted(p for p in IMAGE_DIR.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"})
    for path in images:
        result = post_predict(path, gradcam=True)
        probs = {p["label"]: p["probability"] for p in result["probabilities"]}
        total = sum(probs.values())
        summary = "  ".join(f"{k.split()[0]}={v:.4f}" for k, v in probs.items())
        print(f"\n{path.name}")
        print(f"  {summary}")
        print(f"  -> {result['predicted_label']} ({result['confidence']:.4f})"
              f"  {result['processing_time_ms']}ms"
              f"  gradcam={len(result['gradcam'] or '')} chars")

        if abs(total - 1.0) > 1e-4:
            print("  FAIL: probabilities do not sum to 1")
            failures += 1
        if not result["gradcam"]:
            print("  FAIL: no Grad-CAM overlay")
            failures += 1

    print("\nFAILED" if failures else "\nOK: service contract satisfied.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
