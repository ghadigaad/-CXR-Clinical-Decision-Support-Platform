"""Standalone checkpoint check: python -m app.verify_weights

Reports exactly which keys mismatch instead of a generic load failure, which is the
usual symptom of a checkpoint trained with a modified architecture.
"""

from __future__ import annotations

import sys

import torch

from .config import settings
from .model.architecture import CLASS_NAMES, INPUT_SIZE
from .model.loader import _extract_state_dict, build_model, resolve_device


def main() -> int:
    path = settings.resolved_weights_path
    print(f"Checkpoint : {path}")

    if not path.is_file():
        print("\nFAILED: file not found. See EXPORT_WEIGHTS.md.")
        return 1

    device = resolve_device()
    print(f"Device     : {device}")

    model = build_model(device)
    payload = torch.load(path, map_location=device, weights_only=False)
    state = _extract_state_dict(payload)

    result = model.load_state_dict(state, strict=False)
    if result.missing_keys:
        print(f"\nMissing keys ({len(result.missing_keys)}):")
        for key in result.missing_keys[:20]:
            print(f"  - {key}")
    if result.unexpected_keys:
        print(f"\nUnexpected keys ({len(result.unexpected_keys)}):")
        for key in result.unexpected_keys[:20]:
            print(f"  - {key}")
    if result.missing_keys or result.unexpected_keys:
        print("\nFAILED: architecture does not match the checkpoint.")
        return 1

    model.eval()
    with torch.no_grad():
        logits = model(torch.zeros(1, 1, INPUT_SIZE, INPUT_SIZE, device=device))

    if logits.shape != (1, len(CLASS_NAMES)):
        print(f"\nFAILED: expected output shape (1, {len(CLASS_NAMES)}), got {tuple(logits.shape)}.")
        return 1

    print(f"Classes    : {', '.join(CLASS_NAMES)}")
    print(f"Output     : {tuple(logits.shape)}")
    print("\nOK: checkpoint loads cleanly and produces a valid forward pass.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
