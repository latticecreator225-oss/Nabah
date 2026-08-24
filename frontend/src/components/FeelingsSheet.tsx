import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { api, Emotion, AyahResp } from '../api';
import { playAudio, stopAudio } from '../audio';
import { logError } from '../log';
import { notify } from '../alerts';
import { FadeInUp } from '../motion';
import { HeartIcon, ShareIcon, SparkleIcon, VolumeIcon } from './Icons';

type Props = { onClose: () => void };

// "93:5" → surah number 93 (the ayah number follows the colon).
function parseSurahAyah(ref: string): { surah: number; ayah: number } | null {
  const m = /(\d{1,3})\s*:\s*(\d{1,3})/.exec(ref || '');
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  if (surah < 1 || surah > 114) return null;
  return { surah, ayah };
}

export default function FeelingsSheetBody({ onClose }: Props) {
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ayah, setAyah] = useState<AyahResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [ambientOn, setAmbientOn] = useState(false);
  const [ambientLoading, setAmbientLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    api.emotions().then(setEmotions).catch(() => {});
    // Silence any looping recitation when the sheet unmounts.
    return () => { stopAudio(); };
  }, []);

  // Plays the exact ayah on screen (Alafasy) once and stops. Native only; web
  // has no player.
  const toggleAmbient = async () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (ambientOn) {
      await stopAudio();
      setAmbientOn(false);
      return;
    }
    if (!ayah) return;
    const loc = parseSurahAyah(ayah.reference);
    if (!loc) return;
    setAmbientLoading(true);
    try {
      const surah = await api.quranSurah(loc.surah); // cached after first load
      const verse = surah.ayahs.find((a) => a.number === loc.ayah);
      if (verse?.audio) {
        await playAudio(verse.audio, {
          loop: false,
          onFinish: () => setAmbientOn(false),
          onError: () => setAmbientOn(false),
        });
        setAmbientOn(true);
      }
    } catch (e) {
      logError('feelings.ambient', e);
    } finally {
      setAmbientLoading(false);
    }
  };

  const seenKey = (key: string) => `feelingsSeen:${key}`;

  const pick = async (key: string, refresh = false) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    // The looping recitation belongs to the previous ayah — silence it.
    stopAudio();
    setAmbientOn(false);
    setSelected(key);
    if (refresh) setRefreshing(true);
    else setLoading(true);
    if (!refresh) setAyah(null);
    setSaved(false);
    try {
      const uid = (await AsyncStorage.getItem('userId')) || undefined;
      // Track which verses we've already shown for this emotion so "Another"
      // rotates through the whole pool before any repeats.
      let seen: number[] = [];
      if (refresh) {
        try {
          const raw = await AsyncStorage.getItem(seenKey(key));
          if (raw) seen = JSON.parse(raw);
        } catch {}
      }
      const resp = await api.emotionAyah(key, uid, refresh, seen);
      setAyah(resp);
      if (!refresh) {
        // Scroll the new ayah into view — otherwise, on a grid taller than the
        // screen, the answer to "which ayah?" loads off-screen below the fold.
        // A short delay lets the card's entrance layout settle first.
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 220);
      }
      if (typeof resp.index === 'number') {
        // Start a fresh cycle when the backend signals the pool was exhausted.
        const nextSeen = resp.cycle_reset ? [resp.index] : [...seen, resp.index];
        AsyncStorage.setItem(seenKey(key), JSON.stringify(nextSeen)).catch(() => {});
      }
    } catch (e: any) {
      notify('Could not load', String(e?.message || e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onSave = async () => {
    if (!ayah) return;
    const uid = await AsyncStorage.getItem('userId');
    if (!uid) return;
    setSaving(true);
    try {
      await api.saveAyah({
        user_id: uid,
        emotion: ayah.key,
        arabic: ayah.arabic,
        english: ayah.english,
        surah: ayah.surah,
        reference: ayah.reference,
      });
      setSaved(true);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const onShare = async () => {
    if (!ayah) return;
    try {
      await Share.share({
        message: `${ayah.arabic}\n\n"${ayah.english}"\n— Surah ${ayah.surah} (${ayah.reference})\n\nShared via نَبَأ`,
      });
    } catch {}
  };

  return (
    <View style={styles.root} testID="feelings-sheet">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>How are you feeling?</Text>
          <Text style={styles.titleAr}>كيف حالك؟</Text>
        </View>

        <View style={styles.grid}>
          {emotions.map((e, i) => {
            const active = selected === e.key;
            return (
              <FadeInUp key={e.key} delay={40 + Math.min(i, 10) * 40} style={styles.gridCell}>
                <TouchableOpacity
                  testID={`emotion-${e.key}`}
                  onPress={() => pick(e.key)}
                  activeOpacity={0.85}
                  style={[styles.tile, active && styles.tileActive]}
                >
                  <Text style={[styles.tileEn, active && { color: Colors.gold }]}>
                    {e.emotion_en}
                  </Text>
                  <Text style={styles.tileAr}>{e.emotion_ar}</Text>
                </TouchableOpacity>
              </FadeInUp>
            );
          })}
        </View>

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.gold} />
            <Text style={styles.loadingText}>Finding your ayah…</Text>
          </View>
        )}

        {ayah && !loading && (
          <FadeInUp key={ayah.reference} delay={40}>
          <View style={styles.ayahCard} testID="ayah-card">
            <View style={styles.ayahHeadRow}>
              <Text style={styles.surahLabel}>
                SURAH {ayah.surah.toUpperCase()}  ·  {ayah.reference}
              </Text>
              {ayah.pool_size ? (
                <TouchableOpacity
                  onPress={() => pick(ayah.key, true)}
                  disabled={refreshing}
                  testID="ayah-refresh-btn"
                  style={styles.refreshBtn}
                >
                  <Text style={styles.refreshText}>
                    {refreshing ? '…' : `↻ Another (${ayah.pool_size})`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.ayahArabic}>{ayah.arabic}</Text>
            <View style={styles.divider} />
            <Text style={styles.ayahEnglish}>“{ayah.english}”</Text>

            {ayah.reflection ? (
              <View style={styles.reflectionBox}>
                <View style={styles.reflectionHeader}>
                  <SparkleIcon size={12} />
                  <Text style={styles.reflectionLabel}>A WORD FOR YOU</Text>
                </View>
                <Text style={styles.reflectionText}>{ayah.reflection}</Text>
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                testID="ayah-save-btn"
                onPress={onSave}
                disabled={saving || saved}
                style={[styles.actionBtn, saved && styles.actionBtnDone]}
              >
                <HeartIcon size={16} color={saved ? Colors.bgPrimary : Colors.gold} />
                <Text style={[styles.actionText, saved && { color: Colors.bgPrimary }]}>
                  {saved ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="ayah-listen-btn"
                onPress={toggleAmbient}
                disabled={ambientLoading}
                style={[styles.actionBtn, ambientOn && styles.actionBtnDone]}
              >
                <VolumeIcon size={16} color={ambientOn ? Colors.bgPrimary : Colors.gold} />
                <Text style={[styles.actionText, ambientOn && { color: Colors.bgPrimary }]}>
                  {ambientLoading ? '…' : ambientOn ? 'Playing' : 'Listen'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="ayah-share-btn"
                onPress={onShare}
                style={styles.actionBtn}
              >
                <ShareIcon size={16} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          </FadeInUp>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  title: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
  },
  titleAr: {
    fontFamily: Fonts.arabic,
    fontSize: 22,
    color: Colors.gold,
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  gridCell: {
    width: '48.5%',
  },
  tile: {
    width: '100%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'flex-start',
  },
  tileActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.hover,
  },
  tileEn: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: 0.4,
  },
  tileAr: {
    fontFamily: Fonts.arabic,
    fontSize: 16,
    color: Colors.goldMuted,
    marginTop: 4,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  loadingText: {
    fontFamily: Fonts.label,
    color: Colors.textDim,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  ayahCard: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  surahLabel: {
    flex: 1,
    fontFamily: Fonts.label,
    color: Colors.gold,
    fontSize: 10,
    letterSpacing: 2.4,
  },
  ayahHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  refreshBtn: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  refreshText: {
    fontFamily: Fonts.label,
    fontSize: 9,
    letterSpacing: 1.4,
    color: Colors.gold,
    textTransform: 'uppercase',
  },
  ayahArabic: {
    fontFamily: Fonts.arabic,
    fontSize: 24,
    color: Colors.textPrimary,
    lineHeight: 44,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: Spacing.md,
  },
  ayahEnglish: {
    fontFamily: Fonts.displayItalic,
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 26,
    textAlign: 'center',
  },
  reflectionBox: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reflectionLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    letterSpacing: 2.4,
    color: Colors.gold,
  },
  reflectionText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    backgroundColor: Colors.surface,
  },
  actionBtnDone: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  actionText: {
    fontFamily: Fonts.bodyMedium,
    color: Colors.textPrimary,
    fontSize: 13,
    letterSpacing: 1,
  },
});
