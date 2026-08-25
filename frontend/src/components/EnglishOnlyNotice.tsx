/**
 * Nabah · "still English" notice
 *
 * Shown at the top of a content sheet whose underlying text has no authentic
 * published translation to source from (adhkar meanings, dua translations,
 * Sunnah entries — see src/i18n/types.ts for the full scope rule). Renders
 * nothing in English, since there is nothing to disclose there.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../theme';
import { useI18n } from '../i18n';

export default function EnglishOnlyNotice({ style }: { style?: object }) {
  const { lang, t } = useI18n();
  if (lang === 'en') return null;
  return (
    <View style={[styles.box, style]} testID="english-only-notice">
      <Text style={styles.text}>{t.contentEnglishOnlyNotice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.md,
  },
  text: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textDim,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
