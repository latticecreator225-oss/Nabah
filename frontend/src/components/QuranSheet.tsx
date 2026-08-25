import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, Platform, Share, Pressable, ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { api, SurahMeta, SurahDetail, Ayah, Reciter } from '../api';
import { logError } from '../log';
import { useTextScale } from '../textScale';
import { useI18n } from '../i18n';
import { playAudio, stopAudio } from '../audio';
import {
  PlayIcon, PauseIcon, BookmarkIcon, ShareIcon, SearchIcon, CheckIcon,
} from './Icons';

const LAST_READ_KEY = 'quranLastRead';
const SCRIPT_KEY = 'quranScript';
const RECITER_KEY = 'quranReciter';
const DEFAULT_RECITER = 'alafasy';

type LastRead = { surah: number; surahName: string; ayah: number };
type ScriptStyle = 'uthmani' | 'indopak';

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicNum(n: number): string {
  return String(n).split('').map((d) => (d >= '0' && d <= '9' ? AR_DIGITS[+d] : d)).join('');
}

export default function QuranSheetBody({ active = true }: { active?: boolean }) {
  const ts = useTextScale();
  const { t, language } = useI18n();
  // Real published translation for the chosen language (see i18n/types.ts).
  const translationRef = useRef(language.quranEdition);
  translationRef.current = language.quranEdition;
  const [view, setView] = useState<'index' | 'reader'>('index');
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [query, setQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(false);

  const [detail, setDetail] = useState<SurahDetail | null>(null);
  const [loadingSurah, setLoadingSurah] = useState(false);
  const [surahError, setSurahError] = useState(false);

  const [showTranslit, setShowTranslit] = useState(false);
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [savedRefs, setSavedRefs] = useState<Set<string>>(new Set());
  const [lastRead, setLastRead] = useState<LastRead | null>(null);
  const [script, setScript] = useState<ScriptStyle>('uthmani');
  const [reciter, setReciter] = useState<string>(DEFAULT_RECITER);
  const [reciters, setReciters] = useState<Reciter[]>([]);

  const userIdRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Ayah>>(null);
  const detailRef = useRef<SurahDetail | null>(null);
  detailRef.current = detail;
  const scriptRef = useRef<ScriptStyle>(script);
  scriptRef.current = script;
  const reciterRef = useRef<string>(reciter);
  reciterRef.current = reciter;

  useEffect(() => {
    (async () => {
      userIdRef.current = await AsyncStorage.getItem('userId');
      try {
        const s = (await AsyncStorage.getItem(SCRIPT_KEY)) as ScriptStyle | null;
        if (s === 'uthmani' || s === 'indopak') setScript(s);
      } catch (e) { logError('quran.scriptLoad', e); }
      try {
        const r = await AsyncStorage.getItem(RECITER_KEY);
        if (r) { setReciter(r); reciterRef.current = r; }
      } catch (e) { logError('quran.reciterLoad', e); }
      try {
        const lr = await AsyncStorage.getItem(LAST_READ_KEY);
        if (lr) setLastRead(JSON.parse(lr));
      } catch (e) { logError('quran.lastRead', e); }
      try {
        const list = await api.quranSurahs();
        setSurahs(list);
      } catch (e) {
        logError('quran.surahs', e);
        setListError(true);
      }
      api.quranReciters().then(setReciters).catch((e) => logError('quran.reciters', e));
      setLoadingList(false);
    })();
    return () => { stopAudio(); };
  }, []);

  // When the sheet is dismissed (kept mounted, just hidden), stop recitation.
  useEffect(() => {
    if (!active) {
      stopAudio();
      setPlayingAyah(null);
    }
  }, [active]);

  const haptic = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

  const persistLastRead = useCallback((surah: number, surahName: string, ayah: number) => {
    const lr = { surah, surahName, ayah };
    setLastRead(lr);
    AsyncStorage.setItem(LAST_READ_KEY, JSON.stringify(lr)).catch((e) => logError('quran.persist', e));
  }, []);

  const openSurah = useCallback(async (n: number, resumeAyah?: number) => {
    haptic();
    stopAudio();
    setPlayingAyah(null);
    setView('reader');
    setDetail(null);
    setSurahError(false);
    setLoadingSurah(true);
    try {
      const d = await api.quranSurah(n, translationRef.current, scriptRef.current, reciterRef.current);
      setDetail(d);
      persistLastRead(n, d.englishName, resumeAyah ?? 1);
      if (resumeAyah && resumeAyah > 1) {
        // jump after first render settles
        setTimeout(() => {
          const idx = d.ayahs.findIndex((a) => a.number === resumeAyah);
          if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.2, animated: false });
        }, 350);
      }
    } catch (e) {
      logError('quran.openSurah', e);
      setSurahError(true);
    }
    setLoadingSurah(false);
  }, [persistLastRead]);

  const backToIndex = () => {
    haptic();
    stopAudio();
    setPlayingAyah(null);
    setView('index');
  };

  // Switch the Arabic orthography (Madinah Mushaf ⇄ Indo-Pak) and re-fetch the
  // open surah in that script, keeping your place.
  const changeScript = useCallback(async (s: ScriptStyle) => {
    if (s === scriptRef.current) return;
    haptic();
    scriptRef.current = s;
    setScript(s);
    AsyncStorage.setItem(SCRIPT_KEY, s).catch((e) => logError('quran.scriptSave', e));
    const d = detailRef.current;
    if (d) {
      stopAudio();
      setPlayingAyah(null);
      setLoadingSurah(true);
      try {
        const nd = await api.quranSurah(d.number, translationRef.current, s, reciterRef.current);
        setDetail(nd);
      } catch (e) {
        logError('quran.changeScript', e);
        setSurahError(true);
      }
      setLoadingSurah(false);
    }
  }, []);

  // Switch reciter and re-fetch the open surah's audio URLs (text is unaffected,
  // so this is cheap — same alquran.cloud text, new everyayah.com audio path).
  const changeReciter = useCallback(async (id: string) => {
    if (id === reciterRef.current) return;
    haptic();
    reciterRef.current = id;
    setReciter(id);
    AsyncStorage.setItem(RECITER_KEY, id).catch((e) => logError('quran.reciterSave', e));
    const d = detailRef.current;
    if (d) {
      stopAudio();
      setPlayingAyah(null);
      setLoadingSurah(true);
      try {
        const nd = await api.quranSurah(d.number, translationRef.current, scriptRef.current, id);
        setDetail(nd);
      } catch (e) {
        logError('quran.changeReciter', e);
        setSurahError(true);
      }
      setLoadingSurah(false);
    }
  }, []);

  // ── audio ──
  const playFrom = useCallback((ayah: Ayah) => {
    const d = detailRef.current;
    if (!d || !ayah.audio) return;
    setPlayingAyah(ayah.number);
    persistLastRead(d.number, d.englishName, ayah.number);
    const idx = d.ayahs.findIndex((a) => a.number === ayah.number);
    if (idx >= 0) {
      listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.25, animated: true });
    }
    playAudio(ayah.audio, {
      onFinish: () => {
        const cur = detailRef.current;
        if (!cur) return;
        const i = cur.ayahs.findIndex((a) => a.number === ayah.number);
        const next = i >= 0 ? cur.ayahs[i + 1] : undefined;
        if (next && next.audio) playFrom(next);
        else setPlayingAyah(null);
      },
    });
  }, [persistLastRead]);

  const togglePlayAyah = (ayah: Ayah) => {
    haptic();
    if (playingAyah === ayah.number) {
      stopAudio();
      setPlayingAyah(null);
    } else {
      playFrom(ayah);
    }
  };

  const togglePlayAll = () => {
    haptic();
    if (playingAyah != null) {
      stopAudio();
      setPlayingAyah(null);
    } else if (detail && detail.ayahs.length) {
      playFrom(detail.ayahs[0]);
    }
  };

  const bookmarkAyah = async (ayah: Ayah) => {
    const d = detailRef.current;
    if (!d) return;
    const ref = `${d.number}:${ayah.number}`;
    if (savedRefs.has(ref)) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSavedRefs((prev) => new Set(prev).add(ref));
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      await api.saveAyah({
        user_id: uid,
        emotion: 'quran',
        arabic: ayah.arabic,
        english: ayah.english,
        surah: d.englishName,
        reference: `${d.englishName} ${d.number}:${ayah.number}`,
      });
    } catch (e) { logError('quran.bookmark', e); }
  };

  const shareAyah = async (ayah: Ayah) => {
    const d = detailRef.current;
    if (!d) return;
    try {
      await Share.share({
        message: `${ayah.arabic}\n\n“${ayah.english}”\n— ${d.englishName} ${d.number}:${ayah.number}\n\nvia Nabah`,
      });
    } catch (e) { logError('quran.share', e); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter((s) =>
      s.englishName.toLowerCase().includes(q) ||
      s.englishNameTranslation.toLowerCase().includes(q) ||
      String(s.number) === q ||
      s.name.includes(query.trim()),
    );
  }, [surahs, query]);

  // ───────────────────────── INDEX VIEW ─────────────────────────
  if (view === 'index') {
    return (
      <View style={styles.root} testID="quran-sheet">
        <View style={styles.indexHeader}>
          <Text style={styles.eyebrow}>القرآن الكريم  ·  THE NOBLE QURAN</Text>
          <Text style={styles.indexTitle}>{t.quranRead}</Text>
        </View>

        {loadingList ? (
          <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>
        ) : listError && surahs.length === 0 ? (
          <View style={styles.loading}>
            <Text style={styles.errorAr}>تعذّر</Text>
            <Text style={styles.errorTxt}>Could not load the Quran.</Text>
            <Text style={styles.errorTxt}>Check your connection and reopen.</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(s) => String(s.number)}
            contentContainerStyle={{ paddingBottom: Spacing.xxl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {lastRead && (
                  <Pressable
                    onPress={() => openSurah(lastRead.surah, lastRead.ayah)}
                    style={({ pressed }) => [styles.continueCard, pressed && { opacity: 0.92 }]}
                    testID="quran-continue"
                  >
                    <View style={styles.continueGlow} />
                    <Text style={styles.continueLabel}>{t.quranContinueReading}</Text>
                    <Text style={styles.continueName}>{lastRead.surahName}</Text>
                    <Text style={styles.continueSub}>Ayah {lastRead.ayah}  ·  resume ›</Text>
                  </Pressable>
                )}
                <View style={styles.searchWrap}>
                  <SearchIcon size={16} color={Colors.textDim} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t.quranSearch}
                    placeholderTextColor={Colors.textDim}
                    style={styles.searchInput}
                    testID="quran-search"
                  />
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.surahRow}
                onPress={() => openSurah(item.number)}
                activeOpacity={0.8}
                testID={`surah-row-${item.number}`}
              >
                <View style={styles.numMedallion}>
                  <View style={styles.numDiamond} />
                  <Text style={styles.numText}>{item.number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.surahEn}>{item.englishName}</Text>
                  <Text style={styles.surahMeta}>
                    {item.englishNameTranslation}  ·  {item.numberOfAyahs} ayāt  ·  {item.revelationType}
                  </Text>
                </View>
                <Text style={styles.surahAr}>{item.name.replace('سُورَةُ ', '')}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ───────────────────────── READER VIEW ─────────────────────────
  const showBismillah = detail && detail.number !== 1 && detail.number !== 9;
  return (
    <View style={styles.root} testID="quran-reader">
      <View style={styles.readerBar}>
        <TouchableOpacity onPress={backToIndex} style={styles.backBtn} testID="quran-back">
          <Text style={styles.backChev}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.readerTitle} numberOfLines={1}>{detail?.englishName || '—'}</Text>
          <Text style={styles.readerMeta}>
            {detail ? `${detail.numberOfAyahs} ayāt · ${detail.revelationType}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { haptic(); setShowTranslit((s) => !s); }}
          style={[styles.pillBtn, showTranslit && styles.pillBtnActive]}
          testID="quran-translit-toggle"
        >
          <Text style={[styles.pillBtnText, showTranslit && { color: Colors.gold }]}>Aa</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlayAll} style={styles.playAllBtn} testID="quran-play-all">
          {playingAyah != null ? <PauseIcon size={16} color={Colors.bgPrimary} /> : <PlayIcon size={16} color={Colors.bgPrimary} />}
        </TouchableOpacity>
      </View>

      <View style={styles.scriptStrip}>
        <Text style={styles.scriptLabel}>{t.quranScript}</Text>
        <View style={styles.segmented}>
          <TouchableOpacity
            onPress={() => changeScript('uthmani')}
            style={[styles.segBtn, script === 'uthmani' && styles.segBtnActive]}
            testID="quran-script-uthmani"
          >
            <Text style={[styles.segText, script === 'uthmani' && styles.segTextActive]}>{t.quranScriptUthmani}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => changeScript('indopak')}
            style={[styles.segBtn, script === 'indopak' && styles.segBtnActive]}
            testID="quran-script-indopak"
          >
            <Text style={[styles.segText, script === 'indopak' && styles.segTextActive]}>{t.quranScriptIndopak}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {reciters.length > 0 && (
        <View style={styles.reciterStrip}>
          <Text style={styles.scriptLabel}>{t.quranReciter}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.xs }}
          >
            {reciters.map((r) => {
              const active = reciter === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => changeReciter(r.id)}
                  style={[styles.reciterChip, active && styles.reciterChipActive]}
                  testID={`quran-reciter-${r.id}`}
                >
                  <Text style={[styles.reciterChipText, active && styles.reciterChipTextActive]}>
                    {r.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loadingSurah ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>
      ) : surahError || !detail ? (
        <View style={styles.loading}>
          <Text style={styles.errorAr}>تعذّر</Text>
          <Text style={styles.errorTxt}>{t.quranCouldNotLoadSurah}</Text>
          <TouchableOpacity onPress={() => detail && openSurah(detail.number)} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t.tryAgain}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={detail.ayahs}
          keyExtractor={(a) => String(a.number)}
          contentContainerStyle={{ paddingBottom: Spacing.xxl, paddingHorizontal: Spacing.lg }}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.25, animated: true }), 200);
          }}
          ListHeaderComponent={
            showBismillah ? (
              <View style={styles.bismillahWrap}>
                <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
                <View style={styles.bismillahRule} />
              </View>
            ) : <View style={{ height: Spacing.sm }} />
          }
          renderItem={({ item }) => {
            const ref = `${detail.number}:${item.number}`;
            const isPlaying = playingAyah === item.number;
            const saved = savedRefs.has(ref);
            return (
              <View style={[styles.ayahCard, isPlaying && styles.ayahCardPlaying]} testID={`ayah-${item.number}`}>
                <View style={styles.ayahArRow}>
                  <Text style={[styles.ayahAr, ts(styles.ayahAr)]} selectable>
                    {item.arabic}
                    <Text style={styles.ayahEndMark}>{'  ﴿' + toArabicNum(item.number) + '﴾'}</Text>
                  </Text>
                </View>
                {showTranslit && item.transliteration ? (
                  <Text style={[styles.ayahTranslit, ts(styles.ayahTranslit)]} selectable>{item.transliteration}</Text>
                ) : null}
                <Text style={[styles.ayahEn, ts(styles.ayahEn)]} selectable>{item.english}</Text>
                <View style={styles.ayahActions}>
                  <Text style={styles.ayahRef}>{detail.number}:{item.number}</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => togglePlayAyah(item)} style={styles.actionBtn} testID={`ayah-play-${item.number}`}>
                    {isPlaying ? <PauseIcon size={16} color={Colors.gold} /> : <PlayIcon size={16} color={Colors.goldMuted} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => bookmarkAyah(item)} style={styles.actionBtn} testID={`ayah-bookmark-${item.number}`}>
                    {saved ? <CheckIcon size={16} color={Colors.gold} /> : <BookmarkIcon size={16} color={Colors.goldMuted} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => shareAyah(item)} style={styles.actionBtn} testID={`ayah-share-${item.number}`}>
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
  root: { flex: 1, paddingTop: Spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  errorAr: { fontFamily: Fonts.arabic, fontSize: 26, color: Colors.goldMuted },
  errorTxt: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textDim, textAlign: 'center' },
  eyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.6, color: Colors.textDim, textTransform: 'uppercase' },

  // Index
  indexHeader: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  indexTitle: { fontFamily: Fonts.display, fontSize: 30, color: Colors.textPrimary, marginTop: 4 },
  continueCard: {
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.md,
    padding: Spacing.lg, borderRadius: Radius.xl,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderAccent, overflow: 'hidden',
  },
  continueGlow: {
    position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75,
    backgroundColor: Colors.gold, opacity: 0.06,
  },
  continueLabel: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 2.4, color: Colors.gold, textTransform: 'uppercase' },
  continueName: { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary, marginTop: 6 },
  continueSub: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    backgroundColor: Colors.surface, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary },
  surahRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  numMedallion: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  numDiamond: {
    position: 'absolute', width: 34, height: 34, borderWidth: 1, borderColor: Colors.borderAccent,
    transform: [{ rotate: '45deg' }], borderRadius: 6,
  },
  numText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.gold },
  surahEn: { fontFamily: Fonts.displayBold, fontSize: 18, color: Colors.textPrimary },
  surahMeta: { fontFamily: Fonts.label, fontSize: 9.5, letterSpacing: 0.6, color: Colors.textDim, marginTop: 2, textTransform: 'uppercase' },
  surahAr: { fontFamily: Fonts.arabic, fontSize: 22, color: Colors.gold, lineHeight: 34 },

  // Reader
  readerBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSubtle },
  backChev: { fontFamily: Fonts.display, fontSize: 24, color: Colors.gold, lineHeight: 24 },
  readerTitle: { fontFamily: Fonts.display, fontSize: 22, color: Colors.textPrimary },
  readerMeta: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1.4, color: Colors.textDim, textTransform: 'uppercase', marginTop: 1 },
  pillBtn: {
    width: 38, height: 32, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  pillBtnActive: { borderColor: Colors.gold, backgroundColor: Colors.hover },
  pillBtnText: { fontFamily: Fonts.displayBold, fontSize: 14, color: Colors.textSecondary },
  playAllBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  scriptStrip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  scriptLabel: {
    fontFamily: Fonts.label, fontSize: 9, letterSpacing: 2, color: Colors.textDim, textTransform: 'uppercase',
  },
  segmented: {
    flex: 1, flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 2,
  },
  segBtn: { flex: 1, paddingVertical: 6, borderRadius: Radius.pill, alignItems: 'center' },
  segBtnActive: { backgroundColor: Colors.hover, borderWidth: 1, borderColor: Colors.gold },
  segText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.textSecondary, letterSpacing: 0.3 },
  segTextActive: { color: Colors.gold },
  reciterStrip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  reciterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  reciterChipActive: { borderColor: Colors.gold, backgroundColor: Colors.hover },
  reciterChipText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  reciterChipTextActive: { color: Colors.gold },
  bismillahWrap: { alignItems: 'center', paddingVertical: Spacing.lg },
  bismillah: { fontFamily: Fonts.arabic, fontSize: 26, color: Colors.gold, textAlign: 'center', lineHeight: 44 },
  bismillahRule: { width: 60, height: 1, backgroundColor: Colors.gold, opacity: 0.3, marginTop: Spacing.sm },
  ayahCard: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle,
    borderRadius: Radius.xl, padding: Spacing.md + 2, marginBottom: Spacing.sm + 2,
  },
  ayahCardPlaying: { borderColor: Colors.gold, backgroundColor: Colors.cardActive },
  ayahArRow: { },
  ayahAr: { fontFamily: Fonts.arabic, fontSize: 27, color: Colors.textPrimary, lineHeight: 52, textAlign: 'right' },
  ayahEndMark: { fontFamily: Fonts.arabic, fontSize: 22, color: Colors.gold },
  ayahTranslit: { fontFamily: Fonts.body, fontStyle: 'italic', fontSize: 13, color: Colors.textDim, marginTop: Spacing.sm, lineHeight: 22 },
  ayahEn: { fontFamily: Fonts.body, fontSize: 13.5, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 22 },
  ayahActions: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.xs },
  ayahRef: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.2, color: Colors.textDim },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.gold },
  retryText: { fontFamily: Fonts.label, fontSize: 11, letterSpacing: 1.6, color: Colors.gold, textTransform: 'uppercase' },
});
