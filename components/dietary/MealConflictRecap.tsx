/**
 * MealConflictRecap.tsx — Bandeau compact de récap des conflits alimentaires
 *
 * Affiché en tête de chaque MealItem du planificateur de repas quand la recette
 * associée présente des conflits avec les profils famille.
 *
 * - Compact : une seule ligne "X allergie(s), Y intolérance(s) pour les convives sélectionnés"
 * - Couleur sémantique selon la sévérité maximale présente
 * - Tap optionnel pour drill-down (vers le RecipeViewer ou l'AllergenBanner)
 * - React.memo car il apparaît dans une liste potentiellement longue
 *
 * Phase 15 — PREF-12 (Plan 06)
 */
import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import type { DietaryConflict } from '../../lib/dietary/types';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';

export interface MealConflictRecapProps {
  conflicts: DietaryConflict[];
  /** Drill-down optionnel — ouvre le RecipeViewer ou l'AllergenBanner */
  onPress?: () => void;
}

export const MealConflictRecap = React.memo(function MealConflictRecap({
  conflicts,
  onPress,
}: MealConflictRecapProps) {
  const { colors } = useThemeColors();

  // Aucun conflit — ne rien afficher (PREF-12 : bandeau absent si 0 conflit)
  if (conflicts.length === 0) return null;

  // Compter par sévérité
  const allergies = conflicts.filter(c => c.severity === 'allergie').length;
  const intolerances = conflicts.filter(c => c.severity === 'intolerance').length;

  // Couleur sémantique selon la sévérité maximale (allergie > intolérance > régime/aversion)
  const bgColor = allergies > 0
    ? colors.errorBg
    : intolerances > 0
    ? colors.warningBg
    : (colors.infoBg ?? colors.tagMention);

  const textColor = allergies > 0
    ? colors.errorText
    : intolerances > 0
    ? colors.warningText
    : (colors.info ?? colors.tagMentionText);

  // Texte conforme au copywriting UI-SPEC ligne 191
  const label = `${allergies} allergie(s), ${intolerances} intolérance(s) pour les convives sélectionnés`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderRadius: Radius.xs,
        },
      ]}
    >
      <Text style={[styles.text, { color: textColor }]}>
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  text: {
    fontSize: FontSize.label,
  },
});
