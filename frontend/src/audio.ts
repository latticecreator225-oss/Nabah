/**
 * Nabah · Single-track audio player
 *
 * One global sound at a time (Quran recitation OR adhan — never both). Thin
 * wrapper over expo-av so screens don't each manage Sound lifecycles. Safe on
 * web (no-op) where expo-av audio playback isn't reliable in preview.
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { logError } from './log';

let current: Audio.Sound | null = null;
let token = 0; // guards against races when play() is called rapidly

type PlayOpts = {
  onFinish?: () => void;
  onError?: (e: unknown) => void;
  /** Loop indefinitely (ambient recitation, soundscapes). onFinish never fires. */
  loop?: boolean;
};

let audioModeSet = false;
async function ensureAudioMode() {
  if (audioModeSet || Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    audioModeSet = true;
  } catch (e) {
    logError('audio.mode', e);
  }
}

export async function stopAudio(): Promise<void> {
  token += 1; // invalidate any in-flight load
  const s = current;
  current = null;
  if (s) {
    try {
      await s.stopAsync();
    } catch {}
    try {
      await s.unloadAsync();
    } catch {}
  }
}

export async function playAudio(url: string, opts: PlayOpts = {}): Promise<void> {
  if (Platform.OS === 'web') return; // preview can't reliably stream audio
  await ensureAudioMode();
  await stopAudio();
  const myToken = token;
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, isLooping: !!opts.loop },
    );
    // A newer play() superseded us while loading — discard.
    if (myToken !== token) {
      try { await sound.unloadAsync(); } catch {}
      return;
    }
    current = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        opts.onFinish?.();
      }
    });
  } catch (e) {
    logError('audio.play', e);
    opts.onError?.(e);
  }
}

export function isAudioActive(): boolean {
  return current !== null;
}
