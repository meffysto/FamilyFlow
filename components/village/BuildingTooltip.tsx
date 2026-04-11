// components/village/BuildingTooltip.tsx
// Phase 30 — Bulle tooltip flottante au tap sur un BuildingSprite.
// Fork de AvatarTooltip (Phase 29) — même animation contract (180/150/2500ms),
// prop `label` unique au lieu de profileName + count.
// Per D-13, D-14 CONTEXT.md — VILL-04.

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ── Constantes animation et layout (mirror AvatarTooltip) ──────────
const DISMISS_MS = 2500;
const ENTER_MS = 180;
const EXIT_MS = 150;
const MAX_WIDTH = 200;
const TRANSLATE_Y_START = -4;
// Bâtiment 72×72 > avatar 48×48 → offset agrandi pour rester au-dessus du sprite
const OFFSET_ABOVE_SPRITE = 52;

interface BuildingTooltipProps {
  /** Texte à afficher, ex: "Café — Débloqué à 1500 feuilles familiales" */
  label: string;
  /** Position centree px du sprite cible */
  x: number;
  y: number;
  /** Largeur du container map pour clamp horizontal (Pitfall 6 Phase 29) */
  containerWidth: number;
  onDismiss: () => void;
}

export function BuildingTooltip({
  label,
  x,
  y,
  containerWidth,
  onDismiss,
}: BuildingTooltipProps) {
  const { colors } = useThemeColors();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(TRANSLATE_Y_START);

  useEffect(() => {
    // Entree : fade + slide
    opacity.value = withTiming(1, { duration: ENTER_MS });
    translateY.value = withTiming(0, { duration: ENTER_MS });

    // Auto-dismiss apres 2.5s (per D-13)
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: EXIT_MS });
      translateY.value = withTiming(
        TRANSLATE_Y_START,
        { duration: EXIT_MS },
        (finished) => {
          if (finished) runOnJS(onDismiss)();
        },
      );
    }, DISMISS_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Clamp horizontal pour ne pas deborder (per Pitfall 6 Phase 29)
  const rawLeft = x - MAX_WIDTH / 2;
  const clampedLeft = Math.max(
    Spacing.md,
    Math.min(containerWidth - MAX_WIDTH - Spacing.md, rawLeft),
  );

  return (
    <Animated.View
      style={[
        styles.tooltip,
        {
          left: clampedLeft,
          top: y - OFFSET_ABOVE_SPRITE,
          backgroundColor: colors.card,
        },
        animStyle,
      ]}
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text
        style={[styles.text, { color: colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.normal,
  },
});
