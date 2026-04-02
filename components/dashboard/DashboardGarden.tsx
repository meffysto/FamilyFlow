/**
 * DashboardGarden.tsx — Widget jardin familial
 *
 * Affiche tous les arbres de la famille côte à côte.
 * Gère les sagas narratives multi-jours ET les aventures one-shot classiques.
 * Tap sur un arbre → écran dédié plein écran.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { TreeView } from '../mascot/TreeView';
import { calculateLevel } from '../../lib/gamification';
import { getTreeStageInfo } from '../../lib/mascot';
import { SPECIES_INFO, type TreeSpecies } from '../../lib/mascot/types';
import { getDailyAdventure, getTodayStr, type Adventure } from '../../lib/mascot/adventures';
import { hapticsTreeTap } from '../../lib/mascot/haptics';
import { useTone } from '../../lib/mascot/tone';
import type { SagaProgress } from '../../lib/mascot/sagas-types';
import { createEmptySagaProgress, ALL_TRAITS } from '../../lib/mascot/sagas-types';
import {
  shouldStartSaga,
  getSagaById,
  getSagaCompletionResult,
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
import { Shadows } from '../../constants/shadows';
import { SecureStoreCompat as SecureStore } from '../../lib/mascot/utils';

const DEFAULT_SPECIES: TreeSpecies = 'cerisier';

function DashboardGardenInner({ isChildMode }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
  const { profiles, activeProfile, completeAdventure } = useVault();
  const { showToast } = useToast();
  const tone = useTone();

  const profileId = activeProfile?.id ?? '';
  const today = getTodayStr();
  const completedSagas = activeProfile?.completedSagas ?? [];

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

        }
      }

      setLastCompletion(lastComp);
      setLoading(false);
    })();
  }, [profileId, today, completedSagas.length]);

  // ── Saga courante ─────────────────────────────────────────
  const activeSaga = sagaProgress ? getSagaById(sagaProgress.sagaId) : null;
  const currentChapter = activeSaga && sagaProgress
    ? activeSaga.chapters.find(ch => ch.id === sagaProgress.currentChapter)
    : null;
  const isLastChapter = activeSaga && sagaProgress
    ? sagaProgress.currentChapter >= activeSaga.chapters.length
    : false;
  const hasSaga = !!activeSaga && !!sagaProgress && sagaProgress.status === 'active';

  // Traits résumé
  const traitSummary = useMemo(() => {
    if (!sagaProgress) return [];
    return ALL_TRAITS
      .filter(tr => (sagaProgress.traits[tr] ?? 0) > 0)
      .map(tr => ({ trait: tr, value: sagaProgress.traits[tr] }));
  }, [sagaProgress]);

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

  // ── Rendu ─────────────────────────────────────────────────

  /** Dots de progression saga */
  const renderSagaDots = () => {
    if (!activeSaga || !sagaProgress) return null;
    const total = activeSaga.chapters.length;
    const current = Math.min(sagaProgress.currentChapter, total);
    const completed = sagaChapterDone ? current : current - 1;
    return (
      <View style={styles.sagaDots}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.sagaDot,
              {
                backgroundColor: i < completed
                  ? primary
                  : i === completed && sagaChapterDone
                    ? primary
                    : colors.borderLight,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  /** Carte saga (chapitre disponible ou fait) */
  const renderSagaCard = () => {
    if (!activeSaga || !sagaProgress) return null;

    // Saga terminée → carte de complétion
    if (sagaProgress.status === 'completed') {
      const result = getSagaCompletionResult(activeSaga, sagaProgress);
      return (
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View style={[styles.adventureCard, { backgroundColor: colors.cardAlt, borderColor: primary }]}>
            {renderSagaDots()}
            <Text style={styles.adventureEmoji}>{activeSaga.emoji}</Text>
            <Text style={[styles.adventureTitle, { color: primary }]}>
              {t('mascot.saga.complete', { context: tone })}
            </Text>
            <Text style={[styles.adventureTitle, { color: colors.text }]}>
              {t(activeSaga.titleKey, { context: tone })}
            </Text>
            <Text style={[styles.adventureDesc, { color: colors.textSub }]}>
              {t(result.narrativeKey, { context: tone })}
            </Text>
            <View style={[styles.sagaReward, { backgroundColor: primary + '15', borderColor: primary + '40' }]}>
              <Text style={[styles.sagaRewardTitle, { color: primary }]}>
                {t('mascot.saga.rewardTitle', { context: tone })}
              </Text>
              <Text style={[styles.sagaRewardPts, { color: colors.text }]}>
                +{result.bonusXP} pts
              </Text>
              <Text style={[styles.sagaTraitTitle, { color: primary }]}>
                {t(`mascot.saga.traitLabel.${result.dominantTrait}`)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.adventureBtn, { backgroundColor: tint, borderColor: primary }]}
              onPress={() => router.push('/(tabs)/tree' as any)}
              activeOpacity={0.7}
            >
              <Text style={[styles.adventureBtnText, { color: primary }]}>
                {t('mascot.saga.placeReward', { context: tone })}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    // Chapitre déjà fait aujourd'hui → cliffhanger
    if (sagaChapterDone) {
      const prevChapter = activeSaga.chapters.find(ch => ch.id === sagaProgress.currentChapter - 1);
      return (
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View style={[styles.adventureCard, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
            {renderSagaDots()}
            <Text style={styles.adventureEmoji}>{activeSaga.emoji}</Text>
            <Text style={[styles.adventureTitle, { color: colors.text }]}>
              {t(activeSaga.titleKey, { context: tone })}
            </Text>
            {prevChapter && (
              <Text style={[styles.adventureDesc, { color: colors.textSub, fontStyle: 'italic' }]}>
                {t(prevChapter.cliffhangerKey, { context: tone })}
              </Text>
            )}
            <Text style={[styles.sagaCliffhanger, { color: colors.textMuted }]}>
              {t('mascot.saga.cliffhanger', { context: tone })}
            </Text>
            {traitSummary.length > 0 && (
              <View style={styles.sagaTraits}>
                {traitSummary.map(({ trait, value }) => (
                  <Text key={trait} style={[styles.sagaTraitText, { color: colors.textMuted }]}>
                    {t(`mascot.saga.traitLabel.${trait}`)} x{value}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      );
    }

    // Chapitre disponible → indicateur discret uniquement (l'interaction se fait dans l'Arbre)
    if (!currentChapter) return null;
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(300)}>
        <View style={[styles.sagaIndicator, { backgroundColor: colors.cardAlt, borderColor: primary + '40' }]}>
          {renderSagaDots()}
          <Text style={styles.adventureEmoji}>{activeSaga.emoji}</Text>
          <Text style={[styles.adventureTitle, { color: colors.text }]}>
            {t(activeSaga.titleKey, { context: tone })}
          </Text>
          <Text style={[styles.sagaWaitingLabel, { color: colors.textMuted }]}>
            {t('mascot.saga.progress', { current: sagaProgress.currentChapter, total: activeSaga.chapters.length })}
            {' · '}
            {t('mascot.saga.waitingInTree')}
          </Text>
          <TouchableOpacity
            style={[styles.adventureBtn, { backgroundColor: tint, borderColor: primary, marginTop: Spacing.sm }]}
            onPress={() => router.push('/(tabs)/tree' as any)}
            activeOpacity={0.7}
          >
            <Text style={[styles.adventureBtnText, { color: primary }]}>
              {'🌳 '}{t('mascot.garden.cta')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

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
              <View style={styles.treeWrap}>
                <TreeView
                  species={currentSpecies}
                  level={level}
                  size={profiles.length <= 3 ? 100 : 80}
                  showGround={false}
                  interactive
                />
              </View>
              <View style={styles.labelRow}>
                <Text style={[styles.avatar]}>{profile.avatar}</Text>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {profile.name}
                </Text>
              </View>
              <Text style={[styles.stage, { color: colors.textMuted }]} numberOfLines={1}>
                {sp.emoji} {t(stageInfo.labelKey)}
              </Text>
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

      {/* Saga du jour */}
      {!loading && activeProfile && hasSaga && renderSagaCard()}

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

  // ── Saga styles ──────────────────────────────────────────
  sagaDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sagaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sagaChapterLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  sagaCliffhanger: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  sagaTraits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    justifyContent: 'center',
  },
  sagaTraitText: {
    fontSize: FontSize.micro,
  },
  sagaReward: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.xxs,
  },
  sagaRewardTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  sagaRewardPts: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  sagaTraitTitle: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
  },
  // Indicateur saga discret (chapitre disponible — interaction dans l'Arbre)
  sagaIndicator: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  sagaWaitingLabel: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: 18,
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
