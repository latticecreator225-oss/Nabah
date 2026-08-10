import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated, ActivityIndicator, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { api, fetchPrayerTimes } from '../api';
import { logError } from '../log';
import { FadeInUp } from '../motion';

// Format a Date as a 12-hour clock string, e.g. "4:31 AM".
function fmt12(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}
function hhmmToDate(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

type Prefs = {
  user_id: string;
  prayer_fajr: boolean; prayer_dhuhr: boolean; prayer_asr: boolean;
  prayer_maghrib: boolean; prayer_isha: boolean;
  pre_adhan_minutes: number;
  adhkar_morning: boolean; adhkar_evening: boolean; adhkar_sleep: boolean;
  tahajjud: boolean;
  sunnah_household: boolean; sunnah_public: boolean; sunnah_work: boolean;
  reminder_surah_mulk: boolean; reminder_surah_kahf: boolean;
  reminder_jumuah_hour: boolean;
  reminder_ayyamul_bidh: boolean; reminder_mon_thu: boolean;
  reminder_arafah: boolean; reminder_ashura: boolean; reminder_eid: boolean;
};

function PillToggle({ value, onChange, testID }: { value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const anim = React.useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, damping: 14, stiffness: 220, useNativeDriver: false }).start();
  }, [value, anim]);
  const trackBg = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.hover, Colors.gold] });
  const thumbLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onChange(!value);
      }}
      testID={testID}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackBg }]}>
        <Animated.View style={[styles.thumb, { left: thumbLeft }]} />
      </Animated.View>
    </Pressable>
  );
}

function Row({ title, sub, value, onChange, testID }: any) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <PillToggle value={value} onChange={onChange} testID={testID} />
    </View>
  );
}

const DEFAULT_PREFS: Prefs = {
  user_id: '',
  prayer_fajr: true, prayer_dhuhr: true, prayer_asr: true, prayer_maghrib: true, prayer_isha: true,
  pre_adhan_minutes: 0,
  adhkar_morning: true, adhkar_evening: true, adhkar_sleep: true,
  tahajjud: false,
  sunnah_household: true, sunnah_public: true, sunnah_work: true,
  reminder_surah_mulk: true, reminder_surah_kahf: true, reminder_jumuah_hour: true,
  reminder_ayyamul_bidh: true,
  reminder_mon_thu: false, reminder_arafah: true, reminder_ashura: true, reminder_eid: true,
};

