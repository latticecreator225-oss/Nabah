import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Platform, Share,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { api, SavedAyah } from '../api';
import { confirmDestructive } from '../alerts';
import { FadeInUp } from '../motion';
import { HeartIcon, ShareIcon } from './Icons';

export default function BookmarksSheetBody() {
  const [items, setItems] = useState<SavedAyah[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uid, setUid] = useState<string>('');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const u = (await AsyncStorage.getItem('userId')) || '';
      setUid(u);
      if (!u) { setItems([]); return; }
      const data = await api.savedAyahs(u);
      setItems(Array.isArray(data) ? data : []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = (a: SavedAyah) => {
    confirmDestructive(
      'Remove from bookmarks',
      `Remove this ayah from Surah ${a.surah}?`,
      'Remove',
      async () => {
        if (Platform.OS !== 'web')
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setItems((prev) => prev.filter((x) => x.id !== a.id));
        try {
          await api.deleteSavedAyah(uid, a.id);
        } catch {}
      },
    );
  };

  const share = async (a: SavedAyah) => {
    try {
      await Share.share({
        message: `${a.arabic}\n\n“${a.english}”\n— Surah ${a.surah} (${a.reference})\n\nShared via نَبَأ`,
      });
    } catch {}
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>;
  }

  return (
    <View style={styles.root} testID="bookmarks-sheet">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SAVED — حفظ</Text>
        <Text style={styles.title}>Your collected verses</Text>
        <Text style={styles.sub}>
          {items.length === 0
            ? 'Save ayahs from the Feelings sheet — they will rest here.'
            : `${items.length} verse${items.length === 1 ? '' : 's'} kept close.`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.gold} />
        }
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <HeartIcon size={32} color={Colors.goldMuted} />
            <Text style={styles.emptyText}>Nothing here yet.</Text>
          </View>
        ) : (
          items.map((a, idx) => (
            <FadeInUp key={a.id} delay={Math.min(idx, 8) * 50}>
              <View style={styles.card} testID={`bookmark-${a.id}`}>
              <View style={styles.cardHead}>
                <Text style={styles.surahLabel}>
                  SURAH {a.surah.toUpperCase()}  ·  {a.reference}
                </Text>
                <Text style={styles.emotion}>{a.emotion}</Text>
              </View>
              <Text style={styles.ar}>{a.arabic}</Text>
              <View style={styles.divider} />
              <Text style={styles.en}>“{a.english}”</Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => share(a)} style={styles.actionBtn} testID={`bookmark-share-${a.id}`}>
                  <ShareIcon size={14} />
                  <Text style={styles.actionTxt}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(a)} style={[styles.actionBtn, styles.removeBtn]} testID={`bookmark-remove-${a.id}`}>
                  <Text style={[styles.actionTxt, { color: Colors.textDim }]}>Remove</Text>
                </TouchableOpacity>
              </View>
              </View>
            </FadeInUp>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: Spacing.lg },
  eyebrow: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 2.6, color: Colors.goldMuted, textTransform: 'uppercase' },
  title: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary, marginTop: Spacing.sm },
  sub: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontFamily: Fonts.displayItalic, color: Colors.textDim, fontSize: 14 },
  card: {
    marginBottom: Spacing.md, padding: Spacing.lg,
    borderRadius: Radius.xl, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  surahLabel: { fontFamily: Fonts.label, color: Colors.gold, fontSize: 10, letterSpacing: 2.2 },
  emotion: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1.6, color: Colors.textDim, textTransform: 'uppercase' },
  ar: { fontFamily: Fonts.arabic, fontSize: 22, color: Colors.textPrimary, lineHeight: 40, textAlign: 'center' },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: Spacing.sm },
  en: { fontFamily: Fonts.displayItalic, fontSize: 14, color: Colors.textSecondary, lineHeight: 22, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderAccent, backgroundColor: Colors.surface,
  },
  removeBtn: { borderColor: Colors.borderSubtle, backgroundColor: 'transparent' },
  actionTxt: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary, fontSize: 12, letterSpacing: 0.8 },
});
