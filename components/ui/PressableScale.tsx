/**
 * PressableScale.tsx — Pressable avec animation spring de scale
 *
 * Fournit un retour visuel (scale down) + haptic sur pression.
 * Respecte useReducedMotion() — désactive l'animation si l'utilisateur
 * a activé "Réduire les animations" dans les réglages d'accessibilité.
 */

import React from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Config spring identique pour toutes les instances
const SPRING_CONFIG = { damping: 15, stiffness: 150 };

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  /** Valeur de scale au moment du press. Default: 0.97 */
  scaleValue?: number;
  disabled?: boolean;
}

export const PressableScale = React.memo(function PressableScale({
  children,
  onPress,
  style,
  scaleValue = 0.97,
  disabled = false,
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        // Haptic + animation à l'appui
        Haptics.selectionAsync();
        if (!reduceMotion) {
          scale.value = withSpring(scaleValue, SPRING_CONFIG);
        }
      }}
      onPressOut={() => {
        if (!reduceMotion) {
          scale.value = withSpring(1, SPRING_CONFIG);
        }
      }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={style}
    >
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </Pressable>
  );
});
