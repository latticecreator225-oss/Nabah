# Nabah · نَبَأ

> A calm, beautifully-typeset Islamic companion app: prayer times,
> Qibla, adhkar, the Sunnah Compendium, emotion-anchored ayahs, and a poetic
> reminder engine.

Nabah is a two-part project:

| Part | Stack | Folder |
| --- | --- | --- |
| **Frontend** | Expo (React Native) + Expo Router, TypeScript | [`frontend/`](frontend) |
| **Backend** | FastAPI + MongoDB (Motor), APScheduler | [`backend/`](backend) |

---

## Architecture at a glance

```
Expo app ──HTTP──> FastAPI (/api/*) ──> MongoDB
                        │
                        └── APScheduler (in-process)
                              • hourly: build each user's daily reminder plan
                                (anchored to the user's own timezone)
                              • every minute: dispatch due pushes via the
                                Emergent/SuprSend relay + log to the in-app feed
```

External services:
- **aladhan.com** — prayer times + Hijri date (the app caches the last good
  response so it still works offline).
- **Emergent LLM relay** — emotion → ayah generation (optional; static
  fallbacks otherwise).
- **Emergent Push relay (SuprSend)** — device push delivery (optional in
  preview; runs no-op with the placeholder key).

---

## Backend setup

Requires **Python 3.11+** and a reachable **MongoDB** instance.

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then edit .env (see below)

uvicorn server:app --reload --port 8000
```

The API is then served at `http://localhost:8000`, with all routes prefixed
`/api` (e.g. `GET /api/prayer-times`).

### Backend environment variables (`backend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URL` | ✅ | MongoDB connection string (e.g. `mongodb://localhost:27017`). The app fails fast with a clear message if missing. |
| `DB_NAME` | ✅ | Database name inside that Mongo instance. |
| `EMERGENT_LLM_KEY` | ⬜ | Emergent universal LLM key for emotion→ayah. Empty = static fallback. |
| `EMERGENT_PUSH_KEY` | ⬜ | Emergent/SuprSend push key. `placeholder` = push disabled (no-op). |

### Backend tests

```bash
cd backend
pytest tests/test_scheduler.py     # offline unit tests for the reminder engine
pytest                              # full suite (the API tests need a live server + DB)
```

`tests/test_scheduler.py` covers the highest-risk logic — **timezone handling
and daily plan generation** — with `aladhan` stubbed, so it runs offline.

---

## Frontend setup

Requires **Node 18+** and the Expo tooling. See [`frontend/README.md`](frontend/README.md)
for the full guide. In short:

```bash
cd frontend
yarn install                       # (or npm install)
# create frontend/.env with the backend URL:
echo "EXPO_PUBLIC_BACKEND_URL=http://localhost:8000" > .env
npx expo start
```

Open in **Expo Go** (scan the QR), an emulator, or a dev build. The app's
deep-link scheme is `nabah://`.

### Frontend environment variables (`frontend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_BACKEND_URL` | ✅ | Base URL of the FastAPI backend. Read in exactly one place ([`src/api.ts`](frontend/src/api.ts)); every screen goes through that helper. |

> On a physical device, `localhost` points at the phone — use your machine's
> LAN IP (e.g. `http://192.168.1.20:8000`) or an Expo tunnel.

---

## What each screen does

- **Splash** ([`app/index.tsx`](frontend/app/index.tsx)) — animated intro; routes
  to onboarding or home depending on whether a user exists.
- **Onboarding** ([`app/onboarding.tsx`](frontend/app/onboarding.tsx)) — name,
  how to address you, marital status; requests location + captures timezone, then
  creates the user.
- **Home** ([`app/home.tsx`](frontend/app/home.tsx)) — next-prayer countdown card,
  Hijri/Gregorian date, daily reminder, and entry points to every feature sheet.
  Falls back to Makkah times (clearly labelled) when location is unavailable.
- **Feature sheets** ([`src/components/`](frontend/src/components)):
  - **Quran** — full reader (Arabic Uthmani + transliteration + translation),
    searchable surah index, verse-by-verse Alafasy audio with auto-advance,
    ayah bookmarking & share, and a "continue reading" resume. Offline-cached.
  - **Duas** — a Fortress-of-the-Muslim collection: authentic situational
    supplications by category, with transliteration, source, favourites & share.
  - **Prayer Times** — today's times, calculation method + Asr school, per-prayer
    adhan toggles, Ramadan Sehri/Iftar, offline-cached.
  - **Qibla** — magnetometer compass pointing to the Kaaba.
  - **Tasbeeh** — dhikr counter.
  - **Feelings** — pick an emotion, receive a fitting ayah + reflection.
  - **Adhkar** — morning/evening/sleep remembrances with progress.
  - **Sunnah Compendium** — 60+ practices, "Sunnah of the hour", revival tracking.
  - **Rhythms & Reminders** — toggle the notification engine's categories;
    shows tonight's real Tahajjud (last-third) window.
  - **Bookmarks**, **Notifications** (the sent-feed archive), **Settings**
    (profile, prayer calc, and **adhan** — muezzin selection + live preview).

**Audio adhan:** when a prayer's time arrives while the app is open, the chosen
muezzin's call plays (Fajr has its own). Selectable + previewable in Settings;
respects the per-prayer toggles. Background/locked-screen adhan needs a custom
dev build with bundled sound.

---

## Project layout

```
backend/
  server.py            FastAPI app, CORS, scheduler lifecycle
  deps.py              shared deps (Mongo, push client) + env validation
  scheduler.py         APScheduler: timezone-aware plan build + dispatch
  notifications.py     poetic push payload templates
  prayer_methods.py    region → calculation-method picker
  routers/             /api route modules (users, prayers, sunnah, …)
  tests/               pytest (incl. offline scheduler unit tests)
frontend/
  app/                 Expo Router screens (index, onboarding, home)
  src/api.ts           single backend-URL/HTTP helper (+ offline cache)
  src/components/      feature sheets
  src/theme.ts         colors, fonts, spacing
```
