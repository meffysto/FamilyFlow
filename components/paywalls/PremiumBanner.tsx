// components/paywalls/PremiumBanner.tsx
// Bannière premium « aperçu + CTA » (mode D-11) — Phase 54-04.
//
// Brique réutilisable affichée en tête des écrans premium en mode aperçu :
// montre la valeur + un CTA qui ouvre le PaywallModal. Hard gate seulement là
// où l'aperçu n'a pas de sens (à la discrétion de l'écran consommateur).
//
// Analogue components/ui/Button.tsx : React.memo + useThemeColors (zéro hardcoded).

import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface PremiumBannerProps {
  message: string;
  ctaLabel?: string;
  onPress: () => void;
}

export const PremiumBanner = React.memo(function PremiumBanner({
  message,
  ctaLabel = 'Voir les offres',
  onPress,
}: PremiumBannerProps) {
  const { primary, tint, colors } = useThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={ctaLabel}
      style={[styles.banner, { backgroundColor: tint, borderColor: primary }]}
    >
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      <Text style={[styles.cta, { color: primary }]}>{ctaLabel} →</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  banner: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
    gap: Spacing.sm,
  },
  message: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    lineHeight: 22,
  },
  cta: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
