# Hosting this demonstration

This is a **demonstration**, not a clinical production system. Do not upload real
patient images. Hosted copies show a persistent banner to that effect.

**Do not commit secrets.** Put values only in the host dashboards or a local
`.env` that is gitignored. This file uses placeholders only.

```
Browser  →  static UI (Netlify or equivalent)  →  /api proxy  →  API host
                                                                  ├─ Postgres (Supabase)
                                                                  ├─ DenseNet process
                                                                  └─ EfficientNet process
```

The UI must call the API on the **same origin** (`/api`) so the session cookie
stays `SameSite=strict`. Do not put a third-party API URL in the frontend bundle.

## Public access (do this in the dashboards)

You commit and push; this repo does not store operator passwords.

1. **GitHub** — Settings → General → Change repository visibility → **Public**.
   Weights and `.env` files stay gitignored.
2. **Netlify** — Project configuration → Access control / Visitor access → **Public**.
   Turn off password protection and “team only”. Then trigger a deploy if
   `API_PROXY_URL` was added after the first build.
3. **Render** — Environment → `CORS_ORIGIN` = your Netlify origin
   (`https://YOUR-SITE.netlify.app`, no trailing slash) → Manual Deploy.
4. **Hugging Face Spaces** used for inference must be **Public** so the API can
   reach them. The model HTTP API still requires the shared internal token
   (set as a Space secret, never in git).

## Secrets to generate (keep offline)

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run twice:

- `JWT_SECRET` — API only
- `INTERNAL_API_TOKEN` — API **and both** model processes (same value)

Also copy from Supabase **Settings → API** (never paste them into git or the README):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)

## Supabase

**Database**

1. Project Settings → Database → connection strings.
2. Transaction pooler (port `6543`, `pgbouncer=true`) → `DATABASE_URL`.
3. Session pooler (IPv4, port `5432` on `*.pooler.supabase.com`) → `DIRECT_URL`.
   Do not use the `db.<ref>.supabase.co` host from IPv4-only platforms.
4. Add `sslmode=require`.

**Email sign-in**

1. Authentication → Providers → Email → enable.
2. Confirm the mail template includes the one-time code (`{{ .Token }}`).
3. Authentication → URL configuration:
   - Site URL: your public UI origin
   - Redirect allow list: that origin and `http://localhost:5173`
4. Free-tier mail is rate-limited. Add custom SMTP if you outgrow it.

Anyone with an email can request a code. The API creates a clinician row on first
successful verify. Password accounts and `db:seed` are not required for the demo.

## Model processes

PyTorch and TensorFlow cannot share one image. Two Docker hosts (for example
Hugging Face Docker Spaces, which currently need PRO):

| Process | Folder | Weights (upload; do not commit) |
| --- | --- | --- |
| DenseNet-121 + CBAM | `ai-service/` | `weights/best_model.pt` |
| EfficientNetV2-B0 | `ai-service-tf/` | `weights/best_model_finetuned.keras` |

Secret on each: `INTERNAL_API_TOKEN`. After boot, `GET /health` should show
`model_loaded: true`. Point the API at those origins with `AI_SERVICE_URL` and
`AI_EFFICIENTNET_URL` (no path suffix).

## API host (Render or equivalent)

- Root: `backend`
- Build: `npm install --include=dev && npm run render:build`
- Start: `npx prisma db push && npm start`
- Also set: `NODE_ENV=production`, `PRISMA_PROVIDER=postgresql`, `COOKIE_SECURE=true`,
  `NPM_CONFIG_PRODUCTION=false`, `AI_PROVIDER=real`, `AI_REQUEST_TIMEOUT_MS=25000`,
  `STORE_ORIGINAL_IMAGES=false`, plus the secrets listed above.

## Static UI (Netlify or equivalent)

| Key | Value |
| --- | --- |
| `API_PROXY_URL` | API origin, `https://YOUR-API.example`, no `/api` |
| `VITE_DEMO_MODE` | `true` |
| `VITE_API_BASE_URL` | empty |

`netlify.toml` writes same-origin `/api` rewrites at build time.

## Cold starts

Idle free API and model hosts sleep. The first analysis after sleep can exceed
a short HTTP proxy timeout. Wake the API health URL and both model `/health`
endpoints before a demo.

## What this is not

Not a medical device clearance, not a HIPAA/BAA stack, not for real PHI.
