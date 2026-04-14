/**
 * ExpeditionsSheet.tsx — Modal pageSheet catalogue d'expéditions
 * Phase 33 — Système d'expéditions à risque
 *
 * 3 onglets : Catalogue / En cours / Résultats
 * Calqué sur BuildingsCatalog.tsx (AwningStripes, SPRING_CATALOG, tab pattern)
 */

import React, { useEffect, useState } from 'react';
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
  type ExpeditionMission,
} from '../../lib/mascot/expedition-engine';
import { CROP_CATALOG, type HarvestInventory } from '../../lib/mascot/types';
import type { ActiveExpedition, ExpeditionOutcome } from '../../lib/types';

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

function difficultyColor(difficulty: 'easy' | 'medium' | 'hard', colors: any): string {
  if (difficulty === 'easy') return colors.success;
  if (difficulty === 'medium') return colors.warning;
  return colors.error;
}

function difficultyLabel(difficulty: 'easy' | 'medium' | 'hard'): string {
  if (difficulty === 'easy') return 'Facile';
  if (difficulty === 'medium') return 'Moyen';
  return 'Dur';
}

function outcomeLabel(outcome: ExpeditionOutcome): string {
  if (outcome === 'success') return 'Expédition réussie !';
  if (outcome === 'partial') return 'Retour partiel';
  if (outcome === 'failure') return 'Expédition échouée';
  return 'Découverte rare !';
}

function outcomeColor(outcome: ExpeditionOutcome, colors: any): string {
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
  onLaunch: (mission: ExpeditionMission) => void;
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
        >
          {/* ── Onglet Catalogue ── */}
          {activeTab === 'catalogue' && (
            <>
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
                    onLaunch={() => onLaunch(mission)}
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
                    mission={dailyPool.find(m => m.id === exp.missionId)}
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
                    mission={dailyPool.find(m => m.id === exp.missionId)}
                    onDismiss={() => onDismiss(exp.missionId)}
                    colors={colors}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── ExpeditionCard ────────────────────────────────────────────────────────────

interface CardProps {
  mission: ExpeditionMission;
  canLaunch: boolean;
  onLaunch: () => void;
  colors: any;
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
        <View style={[styles.diffBadge, { backgroundColor: diffColor + '22', borderColor: diffColor }]}>
          <Text style={[styles.diffBadgeText, { color: diffColor }]}>
            {difficultyLabel(mission.difficulty)}
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
          const have = harvestInventory[cost.cropId] ?? 0;
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
        <Text style={[styles.launchBtnText, { color: canLaunch ? '#FFFFFF' : colors.textMuted }]}>
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
  colors: any;
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
          <Text style={styles.collectBtnText}>{'Collecter'}</Text>
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
  colors: any;
}

const ResultRow = React.memo(function ResultRow({
  expedition, mission, onDismiss, colors,
}: ResultRowProps) {
  const outcome = expedition.result!;
  const outColor = outcomeColor(outcome, colors);

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
        {expedition.lootItemId && (
          <Text style={[styles.lootLabel, { color: colors.textMuted }]}>
            {`Loot : ${expedition.lootItemId}`}
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
  diffBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
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
  launchBtn: {
    height: 44,
    borderRadius: Radius.md,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
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
    borderWidth: 1,
  },
  outcomeBadgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  lootLabel: {
    fontSize: FontSize.caption,
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
