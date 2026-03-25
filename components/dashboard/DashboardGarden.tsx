/**
 * DashboardGarden.tsx — Widget jardin familial
 *
 * Affiche tous les arbres de la famille côte à côte.
 * Tap sur un arbre → écran dédié plein écran.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { TreeView } from '../mascot/TreeView';
import { calculateLevel, addPoints } from '../../lib/gamification';
import { getTreeStage, getTreeStageInfo } from '../../lib/mascot';
import { SPECIES_INFO, type TreeSpecies } from '../../lib/mascot/types';
import { getDailyAdventure, getTodayStr, type Adventure } from '../../lib/mascot/adventures';
import { hapticsTreeTap } from '../../lib/mascot/haptics';
import type { DashboardSectionProps } from './types';
import type { Profile } from '../../lib/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

const DEFAULT_SPECIES: TreeSpecies = 'cerisier';

const SecureStore = Platform.OS === 'web'
  ? { getItemAsync: async () => null, setItemAsync: async () => {} }
  : require('expo-secure-store');

function DashboardGardenInner({ isChildMode }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
  const { profiles, activeProfile, completeAdventure } = useVault();
  const { showToast } = useToast();

  // Aventure du jour
  const profileId = activeProfile?.id ?? '';
  const today = getTodayStr();
  const adventure = getDailyAdventure(profileId);
  const [adventureChoice, setAdventureChoice] = useState<'A' | 'B' | null>(null);
  const [adventureLoading, setAdventureLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const key = `adventure_${profileId}_${today}`;
      const stored = await SecureStore.getItemAsync(key);
      if (stored === 'A' || stored === 'B') setAdventureChoice(stored);
      setAdventureLoading(false);
    })();
  }, [profileId, today]);

  const handleAdventureChoice = useCallback(async (choice: 'A' | 'B') => {
    const key = `adventure_${profileId}_${today}`;
    await SecureStore.setItemAsync(key, choice);
    setAdventureChoice(choice);
    hapticsTreeTap();
    const choiceData = choice === 'A' ? adventure.choiceA : adventure.choiceB;
    await completeAdventure(profileId, choiceData.points, `Aventure: ${adventure.id}`);
    showToast(t('mascot.adventure.reward', { points: choiceData.points }));
  }, [profileId, today, adventure, completeAdventure, showToast, t]);

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

      {/* Aventure du jour */}
      {!adventureLoading && activeProfile && (
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View style={[styles.adventureCard, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
            <Text style={styles.adventureEmoji}>{adventure.emoji}</Text>
            <Text style={[styles.adventureTitle, { color: colors.text }]}>
              {t(adventure.titleKey)}
            </Text>
            <Text style={[styles.adventureDesc, { color: colors.textSub }]}>
              {t(adventure.descriptionKey)}
            </Text>

            {adventureChoice ? (
              <View style={styles.adventureResult}>
                <Text style={[styles.adventureResultText, { color: colors.text }]}>
                  {t(`mascot.adventure.${adventure.id}.result${adventureChoice}`)}
                </Text>
                <Text style={[styles.adventureResultPts, { color: primary }]}>
                  +{adventureChoice === 'A' ? adventure.choiceA.points : adventure.choiceB.points} pts
                </Text>
              </View>
            ) : (
              <View style={styles.adventureChoices}>
                <TouchableOpacity
                  style={[styles.adventureBtn, { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => handleAdventureChoice('A')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.adventureBtnText, { color: primary }]}>
                    {adventure.choiceA.emoji} {t(adventure.choiceA.labelKey)}
                  </Text>
                  <Text style={[styles.adventurePts, { color: colors.textMuted }]}>+{adventure.choiceA.points} pts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adventureBtn, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
                  onPress={() => handleAdventureChoice('B')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.adventureBtnText, { color: colors.text }]}>
                    {adventure.choiceB.emoji} {t(adventure.choiceB.labelKey)}
                  </Text>
                  <Text style={[styles.adventurePts, { color: colors.textMuted }]}>+{adventure.choiceB.points} pts</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      )}

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
  adventureCard: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  adventureEmoji: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  adventureTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.xxs,
  },
  adventureDesc: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  adventureChoices: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  adventureBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  adventureBtnText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  adventurePts: {
    fontSize: FontSize.micro,
  },
  adventureResult: {
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  adventureResultText: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  adventureResultPts: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
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
