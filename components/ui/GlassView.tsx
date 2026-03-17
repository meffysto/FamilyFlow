/**
 * GlassView.tsx — Conteneur Liquid Glass (BlurView + bordure translucide)
 *
 * Utilise expo-blur pour l'effet frosted glass.
 * Fallback automatique sur fond semi-transparent si blur indisponible.
 */

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Radius } from '../../constants/spacing';

interface GlassViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  [key: string]: any;
  /** Intensité du blur (0-100). Default: 40 */
  intensity?: number;
  /** Border radius. Default: Radius.xl (16) */
  borderRadius?: number;
}

export function GlassView({
  children,
  style,
  intensity = 40,
  borderRadius = Radius.xl,
  ...rest
}: GlassViewProps) {
  const { isDark, colors } = useThemeColors();

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
        style,
      ]}
      {...rest}
    >
      <BlurView
        intensity={intensity}
        tint={isDark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius, backgroundColor: colors.glassBg },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
});
