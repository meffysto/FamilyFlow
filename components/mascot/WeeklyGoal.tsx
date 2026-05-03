/**
 * WeeklyGoal.tsx — Objectif hebdomadaire avec barre de progression
 *
 * "Complete 15 taches cette semaine → bonus 50🍃"
 * Compte les taches completees cette semaine depuis l'historique gamification.
 */

import React, { useState, useCallback } from 'react';
import type { AppColors } from '../../constants/colors';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Spacing, Radius } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';

const WEEKLY_TARGET = 15;
const WEEKLY_REWARD = 50;

interface WeeklyGoalProps {
  weeklyTaskCount: number;
  colors: AppColors;
  t: (key: string, opts?: any) => string;
  /** True quand objectif atteint ET pas encore réclamé cette semaine. */
  claimable?: boolean;
  /** True une fois la récompense réclamée — la barre passe en état "claimed". */
  alreadyClaimed?: boolean;
  /** Handler async appelé au tap "Réclamer" (uniquement si claimable). */
  onClaim?: () => Promise<void> | void;
}

export function WeeklyGoal({
  weeklyTaskCount,
  colors,
  t,
  claimable = false,
  alreadyClaimed = false,
  onClaim,
}: WeeklyGoalProps) {
  const [dismissed, setDismissed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const progress = Math.min(1, weeklyTaskCount / WEEKLY_TARGET);
  const isComplete = weeklyTaskCount >= WEEKLY_TARGET;

  const handleDismiss = useCallback(() => setDismissed(true), []);
  const handleClaim = useCallback(async () => {
    if (!onClaim || claiming) return;
    setClaiming(true);
    try { await onClaim(); } finally { setClaiming(false); }
  }, [onClaim, claiming]);

  if (dismissed) return null;

  // État réclamable = tap principal = Réclamer (pas dismiss).
  // État autre (en cours, déjà claim) = tap principal = Dismiss.
  const primaryAction = claimable ? handleClaim : handleDismiss;
  const fillColor = alreadyClaimed
    ? colors.textMuted
    : claimable
      ? colors.success
      : isComplete
        ? colors.success
        : colors.info;
  const subtitle = alreadyClaimed
    ? t('farm.weeklyGoal.claimed')
    : isComplete
      ? t('farm.weeklyGoal.complete', { reward: WEEKLY_REWARD })
      : t('farm.weeklyGoal.progress', { remaining: WEEKLY_TARGET - weeklyTaskCount, reward: WEEKLY_REWARD });

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(400)} exiting={FadeOut.duration(300)}>
      <TouchableOpacity activeOpacity={0.8} onPress={primaryAction} disabled={claiming}>
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {alreadyClaimed ? '✅' : isComplete ? '🎉' : '🎯'} {t('farm.weeklyGoal.title')}
          </Text>
          <Text style={[styles.count, { color: alreadyClaimed ? colors.textMuted : isComplete ? colors.success : colors.textSub }]}>
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
                backgroundColor: fillColor,
              },
            ]}
          />
        </View>

        <Text style={[styles.subtitle, { color: alreadyClaimed ? colors.textMuted : isComplete ? colors.success : colors.textMuted }]}>
          {subtitle}
        </Text>

        {claimable && (
          <View style={[styles.claimBtn, { backgroundColor: colors.success }]}>
            <Text style={[styles.claimBtnText, { color: colors.onPrimary }]}>
              {claiming ? '…' : t('farm.weeklyGoal.claim', { reward: WEEKLY_REWARD })}
            </Text>
          </View>
        )}

        {!isComplete && (
          <Text style={[styles.hint, { color: colors.textFaint }]}>
            {t('farm.weeklyGoal.hint')}
          </Text>
        )}
      </View>
      </TouchableOpacity>
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
  claimBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  claimBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
