/**
 * DashboardRdvs.tsx — Section rendez-vous à venir
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { isRdvUpcoming } from '../../lib/parser';
import { formatDateLocalized } from '../../lib/date-locale';
import type { RDV } from '../../lib/types';
import { useTranslation } from 'react-i18next';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

interface DashboardRdvsProps extends DashboardSectionProps {
  onEditRDV: (rdv?: RDV) => void;
}

function DashboardRdvsInner({ vaultFileExists, activateCardTemplate, onEditRDV }: DashboardRdvsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { rdvs } = useVault();

  const upcomingRdvs = rdvs.filter((r) => isRdvUpcoming(r));

  if (!vaultFileExists.rdvs) return (
    <DashboardCard key="rdvs" title={t('dashboard.rdvs.title')} icon="📅" color={colors.info}>
      <DashboardEmptyState
        description={t('dashboard.rdvs.emptyDescription')}
        onActivate={() => activateCardTemplate('rdvs')}
        activateLabel={t('dashboard.rdvs.activateLabel')}
      />
    </DashboardCard>
  );

  if (upcomingRdvs.length === 0) return (
    <DashboardCard key="rdvs" title={t('dashboard.rdvs.title')} icon="📅" color={colors.info}>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('dashboard.rdvs.noUpcoming')}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/rdv')} activeOpacity={0.7}>
          <Text style={[styles.seeAllText, { color: primary }]}>{t('dashboard.rdvs.seeAll')}</Text>
        </TouchableOpacity>
      </View>
    </DashboardCard>
  );

  return (
    <DashboardCard key="rdvs" title={t('dashboard.rdvs.title')} icon="📅" count={upcomingRdvs.length} color={colors.info}>
      {upcomingRdvs.slice(0, 3).map((rdv) => (
        <TouchableOpacity key={rdv.sourceFile} style={[styles.rdvRow, { borderLeftColor: colors.info }]} onPress={() => onEditRDV(rdv)} activeOpacity={0.7}>
          <Text style={[styles.rdvDate, { color: colors.info }]}>{formatDateLocalized(rdv.date_rdv)} {rdv.heure ? `à ${rdv.heure}` : ''}</Text>
          <Text style={[styles.rdvTitle, { color: colors.text }]}>{rdv.type_rdv} — {rdv.enfant}</Text>
          {rdv.médecin && <Text style={[styles.rdvMeta, { color: colors.textMuted }]}>{rdv.médecin}</Text>}
        </TouchableOpacity>
      ))}
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/rdv')} activeOpacity={0.7}>
          <Text style={[styles.seeAllText, { color: primary }]}>{t('dashboard.rdvs.seeAll')}</Text>
        </TouchableOpacity>
      </View>
    </DashboardCard>
  );
}

export const DashboardRdvs = React.memo(DashboardRdvsInner);

const styles = StyleSheet.create({
  emptyHint: {
    fontSize: FontSize.label,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  rdvRow: {
    paddingVertical: 8,
    borderLeftWidth: 3,
    paddingLeft: 10,
    gap: 2,
  },
  rdvDate: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  rdvTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  rdvMeta: {
    fontSize: FontSize.label,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  seeAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
