/**
 * ExpeditionsSheet.tsx — Modal pageSheet catalogue d'expéditions
 * Phase 33 — Système d'expéditions à risque
 *
 * 3 onglets : Catalogue / En cours / Résultats
 * Calqué sur BuildingsCatalog.tsx (AwningStripes, SPRING_CATALOG, tab pattern)
 */

import React, { useEffect, useState } from 'react';
import type { AppColors } from '../../constants/colors';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Farm } from '../../constants/farm-theme';
import {
  getExpeditionRemainingMinutes,
  isExpeditionComplete,
  getLootDisplay,
  EXPEDITION_DROP_RATES,
  EXPEDITION_LOOT_TABLE,
  EXPEDITION_CATALOG,
  type ExpeditionMission,
} from '../../lib/mascot/expedition-engine';
import { CROP_CATALOG, type HarvestInventory } from '../../lib/mascot/types';
import { countItemTotal } from '../../lib/mascot/grade-engine';
import type { ActiveExpedition, ExpeditionDifficulty, ExpeditionOutcome } from '../../lib/types';

// ── Constantes module ─────────────────────────────────────────────────────────

const SPRING_CATALOG = { damping: 12, stiffness: 180 } as const;

type TabId = 'catalogue' | 'encours' | 'resultats';

const TABS: { id: TabId; label: string }[] = [
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'encours', label: 'En cours' },
  { id: 'resultats', label: 'Résultats' },
];

const TAB_WIDTH = 120;

// ── Sous-composant : auvent rayé (copie exacte de BuildingsCatalog) ───────────

function AwningStripes() {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
      <View style={styles.awningShadow} />
      <View style={styles.awningScallop}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningScallopDot,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Helpers couleur ───────────────────────────────────────────────────────────

function difficultyColor(difficulty: ExpeditionDifficulty, colors: AppColors): string {
  if (difficulty === 'easy') return colors.success;
  if (difficulty === 'pousse') return '#38BDF8';
  if (difficulty === 'medium') return colors.warning;
  if (difficulty === 'hard') return colors.error;
  if (difficulty === 'expert') return colors.info;
  return '#FFD700'; // legendary = or
}

function difficultyLabel(difficulty: ExpeditionDifficulty): string {
  if (difficulty === 'easy') return 'Facile';
  if (difficulty === 'pousse') return 'Novice';
  if (difficulty === 'medium') return 'Moyen';
  if (difficulty === 'hard') return 'Dur';
  if (difficulty === 'expert') return 'Expert';
  return 'Légendaire';
}

function outcomeLabel(outcome: ExpeditionOutcome): string {
  if (outcome === 'success') return 'Expédition réussie !';
  if (outcome === 'partial') return 'Retour partiel';
  if (outcome === 'failure') return 'Expédition échouée';
  return 'Découverte rare !';
}

function outcomeColor(outcome: ExpeditionOutcome, colors: AppColors): string {
  if (outcome === 'success') return colors.success;
  if (outcome === 'partial') return colors.warning;
  if (outcome === 'failure') return colors.error;
  return Farm.gold;
}

function formatRemaining(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getMinutesUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 60_000);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  dailyPool: ExpeditionMission[];
  activeExpeditions: ActiveExpedition[];
  completedExpeditions: ActiveExpedition[];
  pendingResults: ActiveExpedition[];
  canLaunch: boolean;
  pityCount: number;
  harvestInventory: HarvestInventory;
  onLaunch: (mission: ExpeditionMission) => Promise<boolean>;
  onCollect: (missionId: string) => void;
  onDismiss: (missionId: string) => void;
}

// ── Composant principal ───────────────────────────────────────────────────────

