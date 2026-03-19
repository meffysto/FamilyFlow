/**
 * ThemeContext.tsx — Global theme: accent colors + dark/light mode
 *
 * Provides { primary, tint, setThemeId, colors, isDark, darkModePreference, setDarkModePreference }
 * to the entire app via React Context.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getTheme } from '../constants/themes';
import { LightColors, DarkColors, AppColors } from '../constants/colors';

const DARK_MODE_KEY = 'dark_mode_preference';

/**
 * Fallback programmatique : assombrit un hex clair pour le dark mode.
 * Réduit la luminosité à ~20% de l'original pour un rendu sombre et saturé.
 */
function darkenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.2;
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

export interface ThemeColors {
  primary: string;
  tint: string;
  setThemeId: (id: string) => void;
  colors: AppColors;
  isDark: boolean;
  darkModePreference: 'auto' | 'light' | 'dark';
  setDarkModePreference: (pref: 'auto' | 'light' | 'dark') => void;
}

const DEFAULT_COLORS: ThemeColors = {
  primary: '#7C3AED',
  tint: '#EDE9FE',
  setThemeId: () => {},
  colors: LightColors,
  isDark: false,
  darkModePreference: 'auto',
  setDarkModePreference: () => {},
};

const ThemeContext = createContext<ThemeColors>(DEFAULT_COLORS);

interface ThemeProviderProps {
  themeId?: string;
  children: React.ReactNode;
}

export function ThemeProvider({ themeId: initialThemeId, children }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState(initialThemeId);
  const systemScheme = useColorScheme();
  const [darkModePreference, setDarkModePref] = useState<'auto' | 'light' | 'dark'>('auto');

  // Load persisted dark mode preference
  useEffect(() => {
    SecureStore.getItemAsync(DARK_MODE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'auto') {
        setDarkModePref(val);
      }
    });
  }, []);

  // Sync themeId with prop when it changes (profile switch, vault reload)
  useEffect(() => {
    setThemeId(initialThemeId);
  }, [initialThemeId]);

  const setDarkModePreference = useCallback(async (pref: 'auto' | 'light' | 'dark') => {
    setDarkModePref(pref);
    await SecureStore.setItemAsync(DARK_MODE_KEY, pref);
  }, []);

  const theme = getTheme(themeId);

  const isDark = useMemo(() => {
    if (darkModePreference === 'dark') return true;
    if (darkModePreference === 'light') return false;
    return systemScheme === 'dark';
  }, [darkModePreference, systemScheme]);

  const colors: AppColors = isDark ? DarkColors : LightColors;

  // Résolution dark mode : utiliser les variantes sombres si disponibles,
  // sinon fallback programmatique (assombrir le tint light)
  const resolvedPrimary = isDark && theme.primaryDark ? theme.primaryDark : theme.primary;
  const resolvedTint = isDark
    ? (theme.tintDark ?? darkenColor(theme.tint))
    : theme.tint;

  const value = useMemo<ThemeColors>(
    () => ({
      primary: resolvedPrimary,
      tint: resolvedTint,
      setThemeId,
      colors,
      isDark,
      darkModePreference,
      setDarkModePreference,
    }),
    [resolvedPrimary, resolvedTint, colors, isDark, darkModePreference, setDarkModePreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext);
}
