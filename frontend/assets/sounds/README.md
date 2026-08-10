# Adhan sound (optional)

Scheduled adhan notifications work out of the box using the **system notification
sound** — no asset required. To play a real adhan recording on the lock screen
when the app is closed:

1. Add an **`adhan.wav`** file to this folder (`assets/sounds/adhan.wav`).
   - Android requires `.wav` (or `.mp3`) placed in `res/raw` at build time —
     the expo-notifications plugin handles that from this path.
   - Keep it short-ish (≈ under 30s) and reasonably small.
2. Register it in `app.json`, in the `expo-notifications` plugin entry:

   ```json
   ["expo-notifications", {
     "color": "#C9A961",
     "androidMode": "default",
     "sounds": ["./assets/sounds/adhan.wav"]
   }]
   ```
3. In `src/adhanSchedule.ts`, set:

   ```ts
   const CUSTOM_ADHAN_SOUND: string | null = 'adhan.wav';
   ```
4. Make a **dev build** (`npx expo run:android` / `run:ios`). Custom notification
   sounds cannot be loaded in Expo Go.

A separate Fajr call (`adhan_fajr.wav` + its own channel) can be added the same
way later if you want the distinct Fajr adhan on the lock screen.
