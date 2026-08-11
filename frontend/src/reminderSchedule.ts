/**
 * Nabah · On-device reminder scheduler
 *
 * All reminders fire as LOCAL notifications scheduled on the phone — there is no
 * server push and no Firebase/Google involved. Prayer times are computed for the
 * device's location, and each enabled reminder is scheduled as a repeating DAILY
 * or WEEKLY local notification. We reschedule on app open and whenever prefs or
 * prayer times change, so the small day-to-day drift in prayer-derived times
 * self-corrects (rescheduling an identifier replaces the previous one).
 *
 * This complements adhanSchedule.ts (which rings the adhan bell at each prayer);
 * here we schedule the reflective reminders: the fard nudges, pre-adhan, adhkar,
 * tahajjud, contextual sunnahs, and the weekly sacred-calendar reminders.
 *
 * Note: the Hijri-date observances (white-day fasts, Arafah, ʿAshura, Eid) are
 * not scheduled here yet — they need on-device Hijri conversion. Their toggles
 * are preserved; wiring them is a follow-up.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { PrayerTimes, NotifPrefs } from './api';
import { logError } from './log';

const CHANNEL = 'reminders';
const ID_PREFIX = 'rem-';

// expo WEEKLY weekday: 1 = Sunday … 7 = Saturday.
const SUN = 1, WED = 4, FRI = 6;

type PrayerKey = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
const FARD_PREF: Record<PrayerKey, keyof NotifPrefs> = {
  Fajr: 'prayer_fajr', Dhuhr: 'prayer_dhuhr', Asr: 'prayer_asr',
  Maghrib: 'prayer_maghrib', Isha: 'prayer_isha',
};

// ── Bundled content (kept short + offline; matches the app's quiet voice) ──
const AR: Record<PrayerKey, string> = {
  Fajr: 'فجر', Dhuhr: 'ظهر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشاء',
};
const FARD_BODY: Record<PrayerKey, string> = {
  Fajr: 'The first whisper of dawn. Stand, while the world is still asleep.',
  Dhuhr: 'The sun has reached its summit. Pause — set down what you are carrying.',
  Asr: 'The shadow lengthens. Do not let this prayer slip — it is the middle one.',
  Maghrib: 'The first star. The horizon softens — and so should your heart.',
  Isha: 'The night has fallen. Let the last words of your day be His.',
};
const ADHKAR = {
  morning: { title: 'Morning Adhkar · أذكار الصباح', body: 'Open the day with the names of the One who carries it.' },
  evening: { title: 'Evening Adhkar · أذكار المساء', body: 'The shadows lengthen. Seal the day in the words that protect.' },
  sleep: { title: 'Before sleep · قبل النوم', body: 'The last words are His name, and the soul is in His hand.' },
} as const;
const SUNNAH = {
  household: { title: 'At home', body: 'Say Bismillah at the threshold; greet those within with salām.' },
  public: { title: 'Among people', body: 'Be the first to greet. Guard the glance. A kind word is charity.' },
  work: { title: 'Before you begin', body: 'Bismillah, then ihsan — work as though you see Him.' },
} as const;

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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

function hm(t?: string): [number, number] | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return [h, m];
}
function addMinutes(t: string, delta: number): [number, number] | null {
  const p = hm(t);
  if (!p) return null;
  let total = (p[0] * 60 + p[1] + delta) % (24 * 60);
  if (total < 0) total += 24 * 60;
  return [Math.floor(total / 60), total % 60];
}

// Every identifier this module may create — cancelled up-front so a reschedule
// is a clean replace and disabled reminders truly stop.
function allIds(): string[] {
  const ids: string[] = [];
  (Object.keys(FARD_PREF) as PrayerKey[]).forEach((p) => {
    ids.push(`${ID_PREFIX}fard-${p}`, `${ID_PREFIX}preadhan-${p}`);
  });
  ids.push(
    `${ID_PREFIX}adhkar-morning`, `${ID_PREFIX}adhkar-evening`, `${ID_PREFIX}adhkar-sleep`,
    `${ID_PREFIX}tahajjud`,
    `${ID_PREFIX}sunnah-household`, `${ID_PREFIX}sunnah-public`, `${ID_PREFIX}sunnah-work`,
    `${ID_PREFIX}obs-surah_mulk`, `${ID_PREFIX}obs-surah_kahf`,
    `${ID_PREFIX}obs-jumuah_hour`, `${ID_PREFIX}obs-mon`, `${ID_PREFIX}obs-thu`,
  );
  return ids;
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(
    allIds().map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}

type Content = { title: string; body: string; open?: string };

async function daily(id: string, at: [number, number] | null, c: Content) {
  if (!at) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: c.title,
      body: c.body,
      data: { deeplink: c.open ? `nabah:///home?open=${c.open}` : 'nabah:///home' },
      ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: at[0], minute: at[1] },
  });
}

async function weekly(id: string, weekday: number, at: [number, number] | null, c: Content) {
  if (!at) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: c.title,
      body: c.body,
      data: { deeplink: c.open ? `nabah:///home?open=${c.open}` : 'nabah:///home' },
      ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: at[0], minute: at[1] },
  });
}

/**
 * Reschedule every reflective reminder from the user's prefs and today's prayer
 * times. Idempotent — always cancels first, then schedules the enabled set.
 */
