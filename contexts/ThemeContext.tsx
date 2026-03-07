/**
 * ThemeContext.tsx — Global theme colors based on active profile
 *
 * Provides { primary, tint, setThemeId } to the entire app via React Context.
 * All screens/components call useThemeColors() instead of hardcoding #7C3AED.
 *
 * The ThemeProvider manages its own internal state. The initial value comes
 * from the parent layout prop, but any child (e.g. settings) can call
 * setThemeId() for instant UI updates without waiting for vault reload.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getTheme } from '../constants/themes';

export interface ThemeColors {
  primary: string;  // main accent (buttons, active states, headers)
  tint: string;     // light background (badges, chips, subtle highlights)
  setThemeId: (id: string) => void;  // instant theme switch
}

const DEFAULT_COLORS: ThemeColors = {
  primary: '#7C3AED',
  tint: '#EDE9FE',
  setThemeId: () => {},
};

const ThemeContext = createContext<ThemeColors>(DEFAULT_COLORS);

interface ThemeProviderProps {
  themeId?: string;
  children: React.ReactNode;
}

export function ThemeProvider({ themeId: initialThemeId, children }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState(initialThemeId);

  // Sync with prop when it changes (e.g. profile switch, vault reload)
  useEffect(() => {
    setThemeId(initialThemeId);
  }, [initialThemeId]);

  const theme = getTheme(themeId);

  const value = useMemo<ThemeColors>(
    () => ({ primary: theme.primary, tint: theme.tint, setThemeId }),
    [theme.primary, theme.tint],
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
