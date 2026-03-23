/**
 * VisualRoutinePlayer.tsx — Lecteur visuel plein écran pour routines enfants (3-7 ans)
 *
 * UX : une seule étape à la fois, gros emoji, zéro texte pour les petits.
 * L'enfant tape sur l'emoji pour valider, puis on passe à l'étape suivante.
 * Si un timer est défini, un compte à rebours s'affiche autour du cercle.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { useTranslation } from 'react-i18next';
import type { Routine, RoutineProgress } from '../lib/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VisualRoutinePlayerProps {
  visible: boolean;
  routine: Routine | null;
  progress: RoutineProgress;
  onStepComplete: (stepIndex: number) => void;
  onRoutineComplete: () => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractEmoji(text: string): { emoji: string; label: string } {
  const emojiMatch = text.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
  if (emojiMatch) {
    return { emoji: emojiMatch[0], label: text.slice(emojiMatch[0].length).trim() };
  }
  return { emoji: '\u2728', label: text };
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const CIRCLE_SIZE = 200;
const EMOJI_SIZE = 140;
const CONFETTI_COUNT = 25;
const CONFETTI_COLORS_KEYS = ['primary', 'tint', 'success', 'warning'] as const;

// ─── Confetti particle ───────────────────────────────────────────────────────

interface ConfettiProps {
  color: string;
  delay: number;
  startX: number;
  endX: number;
  endY: number;
  size: number;
}

const ConfettiParticle = memo<ConfettiProps>(({ color, delay, startX, endX, endY, size }) => {
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 4 }));
    translateX.value = withDelay(delay, withTiming(endX, { duration: 1200 }));
    translateY.value = withDelay(delay, withTiming(endY, { duration: 1200 }));
    opacity.value = withDelay(delay, withTiming(0, { duration: 1200 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
});

// ─── Progress dot ────────────────────────────────────────────────────────────

interface DotProps {
  completed: boolean;
  current: boolean;
  primary: string;
  borderColor: string;
}

const ProgressDot = memo<DotProps>(({ completed, current, primary, borderColor }) => {
  const scale = useSharedValue(completed || current ? 1 : 0.6);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (completed) {
      scale.value = withSpring(1, { damping: 6 });
    }
    if (current) {
      scale.value = withSpring(1, { damping: 6 });
      pulse.value = withRepeat(
        withSequence(
          withSpring(1.3, { damping: 6 }),
          withSpring(1, { damping: 6 }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withSpring(1);
    }
  }, [completed, current]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: current ? 14 : 10,
          height: current ? 14 : 10,
          borderRadius: Radius.full,
          marginHorizontal: Spacing.xs,
          backgroundColor: completed || current ? primary : 'transparent',
          borderWidth: completed || current ? 0 : 2,
          borderColor,
        },
        animStyle,
      ]}
    />
  );
});

// ─── Timer ring (SVG-free, using border trick) ───────────────────────────────

interface TimerRingProps {
  progress: number; // 0..1
  primary: string;
  borderColor: string;
}

const TimerRing = memo<TimerRingProps>(({ progress, primary, borderColor }) => {
  // Simple visual: 4 quarter-arcs lit up as progress decreases
  // We use a border-based approach with animated opacity
  const opacity1 = useSharedValue(1);
  const opacity2 = useSharedValue(1);
  const opacity3 = useSharedValue(1);
  const opacity4 = useSharedValue(1);

  useEffect(() => {
    // progress goes from 1 (full) to 0 (done)
    opacity1.value = withTiming(progress > 0.75 ? 1 : 0.2, { duration: 300 });
    opacity2.value = withTiming(progress > 0.5 ? 1 : 0.2, { duration: 300 });
    opacity3.value = withTiming(progress > 0.25 ? 1 : 0.2, { duration: 300 });
    opacity4.value = withTiming(progress > 0 ? 1 : 0.2, { duration: 300 });
  }, [progress]);

  const ringSize = CIRCLE_SIZE + 20;
  const half = ringSize / 2;
  const thickness = 4;

  const s1 = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: opacity2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: opacity3.value }));
  const s4 = useAnimatedStyle(() => ({ opacity: opacity4.value }));

  const segmentBase = {
    position: 'absolute' as const,
    width: half,
    height: half,
  };

  return (
    <View
      style={{
        position: 'absolute',
        width: ringSize,
        height: ringSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Top-right */}
      <Animated.View
        style={[
          segmentBase,
          {
            top: 0,
            right: 0,
            borderTopWidth: thickness,
            borderRightWidth: thickness,
            borderTopRightRadius: half,
            borderColor: primary,
          },
          s1,
        ]}
      />
      {/* Top-left */}
      <Animated.View
        style={[
          segmentBase,
          {
            top: 0,
            left: 0,
            borderTopWidth: thickness,
            borderLeftWidth: thickness,
            borderTopLeftRadius: half,
            borderColor: primary,
          },
          s2,
        ]}
      />
      {/* Bottom-left */}
      <Animated.View
        style={[
          segmentBase,
          {
            bottom: 0,
            left: 0,
            borderBottomWidth: thickness,
            borderLeftWidth: thickness,
            borderBottomLeftRadius: half,
            borderColor: primary,
          },
          s3,
        ]}
      />
      {/* Bottom-right */}
      <Animated.View
        style={[
          segmentBase,
          {
            bottom: 0,
            right: 0,
            borderBottomWidth: thickness,
            borderRightWidth: thickness,
            borderBottomRightRadius: half,
            borderColor: primary,
          },
          s4,
        ]}
      />
      {/* Background ring */}
      <View
        style={{
          position: 'absolute',
          width: ringSize,
          height: ringSize,
          borderRadius: Radius.full,
          borderWidth: thickness,
          borderColor,
          opacity: 0.3,
        }}
      />
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

