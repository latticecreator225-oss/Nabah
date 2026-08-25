import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../src/theme';
import { api } from '../src/api';
import { notify } from '../src/alerts';
import { TEXT_SIZES, TextSizeId, scaleOf, useTextScaleSetting } from '../src/textScale';
import { useT } from '../src/i18n';

type Gender = 'male' | 'female' | 'unspecified';

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('unspecified');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref guard: `submitting` state updates on the next render, so a fast double
  // tap could call onBegin twice and create two accounts before the button
  // disables. The ref flips synchronously and blocks the second call.
  const submittingRef = useRef(false);
  const { sizeId, setSizeId } = useTextScaleSetting();
  const t = useT();

  const onBegin = async () => {
    if (submittingRef.current) return;
    if (!name.trim()) {
      notify(t.onboardNameMissingTitle, t.onboardNameMissingBody);
      return;
    }
    if (gender === 'unspecified') {
      notify(t.onboardGenderMissingTitle, t.onboardGenderMissingBody);
      return;
    }
    submittingRef.current = true;
    if (Platform.OS !== 'web') {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    setSubmitting(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch {}
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const user = await api.createUser({
        name: name.trim(),
        gender,
        location_lat: lat,
        location_lng: lng,
        timezone: tz,
      });
      await AsyncStorage.setItem('userId', user.id);
      await AsyncStorage.setItem('userName', user.name);
      await AsyncStorage.setItem('userGender', user.gender);
      // Explicit null checks — latitude/longitude 0 are valid coordinates.
      if (lat != null && lng != null) {
        await AsyncStorage.setItem('userLat', String(lat));
        await AsyncStorage.setItem('userLng', String(lng));
      }
      router.replace('/home');
    } catch (e: any) {
      notify('Something went off', String(e?.message || e));
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const pickTextSize = (id: TextSizeId) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSizeId(id);
  };

  const pickGender = (g: Gender) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setGender(g);
  };

  return (
    <SafeAreaView style={styles.container} testID="onboarding-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.salam} testID="onboarding-salam">السلام عليكم</Text>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <View style={styles.diamond} />
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.welcome} testID="onboarding-welcome">
            {t.onboardWelcome} <Text style={styles.welcomeAr}>نَبَأ</Text>
          </Text>

          <View style={{ height: Spacing.xl }} />

          {/* Name */}
          <Text style={styles.label}>{t.onboardYourName}</Text>
          <TextInput
            testID="onboarding-name-input"
            value={name}
            onChangeText={setName}
            placeholder={t.onboardNamePlaceholder}
            placeholderTextColor={Colors.textDim}
            style={[styles.input, focusedField === 'name' && { borderBottomColor: Colors.gold }]}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="words"
            maxLength={60}
          />

          <View style={{ height: Spacing.lg }} />

          {/* Gender */}
          <Text style={styles.label}>{t.onboardAddressYou}</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity
              testID="onboarding-gender-male"
              onPress={() => pickGender('male')}
              style={[styles.genderPill, gender === 'male' && styles.genderPillActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.genderText, gender === 'male' && { color: Colors.gold }]}>
                {t.onboardBrother}
              </Text>
              <Text style={styles.genderSub}>أَخ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="onboarding-gender-female"
              onPress={() => pickGender('female')}
              style={[styles.genderPill, gender === 'female' && styles.genderPillActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.genderText, gender === 'female' && { color: Colors.gold }]}>
                {t.onboardSister}
              </Text>
              <Text style={styles.genderSub}>أُخْت</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: Spacing.lg }} />

          {/* Reading text size — offered here because the app is text-heavy
              (Quran, adhkar, duas) and this is the cheapest moment to get it
              right, rather than after the reader has already struggled. */}
          <Text style={styles.label}>{t.onboardTextSize}</Text>
          <View style={styles.sizeRow}>
            {TEXT_SIZES.map((sz) => {
              const active = sizeId === sz.id;
              const label = sz.id === 'large' ? t.sizeLarge : sz.id === 'xlarge' ? t.sizeXLarge : t.sizeRegular;
              return (
                <TouchableOpacity
                  key={sz.id}
                  testID={`onboarding-textsize-${sz.id}`}
                  onPress={() => pickTextSize(sz.id)}
                  style={[styles.sizePill, active && styles.sizePillActive]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.sizePillText,
                      { fontSize: Math.round(13 * sz.scale) },
                      active && { color: Colors.gold },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text
            style={[
              styles.sizePreview,
              { fontSize: Math.round(15 * scaleOf(sizeId)), lineHeight: Math.round(26 * scaleOf(sizeId)) },
            ]}
          >
            Indeed, with hardship comes ease.
          </Text>
          <Text style={styles.sizeHint}>{t.onboardTextSizeHint}</Text>

          <View style={{ height: Spacing.lg }} />

          <Text style={styles.disclaimer}>
            {t.onboardDisclaimer}
          </Text>

          <View style={{ height: Spacing.xl }} />

          <TouchableOpacity
            testID="onboarding-begin-btn"
            onPress={onBegin}
            disabled={submitting}
            activeOpacity={0.85}
            style={[styles.cta, submitting && { opacity: 0.6 }]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.bgPrimary} />
            ) : (
              <Text style={styles.ctaText}>{t.onboardBegin}  ›</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.locationNote}>
            {t.onboardLocationNote}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  salam: { textAlign: 'center', fontFamily: Fonts.arabic, fontSize: 34, color: Colors.gold, marginTop: Spacing.xl },
  dividerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm + 2, marginBottom: Spacing.sm },
  dividerLine: { width: 36, height: 1, backgroundColor: Colors.gold, opacity: 0.5 },
  diamond: { width: 5, height: 5, backgroundColor: Colors.gold, transform: [{ rotate: '45deg' }], marginHorizontal: 8 },
  welcome: { textAlign: 'center', fontFamily: Fonts.displayItalic, fontSize: 22, color: Colors.textPrimary },
  welcomeAr: { fontFamily: Fonts.arabic, color: Colors.gold, fontSize: 26 },
  label: { fontFamily: Fonts.label, fontSize: 11, letterSpacing: 2.2, color: Colors.textDim, marginBottom: Spacing.sm },
  sizeRow: { flexDirection: 'row', gap: Spacing.sm },
  sizePill: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 4, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center', minHeight: 50,
  },
  sizePillActive: { borderColor: Colors.gold, backgroundColor: Colors.hover },
  sizePillText: { fontFamily: Fonts.bodyMedium, color: Colors.textSecondary, textAlign: 'center' },
  sizePreview: {
    fontFamily: Fonts.displayItalic, color: Colors.textSecondary,
    marginTop: Spacing.md, textAlign: 'center',
  },
  sizeHint: {
    fontFamily: Fonts.body, fontSize: 11, color: Colors.textDim,
    marginTop: 6, textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontFamily: Fonts.body,
    fontSize: 16,
    borderRadius: Radius.sm,
  },
  genderRow: { flexDirection: 'row', gap: Spacing.sm },
  genderPill: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  genderPillActive: { borderColor: Colors.gold, backgroundColor: Colors.hover },
  genderText: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary, fontSize: 15, letterSpacing: 0.5 },
  genderSub: { fontFamily: Fonts.arabic, color: Colors.goldMuted, fontSize: 16, marginTop: 4 },
  marriedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  marriedHint: { fontFamily: Fonts.body, color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  disclaimer: { marginTop: Spacing.md, fontFamily: Fonts.body, fontSize: 11, lineHeight: 17, color: Colors.textDim, fontStyle: 'italic' },
  cta: { backgroundColor: Colors.gold, paddingVertical: 18, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: Fonts.bodySemi, color: Colors.bgPrimary, fontSize: 16, letterSpacing: 0.5 },
  locationNote: { textAlign: 'center', fontFamily: Fonts.body, fontSize: 11, color: Colors.textDim, marginTop: Spacing.md },
});
