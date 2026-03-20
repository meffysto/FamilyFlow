/**
 * AllDoneOverlay.tsx — Célébration "Journée terminée"
 *
 * Overlay confettis + carte animée quand toutes les tâches sont faites.
 * Basé sur CategoryCompleteOverlay.
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { FontSize, FontWeight } from '../constants/typography';
import { Spacing } from '../constants/spacing';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CONFETTI_COUNT = 40;
const CONFETTI_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6FCF', '#A66CFF', '#FC5185', '#00D2D3'];
const CONFETTI_SHAPES = ['●', '■', '▲', '★', '♦', '◆'];

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  shape: string;
  size: number;
  delay: number;
  rotation: number;
  drift: number;
}

function generateConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_W,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    shape: CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)],
    size: 8 + Math.random() * 12,
    delay: Math.random() * 600,
    rotation: Math.random() * 360,
    drift: (Math.random() - 0.5) * 80,
  }));
}

function ConfettiItem({ piece }: { piece: ConfettiPiece }) {
  const translateY = useSharedValue(-40);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(piece.rotation);

  useEffect(() => {
    translateY.value = withDelay(
      piece.delay,
      withTiming(SCREEN_H + 40, { duration: 2200 + Math.random() * 800, easing: Easing.out(Easing.quad) }),
    );
    rotate.value = withDelay(
      piece.delay,
      withTiming(piece.rotation + 360 + Math.random() * 360, { duration: 2500 }),
    );
    opacity.value = withDelay(
      piece.delay + 1800,
      withTiming(0, { duration: 500 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: piece.drift },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          left: piece.x,
          top: -20,
          fontSize: piece.size,
          color: piece.color,
        },
        style,
      ]}
    >
      {piece.shape}
    </Animated.Text>
  );
}

interface AllDoneOverlayProps {
  visible: boolean;
  taskCount: number;
  childName?: string;
  onDismiss: () => void;
}

export function AllDoneOverlay({
  visible,
  taskCount,
  childName,
  onDismiss,
}: AllDoneOverlayProps) {
  const { primary, colors } = useThemeColors();
  const confetti = useMemo(() => (visible ? generateConfetti() : []), [visible]);

  const overlayOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.5);
  const cardOpacity = useSharedValue(0);
  const emojiScale = useSharedValue(0);
  const starScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      overlayOpacity.value = withTiming(1, { duration: 300 });
      cardScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 200 }));
      cardOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
      emojiScale.value = withDelay(400, withSequence(
        withSpring(1.3, { damping: 6, stiffness: 300 }),
        withSpring(1, { damping: 10, stiffness: 200 }),
      ));
      starScale.value = withDelay(700, withSpring(1, { damping: 8, stiffness: 200 }));
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      cardOpacity.value = 0;
      cardScale.value = 0.5;
      emojiScale.value = 0;
      starScale.value = 0;
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? 'auto' as const : 'none' as const,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }));

  if (!visible) return null;

  const message = childName
    ? `Bravo ${childName} ! Tu as terminé tes ${taskCount} tâches !`
    : `Toutes les tâches du jour sont terminées !`;

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      {confetti.map((piece) => (
        <ConfettiItem key={piece.id} piece={piece} />
      ))}

      <Pressable style={styles.dismissArea} onPress={onDismiss}>
        <Animated.View style={[styles.card, { backgroundColor: colors.card }, cardStyle]}>
          <Animated.Text style={[styles.stars, starStyle]}>✨ 🎉 ✨</Animated.Text>

          <Animated.Text style={[styles.emoji, emojiStyle]}>🎉</Animated.Text>

          <Text style={[styles.title, { color: colors.text }]}>Journée terminée !</Text>

          <Text style={[styles.message, { color: colors.textSub }]}>{message}</Text>

          <Pressable
            style={[styles.button, { backgroundColor: primary }]}
            onPress={onDismiss}
          >
            <Text style={styles.buttonText}>Super ! 🎊</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  dismissArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  card: {
    width: SCREEN_W * 0.82,
    borderRadius: 24,
    paddingVertical: Spacing['4xl'],
    paddingHorizontal: Spacing['3xl'],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  stars: {
    fontSize: 28,
    marginBottom: Spacing.lg,
  },
  emoji: {
    fontSize: 72,
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.heavy,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  message: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing['3xl'],
  },
  button: {
    paddingHorizontal: Spacing['4xl'],
    paddingVertical: Spacing.lg,
    borderRadius: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});
