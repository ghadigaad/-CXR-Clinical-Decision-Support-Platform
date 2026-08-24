# CXR Clinical Decision Support Platform

An AI-assisted chest X-ray analysis platform for clinicians, built around a
DenseNet-121 + CBAM 3-class pneumonia classifier
(`Normal` / `Bacterial Pneumonia` / `Viral Pneumonia`).

> **Medical safety notice.** AI-generated results are intended to support clinical
> decision-making and should be reviewed and interpreted by a qualified healthcare
> professional. This system does not produce a definitive medical diagnosis, and the
> treating clinician remains responsible for the final assessment.

---

## Architecture

Three independent services:

| Service      | Stack                                        | Port | Responsibility |
| ------------ | -------------------------------------------- | ---- | -------------- |
| `frontend/`  | React 19, TypeScript, Vite, Tailwind CSS 4   | 5173 | Clinician UI |
| `backend/`   | Node.js, Express 5, TypeScript, Prisma       | 4000 | REST API, auth, persistence, orchestration |
| `ai-service/`| Python, FastAPI, PyTorch, torchxrayvision    | 8000 | DenseNet-121 + CBAM inference + Grad-CAM |
| `ai-service-tf/` | Python, FastAPI, TensorFlow/Keras        | 8001 | EfficientNetV2-B0 inference + Grad-CAM |

```
Browser ──httpOnly JWT cookie──▶ backend ──X-Internal-Token──▶ ai-service ──▶ best_model.pt
                                    │
                                    ▼
                             Prisma (SQLite / Postgres)
```

The frontend never contacts the AI service directly and holds no secrets. All model
access is proxied through the backend, which owns the internal service token.

---

## Prerequisites

- **Node.js 20+** (tested on 24.x)
- **Python 3.10 - 3.12** for the AI service.
  PyTorch does not yet publish wheels for Python 3.13/3.14, so create the AI service
  virtual environment with a 3.12 or older interpreter even if your system default is newer.
