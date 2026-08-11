import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Fonts, Radius, Spacing } from '../src/theme';
import Sheet from '../src/components/Sheet';
import TasbeehSheetBody from '../src/components/TasbeehSheet';
import FeelingsSheetBody from '../src/components/FeelingsSheet';
import AzkarSheetBody from '../src/components/AzkarSheet';
import PrayerTimesSheetBody from '../src/components/PrayerTimesSheet';
import SunnahSheetBody from '../src/components/SunnahSheet';
import RhythmsSheetBody from '../src/components/RhythmsSheet';
import SettingsSheetBody from '../src/components/SettingsSheet';
import BookmarksSheetBody from '../src/components/BookmarksSheet';
import NotificationsSheetBody from '../src/components/NotificationsSheet';
import QiblaSheetBody from '../src/components/QiblaSheet';
import QuranSheetBody from '../src/components/QuranSheet';
import DuasSheetBody from '../src/components/DuasSheet';
import HadithSheetBody from '../src/components/HadithSheet';
import {
  TasbeehIcon,
  HeartIcon,
  BookIcon,
  BookmarkIcon,
  BellIcon,
  QiblaIcon,
} from '../src/components/Icons';
import { api, fetchPrayerTimes, PrayerTimes } from '../src/api';
import { maybePlayAdhanForPrayer, stopAdhan } from '../src/adhan';
import { scheduleAdhan } from '../src/adhanSchedule';
import { scheduleReminders } from '../src/reminderSchedule';
import { AmbientField, FadeInUp } from '../src/motion';
import { logError } from '../src/log';

type PrayerKey = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
const PRAY_ORDER: PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// When the user hasn't granted location (or onboarding skipped it), prayer
// times are anchored to Makkah so the home screen still has something to show.
// This is a deliberate, named fallback — surfaced to the user via `usingFallbackLocation`.
const FALLBACK_COORDS = { lat: 21.4225, lng: 39.8262 }; // Al-Masjid al-Haram, Makkah

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function formatTime(t?: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}
function pad(n: number) {
  return String(n).padStart(2, '0');
}

