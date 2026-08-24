# Deploy a private demonstration

This is a **demonstration**, not a clinical production system. Do not upload real
patient images or protected health information. The hosted UI shows a persistent
banner to that effect.

Free Netlify / Render / Hugging Face / Supabase stacks are **not** HIPAA (or
equivalent) covered environments, and the models are not cleared medical devices.

```
Browser  →  Netlify (React)  →  /api proxy  →  Render (Express + Prisma)
                                                  │
                                                  ├─ Supabase Postgres
                                                  ├─ HF Space: DenseNet (port 7860)
                                                  └─ HF Space: EfficientNet (port 7860)
```

Same-origin `/api` on Netlify keeps the httpOnly session cookie on
`SameSite=strict`. Do not point `VITE_API_BASE_URL` at Render directly.

## What you create (accounts on your machine)

This machine does not have `gh` or `huggingface-cli`, and no hosting accounts
are signed in. You will need:

1. A GitHub repository for this project
2. A Supabase project (Postgres)
3. Two Hugging Face **Docker** Spaces
4. A Render Web Service
5. A Netlify site

Estimated time once accounts exist: 30–45 minutes, plus Space image builds.

## 1. Put the project on GitHub

From this folder (PowerShell):

```powershell
git init
git add .
git commit -m "Initial commit: CXR decision-support demo."
```

Then create an empty **private** GitHub repo in the browser and:

```powershell
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Do not commit `.env` files, `*.pt`, or `*.keras` weights.

Generate production secrets locally (do not reuse the local `.env` placeholders):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that twice. Save:

- `JWT_SECRET` — backend only
- `INTERNAL_API_TOKEN` — backend **and both** Hugging Face Spaces (must match)

## 2. Supabase Postgres

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string**.
3. Copy two URLs:
   - **Transaction pooler** (port `6543`, includes `pgbouncer=true`) → `DATABASE_URL`
   - **Direct** (port `5432`, host `db.<project>.supabase.co`) → `DIRECT_URL`
4. Append `?sslmode=require` if it is not already present.
5. Leave the database empty. Prisma will create tables on first Render start.

## 3. Hugging Face Spaces (two Docker spaces)

PyTorch and TensorFlow cannot share one image. Create **two** Spaces:

| Space | SDK | Folder | Weights file |
| ----- | --- | ------ | ------------ |
| `cxr-densenet` | Docker | `ai-service/` | `weights/best_model.pt` |
| `cxr-efficientnet` | Docker | `ai-service-tf/` | `weights/best_model_finetuned.keras` |

For each Space:

1. New Space → **Docker** → private.
2. Upload the contents of that folder (Dockerfile, `app/`, `requirements.txt`, `README.md`).
3. **Files** tab: create `weights/` and upload the checkpoint (~28 MB DenseNet,
   EfficientNet `.keras` similarly).
4. **Settings → Secrets**: `INTERNAL_API_TOKEN` = the token from step 1.
5. Wait until the Space is **Running**. Open `/health` (append `/health` to the
   Space URL). You want `"model_loaded": true`.

Space URLs look like:

```
https://YOUR_HF_USER-cxr-densenet.hf.space
https://YOUR_HF_USER-cxr-efficientnet.hf.space
```

The backend calls `/predict` on those origins. Hugging Face sleeps a free Space
after 48 hours idle; the first request after sleep can take minutes and will
exceed Netlify’s ~26 s proxy limit. Open each Space URL once to wake it before
a demo, or upgrade the Space hardware.

## 4. Render API

1. New **Web Service** from the GitHub repo (or apply `render.yaml`).
2. Root directory: `backend`.
3. Build: `npm run prepare:prisma && npm install && npx prisma generate && npm run build`
4. Start: `npx prisma db push && npm start`
5. Environment:

| Key | Value |
| --- | ----- |
| `NODE_ENV` | `production` |
| `PRISMA_PROVIDER` | `postgresql` |
| `DATABASE_URL` | Supabase pooler URL |
| `DIRECT_URL` | Supabase direct URL |
| `JWT_SECRET` | from step 1 |
| `INTERNAL_API_TOKEN` | from step 1 |
| `AI_PROVIDER` | `real` |
| `AI_SERVICE_URL` | `https://YOUR_HF_USER-cxr-densenet.hf.space` |
| `AI_EFFICIENTNET_URL` | `https://YOUR_HF_USER-cxr-efficientnet.hf.space` |
| `CORS_ORIGIN` | your Netlify URL (`https://….netlify.app`) — set this **after** step 5 if needed, then redeploy |
| `COOKIE_SECURE` | `true` |
| `AI_REQUEST_TIMEOUT_MS` | `25000` |
| `STORE_ORIGINAL_IMAGES` | `false` |

6. After the first successful deploy, open a Render **Shell** once:

```bash
npm run db:seed
```

Save the printed email and password. They are not stored in the repo.

Render’s free/starter instances sleep after idle time. Wake the service (open
`/api/system/health`) before a demo.

## 5. Netlify frontend

1. New site from Git → this repo.
2. Base directory: `frontend` (or leave blank and rely on `netlify.toml`).
3. Environment variables:

| Key | Value |
| --- | ----- |
| `API_PROXY_URL` | Render origin, e.g. `https://cxr-api.onrender.com` (no trailing slash, no `/api`) |
| `VITE_DEMO_MODE` | `true` |
| `VITE_API_BASE_URL` | empty |

4. Deploy. Copy the Netlify URL.
5. Set `CORS_ORIGIN` on Render to that URL and trigger a Render redeploy.

Confirm in the browser (not `127.0.0.1`):

- Login works and the demo banner is visible
- Settings shows both models once the Spaces are awake
- A **sample** (non-patient) X-ray analyzes on each model

## Cold starts (the usual failure)

| Hop | Idle behaviour | Typical first-hit delay |
| --- | -------------- | ----------------------- |
| Netlify rewrite | none | — |
| Render free/starter | sleeps ~15 min | 30–60 s |
| HF Space CPU | sleeps after 48 h | 1–3 min |

Netlify’s proxy gives up around **26 seconds**. A cold Hugging Face Space will
look like a failed analysis even when the app is fine. Wake Render and both
Spaces, then retry.

## What this deploy is not

- Not a medical device clearance
- Not a HIPAA / BAA hosting stack
- Not suitable for real patient data
- Not highly available (sleeping free tiers)

For a real clinic you would need a BAA-covered host, a single always-on GPU or
CPU box for both models, Postgres backups, and a regulatory review. A $5–12/mo
VPS running `docker compose` is often simpler than four free SaaS sleep cycles.
