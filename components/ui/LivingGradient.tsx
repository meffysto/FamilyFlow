/**
 * LivingGradient.tsx — Dégradé animé qui change selon l'heure du jour
 *
 * Aurore rosée (5-8h), matin doré (8-12h), après-midi bleu (12-17h),
 * coucher de soleil (17-20h), nuit profonde (20-5h).
 * Le dégradé inclut toujours la couleur primary du thème actif.
 */

import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '../../contexts/ThemeContext';

// Palettes par moment de la journée — [couleur haute, couleur basse]
const TIME_PALETTES = {
  light: {
    dawn:      ['#E879A8', '#F59E0B'], // rose vif → or
    morning:   ['#3B82F6', '#F59E0B'], // bleu franc → ambre
    afternoon: ['#0EA5E9', '#8B5CF6'], // cyan → violet
    sunset:    ['#F97316', '#EC4899'], // orange → rose
    night:     ['#6366F1', '#1E293B'], // indigo → ardoise
  },
  dark: {
    dawn:      ['#9D174D', '#B45309'],
    morning:   ['#1D4ED8', '#15803D'],
    afternoon: ['#1E40AF', '#7C3AED'],
    sunset:    ['#C2410C', '#BE185D'],
    night:     ['#3730A3', '#0F172A'],
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
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  /** Intensité du mélange avec la couleur primary du thème (0-1, défaut: 0.3) */
  primaryBlend?: number;
}

export const LivingGradient = forwardRef<View, LivingGradientProps>(
  ({ style, children, primaryBlend = 0.3 }, ref) => {
    const { primary, isDark } = useThemeColors();

    const gradientColors = useMemo(() => {
      const hour = new Date().getHours();
      const currentSlot = getTimeSlot(hour);
      const palette = isDark ? TIME_PALETTES.dark : TIME_PALETTES.light;
      const [top, bottom] = palette[currentSlot];

      // Mélanger avec la couleur primary du thème pour personnaliser
      const blendedTop = mixColors(top, primary, primaryBlend);

      return [blendedTop, bottom] as const;
    }, [isDark, primary, primaryBlend]);

    return (
      <View ref={ref} style={[style, { overflow: 'hidden' }]}>
        <LinearGradient
          colors={[...gradientColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}
        />
        <BlurView
          intensity={30}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }
);
