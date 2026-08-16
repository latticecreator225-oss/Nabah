# Deploying the Nabah API to Google Cloud Run

Cloud Run scales to zero (no scheduler runs in this backend), so at low traffic
it stays within the free tier. HTTPS is automatic. You do **not** need Docker
locally — `gcloud run deploy --source` builds the image in Cloud Build.

Files in this folder used by the deploy:
- `Dockerfile` — python:3.12-slim, runs `uvicorn server:app` on `$PORT`.
- `requirements-prod.txt` — trimmed runtime deps (smaller image, faster cold start).
- `.dockerignore` — keeps `.env`, caches, and tests out of the image.

---

## 1. MongoDB Atlas (free database)

1. Sign up at https://www.mongodb.com/cloud/atlas → **Create** a free **M0** cluster.
   Pick a region near your Cloud Run region (e.g. GCP `us-central1` / Iowa).
2. **Database Access** → Add New Database User → username + password (save them).
3. **Network Access** → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`).
   (Safe: access still requires the DB credentials. Cloud Run egress IPs are dynamic.)
4. **Connect → Drivers** → copy the connection string, e.g.
   `mongodb+srv://USER:PASS@cluster0.abcd.mongodb.net/?retryWrites=true&w=majority`
   That value is `MONGO_URL`. The database name is `nabah` (`DB_NAME`).

## 2. Google Cloud project

1. https://console.cloud.google.com → create a project (e.g. `nabah`).
2. Attach a **billing account** (required even for the free tier; you won't be
   charged within free limits).
3. Install the CLI (https://cloud.google.com/sdk/docs/install) **or** click the
   **Cloud Shell** icon in the console (gcloud is preinstalled — nothing to set up).
4. Set the project and enable the APIs:
   ```sh
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

## 3. Deploy

From this `backend/` directory:

```sh
gcloud run deploy nabah-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --min-instances 0 \
  --set-env-vars 'DB_NAME=nabah,ALLOWED_ORIGINS=' \
  --set-env-vars 'MONGO_URL=mongodb+srv://USER:PASS@cluster0.abcd.mongodb.net/?retryWrites=true&w=majority'
```

- `--allow-unauthenticated` is required so the app can reach it (the app has its
  own bearer-token auth).
- `--min-instances 0` = scale to zero = $0 when idle. Set `1` only if you want to
  avoid the occasional cold start (that costs a few $/month).
- Optional AI reflections: add
  `--set-env-vars 'ANTHROPIC_API_KEY=sk-ant-...'` (and optionally
  `ANTHROPIC_MODEL=claude-haiku-4-5` to lower cost). Without it, reflections use
  static fallbacks.
- Do **not** set `PORT` — Cloud Run injects it.

The command prints a URL like `https://nabah-api-xxxxxxxx-uc.a.run.app`.

## 4. Verify

```sh
curl https://nabah-api-xxxxxxxx-uc.a.run.app/api/
# -> {"app":"Nabah","name_ar":"نَبَأ"}
```

## 5. Point the app at it

In `frontend/eas.json`, set the production backend URL and rebuild:
```json
"production": { "env": { "EXPO_PUBLIC_BACKEND_URL": "https://nabah-api-xxxxxxxx-uc.a.run.app" } }
```

---

## Hardening (optional, later)

Move secrets to Secret Manager instead of `--set-env-vars`:
```sh
printf '%s' 'mongodb+srv://USER:PASS@...' | gcloud secrets create nabah-mongo-url --data-file=-
printf '%s' 'sk-ant-...'                   | gcloud secrets create nabah-anthropic-key --data-file=-
# grant the Cloud Run runtime service account access, then redeploy with:
#   --set-secrets 'MONGO_URL=nabah-mongo-url:latest,ANTHROPIC_API_KEY=nabah-anthropic-key:latest'
#   --set-env-vars 'DB_NAME=nabah,ALLOWED_ORIGINS='
```

## Redeploy after code changes

Re-run the same `gcloud run deploy` command; it rebuilds and rolls out a new
revision with zero downtime.
