import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Spacing } from '../src/theme';
import NabaKineticLogo from '../src/logo/NabaKineticLogo';

const { width: W, height: H } = Dimensions.get('window');

// Safety net only — the kinetic logo's onDone always fires (including the
// reduced-motion / static path); this just guards against an unforeseen
// animation-callback failure leaving the splash stuck.
const FALLBACK_MS = 6500;
// How long the bismillah lingers before the whole splash fades away.
const BISMILLAH_HOLD_MS = 1100;

export default function Splash() {
  const router = useRouter();
  const navigatedRef = useRef(false);

  const bismillahOp = useRef(new Animated.Value(0)).current; // fades in after the word, then out
  const fadeOut = useRef(new Animated.Value(1)).current;     // whole-screen exit

  const navigate = useCallback(async () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const userId = await AsyncStorage.getItem('userId');
    if (userId) router.replace('/home');
    else router.replace('/onboarding');
  }, [router]);

  useEffect(() => {
    const fallback = setTimeout(navigate, FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [navigate]);

  // Sequence after نَبَأ appears: bismillah fades in → holds → the whole splash
  // disappears → route onward.
  const onLogoDone = useCallback(() => {
    const ease = Easing.bezier(0.22, 1, 0.36, 1);
    Animated.sequence([
      Animated.timing(bismillahOp, { toValue: 1, duration: 650, easing: ease, useNativeDriver: true }),
      Animated.delay(BISMILLAH_HOLD_MS),
      Animated.timing(fadeOut, { toValue: 0, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => navigate());
  }, [bismillahOp, fadeOut, navigate]);

  return (
    <Pressable style={styles.container} onPress={navigate} testID="splash-screen">
      {/* Ambient radial vignette */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="46%" r="65%">
            <Stop offset="0%" stopColor="#161106" stopOpacity="1" />
            <Stop offset="55%" stopColor="#0D0D0D" stopOpacity="1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#vignette)" />
      </Svg>

      <Animated.View style={[styles.center, { opacity: fadeOut }]}>
        {/* The word writes itself in gold */}
        <View testID="splash-name-ar">
          <NabaKineticLogo variant="full" size={152} onDone={onLogoDone} />
        </View>

        {/* Then the complete bismillah appears beneath it */}
        <Animated.Text style={[styles.bismillah, { opacity: bismillahOp }]} testID="splash-bismillah">
          بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  bismillah: {
    fontFamily: Fonts.arabic,
    fontSize: 22,
    color: Colors.goldMuted,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 34,
  },
});
