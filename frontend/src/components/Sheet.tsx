import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing } from '../theme';
import { SPRINGS } from '../motion';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
  height?: number;
};

const { height: SCREEN_H } = Dimensions.get('window');

// Drag past this fraction of the sheet's height — or flick faster than this —
// and we dismiss instead of springing back.
const DISMISS_DISTANCE_FRAC = 0.26;
const DISMISS_VELOCITY = 850;
const EXIT_MS = 260;

export default function Sheet({ visible, onClose, children, testID, height }: Props) {
  // Stays mounted through the exit animation, so closing slides down rather
  // than snapping away. Unmounts only once the sheet is fully off-screen.
  const [mounted, setMounted] = useState(visible);

  const targetH = height ?? SCREEN_H * 0.88;
  const HIDDEN = targetH + 60; // fully off-screen resting point

  const y = useSharedValue(HIDDEN); // 0 = open, HIDDEN = gone
  const dragStart = useSharedValue(0);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Slide + settle up. If we were mid-exit, this cleanly reverses it.
      y.value = withSpring(0, SPRINGS.settle);
    } else if (mounted) {
      y.value = withTiming(HIDDEN, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Handle-only drag: attaching the gesture to the grab handle (not the whole
  // sheet) keeps each sheet's inner ScrollView/FlatList free of conflict.
  const pan = Gesture.Pan()
    .onStart(() => {
      dragStart.value = y.value;
    })
    .onUpdate((e) => {
      // Only downward travel; a touch of rubber-banding above the open point.
      const next = dragStart.value + e.translationY;
      y.value = next < 0 ? next * 0.25 : next;
    })
    .onEnd((e) => {
      if (e.translationY > targetH * DISMISS_DISTANCE_FRAC || e.velocityY > DISMISS_VELOCITY) {
        // Let the parent flip `visible` → our effect animates out + unmounts.
        runOnJS(onClose)();
      } else {
        y.value = withSpring(0, SPRINGS.tactile);
      }
    });

  const sheetStyle = useAnimatedStyle(() => {
    const scale = interpolate(y.value, [0, HIDDEN], [1, 0.96], Extrapolation.CLAMP);
    return { transform: [{ translateY: y.value }, { scale }] };
  });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, HIDDEN], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* A RN Modal portals outside the app-root GestureHandlerRootView, so the
          handle drag needs its own root here or the gesture never fires on native. */}
      <GestureHandlerRootView style={styles.root} testID={testID}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          style={StyleSheet.absoluteFill}
        >
          <Animated.View style={[styles.overlay, overlayStyle]} />
        </Pressable>

        <Animated.View style={[styles.sheet, { height: targetH }, sheetStyle]}>
          {/* Top gold hairline */}
          <View style={styles.topGlow} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
              <GestureDetector gesture={pan}>
                <View style={styles.handleWrap}>
                  <View style={styles.handle} />
                </View>
              </GestureDetector>
              {children}
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  topGlow: {
    height: 1,
    backgroundColor: Colors.gold,
    opacity: 0.5,
  },
  // Bigger touch target than the visible bar so the handle is easy to grab.
  handleWrap: { alignItems: 'center', paddingTop: Spacing.sm + 2, paddingBottom: Spacing.sm + 4 },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.goldMuted,
    opacity: 0.6,
  },
});
