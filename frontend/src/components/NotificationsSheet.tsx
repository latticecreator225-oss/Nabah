import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform,
  RefreshControl,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { logError } from '../log';
import { FadeInUp } from '../motion';

// Reminders are scheduled locally on the device (see reminderSchedule.ts /
// adhanSchedule.ts). This screen shows what's coming — read straight from the
// OS scheduler — instead of a server-sent history.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // expo weekday 1..7

type Upcoming = { id: string; title: string; body: string; when: Date; label: string };

function fmtTime(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function nextDaily(h: number, m: number): Date {
  const now = new Date();
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

function nextWeekly(weekday1to7: number, h: number, m: number): Date {
  const now = new Date();
  const target = ((weekday1to7 - 1) % 7 + 7) % 7; // 0=Sun
  const d = new Date();
  d.setHours(h, m, 0, 0);
  let delta = (target - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function toUpcoming(req: Notifications.NotificationRequest): Upcoming | null {
  const t: any = req.trigger || {};
  const content: any = req.content || {};
  const title: string = content.title || 'Reminder';
  const body: string = content.body || '';
  const hour = typeof t.hour === 'number' ? t.hour : t?.dateComponents?.hour;
  const minute = typeof t.minute === 'number' ? t.minute : t?.dateComponents?.minute;
  const weekday = typeof t.weekday === 'number' ? t.weekday : t?.dateComponents?.weekday;
  if (typeof hour !== 'number' || typeof minute !== 'number') return null;

  if (typeof weekday === 'number') {
    const when = nextWeekly(weekday, hour, minute);
    return { id: req.identifier, title, body, when, label: `${WEEKDAYS[(weekday - 1) % 7]}s · ${fmtTime(hour, minute)}` };
  }
  const when = nextDaily(hour, minute);
  return { id: req.identifier, title, body, when, label: `Daily · ${fmtTime(hour, minute)}` };
}

function whenLabel(d: Date): string {
  const diff = d.getTime() - Date.now();
  const hrs = diff / 3_600_000;
  if (hrs < 1) return `in ${Math.max(1, Math.round(diff / 60_000))}m`;
  if (hrs < 24) return `in ${Math.round(hrs)}h`;
  return `in ${Math.round(hrs / 24)}d`;
}

export default function NotificationsSheetBody() {
  const [items, setItems] = useState<Upcoming[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true); else setRefreshing(true);
    try {
      if (Platform.OS === 'web') { setItems([]); return; }
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const up = scheduled
        .map(toUpcoming)
        .filter((x): x is Upcoming => x != null)
        .sort((a, b) => a.when.getTime() - b.when.getTime());
      setItems(up);
    } catch (e) {
      logError('notifications.load', e);
      setItems([]);
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
        <Text style={styles.eyebrow}>RHYTHMS — القادم</Text>
        <Text style={styles.title}>Upcoming reminders</Text>
        <Text style={styles.sub}>
          {items.length === 0
            ? 'Enable reminders in Rhythms & Reminders to see them here.'
            : `${items.length} scheduled on this device.`}
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
            <Text style={styles.emptyAr}>صمت</Text>
            <Text style={styles.emptyTxt}>Nothing scheduled yet.</Text>
          </View>
        ) : (
          items.map((it, idx) => (
            <FadeInUp key={it.id} delay={Math.min(idx, 8) * 45}>
              <View style={styles.card} testID={`upcoming-${idx}`}>
                <View style={styles.row}>
                  <Text style={styles.catLabel}>{it.label}</Text>
                  <Text style={styles.time}>{whenLabel(it.when)}</Text>
                </View>
                <Text style={styles.notifTitle}>{it.title}</Text>
                {it.body ? <Text style={styles.notifBody}>{it.body}</Text> : null}
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
});
