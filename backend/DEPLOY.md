# Deploying the Nabah API to Fly.io

No scheduler runs in this backend, so a single small Fly machine that
auto-stops when idle (`min_machines_running = 0`) stays cheap. HTTPS is
automatic on the assigned `*.fly.dev` domain.

Files in this folder used by the deploy:
- `Dockerfile` — python:3.12-slim, runs `uvicorn server:app` on `$PORT`.
- `fly.toml` — Fly app config (region, machine size, port).
- `requirements-prod.txt` — trimmed runtime deps (smaller image, faster cold start).
- `.dockerignore` — keeps `.env`, caches, and tests out of the image.

---

## 1. MongoDB Atlas connection string

You already have a cluster. Grab the connection string from **Connect →
Drivers** in the Atlas console:
`mongodb+srv://USER:PASS@cluster0.abcd.mongodb.net/?retryWrites=true&w=majority`

**Network Access → IP Access List** must allow Fly's egress. Fly machines
don't have stable outbound IPs, so add **Allow access from anywhere**
(`0.0.0.0/0`). This is safe here — access still requires the DB
username/password, which never leaves this deploy's secrets.

That connection string is `MONGO_URL`. The database name (`DB_NAME`) is
`nabah`.

## 2. Fly.io app

From this `backend/` directory:

```sh
fly auth login          # opens a browser, log in with your existing Fly account
fly apps create nabah-api   # skip if fly.toml's `app` name is already free/created
```

If `nabah-api` is taken, edit the `app = "..."` line in `fly.toml` first.

## 3. Set secrets (never put these in fly.toml or git)

```sh
fly secrets set \
  MONGO_URL='mongodb+srv://USER:PASS@cluster0.abcd.mongodb.net/?retryWrites=true&w=majority' \
  DB_NAME='nabah' \
  ALLOWED_ORIGINS=''
```

Optional, for AI-personalized emotion → ayah reflections (static fallbacks are
used if omitted):

```sh
fly secrets set ANTHROPIC_API_KEY='sk-ant-...' ANTHROPIC_MODEL='claude-haiku-4-5'
```

Prefer typing secrets directly in your own terminal rather than pasting them
into a chat/log — `fly secrets set` reads them from your shell, nothing needs
to touch this repo.

## 4. Deploy

```sh
fly deploy
```

This builds the Docker image (Fly's remote builder, no local Docker required)
and rolls it out. Prints your app's URL: `https://nabah-api.fly.dev`.

## 5. Verify

```sh
curl https://nabah-api.fly.dev/api/
# -> {"app":"Nabah","name_ar":"نَبَأ"}
```

## 6. Point the app at it

In `frontend/eas.json`, set the production backend URL, then rebuild:

```json
"production": { "env": { "EXPO_PUBLIC_BACKEND_URL": "https://nabah-api.fly.dev" } }
```

---

## Redeploy after code changes

```sh
fly deploy
```

Zero-downtime rollout of a new machine version.

## Useful commands

```sh
fly status        # machine state, health checks
fly logs          # tail server logs
fly secrets list  # names only, values are never shown
```
