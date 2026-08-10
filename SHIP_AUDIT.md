# Nabah — Ship-Readiness Audit Prompt

> Paste everything below into a fresh Claude Code session with `C:\Users\Kzn\Desktop\H-main`
> as the working directory. Budget several hours; it is meant to be exhaustive.

---

You are auditing **Nabah** (نَبَأ), an Islamic companion app, to decide whether it is ready
to ship to the Google Play Store. Produce a verdict: **SHIP**, **SHIP WITH FIXES**, or
**DO NOT SHIP**, backed by evidence.

## Rules of engagement

1. **Verify everything against the actual code.** Every claim must cite `file.ext:line` that
   you personally opened. Do not trust this document, comments, READMEs, variable names, or
   any prior summary — they have been wrong before. If a doc and the code disagree, the code
   wins and the disagreement is itself a finding.
2. **Do not fix anything.** This is a read-and-report pass. If you spot a one-line fix, still
   only report it. A fix silently changes what later checks observe.
3. **Run the app.** A static read cannot judge UX. See "How to run" below.
4. **Distinguish what you tested from what you reasoned about.** Label each finding
   `VERIFIED` (you observed the failure) or `INFERRED` (code reading only). Never present an
   inference as an observation.
5. **No speculative padding.** A short list of real, reproducible problems beats fifty
   maybes. If a section is genuinely clean, say so in one line and move on.
6. **Religious content errors are automatically Critical**, regardless of how small the code
   change to fix them would be.

## Severity scale

- **BLOCKER** — do not ship. Data loss, crash on a common path, incorrect religious content,
  privacy/legal violation, store-rejection cause.
- **MAJOR** — ship only if consciously accepted. Broken feature on a secondary path, bad
  first-run experience, silent failure.
- **MINOR** — polish. Visual inconsistency, awkward copy, missing affordance.
- **NIT** — cosmetic, optional.

## Project shape

- `frontend/` — Expo (React Native) + Expo Router, TypeScript. Architecture is a **hub**
  (`app/home.tsx`) plus ~15 modal **Sheet** components in `src/components/*Sheet.tsx`, not
  separate routes. `app/index.tsx` is the animated splash; `app/onboarding.tsx` is first-run.
- `backend/` — FastAPI + MongoDB (Motor) + APScheduler. Routes under `/api/…`. Prayer times
  are computed **locally** (`prayer_engine.py`); aladhan.com is only a fallback.
- `src/api.ts` is the **only** file that reads `EXPO_PUBLIC_BACKEND_URL`. `src/theme.ts` holds
  all design tokens. `src/motion.tsx` holds animation primitives.
- **This is not a git repository.** There is no history to diff against; audit the working
  tree as it stands, and treat the absence of version control as a finding in its own right.

## How to run

Three processes (see `nabah-dev-stack-runbook` behaviour, verify each yourself):

1. Mongo: `cd .devmongo && node start-mongo.js` → wait for `MONGO_READY`.
2. Backend: `cd backend && MONGO_URL="mongodb://localhost:27017" DB_NAME="nabah" python -m uvicorn server:app --host 127.0.0.1 --port 8000`
3. Metro: `cd frontend && npx expo start --web --clear --port 8081`

Set `frontend/.env` to `EXPO_PUBLIC_BACKEND_URL=http://localhost:8000` for desktop testing —
the LAN IP is firewall-blocked even from the same machine.

Screenshots inside the in-app Browser pane hang on this project. Use Playwright directly
(`python`, `playwright` is installed) to drive and capture the app at
`http://localhost:8081`. Grant geolocation and set a timezone in the browser context, or
prayer-time-dependent screens will not populate. Metro orphans a `node.exe` on 8081 when
stopped — kill it by PID.

Tests: `python -m pytest tests/test_scheduler.py tests/test_prayer_engine.py -q` (offline,
should pass). Three other test files fail at collection on a hardcoded container path — a
known pre-existing issue; confirm it is still only those three and that they are not hiding
real coverage.

