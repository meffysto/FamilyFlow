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
import { formatDateForDisplay, isRdvUpcoming } from '../../lib/parser';
import type { RDV } from '../../lib/types';
import type { DashboardSectionProps } from './types';

interface DashboardRdvsProps extends DashboardSectionProps {
  onEditRDV: (rdv?: RDV) => void;
}

function DashboardRdvsInner({ vaultFileExists, activateCardTemplate, onEditRDV }: DashboardRdvsProps) {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { rdvs } = useVault();

  const upcomingRdvs = rdvs.filter((r) => isRdvUpcoming(r));

  if (!vaultFileExists.rdvs) return (
    <DashboardCard key="rdvs" title="Rendez-vous" icon="📅" color={colors.info}>
      <DashboardEmptyState
        description="Centralisez les rendez-vous médicaux et administratifs"
        onActivate={() => activateCardTemplate('rdvs')}
        activateLabel="Importer le modèle"
      />
    </DashboardCard>
  );

  if (upcomingRdvs.length === 0) return (
    <DashboardCard key="rdvs" title="Rendez-vous" icon="📅" color={colors.info}>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>Aucun rendez-vous à venir</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/rdv')} activeOpacity={0.7}>
          <Text style={[styles.seeAllText, { color: primary }]}>Voir tout →</Text>
        </TouchableOpacity>
      </View>
    </DashboardCard>
  );

  return (
    <DashboardCard key="rdvs" title="Rendez-vous" icon="📅" count={upcomingRdvs.length} color={colors.info}>
      {upcomingRdvs.slice(0, 3).map((rdv) => (
        <TouchableOpacity key={rdv.sourceFile} style={[styles.rdvRow, { borderLeftColor: colors.info }]} onPress={() => onEditRDV(rdv)} activeOpacity={0.7}>
          <Text style={[styles.rdvDate, { color: colors.info }]}>{formatDateForDisplay(rdv.date_rdv)} {rdv.heure ? `à ${rdv.heure}` : ''}</Text>
          <Text style={[styles.rdvTitle, { color: colors.text }]}>{rdv.type_rdv} — {rdv.enfant}</Text>
          {rdv.médecin && <Text style={[styles.rdvMeta, { color: colors.textMuted }]}>{rdv.médecin}</Text>}
        </TouchableOpacity>
      ))}
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/rdv')} activeOpacity={0.7}>
          <Text style={[styles.seeAllText, { color: primary }]}>Voir tout →</Text>
        </TouchableOpacity>
      </View>
    </DashboardCard>
  );
}

export const DashboardRdvs = React.memo(DashboardRdvsInner);

const styles = StyleSheet.create({
  emptyHint: {
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '600',
  },
  rdvTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rdvMeta: {
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
