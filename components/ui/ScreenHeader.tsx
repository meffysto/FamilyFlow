/**
 * ScreenHeader.tsx — Header soigné pour écrans secondaires.
 *
 * Edge-to-edge sous la dynamic island, fond légèrement teinté primary,
 * titre + icône optionnelle + sous-titre + slot actions à droite.
 * Fondu doux en bas pour fondre dans le contenu de la page.
 *
 * Pour le hero (dashboard) → utiliser LivingGradient + composition custom.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface ScreenHeaderProps {
  title: string;
  icon?: string;
  subtitle?: string;
  /** Élément(s) à afficher à droite (boutons icône, badges…) */
  actions?: React.ReactNode;
  /** Élément(s) à afficher SOUS le titre, dans la même teinte (filtres, chips, segmented…) */
  bottom?: React.ReactNode;
}

export function ScreenHeader({ title, icon, subtitle, actions, bottom }: ScreenHeaderProps) {
  const { primary, colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  // Fond légèrement teinté : 8% de primary sur bg.
  const tintedBg = primary + '14';

  return (
    <View style={styles.wrap}>
      <View style={[styles.tinted, { backgroundColor: tintedBg, paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {icon && <Text style={styles.icon}>{icon}</Text>}
            <View style={styles.titleCol}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
        {bottom && <View style={styles.bottom}>{bottom}</View>}
      </View>
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
    paddingBottom: Spacing.md,
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
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginTop: 1,
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
