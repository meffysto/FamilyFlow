/**
 * SecretMissionStamp.tsx — Animation tampon "CONFIDENTIEL"
 *
 * Effet visuel : le texte apparaît en zoom puis atterrit avec un spring,
 * accompagné d'un retour haptique lourd. Se ferme après 1.5s.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { FontSize, FontWeight } from '../constants/typography';
import { Spacing, Radius } from '../constants/spacing';

interface SecretMissionStampProps {
  visible: boolean;
  onFinish?: () => void;
}

function triggerHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

export const SecretMissionStamp = React.memo(function SecretMissionStamp({
  visible,
  onFinish,
}: SecretMissionStampProps) {
  const { colors } = useThemeColors();
  const scale = useSharedValue(3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 3;
      opacity.value = 0;
      return;
    }

    // Lancer l'animation du tampon
    scale.value = withSpring(1, { damping: 8, stiffness: 120 }, (finished) => {
      if (finished) {
        runOnJS(triggerHaptic)();
      }
    });
    opacity.value = withTiming(1, { duration: 200 });

    // Fermer après 1.5s
    const timeout = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300 });
      if (onFinish) onFinish();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: '-12deg' },
    ],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
      <Animated.View
        style={[
          styles.stampContainer,
          { borderColor: colors.error },
          animatedStyle,
        ]}
      >
        <Animated.Text style={[styles.stampText, { color: colors.error }]}>
          CONFIDENTIEL
        </Animated.Text>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  stampContainer: {
    borderWidth: 4,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.lg,
  },
  stampText: {
    fontSize: FontSize.hero + 8,
    fontWeight: FontWeight.heavy,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
