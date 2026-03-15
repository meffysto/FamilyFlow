/**
 * DashboardZenState.tsx — État zen quand toutes les tâches du jour sont faites
 *
 * Affiche un cercle respirant, un message rotatif et un aperçu de demain.
 * Objectif : sentiment de clarté mentale et de calme.
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  FadeIn,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface TomorrowPreview {
  tasks: number;
  rdvs: number;
  meals: number;
  firstRdv?: string;
}

interface DashboardZenStateProps {
  isChildMode?: boolean;
  tomorrow?: TomorrowPreview;
}

const COMPLETION_MESSAGES = [
  { title: 'Tout est fait', subtitle: 'Profitez de votre soirée' },
  { title: 'Journée bouclée', subtitle: 'Rien d\'autre à gérer' },
  { title: 'Repos mérité', subtitle: 'Vous avez tout accompli' },
  { title: 'C\'est calme ici', subtitle: 'Et c\'est très bien comme ça' },
  { title: 'Bravo', subtitle: 'La journée est sous contrôle' },
  { title: 'Tout est en ordre', subtitle: 'Demain est un autre jour' },
];

const CHILD_MESSAGES = [
  { title: 'Super journée !', subtitle: 'Tu as tout fini' },
  { title: 'Champion !', subtitle: 'Rien d\'autre à faire' },
  { title: 'Trop fort !', subtitle: 'Profite bien' },
];

function DashboardZenStateInner({ isChildMode, tomorrow }: DashboardZenStateProps) {
  const { primary, colors } = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();

  // Animation de respiration du cercle central
  const breathe = useSharedValue(1);
  // Cercles concentriques qui s'expandent
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  useEffect(() => {
    // Haptic de succès au montage
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Respiration : 3s in, 3s out
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    // Ondulations concentriques (staggered)
    const ringAnim = () =>
      withRepeat(
        withSequence(
          withTiming(1, { duration: 4000, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      );

    ring1.value = ringAnim();
    ring2.value = withDelay(1300, ringAnim());
    ring3.value = withDelay(2600, ringAnim());
  }, []);

  // Message du jour (basé sur le jour de l'année)
  const message = useMemo(() => {
    const messages = isChildMode ? CHILD_MESSAGES : COMPLETION_MESSAGES;
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return messages[dayOfYear % messages.length];
  }, [isChildMode]);

  const circleSize = Math.min(screenWidth * 0.35, 160);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  const makeRingStyle = (ringVal: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: interpolate(ringVal.value, [0, 0.3, 1], [0, 0.08, 0]),
      transform: [{ scale: interpolate(ringVal.value, [0, 1], [1, 1.6]) }],
    }));

  const ring1Style = makeRingStyle(ring1);
  const ring2Style = makeRingStyle(ring2);
  const ring3Style = makeRingStyle(ring3);

  const hasTomorrow = tomorrow && (tomorrow.tasks > 0 || tomorrow.rdvs > 0 || tomorrow.meals > 0);

  return (
    <Animated.View
      entering={FadeIn.duration(800).delay(300)}
      style={styles.container}
    >
      {/* Cercles concentriques */}
      <View style={[styles.circleContainer, { width: circleSize * 2, height: circleSize * 2 }]}>
        {[ring1Style, ring2Style, ring3Style].map((style, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2,
                backgroundColor: primary,
              },
              style,
            ]}
          />
        ))}

        {/* Cercle central qui respire */}
        <Animated.View
          style={[
            styles.centerCircle,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: primary + '12',
            },
            breatheStyle,
          ]}
        >
          <View
            style={[
              styles.innerCircle,
              {
                width: circleSize * 0.5,
                height: circleSize * 0.5,
                borderRadius: circleSize * 0.25,
                backgroundColor: primary + '18',
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Message de complétion */}
      <Animated.View
        entering={FadeIn.duration(600).delay(800)}
        style={styles.textContainer}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          {message.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {message.subtitle}
        </Text>
      </Animated.View>

      {/* Aperçu de demain */}
      {hasTomorrow && (
        <Animated.View
          entering={FadeIn.duration(600).delay(1200)}
          style={[styles.tomorrowCard, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}
        >
          <Text style={[styles.tomorrowLabel, { color: colors.textMuted }]}>Demain</Text>
          <Text style={[styles.tomorrowSummary, { color: colors.textFaint }]}>
            {[
              tomorrow!.tasks > 0 && `${tomorrow!.tasks} tâche${tomorrow!.tasks > 1 ? 's' : ''}`,
              tomorrow!.rdvs > 0 && `${tomorrow!.rdvs} RDV`,
              tomorrow!.meals > 0 && `${tomorrow!.meals} repas`,
            ].filter(Boolean).join(' · ')}
          </Text>
          {tomorrow!.firstRdv && (
            <Text style={[styles.tomorrowDetail, { color: colors.textFaint }]}>
              {tomorrow!.firstRdv}
            </Text>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

export const DashboardZenState = React.memo(DashboardZenStateInner);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing['6xl'],
    gap: Spacing['5xl'],
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  centerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {},
  textContainer: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  tomorrowCard: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xxs,
    minWidth: 200,
  },
  tomorrowLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xxs,
  },
  tomorrowSummary: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  tomorrowDetail: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xxs,
  },
});
