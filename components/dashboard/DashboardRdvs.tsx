/**
 * DashboardRdvs.tsx — Section rendez-vous à venir
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import { isRdvUpcoming } from '../../lib/parser';
import { formatDateLocalized } from '../../lib/date-locale';
import type { RDV } from '../../lib/types';
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
    <DashboardCard key="rdvs" title={t('dashboard.rdvs.title')} icon="📅" color={colors.catOrganisation} tinted>
      <DashboardEmptyState
        description={t('dashboard.rdvs.emptyDescription')}
        onActivate={() => activateCardTemplate('rdvs')}
        activateLabel={t('dashboard.rdvs.activateLabel')}
      />
    </DashboardCard>
  );

  if (upcomingRdvs.length === 0) return (
    <DashboardCard key="rdvs" title={t('dashboard.rdvs.title')} icon="📅" color={colors.catOrganisation} tinted>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('dashboard.rdvs.noUpcoming')}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/rdv')} activeOpacity={0.7}>
          <Text style={[styles.seeAllText, { color: primary }]}>{t('dashboard.rdvs.seeAll')}</Text>
        </TouchableOpacity>
      </View>
    </DashboardCard>
  );

  const mainRdv = upcomingRdvs[0];
  const otherRdvs = upcomingRdvs.slice(1, 3);

  return (
    <DashboardCard key="rdvs" title={t('dashboard.rdvs.title')} icon="📅" count={upcomingRdvs.length} color={colors.catOrganisation} tinted onPressMore={() => router.push('/(tabs)/rdv')}>
      {/* RDV principal — hiérarchie forte */}
      <TouchableOpacity onPress={() => onEditRDV(mainRdv)} activeOpacity={0.7}>
        {mainRdv.heure && (
          <Text style={[styles.mainTime, { color: colors.info }]}>{mainRdv.heure}</Text>
        )}
        <Text style={[styles.mainTitle, { color: colors.text }]}>{mainRdv.type_rdv} — {mainRdv.enfant}</Text>
        {(mainRdv.médecin || mainRdv.lieu) && (
          <Text style={[styles.mainMeta, { color: colors.textMuted }]}>
            {[mainRdv.médecin, mainRdv.lieu].filter(Boolean).join(' · ')}
          </Text>
        )}
      </TouchableOpacity>
      {/* RDVs secondaires — discrets */}
      {otherRdvs.length > 0 && (
        <View style={[styles.otherRdvs, { borderTopColor: colors.border }]}>
          {otherRdvs.map((rdv) => (
            <TouchableOpacity key={rdv.sourceFile} style={styles.otherRow} onPress={() => onEditRDV(rdv)} activeOpacity={0.7}>
              <Text style={[styles.otherTime, { color: colors.info }]}>{rdv.heure || formatDateLocalized(rdv.date_rdv)}</Text>
              <Text style={[styles.otherTitle, { color: colors.textSub }]} numberOfLines={1}>{rdv.type_rdv} — {rdv.enfant}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  mainTime: {
    fontSize: 42,
    fontWeight: FontWeight.bold,
    lineHeight: 46,
    letterSpacing: -1,
  },
  mainTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  mainMeta: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  otherRdvs: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 6,
    gap: 4,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  otherTime: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    minWidth: 44,
  },
  otherTitle: {
    fontSize: FontSize.caption,
    flex: 1,
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
