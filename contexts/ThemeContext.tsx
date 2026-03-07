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

  const value = useMemo<ThemeColors>(
    () => ({
      primary: theme.primary,
      tint: theme.tint,
      setThemeId,
      colors,
      isDark,
      darkModePreference,
      setDarkModePreference,
    }),
    [theme.primary, theme.tint, colors, isDark, darkModePreference, setDarkModePreference],
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