// Sheet keys that a notification deep link (nabah:///home?open=…) may target.
const OPENABLE_SHEETS = [
  'tasbeeh', 'feelings', 'azkar', 'prayers', 'settings', 'sunnah', 'rhythms',
  'bookmarks', 'notifications', 'qibla', 'quran', 'duas', 'hadith',
] as const;

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams<{ open?: string | string[] }>();
  const [userName, setUserName] = useState<string>('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [hijri, setHijri] = useState<string>('');
  const [today, setToday] = useState<string>('');
  const [reminder, setReminder] = useState<{ text: string; source: string } | null>(null);
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [timesStale, setTimesStale] = useState<boolean>(false);
  const [usingFallbackLocation, setUsingFallbackLocation] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());

  const [sheet, setSheet] = useState<
    null | 'tasbeeh' | 'feelings' | 'azkar' | 'prayers' | 'settings' | 'sunnah' | 'rhythms' | 'bookmarks' | 'notifications' | 'qibla' | 'quran' | 'duas' | 'hadith'
  >(null);
  const [quranLastRead, setQuranLastRead] = useState<{ surah: number; surahName: string; ayah: number } | null>(null);
  const tickRef = useRef<any>(null);
  const prevNextRef = useRef<PrayerKey | null>(null);

  // Gentle global fade-in; the per-section cascade is handled by <FadeInUp>.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }).start();
  }, [fade]);

  // Gentle shimmer on the prayer card gold-glow
  const shimmer = useRef(new Animated.Value(0.06)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.14, duration: 2800, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0.06, duration: 2800, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  useEffect(() => {
    (async () => {
      const name = (await AsyncStorage.getItem('userName')) || '';
      const uid = (await AsyncStorage.getItem('userId')) || '';
      const lt = await AsyncStorage.getItem('userLat');
      const ln = await AsyncStorage.getItem('userLng');
      setUserName(name);
      if (uid) {
        // Keep the stored timezone current (used for the user's prayer-time
        // calculation); fire-and-forget, cached to avoid daily writes.
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const lastTz = await AsyncStorage.getItem('lastSyncedTz');
          if (tz && tz !== lastTz) {
            api.updateUser(uid, { timezone: tz })
              .then(() => AsyncStorage.setItem('lastSyncedTz', tz))
              .catch((e) => logError('home.tzSync', e));
          }
        } catch {}
      }
      // Explicit null checks — a valid coordinate can be exactly 0.
      if (lt != null && ln != null) {
        setLat(Number(lt));
        setLng(Number(ln));
        setUsingFallbackLocation(false);
      } else {
        setLat(FALLBACK_COORDS.lat);
        setLng(FALLBACK_COORDS.lng);
        setUsingFallbackLocation(true);
      }
      const d = new Date();
      const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
      setToday(d.toLocaleDateString('en-US', opts));
      api.dailyReminder().then(setReminder).catch((e) => logError('home.dailyReminder', e));
      api
        .hijri()
        .then((h) => setHijri(h.formatted || ''))
        .catch((e) => logError('home.hijri', e));
    })();
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  useEffect(() => {
    if (lat == null || lng == null) return;
    (async () => {
      const m = await AsyncStorage.getItem('calcMethod');
      const s = await AsyncStorage.getItem('asrSchool');
      const methodNum = m ? Number(m) : undefined;
      const schoolNum = s ? Number(s) : 0;
      fetchPrayerTimes(lat, lng, methodNum, schoolNum)
        .then((r) => {
          setTimes(r.timings);
          setTimesStale(Boolean(r.stale));
        })
        .catch((e) => logError('home.prayerTimes', e));
    })();
  }, [lat, lng]);

  // Refresh the Quran "continue" hint whenever we return to the home surface.
  useEffect(() => {
    if (sheet !== null) return;
    AsyncStorage.getItem('quranLastRead')
      .then((v) => { if (v) setQuranLastRead(JSON.parse(v)); })
      .catch((e) => logError('home.quranLastRead', e));
  }, [sheet]);

  // Notification deep links land here as ?open=<sheet> (e.g. a Sūrat al-Mulk
  // reminder → open=quran). Open the target sheet, then immediately clear the
  // param so closing the sheet doesn't reopen it, and a later tap on the same
  // target fires again.
  useEffect(() => {
    const raw = params?.open;
    const target = Array.isArray(raw) ? raw[0] : raw;
    if (!target) return;
    if ((OPENABLE_SHEETS as readonly string[]).includes(target)) {
      setSheet(target as typeof sheet);
    }
    router.setParams({ open: undefined } as any);
  }, [params?.open, router]);

  // (Re)schedule the daily adhan AND the reflective reminders whenever today's
  // times load or we return to home (e.g. after changing Reminders/Settings).
  // Gated to the home surface so it picks up pref/toggle changes on close. All
  // notifications are scheduled locally on the device — no server, no push.
  useEffect(() => {
    if (sheet !== null || !times) return;
    scheduleAdhan(times).catch((e) => logError('home.scheduleAdhan', e));
    (async () => {
      try {
        const uid = await AsyncStorage.getItem('userId');
        if (!uid) return;
        const prefs = await api.notifPrefs(uid);
        await scheduleReminders(times, prefs);
      } catch (e) {
        logError('home.scheduleReminders', e);
      }
    })();
  }, [times, sheet]);

  // Make sure no audio (adhan or recitation) lingers when leaving home.
  useEffect(() => () => { stopAdhan(); }, []);

  const { nextName, nextTime, prevTime } = useMemo(() => {
    if (!times)
      return {
        nextName: null as null | PrayerKey,
        nextTime: null as null | Date,
        prevTime: null as null | Date,
      };
    const d = new Date();
    const nowMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    let nextK: PrayerKey | null = null;
    let prevK: PrayerKey | null = null;
    for (let i = 0; i < PRAY_ORDER.length; i++) {
      const p = PRAY_ORDER[i];
      const m = toMinutes(times[p as keyof PrayerTimes] as string);
      if (m > nowMin) {
        nextK = p;
        prevK = i > 0 ? PRAY_ORDER[i - 1] : null;
        break;
      }
    }
    const nextDate = new Date();
    const prevDate = new Date();
    if (!nextK) {
      nextK = 'Fajr';
      const fajrMin = toMinutes(times.Fajr);
      nextDate.setDate(d.getDate() + 1);
      nextDate.setHours(Math.floor(fajrMin / 60), fajrMin % 60, 0, 0);
      const ishaMin = toMinutes(times.Isha);
      prevDate.setHours(Math.floor(ishaMin / 60), ishaMin % 60, 0, 0);
      prevK = 'Isha';
    } else {
      const m = toMinutes(times[nextK as keyof PrayerTimes] as string);
      nextDate.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (prevK) {
        const pm = toMinutes(times[prevK as keyof PrayerTimes] as string);
        prevDate.setHours(Math.floor(pm / 60), pm % 60, 0, 0);
      } else {
        prevDate.setHours(0, 0, 0, 0);
      }
    }
    return { nextName: nextK, nextTime: nextDate, prevTime: prevDate };
  }, [times, now]);

  // When a prayer's time arrives while the app is open, sound the adhan. The
  // upcoming prayer (`nextName`) flips to the following one the moment its time
  // passes — so the prayer we just crossed is the *previous* value.
  useEffect(() => {
    const prev = prevNextRef.current;
    if (prev && nextName && prev !== nextName) {
      maybePlayAdhanForPrayer(prev).catch((e) => logError('home.adhan', e));
    }
    prevNextRef.current = nextName;
  }, [nextName]);

  const countdown = useMemo(() => {
    if (!nextTime) return '—  ·  —  ·  —';
    const diff = Math.max(0, nextTime.getTime() - now);
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${pad(h)} : ${pad(m)} : ${pad(s)}`;
  }, [nextTime, now]);

  const progress = useMemo(() => {
    if (!nextTime || !prevTime) return 0;
    const total = nextTime.getTime() - prevTime.getTime();
    const done = now - prevTime.getTime();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, done / total));
  }, [nextTime, prevTime, now]);

  const subInfo = useMemo(() => {
    if (!times || !nextName) return '';
    const at = formatTime(times[nextName as keyof PrayerTimes] as string);
    const ord = PRAY_ORDER.indexOf(nextName);
    const after = ord >= 0 && ord < PRAY_ORDER.length - 1 ? PRAY_ORDER[ord + 1] : null;
    const afterTime = after ? formatTime(times[after as keyof PrayerTimes] as string) : '';
    return after ? `at ${at}  ·  ${after} at ${afterTime}` : `at ${at}`;
  }, [times, nextName]);

  const openSheet = useCallback((s: typeof sheet) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSheet(s);
  }, []);

  // Dismissing any sheet also silences any audio it may have started
  // (Quran recitation, an adhan preview) — the Sheet keeps children mounted.
  const close = () => {
    stopAdhan();
    setSheet(null);
  };

  const initials = userName
    ? userName
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '·';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} testID="home-screen">
      <AmbientField />
      <Animated.View style={{ flex: 1, opacity: fade }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.hijriDate} testID="home-hijri-date">
              {hijri || '—'}
            </Text>
            <Text style={styles.gregDate}>{today}</Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity
              onPress={() => openSheet('qibla')}
              style={styles.iconBtn}
              testID="home-qibla-btn"
              activeOpacity={0.7}
            >
              <QiblaIcon size={18} color={Colors.goldMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openSheet('bookmarks')}
              style={styles.iconBtn}
              testID="home-bookmarks-btn"
              activeOpacity={0.7}
            >
              <BookmarkIcon size={18} color={Colors.goldMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openSheet('notifications')}
              style={styles.iconBtn}
              testID="home-bell-btn"
              activeOpacity={0.7}
            >
              <BellIcon size={18} color={Colors.goldMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openSheet('settings')}
              style={styles.avatar}
              testID="home-avatar-btn"
              activeOpacity={0.85}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting */}
        <FadeInUp delay={60}>
        <View style={styles.greetingBlock}>
          <Text style={styles.salam} testID="home-salam">
            السلام عليكم
          </Text>
          {userName ? <Text style={styles.welcomeName}>{userName}</Text> : null}
          {reminder ? (
            <View style={styles.reminderWrap}>
              <Text style={styles.reminder}>“{reminder.text}”</Text>
              <Text style={styles.reminderSrc}>{reminder.source}</Text>
            </View>
          ) : null}
        </View>
        </FadeInUp>

        {/* Next Prayer Card */}
        <FadeInUp delay={130}>
        <Pressable
          onPress={() => openSheet('prayers')}
          style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.92 }]}
          testID="next-prayer-card"
        >
          <Animated.View style={[styles.nextGlow, { opacity: shimmer }]} />
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardLabel}>NEXT PRAYER</Text>
            <Text style={styles.cardArrow}>›</Text>
          </View>
          <Text style={styles.prayerName}>{nextName || '—'}</Text>
          <Text style={styles.countdown} testID="prayer-countdown">
            {countdown}
          </Text>
          <Text style={styles.subInfo}>{subInfo}</Text>
          {usingFallbackLocation ? (
            <Text style={styles.cardNote}>
              Showing times for Makkah · enable location for your area
            </Text>
          ) : timesStale ? (
            <Text style={styles.cardNote}>Offline · showing last saved times</Text>
          ) : null}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </Pressable>
        </FadeInUp>

        {/* The Noble Quran — full-width hero */}
        <FadeInUp delay={200}>
        <Pressable
          testID="tile-quran"
          onPress={() => openSheet('quran')}
          style={({ pressed }) => [styles.quranTile, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.quranGlow} />
          <View style={styles.sunnahHead}>
            <Text style={styles.quranEyebrow}>THE NOBLE QURAN</Text>
            <Text style={styles.quranAr}>القرآن</Text>
          </View>
          <Text style={styles.quranTitle}>
            {quranLastRead ? `Continue · ${quranLastRead.surahName}` : 'Begin with Al-Fātiḥa'}
          </Text>
          <Text style={styles.quranCaption}>
            {quranLastRead
              ? `Ayah ${quranLastRead.ayah}  ·  resume your recitation`
              : '114 surahs · recited, translated, transliterated'}
          </Text>
          <View style={styles.sunnahFooter}>
            <View style={styles.sunnahHairline} />
            <Text style={styles.sunnahArrow}>›</Text>
          </View>
        </Pressable>
        </FadeInUp>

        {/* Three feature tiles */}
        <FadeInUp delay={270}>
        <View style={styles.tilesRow}>
          <FeatureTile
            testID="tile-tasbeeh"
            icon={<TasbeehIcon size={24} />}
            title="Tasbeeh"
            caption="Counter"
            onPress={() => openSheet('tasbeeh')}
          />
          <FeatureTile
            testID="tile-feelings"
            icon={<HeartIcon size={24} />}
            title="Feelings"
            caption="Find your Ayah"
            onPress={() => openSheet('feelings')}
          />
          <FeatureTile
            testID="tile-azkar"
            icon={<BookIcon size={24} />}
            title="Adhkar"
            caption="Remembrance"
            onPress={() => openSheet('azkar')}
          />
        </View>
        </FadeInUp>

        {/* The Sunnah Compendium — full-width hero tile */}
        <FadeInUp delay={340}>
        <Pressable
          testID="tile-sunnah"
          onPress={() => openSheet('sunnah')}
          style={({ pressed }) => [styles.sunnahTile, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.sunnahGlow} />
          <View style={styles.sunnahHead}>
            <Text style={styles.sunnahEyebrow}>THE SUNNAH COMPENDIUM</Text>
            <Text style={styles.sunnahAr}>السنة</Text>
          </View>
          <Text style={styles.sunnahTitle}>Revive a forgotten Sunnah</Text>
          <Text style={styles.sunnahCaption}>
            60+ practices, indexed by hour & intention
          </Text>
          <View style={styles.sunnahFooter}>
            <View style={styles.sunnahHairline} />
            <Text style={styles.sunnahArrow}>›</Text>
          </View>
        </Pressable>
        </FadeInUp>

        {/* The Two Sahihs link card */}
        <FadeInUp delay={370}>
        <Pressable
          testID="tile-hadith"
          onPress={() => openSheet('hadith')}
          style={({ pressed }) => [styles.rhythmsLink, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.rhythmsLeft}>
            <Text style={styles.rhythmsAr}>الصحيحان</Text>
            <View>
              <Text style={styles.rhythmsLabel}>SAHIH BUKHARI & MUSLIM</Text>
              <Text style={styles.rhythmsSub}>The two Sahihs, in full · authenticated</Text>
            </View>
          </View>
          <Text style={styles.rhythmsArrow}>›</Text>
        </Pressable>
        </FadeInUp>

        {/* Duas & Supplications link card */}
        <FadeInUp delay={400}>
        <Pressable
          testID="tile-duas"
          onPress={() => openSheet('duas')}
          style={({ pressed }) => [styles.rhythmsLink, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.rhythmsLeft}>
            <Text style={styles.rhythmsAr}>الأدعية</Text>
            <View>
              <Text style={styles.rhythmsLabel}>DUAS & SUPPLICATIONS</Text>
              <Text style={styles.rhythmsSub}>Authentic words for every moment</Text>
            </View>
          </View>
          <Text style={styles.rhythmsArrow}>›</Text>
        </Pressable>
        </FadeInUp>

        {/* Rhythms & Reminders link card */}
        <FadeInUp delay={460}>
        <Pressable
          testID="tile-rhythms"
          onPress={() => openSheet('rhythms')}
          style={({ pressed }) => [styles.rhythmsLink, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.rhythmsLeft}>
            <Text style={styles.rhythmsAr}>تذكيرات</Text>
            <View>
              <Text style={styles.rhythmsLabel}>REMINDERS</Text>
              <Text style={styles.rhythmsSub}>Prayers, adhkar & the sacred calendar</Text>
            </View>
          </View>
          <Text style={styles.rhythmsArrow}>›</Text>
        </Pressable>
        </FadeInUp>

        {/* Footer brand */}
        <FadeInUp delay={520}>
        <View style={styles.footerBrand}>
          <View style={styles.goldLine} />
          <Text style={styles.brandAr}>نَبَأ</Text>
          <View style={styles.goldLine} />
        </View>
        </FadeInUp>
      </ScrollView>
      </Animated.View>

      <Sheet visible={sheet === 'tasbeeh'} onClose={close} testID="sheet-tasbeeh">
        <TasbeehSheetBody onClose={close} />
      </Sheet>
      <Sheet visible={sheet === 'feelings'} onClose={close} testID="sheet-feelings">
        <FeelingsSheetBody onClose={close} />
      </Sheet>
      <Sheet visible={sheet === 'azkar'} onClose={close} testID="sheet-azkar">
        <AzkarSheetBody visible={sheet === 'azkar'} />
      </Sheet>
      <Sheet visible={sheet === 'prayers'} onClose={close} testID="sheet-prayers">
        <PrayerTimesSheetBody lat={lat} lng={lng} current={nextName} />
      </Sheet>
      <Sheet visible={sheet === 'settings'} onClose={close} testID="sheet-settings">
        <SettingsSheetBody onClose={close} />
      </Sheet>
      <Sheet visible={sheet === 'sunnah'} onClose={close} testID="sheet-sunnah">
        <SunnahSheetBody />
      </Sheet>
      <Sheet visible={sheet === 'rhythms'} onClose={close} testID="sheet-rhythms">
        <RhythmsSheetBody />
      </Sheet>
      <Sheet visible={sheet === 'bookmarks'} onClose={close} testID="sheet-bookmarks">
        <BookmarksSheetBody />
      </Sheet>
      <Sheet visible={sheet === 'notifications'} onClose={close} testID="sheet-notifications">
        <NotificationsSheetBody />
      </Sheet>
      <Sheet visible={sheet === 'qibla'} onClose={close} testID="sheet-qibla">
        <QiblaSheetBody />
      </Sheet>
      <Sheet visible={sheet === 'quran'} onClose={close} testID="sheet-quran">
        <QuranSheetBody active={sheet === 'quran'} />
      </Sheet>
      <Sheet visible={sheet === 'duas'} onClose={close} testID="sheet-duas">
        <DuasSheetBody />
      </Sheet>
      <Sheet visible={sheet === 'hadith'} onClose={close} testID="sheet-hadith">
        <HadithSheetBody />
      </Sheet>
    </SafeAreaView>
  );
}

function FeatureTile({
  icon,
  title,
  caption,
  onPress,
  testID,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  onPress: () => void;
  testID?: string;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const press = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      damping: 14,
      stiffness: 220,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View style={[{ flex: 1, transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press(0.96)}
        onPressOut={() => press(1)}
        style={styles.tile}
        testID={testID}
      >
        <View style={styles.tileIconWrap}>{icon}</View>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileCaption}>{caption}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: {
    paddingBottom: Spacing.xxl,
  },

  // ── Top bar ──
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hijriDate: {
    fontFamily: Fonts.label,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.gold,
    textTransform: 'uppercase',
  },
  gregDate: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  avatarText: {
    fontFamily: Fonts.bodySemi,
    color: Colors.gold,
    fontSize: 13,
    letterSpacing: 0.6,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Greeting ──
  greetingBlock: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  salam: {
    fontFamily: Fonts.arabic,
    fontSize: 30,
    color: Colors.gold,
    textAlign: 'center',
    lineHeight: 40,
  },
  welcomeName: {
    fontFamily: Fonts.displayItalic,
    fontSize: 20,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  reminderWrap: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  reminder: {
    fontFamily: Fonts.displayItalic,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  reminderSrc: {
    fontFamily: Fonts.label,
    fontSize: 9,
    letterSpacing: 1.6,
    color: Colors.textDim,
    textTransform: 'uppercase',
    marginTop: 6,
  },

  // ── Next prayer card ──
  nextCard: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  nextGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.gold,
    opacity: 0.06,
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    letterSpacing: 2.5,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  cardArrow: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.goldMuted,
    lineHeight: 24,
  },
  prayerName: {
    fontFamily: Fonts.display,
    fontSize: 34,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  countdown: {
    fontFamily: Fonts.displayBold,
    fontSize: 40,
    color: Colors.gold,
    letterSpacing: 1.4,
    marginTop: Spacing.sm,
  },
  subInfo: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textDim,
    marginTop: 4,
  },
  cardNote: {
    fontFamily: Fonts.label,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.goldMuted,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.borderSubtle,
    marginTop: Spacing.md,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.gold,
  },

  // ── Quran hero tile ──
  quranTile: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  quranGlow: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.gold,
    opacity: 0.06,
  },
  quranEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 10,
    letterSpacing: 2.4,
    color: Colors.gold,
    textTransform: 'uppercase',
  },
  quranAr: {
    fontFamily: Fonts.arabic,
    fontSize: 20,
    color: Colors.goldMuted,
    lineHeight: 28,
  },
  quranTitle: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    lineHeight: 30,
  },
  quranCaption: {
    fontFamily: Fonts.displayItalic,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // ── Feature tiles row ──
  tilesRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'flex-start',
    minHeight: 130,
  },
  tileIconWrap: {
    marginBottom: Spacing.md,
  },
  tileTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 17,
    color: Colors.textPrimary,
  },
  tileCaption: {
    fontFamily: Fonts.label,
    fontSize: 9,
    letterSpacing: 1.6,
    color: Colors.textDim,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  // ── Sunnah hero tile ──
  sunnahTile: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  sunnahGlow: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.gold,
    opacity: 0.05,
  },
  sunnahHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sunnahEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 10,
    letterSpacing: 2.4,
    color: Colors.gold,
    textTransform: 'uppercase',
  },
  sunnahAr: {
    fontFamily: Fonts.arabic,
    fontSize: 16,
    color: Colors.goldMuted,
    lineHeight: 22,
  },
  sunnahTitle: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    lineHeight: 28,
  },
  sunnahCaption: {
    fontFamily: Fonts.displayItalic,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sunnahFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  sunnahHairline: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.gold,
    opacity: 0.3,
  },
  sunnahArrow: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.gold,
    lineHeight: 22,
  },

  // ── Rhythms link ──
  rhythmsLink: {
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rhythmsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  rhythmsAr: {
    fontFamily: Fonts.arabic,
    fontSize: 18,
    color: Colors.gold,
    lineHeight: 24,
  },
  rhythmsLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
  rhythmsSub: {
    fontFamily: Fonts.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
  rhythmsArrow: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.goldMuted,
    lineHeight: 22,
  },

  // ── Footer brand ──
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  goldLine: {
    width: 24,
    height: 1,
    backgroundColor: Colors.gold,
    opacity: 0.3,
  },
  brandAr: {
    fontFamily: Fonts.arabic,
    fontSize: 16,
    color: Colors.goldMuted,
    lineHeight: 22,
  },
});
