/**
 * ScreenHeader.tsx — Header soigné pour écrans secondaires.
 *
 * Edge-to-edge sous la dynamic island, fond warm parchemin (ou tint custom),
 * titre serif + sous-titre italique tendre + slot actions à droite.
 * Fondu doux en bas pour fondre dans le contenu de la page.
 *
 * Pour le hero (dashboard) → utiliser LivingGradient + composition custom.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';

interface ScreenHeaderProps {
  title: string;
  icon?: string;
  subtitle?: string;
  /** Élément(s) à afficher à gauche du titre (bouton retour, par ex) */
  leading?: React.ReactNode;
  /** Élément(s) à afficher à droite (boutons icône, badges…) */
  actions?: React.ReactNode;
  /** Élément(s) à afficher SOUS le titre, dans la même teinte (filtres, chips, segmented…) */
  bottom?: React.ReactNode;
  /**
   * SharedValue du scrollY de la liste sous-jacente. Si fourni, la ligne
   * titre/sous-titre/actions collapse au scroll (le slot bottom reste visible).
   */
  scrollY?: SharedValue<number>;
  /**
   * Color signature de l'écran (wash warm). Si omis → `colors.brand.wash`.
   * Permet à chaque tab d'avoir une teinte propre (terracotta pour Photos,
   * mousse pour Calendar, etc.) tout en restant warm-aligned.
   */
  tint?: string;
}

const COLLAPSE_RANGE = 60;

export function ScreenHeader({ title, icon, subtitle, leading, actions, bottom, scrollY, tint }: ScreenHeaderProps) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  // Fond warm : tint custom si fourni, sinon wash brand par défaut.
  const tintedBg = tint ?? colors.brand.wash;

  const titleAnimStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, COLLAPSE_RANGE], [1, 0], Extrapolation.CLAMP),
      height: interpolate(y, [0, COLLAPSE_RANGE], [44, 0], Extrapolation.CLAMP),
      overflow: 'hidden',
    };
  });

  const tintedAnimStyle = useAnimatedStyle(() => {
    if (!scrollY) return { paddingTop: insets.top + 4, paddingBottom: 12 };
    const y = scrollY.value;
    return {
      paddingTop: interpolate(y, [0, COLLAPSE_RANGE], [insets.top + 4, insets.top], Extrapolation.CLAMP),
      paddingBottom: interpolate(y, [0, COLLAPSE_RANGE], [12, 6], Extrapolation.CLAMP),
    };
  });

  const bottomAnimStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const y = scrollY.value;
    return {
      paddingTop: interpolate(y, [0, COLLAPSE_RANGE], [4, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.tinted, { backgroundColor: tintedBg }, tintedAnimStyle]}>
        <Animated.View style={[styles.header, titleAnimStyle]}>
          <View style={styles.titleRow}>
            {leading}
            {icon && <Text style={styles.icon}>{icon}</Text>}
            <View style={styles.titleCol}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: colors.brand.soilMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {actions && <View style={styles.actions}>{actions}</View>}
        </Animated.View>
        {bottom && <Animated.View style={[styles.bottom, bottomAnimStyle]}>{bottom}</Animated.View>}
      </Animated.View>
      {/* Fondu : la teinte se dissout dans le fond de page */}
      <LinearGradient
        pointerEvents="none"
        colors={[tintedBg, colors.bg + '00']}
        style={styles.fade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  tinted: {
    // paddingTop / paddingBottom gérés par tintedAnimStyle (collapse au scroll).
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.sm,
  },
  bottom: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    fontSize: 26,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.display,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.normal,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -12,
    height: 12,
  },
});