export async function scheduleReminders(
  times: PrayerTimes | null,
  prefs: NotifPrefs | null,
): Promise<void> {
  if (Platform.OS === 'web' || !times || !prefs) return;
  try {
    await cancelReminders();
    if (!(await ensurePermission())) return;
    await ensureChannel();

    const preMin = Math.max(0, Number(prefs.pre_adhan_minutes) || 0);

    // Fard nudges + pre-adhan
    for (const p of Object.keys(FARD_PREF) as PrayerKey[]) {
      if (!prefs[FARD_PREF[p]]) continue;
      const t = times[p];
      if (!t) continue;
      await daily(`${ID_PREFIX}fard-${p}`, hm(t), {
        title: `${p} · ${AR[p]}`, body: FARD_BODY[p], open: 'prayers',
      });
      if (preMin > 0) {
        await daily(`${ID_PREFIX}preadhan-${p}`, addMinutes(t, -preMin), {
          title: `${p} approaches`,
          body: `${preMin} minutes. A breath of wudu, a quieting of the room.`,
          open: 'prayers',
        });
      }
    }

    // Adhkar
    if (prefs.adhkar_morning && times.Sunrise)
      await daily(`${ID_PREFIX}adhkar-morning`, addMinutes(times.Sunrise, 30),
        { ...ADHKAR.morning, open: 'azkar' });
    if (prefs.adhkar_evening && times.Asr)
      await daily(`${ID_PREFIX}adhkar-evening`, addMinutes(times.Asr, 15),
        { ...ADHKAR.evening, open: 'azkar' });
    if (prefs.adhkar_sleep)
      await daily(`${ID_PREFIX}adhkar-sleep`, [22, 0], { ...ADHKAR.sleep, open: 'azkar' });

    // Tahajjud — last third of the night (Isha → next-day Fajr).
    if (prefs.tahajjud && times.Isha && times.Fajr) {
      const isha = hm(times.Isha), fajr = hm(times.Fajr);
      if (isha && fajr) {
        const ishaMin = isha[0] * 60 + isha[1];
        const fajrMin = fajr[0] * 60 + fajr[1] + 24 * 60; // next day
        const nightLen = fajrMin - ishaMin;
        const lastThird = (ishaMin + Math.floor((nightLen * 2) / 3)) % (24 * 60);
        await daily(`${ID_PREFIX}tahajjud`, [Math.floor(lastThird / 60), lastThird % 60],
          { title: 'Qiyām al-Layl · قيام الليل', body: 'The quietest hour. He descends and asks: who will call upon Me?', open: 'prayers' });
      }
    }

    // Contextual sunnahs (fixed hours)
    if (prefs.sunnah_household) await daily(`${ID_PREFIX}sunnah-household`, [12, 0], { ...SUNNAH.household, open: 'sunnah' });
    if (prefs.sunnah_public) await daily(`${ID_PREFIX}sunnah-public`, [9, 0], { ...SUNNAH.public, open: 'sunnah' });
    if (prefs.sunnah_work) await daily(`${ID_PREFIX}sunnah-work`, [14, 0], { ...SUNNAH.work, open: 'sunnah' });

    // Weekly / nightly observances
    if (prefs.reminder_surah_mulk)
      await daily(`${ID_PREFIX}obs-surah_mulk`, [21, 30],
        { title: 'Sūrat al-Mulk · تبارك', body: 'Before you sleep, let the Mulk be recited — it pleads for its companion.', open: 'quran' });
    if (prefs.reminder_surah_kahf)
      await weekly(`${ID_PREFIX}obs-surah_kahf`, FRI, [9, 0],
        { title: 'Sūrat al-Kahf · الجمعة', body: 'It is Jumuʿah. Read al-Kahf — a light between this Friday and the next.', open: 'quran' });
    if (prefs.reminder_jumuah_hour && times.Maghrib)
      await weekly(`${ID_PREFIX}obs-jumuah_hour`, FRI, addMinutes(times.Maghrib, -60),
        { title: 'The Hour of Response · ساعة الإجابة', body: 'The last hour of Jumuʿah — ask Him now; He gives.', open: 'duas' });
    if (prefs.reminder_mon_thu) {
      await weekly(`${ID_PREFIX}obs-mon`, SUN, [19, 30],
        { title: 'A day He fasted', body: 'Tomorrow is Monday — intend the fast, as the Prophet ﷺ did.', open: 'prayers' });
      await weekly(`${ID_PREFIX}obs-thu`, WED, [19, 30],
        { title: 'A day He fasted', body: 'Tomorrow is Thursday — intend the fast, as the Prophet ﷺ did.', open: 'prayers' });
    }
  } catch (e) {
    logError('reminderSchedule.schedule', e);
  }
}
