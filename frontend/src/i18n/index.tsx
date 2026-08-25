/**
 * Nabah · Interface language
 *
 * See ./types.ts for the scope rule (interface only — religious content is
 * either sourced from an authentic published translation or left in English).
 *
 * RTL: React Native's layout direction is a *native* setting. I18nManager
 * .forceRTL only takes effect after the process restarts, so switching to or
 * from Arabic/Urdu reloads the app (expo-updates' reloadAsync in a build, a
 * plain warning in Expo Go where that is unavailable). Language changes that
 * do not cross the RTL boundary apply instantly with no reload.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageId, Language, LANGUAGES, languageById, Strings } from './types';
import { en } from './locales/en';
import { ar } from './locales/ar';
import { ur } from './locales/ur';
import { id as idLocale } from './locales/id';
import { bn } from './locales/bn';
import { tr } from './locales/tr';
import { logError } from '../log';

export * from './types';

const CATALOGUE: Record<LanguageId, Strings> = {
  en,
  ar,
  ur,
  id: idLocale,
  bn,
  tr,
};

const STORAGE_KEY = 'appLanguage';

type Ctx = {
  lang: LanguageId;
  language: Language;
  t: Strings;
  /** True while the stored preference is still being read. */
  loading: boolean;
  setLang: (id: LanguageId) => Promise<{ needsRestart: boolean }>;
};

const I18nContext = createContext<Ctx>({
  lang: 'en',
  language: LANGUAGES[0],
  t: en,
  loading: true,
  setLang: async () => ({ needsRestart: false }),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageId>('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v && v in CATALOGUE) setLangState(v as LanguageId);
      })
      .catch((e) => logError('i18n.load', e))
      .finally(() => setLoading(false));
  }, []);

  const setLang = useCallback(
    async (next: LanguageId): Promise<{ needsRestart: boolean }> => {
      const from = languageById(lang);
      const to = languageById(next);
      setLangState(next);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, next);
      } catch (e) {
        logError('i18n.save', e);
      }

      // Only a change in writing direction needs the native layout flipped.
      const needsRestart = from.rtl !== to.rtl;
      if (needsRestart) {
        try {
          I18nManager.allowRTL(to.rtl);
          I18nManager.forceRTL(to.rtl);
        } catch (e) {
          logError('i18n.forceRTL', e);
        }
        try {
          // Present only in a real build; absent in Expo Go.
          const Updates = await import('expo-updates');
          await Updates.reloadAsync();
        } catch (e) {
          // Caller surfaces "please reopen the app" when this is unavailable.
          logError('i18n.reload', e);
        }
      }
      return { needsRestart };
    },
    [lang],
  );

  const value = useMemo<Ctx>(
    () => ({ lang, language: languageById(lang), t: CATALOGUE[lang], loading, setLang }),
    [lang, loading, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Interface strings for the active language. */
export function useT(): Strings {
  return useContext(I18nContext).t;
}

/** Full language context — for the picker and for API calls that vary by language. */
export function useI18n(): Ctx {
  return useContext(I18nContext);
}