export function ExpeditionsSheet({
  visible,
  onClose,
  dailyPool,
  activeExpeditions,
  completedExpeditions,
  pendingResults,
  canLaunch,
  pityCount,
  harvestInventory,
  onLaunch,
  onCollect,
  onDismiss,
}: Props) {
  const { primary, colors } = useThemeColors();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('catalogue');
  const [launchingMission, setLaunchingMission] = useState<ExpeditionMission | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<ExpeditionMission | null>(null);

  // Countdown ticker — recalculer toutes les 60s
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [visible]);

  // Animation indicateur de tab
  const tabIndicatorX = useSharedValue(0);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicatorX.value }],
  }));

  const handleTabPress = (tab: TabId, index: number) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
    tabIndicatorX.value = withTiming(index * TAB_WIDTH, { duration: 150 });
  };

  // Demande de lancement → ouvre le modal de confirmation Farm-styled
  const handleLaunchMission = async (mission: ExpeditionMission): Promise<boolean> => {
    setPendingConfirm(mission);
    return false; // on laisse le modal gérer la suite
  };

  // Confirmé par l'utilisateur → exécute réellement le lancement
  const handleConfirmLaunch = async () => {
    const mission = pendingConfirm;
    if (!mission) return;
    setPendingConfirm(null);
    const ok = await onLaunch(mission);
    if (ok) {
      setLaunchingMission(mission);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setActiveTab('encours');
        tabIndicatorX.value = withTiming(1 * TAB_WIDTH, { duration: 180 });
      }, 500);
      setTimeout(() => setLaunchingMission(null), 900);
    }
  };

  // Expedition actives sans résultat (en route)
  const inProgressExpeditions = activeExpeditions.filter(e => e.result === undefined && !isExpeditionComplete(e));
  // Expeditions terminées mais pas encore collectées
  const readyToCollect = activeExpeditions.filter(e => e.result === undefined && isExpeditionComplete(e));
  // Toutes les actives sans résultat (en route + prêtes)
  const allActive = activeExpeditions.filter(e => e.result === undefined);
  // Résultats triés du plus récent au plus ancien
  const sortedResults = [...completedExpeditions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* En-tête parchemin */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="compass-outline" size={22} color={Farm.brownText} />
            <Text style={styles.title}>Expéditions</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={24} color={Farm.brownText} />
          </TouchableOpacity>
        </View>

        {/* Bande auvent */}
        <AwningStripes />

        {/* Tab row */}
        <View style={styles.tabRow}>
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => handleTabPress(tab.id, index)}
              style={[styles.tab, { width: TAB_WIDTH }]}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.id ? primary : colors.textMuted },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Indicateur animé */}
          <Animated.View
            style={[
              styles.tabIndicator,
              { backgroundColor: primary, width: TAB_WIDTH },
              indicatorStyle,
            ]}
          />
        </View>

        {/* Contenu onglet */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Dev-only : bouton test du flux de lancement */}
          {__DEV__ && activeTab === 'catalogue' && dailyPool.length > 0 && (
            <TouchableOpacity
              onPress={() => setPendingConfirm(dailyPool[0])}
              activeOpacity={0.8}
              style={styles.devTestBtn}
            >
              <Text style={styles.devTestBtnText}>
                🧪 Tester le flux de lancement
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Onglet Catalogue ── */}
          {activeTab === 'catalogue' && (
            <>
              {/* Compteur renouvellement quotidien */}
              <View style={[styles.resetBanner, { backgroundColor: Farm.parchmentDark, borderColor: Farm.woodHighlight }]}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={Farm.brownText} />
                <Text style={[styles.resetBannerText, { color: Farm.brownText }]}>
                  {`Nouvelles expéditions dans `}
                  <Text style={styles.resetBannerTime}>
                    {formatRemaining(getMinutesUntilMidnight())}
                  </Text>
                </Text>
              </View>
              {pityCount >= 4 && (
                <Text style={[styles.pityNote, { color: colors.info }]}>
                  {'Ta prochaine expédition est protégée ✨'}
                </Text>
              )}
              {dailyPool.length === 0 ? (
                <Text style={[styles.emptyState, { color: colors.textMuted }]}>
                  {'Le catalogue se recharge à minuit.'}
                </Text>
              ) : (
                dailyPool.map((mission) => (
                  <ExpeditionCard
                    key={mission.id}
                    mission={mission}
                    canLaunch={canLaunch}
                    onLaunch={() => handleLaunchMission(mission)}
                    colors={colors}
                    primary={primary}
                    harvestInventory={harvestInventory}
                    t={t}
                  />
                ))
              )}
            </>
          )}

          {/* ── Onglet En cours ── */}
          {activeTab === 'encours' && (
            <>
              {allActive.length === 0 ? (
                <Text style={[styles.emptyState, { color: colors.textMuted }]}>
                  {"Aucune expédition en cours. Lance une mission depuis le catalogue !"}
                </Text>
              ) : (
                allActive.map((exp) => (
                  <ActiveExpeditionRow
                    key={exp.missionId}
                    expedition={exp}
                    mission={EXPEDITION_CATALOG.find(m => m.id === exp.missionId)}
                    onCollect={() => onCollect(exp.missionId)}
                    colors={colors}
                    primary={primary}
                    tick={tick}
                  />
                ))
              )}
            </>
          )}

          {/* ── Onglet Résultats ── */}
          {activeTab === 'resultats' && (
            <>
              {sortedResults.length === 0 ? (
                <Text style={[styles.emptyState, { color: colors.textMuted }]}>
                  {'Tes résultats d\'expéditions apparaîtront ici.'}
                </Text>
              ) : (
                sortedResults.map((exp) => (
                  <ResultRow
                    key={exp.missionId + exp.startedAt}
                    expedition={exp}
                    mission={EXPEDITION_CATALOG.find(m => m.id === exp.missionId)}
                    onDismiss={() => onDismiss(exp.missionId)}
                    colors={colors}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>

        {/* Overlay animation de lancement */}
        {launchingMission && (
          <LaunchAnimationOverlay mission={launchingMission} />
        )}

        {/* Modal confirmation Farm-style */}
        {pendingConfirm && (
          <ConfirmLaunchModal
            mission={pendingConfirm}
            onCancel={() => setPendingConfirm(null)}
            onConfirm={handleConfirmLaunch}
            primary={primary}
            colors={colors}
            t={t}
          />
        )}
      </View>
    </Modal>
  );
}

// ── ConfirmLaunchModal ────────────────────────────────────────────────────────

function ConfirmLaunchModal({ mission, onCancel, onConfirm, primary, colors, t }: {
  mission: ExpeditionMission;
  onCancel: () => void;
  onConfirm: () => void;
  primary: string;
  colors: AppColors;
  t: (key: string) => string;
}) {
  const cardScale = useSharedValue(0.85);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 14, stiffness: 200 });
    backdropOpacity.value = withTiming(1, { duration: 180 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const diffColor = difficultyColor(mission.difficulty, colors);
  const failurePct = Math.round(EXPEDITION_DROP_RATES[mission.difficulty].failure * 100);

  return (
    <Animated.View style={[styles.confirmBackdrop, backdropStyle]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onCancel}
      />
      <Animated.View style={[styles.confirmCard, cardStyle]}>
        {/* Auvent décoratif */}
        <AwningStripes />

        <View style={styles.confirmBody}>
          <Text style={styles.confirmEmoji}>{mission.emoji}</Text>
          <Text style={styles.confirmTitle}>Confirmer l'expédition ?</Text>
          <Text style={[styles.confirmMissionName, { color: colors.text }]} numberOfLines={1}>
            {mission.name}
          </Text>

          {/* Badge difficulté */}
          <View style={[styles.diffBadge, styles.confirmDiffBadge, { backgroundColor: diffColor + '22', borderColor: diffColor }]}>
            <Text style={[styles.diffBadgeText, { color: diffColor }]}>
              {difficultyLabel(mission.difficulty)} · {mission.durationHours}h
            </Text>
          </View>

          {/* Mise */}
          <View style={styles.confirmCostRow}>
            <View style={[styles.chip, { backgroundColor: Farm.parchmentDark }]}>
              <Text style={[styles.chipText, { color: Farm.goldText }]}>
                {`${mission.costCoins} 🍃`}
              </Text>
            </View>
            {mission.costCrops.map(cost => {
              const cropDef = CROP_CATALOG.find(c => c.id === cost.cropId);
              const emoji = cropDef?.emoji ?? '🌿';
              const name = cropDef ? t(cropDef.labelKey) : cost.cropId;
              return (
                <View key={cost.cropId} style={[styles.costChip, { backgroundColor: colors.catJeux + '22' }]}>
                  <Text style={styles.costChipEmoji}>{emoji}</Text>
                  <Text style={[styles.costChipName, { color: colors.catJeux }]}>{name}</Text>
                  <Text style={[styles.costChipQty, { color: colors.catJeux }]}>×{cost.quantity}</Text>
                </View>
              );
            })}
          </View>

          {/* Avertissement risques */}
          <View style={styles.confirmRiskBox}>
            <Text style={[styles.confirmRiskLine, { color: colors.warning }]}>
              {`⚠️  Retour partiel : 50 % récupéré, sans butin`}
            </Text>
            <Text style={[styles.confirmRiskLine, { color: colors.error }]}>
              {`💀  ${failurePct}% d'échec : toute la mise perdue`}
            </Text>
          </View>

          {/* Boutons */}
          <View style={styles.confirmBtnRow}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.confirmCancelBtn, { borderColor: colors.borderLight }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.confirmCancelText, { color: colors.textMuted }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.confirmLaunchBtn, { backgroundColor: primary }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.confirmLaunchText, { color: colors.onPrimary }]}>Lancer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ── LaunchAnimationOverlay ────────────────────────────────────────────────────

function LaunchAnimationOverlay({ mission }: { mission: ExpeditionMission }) {
  const emojiScale = useSharedValue(0);
  const emojiTranslateY = useSharedValue(0);
  const emojiRotate = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const sparkle1 = useSharedValue(0);
  const sparkle2 = useSharedValue(0);
  const sparkle3 = useSharedValue(0);

  useEffect(() => {
    // Phase 1 : emoji pop (0-250ms)
    emojiScale.value = withSequence(
      withTiming(1.15, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 110, easing: Easing.inOut(Easing.cubic) }),
    );
    emojiRotate.value = withSequence(
      withTiming(-6, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 160, easing: Easing.inOut(Easing.cubic) }),
    );
    // Ring d'expansion (0-450ms)
    ringScale.value = withTiming(2.4, { duration: 450, easing: Easing.out(Easing.cubic) });
    ringOpacity.value = withSequence(
      withTiming(0.8, { duration: 80 }),
      withTiming(0, { duration: 370, easing: Easing.out(Easing.cubic) }),
    );
    // Sparkles en cascade courte
    sparkle1.value = withDelay(80, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    sparkle2.value = withDelay(140, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    sparkle3.value = withDelay(200, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
    // Phase 2 : glisse vers le haut (450-850ms) — direction "en cours"
    emojiTranslateY.value = withDelay(
      450,
      withTiming(-140, { duration: 380, easing: Easing.in(Easing.cubic) }),
    );
    emojiScale.value = withDelay(
      450,
      withTiming(0.6, { duration: 380, easing: Easing.in(Easing.cubic) }),
    );
  }, []);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: emojiTranslateY.value },
      { scale: emojiScale.value },
      { rotate: `${emojiRotate.value}deg` },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const sparkleStyle1 = useAnimatedStyle(() => ({
    opacity: 1 - sparkle1.value,
    transform: [
      { translateX: sparkle1.value * -80 },
      { translateY: sparkle1.value * -60 },
      { scale: 0.6 + sparkle1.value * 0.8 },
    ],
  }));
  const sparkleStyle2 = useAnimatedStyle(() => ({
    opacity: 1 - sparkle2.value,
    transform: [
      { translateX: sparkle2.value * 90 },
      { translateY: sparkle2.value * -70 },
      { scale: 0.6 + sparkle2.value * 0.8 },
    ],
  }));
  const sparkleStyle3 = useAnimatedStyle(() => ({
    opacity: 1 - sparkle3.value,
    transform: [
      { translateX: sparkle3.value * -70 },
      { translateY: sparkle3.value * 80 },
      { scale: 0.6 + sparkle3.value * 0.8 },
    ],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(250)}
      pointerEvents="none"
      style={styles.launchOverlay}
    >
      <View style={styles.launchCenter}>
        <Animated.View style={[styles.launchRing, ringStyle]} />
        <Animated.Text style={[styles.launchEmoji, emojiStyle]}>{mission.emoji}</Animated.Text>
        <Animated.Text style={[styles.launchSparkle, sparkleStyle1]}>✨</Animated.Text>
        <Animated.Text style={[styles.launchSparkle, sparkleStyle2]}>✦</Animated.Text>
        <Animated.Text style={[styles.launchSparkle, sparkleStyle3]}>⭐</Animated.Text>
      </View>
      <Animated.View entering={FadeIn.delay(200).duration(300)}>
        <Text style={styles.launchTitle}>Expédition partie !</Text>
        <Text style={styles.launchSubtitle} numberOfLines={1}>{mission.name}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── ExpeditionCard ────────────────────────────────────────────────────────────

interface CardProps {
  mission: ExpeditionMission;
  canLaunch: boolean;
  onLaunch: () => Promise<boolean>;
  colors: AppColors;
  primary: string;
  harvestInventory: HarvestInventory;
  t: (key: string) => string;
}

const ExpeditionCard = React.memo(function ExpeditionCard({
  mission, canLaunch, onLaunch, colors, primary, harvestInventory, t,
}: CardProps) {
  const cardScale = useSharedValue(1);
  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handlePress = () => {
    if (!canLaunch) return;
    cardScale.value = withSpring(0.97, SPRING_CATALOG, () => {
      cardScale.value = withSpring(1, SPRING_CATALOG);
    });
    onLaunch();
  };

  const diffColor = difficultyColor(mission.difficulty, colors);
  const failureRate = EXPEDITION_DROP_RATES[mission.difficulty].failure;
  const failurePct = Math.round(failureRate * 100);

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }, cardAnim]}>
      {/* Row principale : emoji + info + badge difficulté */}
      <View style={styles.cardRow}>
        <Text style={styles.missionEmoji}>{mission.emoji}</Text>
        <View style={styles.cardInfo}>
          <Text style={[styles.missionName, { color: colors.text }]} numberOfLines={1}>
            {mission.name}
          </Text>
          <Text style={[styles.missionDuration, { color: colors.textMuted }]}>
            {`${mission.durationHours}h · ${mission.description.slice(0, 50)}...`}
          </Text>
        </View>
        <View style={styles.diffColumn}>
          <View style={[styles.diffBadge, { backgroundColor: diffColor + '22', borderColor: diffColor }]}>
            <Text style={[styles.diffBadgeText, { color: diffColor }]}>
              {difficultyLabel(mission.difficulty)}
            </Text>
          </View>
          <Text style={[styles.failureRate, { color: colors.error }]}>
            {`${failurePct}% d'échec`}
          </Text>
        </View>
      </View>

      {/* Row coûts */}
      <View style={styles.costRow}>
        <View style={[styles.chip, { backgroundColor: Farm.parchmentDark }]}>
          <Text style={[styles.chipText, { color: Farm.goldText }]}>
            {`${mission.costCoins} 🍃`}
          </Text>
        </View>
        {mission.costCrops.map((cost) => {
          const cropDef = CROP_CATALOG.find(c => c.id === cost.cropId);
          const cropEmoji = cropDef?.emoji ?? '🌿';
          const cropName = cropDef ? t(cropDef.labelKey) : cost.cropId;
          const have = countItemTotal(harvestInventory, cost.cropId);
          const enough = have >= cost.quantity;
          return (
            <View
              key={cost.cropId}
              style={[
                styles.costChip,
                { backgroundColor: enough ? colors.catJeux + '22' : colors.error + '18' },
              ]}
            >
              <Text style={styles.costChipEmoji}>{cropEmoji}</Text>
              <Text style={[styles.costChipName, { color: enough ? colors.catJeux : colors.error }]}>
                {cropName}
              </Text>
              <Text style={[styles.costChipQty, { color: enough ? colors.success : colors.error }]}>
                {`${have}/${cost.quantity}`}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Gains possibles */}
      <View style={styles.lootRow}>
        <Text style={[styles.lootLabel, { color: colors.textMuted }]}>1 gain au sort parmi :</Text>
        <View style={styles.lootChips}>
          {EXPEDITION_LOOT_TABLE[mission.difficulty].map((item) => (
            <View key={item.itemId} style={[styles.lootChip, { backgroundColor: colors.catJeux + '18', borderColor: colors.catJeux + '44' }]}>
              <Text style={styles.lootChipEmoji}>{item.emoji}</Text>
              <Text style={[styles.lootChipText, { color: colors.catJeux }]} numberOfLines={1}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bouton lancer */}
      <TouchableOpacity
        onPress={handlePress}
        disabled={!canLaunch}
        style={[
          styles.launchBtn,
          canLaunch
            ? { backgroundColor: primary }
            : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderLight, opacity: 0.5 },
        ]}
        activeOpacity={0.8}
      >
        <Text style={[styles.launchBtnText, { color: canLaunch ? colors.onPrimary : colors.textMuted }]}>
          {canLaunch ? "Lancer l'expédition" : 'Complet'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── ActiveExpeditionRow ───────────────────────────────────────────────────────

interface ActiveRowProps {
  expedition: ActiveExpedition;
  mission: ExpeditionMission | undefined;
  onCollect: () => void;
  colors: AppColors;
  primary: string;
  tick: number;
}

const ActiveExpeditionRow = React.memo(function ActiveExpeditionRow({
  expedition, mission, onCollect, colors, primary, tick: _tick,
}: ActiveRowProps) {
  const remaining = getExpeditionRemainingMinutes(expedition);
  const isReady = remaining === 0;
  const isNearEnd = remaining > 0 && remaining < 30;
  const diffColor = difficultyColor(expedition.difficulty, colors);

  return (
    <View style={[styles.activeRow, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
      <Text style={styles.rowEmoji}>{mission?.emoji ?? '🗺️'}</Text>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {mission?.name ?? expedition.missionId}
        </Text>
        <View style={styles.rowMeta}>
          <View style={[styles.diffBadgeSmall, { backgroundColor: diffColor + '22', borderColor: diffColor }]}>
            <Text style={[styles.diffBadgeSmallText, { color: diffColor }]}>
              {difficultyLabel(expedition.difficulty)}
            </Text>
          </View>
          {isReady ? (
            <Text style={[styles.rowStatus, { color: colors.success }]}>
              {'Mission terminée !'}
            </Text>
          ) : (
            <Text style={[styles.rowCountdown, { color: isNearEnd ? colors.warning : colors.info }]}>
              {`En route · ${formatRemaining(remaining)} restant`}
            </Text>
          )}
        </View>
      </View>
      {isReady && (
        <TouchableOpacity
          onPress={onCollect}
          style={[styles.collectBtn, { backgroundColor: primary }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.collectBtnText, { color: colors.onPrimary }]}>{'Collecter'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ── ResultRow ─────────────────────────────────────────────────────────────────

interface ResultRowProps {
  expedition: ActiveExpedition;
  mission: ExpeditionMission | undefined;
  onDismiss: () => void;
  colors: AppColors;
}

const ResultRow = React.memo(function ResultRow({
  expedition, mission, onDismiss, colors,
}: ResultRowProps) {
  const outcome = expedition.result!;
  const outColor = outcomeColor(outcome, colors);

  // Résoudre le loot lisible depuis l'itemId stocké
  const lootDisplay = expedition.lootItemId
    ? getLootDisplay(expedition.lootItemId)
    : null;

  return (
    <View style={[styles.resultRow, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
      <Text style={styles.rowEmoji}>{mission?.emoji ?? '🗺️'}</Text>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {mission?.name ?? expedition.missionId}
        </Text>
        <View style={[styles.outcomeBadge, { backgroundColor: outColor + '22', borderColor: outColor }]}>
          <Text style={[styles.outcomeBadgeText, { color: outColor }]}>
            {outcomeLabel(outcome)}
          </Text>
        </View>
        {/* Loot lisible : emoji + label */}
        {lootDisplay && (
          <View style={[styles.resultLootChip, { backgroundColor: colors.catJeux + '22' }]}>
            <Text style={styles.resultLootChipEmoji}>{lootDisplay.emoji}</Text>
            <Text style={[styles.lootChipLabel, { color: colors.catJeux }]}>
              {lootDisplay.label}
            </Text>
          </View>
        )}
        {/* Message explicite perte pour failure */}
        {outcome === 'failure' && (
          <Text style={[styles.lootLossLabel, { color: colors.error }]}>
            {'Mise perdue'}
          </Text>
        )}
        {/* Message explicite pour partial */}
        {outcome === 'partial' && (
          <Text style={[styles.lootLossLabel, { color: colors.warning }]}>
            {'Retour partiel — pas de butin'}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        style={styles.dismissBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.dismissText, { color: colors.textMuted }]}>{'Supprimer'}</Text>
      </TouchableOpacity>
    </View>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Farm.parchment,
  },
  // ── Launch overlay ──
  launchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 20, 10, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  launchCenter: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  launchRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Farm.goldText,
  },
  launchEmoji: {
    fontSize: 72,
    textAlign: 'center',
  },
  launchSparkle: {
    position: 'absolute',
    fontSize: 26,
    color: Farm.goldText,
  },
  launchTitle: {
    marginTop: Spacing.xl,
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  launchSubtitle: {
    marginTop: Spacing.xs,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
    color: Farm.goldText,
    textAlign: 'center',
  },
  // ── Confirm modal ──
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 20, 10, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 80,
    paddingHorizontal: Spacing['2xl'],
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Farm.parchment,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  confirmBody: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  confirmEmoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  confirmTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
    textAlign: 'center',
  },
  confirmMissionName: {
    marginTop: Spacing.xs,
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  confirmDiffBadge: {
    marginTop: Spacing.md,
    alignSelf: 'center',
  },
  confirmCostRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  confirmRiskBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    width: '100%',
    gap: Spacing.xs,
  },
  confirmRiskLine: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  confirmCancelText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  confirmLaunchBtn: {
    flex: 1.4,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  confirmLaunchText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  // ── Dev test ──
  devTestBtn: {
    marginHorizontal: Spacing['2xl'],
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    alignItems: 'center',
  },
  devTestBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    backgroundColor: Farm.parchmentDark,
    borderBottomWidth: 2,
    borderBottomColor: Farm.woodHighlight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  // ── Auvent ──────────────────────────────────────
  awning: {
    height: 36,
    overflow: 'hidden',
  },
  awningStripes: {
    flexDirection: 'row',
    height: 28,
  },
  awningStripe: {
    flex: 1,
  },
  awningShadow: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  awningScallop: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
  },
  awningScallopDot: {
    flex: 1,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  // ── Tabs ─────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Farm.parchmentDark,
    position: 'relative',
    paddingBottom: 2,
  },
  tab: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: Radius.full,
  },
  // ── Scroll ───────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
    gap: Spacing['2xl'],
  },
  // ── Reset banner ──────────────────────────────────
  resetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  resetBannerText: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
  },
  resetBannerTime: {
    fontWeight: FontWeight.bold,
    fontStyle: 'normal',
  },
  // ── Pity note ─────────────────────────────────────
  pityNote: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  // ── Empty state ───────────────────────────────────
  emptyState: {
    fontSize: FontSize.body,
    textAlign: 'center',
    marginTop: Spacing['4xl'],
    lineHeight: 22,
  },
  // ── ExpeditionCard ────────────────────────────────
  card: {
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  missionEmoji: {
    fontSize: FontSize.icon,
  },
  cardInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  missionName: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
  },
  missionDuration: {
    fontSize: FontSize.label,
    lineHeight: 18,
  },
  diffColumn: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  failureRate: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  diffBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  diffBadgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  costRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
  },
  chipText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  // Coût récolte avec indicateur stock
  costChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    gap: Spacing.xs,
  },
  costChipEmoji: {
    fontSize: FontSize.label,
  },
  costChipName: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  costChipQty: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  lootRow: {
    gap: Spacing.xs,
  },
  lootLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  lootChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  lootChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: Spacing.xs,
  },
  lootChipEmoji: {
    fontSize: FontSize.label,
  },
  lootChipText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    maxWidth: 110,
  },
  launchBtn: {
    height: 44,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  launchBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // ── ActiveExpeditionRow ───────────────────────────
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  rowEmoji: {
    fontSize: FontSize.icon,
  },
  rowInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  rowName: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  diffBadgeSmall: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  diffBadgeSmallText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  rowStatus: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  rowCountdown: {
    fontSize: FontSize.label,
  },
  collectBtn: {
    height: 44,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // ── ResultRow ─────────────────────────────────────
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  outcomeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  outcomeBadgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  resultLootLabel: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xs,
  },
  // Loot lisible dans ResultRow
  resultLootChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  resultLootChipEmoji: {
    fontSize: FontSize.label,
  },
  lootChipLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  // Message perte explicite
  lootLossLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.xs,
  },
  dismissBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  dismissText: {
    fontSize: FontSize.caption,
  },
});
