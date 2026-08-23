/**
 * Nabah · Motion system
 *
 * A small, reusable set of premium-feeling primitives built on React Native's
 * built-in Animated API — native-driven for transform/opacity, 60fps, zero
 * config. Deliberately not Reanimated: these are discrete, JS-thread-triggered
 * animations (button presses, entrances, value pops), not continuous
 * gesture-driven ones, so they don't need UI-thread worklets. Reanimated is
 * used elsewhere only where that's actually required (Sheet.tsx's drag
 * gesture) — see Bump's comment for why mixing it in here caused a crash.
 *
 *   <AmbientField/>      — a slow, breathing gold aura for hero surfaces
 *   <FadeInUp delay>     — staggered entrance (fade + rise)
 *   <PressableScale>     — tactile spring on press
 *   <Shimmer/>           — a drifting highlight line
 *   <Bump value>         — tactile scale-pop whenever `value` changes
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Colors } from './theme';

/**
 * Motion tokens — the app's one source of truth for spring/timing physics.
 * Named per feel, not per screen, so every surface reads as one hand:
 *   whisper  — ambient loops (auras, shimmers): slow, soft, never draws the eye
 *   settle   — entrances (cards, sheets, cascades): a confident, weighted arrival
 *   tactile  — press/tap feedback: quick, springy, alive under the finger
 *   flick    — small pops (dots, badges, checkmarks): snappy with slight overshoot
 * Reanimated's withSpring/withTiming and RN's Animated.spring/timing take the
 * same {damping, stiffness, mass} / {duration, easing} shape, so these tokens
 * work with either — use SPRINGS/TIMINGS directly, don't hand-roll new configs.
 */
export const SPRINGS = {
  whisper: { damping: 20, stiffness: 40, mass: 1.4 },
  settle: { damping: 16, stiffness: 160, mass: 1 },
  tactile: { damping: 15, stiffness: 260, mass: 0.6 },
  flick: { damping: 12, stiffness: 320, mass: 0.5 },
} as const;

export const TIMINGS = {
  quick: { duration: 180, easing: Easing.out(Easing.cubic) },
  base: { duration: 420, easing: Easing.out(Easing.cubic) },
  slow: { duration: 700, easing: Easing.inOut(Easing.cubic) },
  entrance: { duration: 560, easing: Easing.bezier(0.22, 1, 0.36, 1) },
} as const;

export const STAGGER = { tight: 55, base: 80, loose: 130 } as const;
export const PRESS_SCALE = 0.97;
export const DISTANCE = { small: 8, base: 16, large: 24 } as const;

// ─────────────────────────── Reduced motion ───────────────────────────
// Honours the OS "Reduce Motion" accessibility setting. Every primitive below
// checks this and renders its final/static state instead of animating, so the
// whole app — not just the splash — respects the preference.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduced(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(!!v));
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

// ─────────────────────────── FadeInUp ───────────────────────────
export function FadeInUp({
  children,
  delay = 0,
  distance = 16,
  duration = 560,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(1); // appear in final position, no motion
      return;
    }
    const a = Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [t, delay, duration, reduced]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ─────────────────────────── Bump (spring pop on value change) ───────────────────────────
// Gives a live number/badge a tactile heartbeat: whenever `value` changes it
// pops in scale and springs back. Skips the mount so it only fires on change.
// Plain Animated (JS thread), not Reanimated — a Reanimated worklet here (an
// inline animation callback, or withSequence before it) was the cause of a
// crash: an uncaught JS exception thrown from a UI-thread JSI call into
// Hermes, confirmed from a device crash log. Discrete tap-triggered pops
// don't need UI-thread sync the way Sheet.tsx's drag gesture does, so this
// sidesteps the whole class of risk rather than chasing the exact worklet bug.
export function Bump({
  value,
  children,
  style,
  peak = 1.16,
}: {
  value: string | number;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  peak?: number;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return; // no pop under reduced motion
    Animated.sequence([
      Animated.timing(scale, {
        toValue: peak,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: SPRINGS.tactile.damping,
        stiffness: SPRINGS.tactile.stiffness,
        mass: SPRINGS.tactile.mass,
        useNativeDriver: true,
      }),
    ]).start();
  }, [value, peak, scale, reduced]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

// ─────────────────────────── PressableScale ───────────────────────────
export function PressableScale({
  children,
  onPress,
  style,
  to = 0.97,
  testID,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  to?: number;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (v: number) =>
    Animated.spring(scale, { toValue: v, damping: 15, stiffness: 220, mass: 0.6, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => spring(to)}
        onPressOut={() => spring(1)}
        style={style}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────── Shimmer (gold drift line) ───────────────────────────
export function Shimmer({ width = 120, height = 1 }: { width?: number; height?: number }) {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return; // static line, no drift
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [x, reduced]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.4, width * 0.4] });
  return (
    <View style={{ width, height, backgroundColor: Colors.borderSubtle, borderRadius: height, overflow: 'hidden' }}>
      <Animated.View
        style={{ width: width * 0.4, height, backgroundColor: Colors.gold, opacity: 0.7, transform: [{ translateX }] }}
      />
    </View>
  );
}

// ─────────────────────────── AmbientField ───────────────────────────
// Two soft gold orbs that slowly breathe and drift behind hero content. Pure
// transform/opacity loops (native driver) so it's effectively free at runtime.
function Orb({
  size, color, delay, drift, dur, baseOpacity,
}: { size: number; color: string; delay: number; drift: number; dur: number; baseOpacity: number }) {
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return; // hold at base opacity, no breathing/drift
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p, dur, delay, reduced]);
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = p.interpolate({ inputRange: [0, 1], outputRange: [baseOpacity, baseOpacity * 1.7] });
  const r = size / 2;
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`orb${size}${Math.round(drift)}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#orb${size}${Math.round(drift)})`} />
      </Svg>
    </Animated.View>
  );
}

export function AmbientField({ style }: { style?: ViewStyle | ViewStyle[] }) {
  // Memoise positions so they don't jump on re-render.
  const orbs = useMemo(
    () => [
      { key: 'a', size: 360, color: Colors.gold, top: -120, left: -90, delay: 0, drift: 26, dur: 5200, baseOpacity: 0.05 },
      { key: 'b', size: 300, color: Colors.gold, top: 220, left: 160, delay: 1400, drift: -22, dur: 6400, baseOpacity: 0.04 },
      { key: 'c', size: 240, color: Colors.goldDeep, top: 460, left: -40, delay: 800, drift: 18, dur: 7200, baseOpacity: 0.05 },
    ],
    [],
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {orbs.map((o) => (
        <View key={o.key} style={{ position: 'absolute', top: o.top, left: o.left }}>
          <Orb size={o.size} color={o.color} delay={o.delay} drift={o.drift} dur={o.dur} baseOpacity={o.baseOpacity} />
        </View>
      ))}
    </View>
  );
}
