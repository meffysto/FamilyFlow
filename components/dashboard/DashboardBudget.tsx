/**
 * DashboardBudget.tsx — Section budget du mois
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { AnimatedProgressBar } from './AnimatedProgressBar';
import { formatAmount, categoryDisplay, totalSpent, totalBudget } from '../../lib/budget';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';
import { Wallet } from 'lucide-react-native';

function DashboardBudgetInner({ vaultFileExists, activateCardTemplate }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { budgetEntries, budgetConfig } = useVault();

  if (!vaultFileExists.budget) return (
    <DashboardCard key="budget" title={t('dashboard.budget.title')} variant="metric" IconComponent={Wallet} color={colors.catFamille}>
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
      count={overCount > 0 ? overCount : undefined}
      variant="metric"
      IconComponent={Wallet}
      color={colors.catFamille}
      onPressMore={() => router.push('/(tabs)/budget')}
      hideMoreLink
      style={{ flex: 1 }}
    >
      <Text style={[styles.budgetSentence, { color: colors.text }]}>
        <Text style={[styles.budgetPct, { color: isOver ? colors.error : colors.catFamille }]}>{pctUsed}%</Text>
        {' '}
        {t('dashboard.budget.usedOf', { spent: formatAmount(budgetSpent), total: formatAmount(budgetTotalVal) })}
      </Text>
      <AnimatedProgressBar
        progress={Math.min(100, pctUsed) / 100}
        color={isOver ? colors.error : colors.catFamille}
        backgroundColor={colors.brand.wash}
        height={6}
      />

    </DashboardCard>
  );
}

export const DashboardBudget = React.memo(DashboardBudgetInner);

const styles = StyleSheet.create({
  budgetSentence: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    lineHeight: 24,
  },
  budgetPct: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.heading + 4, // 22px DM Serif intégré
    letterSpacing: -0.3,
  },
});
