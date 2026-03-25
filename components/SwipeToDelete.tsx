/**
 * SwipeToDelete.tsx — Wrapper swipe-to-delete réutilisable
 *
 * Utilise ReanimatedSwipeable (pas Swipeable) pour éviter les conflits.
 * NE PAS utiliser dans un ScrollView (conflit de geste).
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontSize, FontWeight } from '../constants/typography';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useThemeColors } from '../contexts/ThemeContext';

const SWIPE_HINT_KEY = 'swipe_hint_count';
const MAX_HINT_COUNT = 3;

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
  confirmTitle?: string;
  confirmMessage?: string;
  /** Si true, appelle onDelete directement sans confirmation (utile si onDelete gère déjà sa propre Alert) */
  skipConfirm?: boolean;
  disabled?: boolean;
  /** Identifiant pour le hint (ex: 'tasks', 'rdv') — un compteur par contexte */
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
  const swipeableRef = useRef<any>(null);
  const deletingRef = useRef(false);
  const hintX = useSharedValue(0);
  const [showHint, setShowHint] = useState(false);

  // Afficher le hint les 3 premières fois
  useEffect(() => {
    if (disabled || !hintId) return;
    (async () => {
      const key = `${SWIPE_HINT_KEY}_${hintId}`;
      const raw = await SecureStore.getItemAsync(key);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count < MAX_HINT_COUNT) {
        setShowHint(true);
        await SecureStore.setItemAsync(key, String(count + 1));
        // Animation : glisser légèrement à gauche puis revenir (skip si reduceMotion)
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

  const hintStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: hintX.value }],
  }));

  const handleDelete = useCallback(() => {
    // Guard contre double déclenchement (onSwipeableOpen + onPress simultanés)
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (skipConfirm) {
      swipeableRef.current?.close();
      deletingRef.current = false;
      onDelete();
      return;
    }
    Alert.alert(resolvedTitle, confirmMessage, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => { swipeableRef.current?.close(); deletingRef.current = false; } },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: () => {
          swipeableRef.current?.close();
          deletingRef.current = false;
          onDelete();
        },
      },
    ]);
  }, [onDelete, resolvedTitle, confirmMessage, skipConfirm, t]);

  const renderRightActions = useCallback(
    (_progress: SharedValue<number>, drag: SharedValue<number>) => {
      return (
        <RightAction drag={drag} onPress={handleDelete} colors={colors} />
      );
    },
    [handleDelete, colors]
  );

  if (disabled) return <>{children}</>;

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') handleDelete();
      }}
      overshootRight={false}
      rightThreshold={60}
      friction={2}
    >
      <Animated.View style={showHint ? hintStyle : undefined}>
        {children}
      </Animated.View>
    </ReanimatedSwipeable>
  );
}

function RightAction({
  drag,
  onPress,
  colors,
}: {
  drag: SharedValue<number>;
  onPress: () => void;
  colors: any;
}) {
  const { t } = useTranslation();
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drag.value, [0, -80], [0, 1]),
  }));

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Animated.View style={[styles.rightAction, { backgroundColor: colors.error }, animStyle]}>
        <Text style={[styles.rightActionText, { color: colors.onPrimary }]}>
          {t('swipeToDelete.deleteAction')}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rightAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 12,
    marginLeft: 8,
    marginBottom: 10,
  },
  rightActionText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
});
