/**
 * Nabah · Mushaf (page view)
 *
 * The Quran laid out the way a printed Mushaf is — 604 pages, each page's
 * lines exactly as they're set in the real Madani Mushaf (quran.com's API
 * carries that per-word line placement), with a tap-for-meaning word-by-word
 * gloss. This is a second way to read, alongside the existing ayah-by-ayah
 * list view in QuranSheet — not a replacement for it.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ActivityIndicator, Pressable, FlatList,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Colors, Fonts, Spacing } from '../theme';
import { api, MushafPage, MushafWord } from '../api';
import { useTextScale } from '../textScale';
import { logError } from '../log';
import EnglishOnlyNotice from './EnglishOnlyNotice';

const { width: SCREEN_W } = Dimensions.get('window');
const TOTAL_PAGES = 604;

type Props = {
  initialPage?: number;
  onBack: () => void;
};

export default function MushafView({ initialPage = 1, onBack }: Props) {
  const startIndex = Math.min(Math.max(initialPage, 1), TOTAL_PAGES) - 1;
  const listRef = useRef<FlatList<number>>(null);
  // FlatList doesn't expose "current index" as a value — this ref is the one
  // source of truth for it, updated on every scroll settle (including the
  // ones `goTo` itself triggers), so the edge tap-zones always know where
  // they're advancing from.
  const currentIndexRef = useRef(startIndex);
  const [tapped, setTapped] = useState<MushafWord | null>(null);
  const pages = useMemo(() => Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1), []);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= TOTAL_PAGES) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    listRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  return (
    <View style={styles.root} testID="mushaf-view">
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backBtn} testID="mushaf-back" hitSlop={10}>
          <Text style={styles.backChev}>‹</Text>
          <Text style={styles.backText}>List</Text>
        </Pressable>
        <Text style={styles.topHint}>Tap a word for its meaning</Text>
      </View>

      {/* The word-by-word gloss is sourced in English only (quran.com) — the
          Arabic text itself is unaffected regardless of interface language. */}
      <EnglishOnlyNotice style={styles.englishNotice} />

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(p) => String(p)}
        horizontal
        pagingEnabled
        inverted={false}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        // 604 pages exist, but only the current one and its immediate
        // neighbors should ever be fetched/mounted at once — this is a page
        // reader, not a feed; the default windowSize would fire off ~10
        // simultaneous page requests on first open.
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 50);
        }}
        onMomentumScrollEnd={(e) => {
          currentIndexRef.current = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
        }}
        renderItem={({ item }) => (
          <MushafPageCell page={item} width={SCREEN_W} onWordPress={setTapped} />
        )}
        style={{ flex: 1 }}
      />

      {/* Tap zones: the outer thirds turn pages without hunting for a button —
          the printed page itself is the "back/next" control, edge-to-edge. */}
      <Pressable style={styles.edgeZoneRight} onPress={() => goTo(currentIndexRef.current + 1)} />
      <Pressable style={styles.edgeZoneLeft} onPress={() => goTo(currentIndexRef.current - 1)} />

      <View style={styles.wordStrip}>
        {tapped ? (
          <>
            <Text style={styles.wordStripArabic}>{tapped.arabic}</Text>
            <View style={styles.wordStripDivider} />
            <View style={{ flex: 1 }}>
              <Text style={styles.wordStripMeaning} numberOfLines={1}>
                {tapped.translation || '—'}
              </Text>
              {tapped.transliteration ? (
                <Text style={styles.wordStripTranslit} numberOfLines={1}>
                  {tapped.transliteration}
                </Text>
              ) : null}
            </View>
            <Text style={styles.wordStripRef}>{tapped.verse_key}</Text>
          </>
        ) : (
          <Text style={styles.wordStripEmpty}>Tap any word above to see its meaning here.</Text>
        )}
      </View>
    </View>
  );
}

