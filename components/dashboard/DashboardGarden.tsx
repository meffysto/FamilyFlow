/**
 * DashboardGarden.tsx — Widget jardin familial v2
 *
 * Timeline horizontale avec anneaux SVG de progression,
 * row de batiments avec production, badges d'usure,
 * et toggle famille/solo avec persistence SecureStore.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, LayoutAnimation, Modal, TextInput, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { DashboardCard } from '../DashboardCard';
import { parseCrops, getMainPlotIndex } from '../../lib/mascot/farm-engine';
import { CROP_CATALOG, BUILDING_CATALOG } from '../../lib/mascot/types';
import { CROP_SPRITES } from '../../lib/mascot/crop-sprites';
import { getPendingResources, getMinutesUntilNext, MAX_PENDING } from '../../lib/mascot/building-engine';
import { getActiveWearEffects } from '../../lib/mascot/wear-engine';
import { getDailyAdventure } from '../../lib/mascot/adventures';
import { formatDateStr } from '../../lib/mascot/utils';
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
import type { PlantedCrop, PlacedBuilding } from '../../lib/mascot/types';
import type { WearEffects } from '../../lib/mascot/wear-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SecureStoreCompat as SecureStore } from '../../lib/mascot/utils';

// ── Constantes ──────────────────────────────────────────────────────

const RING_RADIUS = 22;
const RING_CX = 26;
const RING_SIZE = 52;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~138.2

/** Couleur du stroke par stade de culture */
const STAGE_COLORS: Record<number, string> = {
  0: '#555',
  1: '#8B6914',
  2: '#6b8a3e',
  3: '#4ADE80',
  4: '#4ADE80',
};

/** Emoji de ressource par type de batiment */
const RESOURCE_EMOJI: Record<string, string> = {
  oeuf: '🥚',
  lait: '🥛',
  farine: '🌾',
  miel: '🍯',
};

const FAMILY_TOGGLE_KEY = 'dashboard_family_toggle';

// ── Sous-composants memo ────────────────────────────────────────────

/** Anneau pulse bleu pour le main plot */
const MainPlotPulse = React.memo(function MainPlotPulse() {
  const pulseOpacity = useSharedValue(0.3);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.3, { duration: 1200 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulseOpacity);
  }, [pulseOpacity, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: '#60A5FA',
        },
        animStyle,
      ]}
    />
  );
});

/** Badge sparkle anime pour les cultures dorees */
const GoldenSparkle = React.memo(function GoldenSparkle() {
  const sparkleOpacity = useSharedValue(1);
  const sparkleScale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    sparkleOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      false,
    );
    sparkleScale.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(sparkleOpacity);
      cancelAnimation(sparkleScale);
    };
  }, [sparkleOpacity, sparkleScale, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
    transform: [{ scale: sparkleScale.value }],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', top: -4, right: -2, zIndex: 2 },
        animStyle,
      ]}
    >
      <Text style={{ fontSize: 10 }}>✨</Text>
    </Animated.View>
  );
});

// ── Composant principal ─────────────────────────────────────────────

