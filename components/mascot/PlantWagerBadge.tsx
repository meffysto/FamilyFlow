/**
 * PlantWagerBadge.tsx — Badge overlay 2-LIGNES sur plants scellés (Phase 40 Plan 03).
 *
 * **Zéro animation, zéro reanimated, zéro timer.** Pure View + Text memoïsé.
 *
 * Règles verrouillées (CONTEXT.md décision D-03) :
 *   - 2 LIGNES OBLIGATOIRES — ligne 1 "X/Y tâches aujourd'hui", ligne 2 "cumul Z/N".
 *   - Badge visible dès plantation (stage 0) — G6 : feedback progression quotidienne.
 *   - Consommation DIRECTE de `wager.tasksCompletedToday` + `wager.totalDays` (B1/B2).
 *     Aucun magic number ni fallback `/7` — le parent calcule `tasksTargetToday` à partir
 *     de valeurs persistées par Plan 01.
 *   - 3 couleurs pace via tokens theme (successBg/warningBg/errorBg) — zéro hardcoded.
 *   - React.memo obligatoire : N plants scellés simultanés sans impact CPU.
 *
 * Couleur de fond dérivée de `paceLevel` :
 *   - 'green'  → colors.successBg / successText (en avance ou à l'heure)
 *   - 'yellow' → colors.warningBg / warningText (léger retard bienveillant)
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

  // Fallback P2 : si cumulTarget === 0 (pari auto-gagné ou données pas encore recompute),
  // on affiche un état neutre "✓" + "—/—" pour éviter l'affichage bancal 0/0.
  const isAutoWon = cumulTarget === 0;
  const line1 = isAutoWon ? '—/—' : `${tasksToday}/${tasksTargetToday}`;
  const line2 = isAutoWon ? '✓' : `${cumulCurrent}/${cumulTarget}`;

  const accessibilityLabel = isAutoWon
    ? 'Pari scellé : objectif déjà atteint'
    : `Pari : ${tasksToday} sur ${tasksTargetToday} tâches aujourd'hui, cumul ${cumulCurrent} sur ${cumulTarget}`;

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
        {line1}
      </Text>
      <Text
        style={[styles.line2, { color: colors.textMuted }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {line2}
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
