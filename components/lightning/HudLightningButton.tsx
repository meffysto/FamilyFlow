/**
 * HudLightningButton — Bouton HUD ⚡ Lightning sur l'écran ferme.
 *
 * Plan 53-03a — composant visuel pur.
 *
 * Sibling visuel des boutons 📖 (codex) et 📷 (screenshot) déjà présents dans
 * `app/(tabs)/tree.tsx` (lignes 3508-3524). Le style est COPIÉ VERBATIM depuis
 * `app/(tabs)/tree.tsx` lignes 4035-4048 (`hudCodexButton` + `hudEmoji`). Seul
 * le glyph emoji `⚡` et le `testID` / `accessibilityLabel` diffèrent.
 *
 * Animation Reanimated 4 : la méthode impérative `triggerPulse()` lance un
 * scale 1→1.2→1 spring (LIGHTNING_PULSE_SPRING). Plan 03b la branche sur le
 * listener `onPayoutSuccess` (Plan 01) via la ref.
 */

import React, { forwardRef, useImperativeHandle } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Spacing, Radius } from '../../constants/spacing';
import { useFarmTheme } from '../../constants/farm-theme';

/**
 * Config spring pulse pay-out reçu (UI-SPEC Animation 1, D-04).
 * Durée totale estimée ~600ms (montée + descente).
 */
const LIGHTNING_PULSE_SPRING: WithSpringConfig = {
  damping: 10,
  stiffness: 180,
};

export interface HudLightningButtonRef {
  /** Déclenche la pulse 1→1.2→1 + haptic light (consommé Plan 03b). */
  triggerPulse: () => void;
}

interface HudLightningButtonProps {
  onPress: () => void;
}

export const HudLightningButton = forwardRef<HudLightningButtonRef, HudLightningButtonProps>(
  function HudLightningButton({ onPress }, ref) {
    const { farm } = useFarmTheme();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    useImperativeHandle(
      ref,
      () => ({
        triggerPulse: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          scale.value = withSpring(1.2, LIGHTNING_PULSE_SPRING, () => {
            scale.value = withSpring(1, LIGHTNING_PULSE_SPRING);
          });
        },
      }),
      [scale],
    );

    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          // Style hudCodexButton — valeurs numériques VERBATIM depuis tree.tsx:4035-4048.
          // Les couleurs farm dépendent du thème (farm.parchmentDark / farm.woodDark)
          // donc résolues via hook plutôt que figées dans le StyleSheet.
          style={[
            styles.hudCodexButton,
            { backgroundColor: farm.parchmentDark, borderColor: farm.woodDark },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onPress();
          }}
          accessibilityLabel="Portefeuille Lightning"
          accessibilityRole="button"
          testID="hud-lightning-button"
        >
          <Text style={styles.hudEmoji}>{'⚡'}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  // VERBATIM depuis app/(tabs)/tree.tsx:4035-4048 (WARNING #8 — interdiction de
  // paraphraser/recalculer). Seuls farm.parchmentDark et farm.woodDark sont
  // déplacés inline plus haut car ils dépendent du thème (clair/sombre).
  hudCodexButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  hudEmoji: {
    fontSize: 14,
  },
});
