import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import ProgressRing from './ProgressRing';
import { CheckIcon } from './Icons';
import { Bump } from '../motion';

type Dhikr = { id: string; ar: string; en: string; target: number };

const PRESETS: Dhikr[] = [
  { id: 'subhan', ar: 'سُبْحَانَ ٱللَّٰه', en: 'SubhanAllah', target: 33 },
  { id: 'hamd', ar: 'ٱلْحَمْدُ لِلَّٰه', en: 'Alhamdulillah', target: 33 },
  { id: 'akbar', ar: 'ٱللَّٰهُ أَكْبَر', en: 'Allahu Akbar', target: 34 },
  { id: 'astagh', ar: 'أَسْتَغْفِرُ ٱللَّٰه', en: 'Astaghfirullah', target: 100 },
];

type Props = { onClose: () => void };

export default function TasbeehSheetBody({ onClose }: Props) {
  const [selected, setSelected] = useState<Dhikr>(PRESETS[0]);
  const [count, setCount] = useState(0);
  const [session, setSession] = useState(0);
  const [showCustom, setShowCustom] = useState(false);
  const [customAr, setCustomAr] = useState('');
  const [customEn, setCustomEn] = useState('');
  const [customTarget, setCustomTarget] = useState('33');
  const [justCompleted, setJustCompleted] = useState(false);
  const completedTimer = useRef<any>(null);

  useEffect(() => {
    let active = false;
    let mounted = true;
    activateKeepAwakeAsync()
      .then(() => {
        if (mounted) active = true;
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (active) {
        try { deactivateKeepAwake(); } catch {}
      }
    };
  }, []);

  // Hardware volume-button counting is disabled for now: react-native-volume-
  // manager's supported baseline is RN 0.85+, this app is on RN 0.81.5 with
  // the New Architecture enabled, and the native-module ABI mismatch crashed
  // this screen on open (a native crash, not a JS error — try/catch around
  // its calls can't prevent it). Tap-to-count below is unaffected.

  const handleIncrement = () => {
    // Side effects (haptics, the completion timer) live here in the handler,
    // not inside a setState updater — updaters must stay pure, and React may
    // invoke one more than once.
    const n = count + 1;
    const completed = n >= selected.target;
    setCount(completed ? 0 : n);

    if (Platform.OS !== 'web') {
      if (!completed && n % 33 === 0) {
        // Distinct double pulse at each 33 — countable from inside a pocket.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }, 140);
      } else if (!completed) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    }

    if (completed) {
      setSession((s) => s + n);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setJustCompleted(true);
      clearTimeout(completedTimer.current);
      completedTimer.current = setTimeout(() => setJustCompleted(false), 1200);
    }
  };

  const reset = () => {
    setCount(0);
    setSession(0);
  };

  const progress = count / selected.target;

  const dhikrChips = useMemo(() => {
    return PRESETS.map((d) => {
      const active = selected.id === d.id;
      return (
        <TouchableOpacity
          key={d.id}
          testID={`tasbeeh-preset-${d.id}`}
          onPress={() => {
            setSelected(d);
            setCount(0);
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
          }}
          style={[styles.chip, active && styles.chipActive]}
        >
          <Text style={[styles.chipText, active && { color: Colors.gold }]}>
            {d.en} <Text style={{ color: Colors.textDim }}>· ×{d.target}</Text>
          </Text>
        </TouchableOpacity>
      );
    });
  }, [selected]);

  return (
    <View style={styles.root} testID="tasbeeh-sheet">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tasbeeh</Text>
      </View>

      {/* Everything below the title scrolls — without this, the custom-dhikr
          form opening at the same time as the keyboard leaves no room for the
          (fixed-size, non-shrinking) counter ring, and they visually collide. */}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
          style={{ flexGrow: 0 }}
        >
          {dhikrChips}
          <TouchableOpacity
            testID="tasbeeh-custom-btn"
            onPress={() => setShowCustom(!showCustom)}
            style={[styles.chip, showCustom && styles.chipActive]}
          >
            <Text style={[styles.chipText, showCustom && { color: Colors.gold }]}>Custom</Text>
          </TouchableOpacity>
        </ScrollView>

        {showCustom && (
          <View style={styles.customBox}>
            <TextInput
              value={customEn}
              onChangeText={setCustomEn}
              placeholder="Your dhikr (English)"
              placeholderTextColor={Colors.textDim}
              style={styles.customInput}
            />
            <TextInput
              value={customAr}
              onChangeText={setCustomAr}
              placeholder="Your dhikr (Arabic, optional)"
              placeholderTextColor={Colors.textDim}
              style={[styles.customInput, { fontFamily: Fonts.arabic, fontSize: 18, textAlign: 'right' }]}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput
                value={customTarget}
                onChangeText={setCustomTarget}
                keyboardType="number-pad"
                placeholder="Target"
                placeholderTextColor={Colors.textDim}
                style={[styles.customInput, { flex: 1 }]}
              />
              <TouchableOpacity
                onPress={() => {
                  const t = parseInt(customTarget, 10);
                  if (!customEn.trim() || !t || t < 1) return;
                  setSelected({
                    id: 'custom',
                    en: customEn.trim(),
                    ar: customAr.trim() || customEn.trim(),
                    target: t,
                  });
                  setCount(0);
                  setShowCustom(false);
                }}
                style={styles.customApply}
              >
                <Text style={styles.customApplyText}>Use</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Pressable
          onPress={handleIncrement}
          testID="tasbeeh-tap-zone"
          style={styles.tapZone}
          android_ripple={{ color: Colors.goldRipple, borderless: true, radius: 160 }}
        >
          <View style={styles.ringWrap}>
            <ProgressRing size={260} progress={progress} stroke={6} />
            <View style={styles.ringCenter}>
              {/* Bump stays mounted permanently — swapping it out via a ternary
                  would tear it down mid-animation on the exact tap that
                  completes a cycle, right as its Reanimated sequence starts. */}
              <View style={{ opacity: justCompleted ? 0 : 1 }} pointerEvents={justCompleted ? 'none' : 'auto'}>
                <Bump value={count}>
                  <Text style={styles.count} testID="tasbeeh-count">
                    {count}
                  </Text>
                </Bump>
                <Text style={styles.target}>/ {selected.target}</Text>
              </View>
              {justCompleted && (
                <View style={[styles.completedRow, StyleSheet.absoluteFillObject]}>
                  <CheckIcon size={28} />
                  <Text style={styles.completedText}>complete</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.dhikrAr}>{selected.ar}</Text>
          <Text style={styles.dhikrEn}>{selected.en}</Text>
        </Pressable>

        <View style={styles.footerRow}>
          <Bump value={session}>
            <Text style={styles.sessionText} testID="tasbeeh-session">
              Session  ·  {session}
            </Text>
          </Bump>
          <TouchableOpacity onPress={reset} testID="tasbeeh-reset-btn" style={styles.resetBtn}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Spacing.sm },
  headerRow: {
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.card,
  },
  chipActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.hover,
  },
  chipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  customBox: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  customInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontFamily: Fonts.body,
  },
  customApply: {
    backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    justifyContent: 'center',
  },
  customApplyText: {
    fontFamily: Fonts.bodySemi,
    color: Colors.bgPrimary,
  },
  tapZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontFamily: Fonts.displayBold,
    fontSize: 72,
    color: Colors.textPrimary,
    lineHeight: 80,
  },
  target: {
    fontFamily: Fonts.display,
    fontSize: 16,
    color: Colors.gold,
    marginTop: -4,
  },
  completedRow: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  completedText: {
    fontFamily: Fonts.label,
    color: Colors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  dhikrAr: {
    fontFamily: Fonts.arabic,
    fontSize: 30,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  dhikrEn: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textDim,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  sessionText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  resetBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  resetText: {
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
