/**
 * Nabah · Scheduled (local) adhan notifications
 *
 * Rings the adhan even when the app is closed, by scheduling one repeating
 * DAILY local notification per enabled prayer at that prayer's time. We
 * reschedule whenever prayer times or settings change (e.g. on app open), so
 * the small day-to-day drift in prayer times self-corrects.
 *
 * Out of the box this uses the system notification sound. To play an actual
 * adhan recording when the screen is locked, drop `adhan.wav` into
 * `assets/sounds/`, add it to the expo-notifications plugin in app.json
 * (`"sounds": ["./assets/sounds/adhan.wav"]`), set CUSTOM_ADHAN_SOUND below,
 * and make a dev build. (A custom sound cannot be loaded in Expo Go.)
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { PrayerTimes } from './api';
import { getAdhanEnabled, readBells } from './adhan';
import { logError } from './log';

const ADHAN_CHANNEL = 'adhan';
const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerKey = (typeof PRAYER_KEYS)[number];

// Set to e.g. 'adhan.wav' once the file is bundled (see header). null = system sound.
const CUSTOM_ADHAN_SOUND: string | null = null;

const AR_NAME: Record<PrayerKey, string> = {
  Fajr: 'فجر', Dhuhr: 'ظهر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشاء',
};

function idFor(p: PrayerKey) { return `adhan-${p}`; }
function soundValue(): string | boolean { return CUSTOM_ADHAN_SOUND ?? true; }

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ADHAN_CHANNEL, {
    name: 'Adhan — Prayer Calls',
    importance: Notifications.AndroidImportance.MAX,
    sound: CUSTOM_ADHAN_SOUND ?? 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

async function ensurePermission(): Promise<boolean> {
  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted || perm.status === 'granted') return true;
  if (perm.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    return req.granted || req.status === 'granted';
  }
  return false;
}

export async function cancelAdhanSchedule(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(
    PRAYER_KEYS.map((p) =>
      Notifications.cancelScheduledNotificationAsync(idFor(p)).catch(() => {}),
    ),
  );
}

/**
 * Reschedule the daily adhan for each enabled prayer from today's `times`.
 * Idempotent — re-scheduling an identifier replaces the previous one.
 */
export async function scheduleAdhan(times: PrayerTimes | null): Promise<void> {
  if (Platform.OS === 'web' || !times) return;
  try {
    const enabled = await getAdhanEnabled();
    await cancelAdhanSchedule();
    if (!enabled) return;
    if (!(await ensurePermission())) return;
    await ensureChannel();

    const bells = await readBells();
    for (const p of PRAYER_KEYS) {
      if (bells[p] === false) continue;
      const t = times[p];
      if (!t) continue;
      const [hh, mm] = t.split(':').map(Number);
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: idFor(p),
        content: {
          title: `${p} · ${AR_NAME[p]}`,
          body: 'It is time for prayer. حَيَّ عَلَى الصَّلَاة',
          sound: soundValue(),
          data: { type: 'adhan', prayer: p, deeplink: 'nabah:///home?open=prayers' },
          ...(Platform.OS === 'android' ? { channelId: ADHAN_CHANNEL } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hh,
          minute: mm,
        },
      });
    }
  } catch (e) {
    logError('adhanSchedule.schedule', e);
  }
}
