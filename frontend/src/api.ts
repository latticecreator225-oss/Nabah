import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError } from './log';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export const API = `${BASE}/api`;

// ─────────────────────────── Auth token ───────────────────────────
// Each user is minted an opaque bearer token at creation. It is the identity —
// stored on-device and sent on every request that touches this user's data.
const TOKEN_KEY = 'authToken';
let _token: string | null = null;
let _tokenLoaded = false;

export async function getAuthToken(): Promise<string | null> {
  if (!_tokenLoaded) {
    try {
      _token = await AsyncStorage.getItem(TOKEN_KEY);
    } catch (e) {
      logError('auth.getToken', e);
    }
    _tokenLoaded = true;
  }
  return _token;
}

export async function setAuthToken(token: string): Promise<void> {
  _token = token;
  _tokenLoaded = true;
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    logError('auth.setToken', e);
  }
}

export async function clearAuthToken(): Promise<void> {
  _token = null;
  _tokenLoaded = true;
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    logError('auth.clearToken', e);
  }
}

/** `{ Authorization: 'Bearer …' }` when signed in, else `{}`. */
export async function authHeaders(): Promise<Record<string, string>> {
  const t = await getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * Single place that knows the backend URL. Every screen should reach the API
 * through this module (or the exported `API` base) rather than reading
 * `process.env.EXPO_PUBLIC_BACKEND_URL` directly — if the env var is missing,
 * we want that to fail in exactly one place, not scattered across screens.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...auth,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────── Offline cache ───────────────────────────
// Prayer times and the Hijri date come from an external API (aladhan.com).
// When the network or that API is unavailable we fall back to the last
// successful response so the app still shows something sensible.
async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    logError('cache.read', e);
    return null;
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    logError('cache.write', e);
  }
}

// GET that writes a cache on success and falls back to it on failure. Used for
// content that's safe to show slightly stale (Quran text, Duas) when offline.
async function cachedGet<T>(path: string, cacheKey: string): Promise<T> {
  try {
    const data = await request<T>(path);
    await writeCache(cacheKey, data);
    return data;
  } catch (e) {
    const cached = await readCache<T>(cacheKey);
    if (cached) {
      logError('api.fallback', e);
      return cached;
    }
    throw e;
  }
}

export type Emotion = { key: string; emotion_en: string; emotion_ar: string };
export type AyahResp = {
  key: string;
  emotion_en: string;
  emotion_ar: string;
  arabic: string;
  english: string;
  surah: string;
  reference: string;
  reflection: string;
  pool_size?: number;
  index?: number;
  cycle_reset?: boolean;
};
export type UserT = {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'unspecified';
  married: boolean;
  location_lat?: number | null;
  location_lng?: number | null;
  timezone: string;
  calculation_method: number;
  asr_method: number;
  created_at: string;
};
export type Reminder = { text: string; source: string };
export type AzkarSection = {
  id: string;
  title_en: string;
  title_ar: string;
  items: { arabic: string; transliteration: string; english: string; count: number }[];
};
export type HijriDate = {
  day: string;
  month_en: string;
  month_ar?: string;
  year: string;
  weekday_en?: string;
  formatted: string;
};

export type NotifPrefs = {
  user_id: string;
  prayer_fajr: boolean;
  prayer_dhuhr: boolean;
  prayer_asr: boolean;
  prayer_maghrib: boolean;
  prayer_isha: boolean;
  pre_adhan_minutes: number;
  adhkar_morning: boolean;
  adhkar_evening: boolean;
  adhkar_sleep: boolean;
  tahajjud: boolean;
  sunnah_household: boolean;
  sunnah_public: boolean;
  sunnah_work: boolean;
  reminder_surah_mulk: boolean;
  reminder_surah_kahf: boolean;
  reminder_jumuah_hour: boolean;
  reminder_ayyamul_bidh: boolean;
  reminder_mon_thu: boolean;
  reminder_arafah: boolean;
  reminder_ashura: boolean;
  reminder_eid: boolean;
};

// ── Quran ──
export type SurahMeta = {
  number: number;
  name: string; // Arabic
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string; // 'Meccan' | 'Medinan'
};
export type Ayah = {
  number: number; // numberInSurah
  arabic: string;
  transliteration: string;
  english: string;
  audio: string | null;
  juz?: number;
  page?: number;
  sajda?: boolean;
};
export type SurahDetail = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  translation: string;
  translation_name: string;
  script?: string;
  reciter?: string;
  reciter_name?: string;
  ayahs: Ayah[];
};
export type Reciter = { id: string; name: string };

