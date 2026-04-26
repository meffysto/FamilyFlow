/**
 * FAB.tsx — Bouton d'action flottant (Floating Action Button) avec speed-dial
 *
 * Usage :
 *   <FAB actions={[{ id: 'task', emoji: '📋', label: 'Tâche', onPress: () => {} }]} />
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  SharedValue,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import type { LucideIcon } from 'lucide-react-native';

export interface FABAction {
  id: string;
  /** Icône lucide rendue dans le bouton rond (couleur héritée via primary) */
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
}

export interface FABProps {
  actions: FABAction[];
}

const MAIN_SIZE = 56;
const ACTION_SIZE = 44;
const ACTION_GAP = 8;
const ACTION_OFFSET_RIGHT = (MAIN_SIZE - ACTION_SIZE) / 2;

const TIMING_CONFIG = { duration: 200, easing: Easing.out(Easing.cubic) };

function FABComponent({ actions }: FABProps) {
  const { t } = useTranslation();
  const { primary, colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    progress.value = reduceMotion ? (next ? 1 : 0) : withTiming(next ? 1 : 0, TIMING_CONFIG);
  }, [open, progress, reduceMotion]);

  const close = useCallback(() => {
    setOpen(false);
    progress.value = reduceMotion ? 0 : withTiming(0, TIMING_CONFIG);
  }, [progress, reduceMotion]);

  // Rotation animée du "+" → "×"
  const mainAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
  }));

  // Backdrop opacity
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    pointerEvents: progress.value > 0.01 ? 'auto' : 'none',
  }));

  return (
    <>
      {/* Backdrop avec blur */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Container FAB */}
      <View style={[styles.container, { bottom: 70 + Math.max(insets.bottom, 20) }]} pointerEvents="box-none">
        {/* Actions speed-dial */}
        {actions.map((action, index) => (
          <FABActionItem
            key={action.id}
            action={action}
            index={index}
            progress={progress}
            primary={primary}
            colors={colors}
            onPress={() => {
              close();
              action.onPress();
            }}
          />
        ))}

        {/* Bouton principal */}
        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: primary }]}
          onPress={toggle}
          activeOpacity={0.8}
          accessibilityLabel={open ? t('fab.closeMenuA11y') : t('fab.addA11y')}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Animated.Text style={[styles.mainIcon, { color: colors.onPrimary }, mainAnimStyle]}>
            +
          </Animated.Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

/** Élément d'action individuel dans le speed-dial */
function FABActionItem({
  action,
  index,
  progress,
  primary,
  colors,
  onPress,
}: {
  action: FABAction;
  index: number;
  progress: SharedValue<number>;
  primary: string;
  colors: ReturnType<typeof useThemeColors>['colors'];
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const FIRST_GAP = 20;
  const offset = FIRST_GAP + index * (ACTION_SIZE + ACTION_GAP) + ACTION_SIZE;

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -offset]) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [0, 0.5, 1]) },
    ],
    opacity: progress.value,
  }));

  return (
    <Animated.View style={[styles.actionRow, animStyle]}>
      {/* Label */}
      <View style={[styles.labelBadge, { backgroundColor: colors.card }]}>
        <Text style={[styles.labelText, { color: colors.text }]}>{action.label}</Text>
      </View>
      {/* Bouton rond */}
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: primary }]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel={t('fab.addItemA11y', { label: action.label })}
        accessibilityRole="button"
      >
        <action.Icon size={20} strokeWidth={1.75} color={colors.brand.parchment} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export const FAB = React.memo(FABComponent);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 90,
    overflow: 'hidden',
  },
  container: {
    position: 'absolute',
    bottom: 90,
    right: Spacing['3xl'],
    alignItems: 'flex-end',
    zIndex: 100,
  },
  mainButton: {
    width: MAIN_SIZE,
    height: MAIN_SIZE,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
  mainIcon: {
    fontSize: FontSize.icon,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.icon + 2,
  },
  actionRow: {
    position: 'absolute',
    bottom: 0,
    right: ACTION_OFFSET_RIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  labelBadge: {
    minWidth: 72,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  labelText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  actionButton: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
});
