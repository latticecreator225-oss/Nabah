/**
 * Nabah · Adhan playback
 *
 * Plays the call to prayer (a chosen muezzin) when a prayer enters while the app
 * is open. Background/locked adhan via the OS notification sound needs a custom
 * dev build with bundled audio — this in-app layer is the foreground experience
 * and the in-settings preview.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playAudio, stopAudio } from './audio';

export type Muezzin = {
  id: string;
  name: string;
  place: string;
  url: string;
};

// Remote recitations (swappable in one place). A dedicated Fajr call is used
// for Fajr since its adhan differs ("aṣ-ṣalātu khayrun mina-n-nawm").
export const MUEZZINS: Muezzin[] = [
  { id: 'makkah', name: 'Sheikh Ali Mullah', place: 'Makkah', url: 'https://www.islamcan.com/audio/adhan/azan2.mp3' },
  { id: 'madinah', name: 'Madinah Haram', place: 'Madinah', url: 'https://www.islamcan.com/audio/adhan/azan1.mp3' },
  { id: 'alafasy', name: 'Mishary Alafasy', place: 'Kuwait', url: 'https://www.islamcan.com/audio/adhan/azan3.mp3' },
  { id: 'egypt', name: 'Classical Egyptian', place: 'Cairo', url: 'https://www.islamcan.com/audio/adhan/azan5.mp3' },
];

const FAJR_ADHAN_URL = 'https://www.islamcan.com/audio/adhan/azan6.mp3';

const ENABLED_KEY = 'adhanEnabled';
const MUEZZIN_KEY = 'adhanMuezzin';

export async function getAdhanEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ENABLED_KEY);
  return v == null ? true : v === '1'; // default ON
}

export async function setAdhanEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

export async function getMuezzinId(): Promise<string> {
  return (await AsyncStorage.getItem(MUEZZIN_KEY)) || MUEZZINS[0].id;
}

export async function setMuezzinId(id: string): Promise<void> {
  await AsyncStorage.setItem(MUEZZIN_KEY, id);
}

export function muezzinById(id: string): Muezzin {
  return MUEZZINS.find((m) => m.id === id) || MUEZZINS[0];
}

// Per-prayer adhan toggles, set in the Prayer Times sheet (key 'adhanBells').
// Absent entry = on by default.
export async function readBells(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem('adhanBells');
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export async function previewAdhan(
  id: string,
  onFinish?: () => void,
  onError?: (e: unknown) => void,
): Promise<void> {
  // onError fires if the remote recitation can't load (offline / slow / 404),
  // so the caller can clear its "previewing" state instead of hanging on it.
  await playAudio(muezzinById(id).url, { onFinish, onError });
}

export async function stopAdhan(): Promise<void> {
  await stopAudio();
}

/**
 * Play the adhan for a prayer if the user has enabled adhan globally AND enabled
 * the per-prayer bell. `prayer` is "Fajr" | "Dhuhr" | ... .
 */
export async function maybePlayAdhanForPrayer(prayer: string): Promise<boolean> {
  const enabled = await getAdhanEnabled();
  if (!enabled) return false;

  // Respect the per-prayer bell toggles set in the Prayer Times sheet.
  const bells = await readBells();
  if (bells[prayer] === false) return false;

  const url = prayer === 'Fajr' ? FAJR_ADHAN_URL : muezzinById(await getMuezzinId()).url;
  await playAudio(url);
  return true;
}
