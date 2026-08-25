import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Platform, Animated, Easing,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { Colors, Fonts, Spacing, Radius } from '../theme';
import { useT } from '../i18n';

// Kaaba coordinates
const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

function bearingTo(lat: number, lng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat);
  const φ2 = toRad(KAABA_LAT);
  const Δλ = toRad(KAABA_LNG - lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export default function QiblaSheetBody() {
  const t = useT();
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [city, setCity] = useState<{ lat: number; lng: number } | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const rot = useRef(new Animated.Value(0)).current;
  const lastHeadingRef = useRef(0);
  const lastHapticRef = useRef(0);

  useEffect(() => {
    (async () => {
      const lt = await AsyncStorage.getItem('userLat');
      const ln = await AsyncStorage.getItem('userLng');
      // Explicit null checks — a stored coordinate of "0" is valid.
      if (lt != null && ln != null) {
        const lat = Number(lt), lng = Number(ln);
        setCity({ lat, lng });
        setQiblaBearing(bearingTo(lat, lng));
      }
    })();
  }, []);

  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    (async () => {
      try {
        // watchHeadingAsync uses the OS's own sensor-fused compass (accelerometer +
        // magnetometer, tilt-compensated) — critically, it works held upright the
        // way anyone actually checks Qibla, unlike a raw atan2(y, x) over the flat
        // magnetometer vector, which only reads correctly lying flat on a table.
        // trueHeading is also already magnetic-declination-corrected, matching the
        // true-north Qibla bearing computed above (magHeading is not).
        sub = await Location.watchHeadingAsync(({ trueHeading, magHeading, accuracy }) => {
          if (cancelled) return;
          const h = trueHeading >= 0 ? trueHeading : magHeading;
          // Smooth — exponential filter on shortest angular path
          const prev = lastHeadingRef.current;
          let delta = ((h - prev + 540) % 360) - 180;
          const smoothed = (prev + delta * 0.18 + 360) % 360;
          lastHeadingRef.current = smoothed;
          setHeading(smoothed);
          setAvailable(accuracy > 0);
        });
      } catch (e) {
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
      try { sub?.remove(); } catch {}
    };
  }, []);

  // Rotate the compass dial so that the user's current heading is at the top
  useEffect(() => {
    if (heading == null) return;
    Animated.timing(rot, {
      toValue: -heading,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [heading, rot]);

  // Haptic when aligned with Qibla (within 5°)
  useEffect(() => {
    if (heading == null || qiblaBearing == null) return;
    const diff = Math.abs(((qiblaBearing - heading + 540) % 360) - 180);
    if (diff < 4 && Date.now() - lastHapticRef.current > 2000) {
      lastHapticRef.current = Date.now();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [heading, qiblaBearing]);

  const rotateDial = rot.interpolate({ inputRange: [-360, 0], outputRange: ['-360deg', '0deg'] });

  return (
    <View style={styles.root} testID="qibla-sheet">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t.qiblaEyebrow} · القبلة</Text>
        <Text style={styles.title}>{t.qiblaTitle}</Text>
        <Text style={styles.sub}>
          {city
            ? `${qiblaBearing != null ? Math.round(qiblaBearing) : '—'}° from true north`
            : t.qiblaWaiting}
        </Text>
      </View>

      <View style={styles.compassWrap}>
        {/* fixed pointer up */}
        <View style={[styles.pointerLayer, { pointerEvents: 'none' }]}>
          <View style={styles.pointer} />
        </View>

        <Animated.View style={[styles.dial, { transform: [{ rotate: rotateDial }] }]}>
          <Svg width={300} height={300} viewBox="0 0 300 300">
            <Circle cx="150" cy="150" r="140" stroke={Colors.borderSubtle} strokeWidth={1} fill="none" />
            <Circle cx="150" cy="150" r="120" stroke={Colors.borderAccent} strokeWidth={1} fill="none" />
            {/* Tick marks every 15° */}
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * 15 * Math.PI) / 180;
              const x1 = 150 + Math.sin(angle) * 130;
              const y1 = 150 - Math.cos(angle) * 130;
              const x2 = 150 + Math.sin(angle) * (i % 6 === 0 ? 110 : 120);
              const y2 = 150 - Math.cos(angle) * (i % 6 === 0 ? 110 : 120);
              return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 6 === 0 ? Colors.gold : Colors.textDim} strokeWidth={i % 6 === 0 ? 1.5 : 0.5} opacity={i % 6 === 0 ? 0.9 : 0.4} />;
            })}
            <SvgText x="150" y="30" fill={Colors.gold} fontSize="14" fontWeight="600" textAnchor="middle">N</SvgText>
            <SvgText x="275" y="155" fill={Colors.textDim} fontSize="11" textAnchor="middle">E</SvgText>
            <SvgText x="150" y="282" fill={Colors.textDim} fontSize="11" textAnchor="middle">S</SvgText>
            <SvgText x="25" y="155" fill={Colors.textDim} fontSize="11" textAnchor="middle">W</SvgText>

            {/* Qibla marker — rotates with the dial since dial is absolute angles */}
            {qiblaBearing != null && (
              <G transform={`rotate(${qiblaBearing}, 150, 150)`}>
                <Line x1="150" y1="150" x2="150" y2="30" stroke={Colors.gold} strokeWidth={2} />
                <Path d="M 150 22 L 142 38 L 158 38 Z" fill={Colors.gold} />
                <SvgText x="150" y="18" fill={Colors.gold} fontSize="10" fontWeight="700" textAnchor="middle">كعبة</SvgText>
              </G>
            )}
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.legend}>
        {available === false && (
          <Text style={styles.warn}>
            Compass not available on this device. The needle is shown for reference only — the Qibla bearing is correct.
          </Text>
        )}
        {available === null && <ActivityIndicator color={Colors.gold} />}
        {available && (
          <Text style={styles.legendLine}>
            Align the golden marker with the steady pointer at the top.
          </Text>
        )}
        {city && qiblaBearing != null && (
          <Text style={styles.legendLine}>
            From {city.lat.toFixed(2)}°, {city.lng.toFixed(2)}°  ·  Bearing {Math.round(qiblaBearing)}°
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, alignItems: 'center' },
  header: { alignSelf: 'stretch', marginBottom: Spacing.md },
  eyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.6, color: Colors.goldMuted, textTransform: 'uppercase' },
  title: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary, marginTop: Spacing.sm },
  sub: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  compassWrap: {
    width: 320, height: 320, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  pointerLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, zIndex: 10,
  },
  pointer: {
    width: 4, height: 18, backgroundColor: Colors.textPrimary, borderRadius: 2,
  },
  dial: { width: 300, height: 300 },
  legend: { marginTop: Spacing.lg, alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md },
  warn: { fontFamily: Fonts.displayItalic, fontSize: 12, color: Colors.textDim, textAlign: 'center', lineHeight: 18 },
  legendLine: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.6, color: Colors.textDim, textAlign: 'center' },
});
