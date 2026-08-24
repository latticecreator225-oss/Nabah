import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, Platform, Share, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import {
  api, HadithCollection, HadithSection, HadithSectionsResp, HadithItem,
} from '../api';
import { logError } from '../log';
import { useTextScale } from '../textScale';
import { FadeInUp } from '../motion';
import { HeartIcon, ShareIcon, SearchIcon } from './Icons';

const FAV_KEY = 'hadithFavorites';

export default function HadithSheetBody() {
  const ts = useTextScale();
  const [view, setView] = useState<'collections' | 'sections' | 'list'>('collections');
  const [collections, setCollections] = useState<HadithCollection[]>([]);
  const [loadingCols, setLoadingCols] = useState(true);

  const [coll, setColl] = useState<HadithCollection | null>(null);
  const [sections, setSections] = useState<HadithSectionsResp | null>(null);
  const [loadingSections, setLoadingSections] = useState(false);

  const [section, setSection] = useState<HadithSection | null>(null);
  const [items, setItems] = useState<HadithItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const favRaw = await AsyncStorage.getItem(FAV_KEY);
        if (favRaw) setFavorites(new Set<string>(JSON.parse(favRaw)));
      } catch (e) { logError('hadith.favLoad', e); }
      try {
        setCollections(await api.hadithCollections());
      } catch (e) {
        logError('hadith.collections', e);
        setError(true);
      }
      setLoadingCols(false);
    })();
  }, []);

  const haptic = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

  const openCollection = useCallback(async (c: HadithCollection) => {
    haptic();
    setColl(c);
    setView('sections');
    setSections(null);
    setError(false);
    setLoadingSections(true);
    try {
      setSections(await api.hadithSections(c.id));
    } catch (e) {
      logError('hadith.sections', e);
      setError(true);
    }
    setLoadingSections(false);
  }, []);

  const openSection = useCallback(async (c: string, s: HadithSection) => {
    haptic();
    setSection(s);
    setView('list');
    setItems([]);
    setPage(0);
    setError(false);
    setLoadingList(true);
    try {
      const r = await api.hadithList(c, { section: s.number, page: 0, limit: 15 });
      setItems(r.hadiths);
      setHasMore(r.has_more);
    } catch (e) {
      logError('hadith.list', e);
      setError(true);
    }
    setLoadingList(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!coll || !section || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await api.hadithList(coll.id, { section: section.number, page: next, limit: 15 });
      setItems((prev) => [...prev, ...r.hadiths]);
      setPage(next);
      setHasMore(r.has_more);
    } catch (e) {
      logError('hadith.loadMore', e);
    }
    setLoadingMore(false);
  }, [coll, section, page, hasMore, loadingMore]);

  const jumpToNumber = useCallback(async () => {
    const n = parseInt(search.trim(), 10);
    if (!coll || Number.isNaN(n)) return;
    haptic();
    setSection({ number: -1, name: `Narration ${n}`, count: 1 });
    setView('list');
    setItems([]);
    setHasMore(false);
    setError(false);
    setLoadingList(true);
    try {
      const r = await api.hadithList(coll.id, { q: n });
      setItems(r.hadiths);
    } catch (e) {
      logError('hadith.jump', e);
      setError(true);
    }
    setLoadingList(false);
  }, [coll, search]);

  const toggleFav = (c: string, n: number) => {
    const key = `${c}:${n}`;
    const next = new Set(favorites);
    const adding = !next.has(key);
    if (adding) next.add(key); else next.delete(key);
    setFavorites(next);
    if (Platform.OS !== 'web') {
      if (adding) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.selectionAsync().catch(() => {});
    }
    AsyncStorage.setItem(FAV_KEY, JSON.stringify(Array.from(next))).catch((e) => logError('hadith.favSave', e));
  };

  const shareHadith = async (h: HadithItem) => {
    if (!coll) return;
    try {
      await Share.share({
        message: `${h.arabic}\n\n${h.english}\n\n— ${coll.name} ${h.number} · ${h.grade}\n\nvia Nabah`,
      });
    } catch (e) { logError('hadith.share', e); }
  };

  // ── Collections ──
  if (view === 'collections') {
    return (
      <View style={styles.root} testID="hadith-sheet">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>الصحيحان  ·  THE TWO SAHIHS</Text>
          <Text style={styles.title}>Authentic Hadith</Text>
          <Text style={styles.subtitle}>Bukhari & Muslim, in full — every narration Ṣaḥīḥ.</Text>
        </View>
        {loadingCols ? (
          <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>
        ) : error && collections.length === 0 ? (
          <View style={styles.loading}>
            <Text style={styles.errorAr}>تعذّر</Text>
            <Text style={styles.errorTxt}>Could not load the collections.</Text>
          </View>
        ) : (
          <View style={{ paddingTop: Spacing.sm }}>
            {collections.map((c, i) => (
              <FadeInUp key={c.id} delay={60 + i * 80}>
                <TouchableOpacity
                  onPress={() => openCollection(c)}
                  style={styles.collCard}
                  activeOpacity={0.9}
                  testID={`hadith-coll-${c.id}`}
                >
                  <View style={styles.collGlow} />
                  <View style={styles.collHead}>
                    <Text style={styles.collEyebrow}>{c.authority.toUpperCase()}</Text>
                    <Text style={styles.collAr}>{c.name_ar}</Text>
                  </View>
                  <Text style={styles.collName}>{c.name}</Text>
                  <Text style={styles.collBlurb}>{c.blurb}</Text>
                  <View style={styles.collFooter}>
                    <View style={styles.sahihPill}><Text style={styles.sahihPillText}>ṢAḤĪḤ</Text></View>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.collArrow}>›</Text>
                  </View>
                </TouchableOpacity>
              </FadeInUp>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── Sections (books) ──
  if (view === 'sections') {
    return (
      <View style={styles.root} testID="hadith-sections">
        <View style={styles.subHead}>
          <TouchableOpacity onPress={() => { haptic(); setView('collections'); }} testID="hadith-back-collections">
            <Text style={styles.backLink}>‹ Collections</Text>
          </TouchableOpacity>
          <Text style={styles.subHeading}>{coll?.name}</Text>
          <Text style={styles.subHeadingAr}>{coll?.name_ar}</Text>
        </View>

        {loadingSections ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.gold} />
            <Text style={styles.loadingNote}>Loading {coll?.name} — happens once.</Text>
          </View>
        ) : error || !sections ? (
          <View style={styles.loading}>
            <Text style={styles.errorAr}>تعذّر</Text>
            <Text style={styles.errorTxt}>Could not load this collection.</Text>
            <TouchableOpacity onPress={() => coll && openCollection(coll)} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={sections.sections}
            keyExtractor={(s) => String(s.number)}
            contentContainerStyle={{ paddingBottom: Spacing.xxl }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View>
                <View style={styles.searchWrap}>
                  <SearchIcon size={16} color={Colors.textDim} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Jump to narration number…"
                    placeholderTextColor={Colors.textDim}
                    keyboardType="number-pad"
                    returnKeyType="go"
                    onSubmitEditing={jumpToNumber}
                    style={styles.searchInput}
                    testID="hadith-search"
                  />
                  {search ? (
                    <TouchableOpacity onPress={jumpToNumber}><Text style={styles.goText}>Go</Text></TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.totalNote}>{sections.total.toLocaleString()} narrations · {sections.sections.length} books</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.bookRow}
                onPress={() => coll && openSection(coll.id, item)}
                activeOpacity={0.8}
                testID={`hadith-book-${item.number}`}
              >
                <View style={styles.bookNum}><Text style={styles.bookNumText}>{item.number}</Text></View>
                <Text style={styles.bookName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.bookCount}>{item.count}</Text>
                <Text style={styles.bookChev}>›</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── Hadith list ──
  return (
    <View style={styles.root} testID="hadith-list">
      <View style={styles.subHead}>
        <TouchableOpacity onPress={() => { haptic(); setView('sections'); }} testID="hadith-back-sections">
          <Text style={styles.backLink}>‹ {coll?.name}</Text>
        </TouchableOpacity>
        <Text style={styles.subHeading} numberOfLines={1}>{section?.name}</Text>
      </View>

      {loadingList ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>
      ) : error || items.length === 0 ? (
        <View style={styles.loading}>
          <Text style={styles.errorAr}>—</Text>
          <Text style={styles.errorTxt}>{error ? 'Could not load.' : 'Nothing found.'}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(h) => String(h.number)}
          contentContainerStyle={{ paddingBottom: Spacing.xxl }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.goldMuted} style={{ marginVertical: Spacing.lg }} /> : null}
          renderItem={({ item }) => {
            const fav = coll ? favorites.has(`${coll.id}:${item.number}`) : false;
            return (
              <View style={styles.hCard} testID={`hadith-${item.number}`}>
                <View style={styles.hTopRow}>
                  <Text style={styles.hNum}>№ {item.number}</Text>
                  <View style={styles.gradePill}><Text style={styles.gradePillText}>{item.grade.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.hRef}>Book {item.book}:{item.in_book}</Text>
                </View>
                {item.arabic ? <Text style={[styles.hArabic, ts(styles.hArabic)]} selectable>{item.arabic}</Text> : null}
                {item.arabic ? <View style={styles.hairline} /> : null}
                <Text style={[styles.hEnglish, ts(styles.hEnglish)]} selectable>{item.english}</Text>
                <View style={styles.hFooter}>
                  <Text style={styles.hAuthority}>{coll?.authority}</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => coll && toggleFav(coll.id, item.number)} style={styles.actionBtn} testID={`hadith-fav-${item.number}`}>
                    <HeartIcon size={17} color={fav ? Colors.gold : Colors.goldMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => shareHadith(item)} style={styles.actionBtn} testID={`hadith-share-${item.number}`}>
                    <ShareIcon size={16} color={Colors.goldMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  loadingNote: { fontFamily: Fonts.displayItalic, fontSize: 12, color: Colors.textDim, textAlign: 'center' },
  errorAr: { fontFamily: Fonts.arabic, fontSize: 26, color: Colors.goldMuted },
  errorTxt: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textDim, textAlign: 'center' },

  header: { marginBottom: Spacing.sm },
  eyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.6, color: Colors.textDim, textTransform: 'uppercase' },
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginTop: 6 },
  subtitle: { fontFamily: Fonts.displayItalic, fontSize: 14, color: Colors.textSecondary, marginTop: 2 },

  // Collection cards
  collCard: {
    padding: Spacing.lg, borderRadius: Radius.xl, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.borderAccent, marginBottom: Spacing.md, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: Colors.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 18 },
      android: { elevation: 5 }, default: {},
    }),
  },
  collGlow: { position: 'absolute', top: -70, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.gold, opacity: 0.06 },
  collHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  collEyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.4, color: Colors.gold, textTransform: 'uppercase' },
  collAr: { fontFamily: Fonts.arabic, fontSize: 22, color: Colors.goldMuted, lineHeight: 32 },
  collName: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary, marginTop: Spacing.sm },
  collBlurb: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
  collFooter: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  sahihPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.gold },
  sahihPillText: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 2, color: Colors.gold },
  collArrow: { fontFamily: Fonts.display, fontSize: 24, color: Colors.gold, lineHeight: 24 },

  // Sub-header (sections/list)
  subHead: { marginBottom: Spacing.sm },
  backLink: { fontFamily: Fonts.label, fontSize: 11, letterSpacing: 1.4, color: Colors.goldMuted, marginBottom: 6, textTransform: 'uppercase' },
  subHeading: { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary },
  subHeadingAr: { fontFamily: Fonts.arabic, fontSize: 16, color: Colors.gold, marginTop: 2 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    backgroundColor: Colors.surface, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary },
  goText: { fontFamily: Fonts.label, fontSize: 12, letterSpacing: 1.4, color: Colors.gold, textTransform: 'uppercase', paddingHorizontal: 4 },
  totalNote: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.2, color: Colors.textDim, marginBottom: Spacing.sm, textTransform: 'uppercase' },

  // Book row
  bookRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  bookNum: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderAccent,
    alignItems: 'center', justifyContent: 'center',
  },
  bookNumText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.gold },
  bookName: { flex: 1, fontFamily: Fonts.displayBold, fontSize: 16, color: Colors.textPrimary },
  bookCount: { fontFamily: Fonts.label, fontSize: 11, color: Colors.textDim, letterSpacing: 0.6 },
  bookChev: { fontFamily: Fonts.display, fontSize: 20, color: Colors.goldMuted, lineHeight: 20 },

  // Hadith card
  hCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: Radius.xl, padding: Spacing.md + 2, marginBottom: Spacing.sm + 2,
  },
  hTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  hNum: { fontFamily: Fonts.bodySemi, fontSize: 12, color: Colors.gold, letterSpacing: 0.5 },
  gradePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: Colors.hover, borderWidth: 1, borderColor: Colors.borderAccent },
  gradePillText: { fontFamily: Fonts.label, fontSize: 8.5, letterSpacing: 1.4, color: Colors.gold },
  hRef: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 0.8, color: Colors.textDim },
  hArabic: { fontFamily: Fonts.arabic, fontSize: 23, color: Colors.textPrimary, lineHeight: 46, textAlign: 'right' },
  hairline: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: Spacing.sm + 2 },
  hEnglish: { fontFamily: Fonts.body, fontSize: 13.5, color: Colors.textSecondary, lineHeight: 22 },
  hFooter: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.xs },
  hAuthority: { fontFamily: Fonts.displayItalic, fontSize: 12, color: Colors.goldMuted },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.gold },
  retryText: { fontFamily: Fonts.label, fontSize: 11, letterSpacing: 1.6, color: Colors.gold, textTransform: 'uppercase' },
});
