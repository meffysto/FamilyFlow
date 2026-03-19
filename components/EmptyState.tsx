/**
 * EmptyState.tsx — Composant d'état vide animé et émotionnel
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

interface EmptyStateProps {
  emoji: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ emoji, title, subtitle, ctaLabel, onCta }: EmptyStateProps) {
  const { primary, colors } = useThemeColors();
  const reduceMotion = useReducedMotion();
  const emojiScale = useSharedValue(reduceMotion ? 1 : 0.3);

  useEffect(() => {
    if (!reduceMotion) {
      emojiScale.value = withSpring(1, { damping: 12, stiffness: 150 });
    }
  }, []);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.emoji, emojiStyle]}>{emoji}</Animated.Text>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textFaint }]}>{subtitle}</Text>
      ) : null}
      {ctaLabel && onCta ? (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: primary }]}
          onPress={onCta}
          activeOpacity={0.8}
        >
          <Text style={[styles.ctaText, { color: colors.onPrimary }]}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
    paddingHorizontal: Spacing['3xl'],
  },
  emoji: {
    fontSize: 56,
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    marginTop: Spacing['2xl'],
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
  },
  ctaText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
