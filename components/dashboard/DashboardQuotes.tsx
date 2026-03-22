/**
 * DashboardQuotes.tsx — Dernier mot d'enfant sur le dashboard
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

function DashboardQuotesInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { quotes } = useVault();

  const latest = quotes[0]; // déjà triées par date desc

  if (!latest) {
    return (
      <DashboardCard key="quotes" title={t('dashboard.quotes.title')} icon="💬" color={colors.info} onPressMore={() => router.push('/(tabs)/quotes' as any)}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t('dashboard.quotes.empty')}
        </Text>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard key="quotes" title={t('dashboard.quotes.title')} icon="💬" count={quotes.length} color={colors.info} onPressMore={() => router.push('/(tabs)/quotes' as any)}>
      <Text style={[styles.citation, { color: colors.text }]} numberOfLines={2}>
        « {latest.citation} »
      </Text>
      <Text style={[styles.meta, { color: colors.textSub }]}>
        — {latest.enfant}{latest.contexte ? `, ${latest.contexte}` : ''}
      </Text>
    </DashboardCard>
  );
}

export const DashboardQuotes = React.memo(DashboardQuotesInner);

const styles = StyleSheet.create({
  empty: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
  },
  citation: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    fontStyle: 'italic',
    marginBottom: Spacing.xxs,
  },
  meta: {
    fontSize: FontSize.caption,
  },
});
