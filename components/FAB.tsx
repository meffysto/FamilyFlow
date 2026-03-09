/**
 * FAB.tsx — Bouton d'action flottant (Floating Action Button) avec speed-dial
 *
 * Usage :
 *   <FAB actions={[{ id: 'task', emoji: '📋', label: 'Tâche', onPress: () => {} }]} />
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  SharedValue,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

export interface FABAction {
  id: string;
  emoji: string;
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
  const { primary, colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    progress.value = withTiming(next ? 1 : 0, TIMING_CONFIG);
  }, [open, progress]);

  const close = useCallback(() => {
    setOpen(false);
    progress.value = withTiming(0, TIMING_CONFIG);
  }, [progress]);

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
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
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
          accessibilityLabel={open ? 'Fermer le menu d\'ajout rapide' : 'Ajouter'}
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
        accessibilityLabel={`Ajouter ${action.label}`}
        accessibilityRole="button"
      >
        <Text style={styles.actionEmoji}>{action.emoji}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export const FAB = React.memo(FABComponent);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 90,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  actionEmoji: {
    fontSize: FontSize.title,
  },
});
