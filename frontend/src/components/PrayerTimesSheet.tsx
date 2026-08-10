import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { fetchPrayerTimes, PrayerTimes } from '../api';
import { logError } from '../log';
import { FadeInUp } from '../motion';
import { BellIcon } from './Icons';

const PRAYERS_ORDER: (keyof PrayerTimes)[] = [
  'Fajr',
  'Sunrise',
  'Dhuhr',
  'Asr',
  'Maghrib',
  'Isha',
];

export default function PrayerTimesSheetBody({
  lat,
  lng,
  current,
}: {
  lat: number | null;
  lng: number | null;
  current: string | null;
}) {
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [hijri, setHijri] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bells, setBells] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<number | undefined>(undefined);
  const [methodName, setMethodName] = useState<string>('');
  const [asrSchool, setAsrSchool] = useState<number>(0); // 0=Standard, 1=Hanafi
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('adhanBells');
      if (saved) setBells(JSON.parse(saved));
      const m = await AsyncStorage.getItem('calcMethod');
      const s = await AsyncStorage.getItem('asrSchool');
      const initialMethod = m ? Number(m) : undefined;
      const initialSchool = s ? Number(s) : 0;
      if (m) setMethod(initialMethod);
      setAsrSchool(initialSchool);
      // Explicit null checks — latitude/longitude 0 are valid coordinates.
      if (lat == null || lng == null) {
        setLoading(false);
        return;
      }
      try {
        const resp = await fetchPrayerTimes(lat, lng, initialMethod, initialSchool);
        setTimes(resp.timings);
        setHijri(resp.date?.hijri);
        setMethod(resp.method);
        setMethodName(resp.method_name);
        setStale(Boolean(resp.stale));
      } catch (e) {
        logError('prayerTimesSheet.load', e);
        setError(true);
      }
      setLoading(false);
    })();
  }, [lat, lng]);

  const applyMethod = async (newMethod: number) => {
    setPickerOpen(false);
    setMethod(newMethod);
    setLoading(true);
    await AsyncStorage.setItem('calcMethod', String(newMethod));
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (lat == null || lng == null) {
      setLoading(false);
      return;
    }
    try {
      const resp = await fetchPrayerTimes(lat, lng, newMethod, asrSchool);
      setTimes(resp.timings);
      setHijri(resp.date?.hijri);
      setMethodName(resp.method_name);
      setStale(Boolean(resp.stale));
    } catch (e) {
      logError('prayerTimesSheet.applyMethod', e);
      setError(true);
    }
    setLoading(false);
  };

  const applyAsrSchool = async (s: number) => {
    setAsrSchool(s);
    await AsyncStorage.setItem('asrSchool', String(s));
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    // Explicit null checks — latitude/longitude 0 are valid coordinates.
    if (lat == null || lng == null) return;
    setLoading(true);
    try {
      const resp = await fetchPrayerTimes(lat, lng, method, s);
      setTimes(resp.timings);
      setMethodName(resp.method_name);
      setStale(Boolean(resp.stale));
    } catch (e) {
      logError('prayerTimesSheet.applyAsrSchool', e);
      setError(true);
    }
    setLoading(false);
  };

  const toggleBell = (p: string) => {
    const next = { ...bells, [p]: !bells[p] };
    setBells(next);
    AsyncStorage.setItem('adhanBells', JSON.stringify(next)).catch(() => {});
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const formatTime = (t?: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Ramadan check
  const isRamadan = hijri?.month?.number === 9;

  return (
    <View style={styles.root} testID="prayer-times-sheet">
      <View style={styles.header}>
        <Text style={styles.title}>Today's Prayers</Text>
        <Text style={styles.titleAr}>أوقات الصلاة</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.gold} />
        </View>
      ) : !times ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {error
              ? "We couldn't reach the prayer-times service. Check your connection and try again."
              : 'Location access is needed to calculate prayer times.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xl }}>
          {stale && (
            <View style={styles.staleBanner}>
              <Text style={styles.staleText}>Offline · showing your last saved times</Text>
            </View>
          )}
          {isRamadan && (
            <View style={styles.ramadanCard}>
              <Text style={styles.ramadanLabel}>RAMADAN</Text>
              <View style={styles.ramadanRow}>
                <View>
                  <Text style={styles.ramadanName}>Sehri</Text>
                  <Text style={styles.ramadanTime}>{formatTime(times.Fajr)}</Text>
                </View>
                <View>
                  <Text style={styles.ramadanName}>Iftar</Text>
                  <Text style={styles.ramadanTime}>{formatTime(times.Maghrib)}</Text>
                </View>
              </View>
            </View>
          )}

          {PRAYERS_ORDER.map((p, i) => {
            const time = times[p as keyof PrayerTimes];
            const isNext = current === p;
            return (
              <FadeInUp key={p} delay={50 + i * 55}>
                <View
                  style={[styles.row, isNext && styles.rowActive]}
                  testID={`prayer-row-${p.toLowerCase()}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, isNext && { color: Colors.gold }]}>{p}</Text>
                    {isNext && <Text style={styles.nextLabel}>NEXT</Text>}
                  </View>
                  <Text style={[styles.rowTime, isNext && { color: Colors.gold }]}>
                    {formatTime(time)}
                  </Text>
                  <TouchableOpacity onPress={() => toggleBell(p)} style={styles.bellBtn}>
                    <BellIcon
                      size={20}
                      color={bells[p] ? Colors.gold : Colors.textDim}
                      filled={bells[p]}
                    />
                  </TouchableOpacity>
                </View>
              </FadeInUp>
            );
          })}

          <TouchableOpacity
            onPress={() => setPickerOpen((v) => !v)}
            style={styles.methodCard}
            activeOpacity={0.8}
            testID="prayer-method-toggle"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.methodLabel}>CALCULATION</Text>
              <Text style={styles.methodValue}>{methodName || 'Auto'}</Text>
              <Text style={styles.methodHint}>
                Asr: {asrSchool === 1 ? 'Hanafi' : 'Standard'}  ·  Tap to change
              </Text>
            </View>
            <Text style={styles.methodChev}>{pickerOpen ? '×' : '›'}</Text>
          </TouchableOpacity>

          {pickerOpen && (
            <View style={styles.pickerBlock} testID="prayer-method-picker">
              <Text style={styles.pickerEyebrow}>METHOD</Text>
              {METHOD_OPTIONS.map((opt) => {
                const active = method === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => applyMethod(opt.id)}
                    style={[styles.pickerRow, active && styles.pickerRowActive]}
                    activeOpacity={0.75}
                    testID={`prayer-method-${opt.id}`}
                  >
                    <View style={[styles.dotRing, active && styles.dotRingActive]}>
                      {active ? <View style={styles.dotInner} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerName, active && { color: Colors.gold }]}>
                        {opt.label}
                      </Text>
                      {opt.region ? <Text style={styles.pickerRegion}>{opt.region}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.pickerSeparator} />
              <Text style={styles.pickerEyebrow}>ASR</Text>
              <View style={styles.asrRow}>
                <TouchableOpacity
                  onPress={() => applyAsrSchool(0)}
                  style={[styles.asrPill, asrSchool === 0 && styles.asrPillActive]}
                  testID="asr-standard"
                >
                  <Text style={[styles.asrPillText, asrSchool === 0 && { color: Colors.gold }]}>
                    Standard (Shafi'i)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => applyAsrSchool(1)}
                  style={[styles.asrPill, asrSchool === 1 && styles.asrPillActive]}
                  testID="asr-hanafi"
                >
                  <Text style={[styles.asrPillText, asrSchool === 1 && { color: Colors.gold }]}>
                    Hanafi
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const METHOD_OPTIONS: { id: number; label: string; region?: string }[] = [
  { id: 3, label: 'Muslim World League', region: 'Globally accepted default' },
  { id: 4, label: 'Umm al-Qura', region: 'Saudi Arabia' },
  { id: 2, label: 'ISNA', region: 'North America' },
  { id: 1, label: 'University of Karachi', region: 'Pakistan / India / Bangladesh' },
  { id: 5, label: 'Egyptian Authority', region: 'Egypt / North Africa' },
  { id: 13, label: 'Diyanet', region: 'Turkey' },
  { id: 17, label: 'JAKIM', region: 'Malaysia' },
  { id: 11, label: 'MUIS', region: 'Singapore' },
  { id: 20, label: 'Kemenag', region: 'Indonesia' },
  { id: 23, label: 'Jordan Awqaf', region: 'Levant' },
  { id: 16, label: 'Dubai', region: 'UAE' },
  { id: 8, label: 'Gulf Region' },
  { id: 7, label: 'Tehran', region: 'Iran' },
  { id: 15, label: 'Moonsighting Committee' },
];

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary },
  titleAr: { fontFamily: Fonts.arabic, fontSize: 18, color: Colors.gold, marginTop: 4 },
  loading: { padding: Spacing.xl, alignItems: 'center' },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  staleBanner: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  staleText: {
    fontFamily: Fonts.label,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.goldMuted,
    textTransform: 'uppercase',
  },
  ramadanCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  ramadanLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    letterSpacing: 2.5,
    color: Colors.gold,
    marginBottom: Spacing.sm,
  },
  ramadanRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ramadanName: { fontFamily: Fonts.displayBold, color: Colors.textPrimary, fontSize: 16 },
  ramadanTime: { fontFamily: Fonts.display, color: Colors.gold, fontSize: 22, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    borderRadius: Radius.md,
  },
  rowActive: {
    backgroundColor: Colors.hover,
    borderBottomColor: Colors.gold,
  },
  rowName: { fontFamily: Fonts.displayBold, color: Colors.textPrimary, fontSize: 18 },
  nextLabel: {
    fontFamily: Fonts.label,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.gold,
    marginTop: 2,
  },
  rowTime: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.textSecondary,
    marginRight: Spacing.md,
  },
  bellBtn: { padding: 6 },
  methodCard: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodLabel: {
    fontFamily: Fonts.label,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  methodValue: {
    fontFamily: Fonts.displayBold,
    fontSize: 16,
    color: Colors.gold,
    marginTop: 4,
  },
  methodHint: {
    fontFamily: Fonts.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
  methodChev: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.goldMuted,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  pickerBlock: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  pickerEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 9,
    letterSpacing: 2.2,
    color: Colors.goldMuted,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  pickerRowActive: {
    backgroundColor: Colors.hover,
  },
  dotRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRingActive: {
    borderColor: Colors.gold,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  pickerName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  pickerRegion: {
    fontFamily: Fonts.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 1,
  },
  pickerSeparator: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: Spacing.md,
  },
  asrRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  asrPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
  },
  asrPillActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.hover,
  },
  asrPillText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
  },
});
