/**
 * LivingGradient.tsx — Hero gradient saisonnier 4-stops, time-shifted.
 *
 * Le gradient est dicté par la saison (printemps tendre / été doré /
 * automne ocre / hiver bleu nuit) et glisse subtilement selon l'heure :
 *  - matin/après-midi : palette saison telle quelle
 *  - soir : descendue d'un cran (plus chaude/sombre)
 *  - nuit : le 4e stop assombri vers night
 *
 * La couleur primary du thème enfant n'est plus injectée dans le gradient
 * (sinon ça muddait la palette). Pour personnaliser un écran, utiliser la
 * prop `tint` du ScreenHeader plutôt que ce hero.
 */

import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useSeason } from '../../hooks/useSeason';
import type { SeasonGradient } from '../../constants/season';

type TimeSlot = 'dawn' | 'morning' | 'afternoon' | 'sunset' | 'night';

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
}

/** Mélange deux couleurs hex (t entre 0 et 1) */
function mixColors(c1: string, c2: string, t: number): string {
  const hex = (s: string) => parseInt(s, 16);
  const r1 = hex(c1.slice(1, 3)), g1 = hex(c1.slice(3, 5)), b1 = hex(c1.slice(5, 7));
  const r2 = hex(c2.slice(1, 3)), g2 = hex(c2.slice(3, 5)), b2 = hex(c2.slice(5, 7));
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Applique un shift time-of-day léger sur le gradient saisonnier.
 *  - dawn / morning  : palette telle quelle
 *  - afternoon       : -5% de luminosité
 *  - sunset          : décalée vers terracotta (+ teinte chaude)
 *  - night           : le dernier stop tire vers night-plum
 */
function shiftBySlot(g: SeasonGradient, slot: TimeSlot): readonly string[] {
  if (slot === 'morning' || slot === 'dawn') return g;
  if (slot === 'sunset') {
    return [g[0], g[1], mixColors(g[2], '#7E5A6B', 0.15), mixColors(g[3], '#7E5A6B', 0.25)] as const;
  }
  if (slot === 'night') {
    return [
      mixColors(g[0], '#1D2438', 0.4),
      mixColors(g[1], '#1D2438', 0.5),
      mixColors(g[2], '#1D2438', 0.65),
      mixColors(g[3], '#0E121A', 0.75),
    ] as const;
  }
  // afternoon : conserve mais légèrement assombrie au bas
  return [g[0], g[1], mixColors(g[2], '#000000', 0.05), mixColors(g[3], '#000000', 0.08)] as const;
}

interface LivingGradientProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /**
   * Conservé pour rétro-compat. N'injecte plus le primary dans le gradient
   * (était la cause du rendu sombre/muddy au printemps). À retirer plus tard.
   */
  primaryBlend?: number;
}

export const LivingGradient = forwardRef<View, LivingGradientProps>(
  ({ style, children }, ref) => {
    const { isDark } = useThemeColors();
    const { theme: seasonTheme } = useSeason();

    const gradientColors = useMemo(() => {
      const hour = new Date().getHours();
      const slot = getTimeSlot(hour);
      const base = isDark ? seasonTheme.gradientDark : seasonTheme.gradient;
      return shiftBySlot(base, slot);
    }, [isDark, seasonTheme]);

    return (
      <Animated.View ref={ref} style={[style, { overflow: 'hidden' }]}>
        <LinearGradient
          colors={gradientColors as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Léger blur pour adoucir les transitions de stops */}
        <BlurView
          intensity={8}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </Animated.View>
    );
  }
);
