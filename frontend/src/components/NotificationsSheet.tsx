import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { api, FeedItem } from '../api';
import { logError } from '../log';
import { FadeInUp } from '../motion';

const CATEGORY_LABEL: Record<string, string> = {
  fard: 'Prayer',
  pre_adhan: 'Pre-adhan',
  adhkar: 'Adhkar',
  tahajjud: 'Tahajjud',
  sunnah: 'Sunnah',
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function NotificationsSheetBody() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    setError(false);
    try {
      const u = (await AsyncStorage.getItem('userId')) || '';
      if (!u) { setItems([]); return; }
      const data = await api.notificationsFeed(u, 80);
      setItems(Array.isArray(data) ? data : []);
      // mark all read after loading
      api.markNotificationsRead(u).catch((e) => logError('notifications.markRead', e));
    } catch (e) {
      logError('notifications.load', e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={Colors.gold} /></View>;
  }

  return (
    <View style={styles.root} testID="notifications-sheet">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>RHYTHMS — سجل</Text>
        <Text style={styles.title}>What we sent you</Text>
        <Text style={styles.sub}>
          {items.length === 0
            ? 'When the Notification Engine speaks, you will see it here.'
            : `${items.length} quiet nudge${items.length === 1 ? '' : 's'} in your archive.`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.gold} />
        }
      >
        {error && items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyAr}>تعذّر</Text>
            <Text style={styles.emptyTxt}>Could not load your notifications.</Text>
            <Text style={styles.emptyTxt}>Pull down to try again.</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyAr}>صمت</Text>
            <Text style={styles.emptyTxt}>The archive is silent.</Text>
          </View>
        ) : (
          items.map((it, idx) => (
            <FadeInUp key={idx} delay={Math.min(idx, 8) * 45}>
              <View style={styles.card} testID={`feed-item-${idx}`}>
                <View style={styles.row}>
                  <Text style={styles.catLabel}>{CATEGORY_LABEL[it.category] || it.category}</Text>
                  <Text style={styles.time}>{timeAgo(it.sent_at)}</Text>
                </View>
                <Text style={styles.notifTitle}>{it.title}</Text>
                <Text style={styles.notifBody}>{it.message}</Text>
                {it.delivery && it.delivery !== 'sent' ? (
                  <Text style={styles.delivery}>· {it.delivery}</Text>
                ) : null}
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
  emptyAr: { fontFamily: Fonts.arabic, fontSize: 28, color: Colors.goldMuted },
  emptyTxt: { fontFamily: Fonts.displayItalic, color: Colors.textDim, fontSize: 14 },
  card: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1.8, color: Colors.gold, textTransform: 'uppercase' },
  time: { fontFamily: Fonts.label, fontSize: 9, letterSpacing: 1, color: Colors.textDim },
  notifTitle: { fontFamily: Fonts.displayBold, fontSize: 16, color: Colors.textPrimary, marginTop: 6, lineHeight: 22 },
  notifBody: { fontFamily: Fonts.displayItalic, fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
  delivery: { fontFamily: Fonts.label, fontSize: 9, color: Colors.textDim, marginTop: 6, letterSpacing: 1 },
});
