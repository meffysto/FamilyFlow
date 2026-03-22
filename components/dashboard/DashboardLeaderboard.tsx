/**
 * DashboardLeaderboard.tsx — Section classement familial
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { FamilyLeaderboard } from '../FamilyLeaderboard';
import { buildLeaderboard } from '../../lib/gamification';
import type { DashboardSectionProps } from './types';

function DashboardLeaderboardInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary } = useThemeColors();
  const { profiles, gamiData } = useVault();

  const leaderboard = buildLeaderboard(profiles);
  if (leaderboard.length === 0) return null;

  return (
    <DashboardCard key="leaderboard" title={t('dashboard.leaderboard.title')} icon="🏆" color={primary} onPressMore={() => router.push('/(tabs)/loot')}>
      <FamilyLeaderboard profiles={leaderboard} compact />
    </DashboardCard>
  );
}

export const DashboardLeaderboard = React.memo(DashboardLeaderboardInner);
