/**
 * PlantWagerBadge.tsx — Badge overlay sur plants scellés (Phase 40 Plan 03).
 *
 * **Zéro animation, zéro reanimated, zéro timer.** Pure View + Text memoïsé.
 *
 * Affichage simplifié : une seule ligne `cumulCurrent/cumulTarget`
 * (ex: "3/6"). Les props tasksToday/tasksTargetToday sont gardées pour
 * compat parent mais non affichées — décision UX utilisateur post-QA.
 *
 * Règles :
 *   - Badge visible dès plantation (stage 0) — G6 : feedback progression.
 *   - Consommation DIRECTE de wager.cumulCurrent/cumulTarget (Plan 01).
 *   - 3 couleurs pace via tokens theme (successBg/warningBg/errorBg).
 *   - React.memo obligatoire : N plants scellés simultanés.
 *
 * Couleur de fond dérivée de `paceLevel` :
 *   - 'green'  → colors.successBg / successText (en avance ou à l'heure)
 *   - 'yellow' → colors.warningBg / warningText (léger retard)
 *   - 'orange' → colors.errorBg / errorText   (retard marqué, jamais punitif)
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { PaceLevel } from '../../lib/mascot/wager-ui-helpers';

interface PlantWagerBadgeProps {
  /** Cumul courant du pari (wager.cumulCurrent, Plan 01). */
  cumulCurrent: number;
  /** Cumul cible du pari (wager.cumulTarget, Plan 01). */
  cumulTarget: number;
  /** Tâches complétées aujourd'hui — consommé DIRECTEMENT depuis wager.tasksCompletedToday (B1). */
  tasksToday: number;
  /** Cible tâches du jour — calculée par le parent à partir de wager.totalDays (B2). */
  tasksTargetToday: number;
  /** Niveau pace dérivé via computePaceLevel(cumulCurrent, cumulTarget, daysElapsed, totalDays). */
  paceLevel: PaceLevel;
}

function PlantWagerBadgeBase({
  cumulCurrent,
  cumulTarget,
  tasksToday,
  tasksTargetToday,
  paceLevel,
}: PlantWagerBadgeProps) {
  const { colors } = useThemeColors();

  // Palette pace — 3 couleurs via tokens theme, zéro hardcoded.
  const palette = useMemo(() => {
    switch (paceLevel) {
      case 'green':
        return { bg: colors.successBg, text: colors.successText, border: colors.success };
      case 'yellow':
        return { bg: colors.warningBg, text: colors.warningText, border: colors.warning };
      case 'orange':
        return { bg: colors.errorBg, text: colors.errorText, border: colors.error };
    }
  }, [paceLevel, colors]);

  // Fallback P2 : si cumulTarget === 0 (pari auto-gagné), affiche ✓ neutre.
  const isAutoWon = cumulTarget === 0;
  const label = isAutoWon ? '✓' : `${cumulCurrent}/${cumulTarget}`;

  const accessibilityLabel = isAutoWon
    ? 'Pari scellé : objectif déjà atteint'
    : `Pari : ${cumulCurrent} tâches sur ${cumulTarget} pour valider`;

  // Suppress unused props — gardés pour compat parent (WorldGridView)
  void tasksToday;
  void tasksTargetToday;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
      pointerEvents="none"
    >
      <Text
        style={[styles.line1, { color: palette.text }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}

/** React.memo — évite re-render sur update parent si props inchangées (N plants simultanés). */
export const PlantWagerBadge = React.memo(PlantWagerBadgeBase);

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -Spacing.xs,
    right: -Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    zIndex: 12,
  },
  line1: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    lineHeight: 14,
  },
  line2: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: 12,
    marginTop: 1,
  },
});
