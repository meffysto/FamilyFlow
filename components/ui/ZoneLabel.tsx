/**
 * ZoneLabel.tsx — Petit séparateur Caveat tendre entre groupes de sections.
 *
 *    ~ ce matin
 *    ~ à la maison
 *    ~ côté ferme
 *
 * Aucune ligne, aucun chrome. Juste un libellé italique manuscrit légèrement
 * incliné qui découpe le flow vertical du dashboard en respirations.
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontFamily, FontWeight } from '../../constants/typography';

interface ZoneLabelProps {
  /** Libellé sans tilde — le tilde est ajouté automatiquement (« ~ ce matin ») */
  children: string;
}

export const ZoneLabel = React.memo(function ZoneLabel({ children }: ZoneLabelProps) {
  const { colors } = useThemeColors();
  return (
    <Text
      style={[styles.label, { color: colors.brand.soilMuted }]}
      accessibilityRole="header"
    >
      {`~ ${children}`}
    </Text>
  );
});

const styles = StyleSheet.create({
  label: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.normal,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.md,
    transform: [{ rotate: '-1deg' }],
  },
});
