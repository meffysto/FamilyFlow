/**
 * DashboardLoot.tsx — Section progression loot / points
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { lootProgress, calculateLevel, POINTS_PER_TASK, getActiveEvent } from '../../lib/gamification';
import { SeasonalBanner } from '../SeasonalBanner';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardLootInner({ isChildMode }: DashboardSectionProps) {
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
  const { activeProfile } = useVault();

  const activeEvent = getActiveEvent();

  if (!activeProfile) return null;

  const loot = lootProgress(activeProfile);
  const hasBoxes = (activeProfile.lootBoxesAvailable ?? 0) > 0;
  const level = calculateLevel(activeProfile.points ?? 0);

  return (
    <DashboardCard key="lootProgress" title={isChildMode ? 'Tes points !' : 'Progression'} icon="🎁" color={primary}>
      {/* Barre de progression vers prochaine loot box */}
      <View style={styles.lootProgressRow}>
        <Text style={[isChildMode ? styles.lootProgressLabelChild : styles.lootProgressLabel, { color: colors.text }]}>
          {isChildMode
            ? `${activeProfile.avatar} Niveau ${level} !`
            : `Nv. ${level} — ${activeProfile.avatar} ${activeProfile.name}`}
        </Text>
        <Text style={[styles.lootProgressPts, { color: colors.textMuted }]}>
          {loot.current}/{loot.threshold} pts
        </Text>
      </View>
      <View style={[isChildMode ? styles.lootProgressBarChild : styles.lootProgressBar, { backgroundColor: colors.cardAlt }]}>
        <View style={[isChildMode ? styles.lootProgressFillChild : styles.lootProgressFill, { width: `${Math.round(loot.progress * 100)}%`, backgroundColor: primary }]} />
      </View>
      {hasBoxes && (
        <TouchableOpacity
          style={[isChildMode ? styles.lootCTAChild : styles.lootCTA, { backgroundColor: tint, borderColor: primary }]}
          onPress={() => router.push('/(tabs)/loot')}
          activeOpacity={0.7}
          accessibilityLabel="Ouvrir les loot boxes"
          accessibilityRole="button"
        >
          <Text style={[isChildMode ? styles.lootCTATextChild : styles.lootCTAText, { color: primary }]}>
            {isChildMode
              ? `🎁 Ouvre ton cadeau ! (${activeProfile.lootBoxesAvailable})`
              : `🎁 Ouvre ta récompense ! (${activeProfile.lootBoxesAvailable} dispo)`}
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
                ? `Presque ! Plus que ${tasksLeft} tâche${tasksLeft > 1 ? 's' : ''} ! 🔥`
                : `Encore ~${tasksLeft} tâches avant ton cadeau ! 💪`
              : tasksLeft <= 3
                ? `Plus que ${tasksLeft} tâche${tasksLeft > 1 ? 's' : ''} avant la loot box ! 🔥`
                : `~${tasksLeft} tâches avant la prochaine loot box`}
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
