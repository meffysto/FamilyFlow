/**
 * SkillNode.tsx — Noeud de compétence pour l'arbre de compétences
 *
 * 3 états visuels : verrouillé, débloquable (pulse), débloqué (spring + haptics)
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { Shadows } from '../constants/shadows';

interface SkillNodeProps {
  label: string;
  emoji: string;
  state: 'locked' | 'unlockable' | 'unlocked';
  onPress: () => void;
  size?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SkillNode({ label, emoji, state, onPress, size = 52 }: SkillNodeProps) {
  const { primary, colors } = useThemeColors();

  const scale = useSharedValue(1);
  const borderPulse = useSharedValue(0);
  const prevState = useSharedValue(state);

  // Pulsation de la bordure pour l'état débloquable
  useEffect(() => {
    if (state === 'unlockable') {
      borderPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0, { duration: 800 }),
        ),
        -1,
        false,
      );
    } else {
      borderPulse.value = withTiming(0, { duration: 200 });
    }
  }, [state]);

  // Animation spring + haptics lors du déblocage
  useEffect(() => {
    if (prevState.value !== 'unlocked' && state === 'unlocked') {
      scale.value = 0.6;
      scale.value = withSpring(1, { damping: 8, stiffness: 300 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevState.value = state;
  }, [state]);

  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const primaryRgb = hexToRgbValues(primary);
  const isUnlockable = state === 'unlockable';

  const animatedBorderStyle = useAnimatedStyle(() => {
    if (!isUnlockable) return {};
    const opacity = 0.4 + borderPulse.value * 0.6;
    return {
      borderWidth: 2.5,
      borderColor: `rgba(${primaryRgb}, ${opacity})`,
    };
  });

  const renderContent = () => {
    switch (state) {
      case 'locked':
        return <Text style={[styles.emoji, { fontSize: size * 0.38 }]}>🔒</Text>;
      case 'unlockable':
        return <Text style={[styles.emoji, { fontSize: size * 0.42 }]}>{emoji}</Text>;
      case 'unlocked':
        return <Text style={[styles.checkmark, { fontSize: size * 0.4, color: colors.onPrimary }]}>✓</Text>;
    }
  };

  const circleBackground = () => {
    switch (state) {
      case 'locked':
        return colors.cardAlt;
      case 'unlockable':
        return colors.card;
      case 'unlocked':
        return primary;
    }
  };

  return (
    <View style={styles.container}>
      <AnimatedPressable
        onPress={state !== 'locked' ? onPress : undefined}
        style={[
          animatedScaleStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${state === 'locked' ? 'verrouillé' : state === 'unlockable' ? 'débloquable' : 'débloqué'}`}
        accessibilityState={{ disabled: state === 'locked' }}
      >
        <Animated.View
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: circleBackground(),
              opacity: state === 'locked' ? 0.4 : 1,
            },
            state === 'unlocked' && Shadows.md,
            animatedBorderStyle,
          ]}
        >
          {renderContent()}
        </Animated.View>
      </AnimatedPressable>
      <Text
        style={[styles.label, { color: colors.textSub }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Convertit un hex (#RRGGBB) en string "R, G, B" pour rgba()
 */
function hexToRgbValues(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 64,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    textAlign: 'center',
  },
  checkmark: {
    fontWeight: '700',
    textAlign: 'center',
    // color défini dynamiquement via colors.onPrimary
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    width: 64,
    lineHeight: 13,
  },
});