- The trained checkpoint `best_model.pt` (see [Exporting model weights](#exporting-model-weights))

---

## Quick start

### 1. AI service

```bash
cd ai-service
py -3.12 -m venv .venv          # Windows;  python3.12 -m venv .venv on macOS/Linux
.venv\Scripts\activate          # source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# place best_model.pt in ai-service/weights/
uvicorn app.main:app --port 8000
```

Verify the model loaded:

```bash
curl http://localhost:8000/health
# {"status":"ok","model_loaded":true,"model_version":"densenet121-cbam-3class@v1+a1b2c3d4","device":"cpu",...}
```

If `model_loaded` is `false`, the weights file was not found. The service will start
anyway and return HTTP 503 from `/predict` — it never returns synthetic predictions.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set JWT_SECRET and INTERNAL_API_TOKEN to long random strings
npm run db:push
npm run db:seed        # prints generated clinician credentials once - save them
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173 and sign in with the credentials printed by `db:seed`.

---

## Exporting model weights

The training notebook `Pneumonia_CBAM_DenseNet_CXR(1).ipynb` saves its best checkpoint
to `best_model.pt` inside the Colab runtime. That file is not part of this repository
and must be exported once.

Run this in a new Colab cell after training completes:

```python
from google.colab import files
files.download("best_model.pt")
```

Then move the downloaded file to `ai-service/weights/best_model.pt`, or point
`MODEL_WEIGHTS_PATH` in `ai-service/.env` at wherever you stored it.

Full details, including the state-dict key contract and how to verify a checkpoint
loads correctly, are in [ai-service/EXPORT_WEIGHTS.md](ai-service/EXPORT_WEIGHTS.md).

---

## Development without weights

If the checkpoint is not available yet, the backend can run against an isolated mock
provider so the UI can be developed end to end:

```bash
# backend/.env
AI_PROVIDER=mock
```

The mock provider lives in a single file, `backend/src/services/providers/mockAiProvider.ts`,
and tags every response with `source: "mock"`. The UI renders a prominent warning banner
whenever it sees that flag, so mock output can never be mistaken for a real prediction.

`AI_PROVIDER=real` is the default. In that mode there is **no fallback**: if the AI
service is unreachable or has no weights loaded, the request fails with HTTP 503 and
the UI shows an error state.

---

## Model

Ported verbatim from the training notebook into `ai-service/app/model/`:

- **Backbone** — `torchxrayvision` DenseNet-121 features (CXR-domain pretrained)
- **Attention** — CBAM (channel + spatial) after the final dense block, 1024 channels
- **Head** — `AdaptiveAvgPool2d(1)` → `Flatten` → `Dropout(0.3)` → `Linear(1024, 3)`
- **Preprocessing** — RGB → grayscale → resize 224×224 → `xrv.datasets.normalize(arr, maxval=255)`
- **Explainability** — Grad-CAM on the CBAM output layer

Reported test-set performance from the notebook (624 images):

| Class | Precision | Recall | F1 | AUC (OvR) |
| ----- | --------- | ------ | -- | --------- |
| Normal | 0.99 | 0.87 | 0.92 | 0.9913 |
| Bacterial Pneumonia | 0.91 | 0.92 | 0.92 | 0.9774 |
| Viral Pneumonia | 0.75 | 0.88 | 0.81 | 0.9540 |

Overall accuracy: **89.10%**

These figures are surfaced in the app's Settings page. They describe performance on the
Kermany 2018 test split and are not a guarantee of performance on other populations or
acquisition equipment.

---

## Privacy and data retention

- Patient identifiers never appear in URLs; records are addressed by opaque CUIDs.
- Uploads are validated by magic bytes, not just file extension, and capped at 10 MB.
- EXIF metadata is stripped from every upload before it leaves the backend process.
- The full-resolution X-ray is held **in memory only** and is never written to disk
  unless `STORE_ORIGINAL_IMAGES=true` (default `false`).
- A 256 px thumbnail and the Grad-CAM heatmap are persisted only when
  `STORE_THUMBNAILS=true` (default `true`), because patient history requires thumbnails.
  Set it to `false` for a no-image-retention deployment; history then shows placeholders.
- Authentication uses httpOnly, SameSite=strict cookies, so tokens are unreadable from JS.

Deploying this in a real clinical setting requires review against the privacy regime that
applies to you (HIPAA, GDPR, local equivalents), transport encryption, and a signed
business-associate/processor agreement with any hosting provider.

---

## Project layout

```
ai-service/
  app/
    main.py            FastAPI app, /predict and /health
    config.py          env-driven settings
    schemas.py         pydantic request/response models
    inference.py       orchestrates preprocess -> forward -> Grad-CAM
    model/
      architecture.py  CBAM + DenseNetCBAM3Class (ported from the notebook)
      preprocessing.py eval transform, byte-level entry point
      gradcam.py       Grad-CAM + jet colormap PNG
      loader.py        singleton weight loading, version hashing, warmup
  weights/             best_model.pt goes here (gitignored)

backend/
  prisma/schema.prisma Doctor, Patient, Analysis, Report, Review, AuditLog
  src/
    middleware/        auth, rbac, upload validation, errors, rate limiting
    modules/           auth, patients, analyses, reports route handlers
    services/
      aiService.ts     provider-agnostic analyzeCXR()
      providers/       realAiProvider.ts, mockAiProvider.ts
      reportBuilder.ts impression text + system-derived risk level

frontend/
  src/
    api/               typed fetch client per resource
    components/        layout, ui primitives, CXR viewer/uploader
    features/          dashboard, analysis, patients, reports, settings, auth
```

---

## API summary

All routes require authentication except `POST /api/auth/login`.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/auth/login` | Sign in, sets httpOnly cookie |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current clinician |
| GET/POST | `/api/patients` | List / create patients |
| GET/PATCH | `/api/patients/:id` | Read / update a patient |
| GET | `/api/patients/:id/analyses` | Patient history |
| POST | `/api/analyze` | Multipart upload + inference |
| GET | `/api/analyses` | List with search and filters |
| GET | `/api/analyses/:id` | Full analysis record |
| PATCH | `/api/analyses/:id/review` | Save doctor review |
| POST | `/api/analyses/:id/finalize` | Lock and sign the report |
| GET | `/api/analyses/:id/report` | Assembled report payload |
| GET | `/api/analyses/stats` | Dashboard counters |
| GET | `/api/system/health` | Liveness check (public) |
| GET | `/api/system/model-info` | Live AI service health, metrics, retention settings |

---

## Scripts

**backend**

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Watch-mode API server |
| `npm run build` | Type-check and compile to `dist/` |
| `npm run db:push` | Sync Prisma schema to the database |
| `npm run db:seed` | Create a clinician account with a generated password |
| `npm run db:studio` | Prisma Studio |
| `npm run smoke -- --email <e> --password <p>` | End-to-end check of the full clinical flow against a running API |

**frontend**

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Vite dev server with API proxy |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build |

---

## Hosted demonstration

This is a private demo stack (Netlify + Render + Supabase + two Hugging Face
Spaces). It is **not** a clinical or HIPAA deployment. Step-by-step setup,
secrets, and cold-start notes are in [DEPLOY.md](DEPLOY.md).