## Known open items

Confirm each still exists and rank it. Do **not** spend time rediscovering them — spend your
time on what is *not* on this list.

- No git repository.
- `frontend/eas.json` preview profile hardcodes a stale backend IP.
- Backend is not deployed anywhere; the app only works against localhost/LAN.
- `home.tsx` never reads the `open` query param, so notification taps land on `/home`
  without opening the target sheet — affects every notification with an `action_url`.
- `assets/images/splash-icon.png` was created by copying `splash-image.png` to satisfy a
  config reference. Verify it is actually a correct, correctly-sized asset.

---

# Audit domains

For each, report findings with severity, `file:line`, what you did to observe it, and the
user-visible consequence.

## 1. Identity, icons, and store assets

- Every icon referenced in `app.json` / `app.config.js` exists, is the right pixel size, is
  square where required, and is not a placeholder or a copy of another asset.
- Android **adaptive icon**: foreground/background layers present; check the foreground
  survives the circular, rounded-square, and squircle masks without clipping the artwork.
  Render the masks if you can.
- Icon legibility at 48dp. Does it read as anything at launcher size?
- Splash asset matches the in-app animated splash — no jarring jump between the native
  splash image and the JS splash, and no flash of a different background colour.
- `name`, `slug`, `scheme`, `android.package`, `version`, `versionCode`/`autoIncrement`
  are consistent and production-appropriate. No `com.example`, no leftover `hadiya`.
- Every asset in `assets/` is actually referenced; flag orphans and flag oversized files.

## 2. First run and onboarding

Run this on a **completely clean profile** (no stored `userId`), and again on a warm one.

- Splash → onboarding → home, end to end. Time it. Does the splash overstay?
- Can you skip the splash? Does skipping mid-animation leave anything in a broken state?
- Onboarding: validation on every field (empty name, whitespace-only name, very long name,
  emoji, RTL text, a name that is a single character). What happens on each?
- What happens if the user **denies** location permission? Never answers? Grants it but is
  offline? The app must still be usable — verify it is, don't assume.
- Is the location/privacy copy accurate about what actually leaves the device? Cross-check
  the claim against what `api.ts` and `onboarding.tsx` really transmit. A false privacy
  claim is a BLOCKER.
- Can the user get back out of onboarding, or change these answers later in Settings?
- Double-tap / rapid-tap the primary button — does it create two users?

## 3. Religious content accuracy — treat every finding here as BLOCKER

This is the category that damages trust irreparably. Be rigorous.

- **Hadith**: every displayed hadith shows its collection, book/number, and grade. Verify the
  grade logic — check what happens when the upstream dataset returns an empty grade, and
  whether the app invents a grade it cannot justify. Spot-check several references against
  the cited collection.
- **Qur'an**: Arabic text, translation, and transliteration must correspond to the *same*
  ayah. Test the script toggle (Uthmani vs Indo-Pak) and confirm switching preserves both
  the reading position and the correct verse mapping. Check surah/ayah boundary cases:
  first ayah, last ayah of the last surah, and the Basmalah handling in surah 1 vs 9.
- **Du'as / Adhkar**: Arabic, transliteration, translation, and source all correspond.
- **Emotion → ayah**: confirm the reflection is grounded in the fetched tafsir and that the
  model cannot free-interpret when tafsir is unavailable. Try to make it produce an
  ungrounded interpretation. Report exactly what you did.
- **Diacritics and glyph integrity**: no shaping breakage, no clipped letters, no dropped
  harakat, no letters rendered in isolated form mid-word. Check at the largest and smallest
  font scales the app allows.
- Any place the app asserts a religious ruling, check it is attributed rather than presented
  as the app's own verdict.

## 4. Prayer times, Hijri date, and Qibla

- Compare computed prayer times against a trusted reference for at least four locations:
  equatorial, mid-latitude, **above ~60°N** (where standard calculations degrade), and one
  across the international date line.
