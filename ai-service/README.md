---
title: CXR DenseNet CBAM
emoji: 🫁
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# CXR DenseNet-121 + CBAM inference

Internal FastAPI service used by the CXR Decision Support backend. It is **not**
a public diagnostic API: callers must send `X-Internal-Token`.

## Weights

Upload `best_model.pt` to `weights/` in this Space (Files tab) after the first
build. The file is gitignored in the application repo and will not appear unless
you add it here.

Set Space secret `INTERNAL_API_TOKEN` to the same value used by the backend.
