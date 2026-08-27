---
title: CXR EfficientNetV2
emoji: 🫁
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# CXR EfficientNetV2-B0 inference

Internal FastAPI service used by the CXR Decision Support backend. TensorFlow
cannot share a process with the PyTorch DenseNet service, so this Space is
separate. Callers must send `X-Internal-Token`.

## Weights

Upload `best_model_finetuned.keras` to `weights/` in this Space (Files tab).
The default path is `weights/best_model_finetuned.keras`.

Set Space secret `INTERNAL_API_TOKEN` to the same value used by the backend
and the DenseNet Space.
