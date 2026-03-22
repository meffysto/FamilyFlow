/**
 * DashboardBudget.tsx — Section budget du mois
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { formatAmount, categoryDisplay, totalSpent, totalBudget } from '../../lib/budget';
import { useTranslation } from 'react-i18next';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardBudgetInner({ vaultFileExists, activateCardTemplate }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { budgetEntries, budgetConfig } = useVault();

  if (!vaultFileExists.budget) return (
    <DashboardCard key="budget" title={t('dashboard.budget.title')} icon="💰" color={colors.success}>
      <DashboardEmptyState
        description={t('dashboard.budget.emptyDescription')}
        onActivate={() => activateCardTemplate('budget')}
        activateLabel={t('dashboard.budget.activateLabel')}
      />
    </DashboardCard>
  );

  const budgetSpent = totalSpent(budgetEntries);
  const budgetTotalVal = totalBudget(budgetConfig);
  // Single-pass: build spent-by-category map
  const spentMap = new Map<string, number>();
  for (const e of budgetEntries) {
    spentMap.set(e.category, (spentMap.get(e.category) ?? 0) + e.amount);
  }
  const catStats = budgetConfig.categories
    .map((c) => ({ ...c, spent: spentMap.get(categoryDisplay(c)) ?? 0 }));
  const overCount = catStats.filter((c) => c.spent > c.limit).length;
  const topCats = catStats.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 2);

  return (
    <DashboardCard
      key="budget"
      title={t('dashboard.budget.title')}
      icon="💰"
      count={overCount > 0 ? overCount : undefined}
      color={overCount > 0 ? colors.error : colors.success}
      onPressMore={() => router.push('/(tabs)/budget')}
    >
      <Text style={[styles.budgetTotal, { color: budgetSpent > budgetTotalVal ? colors.error : colors.text }]}>
        {formatAmount(budgetSpent)} / {formatAmount(budgetTotalVal)}
      </Text>
      {topCats.map((c) => (
        <View key={c.name} style={styles.budgetCatRow}>
          <Text style={[styles.budgetCatName, { color: colors.textSub }]}>{c.emoji} {c.name}</Text>
          <Text style={[styles.budgetCatAmount, { color: c.spent > c.limit ? colors.error : colors.textMuted }]}>
            {formatAmount(c.spent)}
          </Text>
        </View>
      ))}
    </DashboardCard>
  );
}

export const DashboardBudget = React.memo(DashboardBudgetInner);

const styles = StyleSheet.create({
  budgetTotal: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    marginBottom: 6,
  },
  budgetCatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  budgetCatName: {
    fontSize: FontSize.sm,
  },
  budgetCatAmount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
