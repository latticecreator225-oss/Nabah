/**
 * Nabah · Reading text size
 *
 * A user-chosen scale for the app's *reading* content — Arabic, transliteration,
 * translation, hadith and dua bodies. Chrome (nav labels, buttons, eyebrows,
 * countdowns) deliberately does not scale: growing those breaks layout without
 * helping anyone actually read.
 *
 * Usage in a component:
 *   const s = useTextScale();
 *   <Text style={[styles.ayahAr, s(styles.ayahAr)]}>…</Text>
 * or more simply for a one-off:
 *   <Text style={[styles.ayahAr, s.size(27, 52)]}>…</Text>
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TextStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError } from './log';

export type TextSizeId = 'regular' | 'large' | 'xlarge';

export const TEXT_SIZES: { id: TextSizeId; label: string; scale: number }[] = [
  { id: 'regular', label: 'Regular', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.18 },
  { id: 'xlarge', label: 'Extra Large', scale: 1.36 },
];

const STORAGE_KEY = 'readingTextSize';

export function scaleOf(id: TextSizeId): number {
  return TEXT_SIZES.find((t) => t.id === id)?.scale ?? 1;
}

type Ctx = {
  sizeId: TextSizeId;
  scale: number;
  setSizeId: (id: TextSizeId) => void;
};

const TextScaleContext = createContext<Ctx>({
  sizeId: 'regular',
  scale: 1,
  setSizeId: () => {},
});

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const [sizeId, setSizeIdState] = useState<TextSizeId>('regular');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'regular' || v === 'large' || v === 'xlarge') setSizeIdState(v);
      })
      .catch((e) => logError('textScale.load', e));
  }, []);

  const setSizeId = useCallback((id: TextSizeId) => {
    setSizeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch((e) => logError('textScale.save', e));
  }, []);

  const value = useMemo(
    () => ({ sizeId, scale: scaleOf(sizeId), setSizeId }),
    [sizeId, setSizeId],
  );

  return <TextScaleContext.Provider value={value}>{children}</TextScaleContext.Provider>;
}

export function useTextScaleSetting(): Ctx {
  return useContext(TextScaleContext);
}

/**
 * Returns a scaler. Call it with a style (scales its fontSize/lineHeight) or
 * use `.size(fontSize, lineHeight?)` for explicit values. At "Regular" it
 * returns undefined / the original numbers, so there is no cost when unused.
 */
export function useTextScale() {
  const { scale } = useContext(TextScaleContext);

  const fn = useCallback(
    (style: TextStyle | undefined): TextStyle | undefined => {
      if (scale === 1 || !style) return undefined;
      const out: TextStyle = {};
      if (typeof style.fontSize === 'number') out.fontSize = Math.round(style.fontSize * scale);
      if (typeof style.lineHeight === 'number') out.lineHeight = Math.round(style.lineHeight * scale);
      return out;
    },
    [scale],
  );

  return useMemo(
    () =>
      Object.assign(fn, {
        scale,
        size: (fontSize: number, lineHeight?: number): TextStyle => ({
          fontSize: Math.round(fontSize * scale),
          ...(lineHeight != null ? { lineHeight: Math.round(lineHeight * scale) } : {}),
        }),
      }),
    [fn, scale],
  );
}
