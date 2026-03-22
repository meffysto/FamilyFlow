/**
 * DashboardLoot.tsx — Section progression loot / points
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { lootProgress, calculateLevel, getLevelTier, getStreakMilestone, POINTS_PER_TASK, getActiveEvent } from '../../lib/gamification';
import { SeasonalBanner } from '../SeasonalBanner';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardLootInner({ isChildMode }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
  const { activeProfile } = useVault();

  const activeEvent = getActiveEvent();

  if (!activeProfile) return null;

  const loot = lootProgress(activeProfile);
  const hasBoxes = (activeProfile.lootBoxesAvailable ?? 0) > 0;
  const level = calculateLevel(activeProfile.points ?? 0);
  const tier = getLevelTier(level);
  const streakInfo = getStreakMilestone(activeProfile.streak ?? 0);

  return (
    <DashboardCard key="lootProgress" title={isChildMode ? t('dashboard.loot.titleChild') : t('dashboard.loot.titleAdult')} icon="🎁" color={primary}>
      {/* Barre de progression vers prochaine loot box */}
      <View style={styles.lootProgressRow}>
        <Text style={[isChildMode ? styles.lootProgressLabelChild : styles.lootProgressLabel, { color: colors.text }]}>
          {isChildMode
            ? `${activeProfile.avatar} ${tier.emoji} ${tier.name} !`
            : `${tier.emoji} ${tier.name} — ${activeProfile.avatar} ${activeProfile.name}`}
        </Text>
        <Text style={[styles.lootProgressPts, { color: colors.textMuted }]}>
          {t('dashboard.loot.level', { level })}
        </Text>
      </View>
      {/* Barre XP vers prochaine loot box */}
      <View style={styles.lootThresholdRow}>
        <Text style={[styles.lootThresholdText, { color: colors.textFaint }]}>
          {t('dashboard.loot.threshold', { current: loot.current, threshold: loot.threshold })}
        </Text>
        {streakInfo && (
          <Text style={[styles.lootThresholdText, { color: tier.color }]}>
            {streakInfo.emoji} +{streakInfo.bonus}/tâche
          </Text>
        )}
      </View>
      <View style={[isChildMode ? styles.lootProgressBarChild : styles.lootProgressBar, { backgroundColor: colors.cardAlt }]}>
        <View style={[isChildMode ? styles.lootProgressFillChild : styles.lootProgressFill, { width: `${Math.round(loot.progress * 100)}%`, backgroundColor: primary }]} />
      </View>
      {hasBoxes && (
        <TouchableOpacity
          style={[isChildMode ? styles.lootCTAChild : styles.lootCTA, { backgroundColor: tint, borderColor: primary }]}
          onPress={() => router.push('/(tabs)/loot')}
          activeOpacity={0.7}
          accessibilityLabel={t('dashboard.loot.openA11y')}
          accessibilityRole="button"
        >
          <Text style={[isChildMode ? styles.lootCTATextChild : styles.lootCTAText, { color: primary }]}>
            {isChildMode
              ? t('dashboard.loot.openChild', { count: activeProfile.lootBoxesAvailable })
              : t('dashboard.loot.openAdult', { count: activeProfile.lootBoxesAvailable })}
          </Text>
        </TouchableOpacity>
      )}
      {!hasBoxes && (() => {
        const remaining = Math.max(0, loot.threshold - loot.current);
        const tasksLeft = Math.ceil(remaining / POINTS_PER_TASK);
        return (
          <Text style={[styles.lootHint, { color: colors.textFaint }]}>
            {isChildMode
              ? tasksLeft <= 3
                ? t('dashboard.loot.almostChild', { count: tasksLeft, plural: tasksLeft > 1 ? 's' : '' })
                : t('dashboard.loot.keepGoingChild', { count: tasksLeft })
              : tasksLeft <= 3
                ? t('dashboard.loot.almostAdult', { count: tasksLeft, plural: tasksLeft > 1 ? 's' : '' })
                : t('dashboard.loot.keepGoingAdult', { count: tasksLeft })}
          </Text>
        );
      })()}
      {activeEvent && <SeasonalBanner event={activeEvent} compact />}
    </DashboardCard>
  );
}

export const DashboardLoot = React.memo(DashboardLootInner);

const styles = StyleSheet.create({
  lootProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lootProgressLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  lootProgressPts: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  lootThresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  lootThresholdText: {
    fontSize: FontSize.caption,
  },
  lootProgressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  lootProgressFill: {
    height: '100%',
    borderRadius: 5,
  },
  lootCTA: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 4,
  },
  lootCTAText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  // Styles enfant — plus gros, plus lisibles
  lootProgressLabelChild: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
  },
  lootProgressBarChild: {
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  lootProgressFillChild: {
    height: '100%',
    borderRadius: 8,
  },
  lootCTAChild: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 8,
  },
  lootCTATextChild: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
  },
  lootHint: {
    fontSize: FontSize.label,
    textAlign: 'center',
  },
});
