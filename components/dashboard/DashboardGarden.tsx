/**
 * DashboardGarden.tsx — Widget jardin familial
 *
 * Affiche les stats de ferme de chaque membre en grille 2×2.
 * Gère les sagas narratives multi-jours ET les aventures one-shot classiques.
 * Tap sur une cellule → écran jardin dédié.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { parseCrops } from '../../lib/mascot/farm-engine';
import { CROP_CATALOG, BUILDING_CATALOG } from '../../lib/mascot/types';
import { getPendingResources } from '../../lib/mascot/building-engine';
import { getDailyAdventure, getTodayStr } from '../../lib/mascot/adventures';
import { hapticsTreeTap } from '../../lib/mascot/haptics';
import { useTone } from '../../lib/mascot/tone';
import type { SagaProgress } from '../../lib/mascot/sagas-types';
import { createEmptySagaProgress } from '../../lib/mascot/sagas-types';
import {
  shouldStartSaga,
  getSagaById,
  getNextSagaTeaser,
  restDaysRemaining,
} from '../../lib/mascot/sagas-engine';
import {
  loadSagaProgress,
  saveSagaProgress,
  loadLastSagaCompletion,
} from '../../lib/mascot/sagas-storage';
import type { DashboardSectionProps } from './types';
import type { Profile } from '../../lib/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SecureStoreCompat as SecureStore } from '../../lib/mascot/utils';

const MAX_VISIBLE_CROPS = 6;

function DashboardGardenInner({ isChildMode }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
  const { profiles, activeProfile, completeAdventure, familyQuests } = useVault();
  const { showToast } = useToast();
  const tone = useTone();

  const profileId = activeProfile?.id ?? '';
  const today = getTodayStr();
  const completedSagas = activeProfile?.completedSagas ?? [];

  // ── Quête coopérative active ──────────────────────────────
  const activeQuest = useMemo(() => familyQuests?.find(q => q.status === 'active') ?? null, [familyQuests]);

  // ── Aventure one-shot (existant) ──────────────────────────
  const adventure = getDailyAdventure(profileId);
  const [adventureChoice, setAdventureChoice] = useState<'A' | 'B' | null>(null);

  // ── Saga state ────────────────────────────────────────────
  const [sagaProgress, setSagaProgress] = useState<SagaProgress | null>(null);
  const [lastCompletion, setLastCompletion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dérivé : le chapitre du jour a déjà été fait
  const sagaChapterDone = sagaProgress?.lastChapterDate === today;

  // Charger état saga + aventure au montage
  useEffect(() => {
    (async () => {
      const [progress, lastComp] = await Promise.all([
        loadSagaProgress(profileId),
        loadLastSagaCompletion(profileId),
      ]);

      // Aventure one-shot
      const advKey = `adventure_${profileId}_${today}`;
      const storedAdv = await SecureStore.getItemAsync(advKey);
      if (storedAdv === 'A' || storedAdv === 'B') setAdventureChoice(storedAdv);

      // Saga
      if (progress && progress.status === 'active') {
        setSagaProgress(progress);

      } else if (!progress || progress.status === 'completed') {
        // Vérifier si une nouvelle saga doit démarrer
        const { start, sagaId } = shouldStartSaga(profileId, completedSagas, lastComp, new Date());
        if (start && sagaId) {
          const newProgress = createEmptySagaProgress(sagaId, profileId, today);
          await saveSagaProgress(newProgress);
          setSagaProgress(newProgress);
        } else {
          setSagaProgress(null);
        }
      }

      setLastCompletion(lastComp);
      setLoading(false);
    })();
  }, [profileId, today, completedSagas.length]);

  // ── Saga courante ─────────────────────────────────────────
  const activeSaga = sagaProgress ? getSagaById(sagaProgress.sagaId) : null;
  const hasSaga = !!activeSaga && !!sagaProgress && sagaProgress.status === 'active';

  // ── Handlers ──────────────────────────────────────────────

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

  // ── Teaser prochaine saga ─────────────────────────────────
  const nextSagaTeaser = !hasSaga ? getNextSagaTeaser(profileId, completedSagas) : null;
  const daysUntilSaga = !hasSaga ? restDaysRemaining(lastCompletion) : 0;

  // ── Stats ferme par profil ────────────────────────────────
  const renderFarmCell = (profile: Profile) => {
    const crops = parseCrops(profile.farmCrops ?? '');
    const buildings = profile.farmBuildings ?? [];
    const readyCount = crops.filter(c => c.currentStage >= 4).length;
    const hasFarm = crops.length > 0 || buildings.length > 0;
    const visibleCrops = crops.slice(0, MAX_VISIBLE_CROPS);
    const hiddenCount = Math.max(0, crops.length - MAX_VISIBLE_CROPS);
    const cellWidth = profiles.length >= 3 ? '50%' : `${100 / profiles.length}%`;

    return (
      <TouchableOpacity
        key={profile.id}
        style={[styles.farmCell, { width: cellWidth as any, backgroundColor: 'transparent', borderColor: colors.borderLight }]}
        onPress={() => handleTreePress(profile)}
        activeOpacity={0.7}
        accessibilityLabel={t('mascot.garden.treeA11y', { name: profile.name })}
        accessibilityRole="button"
      >
        {/* En-tête : avatar + nom + badge prêtes */}
        <View style={styles.cellHeader}>
          <Text style={styles.cellAvatar}>{profile.avatar}</Text>
          <Text style={[styles.cellName, { color: colors.text }]} numberOfLines={1}>
            {profile.name}
          </Text>
          {readyCount > 0 && (
            <View style={[styles.readyBadge, { backgroundColor: primary }]}>
              <Text style={styles.readyBadgeText}>{readyCount}</Text>
            </View>
          )}
        </View>

        {hasFarm ? (
          <>
            {crops.length > 0 && (
              <View style={styles.cropsRow}>
                {visibleCrops.map((crop, i) => {
                  const def = CROP_CATALOG.find(c => c.id === crop.cropId);
                  if (!def) return null;
                  const isReady = crop.currentStage >= 4;
                  const isGolden = !!crop.isGolden;
                  const progress = isReady
                    ? 1
                    : (crop.currentStage * def.tasksPerStage + crop.tasksCompleted) / (4 * def.tasksPerStage);
                  return (
                    <View
                      key={i}
                      style={[
                        styles.cropChip,
                        {
                          borderColor: isGolden
                            ? 'rgba(240,192,64,0.4)'
                            : isReady
                              ? primary + '55'
                              : colors.border,
                          backgroundColor: isGolden
                            ? 'rgba(240,192,64,0.1)'
                            : isReady
                              ? primary + '18'
                              : colors.cardAlt,
                          opacity: isReady || isGolden ? 1 : 0.6,
                        },
                      ]}
                    >
                      <Text style={styles.cropEmoji}>{def.emoji}</Text>
                      {isGolden && <Text style={styles.goldenSpark}>✨</Text>}
                      <View style={[styles.cropProgressTrack, { backgroundColor: colors.border }]}>
                        <View style={[
                          styles.cropProgressFill,
                          {
                            width: `${Math.round(progress * 100)}%` as any,
                            backgroundColor: isGolden ? '#f0c040' : isReady ? primary : colors.textMuted,
                          },
                        ]} />
                      </View>
                    </View>
                  );
                })}
                {hiddenCount > 0 && (
                  <View style={[styles.cropChip, { borderColor: colors.border, backgroundColor: colors.cardAlt }]}>
                    <Text style={[styles.cropMore, { color: colors.textMuted }]}>+{hiddenCount}</Text>
                  </View>
                )}
              </View>
            )}

            {buildings.length > 0 && (
              <View style={styles.buildingsRow}>
                {buildings.map((b, i) => {
                  const def = BUILDING_CATALOG.find(bd => bd.id === b.buildingId);
                  if (!def) return null;
                  const pending = getPendingResources(b, new Date());
                  return (
                    <View key={i} style={[styles.buildingChip, { backgroundColor: colors.cardAlt, borderColor: pending > 0 ? primary + '55' : colors.border }]}>
                      <Text style={styles.buildingEmoji}>{def.emoji}</Text>
                      <Text style={[styles.buildingLevel, { color: colors.textMuted }]}>lv{b.level}</Text>
                      {pending > 0 && (
                        <Text style={[styles.buildingPending, { color: primary }]}>{pending}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyFarm}>
            <Text style={styles.emptyFarmIcon}>🌱</Text>
            <Text style={[styles.emptyFarmText, { color: colors.textMuted }]}>
              {t('mascot.garden.noFarm', { defaultValue: 'Ferme à démarrer' })}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Rendu ─────────────────────────────────────────────────

  /** Carte aventure one-shot classique (inchangée) */
  const renderOneShotAdventure = () => (
    <Animated.View entering={FadeInDown.delay(200).duration(300)}>
      <View style={[styles.adventureCard, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
        <Text style={styles.adventureEmoji}>{adventure.emoji}</Text>
        <Text style={[styles.adventureTitle, { color: colors.text }]}>
          {t(adventure.titleKey, { context: tone })}
        </Text>
        <Text style={[styles.adventureDesc, { color: colors.textSub }]}>
          {t(adventure.descriptionKey, { context: tone })}
        </Text>

        {adventureChoice ? (
          <View style={styles.adventureResult}>
            <Text style={[styles.adventureResultText, { color: colors.text }]}>
              {t(`mascot.adventure.${adventure.id}.result${adventureChoice}`, { context: tone })}
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

      {/* Teaser prochaine saga */}
      {nextSagaTeaser && (
        <View style={[styles.sagaTeaser, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
          <Text style={[styles.sagaTeaserText, { color: colors.textMuted }]}>
            {nextSagaTeaser.emoji} {daysUntilSaga > 0
              ? t('mascot.saga.teaser', { days: daysUntilSaga, context: tone })
              : t('mascot.saga.teaserReady', { context: tone })
            }
          </Text>
          <Text style={[styles.sagaTeaserTitle, { color: colors.textSub }]}>
            {t(nextSagaTeaser.titleKey, { context: tone })}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  return (
    <DashboardCard
      title={t('mascot.garden.title')}
      icon="🌳"
      color={colors.catJeux}
      tinted
      collapsible
      cardId="garden"
    >
      {/* Grille ferme 2×2 */}
      {profiles.some(p => parseCrops(p.farmCrops ?? '').length > 0 || (p.farmBuildings?.length ?? 0) > 0) ? (
        <View style={styles.farmGrid}>
          {profiles.filter(p => {
            const crops = parseCrops(p.farmCrops ?? '');
            return crops.length > 0 || (p.farmBuildings?.length ?? 0) > 0;
          }).map(renderFarmCell)}
        </View>
      ) : (
        <View style={[styles.emptyFarmGlobal, { borderColor: colors.borderLight }]}>
          <Text style={styles.emptyFarmGlobalIcon}>🌱</Text>
          <Text style={[styles.emptyFarmGlobalTitle, { color: colors.text }]}>
            {t('mascot.garden.emptyFarm.title', { defaultValue: 'Créez votre ferme !' })}
          </Text>
          <Text style={[styles.emptyFarmGlobalDesc, { color: colors.textMuted }]}>
            {t('mascot.garden.emptyFarm.desc', { defaultValue: 'Plantez vos premières cultures depuis l\'onglet Mon Jardin.' })}
          </Text>
        </View>
      )}

      {/* Indicateur saga inline discret */}
      {!loading && activeProfile && hasSaga && sagaProgress && sagaProgress.status !== 'completed' && (
        <TouchableOpacity
          style={[styles.sagaIndicator, { borderColor: colors.borderLight }]}
          onPress={() => router.push('/(tabs)/tree' as any)}
          activeOpacity={0.8}
        >
          <Text style={[styles.sagaIndicatorText, {
            color: sagaChapterDone ? colors.textMuted : primary,
          }]}>
            {sagaChapterDone
              ? t('mascot.saga.indicator.done', 'Suite de la saga demain...')
              : t('mascot.saga.indicator.waiting', 'Un visiteur attend pres de ton arbre')}
          </Text>
          {activeSaga && (
            <Text style={[styles.sagaIndicatorProgress, { color: colors.textSub }]}>
              {t('mascot.saga.indicator.progress', {
                current: sagaProgress.currentChapter,
                total: activeSaga.chapters.length,
                title: t(activeSaga.titleKey),
                defaultValue: `Chapitre ${sagaProgress.currentChapter}/${activeSaga.chapters.length} — ${t(activeSaga.titleKey)}`,
              })}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Indicateur compact quête active */}
      {activeQuest && (
        <TouchableOpacity
          style={[styles.questCompact, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}
          onPress={() => router.push('/(tabs)/tree' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.questCompactHeader}>
            <Text style={[styles.questCompactTitle, { color: colors.text }]} numberOfLines={1}>
              {activeQuest.emoji} {activeQuest.title}
            </Text>
            <Text style={[styles.questCompactCount, { color: colors.textMuted }]}>
              {activeQuest.current}/{activeQuest.target}
            </Text>
          </View>
          <View style={[styles.questCompactTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.questCompactFill, {
              backgroundColor: primary,
              width: `${Math.min((activeQuest.current / activeQuest.target) * 100, 100)}%`,
            }]} />
          </View>
        </TouchableOpacity>
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
  farmGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  farmCell: {
    padding: Spacing.md,
    gap: Spacing.xs,
    minHeight: 100,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  cellAvatar: {
    fontSize: FontSize.body,
    lineHeight: 20,
  },
  cellName: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  readyBadge: {
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  readyBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  cropsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cropChip: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 4,
    position: 'relative',
  },
  cropEmoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  goldenSpark: {
    fontSize: 8,
    position: 'absolute',
    top: -3,
    right: -3,
  },
  cropProgressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 3,
    width: '100%',
  },
  cropProgressFill: {
    height: '100%',
    borderRadius: 1,
  },
  cropMore: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  buildingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  buildingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  buildingEmoji: {
    fontSize: 12,
    lineHeight: 14,
  },
  buildingLevel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
  },
  buildingPending: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    marginLeft: 1,
  },
  emptyFarm: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
    paddingVertical: Spacing.sm,
  },
  emptyFarmIcon: {
    fontSize: 20,
    opacity: 0.25,
  },
  emptyFarmText: {
    fontSize: FontSize.micro,
    textAlign: 'center',
  },
  emptyFarmGlobal: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    marginBottom: Spacing.xs,
  },
  emptyFarmGlobalIcon: {
    fontSize: 28,
    opacity: 0.4,
  },
  emptyFarmGlobalTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  emptyFarmGlobalDesc: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    lineHeight: 18,
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
    flexWrap: 'wrap',
  },
  adventureBtn: {
    flex: 1,
    minWidth: '40%',
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

  // ── Quête coopérative — indicateur compact ─────────────
  questCompact: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  questCompactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxs,
  },
  questCompactTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  questCompactCount: {
    fontSize: FontSize.caption,
    marginLeft: Spacing.sm,
  },
  questCompactTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  questCompactFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ── Saga indicateur inline discret ──────────────────────
  sagaIndicator: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  sagaIndicatorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  sagaIndicatorProgress: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xxs,
  },
  sagaTeaser: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  sagaTeaserText: {
    fontSize: FontSize.micro,
  },
  sagaTeaserTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
});

export const DashboardGarden = React.memo(DashboardGardenInner);
