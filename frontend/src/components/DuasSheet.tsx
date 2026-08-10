import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Platform, Share, LayoutAnimation, UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { api, DuaCategory, DuaCategoryDetail, Dua } from '../api';
import { logError } from '../log';
import { FadeInUp } from '../motion';
import { HeartIcon, ShareIcon } from './Icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAV_KEY = 'duaFavorites';

export default function DuasSheetBody() {
  const [categories, setCategories] = useState<DuaCategory[]>([]);
  const [active, setActive] = useState<DuaCategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingCat, setLoadingCat] = useState(false);
  const [showTranslit, setShowTranslit] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const favRaw = await AsyncStorage.getItem(FAV_KEY);
        if (favRaw) setFavorites(new Set<string>(JSON.parse(favRaw)));
      } catch (e) { logError('duas.favLoad', e); }
      try {
        const cats = await api.duaCategories();
        setCategories(cats);
      } catch (e) {
        logError('duas.categories', e);
        setError(true);
      }
      setLoading(false);
    })();
  }, []);

  const haptic = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

  const openCategory = async (id: string) => {
    haptic();
    LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
    setLoadingCat(true);
    setActive(null);
    try {
      const detail = await api.duaCategory(id);
      setActive(detail);
    } catch (e) {
      logError('duas.openCategory', e);
    }
    setLoadingCat(false);
  };

  const back = () => {
    haptic();
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setActive(null);
  };

  const toggleFav = (id: string) => {
    const next = new Set(favorites);
    const adding = !next.has(id);
    if (adding) next.add(id); else next.delete(id);
    setFavorites(next);
    if (Platform.OS !== 'web') {
      if (adding) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.selectionAsync().catch(() => {});
    }
    AsyncStorage.setItem(FAV_KEY, JSON.stringify(Array.from(next))).catch((e) => logError('duas.favSave', e));
  };

  const shareDua = async (d: Dua) => {
    try {
      await Share.share({
        message: `${d.arabic}\n\n${d.transliteration}\n\n“${d.translation}”\n— ${d.reference}\n\nvia Nabah`,
      });
    } catch (e) { logError('duas.share', e); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>;

  if (error && categories.length === 0) {
    return (
      <View style={styles.loading} testID="duas-error">
        <Text style={styles.errorAr}>تعذّر</Text>
        <Text style={styles.errorTxt}>Could not load the duas.</Text>
        <Text style={styles.errorTxt}>Check your connection and reopen.</Text>
      </View>
    );
  }

  // ── Category detail ──
  if (active || loadingCat) {
    return (
      <View style={styles.root} testID="duas-category">
        <View style={styles.catHead}>
          <TouchableOpacity onPress={back} testID="duas-back">
            <Text style={styles.backLink}>‹ All collections</Text>
          </TouchableOpacity>
          {active && (
            <View style={styles.catHeadRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.catHeading}>{active.title}</Text>
                <Text style={styles.catHeadingAr}>{active.subtitle}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { haptic(); setShowTranslit((s) => !s); }}
                style={[styles.pillBtn, showTranslit && styles.pillBtnActive]}
              >
                <Text style={[styles.pillBtnText, showTranslit && { color: Colors.gold }]}>Aa</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loadingCat || !active ? (
          <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }} showsVerticalScrollIndicator={false}>
            {active.blurb ? <Text style={styles.catBlurb}>{active.blurb}</Text> : null}
            {active.duas.map((d, idx) => (
              <View key={d.id} style={styles.duaCard} testID={`dua-${d.id}`}>
                <View style={styles.duaTopRow}>
                  <Text style={styles.duaIndex}>{String(idx + 1).padStart(2, '0')}</Text>
                  {d.count ? (
                    <View style={styles.countPill}><Text style={styles.countPillText}>× {d.count}</Text></View>
                  ) : null}
                </View>
                <Text style={styles.duaAr} selectable>{d.arabic}</Text>
                {showTranslit && d.transliteration ? (
                  <Text style={styles.duaTranslit} selectable>{d.transliteration}</Text>
                ) : null}
                <View style={styles.hairline} />
                <Text style={styles.duaEn} selectable>{d.translation}</Text>
                {d.virtue ? <Text style={styles.duaVirtue}>{d.virtue}</Text> : null}
                <View style={styles.duaFooter}>
                  <Text style={styles.duaRef}>{d.reference}</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => toggleFav(d.id)} style={styles.actionBtn} testID={`dua-fav-${d.id}`}>
                    <HeartIcon size={17} color={favorites.has(d.id) ? Colors.gold : Colors.goldMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => shareDua(d)} style={styles.actionBtn} testID={`dua-share-${d.id}`}>
                    <ShareIcon size={16} color={Colors.goldMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Category grid ──
  return (
    <View style={styles.root} testID="duas-sheet">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>الأدعية  ·  SUPPLICATIONS</Text>
        <Text style={styles.title}>The Fortress of Duas</Text>
        <Text style={styles.subtitle}>Authentic words for the moments of your day.</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {categories.map((c, i) => (
            <FadeInUp key={c.id} delay={80 + i * 55} style={styles.gridCell}>
              <TouchableOpacity
                onPress={() => openCategory(c.id)}
                style={styles.catTile}
                activeOpacity={0.85}
                testID={`dua-cat-${c.id}`}
              >
                <View style={styles.monoCircle}>
                  <Text style={styles.monoChar}>{c.monogram}</Text>
                </View>
                <Text style={styles.catTitle}>{c.title}</Text>
                <Text style={styles.catSub}>{c.subtitle}</Text>
                <Text style={styles.catCount}>{c.count} {c.count === 1 ? 'dua' : 'duas'}</Text>
              </TouchableOpacity>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  errorAr: { fontFamily: Fonts.arabic, fontSize: 26, color: Colors.goldMuted },
  errorTxt: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textDim, textAlign: 'center' },

  header: { marginBottom: Spacing.md },
  eyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.6, color: Colors.textDim, textTransform: 'uppercase' },
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginTop: 6 },
  subtitle: { fontFamily: Fonts.displayItalic, fontSize: 14, color: Colors.textSecondary, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: Spacing.sm },
  gridCell: { width: '48.5%', marginBottom: Spacing.sm },
  catTile: {
    width: '100%', padding: Spacing.md, minHeight: 132,
    borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  monoCircle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  monoChar: { fontFamily: Fonts.arabic, fontSize: 19, color: Colors.gold, lineHeight: 26 },
  catTitle: { fontFamily: Fonts.displayBold, fontSize: 16, color: Colors.textPrimary, marginTop: 2 },
  catSub: { fontFamily: Fonts.arabic, fontSize: 14, color: Colors.goldMuted, marginTop: 2 },
  catCount: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1.6, color: Colors.textDim, marginTop: 8, textTransform: 'uppercase' },

  // Detail
  catHead: { marginBottom: Spacing.sm },
  backLink: { fontFamily: Fonts.label, fontSize: 11, letterSpacing: 1.6, color: Colors.goldMuted, marginBottom: 8, textTransform: 'uppercase' },
  catHeadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catHeading: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary },
  catHeadingAr: { fontFamily: Fonts.arabic, fontSize: 16, color: Colors.gold, marginTop: 2 },
  pillBtn: { width: 38, height: 32, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSubtle },
  pillBtnActive: { borderColor: Colors.gold, backgroundColor: Colors.hover },
  pillBtnText: { fontFamily: Fonts.displayBold, fontSize: 14, color: Colors.textSecondary },
  catBlurb: { fontFamily: Fonts.displayItalic, fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 22 },

  duaCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: Radius.xl, padding: Spacing.md + 2, marginBottom: Spacing.sm + 2,
  },
  duaTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  duaIndex: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.6, color: Colors.textDim },
  countPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderAccent },
  countPillText: { fontFamily: Fonts.bodyMedium, color: Colors.goldMuted, fontSize: 10, letterSpacing: 1.2 },
  duaAr: { fontFamily: Fonts.arabic, fontSize: 25, color: Colors.textPrimary, lineHeight: 48, textAlign: 'right' },
  duaTranslit: { fontFamily: Fonts.body, fontStyle: 'italic', fontSize: 13, color: Colors.textDim, marginTop: Spacing.sm, lineHeight: 22 },
  hairline: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: Spacing.sm + 2 },
  duaEn: { fontFamily: Fonts.body, fontSize: 13.5, color: Colors.textSecondary, lineHeight: 22 },
  duaVirtue: { fontFamily: Fonts.displayItalic, fontSize: 12.5, color: Colors.goldMuted, marginTop: Spacing.sm, lineHeight: 20 },
  duaFooter: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.xs },
  duaRef: { fontFamily: Fonts.label, fontSize: 9.5, letterSpacing: 0.8, color: Colors.textDim, flexShrink: 1, textTransform: 'uppercase' },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
