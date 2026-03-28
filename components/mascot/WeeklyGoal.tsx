/**
 * WeeklyGoal.tsx — Objectif hebdomadaire avec barre de progression
 *
 * "Complete 15 taches cette semaine → bonus 50🍃"
 * Compte les taches completees cette semaine depuis l'historique gamification.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Spacing, Radius } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';

const WEEKLY_TARGET = 15;
const WEEKLY_REWARD = 50;

interface WeeklyGoalProps {
  weeklyTaskCount: number;
  colors: any;
  t: (key: string, opts?: any) => string;
}

export function WeeklyGoal({ weeklyTaskCount, colors, t }: WeeklyGoalProps) {
  const progress = Math.min(1, weeklyTaskCount / WEEKLY_TARGET);
  const isComplete = weeklyTaskCount >= WEEKLY_TARGET;

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(400)}>
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isComplete ? '🎉' : '🎯'} {t('farm.weeklyGoal.title')}
          </Text>
          <Text style={[styles.count, { color: isComplete ? colors.success : colors.textSub }]}>
            {weeklyTaskCount}/{WEEKLY_TARGET}
          </Text>
        </View>

        {/* Barre de progression */}
        <View style={[styles.progressBg, { backgroundColor: colors.cardAlt }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isComplete ? colors.success : colors.info,
              },
            ]}
          />
        </View>

        <Text style={[styles.subtitle, { color: isComplete ? colors.success : colors.textMuted }]}>
          {isComplete
            ? t('farm.weeklyGoal.complete', { reward: WEEKLY_REWARD })
            : t('farm.weeklyGoal.progress', { remaining: WEEKLY_TARGET - weeklyTaskCount, reward: WEEKLY_REWARD })}
        </Text>
        <Text style={[styles.hint, { color: colors.textFaint }]}>
          {t('farm.weeklyGoal.hint')}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Compter les taches completees cette semaine (lundi-dimanche) */
export function countWeeklyTasks(history: { profileId: string; timestamp: string; action: string }[], profileId: string): number {
  const now = new Date();
  // Trouver le lundi de cette semaine
  const dayOfWeek = now.getDay(); // 0 = dimanche
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  return history.filter(entry => {
    if (entry.profileId !== profileId) return false;
    if (!entry.action.startsWith('+')) return false; // seulement les gains
    const entryDate = new Date(entry.timestamp);
    return entryDate >= monday;
  }).length;
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  subtitle: {
    fontSize: 12,
  },
  hint: {
    fontSize: 11,
    marginTop: 2,
  },
});