// ── Mushaf (page view + word-by-word) ──
export type MushafScript = 'uthmani' | 'indopak';
export type TajweedSegment = { text: string; rule: string | null };
export type MushafWord = {
  arabic: string;
  tajweed: TajweedSegment[]; // Uthmani only — empty for indopak (no source data)
  translation: string | null;
  transliteration: string | null;
  verse_key: string; // "2:255"
  is_end: boolean; // the small ayah-number marker, not a real word
  first_ayah: boolean; // opens a surah — draw the header band + Bismillah above it
};
export type MushafLine = { line: number; words: MushafWord[] };
export type MushafPage = {
  page: number;
  total_pages: number;
  juz: number | null;
  script: MushafScript;
  surahs: { number: number; name: string; englishName: string }[];
  lines: MushafLine[];
};

// ── Duas ──
export type DuaCategory = {
  id: string;
  title: string;
  subtitle: string;
  monogram: string;
  blurb: string;
  count: number;
};
export type Dua = {
  id: string;
  arabic: string;
  transliteration: string;
  translation: string;
  reference: string;
  virtue?: string;
  count?: number;
  source?: 'quran' | 'hadith';
  /** When to recite it — "Upon leaving home", "Before eating", etc. */
  occasion?: string;
};
export type DuaCategoryDetail = DuaCategory & { duas: Dua[] };

// ── Hadith (the two Sahihs) ──
export type HadithCollection = {
  id: string;
  name: string;
  name_ar: string;
  authority: string;
  blurb: string;
  total: number | null;
  section_count: number | null;
};
export type HadithSection = { number: number; name: string; count: number };
export type HadithSectionsResp = {
  id: string;
  name: string;
  name_ar: string;
  authority: string;
  blurb: string;
  total: number;
  sections: HadithSection[];
};
export type HadithItem = {
  number: number;
  book: number;
  in_book: number;
  arabic: string;
  english: string;
  grade: string;
};
export type HadithListResp = {
  id: string;
  authority: string;
  section: number | null;
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
  hadiths: HadithItem[];
};

// ── Saved ayahs (bookmarks) ──
export type SavedAyah = {
  id: string;
  user_id: string;
  emotion: string;
  arabic: string;
  english: string;
  surah: string;
  reference: string;
  created_at: string;
};

const HIJRI_CACHE_KEY = 'cache:hijri-date';

export type CreatedUser = UserT & { token: string };