function MushafPageCell({
  page, width, onWordPress,
}: {
  page: number;
  width: number;
  onWordPress: (w: MushafWord) => void;
}) {
  const [data, setData] = useState<MushafPage | null>(null);
  const [error, setError] = useState(false);
  const ts = useTextScale();

  React.useEffect(() => {
    let cancelled = false;
    api.mushafPage(page)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) { logError('mushaf.page', e); setError(true); } });
    return () => { cancelled = true; };
  }, [page]);

  if (error) {
    return (
      <View style={[styles.page, { width }]}>
        <Text style={styles.errorTxt}>Could not load this page.</Text>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.page, { width }]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  const surahLine = data.surahs.map((s) => s.englishName).join(' · ');

  return (
    <View style={[styles.page, { width }]} testID={`mushaf-page-${page}`}>
      <View style={styles.pageHeadRow}>
        <Text style={styles.pageMeta}>JUZ {data.juz ?? '—'}</Text>
        <Text style={styles.pageSurah} numberOfLines={1}>{surahLine}</Text>
        <Text style={styles.pageMeta}>{page}</Text>
      </View>
      <View style={styles.pageBody}>
        {data.lines.map((line) => (
          <Text
            key={line.line}
            style={[styles.mushafLine, ts.size(26, 52)]}
            allowFontScaling={false}
          >
            {line.words.map((w, i) => (
              <Text
                key={i}
                onPress={() => onWordPress(w)}
                suppressHighlighting={false}
                style={w.is_end ? styles.ayahEnd : styles.word}
              >
                {w.arabic}
                {i < line.words.length - 1 ? ' ' : ''}
              </Text>
            ))}
          </Text>
        ))}
      </View>
      <Text style={styles.pageFoot}>{page}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backChev: { fontFamily: Fonts.display, fontSize: 20, color: Colors.gold, lineHeight: 20 },
  backText: { fontFamily: Fonts.bodyMedium, color: Colors.gold, fontSize: 13 },
  topHint: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1.2, color: Colors.textDim, textTransform: 'uppercase' },
  englishNotice: { marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: 0 },

  page: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  errorTxt: { fontFamily: Fonts.displayItalic, color: Colors.textDim, fontSize: 13, textAlign: 'center', marginTop: Spacing.xxl },
  pageHeadRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: Spacing.sm, marginBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  pageMeta: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.4, color: Colors.goldMuted },
  pageSurah: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.6, color: Colors.gold, textTransform: 'uppercase', flex: 1, textAlign: 'center' },
  pageBody: { flex: 1, justifyContent: 'center', gap: 4 },
  mushafLine: {
    fontFamily: Fonts.arabic, color: Colors.textPrimary,
    textAlign: 'right', writingDirection: 'rtl',
  },
  word: { fontFamily: Fonts.arabic },
  ayahEnd: { fontFamily: Fonts.arabic, color: Colors.gold, fontSize: 18 },
  pageFoot: { fontFamily: Fonts.label, fontSize: 10, color: Colors.textDim, textAlign: 'center', paddingVertical: Spacing.sm },

  edgeZoneLeft: { position: 'absolute', top: 60, bottom: 90, left: 0, width: '18%' },
  edgeZoneRight: { position: 'absolute', top: 60, bottom: 90, right: 0, width: '18%' },

  wordStrip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surface, minHeight: 64,
  },
  wordStripArabic: { fontFamily: Fonts.arabic, fontSize: 24, color: Colors.gold },
  wordStripDivider: { width: 1, alignSelf: 'stretch', backgroundColor: Colors.borderSubtle },
  wordStripMeaning: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary, fontSize: 14 },
  wordStripTranslit: { fontFamily: Fonts.body, fontStyle: 'italic', color: Colors.textDim, fontSize: 11, marginTop: 2 },
  wordStripRef: { fontFamily: Fonts.label, color: Colors.textDim, fontSize: 10, letterSpacing: 1 },
  wordStripEmpty: { fontFamily: Fonts.displayItalic, color: Colors.textDim, fontSize: 13, flex: 1, textAlign: 'center' },
});
