import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { DietaryConflict } from '../../lib/dietary/types';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

/**
 * AllergenBanner — P0 SAFETY (PREF-11)
 *
 * Composant garde-fou pour les conflits alimentaires dans le détail recette.
 *
 * CONTRAINTE ARCHITECTURALE :
 * Ce composant n'expose JAMAIS de prop dismiss (onDismiss / onClose / dismissible).
 * La ligne allergie est toujours rendue, non-collapsible, non-masquable.
 * Toute PR ajoutant une API dismiss doit être rejetée — le test statique
 * lib/__tests__/allergen-banner.test.ts bloque la compilation si ces props sont ajoutées.
 *
 * - pointerEvents="none" sur le container : résistance aux gestes accidentels
 * - Couleurs via useThemeColors() : zéro hex hardcodé
 * - Retourne null si conflicts=[] (bandeau absent si aucun conflit)
 */
export interface AllergenBannerProps {
  conflicts: DietaryConflict[];
  // ⚠ AUCUNE prop onDismiss / onClose / dismissible — PREF-11 P0 SAFETY
  // Toute PR ajoutant ces props doit être rejetée immédiatement.
}

export function AllergenBanner({ conflicts }: AllergenBannerProps) {
  const { colors } = useThemeColors();

  if (conflicts.length === 0) return null;

  const allergyConflicts = conflicts.filter(c => c.severity === 'allergie');
  const intoleranceConflicts = conflicts.filter(c => c.severity === 'intolerance');
  const preferenceConflicts = conflicts.filter(
    c => c.severity === 'regime' || c.severity === 'aversion',
  );

  return (
    // pointerEvents="none" : résistance aux gestes accidentels — P0 SAFETY PREF-11
    <View pointerEvents="none" style={styles.container}>
      {/* Ligne allergie : TOUJOURS visible, non-collapsible, jamais dans un CollapsibleSection */}
      {allergyConflicts.length > 0 && (
        <View
          style={[
            styles.row,
            {
              backgroundColor: colors.errorBg,
              borderColor: colors.error,
            },
          ]}
        >
          <Text style={[styles.text, { color: colors.errorText }]}>
            {`Allergie : ${allergyConflicts.map(c => c.matchedAllergen).join(', ')} — Risque vital pour ${allergyConflicts[0].profileNames.join(', ')}`}
          </Text>
        </View>
      )}

      {/* Ligne intolérance */}
      {intoleranceConflicts.length > 0 && (
        <View
          style={[
            styles.row,
            {
              backgroundColor: colors.warningBg,
              borderColor: colors.warning,
            },
          ]}
        >
          <Text style={[styles.text, { color: colors.warningText }]}>
            {`Intolérance : ${intoleranceConflicts.map(c => c.matchedAllergen).join(', ')} — Inconfort pour ${intoleranceConflicts[0].profileNames.join(', ')}`}
          </Text>
        </View>
      )}

      {/* Ligne régime / aversion */}
      {preferenceConflicts.length > 0 && (
        <View
          style={[
            styles.row,
            {
              backgroundColor: colors.tagMention,
              borderColor: colors.warning,
            },
          ]}
        >
          <Text style={[styles.text, { color: colors.tagMentionText }]}>
            {`Régime / Aversion : ${preferenceConflicts.map(c => c.matchedAllergen).join(', ')} — Préférence de ${preferenceConflicts[0].profileNames.join(', ')}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing['2xl'],
  },
  row: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  text: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
