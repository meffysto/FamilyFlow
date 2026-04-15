/**
 * DashboardBudget.tsx — Section budget du mois
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { formatAmount, categoryDisplay, totalSpent, totalBudget } from '../../lib/budget';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

function DashboardBudgetInner({ vaultFileExists, activateCardTemplate }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { budgetEntries, budgetConfig } = useVault();

  if (!vaultFileExists.budget) return (
    <DashboardCard key="budget" title={t('dashboard.budget.title')} icon="💰" color={colors.catFamille} tinted>
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

  const pctUsed = budgetTotalVal > 0 ? Math.round((budgetSpent / budgetTotalVal) * 100) : 0;
  const isOver = budgetSpent > budgetTotalVal;

  return (
    <DashboardCard
      key="budget"
      title={t('dashboard.budget.title')}
      icon="💰"
      count={overCount > 0 ? overCount : undefined}
      color={colors.catFamille}
      tinted
      onPressMore={() => router.push('/(tabs)/budget')}
      hideMoreLink
      style={{ flex: 1 }}
    >
      <Text style={[styles.budgetPct, { color: isOver ? colors.error : colors.text }]}>{pctUsed}%</Text>
      <View style={[styles.progressBg, { backgroundColor: colors.cardAlt }]}>
        <View style={[styles.progressFill, { width: `${Math.min(100, pctUsed)}%`, backgroundColor: isOver ? colors.error : colors.catFamille }]} />
      </View>
      <Text style={[styles.budgetMicro, { color: colors.textMuted }]}>
        {formatAmount(budgetSpent)} / {formatAmount(budgetTotalVal)}
      </Text>
    </DashboardCard>
  );
}

export const DashboardBudget = React.memo(DashboardBudgetInner);

const styles = StyleSheet.create({
  budgetPct: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    lineHeight: 40,
    letterSpacing: -1,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  budgetMicro: {
    fontSize: FontSize.micro,
  },
});