export default function RhythmsSheetBody() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [tahajjudWindow, setTahajjudWindow] = useState<string>('');

  useEffect(() => {
    (async () => {
      const uid = (await AsyncStorage.getItem('userId')) || '';
      // Render immediately with sensible defaults so the sheet never blocks on
      // the network; merge the saved prefs in when (and if) they arrive.
      setPrefs({ ...DEFAULT_PREFS, user_id: uid });
      if (uid) {
        api.notifPrefs(uid)
          .then((r) => setPrefs((prev) => ({ ...DEFAULT_PREFS, ...(prev || {}), ...r, user_id: uid } as Prefs)))
          .catch((e) => logError('rhythms.loadPrefs', e));
      }

      // Compute tonight's actual last third of the night from prayer times
      // (Isha → next-day Fajr), rather than a hardcoded demo window.
      const lt = await AsyncStorage.getItem('userLat');
      const ln = await AsyncStorage.getItem('userLng');
      if (lt == null || ln == null) {
        setTahajjudWindow('enable location to calculate');
        return;
      }
      try {
        const resp = await fetchPrayerTimes(Number(lt), Number(ln));
        const t = resp.timings;
        if (t?.Isha && t?.Fajr) {
          const today = new Date();
          const isha = hhmmToDate(today, t.Isha);
          const nextFajr = hhmmToDate(today, t.Fajr);
          nextFajr.setDate(nextFajr.getDate() + 1); // Fajr belongs to tomorrow
          const nightMs = nextFajr.getTime() - isha.getTime();
          const lastThirdStart = new Date(isha.getTime() + (nightMs * 2) / 3);
          setTahajjudWindow(`${fmt12(lastThirdStart)} — ${fmt12(nextFajr)}`);
        }
      } catch (e) {
        logError('rhythms.tahajjudWindow', e);
      }
    })();
  }, []);

  const update = (patch: Partial<Prefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    api.saveNotifPrefs(next).catch((e) => logError('rhythms.savePrefs', e));
  };

  if (!prefs) return <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} testID="rhythms-sheet">
      <Text style={styles.eyebrow}>REMINDERS  ·  تذكيرات</Text>
      <Text style={styles.title}>Your Reminders</Text>
      <Text style={styles.subtitle}>Quiet nudges, set to the prayer clock and the sacred calendar.</Text>

      <Section title="DIVINE OBLIGATIONS" subtitle="The five — set for your timezone." delay={60}>
        <Row title="Fajr" sub="The first whisper of dawn"
          value={prefs.prayer_fajr} onChange={(v: boolean) => update({ prayer_fajr: v })} testID="pref-fajr" />
        <Divider />
        <Row title="Dhuhr" sub="Sun at its summit"
          value={prefs.prayer_dhuhr} onChange={(v: boolean) => update({ prayer_dhuhr: v })} testID="pref-dhuhr" />
        <Divider />
        <Row title="Asr" sub="The shadow lengthens"
          value={prefs.prayer_asr} onChange={(v: boolean) => update({ prayer_asr: v })} testID="pref-asr" />
        <Divider />
        <Row title="Maghrib" sub="The first star, the breaking fast"
          value={prefs.prayer_maghrib} onChange={(v: boolean) => update({ prayer_maghrib: v })} testID="pref-maghrib" />
        <Divider />
        <Row title="Isha" sub="The night has fallen"
          value={prefs.prayer_isha} onChange={(v: boolean) => update({ prayer_isha: v })} testID="pref-isha" />
        <Divider />
        <Row title="Pre-Adhan nudge" sub={prefs.pre_adhan_minutes ? `${prefs.pre_adhan_minutes} min before` : 'Off'}
          value={prefs.pre_adhan_minutes > 0}
          onChange={(v: boolean) => update({ pre_adhan_minutes: v ? 15 : 0 })} testID="pref-preadhan" />
      </Section>

      <Section title="THE FORTRESS · أذكار" subtitle="Adhkar at their honoured hours." delay={120}>
        <Row title="Morning Adhkar" sub="15 minutes after Fajr"
          value={prefs.adhkar_morning} onChange={(v: boolean) => update({ adhkar_morning: v })} testID="pref-adhkar-morning" />
        <Divider />
        <Row title="Evening Adhkar" sub="Between Asr and Maghrib"
          value={prefs.adhkar_evening} onChange={(v: boolean) => update({ adhkar_evening: v })} testID="pref-adhkar-evening" />
        <Divider />
        <Row title="Sleep Adhkar" sub="Two hours after Isha"
          value={prefs.adhkar_sleep} onChange={(v: boolean) => update({ adhkar_sleep: v })} testID="pref-adhkar-sleep" />
      </Section>

      <Section
        title="THE NIGHT VIGIL · قيام الليل"
        subtitle={tahajjudWindow ? `Tonight's last third — ${tahajjudWindow}` : "Tonight's last third"}
        delay={180}
      >
        <Row title="Tahajjud" sub="The quietest hour. The conversation He initiates."
          value={prefs.tahajjud} onChange={(v: boolean) => update({ tahajjud: v })} testID="pref-tahajjud" />
      </Section>

      <Section title="CONTEXTUAL SUNNAHS · سنن" subtitle="Forgotten threads, gently revived." delay={240}>
        <Row title="Household" sub="Entering home, family meals, hospitality"
          value={prefs.sunnah_household} onChange={(v: boolean) => update({ sunnah_household: v })} testID="pref-s-household" />
        <Divider />
        <Row title="Public conduct" sub="Greetings, the lowered gaze, charity"
          value={prefs.sunnah_public} onChange={(v: boolean) => update({ sunnah_public: v })} testID="pref-s-public" />
        <Divider />
        <Row title="Work & study" sub="Ihsan, intention, the dua before tasks"
          value={prefs.sunnah_work} onChange={(v: boolean) => update({ sunnah_work: v })} testID="pref-s-work" />
      </Section>

      <Section title="SACRED OBSERVANCES · مواسم" subtitle="The weekly recitations, the fasts, and the Eids." delay={300}>
        <Row title="Surah al-Mulk" sub="Each night before sleep — تبارك"
          value={prefs.reminder_surah_mulk} onChange={(v: boolean) => update({ reminder_surah_mulk: v })} testID="pref-mulk" />
        <Divider />
        <Row title="Surah al-Kahf" sub="Every Friday — a light between two Jumuʿahs"
          value={prefs.reminder_surah_kahf} onChange={(v: boolean) => update({ reminder_surah_kahf: v })} testID="pref-kahf" />
        <Divider />
        <Row title="The hour of response" sub="Friday, the last hour before Maghrib — ساعة الإجابة"
          value={prefs.reminder_jumuah_hour} onChange={(v: boolean) => update({ reminder_jumuah_hour: v })} testID="pref-jumuah-hour" />
        <Divider />
        <Row title="Ayyām al-Bīḍ" sub="The white days (13–15) — reminded the night before"
          value={prefs.reminder_ayyamul_bidh} onChange={(v: boolean) => update({ reminder_ayyamul_bidh: v })} testID="pref-bidh" />
        <Divider />
        <Row title="Mondays & Thursdays" sub="The Sunnah fasts — reminded the evening before"
          value={prefs.reminder_mon_thu} onChange={(v: boolean) => update({ reminder_mon_thu: v })} testID="pref-monthu" />
        <Divider />
        <Row title="Day of Arafah" sub="9 Dhul-Ḥijjah — fasting erases two years"
          value={prefs.reminder_arafah} onChange={(v: boolean) => update({ reminder_arafah: v })} testID="pref-arafah" />
        <Divider />
        <Row title="ʿAshura" sub="9th & 10th of Muharram"
          value={prefs.reminder_ashura} onChange={(v: boolean) => update({ reminder_ashura: v })} testID="pref-ashura" />
        <Divider />
        <Row title="The two Eids" sub="Eid al-Fitr & Eid al-Adha"
          value={prefs.reminder_eid} onChange={(v: boolean) => update({ reminder_eid: v })} testID="pref-eid" />
      </Section>

      <Text style={styles.footnote}>
        These nudges are scheduled locally on your device. They will not interrupt — they will only
        gently remind, in the manner of an old friend who knows the time.
      </Text>
    </ScrollView>
  );
}

function Section({ title, subtitle, children, delay = 0 }: any) {
  return (
    <FadeInUp delay={delay} style={{ marginTop: Spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </FadeInUp>
  );
}
function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  eyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.6, color: Colors.textDim, textTransform: 'uppercase' },
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginTop: 6 },
  subtitle: { fontFamily: Fonts.displayItalic, fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.4, color: Colors.gold, marginBottom: 2 },
  sectionSub: { fontFamily: Fonts.body, fontStyle: 'italic', fontSize: 11, color: Colors.textDim, marginBottom: Spacing.sm },
  sectionBody: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: Radius.lg, padding: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm + 2 },
  rowTitle: { fontFamily: Fonts.displayBold, fontSize: 16, color: Colors.textPrimary },
  rowSub: { fontFamily: Fonts.body, fontStyle: 'italic', fontSize: 12, color: Colors.textDim, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, opacity: 0.6 },
  track: {
    width: 46, height: 26, borderRadius: 13, justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  thumb: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.textPrimary,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }, default: {} }),
  },
  footnote: {
    fontFamily: Fonts.displayItalic, fontSize: 12, color: Colors.textDim, lineHeight: 19,
    textAlign: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.md,
  },
});