- Verify each supported calculation method and the Hanafi/Shafi'i ʿAsr distinction actually
  change the output, and correctly.
- DST transition days, and a location whose timezone offset is not a whole hour.
- Hijri date correctness, and how the app handles the fact that Hijri dates shift at sunset.
- Qibla bearing against a known-correct great-circle calculation. Test near the poles and at
  the antipode of Makkah, where bearing is unstable. Check compass behaviour when the device
  has no magnetometer.
- What is displayed while location is still resolving, and if it never resolves?

## 5. UI and visual system

- Every colour, font, spacing, and radius comes from `src/theme.ts`. Grep for hardcoded hex
  values, magic numbers, and inline font names; list every violation.
- Screen-by-screen pass over home and all ~15 sheets. For each: alignment, optical spacing,
  touch-target size (≥44dp), contrast ratio of every text/background pair against WCAG AA.
- Long-content overflow: very long surah names, long du'a titles, long user names in the
  header/initials, long hadith bodies. Does anything clip, overlap, or push layout?
- Small screens (360×640) and large/tablet. Landscape, if the app permits rotation — and if
  it doesn't, confirm it is actually locked.
- Safe areas: notch, punch-hole, gesture bar. Nothing under the status bar or nav bar.
- Dark mode is the only theme — confirm nothing assumes light, including WebViews, maps,
  system dialogs, keyboard appearance, and the Android status/nav bar colours.
- Consistency: are the same concepts styled the same way across sheets? Flag every one-off.

## 6. Interaction, motion, and performance

- Every interactive element has a pressed state and haptic feedback where its peers do.
- Sheet open/close: no dropped frames, no flash of unstyled content, exit animation actually
  runs, drag-to-dismiss works, and dismissing stops any audio the sheet started.
