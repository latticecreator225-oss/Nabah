/**
 * Nabah · wordmark
 *
 * Renders the real Scheherazade word نَبَأ (the same clean glyphs used across the
 * app) and brings it in with a confident, weighted entrance: it fades up, rises,
 * and settles with a gentle spring, then hands off (onDone) to the bismillah.
 *
 * Note: we deliberately render نَبَأ as a single, unconstrained centered <Text>.
 * Earlier attempts to "self-write" it via a width-clip or by re-assembling glyph
 * outlines sheared the leftmost letter (أ) — a fixed width fights the font's RTL
 * shaping. Letting the font lay the whole word out is what keeps it complete.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated, Easing, StyleSheet, AccessibilityInfo, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '../theme';

const WORD = 'نَبَأ';
const GOLD = Colors.gold;

export type NabaKineticLogoVariant = 'full' | 'short' | 'static';

type Props = {
  variant?: NabaKineticLogoVariant;
  onDone?: () => void;
  size?: number; // font size of the wordmark in dp
};

export default function NabaKineticLogo({ variant = 'full', onDone, size = 146 }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const rise = useRef(new Animated.Value(size * 0.14)).current;
  const doneRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduceMotion(!!v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone?.();
    };

    if (variant === 'static' || reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      rise.setValue(0);
      finish();
      return;
    }

    const dur = variant === 'short' ? 600 : 960;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: dur * 0.6,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: dur,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Weighted, unhurried arrival — a soft overshoot that settles.
      Animated.spring(scale, {
        toValue: 1,
        damping: 13,
        stiffness: 135,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        finish();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, variant]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { translateY: rise }] }}>
      <Text
        style={[styles.word, { fontSize: size, lineHeight: size * 2, paddingTop: size * 0.22 }]}
        allowFontScaling={false}
      >
        {WORD}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  word: {
    fontFamily: Fonts.arabic,
    color: GOLD,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
