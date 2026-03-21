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

/** Adapte le label de la récompense pour les enfants */
function childFriendlyLabel(label: string, isChild: boolean): string {
  if (!isChild) return label;
  // Multiplicateur ×2 → "Super pouvoir ×2 actif ! ⚡"
  const multMatch = label.match(/Multiplicateur ×(\d+)/);
  if (multMatch) return `Super pouvoir ×${multMatch[1]} actif ! ⚡`;
  return label;
}

/** Adapte le texte de durée pour les enfants */
function childFriendlyMeta(reward: { remainingDays?: number; remainingTasks?: number; expiresAt?: string }, isChild: boolean): string {
  if (reward.remainingDays !== undefined) {
    return isChild
      ? `Encore ${reward.remainingDays} jour${reward.remainingDays > 1 ? 's' : ''} de magie ! ✨`
      : `${reward.remainingDays}j restant${reward.remainingDays > 1 ? 's' : ''}`;
  }
  if (reward.remainingTasks !== undefined) {
    return isChild
      ? `Encore ${reward.remainingTasks} tâche${reward.remainingTasks > 1 ? 's' : ''} boostée${reward.remainingTasks > 1 ? 's' : ''} ! 💪`
      : `${reward.remainingTasks} tâche${reward.remainingTasks > 1 ? 's' : ''} restante${reward.remainingTasks > 1 ? 's' : ''}`;
  }
  if (reward.expiresAt) return `expire ${reward.expiresAt}`;
  return '';
}

function DashboardRewardsInner({ isChildMode }: DashboardSectionProps) {
  const { colors } = useThemeColors();
  const { profiles, gamiData } = useVault();

  const activeRewards = processActiveRewards(gamiData?.activeRewards ?? []);
  if (activeRewards.length === 0) return null;

  return (
    <DashboardCard key="rewards" title={isChildMode ? 'Tes pouvoirs actifs !' : 'Récompenses actives'} icon="🏆" color={colors.error}>
      {activeRewards.map((reward) => {
        const ownerProfile = profiles.find((p) => p.id === reward.profileId);
        const typeColor = reward.type === 'vacation' || reward.type === 'crown' || reward.type === 'multiplier' ? colors.error : colors.warning;
        return (
          <View key={reward.id} style={styles.activeRewardRow}>
            <Text style={styles.activeRewardEmoji}>{reward.emoji}</Text>
            <View style={styles.activeRewardInfo}>
              <Text style={[styles.activeRewardLabel, { color: colors.text }]}>
                {ownerProfile?.avatar ?? '👤'} {ownerProfile?.name ?? reward.profileId} — {childFriendlyLabel(reward.label, !!isChildMode)}
              </Text>
              <Text style={[styles.activeRewardMeta, { color: typeColor }]}>
                {childFriendlyMeta(reward, !!isChildMode)}
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
