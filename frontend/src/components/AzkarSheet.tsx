import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { api, AzkarSection } from '../api';
import ProgressRing from './ProgressRing';
import { CheckIcon } from './Icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── The three "absolute essentials" the user asked for ──
type Essential = {
  id: string;            // matches AzkarSection.id from backend
  label: string;         // English label shown on the card
  labelAr: string;       // Arabic label
  monogram: string;      // single Arabic letter for the card mark
  hint: string;          // small caption underneath
  hours: string;         // when to read
};

const ESSENTIALS: Essential[] = [
  {
    id: 'morning',
    label: 'Morning',
    labelAr: 'الصباح',
    monogram: 'ص',
    hint: 'After Fajr until sunrise',
    hours: 'Ṣabāḥ',
  },
  {
    id: 'evening',
    label: 'Evening',
    labelAr: 'المساء',
    monogram: 'م',
    hint: 'After Asr until sunset',
    hours: 'Masāʾ',
  },
  {
    id: 'sleep',
    label: 'Night',
    labelAr: 'النوم',
    monogram: 'ل',
    hint: 'Before you sleep',
    hours: 'al-Nawm',
  },
];

export default function AdhkarSheetBody({ visible }: { visible?: boolean }) {
  const [sections, setSections] = useState<AzkarSection[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null); // null = picker view
  const [showTrans, setShowTrans] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem('userId');
      setUserId(uid);
      try {
        const [secs, prog] = await Promise.all([
          api.azkar(),
          uid ? api.azkarProgress(uid) : Promise.resolve({ completed: [] }),
        ]);
        setSections(secs);
        setCompleted(new Set(prog.completed));
      } catch {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (visible) {
      setActiveId(null);
    }
  }, [visible]);

  // Per-section progress
  const sectionStats = useMemo(() => {
    const stats: Record<string, { done: number; total: number; progress: number }> = {};
    sections.forEach((s) => {
      const total = s.items.length;
      let done = 0;
      s.items.forEach((_, idx) => {
        if (completed.has(`${s.id}:${idx}`)) done++;
      });
      stats[s.id] = { done, total, progress: total > 0 ? done / total : 0 };
    });
    return stats;
  }, [sections, completed]);

  const activeSection = activeId ? sections.find((s) => s.id === activeId) : null;
  const activeStats =
    activeSection && sectionStats[activeSection.id]
      ? sectionStats[activeSection.id]
      : { done: 0, total: 0, progress: 0 };

  const toggleItem = async (sid: string, idx: number) => {
    const key = `${sid}:${idx}`;
    const next = new Set(completed);
    const done = !next.has(key);
    if (done) next.add(key);
    else next.delete(key);
    setCompleted(next);
    if (Platform.OS !== 'web') {
      if (done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.selectionAsync().catch(() => {});
    }
    if (userId) {
      api.setAzkarProgress({ user_id: userId, section_id: sid, item_index: idx, done }).catch(() => {});
    }
  };

  const openSection = (id: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.create(280, 'easeInEaseOut', 'opacity'));
    setActiveId(id);
  };

  const goBackToPicker = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setActiveId(null);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  // ── Picker view ──
  if (!activeSection) {
    return (
      <View style={styles.root} testID="adhkar-picker">
        <View style={styles.pickerHeader}>
          <Text style={styles.eyebrow}>الأذكار  ·  ADHKAR</Text>
          <Text style={styles.pickerTitle}>Which fortress today?</Text>
          <Text style={styles.pickerSub}>
            “The remembrance of Allah is greater.” — al-‘Ankabūt 29:45
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: Spacing.xxl, paddingTop: Spacing.sm }}
          showsVerticalScrollIndicator={false}
        >
          {ESSENTIALS.map((e, i) => {
            const stats = sectionStats[e.id] || { done: 0, total: 0, progress: 0 };
            const complete = stats.total > 0 && stats.done === stats.total;
            return (
              <PickerCard
                key={e.id}
                essential={e}
                stats={stats}
                complete={complete}
                onPress={() => openSection(e.id)}
                testID={`adhkar-card-${e.id}`}
                delay={i * 80}
              />
            );
          })}
          <View style={styles.pickerFooter}>
            <View style={styles.goldHairline} />
            <Text style={styles.brandAr}>نَبَأ</Text>
            <View style={styles.goldHairline} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Section view ──
  return (
    <View style={styles.root} testID="azkar-sheet">
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackToPicker} style={styles.backBtn} testID="adhkar-back">
          <Text style={styles.backChev}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>الأذكار  ·  ADHKAR</Text>
          <Text style={styles.title}>{activeSection.title_en}</Text>
          <Text style={styles.titleAr}>{activeSection.title_ar}</Text>
        </View>
        <View style={styles.ringWrap}>
          <ProgressRing size={84} progress={activeStats.progress} stroke={5} />
          <View style={styles.ringCenter}>
            <Text style={styles.ringDone}>{activeStats.done}</Text>
            <Text style={styles.ringDivider}>—</Text>
            <Text style={styles.ringTotal}>{activeStats.total}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.transToggle}
        onPress={() => setShowTrans((s) => !s)}
        testID="adhkar-transliteration-toggle"
      >
        <Text style={styles.transToggleText}>
          {showTrans ? '— Hide transliteration' : '+ Show transliteration'}
        </Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {activeSection.items.map((it, idx) => {
          const key = `${activeSection.id}:${idx}`;
          const isDone = completed.has(key);
          return (
            <AdhkarItemCard
              key={`${activeSection.id}-${idx}`}
              testID={`adhkar-item-${activeSection.id}-${idx}`}
              index={idx + 1}
              total={activeSection.items.length}
              item={it}
              isDone={isDone}
              showTrans={showTrans}
              onToggle={() => toggleItem(activeSection.id, idx)}
            />
          );
        })}
        {activeStats.done === activeStats.total && activeStats.total > 0 && (
          <View style={styles.completeBanner}>
            <View style={styles.completeLine} />
            <Text style={styles.completeText}>Section complete · taqabbal Allahu minka</Text>
            <View style={styles.completeLine} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Picker card with entrance animation ──
function PickerCard({
  essential,
  stats,
  complete,
  onPress,
  testID,
  delay,
}: {
  essential: Essential;
  stats: { done: number; total: number; progress: number };
  complete: boolean;
  onPress: () => void;
  testID?: string;
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, damping: 18, stiffness: 130, delay, useNativeDriver: true }),
    ]).start();
  }, [opacity, slide, delay]);

  const press = (toValue: number) =>
    Animated.spring(scale, { toValue, damping: 14, stiffness: 220, mass: 0.6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: slide }, { scale }] }}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        style={[pickerStyles.card, complete && pickerStyles.cardDone]}
      >
        <View style={pickerStyles.glow} />
        <View style={[pickerStyles.monoCircle, complete && pickerStyles.monoCircleDone]}>
          <Text style={[pickerStyles.monogram, complete && { color: Colors.bgPrimary }]}>
            {essential.monogram}
          </Text>
        </View>
        <View style={{ flex: 1, paddingHorizontal: Spacing.md }}>
          <Text style={pickerStyles.cardLabel}>{essential.label.toUpperCase()}  ·  {essential.labelAr}</Text>
          <Text style={pickerStyles.cardName}>{essential.hours}</Text>
          <Text style={pickerStyles.cardHint}>{essential.hint}</Text>
          {stats.total > 0 && (
            <View style={pickerStyles.bar}>
              <View
                style={[
                  pickerStyles.barFill,
                  { width: `${Math.round(stats.progress * 100)}%`, backgroundColor: complete ? Colors.gold : Colors.goldMuted },
                ]}
              />
            </View>
          )}
        </View>
        <View style={pickerStyles.rightCol}>
          <Text style={[pickerStyles.count, complete && { color: Colors.gold }]}>
            {stats.done}/{stats.total || '·'}
          </Text>
          <Text style={pickerStyles.chev}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AdhkarItemCard({
  index,
  total,
  item,
  isDone,
  showTrans,
  onToggle,
  testID,
}: {
  index: number;
  total: number;
  item: { arabic: string; transliteration: string; english: string; count: number };
  isDone: boolean;
  showTrans: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const tap = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start();
    onToggle();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        testID={testID}
        onPress={tap}
        activeOpacity={0.92}
        style={[styles.itemCard, isDone && styles.itemCardDone]}
      >
        <View style={styles.itemTopRow}>
          <Text style={styles.itemIndex}>
            {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={[styles.countPill, isDone && { borderColor: Colors.gold }]}>
            <Text style={[styles.countPillText, isDone && { color: Colors.gold }]}>
              × {item.count}
            </Text>
          </View>
          <View style={[styles.checkCircle, isDone && styles.checkCircleDone]}>
            {isDone ? <CheckIcon size={14} color={Colors.bgPrimary} /> : null}
          </View>
        </View>
        <Text style={styles.itemAr} selectable>
          {item.arabic}
        </Text>
        {showTrans && item.transliteration ? (
          <Text style={styles.itemTrans} selectable>
            {item.transliteration}
          </Text>
        ) : null}
        <View style={styles.hairline} />
        <Text style={styles.itemEn} selectable>
          {item.english}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },

  // Picker
  pickerHeader: { marginBottom: Spacing.lg, paddingTop: Spacing.sm },
  pickerTitle: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginTop: Spacing.sm },
  pickerSub: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
  pickerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xl, gap: Spacing.sm,
  },
  goldHairline: { width: 28, height: 1, backgroundColor: Colors.gold, opacity: 0.3 },
  brandAr: { fontFamily: Fonts.arabic, fontSize: 16, color: Colors.goldMuted, lineHeight: 22 },

  // Section view
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSubtle },
  backChev: { fontFamily: Fonts.display, fontSize: 24, color: Colors.gold, lineHeight: 24 },
  eyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.6, color: Colors.textDim, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary, lineHeight: 30 },
  titleAr: { fontFamily: Fonts.arabic, fontSize: 16, color: Colors.gold, marginTop: 2 },
  ringWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringDone: { fontFamily: Fonts.displayBold, fontSize: 20, color: Colors.gold, lineHeight: 22 },
  ringDivider: { fontFamily: Fonts.body, fontSize: 9, color: Colors.textDim, marginVertical: -1 },
  ringTotal: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textSecondary },

  transToggle: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 4 },
  transToggleText: { fontFamily: Fonts.label, color: Colors.goldMuted, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },

  itemCard: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: Radius.xl,
    padding: Spacing.md + 2, marginTop: Spacing.sm + 2,
  },
  itemCardDone: { borderColor: Colors.gold, backgroundColor: Colors.cardActive },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  itemIndex: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.6, color: Colors.textDim },
  countPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.borderAccent,
  },
  countPillText: { fontFamily: Fonts.bodyMedium, color: Colors.goldMuted, fontSize: 10, letterSpacing: 1.2 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  itemAr: { fontFamily: Fonts.arabic, fontSize: 24, color: Colors.textPrimary, lineHeight: 46, textAlign: 'right', flexWrap: 'wrap' },
  // Transliteration MUST be allowed to wrap — give it full width and no truncation
  itemTrans: {
    fontFamily: Fonts.body, fontSize: 13, fontStyle: 'italic',
    color: Colors.textDim, marginTop: 8, lineHeight: 22,
  },
  hairline: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: Spacing.sm + 2 },
  itemEn: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 22 },
  completeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
  completeLine: { flex: 1, height: 1, backgroundColor: Colors.gold, opacity: 0.4 },
  completeText: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2, color: Colors.gold, textTransform: 'uppercase' },
});

const pickerStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14 },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cardDone: { borderColor: Colors.gold },
  glow: {
    position: 'absolute', bottom: -60, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.gold, opacity: 0.05,
  },
  monoCircle: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1, borderColor: Colors.borderAccent,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  monoCircleDone: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  monogram: { fontFamily: Fonts.arabic, fontSize: 28, color: Colors.gold, lineHeight: 36 },
  cardLabel: {
    fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.8,
    color: Colors.goldMuted, textTransform: 'uppercase',
  },
  cardName: { fontFamily: Fonts.displayBold, fontSize: 20, color: Colors.textPrimary, marginTop: 4 },
  cardHint: { fontFamily: Fonts.displayItalic, fontSize: 12, color: Colors.textDim, marginTop: 2 },
  bar: {
    height: 2, backgroundColor: Colors.borderSubtle,
    borderRadius: 2, marginTop: Spacing.md, overflow: 'hidden',
  },
  barFill: { height: 2, backgroundColor: Colors.gold },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  count: { fontFamily: Fonts.label, fontSize: 11, color: Colors.textDim, letterSpacing: 1.2 },
  chev: { fontFamily: Fonts.display, fontSize: 22, color: Colors.gold, lineHeight: 22 },
});
