# Nabah · Frontend

The Nabah mobile app — built with [Expo](https://expo.dev) (React Native) and
[Expo Router](https://docs.expo.dev/router/introduction) file-based routing, in
TypeScript. For the project overview and backend, see the
[root README](../README.md).

## Prerequisites

- **Node 18+**
- **Yarn** (this project pins Yarn 1.22) or npm
- A running **Nabah backend** (see [`../backend`](../backend))
- The [Expo Go](https://expo.dev/go) app, an Android/iOS emulator, or a dev build

## Setup

```bash
yarn install            # or: npm install
```

Create a `.env` file in this folder pointing at your backend:

```bash
# frontend/.env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

> **Physical device note:** `localhost` resolves to the phone, not your computer.
> Use your machine's LAN IP (`http://192.168.x.x:8000`) or run an Expo tunnel
> (`npx expo start --tunnel`). The variable must be prefixed `EXPO_PUBLIC_` so
> Expo inlines it into the client bundle.

## Running

```bash
npx expo start          # or: yarn start
```

Then choose a target from the CLI:

- `a` — Android emulator (`yarn android`)
- `i` — iOS simulator (`yarn ios`)
- `w` — web (`yarn web`)
- Scan the QR with **Expo Go** for a device

### Expo Go vs. dev build

Most of the app runs in **Expo Go**. Two capabilities need a **development build**
(`npx expo run:android` / `run:ios`) or a physical device:

- **Push notifications** (`expo-notifications`) — device push tokens aren't
  available in Expo Go; registration is safely skipped there and on web.
- **Qibla compass** (`expo-sensors` magnetometer) — needs real device hardware.

Location and haptics work on devices in Expo Go.

## How networking is wired

All backend access goes through a single helper, [`src/api.ts`](src/api.ts):

- `EXPO_PUBLIC_BACKEND_URL` is read in **exactly one place** there. No screen
  reads the env var directly.
- `fetchPrayerTimes()` and `api.hijri()` **cache the last successful response**
  in AsyncStorage and fall back to it when the network/API is unavailable
  (surfaced in the UI as an "offline · last saved times" note).
- Failures in important flows are routed through [`src/log.ts`](src/log.ts)
  (`logError`) instead of being swallowed silently.

## Screens

| Route / Component | What it does |
| --- | --- |
| `app/index.tsx` | Animated splash; routes to onboarding or home. |
| `app/onboarding.tsx` | Captures name, address form, marital status, location + timezone. |
| `app/home.tsx` | Next-prayer countdown + entry points to all feature sheets; sounds the adhan at prayer time (foreground). |
| `src/components/QuranSheet.tsx` | Full Quran reader: searchable index, recitation audio (auto-advance), transliteration, bookmark/share, resume. |
| `src/components/DuasSheet.tsx` | Fortress-of-the-Muslim duas by category, with favourites and share. |
| `src/components/PrayerTimesSheet.tsx` | Prayer times, method/Asr school, adhan toggles. |
| `src/components/QiblaSheet.tsx` | Magnetometer Qibla compass. |
| `src/components/RhythmsSheet.tsx` | Notification-engine toggles + tonight's Tahajjud window. |
| `src/components/SunnahSheet.tsx` | Sunnah Compendium + daily revival. |
| `src/components/FeelingsSheet.tsx` | Emotion → ayah. |
| `src/components/AzkarSheet.tsx` | Morning/evening/sleep adhkar. |
| `src/components/TasbeehSheet.tsx`, `BookmarksSheet.tsx`, `NotificationsSheet.tsx`, `SettingsSheet.tsx` | Counter, saved ayahs, sent-feed archive, settings. |

## Useful scripts

```bash
yarn lint               # expo lint
npx tsc --noEmit        # type-check
```