export const VisualRoutinePlayer = memo<VisualRoutinePlayerProps>(
  ({ visible, routine, progress, onStepComplete, onRoutineComplete, onClose }) => {
    const { t } = useTranslation();
    const { primary, tint, colors } = useThemeColors();

    // ── Derived state ──────────────────────────────────────────────────────
    const completedSet = useMemo(
      () => new Set(progress.completedSteps),
      [progress.completedSteps],
    );

    const currentStepIndex = useMemo(() => {
      if (!routine) return 0;
      const next = routine.steps.findIndex((_, i) => !completedSet.has(i));
      return next === -1 ? routine.steps.length : next;
    }, [routine, completedSet]);

    const allDone = routine ? currentStepIndex >= routine.steps.length : false;
    const currentStep = routine?.steps[currentStepIndex] ?? null;
    const extracted = useMemo(
      () => (currentStep ? extractEmoji(currentStep.text) : { emoji: '\u2728', label: '' }),
      [currentStep],
    );

    // ── Timer state ────────────────────────────────────────────────────────
    const totalSeconds = (currentStep?.durationMinutes ?? 0) * 60;
    const hasTimer = totalSeconds > 0;
    const [remaining, setRemaining] = useState(totalSeconds);
    const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset timer when step changes
    useEffect(() => {
      setRemaining(totalSeconds);
    }, [totalSeconds, currentStepIndex]);

    // Countdown interval
    useEffect(() => {
      if (!hasTimer || allDone || !visible) return;
      const id = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(id);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(id);
    }, [hasTimer, currentStepIndex, allDone, visible]);

    // Auto-complete when timer hits 0
    useEffect(() => {
      if (hasTimer && remaining === 0 && !allDone && currentStep) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onStepComplete(currentStepIndex);
      }
    }, [remaining, hasTimer]);

    // Timer haptics at last 30s (every 10s)
    useEffect(() => {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      if (hasTimer && remaining <= 30 && remaining > 0 && !allDone) {
        hapticIntervalRef.current = setInterval(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 10000);
        // Immediate haptic
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return () => {
        if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
      };
    }, [remaining <= 30, hasTimer, allDone]);

    const timerProgress = hasTimer && totalSeconds > 0 ? remaining / totalSeconds : 1;

    // ── Celebration auto-dismiss ───────────────────────────────────────────
    const [showCelebration, setShowCelebration] = useState(false);

    useEffect(() => {
      if (allDone && visible && routine) {
        setShowCelebration(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const timeout = setTimeout(() => {
          onRoutineComplete();
          onClose();
        }, 4000);
        return () => clearTimeout(timeout);
      } else {
        setShowCelebration(false);
      }
    }, [allDone, visible]);

    // ── Emoji pulse animation ──────────────────────────────────────────────
    const emojiScale = useSharedValue(1);
    const isTapping = useRef(false);

    // Idle pulse
    useEffect(() => {
      if (allDone || isTapping.current) return;
      const basePulse =
        hasTimer && remaining <= 30
          ? 1.15
          : hasTimer && timerProgress <= 0.5
            ? 1.08
            : 1.05;
      emojiScale.value = withRepeat(
        withSequence(
          withSpring(basePulse, { damping: 6 }),
          withSpring(1, { damping: 6 }),
        ),
        -1,
        true,
      );
    }, [currentStepIndex, allDone, remaining <= 30, timerProgress <= 0.5]);

    const emojiAnimStyle = useAnimatedStyle(() => ({
      transform: [{ scale: emojiScale.value }],
    }));

    // ── Tap handler ────────────────────────────────────────────────────────
    const handleTap = useCallback(() => {
      if (allDone || !currentStep) return;
      // For timer steps, tapping does nothing (use "Passer" button)
      if (hasTimer && remaining > 0) return;

      isTapping.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      emojiScale.value = withSequence(
        withSpring(0.7, { damping: 3 }),
        withSpring(1.4, { damping: 4 }),
        withSpring(1, { damping: 8 }),
      );

      setTimeout(() => {
        isTapping.current = false;
        onStepComplete(currentStepIndex);
      }, 500);
    }, [currentStepIndex, allDone, hasTimer, remaining, onStepComplete]);

    // ── Skip handler (timer steps) ────────────────────────────────────────
    const handleSkip = useCallback(() => {
      if (allDone || !currentStep) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStepComplete(currentStepIndex);
    }, [currentStepIndex, allDone, onStepComplete]);

    // ── Confetti data ──────────────────────────────────────────────────────
    const confettiParticles = useMemo(() => {
      const confettiColors = [primary, tint, colors.success, colors.warning];
      return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        color: confettiColors[i % confettiColors.length],
        delay: Math.random() * 400,
        startX: 0,
        endX: (Math.random() - 0.5) * 300,
        endY: -(Math.random() * 400 + 100),
        size: Math.random() * 6 + 5,
      }));
    }, [primary, tint, colors.success, colors.warning]);

    // ── Render ─────────────────────────────────────────────────────────────
    if (!routine) return null;

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <StatusBar hidden />
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          {/* Subtle primary tint overlay */}
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: primary, opacity: 0.04 },
            ]}
          />

          {/* Exit button */}
          <Pressable
            onPress={onClose}
            style={[styles.exitButton, { backgroundColor: colors.bg, borderColor: colors.border }]}
            accessibilityLabel={t('visualRoutinePlayer.closeA11y')}
            accessibilityRole="button"
          >
            <Text style={[styles.exitText, { color: colors.textFaint }]}>{'\u2715'}</Text>
          </Pressable>

          {/* ── CENTER CONTENT ─────────────────────────────────── */}
          {!showCelebration && currentStep && (
            <Animated.View
              key={`step-${currentStepIndex}`}
              entering={FadeIn.duration(400)}
              style={styles.centerContent}
            >
              {/* Emoji circle + Timer ring wrapper */}
              <Pressable
                onPress={handleTap}
                accessibilityRole="button"
                accessibilityLabel={extracted.label}
                style={styles.emojiWrapper}
              >
                {/* Timer ring (centré autour du cercle emoji) */}
                {hasTimer && (
                  <TimerRing
                    progress={timerProgress}
                    primary={primary}
                    borderColor={colors.border}
                  />
                )}
                <Animated.View
                  style={[
                    styles.emojiCircle,
                    {
                      backgroundColor: primary + '15',
                      borderColor: primary + '30',
                    },
                    emojiAnimStyle,
                  ]}
                >
                  <Text style={styles.emojiText}>{extracted.emoji}</Text>
                </Animated.View>
              </Pressable>

              {/* Timer display */}
              {hasTimer && (
                <View style={styles.timerContainer}>
                  <Text
                    style={[
                      styles.timerText,
                      {
                        color: remaining <= 30 ? colors.error : colors.text,
                      },
                    ]}
                  >
                    {formatTimer(remaining)}
                  </Text>
                  <Pressable onPress={handleSkip} style={styles.skipButton}>
                    <Text style={[styles.skipText, { color: colors.textMuted }]}>
                      {t('visualRoutinePlayer.skipTimer')} {'\u23ED'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Step label (parent reference) */}
              <Text
                style={[
                  styles.stepLabel,
                  { color: colors.textMuted },
                ]}
                numberOfLines={2}
              >
                {extracted.label}
              </Text>
            </Animated.View>
          )}

          {/* ── CELEBRATION ────────────────────────────────────── */}
          {showCelebration && (
            <View style={styles.celebrationContainer}>
              {/* Confetti */}
              <View style={styles.confettiOrigin}>
                {confettiParticles.map((p) => (
                  <ConfettiParticle
                    key={p.id}
                    color={p.color}
                    delay={p.delay}
                    startX={p.startX}
                    endX={p.endX}
                    endY={p.endY}
                    size={p.size}
                  />
                ))}
              </View>

              <Animated.Text
                entering={FadeInDown.springify().damping(8)}
                style={styles.celebrationEmoji}
              >
                {'\uD83C\uDF89'}
              </Animated.Text>

              <Animated.Text
                entering={FadeInUp.delay(600).springify().damping(8)}
                style={[styles.celebrationText, { color: primary }]}
              >
                {t('visualRoutinePlayer.bravo')}
              </Animated.Text>
            </View>
          )}

          {/* ── PROGRESS DOTS ──────────────────────────────────── */}
          {!showCelebration && (
            <Animated.View entering={FadeIn.delay(200)} style={styles.dotsContainer}>
              {routine.steps.map((_, i) => (
                <ProgressDot
                  key={i}
                  completed={completedSet.has(i)}
                  current={i === currentStepIndex}
                  primary={primary}
                  borderColor={colors.border}
                />
              ))}
            </Animated.View>
          )}
        </View>
      </Modal>
    );
  },
);

VisualRoutinePlayer.displayName = 'VisualRoutinePlayer';

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitButton: {
    position: 'absolute',
    top: Spacing['6xl'],
    left: Spacing['2xl'],
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  exitText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: 16,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiWrapper: {
    width: CIRCLE_SIZE + 20,
    height: CIRCLE_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: EMOJI_SIZE,
    lineHeight: EMOJI_SIZE + 20,
    textAlign: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: Spacing['3xl'],
  },
  timerText: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  skipButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
  },
  skipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  stepLabel: {
    marginTop: Spacing['3xl'],
    fontSize: FontSize.sm,
    fontWeight: FontWeight.normal,
    textAlign: 'center',
    maxWidth: '70%',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: Spacing['6xl'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiOrigin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationEmoji: {
    fontSize: EMOJI_SIZE,
    lineHeight: EMOJI_SIZE + 20,
    textAlign: 'center',
  },
  celebrationText: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.heavy,
    marginTop: Spacing['2xl'],
    textAlign: 'center',
  },
});

export default VisualRoutinePlayer;
