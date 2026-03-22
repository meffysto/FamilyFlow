/**
 * CoachMark.tsx — Bulle contextuelle avec pointeur (coach mark unitaire)
 *
 * Bulle animée (spring reanimated) positionnée au-dessus ou en-dessous
 * d'un élément cible. Pas de SVG, tout en Views.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { useTranslation } from 'react-i18next';
import { Shadows } from '../../constants/shadows';

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CoachMarkProps {
  /** Zone cible (coordonnées absolues fenêtre) */
  targetRect: TargetRect;
  /** Titre court (optionnel) */
  title?: string;
  /** Texte explicatif */
  body: string;
  /** Position de la bulle par rapport à la cible */
  position: 'above' | 'below';
  /** Étape actuelle / total */
  step?: { current: number; total: number };
  /** Callback suivant */
  onNext?: () => void;
  /** Callback fermer */
  onDismiss: () => void;
  /** Label du bouton principal */
  buttonLabel?: string;
}

const BUBBLE_MAX_WIDTH = 300;
const BUBBLE_PADDING = Spacing['3xl'];
const ARROW_SIZE = 10;
const SCREEN_MARGIN = Spacing['2xl'];

export const CoachMark = React.memo(function CoachMark({
  targetRect,
  title,
  body,
  position,
  step,
  onNext,
  onDismiss,
  buttonLabel,
}: CoachMarkProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Animation d'entrée
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : (position === 'below' ? -8 : 8));

  useEffect(() => {
    if (!reduceMotion) {
      opacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 150, mass: 0.8 });
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Calcul position horizontale de la bulle (centrée sur la cible, clampée aux bords)
  const targetCenterX = targetRect.x + targetRect.width / 2;
  const bubbleWidth = Math.min(BUBBLE_MAX_WIDTH, screenWidth - SCREEN_MARGIN * 2);
  let bubbleLeft = targetCenterX - bubbleWidth / 2;
  bubbleLeft = Math.max(SCREEN_MARGIN, Math.min(bubbleLeft, screenWidth - bubbleWidth - SCREEN_MARGIN));

  // Position verticale
  const bubbleTop = position === 'below'
    ? targetRect.y + targetRect.height + ARROW_SIZE + 4
    : undefined;
  const bubbleBottom = position === 'above'
    ? undefined
    : undefined;

  // Pour 'above', on utilise un top calculé
  const computedTop = position === 'above'
    ? targetRect.y - ARROW_SIZE - 4  // La bulle sera positionnée par son bottom edge
    : bubbleTop;

  // Flèche positionnée au centre de la cible
  const arrowLeft = targetCenterX - bubbleLeft - ARROW_SIZE;

  const label = buttonLabel || (step && step.current < step.total ? t('coachMark.next') : t('coachMark.gotIt'));

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        {
          left: bubbleLeft,
          width: bubbleWidth,
          ...(position === 'below'
            ? { top: computedTop }
            : { top: computedTop, transform: [{ translateY: -100 }] }  // sera override par le style positionné
          ),
        },
        position === 'above' && { bottom: undefined },
      ]}
      // Pour 'above', position par rapport au bas de la bulle
      accessibilityRole="alert"
      accessibilityViewIsModal
    >
      {/* Flèche haut (quand bulle en dessous de la cible) */}
      {position === 'below' && (
        <View
          style={[
            styles.arrowUp,
            {
              left: Math.max(12, Math.min(arrowLeft, bubbleWidth - 24)),
              borderBottomColor: colors.card,
            },
          ]}
        />
      )}

      {/* Contenu de la bulle */}
      <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.lg]}>
        {title && (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        )}
        <Text style={[styles.body, { color: colors.textSub }]}>{body}</Text>

        {/* Footer : passer + suivant + indicateur */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('coachMark.skipA11y')}
            accessibilityRole="button"
          >
            <Text style={[styles.skipLabel, { color: colors.textMuted }]}>{t('coachMark.skip')}</Text>
          </TouchableOpacity>

          <View style={styles.rightFooter}>
            {step && step.total > 1 && (
              <Text style={[styles.stepIndicator, { color: colors.textFaint }]}>
                {step.current}/{step.total}
              </Text>
            )}
            <TouchableOpacity
              onPress={onNext || onDismiss}
              style={[styles.nextButton, { backgroundColor: primary }]}
              accessibilityLabel={step ? t('coachMark.stepA11y', { label, current: step.current, total: step.total }) : label}
              accessibilityRole="button"
            >
              <Text style={[styles.nextLabel, { color: colors.onPrimary }]}>{label}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Flèche bas (quand bulle au-dessus de la cible) */}
      {position === 'above' && (
        <View
          style={[
            styles.arrowDown,
            {
              left: Math.max(12, Math.min(arrowLeft, bubbleWidth - 24)),
              borderTopColor: colors.card,
            },
          ]}
        />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1001,
  },
  arrowUp: {
    position: 'absolute',
    top: -ARROW_SIZE,
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderBottomWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 1002,
  },
  arrowDown: {
    position: 'absolute',
    bottom: -ARROW_SIZE,
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 1002,
  },
  bubble: {
    borderRadius: Radius.xl,
    padding: BUBBLE_PADDING,
    borderWidth: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    lineHeight: 22,
    marginBottom: Spacing['2xl'],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  rightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepIndicator: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  nextButton: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  nextLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