export const api = {
  // Mints the account and persists the returned bearer token before resolving,
  // so every subsequent request is authenticated.
  createUser: async (body: any): Promise<CreatedUser> => {
    const u = await request<CreatedUser>('/users', { method: 'POST', body: JSON.stringify(body) });
    if (u?.token) await setAuthToken(u.token);
    return u;
  },
  getUser: (id: string) => request<UserT>(`/users/${id}`),
  updateUser: (id: string, body: any) =>
    request<UserT>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  // Permanent account + data deletion (Play requirement). Clears the local token.
  deleteUser: async (id: string): Promise<void> => {
    await request(`/users/${id}`, { method: 'DELETE' });
    await clearAuthToken();
  },
  dailyReminder: () => request<Reminder>('/daily-reminder'),
  emotions: () => request<Emotion[]>('/emotions'),
  emotionAyah: (emotion: string, user_id?: string, refresh = false, seen?: number[]) =>
    request<AyahResp>('/emotions/ayah', {
      method: 'POST',
      body: JSON.stringify({ emotion, user_id, refresh, seen }),
    }),
  saveAyah: (body: any) => request('/saved-ayahs', { method: 'POST', body: JSON.stringify(body) }),
  savedAyahs: (user_id: string) => request<SavedAyah[]>(`/saved-ayahs/${user_id}`),
  deleteSavedAyah: (user_id: string, ayah_id: string) =>
    request(`/saved-ayahs/${user_id}/${ayah_id}`, { method: 'DELETE' }),
  azkar: () => request<AzkarSection[]>('/azkar'),
  azkarProgress: (user_id: string) =>
    request<{ completed: string[] }>(`/azkar/progress/${user_id}`),
  setAzkarProgress: (body: any) =>
    request('/azkar/progress', { method: 'POST', body: JSON.stringify(body) }),

  // Hijri date with offline fallback to the last good response.
  hijri: async (): Promise<HijriDate> => {
    try {
      const data = await request<HijriDate>('/hijri-date');
      if (data?.formatted) await writeCache(HIJRI_CACHE_KEY, data);
      return data;
    } catch (e) {
      const cached = await readCache<HijriDate>(HIJRI_CACHE_KEY);
      if (cached) {
        logError('hijri.fallback', e);
        return cached;
      }
      throw e;
    }
  },

  // ── Notification preferences (the client schedules reminders locally) ──
  notifPrefs: (user_id: string) => request<NotifPrefs>(`/notif-prefs/${user_id}`),
  saveNotifPrefs: (body: NotifPrefs) =>
    request<NotifPrefs>('/notif-prefs', { method: 'PUT', body: JSON.stringify(body) }),

  // ── Quran (cached, offline-friendly) ──
  quranSurahs: () => cachedGet<SurahMeta[]>('/quran/surahs', 'cache:quran:surahs'),
  quranReciters: () => cachedGet<Reciter[]>('/quran/reciters', 'cache:quran:reciters'),
  quranSurah: (n: number, translation = 'en.sahih', script = 'uthmani', reciter = 'alafasy') =>
    cachedGet<SurahDetail>(
      `/quran/surah/${n}?translation=${translation}&script=${script}&reciter=${reciter}`,
      `cache:quran:surah:${n}:${translation}:${script}:${reciter}`,
    ),
  mushafPage: (page: number, script: MushafScript = 'uthmani') =>
    cachedGet<MushafPage>(
      `/quran/mushaf/${page}?script=${script}`,
      `cache:quran:mushaf:${page}:${script}`,
    ),

  // ── Duas (cached, offline-friendly) ──
  duaCategories: () => cachedGet<DuaCategory[]>('/duas/categories', 'cache:duas:categories'),
  duaCategory: (id: string) =>
    cachedGet<DuaCategoryDetail>(`/duas/${id}`, `cache:duas:cat:${id}`),

  // ── Hadith — the two Sahihs ──
  hadithCollections: () => request<HadithCollection[]>('/hadith/collections'),
  hadithSections: (coll: string, lang = 'eng') =>
    cachedGet<HadithSectionsResp>(
      `/hadith/${coll}/sections?lang=${lang}`,
      `cache:hadith:${coll}:sections:${lang}`,
    ),
  hadithList: (
    coll: string,
    opts: { section?: number; page?: number; limit?: number; q?: number; lang?: string } = {},
  ) => {
    const p = new URLSearchParams();
    if (opts.section != null) p.set('section', String(opts.section));
    if (opts.page != null) p.set('page', String(opts.page));
    if (opts.limit != null) p.set('limit', String(opts.limit));
    if (opts.q != null) p.set('q', String(opts.q));
    if (opts.lang) p.set('lang', opts.lang);
    return request<HadithListResp>(`/hadith/${coll}?${p.toString()}`);
  },
};

export type PrayerTimes = {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
};

export type PrayerTimesResp = {
  timings: PrayerTimes;
  date: any;
  method: number;
  method_name: string;
  school: number;
  /** True when this response was served from cache after a network failure. */
  stale?: boolean;
};

export async function fetchPrayerTimes(
  lat: number,
  lng: number,
  method?: number,
  school = 0,
): Promise<PrayerTimesResp> {
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), school: String(school), date_str: dateStr });
  if (typeof method === 'number') params.set('method', String(method));
  // The device is at the location — its IANA zone lets the backend compute
  // times fully offline (no aladhan) in the right local clock.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) params.set('tz', tz);
  } catch {}

  // Cache key is per location + method + school (not per day), so a failure on
  // a new day still returns the most recent good times — only minutes off.
  const cacheKey = `cache:prayer-times:${lat.toFixed(3)},${lng.toFixed(3)}:${method ?? 'auto'}:${school}`;

  try {
    const res = await fetch(`${API}/prayer-times?${params.toString()}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error(`prayer-times failed: ${res.status}`);
    const data = (await res.json()) as PrayerTimesResp;
    await writeCache(cacheKey, data);
    return data;
  } catch (e) {
    const cached = await readCache<PrayerTimesResp>(cacheKey);
    if (cached) {
      logError('prayer-times.fallback', e);
      return { ...cached, stale: true };
    }
    throw e;
  }
}

export const PLATFORM = Platform.OS;