function DashboardGardenInner({ isChildMode }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, tint, colors } = useThemeColors();
  const { profiles, activeProfile, completeAdventure, familyQuests, renameGarden } = useVault();
  const { showToast } = useToast();
  const tone = useTone();

  const profileId = activeProfile?.id ?? '';
  const today = formatDateStr();
  const completedSagas = activeProfile?.completedSagas ?? [];

  // ── Family Toggle ────────────────────────────────────────────
  const [familyMode, setFamilyMode] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(FAMILY_TOGGLE_KEY).then(val => {
      if (val === 'true') setFamilyMode(true);
    });
  }, []);

  const handleToggleFamily = useCallback(() => {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch { /* noop */ }
    setFamilyMode(prev => {
      const next = !prev;
      SecureStore.setItemAsync(FAMILY_TOGGLE_KEY, next ? 'true' : 'false');
      return next;
    });
  }, []);

  // ── Rename garden modal ──────────────────────────────────────
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState('');

  const gardenDisplayName = activeProfile?.gardenName || t('mascot.garden.title');

  const handleTitleLongPress = useCallback(() => {
    setRenameText(activeProfile?.gardenName ?? '');
    setRenameVisible(true);
  }, [activeProfile?.gardenName]);

  const handleRenameConfirm = useCallback(async () => {
    if (!activeProfile) return;
    const trimmed = renameText.trim();
    try {
      await renameGarden(activeProfile.id, trimmed);
    } catch (e) {
      if (__DEV__) console.warn('renameGarden', e);
    }
    setRenameVisible(false);
  }, [activeProfile, renameText, renameGarden]);

  // ── Quete cooperative active ─────────────────────────────────
  const activeQuest = useMemo(
    () => familyQuests?.find(q => q.status === 'active') ?? null,
    [familyQuests],
  );

  // ── Aventure one-shot ────────────────────────────────────────
  const adventure = getDailyAdventure(profileId);
  const [adventureChoice, setAdventureChoice] = useState<'A' | 'B' | null>(null);

  // ── Saga state ───────────────────────────────────────────────
  const [sagaProgress, setSagaProgress] = useState<SagaProgress | null>(null);
  const [lastCompletion, setLastCompletion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sagaChapterDone = sagaProgress?.lastChapterDate === today;

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

  // ── Saga courante ────────────────────────────────────────────
  const activeSaga = sagaProgress ? getSagaById(sagaProgress.sagaId) : null;
  const hasSaga = !!activeSaga && !!sagaProgress && sagaProgress.status === 'active';

  // ── Handlers ─────────────────────────────────────────────────

  const handleAdventureChoice = useCallback(async (choice: 'A' | 'B') => {
    const key = `adventure_${profileId}_${today}`;
    await SecureStore.setItemAsync(key, choice);
    setAdventureChoice(choice);
    hapticsTreeTap();
    const choiceData = choice === 'A' ? adventure.choiceA : adventure.choiceB;
    await completeAdventure(profileId, choiceData.points, `Aventure: ${adventure.id}`);
    showToast(t('mascot.adventure.reward', { points: choiceData.points }));
  }, [profileId, today, adventure, completeAdventure, showToast, t]);

  // ── Calcul wear global (pour badge header) ───────────────────
  const totalWearCount = useMemo(() => {
    if (!profiles) return 0;
    const profilesToCount = familyMode ? profiles : (activeProfile ? [activeProfile] : []);
    let count = 0;
    for (const p of profilesToCount) {
      const events = Array.isArray(p.wearEvents) ? p.wearEvents : [];
      const active = events.filter(e => !e.repairedAt);
      count += active.length;
    }
    return count;
  }, [profiles, activeProfile, familyMode]);

  const otherProfiles = useMemo(
    () => (profiles ?? []).filter(p => p.id !== activeProfile?.id),
    [profiles, activeProfile?.id],
  );

  if (!profiles || profiles.length === 0) return null;

  const handleTreePress = (profile: Profile) => {
    router.push({ pathname: '/(tabs)/tree' as any, params: { profileId: profile.id } });
  };

  // ── Teaser prochaine saga ────────────────────────────────────
  const nextSagaTeaser = !hasSaga ? getNextSagaTeaser(profileId, completedSagas) : null;
  const daysUntilSaga = !hasSaga ? restDaysRemaining(lastCompletion) : 0;

  // ── Rendu profil section ─────────────────────────────────────

  const renderProfileSection = (profile: Profile, isCompact: boolean, showHeader = true) => {
    const crops = parseCrops(profile.farmCrops ?? '');
    const buildings: PlacedBuilding[] = Array.isArray(profile.farmBuildings) ? profile.farmBuildings : [];
    const wearEvents = Array.isArray(profile.wearEvents) ? profile.wearEvents : [];
    const wearEffects = getActiveWearEffects(wearEvents);
    const activeWearCount = wearEvents.filter(e => !e.repairedAt).length;
    const readyCount = crops.filter(c => c.currentStage >= 4).length;
    const hasFarm = crops.length > 0 || buildings.length > 0;
    const mainPlotIdx = getMainPlotIndex(crops);

    // Tri : plus recent plante a gauche, plus proche recolte a droite
    const sortedCrops = [...crops].sort((a, b) => {
      const cmp = (a.plantedAt ?? '').localeCompare(b.plantedAt ?? '');
      if (cmp !== 0) return cmp;
      return a.currentStage - b.currentStage;
    });

    return (
      <View key={profile.id} style={isCompact ? styles.profileSectionCompact : styles.profileSection}>
        {/* En-tete profil (masque pour le profil actif, deja dans headerRow) */}
        {showHeader && (
          <TouchableOpacity
            style={styles.profileHeader}
            onPress={() => handleTreePress(profile)}
            activeOpacity={0.7}
            accessibilityLabel={t('mascot.garden.treeA11y', { name: profile.name })}
            accessibilityRole="button"
          >
            <Text style={styles.profileAvatar}>{profile.avatar}</Text>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {profile.name}
            </Text>
            {readyCount > 0 && (
              <View style={styles.harvestBadge}>
                <Text style={styles.harvestBadgeText}>
                  {readyCount} {readyCount > 1 ? 'pretes' : 'prete'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {hasFarm ? (
          <>
            {/* Section Cultures */}
            {crops.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CULTURES</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cropsLane}
                >
                  {sortedCrops.map((crop, i) => {
                    const def = CROP_CATALOG.find(c => c.id === crop.cropId);
                    if (!def) return null;
                    const isMain = crop.plotIndex === mainPlotIdx;
                    const isMature = crop.currentStage >= 4;
                    const isGolden = !!crop.isGolden;
                    const progress = isMature
                      ? 1
                      : (crop.currentStage * def.tasksPerStage + crop.tasksCompleted) / (4 * def.tasksPerStage);

                    // Couleur du ring
                    const ringColor = isGolden
                      ? '#f0c040'
                      : (STAGE_COLORS[crop.currentStage] ?? STAGE_COLORS[4]!);
                    const dashOffset = CIRCUMFERENCE * (1 - progress);

                    // Wear badges sur cette parcelle
                    const hasBrokenFence = wearEffects.blockedPlots.includes(crop.plotIndex);
                    const hasWeeds = wearEffects.weedyPlots.includes(crop.plotIndex);

                    // Couleur des dots
                    const dotColor = (filled: boolean) => {
                      if (!filled) return colors.border;
                      if (isMain) return '#60A5FA';
                      if (isGolden || isMature) return '#f0c040';
                      return '#8B6914';
                    };

                    // Label crop : partie apres "farm.crop."
                    const cropLabel = t(def.labelKey);

                    return (
                      <View key={i} style={styles.cropCard}>
                        {/* Ring wrap */}
                        <View style={styles.ringWrap}>
                          {/* Main plot pulse */}
                          {isMain && <MainPlotPulse />}

                          {/* Mature glow */}
                          {isMature && !isGolden && (
                            <View style={styles.matureGlow} />
                          )}

                          {/* Golden sparkle badge */}
                          {isGolden && <GoldenSparkle />}

                          {/* SVG Ring */}
                          <Svg
                            width={RING_SIZE}
                            height={RING_SIZE}
                            style={{ transform: [{ rotate: '-90deg' }] }}
                          >
                            <Circle
                              cx={RING_CX}
                              cy={RING_CX}
                              r={RING_RADIUS}
                              fill="transparent"
                              stroke={colors.border}
                              strokeWidth={3}
                            />
                            <Circle
                              cx={RING_CX}
                              cy={RING_CX}
                              r={RING_RADIUS}
                              fill="transparent"
                              stroke={ringColor}
                              strokeWidth={3}
                              strokeDasharray={CIRCUMFERENCE.toString()}
                              strokeDashoffset={dashOffset}
                              strokeLinecap="round"
                            />
                          </Svg>

                          {/* Sprite ou emoji centre */}
                          {CROP_SPRITES[crop.cropId]?.[crop.currentStage] ? (
                            <Image
                              source={CROP_SPRITES[crop.cropId][crop.currentStage][0]}
                              style={styles.ringSprite}
                              resizeMode="contain"
                            />
                          ) : (
                            <Text style={styles.ringCenter}>{def.emoji}</Text>
                          )}

                          {/* Wear badge crop */}
                          {hasBrokenFence && (
                            <View style={[styles.wearBadge, { backgroundColor: '#ef4444' }]}>
                              <Text style={styles.wearBadgeEmoji}>🔨</Text>
                            </View>
                          )}
                          {hasWeeds && !hasBrokenFence && (
                            <View style={[styles.wearBadge, { backgroundColor: '#22C55E' }]}>
                              <Text style={styles.wearBadgeEmoji}>🌿</Text>
                            </View>
                          )}
                        </View>

                        {/* Golden shadow */}
                        {isGolden && <View style={styles.goldenShadow} />}

                        {/* Stage dots */}
                        <View style={styles.stageDots}>
                          {[0, 1, 2, 3].map(s => (
                            <View
                              key={s}
                              style={[
                                styles.dot,
                                { backgroundColor: dotColor(crop.currentStage > s) },
                              ]}
                            />
                          ))}
                        </View>

                        {/* Crop label */}
                        <Text style={[styles.cropLabel, { color: colors.textMuted }]} numberOfLines={1}>
                          {cropLabel}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Section Batiments */}
            {buildings.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: Spacing.xs }]}>
                  BÂTIMENTS
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.buildingsRow}
                >
                  {buildings.map((b, i) => {
                    const def = BUILDING_CATALOG.find(bd => bd.id === b.buildingId);
                    if (!def) return null;
                    const now = new Date();
                    const pending = getPendingResources(b, now);
                    const minutesLeft = pending < MAX_PENDING ? getMinutesUntilNext(b, now) : 0;
                    const timeLeft = minutesLeft > 0
                      ? minutesLeft >= 60
                        ? `${Math.floor(minutesLeft / 60)}h${minutesLeft % 60 > 0 ? String(minutesLeft % 60).padStart(2, '0') : ''}`
                        : `${minutesLeft}min`
                      : null;
                    const isDamaged = wearEffects.damagedBuildings.includes(b.cellId);
                    const hasPests = wearEffects.pestBuildings.includes(b.cellId);
                    const tier = def.tiers.find(t2 => t2.level === b.level) ?? def.tiers[0];
                    const resEmoji = RESOURCE_EMOJI[def.resourceType] ?? '📦';

                    return (
                      <View
                        key={i}
                        style={[
                          styles.buildingCard,
                          {
                            backgroundColor: colors.cardAlt,
                            borderColor: isDamaged
                              ? 'rgba(239,68,68,0.4)'
                              : pending > 0
                                ? 'rgba(74,222,128,0.3)'
                                : colors.borderLight,
                          },
                        ]}
                      >
                        <Text style={styles.buildingEmoji}>{def.emoji}</Text>
                        <View style={styles.buildingInfo}>
                          <Text style={[styles.buildingName, { color: colors.text }]} numberOfLines={1}>
                            {t(def.labelKey)}
                          </Text>
                          <View style={styles.buildingMeta}>
                            <View style={styles.levelBadge}>
                              <Text style={[styles.levelBadgeText, { color: colors.textMuted }]}>Nv{b.level}</Text>
                            </View>
                            <Text style={styles.resourceEmoji}>{resEmoji}</Text>
                            {timeLeft !== null && (
                              <Text
                                style={[
                                  styles.productionRate,
                                  { color: colors.textMuted },
                                  isDamaged && styles.strikethrough,
                                ]}
                              >
                                {timeLeft}
                              </Text>
                            )}
                          </View>
                        </View>
                        {/* Pending count */}
                        <View
                          style={[
                            styles.pendingBadge,
                            pending > 0
                              ? { backgroundColor: 'rgba(74,222,128,0.12)' }
                              : { backgroundColor: 'transparent' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pendingText,
                              { color: pending > 0 ? '#4ADE80' : colors.textMuted },
                            ]}
                          >
                            {pending}
                          </Text>
                        </View>

                        {/* Wear badges batiment */}
                        {isDamaged && (
                          <View style={styles.buildingWearBadge}>
                            <Text style={{ fontSize: 9 }}>🏚️</Text>
                          </View>
                        )}
                        {hasPests && !isDamaged && (
                          <View style={styles.buildingWearBadge}>
                            <Text style={{ fontSize: 9 }}>🐛</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Wear alert banner */}
            {activeWearCount > 0 && profile.id === activeProfile?.id && (
              <View style={styles.wearBanner}>
                <Text style={styles.wearBannerIcon}>⚠️</Text>
                <Text style={styles.wearBannerText}>
                  {activeWearCount} réparation{activeWearCount > 1 ? 's' : ''} nécessaire{activeWearCount > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={styles.wearBannerAction}
                  onPress={() => router.push('/(tabs)/tree' as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.wearBannerActionText}>Réparer</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyFarm}>
            <Text style={styles.emptyFarmIcon}>🌱</Text>
            <Text style={[styles.emptyFarmText, { color: colors.textMuted }]}>
              {t('mascot.garden.noFarm', { defaultValue: 'Ferme a demarrer' })}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ── Carte aventure one-shot (inchangee) ──────────────────────

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

  // ── Rendu principal ──────────────────────────────────────────

  return (
    <DashboardCard
      title={gardenDisplayName}
      icon="🌳"
      color={colors.catJeux}
      tinted
      collapsible
      cardId="garden"
      onTitleLongPress={handleTitleLongPress}
    >
      {/* Header : profil actif a gauche, toggle + badge a droite */}
      {activeProfile && (
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => handleTreePress(activeProfile)}
            activeOpacity={0.7}
          >
            <Text style={styles.profileAvatar}>{activeProfile.avatar}</Text>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {activeProfile.name}
            </Text>
            {(() => {
              const ready = parseCrops(activeProfile.farmCrops ?? '').filter(c => c.currentStage >= 4).length;
              return ready > 0 ? (
                <View style={styles.harvestBadge}>
                  <Text style={styles.harvestBadgeText}>{ready}</Text>
                </View>
              ) : null;
            })()}
          </TouchableOpacity>

          <View style={styles.headerRight}>
            {profiles.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.familyToggle,
                  {
                    borderColor: familyMode ? 'rgba(74,222,128,0.3)' : colors.border,
                    backgroundColor: familyMode ? 'rgba(74,222,128,0.08)' : 'transparent',
                  },
                ]}
                onPress={handleToggleFamily}
                activeOpacity={0.7}
              >
                <Text style={styles.familyToggleIcon}>👨‍👩‍👧</Text>
                <Text
                  style={[
                    styles.familyToggleLabel,
                    { color: familyMode ? '#4ADE80' : colors.textMuted },
                  ]}
                >
                  Famille
                </Text>
                <View
                  style={[
                    styles.familyToggleCount,
                    familyMode
                      ? { backgroundColor: 'rgba(74,222,128,0.15)' }
                      : { backgroundColor: colors.cardAlt },
                  ]}
                >
                  <Text
                    style={[
                      styles.familyToggleCountText,
                      { color: familyMode ? '#4ADE80' : colors.textMuted },
                    ]}
                  >
                    {profiles.length}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {totalWearCount > 0 && (
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>{totalWearCount}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Contenu ferme profil actif */}
      {activeProfile && (
        profiles.some(p => {
          const c = parseCrops(p.farmCrops ?? '');
          return c.length > 0 || (p.farmBuildings?.length ?? 0) > 0;
        })
          ? renderProfileSection(activeProfile, false, false)
          : (
            <View style={[styles.emptyFarmGlobal, { borderColor: colors.borderLight }]}>
              <Text style={styles.emptyFarmGlobalIcon}>🌱</Text>
              <Text style={[styles.emptyFarmGlobalTitle, { color: colors.text }]}>
                {t('mascot.garden.emptyFarm.title', { defaultValue: 'Creez votre ferme !' })}
              </Text>
              <Text style={[styles.emptyFarmGlobalDesc, { color: colors.textMuted }]}>
                {t('mascot.garden.emptyFarm.desc', { defaultValue: "Plantez vos premieres cultures depuis l'onglet Mon Jardin." })}
              </Text>
            </View>
          )
      )}

      {/* Autres profils en mode famille */}
      {familyMode && otherProfiles.length > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          {otherProfiles.map(p => renderProfileSection(p, true))}
        </>
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

      {/* Indicateur compact quete active */}
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

      {/* Lien vers l'ecran arbre */}
      <TouchableOpacity
        style={[styles.cta, { backgroundColor: tint }]}
        onPress={() => router.push('/(tabs)/tree' as any)}
        activeOpacity={0.7}
      >
        <Text style={[styles.ctaText, { color: primary }]}>
          {isChildMode ? t('mascot.garden.ctaChild') : t('mascot.garden.cta')}
        </Text>
      </TouchableOpacity>

      {/* Modal rename jardin */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRenameVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('mascot.garden.renameTitle')}
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              value={renameText}
              onChangeText={setRenameText}
              placeholder={t('mascot.garden.renamePlaceholder')}
              placeholderTextColor={colors.textSub}
              maxLength={30}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={handleRenameConfirm}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => setRenameVisible(false)}
              >
                <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: primary }]}
                onPress={handleRenameConfirm}
              >
                <Text style={{ color: colors.onPrimary }}>{t('mascot.garden.renameConfirm')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DashboardCard>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Header area ────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  familyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
  },
  familyToggleIcon: {
    fontSize: 13,
  },
  familyToggleLabel: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
  },
  familyToggleCount: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyToggleCountText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  cardBadge: {
    backgroundColor: '#ef4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  cardBadgeText: {
    color: '#fff',
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },

  // ── Profile section ────────────────────────
  profileSection: {
    paddingVertical: Spacing.xs,
  },
  profileSectionCompact: {
    paddingVertical: Spacing.xs,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  profileAvatar: {
    fontSize: FontSize.body,
    lineHeight: 20,
  },
  profileName: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  harvestBadge: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.base,
  },
  harvestBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    color: '#0a2e14',
  },
  sectionLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xxs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.md,
  },

  // ── Crops timeline lane ────────────────────
  cropsLane: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  cropCard: {
    width: 68,
    alignItems: 'center',
    gap: 4,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenter: {
    fontSize: 22,
    position: 'absolute',
    lineHeight: 26,
  },
  ringSprite: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  matureGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 999,
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  goldenShadow: {
    // Ombre doree simulee via shadow props RN
    position: 'absolute',
    top: 0,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: 999,
    shadowColor: '#f0c040',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  stageDots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cropLabel: {
    fontSize: 9,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },

  // ── Wear badges sur crops ──────────────────
  wearBadge: {
    position: 'absolute',
    top: -4,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  wearBadgeEmoji: {
    fontSize: 10,
  },

  // ── Buildings production row ───────────────
  buildingsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  buildingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.base,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    position: 'relative',
  },
  buildingEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  buildingInfo: {
    gap: 1,
  },
  buildingName: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
  },
  buildingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelBadge: {
    backgroundColor: 'rgba(128,128,128,0.15)',
    borderRadius: Radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.semibold,
  },
  resourceEmoji: {
    fontSize: 10,
  },
  productionRate: {
    fontSize: FontSize.micro,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  pendingBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 'auto',
  },
  pendingText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  buildingWearBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
    zIndex: 3,
  },

  // ── Wear alert banner ──────────────────────
  wearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: Radius.base,
  },
  wearBannerIcon: {
    fontSize: 16,
  },
  wearBannerText: {
    flex: 1,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: '#ef8888',
  },
  wearBannerAction: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderRadius: Spacing.sm,
  },
  wearBannerActionText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#ef4444',
  },

  // ── Empty farm ─────────────────────────────
  emptyFarm: {
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
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing['2xl'],
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

  // ── Adventure card (inchangee) ─────────────
  adventureCard: {
    marginTop: Spacing['2xl'],
    padding: Spacing['2xl'],
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

  // ── CTA ────────────────────────────────────
  cta: {
    marginTop: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // ── Quete cooperative compact ──────────────
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

  // ── Saga indicateur inline ─────────────────
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
  // ── Modal rename ──────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSize.body,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
});

export const DashboardGarden = React.memo(DashboardGardenInner);
