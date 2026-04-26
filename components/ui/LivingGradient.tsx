/**
 * LivingGradient.tsx — Dégradé animé qui change selon l'heure du jour
 *
 * Aurore rosée (5-8h), matin doré (8-12h), après-midi bleu (12-17h),
 * coucher de soleil (17-20h), nuit profonde (20-5h).
 * Le dégradé inclut toujours la couleur primary du thème actif.
 */

import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useSeason } from '../../hooks/useSeason';

// Palettes par moment de la journée — [couleur haute, couleur basse]
// Palette warm brand : aurore parchemin → terracotta, matin miel, après-midi
// ocre, coucher prune, nuit bleu nuit doux. Plus de Tailwind candy froid.
const TIME_PALETTES = {
  light: {
    dawn:      ['#F4D6A0', '#B85C3D'], // parchemin clair → terracotta
    morning:   ['#F4D6A0', '#C49A4A'], // parchemin → ocre miel
    afternoon: ['#E8B87A', '#A0784C'], // miel doré → bois clair
    sunset:    ['#C49A4A', '#7E5A6B'], // ocre → prune sourde
    night:     ['#5A6B7E', '#1D2438'], // bleu nuit doux → bleu nuit profond
  },
  dark: {
    dawn:      ['#7A4A2E', '#4A2820'], // bois sombre → bois deep
    morning:   ['#6B4226', '#3A2418'], // bois → bois deep
    afternoon: ['#5A4030', '#2E2018'], // bois sourd → wenge
    sunset:    ['#5C3D44', '#2A1E22'], // prune deep → night plum
    night:     ['#2A2E40', '#0E1018'], // bleu nuit → noir
  },
};

type TimeSlot = keyof typeof TIME_PALETTES.light;

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

interface LivingGradientProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Intensité du mélange avec la couleur primary du thème (0-1, défaut: 0.3) */
  primaryBlend?: number;
}

export const LivingGradient = forwardRef<View, LivingGradientProps>(
  ({ style, children, primaryBlend = 0.5 }, ref) => {
    const { primary, isDark } = useThemeColors();
    const { theme: seasonTheme } = useSeason();

    const gradientColors = useMemo(() => {
      const hour = new Date().getHours();
      const currentSlot = getTimeSlot(hour);
      const palette = isDark ? TIME_PALETTES.dark : TIME_PALETTES.light;
      const [top, bottom] = palette[currentSlot];

      // Mix temps × saison × thème enfant. La saison teinte subtilement
      // l'ambiance globale (~0.2-0.3) pour donner 4 personnalités à l'app
      // sans casser la lisibilité time-of-day.
      const seasonedTop = mixColors(top, seasonTheme.tint, seasonTheme.blend);
      const seasonedBottom = mixColors(bottom, seasonTheme.tint, seasonTheme.blend * 0.6);
      const blendedTop = mixColors(seasonedTop, primary, primaryBlend);

      return [blendedTop, seasonedBottom] as const;
    }, [isDark, primary, primaryBlend, seasonTheme]);

    return (
      <Animated.View ref={ref} style={[style, { overflow: 'hidden' }]}>
        <LinearGradient
          colors={[...gradientColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.75 }]}
        />
        <BlurView
          intensity={15}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </Animated.View>
    );
  }
);