- Rapid open/close of sheets; opening a second sheet from a first; backgrounding mid-sheet.
- Long lists (Qur'an, Hadith, Bookmarks): scroll performance, pagination boundaries,
  `onEndReached` firing once rather than repeatedly, and behaviour at the very end.
- Hardware back button on Android from every sheet and from home.
- `AccessibilityInfo.isReduceMotionEnabled` is respected everywhere motion exists, not just
  the splash. Verify by enabling it.
- Memory/CPU over a few minutes of heavy use. Any leak from timers, audio, or listeners that
  are never cleaned up — check every `useEffect` that starts something for its teardown.

## 7. Accessibility

- Screen-reader pass over the primary flow. Every control has a meaningful label; Arabic
  text is announced with a correct language tag rather than read as gibberish.
- Dynamic type: system font scaled to maximum. What breaks?
- Colour is never the sole carrier of meaning (notably toggle states and prayer status).
- Focus order is sensible; nothing focusable is hidden or unreachable.

## 8. Notifications and the scheduler

- Every toggle in the Reminders sheet maps to a real scheduled task and actually suppresses
  it when off. Enumerate the prefs in the model and confirm each is both honoured in the
  scheduler and exposed in the UI — flag any that exist in one but not the other.
- Timezone correctness: a user who travels; a user whose device timezone changes; a user
  east and west of UTC. The plan must key off the user's local date.
- Idempotency: the hourly rebuild must never re-send an already-dispatched reminder. Prove
  it, don't assume it.
- Prayer-time-derived reminders (Tahajjud, the Jumuʿah hour of response) at extreme
  latitudes where the underlying window can invert or vanish.
- Notification tap → correct destination. (Known broken; confirm scope.)
- Permission denied, permission revoked later, Android notification channels, and behaviour
  when the app is force-stopped or the device reboots.
- What the notification looks like on a real device: title/body truncation, Arabic rendering
  in the shade, and whether the icon is a legible silhouette.

## 9. Audio and adhan

- Playback, pause, interruption by a phone call, another app taking audio focus, headphone
  disconnect, screen lock, and app backgrounding.
- Verify audio genuinely stops when a sheet closes, and that two sources can never overlap.
- The foreground/background adhan duplication guard actually works.
- Remote audio URLs: what happens when they are slow, 404, or the device is offline?

## 10. Offline, errors, and empty states

- Every network call: airplane mode, slow 3G, server returning 500, and server hanging.
  There must be no infinite spinner anywhere — find them.
- Cached/stale data is labelled as such.
- Every list has a designed empty state.
- No raw error object, stack trace, or English-only technical string ever reaches the user.
- `Alert.alert` is a no-op on web — confirm the `src/alerts.ts` helpers are used everywhere
  and grep for any surviving direct `Alert.alert` call.
- Kill the backend mid-session and exercise the app. Then bring it back — does it recover?

## 11. Data, privacy, and security

- Enumerate every piece of data that leaves the device and to whom. Compare against every
  privacy claim in the UI and in any store copy. Discrepancy = BLOCKER.
- No secrets, API keys, or tokens in the client bundle, in `app.json`, or in committed
  `.env` files. Check `backend/.env` is not shipped and is not readable from the API.
- `usesCleartextTraffic` — if enabled for LAN development, it must be off for production.
  An HTTPS-only production backend is required.
- Backend: input validation on every endpoint, no injection paths, no unauthenticated access
  to another user's data. Try to read a second user's prefs, bookmarks, and notifications by
  changing the id in the URL. This is the single most likely real vulnerability — test it
  properly and report exactly what you sent and what came back.
- CORS is `*` in development; confirm what it should be in production.
- Rate limiting and cost exposure on any LLM-backed or upstream-proxying endpoint.
- What happens to user data on sign-out and on uninstall. Is there any deletion path? Play
  now requires an account-deletion route for apps with accounts.

## 12. Release configuration

- `eas.json` profiles: correct backend URL per profile, correct build type, correct
  distribution. The production profile must not point at a LAN address.
- Target SDK / compile SDK meet the current Play requirement.
- Permissions requested in the manifest: justify **every** one. Remove anything unused —
  each unjustified permission is a review risk.
- ProGuard/minification enabled for release, and verify nothing breaks under it.
- App signing configured; versionCode strategy coherent.
- Play listing prerequisites: privacy policy URL, Data Safety form answers consistent with
  §11 findings, content rating, screenshots, feature graphic, description.
- Does the app degrade gracefully if the backend is down at launch, or does it hard-fail?

## 13. Code health

- TypeScript: `npx tsc --noEmit` clean. Count `any`, `@ts-ignore`, and non-null assertions
  in load-bearing paths.
- Lint clean.
- Dead code: unused components, unused exports, superseded implementations still on disk.
- Duplicated logic that has drifted between copies.
- Every `catch` block: does it swallow silently, or log via `src/log.ts`?
- Test coverage of the genuinely risky logic (prayer engine, scheduler, timezone maths).
  Identify the highest-risk code with no test at all.
- Anything a future maintainer would misread — especially where a comment contradicts the
  code beneath it.

---

# Output format

1. **Verdict** — SHIP / SHIP WITH FIXES / DO NOT SHIP, in one sentence, up front.
2. **Blocker list** — numbered, each with the one-line reason and the file to change.
3. **Findings by domain** — severity, `file:line`, `VERIFIED`/`INFERRED`, observation,
   consequence, suggested fix (described, not applied).
4. **What I tested and how** — devices/viewports, flows driven, commands run, so a reader can
   reproduce and so the coverage gaps are visible.
5. **What I could not test** — and precisely what would be needed to close each gap. Be
   honest here; an unstated gap is worse than a stated one.
6. **The ordered fix list** — what to do first, and roughly how long each item takes.

Do not soften the verdict to be encouraging. An app that mishandles religious content or
user privacy must be called out plainly, and a clean bill of health is only useful if it is
earned.
