/**
 * SwipeToDelete.tsx — Swipe-to-delete style Apple Mail
 *
 * Gesture.Pan() custom pour supporter le full-swipe auto-delete.
 * - Swipe partiel → bouton Supprimer rouge
 * - Swipe complet (>60% ou vélocité rapide) → suppression directe
 * - Haptics au passage du seuil
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useThemeColors } from '../contexts/ThemeContext';
import { FontSize, FontWeight } from '../constants/typography';

const SWIPE_HINT_KEY = 'swipe_hint_count';
const MAX_HINT_COUNT = 3;
const ACTION_WIDTH = 80;
const FULL_SWIPE_RATIO = 0.5;
const VELOCITY_THRESHOLD = -800;

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
  confirmTitle?: string;
  confirmMessage?: string;
  skipConfirm?: boolean;
  disabled?: boolean;
  hintId?: string;
}

export function SwipeToDelete({
  onDelete,
  children,
  confirmTitle,
  confirmMessage,
  skipConfirm = false,
  disabled = false,
  hintId,
}: SwipeToDeleteProps) {
  const { colors } = useThemeColors();
  const { t } = useTranslation();
  const resolvedTitle = confirmTitle ?? t('swipeToDelete.confirmTitle');
  const reduceMotion = useReducedMotion();
  const deletingRef = useRef(false);

  // Shared values
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const rowWidth = useSharedValue(0);
  const rowHeight = useSharedValue<number | undefined>(undefined);
  const isOpen = useSharedValue(false);
  const hintX = useSharedValue(0);
  const [showHint, setShowHint] = useState(false);

  // Hint animation (3 premières fois)
  useEffect(() => {
    if (disabled || !hintId) return;
    (async () => {
      const key = `${SWIPE_HINT_KEY}_${hintId}`;
      const raw = await SecureStore.getItemAsync(key);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count < MAX_HINT_COUNT) {
        setShowHint(true);
        await SecureStore.setItemAsync(key, String(count + 1));
        if (!reduceMotion) {
          hintX.value = withDelay(
            800,
            withSequence(
              withTiming(-40, { duration: 400, easing: Easing.out(Easing.cubic) }),
              withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }),
            )
          );
        }
      }
    })();
  }, [hintId, disabled]);

  // Haptics au seuil de full-swipe
  const triggerThresholdHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  useAnimatedReaction(
    () => {
      if (rowWidth.value === 0) return false;
      return Math.abs(translateX.value) > rowWidth.value * FULL_SWIPE_RATIO;
    },
    (passed, prev) => {
      if (passed && !prev) {
        runOnJS(triggerThresholdHaptic)();
      }
    }
  );

  // Delete handlers
  const performDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (skipConfirm) {
      deletingRef.current = false;
      onDelete();
      return;
    }
    Alert.alert(resolvedTitle, confirmMessage, [
      {
        text: t('common.cancel'), style: 'cancel',
        onPress: () => {
          deletingRef.current = false;
          translateX.value = withSpring(0);
          isOpen.value = false;
        },
      },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: () => {
          deletingRef.current = false;
          onDelete();
        },
      },
    ]);
  }, [onDelete, resolvedTitle, confirmMessage, skipConfirm, t]);

  const performDeleteFromAction = useCallback(() => {
    performDelete();
  }, [performDelete]);

  // Gesture
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const newX = startX.value + e.translationX;
      // Seulement swipe gauche, avec friction au-delà de ACTION_WIDTH
      translateX.value = Math.min(0, newX);
    })
    .onEnd((e) => {
      const absX = Math.abs(translateX.value);
      const threshold = rowWidth.value * FULL_SWIPE_RATIO;
      const isFastFlick = e.velocityX < VELOCITY_THRESHOLD;
      const isFullSwipe = absX > threshold || isFastFlick;

      if (isFullSwipe) {
        // Full swipe → animer hors écran puis supprimer
        translateX.value = withTiming(-rowWidth.value, { duration: 200 }, () => {
          runOnJS(performDelete)();
        });
        isOpen.value = false;
      } else if (absX > ACTION_WIDTH / 2) {
        // Swipe partiel → snap ouvert (montrer bouton)
        translateX.value = withSpring(-ACTION_WIDTH, { damping: 20, stiffness: 200 });
        isOpen.value = true;
      } else {
        // Pas assez → snap fermé
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        isOpen.value = false;
      }
    });

  // Tap pour fermer quand ouvert
  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isOpen.value) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      isOpen.value = false;
    }
  });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // Layout
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    rowWidth.value = e.nativeEvent.layout.width;
    if (rowHeight.value === undefined) {
      rowHeight.value = e.nativeEvent.layout.height;
    }
  }, []);

  // Animated styles
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value + (showHint ? hintX.value : 0) }],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    width: Math.abs(Math.min(translateX.value, 0)),
  }));

  const actionTextOpacity = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(translateX.value) / ACTION_WIDTH, 1),
  }));

  if (disabled) return <>{children}</>;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Fond rouge derrière */}
      <Animated.View style={[styles.actionContainer, { backgroundColor: colors.error }, actionStyle]}>
        <Animated.Text style={[styles.actionText, { color: colors.onPrimary }, actionTextOpacity]}
          onPress={performDeleteFromAction}
        >
          {t('swipeToDelete.deleteAction')}
        </Animated.Text>
      </Animated.View>

      {/* Contenu swipeable */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={rowStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  actionContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  actionText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    paddingHorizontal: 16,
  },
});
