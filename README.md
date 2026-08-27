# CXR Clinical Decision Support Platform

A demonstration web app that classifies chest X-rays into **Normal**, **Bacterial Pneumonia**, or **Viral Pneumonia**. A clinician (or anyone trying the public demo) chooses one of two trained models, reviews the output, and can add notes. Results are decision support only — not a diagnosis.

> **Medical safety notice.** AI-generated results should be reviewed by a qualified healthcare professional. This system is not a cleared medical device. Do not upload real patient images or protected health information to the public demo.

Sign-in is **email only**: you receive a one-time code. There is no shared password in this repository.

---

## Models

The app exposes both classifiers. The person running an analysis picks one; there is no silent fallback from one model to the other.

| | DenseNet-121 + CBAM | EfficientNetV2-B0 |
| --- | --- | --- |
| Role in the app | Default model | Optional second model |
| Training notebook | `Pneumonia_CBAM_DenseNet_CXR(1).ipynb` | `pneumonia_multiclass_efficientnetv2-3.ipynb` |
| Weights file (gitignored) | `ai-service/weights/best_model.pt` | `ai-service-tf/weights/best_model_finetuned.keras` |
| Pretraining | CXR-domain DenseNet-121 (`torchxrayvision`) + CBAM | ImageNet EfficientNetV2-B0, then fine-tuned on Kermany |
| Test set | Kermany 2018 pediatric split, 624 images | Same pediatric corpus; independent per-class test metrics were not published for this checkpoint |
| Headline metric | **89.10%** accuracy | Interrupted fine-tune (stage 2, epoch 5) — treat as experimental |
| Per-class AUC (OvR) | Normal 0.9913 · Bacterial 0.9774 · Viral 0.9540 | Not reported for this save |

DenseNet per-class (Kermany test):

| Class | Precision | Recall | F1 | AUC |
| --- | --- | --- | --- | --- |
| Normal | 0.99 | 0.87 | 0.92 | 0.9913 |
| Bacterial Pneumonia | 0.91 | 0.92 | 0.92 | 0.9774 |
| Viral Pneumonia | 0.75 | 0.88 | 0.81 | 0.9540 |

EfficientNet was trained on pediatric films with an ImageNet backbone. Adult X-rays may be out of distribution. Viral pneumonia is the weaker class on DenseNet as well. These numbers are not a guarantee on other scanners or populations.

---

## Architecture

```
Browser  →  web UI  →  API (auth, patients, reports)  →  chosen model process
                              │
                              └── database (SQLite locally, Postgres when hosted)
```

The browser never talks to the model processes and never holds API secrets. Inference is brokered by the API.

| Folder | Stack | Local port | Role |
| --- | --- | --- | --- |
| `frontend/` | React, Vite, Tailwind | 5173 | Clinician UI |
| `backend/` | Express, Prisma | 4000 | Auth, persistence, orchestration |
| `ai-service/` | FastAPI, PyTorch | 8000 | DenseNet-121 + CBAM + Grad-CAM |
| `ai-service-tf/` | FastAPI, TensorFlow | 8001 | EfficientNetV2-B0 + Grad-CAM |

---

## Local setup

Prerequisites: **Node.js 20+**, **Python 3.10–3.12** for DenseNet (PyTorch wheels), **Python 3.11** for EfficientNet on Windows. Place the weight files in the paths above. They are not in git.

Email codes use a Supabase project. Copy `backend/.env.example` to `backend/.env` and fill **your** project URL and service-role key (Settings → API). Never commit `.env`.

```bash
# DenseNet
cd ai-service
python3.12 -m venv .venv
# activate, then: pip install -r requirements.txt && uvicorn app.main:app --port 8000

# EfficientNet (separate venv — TensorFlow and PyTorch cannot share one)
cd ai-service-tf
python3.11 -m venv .venv
# activate, then: pip install -r requirements.txt && uvicorn app.main:app --port 8001

# API
cd backend
npm install
cp .env.example .env   # then edit; do not reuse example placeholders in production
npm run db:push
npm run dev

# UI
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, enter your email, and use the code that arrives. Each email only sees the patients it creates.

If a checkpoint is missing, `/health` on that AI process reports `model_loaded: false` and analysis returns HTTP 503. The API does not invent predictions. `AI_PROVIDER=mock` is a local UI stub only and must not be used in production.

---

## Secrets (never commit)

Keep these in host dashboards or local `.env` files only. This README on purpose does **not** include live hosts, tokens, or passwords.

| Name | Where it lives |
| --- | --- |
| `JWT_SECRET` | API only |
| `INTERNAL_API_TOKEN` | API and both model processes (must match) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | API only — service role is not a frontend key |
| `DATABASE_URL` / `DIRECT_URL` | API / Prisma |
| `*.pt` / `*.keras` weight files | Model process disks or Space file tabs |

Templates: `backend/.env.example`, `ai-service/.env.example`, `ai-service-tf/.env.example`. Operator hosting steps: [DEPLOY.md](DEPLOY.md).

---

## Privacy

- Patient IDs are opaque; they do not appear in URLs.
- Uploads are checked by magic bytes and capped at 10 MB. EXIF is stripped.
- Full-resolution images stay in memory unless you explicitly enable original-image storage.
- Sessions use httpOnly, SameSite=strict cookies.

The public demo is **not** a HIPAA (or equivalent) environment.

---

## API (browser-facing)

Unauthenticated: `GET /api/system/health`, `POST /api/auth/request-otp`, `POST /api/auth/verify-otp`. Everything else requires a session cookie.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/request-otp` | Email a one-time sign-in code |
| POST | `/api/auth/verify-otp` | Verify the code and set the session cookie |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/patients` | List / create patients |
| GET/PATCH | `/api/patients/:id` | Read / update a patient |
| GET | `/api/patients/:id/analyses` | Patient history |
| POST | `/api/analyze` | Upload + inference |
| GET | `/api/analyses` | List with filters |
| GET | `/api/analyses/:id` | Full analysis |
| PATCH | `/api/analyses/:id/review` | Save review |
| POST | `/api/analyses/:id/finalize` | Lock and sign the report |
| GET | `/api/analyses/:id/report` | Report payload |
| GET | `/api/analyses/stats` | Dashboard counters |
| GET | `/api/system/health` | Liveness |
| GET | `/api/system/model-info` | Live model status (authenticated) |

---

## Scripts

**backend:** `npm run dev` · `npm run build` · `npm run db:push` · `npm run db:studio` · `npm run smoke -- --cookie "cxr_session=..."`

**frontend:** `npm run dev` · `npm run build` · `npm run preview`
