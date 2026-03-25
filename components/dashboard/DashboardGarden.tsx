/**
 * DashboardGarden.tsx — Widget jardin familial
 *
 * Affiche tous les arbres de la famille côte à côte.
 * Tap sur un arbre → écran dédié plein écran.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { TreeView } from '../mascot/TreeView';
import { calculateLevel } from '../../lib/gamification';
import { getTreeStage, getTreeStageInfo } from '../../lib/mascot';
import { SPECIES_INFO, type TreeSpecies } from '../../lib/mascot/types';
import type { DashboardSectionProps } from './types';
import type { Profile } from '../../lib/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

const DEFAULT_SPECIES: TreeSpecies = 'cerisier';

function DashboardGardenInner({ isChildMode }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
  const { profiles } = useVault();

  if (!profiles || profiles.length === 0) return null;

  const handleTreePress = (profile: Profile) => {
    router.push({ pathname: '/(tabs)/tree' as any, params: { profileId: profile.id } });
  };

  return (
    <DashboardCard
      title={t('mascot.garden.title')}
      icon="🌳"
      color="#4ADE80"
      collapsible
      cardId="garden"
    >
      {/* Vue jardin : arbres côte à côte */}
      <View style={styles.gardenRow}>
        {profiles.map((profile) => {
          const species = profile.treeSpecies;
          const currentSpecies = species || DEFAULT_SPECIES;
          const level = calculateLevel(profile.points ?? 0);
          const stageInfo = getTreeStageInfo(level);
          const sp = SPECIES_INFO[currentSpecies];

          return (
            <TouchableOpacity
              key={profile.id}
              style={styles.treeSlot}
              onPress={() => handleTreePress(profile)}
              activeOpacity={0.7}
              accessibilityLabel={t('mascot.garden.treeA11y', { name: profile.name })}
              accessibilityRole="button"
            >
              {/* Arbre */}
              <View style={styles.treeWrap}>
                <TreeView
                  species={currentSpecies}
                  level={level}
                  size={profiles.length <= 3 ? 100 : 80}
                  showGround={false}
                  interactive
                />
              </View>

              {/* Nom + avatar */}
              <View style={styles.labelRow}>
                <Text style={[styles.avatar]}>{profile.avatar}</Text>
                <Text
                  style={[styles.name, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {profile.name}
                </Text>
              </View>

              {/* Stade */}
              <Text
                style={[styles.stage, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {sp.emoji} {t(stageInfo.labelKey)}
              </Text>

              {/* Si pas d'espèce choisie → indication */}
              {!species && (
                <View style={[styles.chooseBadge, { backgroundColor: tint }]}>
                  <Text style={[styles.chooseText, { color: primary }]}>
                    {t('mascot.garden.choose')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lien vers l'écran arbre */}
      <TouchableOpacity
        style={[styles.cta, { backgroundColor: tint }]}
        onPress={() => router.push('/(tabs)/tree' as any)}
        activeOpacity={0.7}
      >
        <Text style={[styles.ctaText, { color: primary }]}>
          {isChildMode ? t('mascot.garden.ctaChild') : t('mascot.garden.cta')}
        </Text>
      </TouchableOpacity>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  gardenRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    paddingVertical: Spacing.md,
    minHeight: 140,
  },
  treeSlot: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 120,
  },
  treeWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    marginTop: Spacing.xs,
  },
  avatar: {
    fontSize: FontSize.body,
  },
  name: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  stage: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
  },
  chooseBadge: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.full,
  },
  chooseText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
  },
  cta: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});

export const DashboardGarden = React.memo(DashboardGardenInner);
