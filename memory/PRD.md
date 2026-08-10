# Nabah (نَبَأ) — Product Requirements Document

## Overview
A premium Muslim spiritual companion mobile app with a "Loro Piana meets spirituality" aesthetic. Dark luxury — near-black backgrounds, warm ivory text, gold accents.

## Stack
- **Frontend:** React Native + Expo SDK 54, expo-router (file-based routes)
- **Backend:** FastAPI + MongoDB (motor async client)
- **External APIs:** aladhan.com (prayer times), Twilio (SMS), Claude Sonnet 4.5 via Emergent LLM key (personalized ayah reflections)

## Routes
- `/` — Splash (auto-routes to `/home` if user exists else `/onboarding`)
- `/onboarding` — Name + Phone + Location permission
- `/home` — The ONLY main screen (no bottom nav). Hosts 5 modal sheets:
  - Tasbeeh (counter with volume key support)
  - Feelings → Ayah (10 emotions + Claude-personalized reflection)
  - Azkar (5 sections, progress ring, transliteration toggle)
  - Prayer Times Detail (5 prayers + Adhan bells; Ramadan-aware Sehri/Iftar)
  - Settings (profile, SMS toggle, send test, sign out)

## Backend Endpoints (prefix `/api`)
- `POST /users`, `GET /users/{id}`, `PATCH /users/{id}`
- `GET /daily-reminder` — deterministic daily-rotating hadith
- `GET /emotions` — 10 emotion tiles
- `POST /emotions/ayah` — returns curated ayah + Claude-generated 2-3 sentence reflection personalized to the user's name + emotion
- `POST /saved-ayahs`, `GET /saved-ayahs/{user_id}`
- `GET /azkar`, `GET /azkar/progress/{user_id}`, `POST /azkar/progress`
- `POST /sms/send` — sends Twilio SMS (uses provided credentials in .env)
- `GET /dawah/preview` — preview today's dawah message
- `GET /hijri-date` — proxies aladhan Hijri date

## Design System
- Colors: `#0D0D0D` bg, `#1A1B22` card, `#C9A355` gold, `#EDE8DC` ivory
- Fonts: Cormorant Garamond (display), Scheherazade New (Arabic), Inter (UI), Great Vibes (tagline only)
- SVG-only icons (no emojis in UI). Animations 400ms ease-in-out. Haptic feedback on every tap.

## Non-implemented (per user choice / preview limits)
- Home-screen widgets (skipped for MVP)
- Background push notifications for Adhan (requires dev build — only foreground+in-app countdown shipped)
- Weekly scheduled SMS cron (one-off SMS endpoint works; cron requires deployment scheduler)

## 52-message dawah bank
Curated in `/app/backend/dawah_messages.py` — one per week for a year, signed "— نَبَأ".
