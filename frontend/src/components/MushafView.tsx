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
import * as Font from 'expo-font';
import { Platform } from 'react-native';
import { Colors, Fonts, Spacing, Radius } from '../theme';
import { api, MushafPage, MushafScript, MushafWord } from '../api';
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
  const [script, setScript] = useState<MushafScript>('uthmani');
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
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
            setScript((s) => (s === 'uthmani' ? 'indopak' : 'uthmani'));
          }}
          style={styles.scriptToggle}
          testID="mushaf-script-toggle"
          hitSlop={8}
        >
          <Text style={styles.scriptToggleText}>{script === 'uthmani' ? 'Uthmani' : 'Indo-Pak'}</Text>
        </Pressable>
      </View>
      <Text style={styles.topHint}>Tap a word for its meaning</Text>

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
          <MushafPageCell page={item} width={SCREEN_W} script={script} onWordPress={setTapped} />
        )}
        extraData={script}
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

function surahForVerseKey(data: MushafPage, verseKey: string) {
  const num = parseInt(verseKey.split(':')[0], 10);
  return data.surahs.find((s) => s.number === num) || null;
}

function MushafPageCell({
  page, width, script, onWordPress,
}: {
  page: number;
  width: number;
  script: MushafScript;
  onWordPress: (w: MushafWord) => void;
}) {
  const [data, setData] = useState<MushafPage | null>(null);
  const [error, setError] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  const ts = useTextScale();

  React.useEffect(() => {
    let cancelled = false;
    setData(null);
    setFontReady(false);
    api.mushafPage(page, script)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) { logError('mushaf.page', e); setError(true); } });
    return () => { cancelled = true; };
  }, [page, script]);

  // Each printed page has its own font — a single glyph per word, pre-shaped
  // by the King Fahd Complex's typesetters to reproduce that exact page.
  // Loaded fonts persist for the app's lifetime (expo-font also disk-caches
  // the download), so flipping back to an already-visited page is instant.
  React.useEffect(() => {
    if (!data || !data.font_url || !data.font_family) { setFontReady(true); return; }
    let cancelled = false;
    if (Font.isLoaded(data.font_family)) { setFontReady(true); return; }
    Font.loadAsync({ [data.font_family]: data.font_url })
      .then(() => { if (!cancelled) setFontReady(true); })
      .catch((e) => { logError('mushaf.font', e); if (!cancelled) setFontReady(true); });
    return () => { cancelled = true; };
  }, [data]);

  if (error) {
    return (
      <View style={[styles.page, { width }]}>
        <Text style={styles.errorTxt}>Could not load this page.</Text>
      </View>
    );
  }
  if (!data || !fontReady) {
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
        {data.lines.map((line) => {
          const opener = line.words.find((w) => w.first_ayah);
          const openerSurah = opener ? surahForVerseKey(data, opener.verse_key) : null;
          const skipBismillah = opener ? opener.verse_key.startsWith('9:') : false;
          return (
            <React.Fragment key={line.line}>
              {openerSurah ? (
                <View style={styles.surahBand}>
                  <View style={styles.surahBandRule} />
                  <Text style={styles.surahBandName} allowFontScaling={false}>
                    {openerSurah.name}
                  </Text>
                  <View style={styles.surahBandRule} />
                </View>
              ) : null}
              {openerSurah && !skipBismillah ? (
                <Text style={styles.bismillah} allowFontScaling={false}>
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </Text>
              ) : null}
              <Text style={[styles.mushafLine, ts.size(26, 52)]} allowFontScaling={false}>
                {line.words.map((w, i) => {
                  const useGlyph = script === 'uthmani' && !!w.glyph;
                  return (
                    <Text
                      key={i}
                      onPress={() => onWordPress(w)}
                      suppressHighlighting={false}
                      style={[
                        w.is_end ? styles.ayahEnd : styles.word,
                        // The ayah-end marker's own glyph already carries its
                        // ornamental proportions when it comes from the page
                        // font — the fixed fallback size only applies to the
                        // plain-text marker (Indo-Pak, or a missing glyph).
                        useGlyph ? { fontFamily: data.font_family!, fontSize: undefined } : null,
                      ]}
                    >
                      {useGlyph ? w.glyph : w.arabic}
                      {i < line.words.length - 1 && !useGlyph ? ' ' : ''}
                    </Text>
                  );
                })}
              </Text>
            </React.Fragment>
          );
        })}
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
  topHint: {
    fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1.2, color: Colors.textDim,
    textTransform: 'uppercase', textAlign: 'center', paddingTop: Spacing.xs,
  },
  scriptToggle: {
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 999,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  scriptToggleText: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1, color: Colors.gold },
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
  surahBand: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.md, marginBottom: Spacing.sm,
    paddingVertical: 8, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.md,
    backgroundColor: 'rgba(201,163,85,0.08)',
  },
  surahBandRule: { flex: 1, height: 1, backgroundColor: Colors.gold, opacity: 0.5 },
  surahBandName: {
    fontFamily: Fonts.arabic, fontSize: 22, color: Colors.gold, textAlign: 'center',
  },
  bismillah: {
    fontFamily: Fonts.arabic, fontSize: 22, color: Colors.textPrimary,
    textAlign: 'center', writingDirection: 'rtl', marginBottom: Spacing.sm,
  },
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
