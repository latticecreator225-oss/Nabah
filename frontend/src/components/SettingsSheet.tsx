import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { api, UserT } from '../api';
import { logError } from '../log';
import { notify, confirmDestructive } from '../alerts';
import {
  MUEZZINS, getAdhanEnabled, setAdhanEnabled, getMuezzinId, setMuezzinId,
  previewAdhan, stopAdhan,
} from '../adhan';
import { cancelAdhanSchedule } from '../adhanSchedule';
import { FadeInUp } from '../motion';
import { TEXT_SIZES, TextSizeId, scaleOf, useTextScaleSetting } from '../textScale';
import { LANGUAGES, LanguageId, useI18n } from '../i18n';
import { PlayIcon, PauseIcon } from './Icons';

type Gender = 'male' | 'female' | 'unspecified';

// Size labels come from the active language, not TEXT_SIZES' English defaults.
function sizeLabel(t: { sizeRegular: string; sizeLarge: string; sizeXLarge: string }, id: string) {
  return id === 'large' ? t.sizeLarge : id === 'xlarge' ? t.sizeXLarge : t.sizeRegular;
}


export default function SettingsSheetBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<UserT | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('unspecified');
  const [calcMethod, setCalcMethod] = useState<number | null>(null);
  const [asrSchool, setAsrSchool] = useState<number>(0);
  const [adhanOn, setAdhanOn] = useState(false);
  const [muezzinId, setMuezzinIdState] = useState<string>(MUEZZINS[0].id);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const { sizeId, setSizeId } = useTextScaleSetting();
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem('userId');
      if (uid) {
        try {
          const u = await api.getUser(uid);
          setUser(u);
          setName(u.name);
          setGender(u.gender);
        } catch (e) {
          logError('settings.loadUser', e);
          notify('Could not load profile', 'Showing your saved details. Pull up again when you are back online.');
        }
      }
      const cm = await AsyncStorage.getItem('calcMethod');
      const as = await AsyncStorage.getItem('asrSchool');
      if (cm) setCalcMethod(Number(cm));
      if (as) setAsrSchool(Number(as));
      setAdhanOn(await getAdhanEnabled());
      setMuezzinIdState(await getMuezzinId());
    })();
    return () => { stopAdhan(); };
  }, []);

  const toggleAdhan = (on: boolean) => {
    setAdhanOn(on);
    setAdhanEnabled(on).catch((e) => logError('settings.adhanToggle', e));
    if (!on) {
      stopAdhan();
      setPreviewing(null);
      // Tear down scheduled calls now; home reschedules on close when turned on.
      cancelAdhanSchedule().catch((e) => logError('settings.cancelSchedule', e));
    }
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const chooseLanguage = async (id: LanguageId) => {
    if (id === lang) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const { needsRestart } = await setLang(id);
    if (needsRestart) {
      // reloadAsync handles this in a real build; if it didn't fire (Expo Go),
      // the layout direction only applies on the next cold start.
      notify(t.settingsLanguage, t.settingsRestartNote);
    }
  };

  const chooseTextSize = (id: TextSizeId) => {
    setSizeId(id);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const chooseMuezzin = (id: string) => {
    setMuezzinIdState(id);
    setMuezzinId(id).catch((e) => logError('settings.muezzin', e));
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const togglePreview = (id: string) => {
    if (previewing === id) {
      stopAdhan();
      setPreviewing(null);
    } else {
      setPreviewing(id);
      const clear = () => setPreviewing(null);
      previewAdhan(id, clear, (e) => {
        clear();
        logError('settings.preview', e);
        notify('Adhan unavailable', 'Could not play this recitation right now. Check your connection and try again.');
      }).catch((e) => {
        clear();
        logError('settings.preview', e);
      });
    }
  };

  const save = async () => {
    try {
      // Profile updates need a loaded user; prayer prefs are local and always save.
      if (user) {
        const u = await api.updateUser(user.id, {
          name: name.trim(),
          gender,
        });
        setUser(u);
        await AsyncStorage.setItem('userName', u.name);
        await AsyncStorage.setItem('userGender', u.gender);
      }
      // 'Auto' (calcMethod null) means: clear any stored method so location decides.
      if (calcMethod !== null) await AsyncStorage.setItem('calcMethod', String(calcMethod));
      else await AsyncStorage.removeItem('calcMethod');
      await AsyncStorage.setItem('asrSchool', String(asrSchool));
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notify(t.settingsSavedTitle, t.settingsSavedBody);
    } catch (e: any) {
      notify('Could not save', String(e?.message || e));
    }
  };

  const LOCAL_KEYS = [
    'userId', 'userName', 'userGender', 'userMarried', 'userLat', 'userLng',
    'calcMethod', 'asrSchool', 'lastSyncedTz', 'quranLastRead',
  ];

  const signOut = () => {
    confirmDestructive('Sign out?', 'You will be asked to set up again.', 'Sign out', async () => {
      await AsyncStorage.multiRemove(LOCAL_KEYS);
      onClose();
      router.replace('/onboarding');
    });
  };

  const deleteAccount = () => {
    confirmDestructive(
      'Delete account?',
      'This permanently erases your profile, location, reminders, and saved ayahs from our servers. This cannot be undone.',
      'Delete everything',
      async () => {
        try {
          const uid = await AsyncStorage.getItem('userId');
          if (uid) await api.deleteUser(uid);
        } catch (e) {
          logError('settings.deleteAccount', e);
          notify('Could not delete', 'Something went wrong. Please try again.');
          return;
        }
        await AsyncStorage.multiRemove(LOCAL_KEYS);
        onClose();
        router.replace('/onboarding');
      },
    );
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
      testID="settings-sheet"
    >
      <Text style={styles.title}>{t.settingsTitle}</Text>

      <Section title={t.settingsProfile} delay={60}>
        <Text style={styles.label}>{t.settingsName}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholderTextColor={Colors.textDim}
          testID="settings-name-input"
        />

        <Text style={[styles.label, { marginTop: Spacing.md }]}>{t.settingsAddressYou}</Text>
        <View style={styles.genderRow}>
          {(['male', 'female'] as Gender[]).map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                setGender(g);
              }}
              style={[styles.genderPill, gender === g && styles.genderPillActive]}
              testID={`settings-gender-${g}`}
            >
              <Text style={[styles.genderText, gender === g && { color: Colors.gold }]}>
                {g === 'male' ? 'Brother' : 'Sister'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </Section>

      <Section title={t.settingsPrayerTimings} delay={130}>
        <Text style={styles.label}>{t.settingsAsrSchool}</Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setAsrSchool(0);
            }}
            style={[styles.genderPill, asrSchool === 0 && styles.genderPillActive]}
          >
            <Text style={[styles.genderText, asrSchool === 0 && { color: Colors.gold }]}>Standard (Shafi'i, Maliki, Hanbali)</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.genderRow, { marginTop: Spacing.sm }]}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setAsrSchool(1);
            }}
            style={[styles.genderPill, asrSchool === 1 && styles.genderPillActive]}
          >
            <Text style={[styles.genderText, asrSchool === 1 && { color: Colors.gold }]}>Hanafi</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { marginTop: Spacing.md }]}>Calculation Method</Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setCalcMethod(null);
            }}
            style={[styles.genderPill, calcMethod === null && styles.genderPillActive]}
          >
            <Text style={[styles.genderText, calcMethod === null && { color: Colors.gold }]}>Auto (By Location)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setCalcMethod(3); // Muslim World League as standard manual fallback
            }}
            style={[styles.genderPill, calcMethod !== null && styles.genderPillActive]}
          >
            <Text style={[styles.genderText, calcMethod !== null && { color: Colors.gold }]}>Muslim World League</Text>
          </TouchableOpacity>
        </View>
        {calcMethod !== null && (
          <Text style={styles.rowSub}>Using Muslim World League (MWL) calculation. Other methods are automatically applied when 'Auto' is selected based on your region.</Text>
        )}
      </Section>

      <Section title={t.settingsAdhan} delay={200}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t.settingsSoundAdhan}</Text>
            <Text style={styles.rowSub}>
              {t.settingsSoundAdhanSub}
            </Text>
          </View>
          <Switch
            value={adhanOn}
            onValueChange={toggleAdhan}
            trackColor={{ true: Colors.gold, false: Colors.borderSubtle }}
            thumbColor={Colors.textPrimary}
            testID="settings-adhan-switch"
          />
        </View>

        {adhanOn && (
          <View style={{ marginTop: Spacing.md }}>
            <Text style={styles.label}>{t.settingsMuezzin}</Text>
            {MUEZZINS.map((m) => {
              const active = muezzinId === m.id;
              const isPreviewing = previewing === m.id;
              return (
                <View key={m.id} style={[styles.muezzinRow, active && styles.muezzinRowActive]}>
                  <TouchableOpacity
                    style={styles.muezzinSelect}
                    onPress={() => chooseMuezzin(m.id)}
                    activeOpacity={0.8}
                    testID={`settings-muezzin-${m.id}`}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.muezzinName, active && { color: Colors.gold }]}>{m.name}</Text>
                      <Text style={styles.muezzinPlace}>{m.place}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => togglePreview(m.id)}
                    style={styles.previewBtn}
                    testID={`settings-preview-${m.id}`}
                  >
                    {isPreviewing
                      ? <PauseIcon size={15} color={Colors.gold} />
                      : <PlayIcon size={15} color={Colors.goldMuted} />}
                  </TouchableOpacity>
                </View>
              );
            })}
            <Text style={styles.adhanNote}>
              When the app is open, the full adhan plays (Fajr has its own call). A reminder is also
              scheduled at each prayer time for when the app is closed — add a custom adhan sound in a
              dev build to hear the recited call on your lock screen.
            </Text>
          </View>
        )}
      </Section>

      <Section title={t.settingsLanguage.toUpperCase()} delay={245}>
        <Text style={styles.rowSub}>{t.settingsLanguageSub}</Text>
        <View style={{ marginTop: Spacing.md }}>
          {LANGUAGES.map((l) => {
            const active = lang === l.id;
            return (
              <TouchableOpacity
                key={l.id}
                onPress={() => chooseLanguage(l.id)}
                style={[styles.muezzinRow, active && styles.muezzinRowActive]}
                testID={`settings-lang-${l.id}`}
                activeOpacity={0.8}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.muezzinName, active && { color: Colors.gold }]}>{l.label}</Text>
                  <Text style={styles.muezzinPlace}>{l.english}{l.rtl ? '  ·  RTL' : ''}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.adhanNote}>{t.settingsRestartNote}</Text>
      </Section>

      <Section title={t.settingsReading} delay={260}>
        <Text style={styles.label}>{t.settingsTextSize}</Text>
        <Text style={styles.rowSub}>
          {t.settingsTextSizeSub}
        </Text>
        <View style={styles.sizeRow}>
          {TEXT_SIZES.map((sz) => {
            const active = sizeId === sz.id;
            return (
              <TouchableOpacity
                key={sz.id}
                onPress={() => chooseTextSize(sz.id)}
                style={[styles.sizePill, active && styles.sizePillActive]}
                testID={`settings-textsize-${sz.id}`}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.sizePillText,
                    { fontSize: Math.round(13 * sz.scale) },
                    active && { color: Colors.gold },
                  ]}
                >
                  {sizeLabel(t, sz.id)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.sizePreview, { fontSize: Math.round(15 * scaleOf(sizeId)), lineHeight: Math.round(26 * scaleOf(sizeId)) }]}>
          {t.sizePreviewLine}
        </Text>
      </Section>

      <TouchableOpacity style={styles.cta} onPress={save} testID="settings-save-btn">
        <Text style={styles.ctaText}>{t.settingsSaveChanges}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut} testID="settings-signout-btn">
        <Text style={styles.signOut}>{t.settingsSignOut}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={deleteAccount} testID="settings-delete-account-btn">
        <Text style={styles.deleteAccount}>{t.settingsDeleteAccount}</Text>
      </TouchableOpacity>

      <Text style={styles.about}>Made with love for the Ummah ✦</Text>
      <Text style={styles.version}>v1.0.0  ·  نَبَأ</Text>
    </ScrollView>
  );
}

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <FadeInUp delay={delay} style={{ marginTop: Spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </FadeInUp>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.label, fontSize: 10, color: Colors.textDim, letterSpacing: 2.4, marginBottom: Spacing.sm },
  sectionBody: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: Radius.lg, padding: Spacing.md },
  label: { fontFamily: Fonts.label, fontSize: 10, letterSpacing: 1.6, color: Colors.textDim, marginBottom: 4 },
  sizeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  sizePill: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  sizePillActive: { borderColor: Colors.gold, backgroundColor: Colors.hover },
  sizePillText: { fontFamily: Fonts.bodyMedium, color: Colors.textSecondary, textAlign: 'center' },
  sizePreview: {
    fontFamily: Fonts.displayItalic, color: Colors.textSecondary,
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  input: {
    backgroundColor: Colors.surface, color: Colors.textPrimary, fontFamily: Fonts.body, fontSize: 15,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  genderRow: { flexDirection: 'row', gap: Spacing.sm },
  genderPill: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.surface, alignItems: 'center',
  },
  genderPillActive: { borderColor: Colors.gold, backgroundColor: Colors.hover },
  genderText: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary, fontSize: 13, letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary, fontSize: 14 },
  rowSub: { fontFamily: Fonts.body, color: Colors.textDim, fontSize: 12, marginTop: 2 },
  muezzinRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm, marginTop: Spacing.xs,
    borderWidth: 1, borderColor: 'transparent',
  },
  muezzinRowActive: { borderColor: Colors.borderAccent, backgroundColor: Colors.hover },
  muezzinSelect: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: Colors.borderAccent,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.gold },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gold },
  muezzinName: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  muezzinPlace: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textDim, marginTop: 1 },
  previewBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  adhanNote: {
    fontFamily: Fonts.body, fontStyle: 'italic', fontSize: 11, color: Colors.textDim,
    marginTop: Spacing.md, lineHeight: 17,
  },
  cta: { marginTop: Spacing.lg, backgroundColor: Colors.gold, paddingVertical: 16, borderRadius: Radius.lg, alignItems: 'center' },
  ctaText: { fontFamily: Fonts.bodySemi, color: Colors.bgPrimary, fontSize: 15, letterSpacing: 0.4 },
  signOut: { textAlign: 'center', marginTop: Spacing.md, fontFamily: Fonts.bodyMedium, color: Colors.danger, fontSize: 13 },
  deleteAccount: { textAlign: 'center', marginTop: Spacing.sm, fontFamily: Fonts.bodyMedium, color: Colors.danger, fontSize: 12, textDecorationLine: 'underline' },
  about: { textAlign: 'center', marginTop: Spacing.xl, fontFamily: Fonts.displayItalic, color: Colors.gold, fontSize: 14 },
  version: { textAlign: 'center', marginTop: 4, fontFamily: Fonts.label, fontSize: 10, color: Colors.textDim, letterSpacing: 2 },
});
