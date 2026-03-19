/**
 * DashboardRewards.tsx — Section récompenses actives
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { processActiveRewards } from '../../lib/gamification';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardRewardsInner(_props: DashboardSectionProps) {
  const { colors } = useThemeColors();
  const { profiles, gamiData } = useVault();

  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);
  if (activeRewards.length === 0) return null;

  return (
    <DashboardCard key="rewards" title="Récompenses actives" icon="🏆" color={colors.error}>
      {activeRewards.map((reward) => {
        const ownerProfile = profiles.find((p) => p.id === reward.profileId);
        const typeColor = reward.type === 'vacation' || reward.type === 'crown' || reward.type === 'multiplier' ? colors.error : colors.warning;
        return (
          <View key={reward.id} style={styles.activeRewardRow}>
            <Text style={styles.activeRewardEmoji}>{reward.emoji}</Text>
            <View style={styles.activeRewardInfo}>
              <Text style={[styles.activeRewardLabel, { color: colors.text }]}>{ownerProfile?.avatar ?? '👤'} {ownerProfile?.name ?? reward.profileId} — {reward.label}</Text>
              <Text style={[styles.activeRewardMeta, { color: typeColor }]}>
                {reward.remainingDays !== undefined && `${reward.remainingDays}j restant${reward.remainingDays > 1 ? 's' : ''}`}
                {reward.remainingTasks !== undefined && `${reward.remainingTasks} tâche${reward.remainingTasks > 1 ? 's' : ''} restante${reward.remainingTasks > 1 ? 's' : ''}`}
                {reward.expiresAt && !reward.remainingDays && !reward.remainingTasks && `expire ${reward.expiresAt}`}
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
