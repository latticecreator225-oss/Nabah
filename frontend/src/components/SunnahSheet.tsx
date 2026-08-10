import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Pressable, Animated, Platform, LayoutAnimation, UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { API } from '../api';
import { logError } from '../log';
import { CheckIcon, ChevronDown, ChevronRight } from './Icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Sunnah = {
  id: string; title: string; category: string; trigger: string;
  rarity: 'common' | 'uncommon' | 'highly_forgotten';
  hadith_text: string; hadith_source: string; why_ordained: string;
  demographic: string; revived_today?: boolean;
};
type Cat = { id: string; title: string; subtitle: string; monogram: string; count: number };
type Highlight = {
  id: string; rank: string; title: string; subtitle: string;
  ar: string; body: string; source: string; cta: string;
};

type SunnahView = 'dashboard' | 'library' | 'category';

export default function SunnahSheetBody() {
  const [view, setView] = useState<SunnahView>('dashboard');
  const [hero, setHero] = useState<Sunnah | null>(null);
  const [carousel, setCarousel] = useState<Sunnah[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [items, setItems] = useState<Sunnah[]>([]);
  const [activeCat, setActiveCat] = useState<Cat | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem('userId');
      const nm = (await AsyncStorage.getItem('userName')) || '';
      setUserId(uid);
      setUserName(nm);
      const hour = new Date().getHours();
      try {
        const [heroR, catsR, perR, hlR] = await Promise.all([
          fetch(`${API}/sunnahs/of-the-hour?hour=${hour}`).then((r) => r.json()),
          fetch(`${API}/sunnahs/categories`).then((r) => r.json()),
          fetch(`${API}/sunnahs?demographic=household${uid ? `&user_id=${uid}` : ''}`).then((r) => r.json()),
          fetch(`${API}/hijri-highlight`).then((r) => r.json()).catch(() => ({ highlight: null })),
        ]);
        setHero(heroR);
        setCategories(catsR);
        const shuffled = [...perR].sort(() => Math.random() - 0.5).slice(0, 6);
        setCarousel(shuffled);
        if (hlR?.highlight) setHighlight(hlR.highlight as Highlight);
      } catch (e) {
        logError('sunnah.load', e);
        setError(true);
      }
      setLoading(false);
    })();
  }, []);

  const openCategory = async (c: Cat) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setActiveCat(c);
    setView('category');
    try {
      const list = await fetch(`${API}/sunnahs?category=${c.id}${userId ? `&user_id=${userId}` : ''}`).then((r) => r.json());
      setItems(list);
    } catch (e) {
      logError('sunnah.openCategory', e);
    }
  };

  const toggleRevive = async (s: Sunnah, listSetter: (fn: any) => void) => {
    if (!userId) return;
    const newRevived = !s.revived_today;
    listSetter((prev: Sunnah[]) =>
      prev.map((x) => (x.id === s.id ? { ...x, revived_today: newRevived } : x)),
    );
    if (s === hero) setHero({ ...s, revived_today: newRevived });
    if (Platform.OS !== 'web') {
      if (newRevived) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.selectionAsync().catch(() => {});
    }
    fetch(`${API}/sunnahs/revive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, sunnah_id: s.id, revived: newRevived }),
    }).catch((e) => logError('sunnah.revive', e));
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>;

  if (error && !hero && categories.length === 0) {
    return (
      <View style={styles.loading} testID="sunnah-error">
        <Text style={styles.errorAr}>تعذّر</Text>
        <Text style={styles.errorTxt}>We couldn't load the Sunnah library.</Text>
        <Text style={styles.errorTxt}>Please check your connection and reopen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="sunnah-sheet">
      {/* Top nav */}
      <View style={styles.topNav}>
        <Text style={styles.eyebrow}>SUNNAH COMPENDIUM  ·  السنة</Text>
        <View style={styles.navTabs}>
          {(['dashboard', 'library'] as SunnahView[]).map((v) => (
            <TouchableOpacity key={v} onPress={() => { setActiveCat(null); setView(v); }}>
              <Text style={[styles.navTab, view === v && styles.navTabActive]}>
                {v === 'dashboard' ? 'Daily Revival' : 'Library'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }} showsVerticalScrollIndicator={false}>
        {view === 'dashboard' && (
          <>
            {highlight && <HighlightBanner h={highlight} />}
            <Text style={styles.greeting}>
              Peace upon you{userName ? <Text style={styles.greetingName}>, {userName}</Text> : null}.
            </Text>
            <Text style={styles.greetingSub}>A Sunnah for the hour you are in.</Text>

            {hero && (
              <SunnahCard
                sunnah={hero}
                onRevive={() => toggleRevive(hero, (fn) => setHero((s) => fn([s as Sunnah])[0]))}
                isHero
              />
            )}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>For the Household</Text>
              <View style={styles.sectionLine} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {carousel.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => { setItems([s]); setActiveCat({ id: s.category, title: s.title, subtitle: '', monogram: '·', count: 1 }); setView('category'); }}
                  style={styles.cCard}
                >
                  <RarityPill rarity={s.rarity} />
                  <Text style={styles.cTitle} numberOfLines={2}>{s.title}</Text>
                  <Text style={styles.cTrigger} numberOfLines={1}>{s.trigger}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {view === 'library' && (
          <View style={styles.grid}>
            {categories.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => openCategory(c)} style={styles.catTile} activeOpacity={0.85}>
                <View style={styles.monoCircle}>
                  <Text style={styles.monoChar}>{c.monogram}</Text>
                </View>
                <Text style={styles.catTitle}>{c.title}</Text>
                <Text style={styles.catSub}>{c.subtitle}</Text>
                <Text style={styles.catCount}>{c.count} sunnahs</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {view === 'category' && activeCat && (
          <>
            <View style={styles.catHead}>
              <TouchableOpacity onPress={() => setView('library')}>
                <Text style={styles.backLink}>‹ All categories</Text>
              </TouchableOpacity>
              <Text style={styles.catHeading}>{activeCat.title}</Text>
              <Text style={styles.catSubHeading}>{activeCat.subtitle}</Text>
            </View>
            {items.map((s) => (
              <SunnahCard key={s.id} sunnah={s} onRevive={() => toggleRevive(s, setItems)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RarityPill({ rarity }: { rarity: Sunnah['rarity'] }) {
  const labels: Record<string, string> = {
    common: 'COMMON',
    uncommon: 'UNCOMMON',
    highly_forgotten: 'HIGHLY FORGOTTEN',
  };
  const opacity = rarity === 'common' ? 0.35 : rarity === 'uncommon' ? 0.6 : 1;
  return (
    <View style={[styles.rarityPill, { borderColor: `rgba(201,163,85,${opacity})` }]}>
      <Text style={[styles.rarityText, { color: `rgba(201,163,85,${Math.max(0.7, opacity)})` }]}>
        {labels[rarity]}
      </Text>
    </View>
  );
}

function SunnahCard({ sunnah, onRevive, isHero }: { sunnah: Sunnah; onRevive: () => void; isHero?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const stamp = useRef(new Animated.Value(sunnah.revived_today ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(stamp, {
      toValue: sunnah.revived_today ? 1 : 0,
      damping: 14, stiffness: 200, useNativeDriver: true,
    }).start();
    if (sunnah.revived_today) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [sunnah.revived_today, scale, stamp]);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(280, 'easeInEaseOut', 'opacity'));
    setExpanded((e) => !e);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Animated.View
      style={[
        styles.sCard,
        isHero && styles.sCardHero,
        sunnah.revived_today && styles.sCardDone,
        { transform: [{ scale }] },
      ]}
      testID={`sunnah-card-${sunnah.id}`}
    >
      {isHero && <Text style={styles.heroLabel}>SUNNAH OF THE HOUR</Text>}
      <View style={styles.cardTopRow}>
        <RarityPill rarity={sunnah.rarity} />
        <Animated.View
          style={[
            styles.stamp,
            { opacity: stamp, transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        >
          <CheckIcon size={14} color={Colors.bgPrimary} />
        </Animated.View>
      </View>
      <Text style={styles.sTitle}>{sunnah.title}</Text>
      <Text style={styles.sTrigger}>Trigger: {sunnah.trigger}</Text>

      <View style={styles.blockquote}>
        <View style={styles.blockBar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bqText}>“{sunnah.hadith_text}”</Text>
          <Text style={styles.bqSource}>— {sunnah.hadith_source}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={toggleExpand} style={styles.expandHead} testID={`sunnah-expand-${sunnah.id}`}>
        <Text style={styles.expandLabel}>Why it was ordained</Text>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </TouchableOpacity>
      {expanded && <Text style={styles.expandBody}>{sunnah.why_ordained}</Text>}

      <TouchableOpacity
        onLongPress={onRevive}
        onPress={onRevive}
        delayLongPress={400}
        style={[styles.reviveBtn, sunnah.revived_today && styles.reviveBtnDone]}
        testID={`sunnah-revive-${sunnah.id}`}
        activeOpacity={0.85}
      >
        <Text style={[styles.reviveText, sunnah.revived_today && { color: Colors.bgPrimary }]}>
          {sunnah.revived_today ? '✓ REVIVED TODAY' : 'MARK AS REVIVED'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function HighlightBanner({ h }: { h: Highlight }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, damping: 18, stiffness: 140, useNativeDriver: true }),
    ]).start();
  }, [opacity, slide]);
  return (
    <Animated.View
      style={[
        hlStyles.banner,
        { opacity, transform: [{ translateY: slide }] },
      ]}
      testID={`hijri-highlight-${h.id}`}
    >
      <View style={hlStyles.glow} />
      <View style={hlStyles.headRow}>
        <Text style={hlStyles.rank}>{h.rank}</Text>
        <Text style={hlStyles.ar}>{h.ar}</Text>
      </View>
      <Text style={hlStyles.title}>{h.title}</Text>
      <Text style={hlStyles.subtitle}>{h.subtitle}</Text>
      <Text style={hlStyles.body}>{h.body}</Text>
      <View style={hlStyles.footer}>
        <Text style={hlStyles.source}>— {h.source}</Text>
        <View style={hlStyles.ctaWrap}>
          <Text style={hlStyles.ctaText}>{h.cta}</Text>
          <Text style={hlStyles.ctaArrow}>›</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const hlStyles = StyleSheet.create({
  banner: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.gold,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: Colors.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 22 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  glow: {
    position: 'absolute',
    top: -60, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.gold, opacity: 0.08,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rank: {
    fontFamily: Fonts.label, fontSize: 9, letterSpacing: 2.6, color: Colors.gold,
  },
  ar: { fontFamily: Fonts.arabic, fontSize: 16, color: Colors.gold, lineHeight: 22 },
  title: { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary, marginTop: 8, lineHeight: 30 },
  subtitle: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.goldMuted, marginTop: 2 },
  body: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 21, marginTop: Spacing.md },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  source: { fontFamily: Fonts.bodySemi, fontSize: 11, color: Colors.gold, letterSpacing: 0.3 },
  ctaWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaText: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.8, color: Colors.gold, textTransform: 'uppercase' },
  ctaArrow: { fontFamily: Fonts.display, fontSize: 18, color: Colors.gold, lineHeight: 18 },
});

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  errorAr: { fontFamily: Fonts.arabic, fontSize: 26, color: Colors.goldMuted },
  errorTxt: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textDim, textAlign: 'center' },
  topNav: { marginBottom: Spacing.md },
  eyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.6, color: Colors.textDim, textTransform: 'uppercase' },
  navTabs: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  navTab: {
    fontFamily: Fonts.displayBold, fontSize: 18, color: Colors.textDim,
    paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'transparent',
  },
  navTabActive: { color: Colors.textPrimary, borderBottomColor: Colors.gold },
  greeting: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary, marginTop: Spacing.sm },
  greetingName: { fontFamily: Fonts.displayItalic, color: Colors.gold },
  greetingSub: { fontFamily: Fonts.displayItalic, fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.displayBold, fontSize: 16, color: Colors.textPrimary, letterSpacing: 0.5 },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.borderSubtle },
  carousel: { gap: Spacing.sm, paddingRight: Spacing.lg },
  cCard: {
    width: 200, padding: Spacing.md, borderRadius: Radius.lg,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle, gap: 8,
  },
  cTitle: { fontFamily: Fonts.displayBold, fontSize: 15, color: Colors.textPrimary, lineHeight: 20 },
  cTrigger: { fontFamily: Fonts.body, fontStyle: 'italic', fontSize: 11, color: Colors.textDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: Spacing.sm },
  catTile: {
    width: '48.5%', padding: Spacing.md, marginBottom: Spacing.sm, minHeight: 130,
    borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  monoCircle: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  monoChar: { fontFamily: Fonts.arabic, fontSize: 17, color: Colors.gold, lineHeight: 22 },
  catTitle: { fontFamily: Fonts.displayBold, fontSize: 15, color: Colors.textPrimary, marginTop: 2 },
  catSub: { fontFamily: Fonts.arabic, fontSize: 13, color: Colors.goldMuted, marginTop: 2 },
  catCount: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1.6, color: Colors.textDim, marginTop: 8, textTransform: 'uppercase' },
  catHead: { marginBottom: Spacing.md },
  backLink: { fontFamily: Fonts.label, fontSize: 11, letterSpacing: 1.6, color: Colors.goldMuted, marginBottom: 6 },
  catHeading: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary },
  catSubHeading: { fontFamily: Fonts.arabic, fontSize: 16, color: Colors.gold, marginTop: 2 },

  sCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: Radius.xl, padding: Spacing.md + 4, marginBottom: Spacing.md,
  },
  sCardHero: {
    borderColor: Colors.borderAccent,
    ...Platform.select({
      ios: { shadowColor: Colors.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 18 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  sCardDone: { borderColor: Colors.gold },
  heroLabel: {
    fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.5, color: Colors.gold, marginBottom: 8,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rarityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  rarityText: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1.6 },
  stamp: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sTitle: { fontFamily: Fonts.displayBold, fontSize: 19, color: Colors.textPrimary, marginTop: Spacing.sm, lineHeight: 24 },
  sTrigger: { fontFamily: Fonts.body, fontStyle: 'italic', fontSize: 12, color: Colors.textDim, marginTop: 4 },
  blockquote: { flexDirection: 'row', gap: 12, marginTop: Spacing.md, paddingVertical: Spacing.sm },
  blockBar: { width: 1.5, backgroundColor: Colors.gold, opacity: 0.5, borderRadius: 1 },
  bqText: { fontFamily: Fonts.displayItalic, fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
  bqSource: { fontFamily: Fonts.bodySemi, fontSize: 11, color: Colors.gold, marginTop: 6, textAlign: 'right', letterSpacing: 0.4 },
  expandHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, marginTop: Spacing.sm,
  },
  expandLabel: { fontFamily: Fonts.label, fontSize: 11, letterSpacing: 1.8, color: Colors.goldMuted, textTransform: 'uppercase' },
  expandBody: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 20, paddingBottom: Spacing.sm },
  reviveBtn: {
    marginTop: Spacing.sm, paddingVertical: 12, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderAccent, alignItems: 'center',
  },
  reviveBtnDone: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  reviveText: { fontFamily: Fonts.bodySemi, fontSize: 11, letterSpacing: 2.2, color: Colors.gold },
});
