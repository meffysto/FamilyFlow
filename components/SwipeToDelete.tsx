/**
 * SwipeToDelete.tsx — Wrapper swipe-to-delete réutilisable
 *
 * Utilise ReanimatedSwipeable (pas Swipeable) pour éviter les conflits.
 * NE PAS utiliser dans un ScrollView (conflit de geste).
 */

import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
  confirmTitle?: string;
  confirmMessage?: string;
  /** Si true, appelle onDelete directement sans confirmation (utile si onDelete gère déjà sa propre Alert) */
  skipConfirm?: boolean;
  disabled?: boolean;
}

export function SwipeToDelete({
  onDelete,
  children,
  confirmTitle = 'Supprimer ?',
  confirmMessage,
  skipConfirm = false,
  disabled = false,
}: SwipeToDeleteProps) {
  const { colors } = useThemeColors();
  const swipeableRef = useRef<any>(null);

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (skipConfirm) {
      swipeableRef.current?.close();
      onDelete();
      return;
    }
    Alert.alert(confirmTitle, confirmMessage, [
      { text: 'Annuler', style: 'cancel', onPress: () => swipeableRef.current?.close() },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          swipeableRef.current?.close();
          onDelete();
        },
      },
    ]);
  }, [onDelete, confirmTitle, confirmMessage, skipConfirm]);

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
      overshootRight={false}
      rightThreshold={60}
      friction={2}
    >
      {children}
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
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drag.value, [0, -80], [0, 1]),
  }));

  return (
    <Animated.View style={[styles.rightAction, { backgroundColor: colors.error }, animStyle]}>
      <Text style={[styles.rightActionText, { color: colors.onPrimary }]} onPress={onPress}>
        🗑 Supprimer
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rightAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 12,
    marginLeft: 8,
  },
  rightActionText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
