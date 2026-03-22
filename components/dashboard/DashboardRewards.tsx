/**
 * DashboardRewards.tsx — Section récompenses actives
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { processActiveRewards } from '../../lib/gamification';
import { useTranslation } from 'react-i18next';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

/** Adapte le label de la récompense pour les enfants */
function childFriendlyLabel(label: string, isChild: boolean, t: (key: string, opts?: any) => string): string {
  if (!isChild) return label;
  const multMatch = label.match(/Multiplicateur ×(\d+)/);
  if (multMatch) return t('dashboard.rewards.superPower', { mult: multMatch[1] });
  return label;
}

/** Adapte le texte de durée pour les enfants */
function childFriendlyMeta(reward: { remainingDays?: number; remainingTasks?: number; expiresAt?: string }, isChild: boolean, t: (key: string, opts?: any) => string): string {
  if (reward.remainingDays !== undefined) {
    return isChild
      ? t('dashboard.rewards.daysRemainingChild', { count: reward.remainingDays })
      : t('dashboard.rewards.daysRemainingAdult', { count: reward.remainingDays });
  }
  if (reward.remainingTasks !== undefined) {
    return isChild
      ? t('dashboard.rewards.tasksRemainingChild', { count: reward.remainingTasks })
      : t('dashboard.rewards.tasksRemainingAdult', { count: reward.remainingTasks });
  }
  if (reward.expiresAt) return t('dashboard.rewards.expires', { date: reward.expiresAt });
  return '';
}

function DashboardRewardsInner({ isChildMode }: DashboardSectionProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { profiles, gamiData } = useVault();

  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);
  if (activeRewards.length === 0) return null;

  return (
    <DashboardCard key="rewards" title={isChildMode ? t('dashboard.rewards.titleChild') : t('dashboard.rewards.titleAdult')} icon="🏆" color={colors.error}>
      {activeRewards.map((reward) => {
        const ownerProfile = profiles.find((p) => p.id === reward.profileId);
        const typeColor = reward.type === 'vacation' || reward.type === 'crown' || reward.type === 'multiplier' ? colors.error : colors.warning;
        return (
          <View key={reward.id} style={styles.activeRewardRow}>
            <Text style={styles.activeRewardEmoji}>{reward.emoji}</Text>
            <View style={styles.activeRewardInfo}>
              <Text style={[styles.activeRewardLabel, { color: colors.text }]}>
                {ownerProfile?.avatar ?? '👤'} {ownerProfile?.name ?? reward.profileId} — {childFriendlyLabel(reward.label, !!isChildMode, t)}
              </Text>
              <Text style={[styles.activeRewardMeta, { color: typeColor }]}>
                {childFriendlyMeta(reward, !!isChildMode, t)}
              </Text>
            </View>
          </View>
        );
      })}
    </DashboardCard>
  );
}

export const DashboardRewards = React.memo(DashboardRewardsInner);

const styles = StyleSheet.create({
  activeRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  activeRewardEmoji: {
    fontSize: FontSize.icon,
  },
  activeRewardInfo: {
    flex: 1,
    gap: 2,
  },
  activeRewardLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  activeRewardMeta: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
});
