/**
 * tree.tsx — Écran dédié arbre mascotte
 *
 * Affiche l'arbre du profil sélectionné en plein écran avec :
 * - Arbre animé grande taille
 * - Barre de progression XP vers prochaine évolution
 * - Infos espèce + stade
 * - Sélecteur d'espèce (si première fois ou via bouton)
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
  Image,
  ImageSourcePropType,
  Alert,
  AppState,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { hapticsTreeTap, hapticsSpeciesChange } from '../../lib/mascot/haptics';
import { EFFECT_TOASTS, CATEGORY_VARIANT, CATEGORY_HAPTIC_FN } from '../../lib/semantic/effect-toasts';
import type { CategoryId } from '../../lib/semantic/categories';

import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAI } from '../../contexts/AIContext';
import { useHelp } from '../../contexts/HelpContext';
import { callCompanionMessage } from '../../lib/ai-service';
import { TreeView } from '../../components/mascot/TreeView';
import { SpeciesPicker } from '../../components/mascot/SpeciesPicker';
import { TreeShop } from '../../components/mascot/TreeShop';
import { WorldGridView } from '../../components/mascot/WorldGridView';
import { NativePlacedItems } from '../../components/mascot/NativePlacedItems';
import { NativePlacementSlots } from '../../components/mascot/NativePlacementSlots';
import { TileMapRenderer, GRASS_TILE_IMAGE } from '../../components/mascot/TileMapRenderer';
import { BuildingShopSheet } from '../../components/mascot/BuildingShopSheet';
import { CraftSheet } from '../../components/mascot/CraftSheet';
import { FarmCodexModal } from '../../components/mascot/FarmCodexModal';
import { MuseumModal } from '../../components/mascot/MuseumModal';
import { FarmTutorialOverlay } from '../../components/mascot/FarmTutorialOverlay';
import { GiftSenderSheet } from '../../components/mascot/GiftSenderSheet';
import { GiftReceiptModal } from '../../components/mascot/GiftReceiptModal';
import { TechTreeSheet } from '../../components/mascot/TechTreeSheet';
import { PlotUpgradeSheet } from '../../components/mascot/PlotUpgradeSheet';
import { BuildingDetailSheet } from '../../components/mascot/BuildingDetailSheet';
import { WeeklyGoal, countWeeklyTasks } from '../../components/mascot/WeeklyGoal';
import { FamilyQuestBanner } from '../../components/mascot/FamilyQuestBanner';
import { FamilyQuestDetailSheet } from '../../components/mascot/FamilyQuestDetailSheet';
import { FamilyQuestPickerSheet } from '../../components/mascot/FamilyQuestPickerSheet';
import * as Haptics from 'expo-haptics';
import { useFarm } from '../../hooks/useFarm';
import { useGarden } from '../../hooks/useGarden';
import { SunriseReport, type SunriseResource } from '../../components/mascot/SunriseReport';
import { BadgesSheet } from '../../components/mascot/BadgesSheet';
import { CompanionPicker } from '../../components/mascot/CompanionPicker';
import { CompanionSlot } from '../../components/mascot/CompanionSlot';
import { PortalSprite } from '../../components/village/PortalSprite';
import { buildAnonymizationMap, anonymize, deanonymize } from '../../lib/anonymizer';
import { getPendingResources } from '../../lib/mascot/building-engine';
import {
  COMPANION_UNLOCK_LEVEL,
  type CompanionData,
  type CompanionSpecies,
  type CompanionEvent,
} from '../../lib/mascot/companion-types';
import {
  getCompanionStage,
  getCompanionMood,
  pickCompanionMessage,
  generateCompanionAIMessage,
  detectProactiveEvent,
  computeMoodScore,
} from '../../lib/mascot/companion-engine';
import { loadCompanionMessages, saveCompanionMessages, hasNudgeShownToday, markNudgeShownToday, type PersistedCompanionMessage } from '../../lib/mascot/companion-storage';
import * as SecureStore from 'expo-secure-store';
import { type PlantedCrop, type PlacedBuilding, CROP_CATALOG, BUILDING_CATALOG } from '../../lib/mascot/types';
import type { GiftEntry } from '../../lib/mascot/gift-engine';
import { hasCropSeasonalBonus, parseCrops, getAvailableCrops, RARE_SEED_DROP_RULES, PLOT_LEVEL_BONUSES, getPlotLevel, getMainPlotIndex } from '../../lib/mascot/farm-engine';
import { CROP_ICONS } from '../../lib/mascot/crop-sprites';
import { getUnlockedCropCells, getExpandedCropCells, BUILDING_CELLS, EXPANSION_BUILDING_CELL, CAMP_EXPLORATION_CELL } from '../../lib/mascot/world-grid';
import { useExpeditions } from '../../hooks/useExpeditions';
import { ExpeditionsSheet } from '../../components/mascot/ExpeditionsSheet';
import { CampExplorationCell } from '../../components/mascot/CampExplorationCell';
import { ExpeditionChest } from '../../components/mascot/ExpeditionChest';
import { isExpeditionComplete, getExpeditionRemainingMinutes } from '../../lib/mascot/expedition-engine';
import type { ExpeditionOutcome } from '../../lib/types';
import type { ExpeditionLoot } from '../../lib/mascot/expedition-engine';
import { getTechBonuses, type TechBonuses } from '../../lib/mascot/tech-engine';
import { HarvestEventOverlay, SeedDropOverlay } from '../../components/mascot/HarvestEventOverlay';
import type { HarvestEvent, RareSeedDrop } from '../../lib/mascot/farm-engine';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { WagerSealerSheet } from '../../components/mascot/WagerSealerSheet';
import { canSealWager } from '../../lib/mascot/wager-engine';
import { getLocalDateKey } from '../../lib/mascot/sporee-economy';
import type { WagerDuration } from '../../lib/mascot/types';
import { AmbientParticles } from '../../components/mascot/AmbientParticles';
import { SeasonalParticles } from '../../components/mascot/SeasonalParticles';
import { calculateLevel, xpForLevel, pointsToNextLevel, getLevelTier } from '../../lib/gamification';
import {
  getTreeStage,
  getTreeStageInfo,
  getNextEvolutionLevel,
  levelsUntilEvolution,
  getStageProgress,
  getStageIndex,
  TREE_STAGES,
} from '../../lib/mascot';
import { SPECIES_INFO, ALL_SPECIES, DECORATIONS, INHABITANTS, ITEM_ILLUSTRATIONS, type TreeSpecies, type TreeStage } from '../../lib/mascot/types';
import { getCurrentSeason, SEASON_INFO, GROUND_COLORS, type Season } from '../../lib/mascot/seasons';
import { createEmptySagaProgress, type SagaProgress, type SagaTrait } from '../../lib/mascot/sagas-types';
import { getSagaById, getSagaCompletionResult, getNextSagaForProfile } from '../../lib/mascot/sagas-engine';
import { loadSagaProgress, saveSagaProgress, saveLastSagaCompletion, clearSagaProgress } from '../../lib/mascot/sagas-storage';
import { formatDateStr } from '../../lib/mascot/utils';
import type { SeasonalEventProgress } from '../../lib/mascot/seasonal-events-types';
import { getVisibleEventId, buildSeasonalEventAsSaga, drawGuaranteedSeasonalReward, SEASONAL_EVENT_BONUS_XP } from '../../lib/mascot/seasonal-events-engine';
import { loadEventProgressList, saveEventProgress } from '../../lib/mascot/seasonal-events-storage';
import { getEventContent } from '../../lib/mascot/seasonal-events-content';
import { getActiveEvent } from '../../lib/gamification/seasonal';
import { SagaWorldEvent } from '../../components/mascot/SagaWorldEvent';
import { VisitorSlot } from '../../components/mascot/VisitorSlot';
import type { ReactionType } from '../../components/mascot/VisitorSlot';
import type { Profile } from '../../lib/types';
import { Spacing, Radius, Layout } from '../../constants/spacing';

import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

// Terrain tileset images (pré-rendues par saison)
const TERRAIN_IMAGES: Record<Season, any> = {
  printemps: require('../../assets/terrain/ground_printemps.png'),
  ete: require('../../assets/terrain/ground_ete.png'),
  automne: require('../../assets/terrain/ground_automne.png'),
  hiver: require('../../assets/terrain/ground_hiver.png'),
};

// Sprites des actions cozy (variante C — panneau de ferme)
const ACTION_SPRITES = {
  echoppe:  require('../../assets/ui/actions/echoppe.png'),
  atelier:  require('../../assets/ui/actions/atelier.png'),
  savoirs:  require('../../assets/ui/actions/savoirs.png'),
  embellir: require('../../assets/ui/actions/embellir.png'),
  trophees: require('../../assets/ui/actions/trophees.png'),
  galerie:  require('../../assets/ui/actions/galerie.png'),
} as const;

// SCREEN_W, SCREEN_H, TREE_SIZE, TERRAIN_HEIGHT, DIORAMA_HEIGHT_BY_STAGE
// sont calculés dans les composants via useWindowDimensions()

const SEASON_ILLUSTRATIONS: Record<Season, ImageSourcePropType> = {
  printemps: require('../../assets/illustrations/tree-spring.jpg'),
  ete: require('../../assets/illustrations/tree-summer.jpg'),
  automne: require('../../assets/illustrations/tree-autumn.jpg'),
  hiver: require('../../assets/illustrations/tree-winter.jpg'),
};

const STAGE_EMOJI: Record<TreeStage, string> = {
  graine: '🌱', pousse: '🌿', arbuste: '🌿', arbre: '🌳', majestueux: '👑', legendaire: '⭐',
};

/** Cultures au genre féminin (pour accord grammatical "récoltée") */
const FEMININE_CROPS: ReadonlySet<string> = new Set([
  'carrot', 'tomato', 'strawberry', 'potato', 'pumpkin', 'beetroot',
  'orchidee', 'rose_doree', 'truffe',
]);

/** Sprite idle du visiteur saga pour le portrait dans SagaWorldEvent */
const VISITOR_IDLE_FRAMES: Record<string, number> = {
  voyageur_argent: require('../../assets/garden/animals/voyageur/idle_1.png'),
  source_cachee: require('../../assets/garden/animals/esprit_eau/idle_1.png'),
  carnaval_ombres: require('../../assets/garden/animals/masque_ombre/idle_1.png'),
  graine_anciens: require('../../assets/garden/animals/ancien_gardien/idle_1.png'),
};
const DEFAULT_VISITOR_IDLE = VISITOR_IDLE_FRAMES.voyageur_argent;

/** Couleurs de rareté pour le picker de décoration */
const PICKER_RARITY_COLORS: Record<string, string> = {
  commun: '#9CA3AF',
  rare: '#3B82F6',
  'épique': '#8B5CF6',
  'légendaire': '#F59E0B',
  prestige: '#EC4899',
};

/** Sprite idle des visiteurs saisonniers — eventId → sprite */
const SEASONAL_VISITOR_IDLE: Record<string, number> = {
  'nouvel-an': require('../../assets/garden/animals/lutin_minuit/idle_1.png'),
  'st-valentin': require('../../assets/garden/animals/cupidon/idle_1.png'),
  'poisson-avril': require('../../assets/garden/animals/poisson_magique/idle_1.png'),
  'paques': require('../../assets/garden/animals/lapin_paques/idle_1.png'),
  'ete': require('../../assets/garden/animals/crabe_voyageur/idle_1.png'),
  'rentree': require('../../assets/garden/animals/hibou/idle_1.png'),
  'halloween': require('../../assets/garden/animals/fantome_farceur/idle_1.png'),
  'noel': require('../../assets/garden/animals/voyageur/idle_1.png'),
};

/** Tooltip whisper quand on tap une culture en croissance */
/** Tooltip info quand on tap une culture en croissance — emoji + nom + tâches restantes */
function CropTooltip({ tooltipInfo, stageInfo, stageIdx, techBonuses, plotLevels, growthSprintActive, mainPlotIndex }: {
  tooltipInfo: { cellId: string; cropId: string; tasksCompleted: number; plotIndex: number };
  stageInfo: any;
  stageIdx: number;
  techBonuses?: TechBonuses;
  plotLevels?: number[];
  growthSprintActive?: boolean;
  mainPlotIndex?: number | null;
}) {
  const { colors } = useThemeColors();
  const { t } = useTranslation();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const TERRAIN_HEIGHT = SCREEN_W * 2;
  const DIORAMA_HEIGHT_BY_STAGE: Record<number, number> = {
    0: TERRAIN_HEIGHT, 1: TERRAIN_HEIGHT, 2: TERRAIN_HEIGHT,
    3: TERRAIN_HEIGHT, 4: TERRAIN_HEIGHT, 5: TERRAIN_HEIGHT,
  };
  const cells = techBonuses
    ? getExpandedCropCells(stageInfo.stage, techBonuses)
    : getUnlockedCropCells(stageInfo.stage);
  const cell = cells.find((c: any) => c.id === tooltipInfo.cellId);
  if (!cell) return null;

  const cropDef = CROP_CATALOG.find(c => c.id === tooltipInfo.cropId);
  if (!cropDef) return null;
  const cropEmoji = cropDef.emoji;
  const cropName = t(`farm.crop.${cropDef.id}`);
  // Bonus identiques à advanceFarmCrops dans farm-engine.ts:174-175
  const plotBonus = PLOT_LEVEL_BONUSES[getPlotLevel(plotLevels, tooltipInfo.plotIndex)]?.tasksPerStageReduction ?? 0;
  const sprintBonus = growthSprintActive ? 1 : 0;
  const effectiveTasksPerStage = Math.max(
    1,
    cropDef.tasksPerStage
      - (techBonuses?.tasksPerStageReduction ?? 0)
      - plotBonus
      - sprintBonus
  );
  const totalPoints = effectiveTasksPerStage * 4;
  const isSeasonal = hasCropSeasonalBonus(cropDef.id);
  const pointsRemaining = Math.max(0, totalPoints - tooltipInfo.tasksCompleted);
  // Vitesse par tâche : main plot = seasonBonus, autres plots = seasonBonus * 0.5
  const seasonBonus = isSeasonal ? 2 : 1;
  const isMainPlot = mainPlotIndex === tooltipInfo.plotIndex;
  const incrementPerTask = isMainPlot ? seasonBonus : seasonBonus * 0.5;
  const remaining = Math.ceil(pointsRemaining / incrementPerTask);

  const TOOLTIP_W = 160;
  const TOOLTIP_H = 44;
  const dioH = DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60;
  const cellPy = cell.y * dioH;
  const rawWx = cell.x * SCREEN_W - TOOLTIP_W / 2;
  // Si le tooltip au-dessus serait croppé (trop haut), l'afficher en dessous de la cellule
  const aboveY = cellPy - TOOLTIP_H - 12;
  const belowY = cellPy + 55;
  const rawWy = aboveY < 80 ? belowY : aboveY;
  const wx = Math.max(4, Math.min(rawWx, SCREEN_W - TOOLTIP_W - 4));
  const wy = rawWy;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        left: wx,
        top: wy,
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        zIndex: 20,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.onPrimary, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
        {cropEmoji} {cropName}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center', marginTop: 2 }}>
        {remaining > 0 ? t('farm.tasksRemaining', { count: remaining }) : t('farm.readyToHarvest')}
      </Text>
    </Animated.View>
  );
}

/** Banniere hint one-shot ferme — s'affiche la premiere visite, dismiss via useHelp */
function FarmHintBanner({ onDismiss }: { onDismiss: () => void }) {
  const { primary, colors } = useThemeColors();
  return (
    <Animated.View
      entering={FadeInUp.delay(800).duration(500).springify()}
      style={{
        position: 'absolute',
        bottom: Spacing.lg,
        left: Spacing.md,
        right: Spacing.md,
        zIndex: 25,
        backgroundColor: colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        ...Shadows.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
      }}
    >
      <Text style={{ fontSize: FontSize.sm, color: colors.text, marginBottom: Spacing.xs, lineHeight: FontSize.sm * 1.5 }}>
        {'🌱 Complète des tâches pour faire pousser tes cultures ! Le plot avec les points bleus avance en priorité.'}
      </Text>
      <TouchableOpacity
        onPress={onDismiss}
        activeOpacity={0.7}
        style={{
          alignSelf: 'flex-end',
          paddingVertical: Spacing.xxs,
          paddingHorizontal: Spacing.sm,
          backgroundColor: primary + '20',
          borderRadius: Radius.md,
        }}
      >
        <Text style={{ fontSize: FontSize.caption, color: primary, fontWeight: '600' }}>
          {"J'ai compris"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Phase 29 — PortalSprite extrait dans components/village/PortalSprite.tsx (CD-04)
// Le composant partagé est consommé ici (ferme → village) et dans village.tsx (village → ferme)
// avec le même sprite portail.png (symétrie visuelle per D-17).

export default function TreeScreen() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const TREE_SIZE = Math.min(SCREEN_W * 0.65, 280);
  const TERRAIN_HEIGHT = SCREEN_W * 2;
  const DIORAMA_HEIGHT_BY_STAGE: Record<number, number> = {
    0: TERRAIN_HEIGHT, 1: TERRAIN_HEIGHT, 2: TERRAIN_HEIGHT,
    3: TERRAIN_HEIGHT, 4: TERRAIN_HEIGHT, 5: TERRAIN_HEIGHT,
  };
  const { profiles, activeProfile, updateTreeSpecies, buyMascotItem, buySporee, placeMascotItem, unplaceMascotItem, gamiData, setCompanion, tasks, rdvs, meals, completeSagaChapter, familyQuests, unlockedRecipes, startFamilyQuest, completeFamilyQuest, deleteFamilyQuest, contributeFamilyQuest, vault } = useVault();
  const { showToast, showHarvestCard } = useToast();
  const { config: aiConfig } = useAI();
  const { hasSeenScreen, markScreenSeen, isLoaded: helpLoaded, activeFarmTutorialStep } = useHelp();

  // Refs cibles pour FarmTutorialOverlay (Phase 18-04)
  // Phase 18-04 fix : ancres compactes (~96×96) positionnées en absolu sur le diorama
  // au lieu de pointer sur le wrapper entier (qui faisait SCREEN_W × 60% SCREEN_H → cutout
  // géant + tooltip positionné off-screen). Cellules WorldGridView non ref-ables (RESEARCH.md Pitfall 3),
  // donc on utilise des anchors invisibles au centre-gauche (plantation) et centre-droit (harvest).
  const plantationRef = useRef<View>(null);
  const harvestRef = useRef<View>(null);
  const hudXpRef = useRef<View>(null);
  // Stabiliser l'objet targetRefs pour éviter de re-invalider measureForStep à chaque render de tree.tsx
  const farmTutorialTargetRefs = useMemo(
    () => ({ plantation: plantationRef, harvest: harvestRef, hudXp: hudXpRef }),
    []
  );
  const showFarmHint = helpLoaded && !hasSeenScreen('farm');

  // Profil affiché : celui passé en param ou le profil actif
  const profile = useMemo(() => {
    if (profileId) return profiles.find((p: Profile) => p.id === profileId) || activeProfile;
    return activeProfile;
  }, [profileId, profiles, activeProfile]);

  // Est-ce qu'on regarde son propre arbre ? (autorise les modifications)
  const isOwnTree = !profileId || profileId === activeProfile?.id;

  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false);
  const [selectedProfileForPicker, setSelectedProfileForPicker] = useState<Profile | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [placingItem, setPlacingItem] = useState<string | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);

  // Village / Portail (Phase 28 — MAP-03)
  const { addContribution, getPendingItems, unlockedBuildings } = useGarden();

  // Total items à récupérer dans le village (badge portail)
  const villagePendingCount = useMemo(
    () => unlockedBuildings.reduce((sum, b) => sum + getPendingItems(b.buildingId), 0),
    [unlockedBuildings, getPendingItems],
  );

  // Fade cross-dissolve pour la navigation portail → village
  const screenOpacity = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  // Handler de navigation portail avec fade 400ms
  const handlePortalPress = useCallback(() => {
    screenOpacity.value = withTiming(
      0,
      { duration: 400, easing: Easing.out(Easing.ease) },
      (finished) => {
        if (finished) runOnJS(router.push)('/(tabs)/village' as any);
      },
    );
  }, [screenOpacity, router]);

  // Reset opacity quand l'écran regagne le focus (retour depuis le village)
  useFocusEffect(useCallback(() => {
    screenOpacity.value = 1;
  }, [screenOpacity]));

  // Ferme
  const { plant, harvest, buyBuilding, upgradeBuildingAction, collectBuildingResources, collectPassiveIncome, craft, sellHarvest, sellCrafted, unlockTech, checkWear, repairWear, getWearEffects, getWearEvents, sendGift, receiveGifts, upgradePlotAction, startWager } = useFarm(contributeFamilyQuest, addContribution);
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  // Phase 40 Plan 02 — pageSheet secondaire sceller Sporée après choix graine
  const [showWagerSealer, setShowWagerSealer] = useState(false);
  const [pendingPlant, setPendingPlant] = useState<{
    plotIndex: number;
    cropId: string;
    tasksPerStage: number;
  } | null>(null);
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
  const [harvestEvent, setHarvestEvent] = useState<HarvestEvent | null>(null);
  const [seedDropEvent, setSeedDropEvent] = useState<RareSeedDrop | null>(null);
  // Sunrise report
  const [sunriseData, setSunriseData] = useState<{
    resources: SunriseResource[];
    totalCollected: number;
    yesterdayTasks: number;
    hasBonus: boolean;
  } | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ cellId: string; cropId: string; tasksCompleted: number; plotIndex: number } | null>(null);

  // Craft
  const [showCraftSheet, setShowCraftSheet] = useState(false);

  // Codex ferme (Phase 17)
  const [showCodex, setShowCodex] = useState(false);

  // Musée des effets (Phase 23)
  const [showMuseum, setShowMuseum] = useState(false);

  // Expéditions (Phase 33)
  const [showExpeditions, setShowExpeditions] = useState(false);
  const [chestData, setChestData] = useState<{
    visible: boolean;
    outcome: ExpeditionOutcome;
    loot?: ExpeditionLoot;
    missionName: string;
  }>({ visible: false, outcome: 'failure', missionName: '' });
  const expeditionTreeStage = useMemo(
    () => getTreeStageInfo(calculateLevel(profile?.points ?? 0)).stage,
    [profile?.points]
  );
  const {
    dailyPool, activeExpeditions, completedExpeditions, pendingResults,
    activeCount, canLaunch, pityCount, harvestInventory: expeditionHarvestInventory,
    launchExpedition, collectExpedition, dismissExpedition,
  } = useExpeditions(expeditionTreeStage);

  // Cadeaux — envoi
  const [giftOffer, setGiftOffer] = useState<{ itemType: string; itemId: string; maxQty: number; itemName: string } | null>(null);
  // Cadeaux — reception
  const [pendingGiftsToShow, setPendingGiftsToShow] = useState<GiftEntry[]>([]);

  // Tech tree
  const [showTechTree, setShowTechTree] = useState(false);
  const [plotUpgradeIndex, setPlotUpgradeIndex] = useState<number | null>(null);
  const [showBadges, setShowBadges] = useState(false);
  const techBonuses = useMemo(() => {
    return getTechBonuses(profile?.farmTech ?? []);
  }, [profile?.farmTech]);

  // Quête active et droits de démarrage (adulte/ado uniquement)
  const activeQuest = useMemo(() => familyQuests?.find(q => q.status === 'active') ?? null, [familyQuests]);
  const canStartQuest = activeProfile?.role === 'adulte' || activeProfile?.role === 'ado';

  // Compagnon mascotte
  const [showCompanionPicker, setShowCompanionPicker] = useState(false);
  const [companionMessage, setCompanionMessage] = useState<string | null>(null);
  const companionPickerShownRef = useRef(false);
  // Mémoire courte du compagnon — en mémoire uniquement, jamais persistée
  const companionRecentMessagesRef = useRef<string[]>([]);

  // Batiments productifs
  const [showBuildingShop, setShowBuildingShop] = useState(false);
  const [showBuildingDetail, setShowBuildingDetail] = useState(false);
  const [selectedBuildingCellId, setSelectedBuildingCellId] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<PlacedBuilding | null>(null);

  // Quêtes coopératives familiales
  const [showQuestDetail, setShowQuestDetail] = useState(false);
  const [showQuestPicker, setShowQuestPicker] = useState(false);

  // Saga active — pour l'expérience immersive dans le diorama
  const [sagaProgress, setSagaProgress] = useState<SagaProgress | null>(null);
  const [showSagaEvent, setShowSagaEvent] = useState(false);
  // Orchestration visiteur saga : départ après réaction aux choix (SAG-04)
  const [visitorShouldDepart, setVisitorShouldDepart] = useState(false);
  const [visitorReaction, setVisitorReaction] = useState<ReactionType | undefined>(undefined);
  const today = formatDateStr();

  // ── État visiteur événement saisonnier ──
  const [eventProgressList, setEventProgressList] = useState<SeasonalEventProgress[]>([]);
  const [eventProgressLoaded, setEventProgressLoaded] = useState(false);
  const [showEventDialogue, setShowEventDialogue] = useState(false);
  const [eventVisitorShouldDepart, setEventVisitorShouldDepart] = useState(false);
  const [eventVisitorReaction, setEventVisitorReaction] = useState<ReactionType | undefined>(undefined);

  // Handlers quêtes coopératives
  const handleCompleteQuest = useCallback(async () => {
    if (activeQuest) {
      await completeFamilyQuest(activeQuest.id, activeProfile?.id);
      setShowQuestDetail(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [activeQuest, completeFamilyQuest, activeProfile?.id]);

  const handleDeleteQuest = useCallback(async () => {
    if (activeQuest) {
      await deleteFamilyQuest(activeQuest.id);
      setShowQuestDetail(false);
    }
  }, [activeQuest, deleteFamilyQuest]);

  // Handlers expéditions (Phase 33)
  const handleCollectExpedition = useCallback(async (missionId: string) => {
    const { outcome, loot } = await collectExpedition(missionId);
    const mission = dailyPool.find(m => m.id === missionId) ?? { name: 'Expédition' };
    setShowExpeditions(false);
    setTimeout(() => {
      setChestData({ visible: true, outcome: outcome ?? 'failure', loot, missionName: mission.name });
    }, 300);
  }, [collectExpedition, dailyPool]);

  const handleCloseChest = useCallback(() => {
    setChestData(prev => ({ ...prev, visible: false }));
  }, []);

  const handleCreateQuest = useCallback(async (templateId: string) => {
    if (activeProfile) {
      await startFamilyQuest(templateId, activeProfile.id, profiles);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [startFamilyQuest, activeProfile, profiles]);

  // Detection cadeaux en attente — au mount, retour foreground, et focus tab
  const checkPendingGifts = useCallback(() => {
    if (!profile?.id) return;
    receiveGifts(profile.id).then(received => {
      if (received.length > 0) {
        const enriched = received.map(g => ({
          ...g,
          sender_avatar: profiles.find((p: Profile) => p.id === g.sender_id)?.avatar ?? '🎁',
        }));
        setPendingGiftsToShow(enriched);
      }
    });
  }, [profile?.id, receiveGifts]);

  const [isAppActive, setIsAppActive] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  useEffect(() => {
    checkPendingGifts();
    const sub = AppState.addEventListener('change', (state) => {
      setIsAppActive(state === 'active');
      if (state === 'active') checkPendingGifts();
    });
    return () => sub.remove();
  }, [checkPendingGifts]);

  // Pause animations quand l'onglet n'est pas visible
  useFocusEffect(useCallback(() => {
    setIsScreenFocused(true);
    checkPendingGifts();
    return () => setIsScreenFocused(false);
  }, [checkPendingGifts]));

  // Combinaison : pauser si app en background OU onglet pas visible
  const animationsPaused = !isAppActive || !isScreenFocused;

  useEffect(() => {
    if (!profile?.id) return;
    loadSagaProgress(profile.id).then(p => {
      if (p && p.status === 'active') setSagaProgress(p);
      else setSagaProgress(null);
    });
    // Reset des states visiteur quand le profil change
    setVisitorShouldDepart(false);
    setVisitorReaction(undefined);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    loadEventProgressList(profile.id).then(list => {
      setEventProgressList(list);
      setEventProgressLoaded(true);
    });
    setEventVisitorShouldDepart(false);
    setEventVisitorReaction(undefined);
  }, [profile?.id]);

  const activeSaga = sagaProgress ? getSagaById(sagaProgress.sagaId) : null;
  // Chapitre du jour déjà joué ?
  const sagaChapterDone = sagaProgress?.lastChapterDate === today;
  // Un chapitre est disponible (pas encore joué aujourd'hui)
  const sagaChapterAvailable = !!sagaProgress && sagaProgress.status === 'active' && !sagaChapterDone;

  // Événement saisonnier actif non complété
  const [devEventOverride, setDevEventOverride] = useState<string | null>(null);
  const [showDevEffects, setShowDevEffects] = useState(false);
  const activeEventId = (__DEV__ && devEventOverride)
    ? devEventOverride
    : (eventProgressLoaded ? getVisibleEventId(eventProgressList, profile?.id ?? '', new Date()) : null);
  const activeEventContent = activeEventId ? getEventContent(activeEventId) : undefined;

  // Compagnon — données et logique
  const companion = activeProfile?.companion ?? null;

  const recentTasksCount = useMemo(() => {
    if (!gamiData || !activeProfile) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return (gamiData.history ?? []).filter(
      (e: any) => e.profileId === activeProfile.id && e.timestamp?.slice(0, 10) === today && e.note?.startsWith('Tâche:')
    ).length;
  }, [gamiData, activeProfile]);

  const hoursSinceLastActivity = useMemo(() => {
    if (!gamiData || !activeProfile) return 0;
    const history = (gamiData.history ?? []).filter((e: any) => e.profileId === activeProfile.id);
    if (history.length === 0) return 0;
    const lastEntry = history[history.length - 1];
    if (!lastEntry.timestamp) return 0;
    const diffMs = Date.now() - new Date(lastEntry.timestamp).getTime();
    return diffMs / (1000 * 60 * 60);
  }, [gamiData, activeProfile]);

  const companionStage = companion && activeProfile ? getCompanionStage(calculateLevel(activeProfile.points ?? 0)) : undefined;
  const companionMoodResult = companion ? computeMoodScore({
    recentTasksCompleted: recentTasksCount,
    hoursSinceLastActivity,
    streak: activeProfile?.streak ?? 0,
  }) : undefined;
  const companionMood = companionMoodResult?.mood;

  // Contexte enrichi pour les messages IA du compagnon
  const recentCompletedTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks
      .filter(t => t.completed && t.dueDate === today)
      .slice(-3)
      .map(t => t.text);
  }, [tasks]);

  const todayMeals = useMemo(() => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const today = days[new Date().getDay()];
    return meals
      .filter(m => m.day === today && m.text.trim())
      .map(m => `${m.mealType}: ${m.text}`);
  }, [meals]);

  const nextRdv = useMemo(() => {
    const now = new Date();
    const upcoming = rdvs
      .filter(r => new Date(r.date_rdv) >= now)
      .sort((a, b) => new Date(a.date_rdv).getTime() - new Date(b.date_rdv).getTime());
    if (upcoming.length === 0) return null;
    const r = upcoming[0];
    return { title: r.title, date: r.date_rdv };
  }, [rdvs]);

  // Callback d'appel IA pour les messages compagnon — null si pas de clé API
  const anonMap = useMemo(() => {
    return buildAnonymizationMap(profiles, rdvs, undefined, undefined, tasks);
  }, [profiles, rdvs, tasks]);

  const aiCall = useMemo(() => {
    if (!aiConfig?.apiKey) return null;
    return async (prompt: string): Promise<string> => {
      const anonPrompt = anonymize(prompt, anonMap);
      const response = await callCompanionMessage(aiConfig, anonPrompt);
      return deanonymize(response, anonMap);
    };
  }, [aiConfig?.apiKey, anonMap]);

  // Déclencher le picker au niveau COMPANION_UNLOCK_LEVEL sans compagnon (par session)
  useEffect(() => {
    if (!activeProfile || companionPickerShownRef.current) return;
    if (calculateLevel(activeProfile.points ?? 0) >= COMPANION_UNLOCK_LEVEL && !activeProfile.companion) {
      companionPickerShownRef.current = true;
      setShowCompanionPicker(true);
    }
  }, [activeProfile?.id]);

  // Handler de sélection du compagnon
  const handleCompanionSelect = useCallback(async (species: CompanionSpecies, name: string) => {
    if (!activeProfile) return;
    const newCompanion: CompanionData = {
      activeSpecies: species,
      name,
      unlockedSpecies: [species],
    };
    await setCompanion(activeProfile.id, newCompanion);
    setShowCompanionPicker(false);
  }, [activeProfile, setCompanion]);

  // Refs stables pour éviter les boucles de re-render
  const companionRef = useRef(companion);
  useEffect(() => { companionRef.current = companion; }, [companion]);
  const activeProfileRef = useRef(activeProfile);
  useEffect(() => { activeProfileRef.current = activeProfile; }, [activeProfile]);
  const recentTasksCountRef = useRef(recentTasksCount);
  useEffect(() => { recentTasksCountRef.current = recentTasksCount; }, [recentTasksCount]);

  // Hydratation au mount — restaure les messages depuis SecureStore pour l'anti-répétition IA (D-04)
  useEffect(() => {
    if (!activeProfile?.id) return;
    // Pitfall 6 : ne pas écraser les messages de la session en cours
    if (companionRecentMessagesRef.current.length > 0) return;
    loadCompanionMessages(activeProfile.id).then(msgs => {
      companionRecentMessagesRef.current = msgs.map(m => m.text).slice(-5);
    });
  }, [activeProfile?.id]);

  // Sauvegarder un message dans la mémoire courte du compagnon + persistance SecureStore (COMPANION-06)
  // Sauvegarde TOUS les messages (IA et templates traduits) pour l'anti-répétition
  const saveToMemory = useCallback((msg: string, event: CompanionEvent = 'greeting') => {
    if (!companionRef.current || !msg) return;
    const recent = companionRecentMessagesRef.current;
    // Pas de doublon avec le dernier message
    if (recent.length > 0 && recent[recent.length - 1] === msg) return;
    const updated = [...recent, msg].slice(-5);
    companionRecentMessagesRef.current = updated;
    // Persist — fire and forget (D-01, D-03)
    const profileId = activeProfileRef.current?.id;
    if (profileId) {
      loadCompanionMessages(profileId).then(existing => {
        const entry: PersistedCompanionMessage = {
          text: msg, event, timestamp: new Date().toISOString(),
        };
        saveCompanionMessages(profileId, [...existing, entry]);
      });
    }
  }, []);

  // Timer unique pour éviter les races de timers entre fallback et IA
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Afficher un message compagnon (template ou IA) et le persister en mémoire
  const showCompanionMsg = useCallback((msg: string, context: any, duration = 8000, event: CompanionEvent = 'greeting') => {
    // Annuler tout timer précédent pour éviter les races
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    const isI18nKey = msg.startsWith('companion.msg.');
    const displayMsg = isI18nKey ? String(t(msg, context)) : msg;
    setCompanionMessage(displayMsg);
    // Sauvegarder TOUS les messages affichés (traduits) pour l'anti-répétition
    saveToMemory(displayMsg, event);
    msgTimerRef.current = setTimeout(() => setCompanionMessage(null), duration);
  }, [t, saveToMemory]);

  // Tâches en attente aujourd'hui (pas encore complétées)
  const pendingTasksToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks
      .filter(t => !t.completed && t.dueDate === today)
      .slice(0, 5)
      .map(t => t.text);
  }, [tasks]);

  // Moment de la journée pour le contexte compagnon
  const timeOfDay = useMemo((): 'matin' | 'apres-midi' | 'soir' | 'nuit' => {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'matin';
    if (h >= 12 && h < 18) return 'apres-midi';
    if (h >= 18 && h < 23) return 'soir';
    return 'nuit';
  }, []);

  // Handler tap sur le compagnon — affiche message greeting
  const handleCompanionTap = useCallback(() => {
    if (!companion || !activeProfile) return;
    const moodResult = computeMoodScore({
      recentTasksCompleted: recentTasksCount,
      hoursSinceLastActivity,
      streak: activeProfile.streak ?? 0,
    });
    const context: import('../../lib/mascot/companion-types').CompanionMessageContext = {
      profileName: activeProfile.name,
      companionName: companion.name,
      companionSpecies: companion.activeSpecies,
      tasksToday: recentTasksCount,
      streak: activeProfile.streak ?? 0,
      level: calculateLevel(activeProfile.points ?? 0),
      recentTasks: recentCompletedTasks,
      nextRdv,
      todayMeals,
      recentMessages: companionRecentMessagesRef.current,
      mood: moodResult.mood,
      moodScore: moodResult.score,
      pendingTasks: pendingTasksToday,
      timeOfDay,
    };

    // Afficher le template immédiatement comme fallback
    showCompanionMsg(pickCompanionMessage('greeting', context), context, 4000, 'greeting');

    // Tenter un message IA au tap (remplace le fallback si réussi)
    if (aiCall) {
      generateCompanionAIMessage('greeting', context, aiCall).then(msg => {
        showCompanionMsg(msg, context, 4000, 'greeting');
      });
    }
  }, [companion, activeProfile, recentTasksCount, recentCompletedTasks, nextRdv, todayMeals, aiCall, showCompanionMsg, hoursSinceLastActivity, pendingTasksToday, timeOfDay]);

  // Compter les tâches totales du jour (faites + à faire)
  const totalTasksToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter(t => t.dueDate === today).length;
  }, [tasks]);

  // Dernière visite (pour détecter première visite du jour et absence)
  // Persisté en SecureStore pour survivre aux redémarrages app
  const lastVisitRef = useRef<string | null>(null);
  const lastVisitLoadedRef = useRef(false);
  useEffect(() => {
    SecureStore.getItemAsync('companion_last_visit').then(val => {
      lastVisitRef.current = val;
      lastVisitLoadedRef.current = true;
    });
  }, []);

  // Cooldown pour éviter le spam de messages au focus
  const lastFocusMessageRef = useRef<number>(0);

  // Cooldown pour les messages d'action (harvest, craft) — 60s entre deux
  const lastActionMsgRef = useRef<number>(0);

  /** Déclenche un message compagnon pour un événement d'action (avec cooldown) */
  const triggerActionMsg = useCallback((event: import('../../lib/mascot/companion-types').CompanionEvent) => {
    const now = Date.now();
    if (now - lastActionMsgRef.current < 60_000) return;
    const comp = companionRef.current;
    const prof = activeProfileRef.current;
    if (!comp || !prof) return;
    lastActionMsgRef.current = now;

    const moodResult = computeMoodScore({
      recentTasksCompleted: recentTasksCountRef.current,
      hoursSinceLastActivity,
      streak: prof.streak ?? 0,
    });
    const context: import('../../lib/mascot/companion-types').CompanionMessageContext = {
      profileName: prof.name,
      companionName: comp.name,
      companionSpecies: comp.activeSpecies,
      tasksToday: recentTasksCountRef.current,
      streak: prof.streak ?? 0,
      level: calculateLevel(prof.points ?? 0),
      recentMessages: companionRecentMessagesRef.current,
      mood: moodResult.mood,
      moodScore: moodResult.score,
      timeOfDay,
    };

    // Fallback template immédiat
    showCompanionMsg(pickCompanionMessage(event, context), context, 5000, event);

    // Tenter IA (remplace si réussi)
    if (aiCall) {
      generateCompanionAIMessage(event, context, aiCall).then(msg => {
        showCompanionMsg(msg, context, 5000, event);
      });
    }
  }, [aiCall, showCompanionMsg, hoursSinceLastActivity, timeOfDay]);

  // Message de bienvenue au focus — une seule fois par visite, cooldown 20s
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    const comp = companionRef.current;
    const prof = activeProfileRef.current;
    if (!comp || !prof) return;

    // Attendre que lastVisit soit chargé depuis SecureStore
    if (!lastVisitLoadedRef.current) return;

    // Cooldown 20s entre deux messages automatiques
    if (now - lastFocusMessageRef.current < 20 * 1000) return;
    lastFocusMessageRef.current = now;

    const level = calculateLevel(prof.points ?? 0);
    const moodResult = computeMoodScore({
      recentTasksCompleted: recentTasksCountRef.current,
      hoursSinceLastActivity,
      streak: prof.streak ?? 0,
    });

    const context: import('../../lib/mascot/companion-types').CompanionMessageContext = {
      profileName: prof.name,
      companionName: comp.name,
      companionSpecies: comp.activeSpecies,
      tasksToday: recentTasksCountRef.current,
      streak: prof.streak ?? 0,
      level,
      recentTasks: recentCompletedTasks,
      nextRdv,
      todayMeals,
      recentMessages: companionRecentMessagesRef.current,
      mood: moodResult.mood,
      moodScore: moodResult.score,
      pendingTasks: pendingTasksToday,
      timeOfDay,
    };

    const today = new Date().toISOString().slice(0, 10);
    const isFirstVisitToday = lastVisitRef.current !== today;
    lastVisitRef.current = today;
    // Persister en SecureStore pour survivre aux redémarrages
    SecureStore.setItemAsync('companion_last_visit', today).catch(() => {});

    // Détection proactive — prioritaire sur le greeting classique
    const currentHourForProactive = new Date().getHours();
    const isWeeklyRecapWindow = new Date().getDay() === 0 && currentHourForProactive >= 18 && currentHourForProactive < 21;
    const proactiveEvent = detectProactiveEvent({
      hoursSinceLastVisit: hoursSinceLastActivity,
      currentHour: currentHourForProactive,
      tasksToday: recentTasksCountRef.current,
      totalTasksToday,
      streak: prof.streak ?? 0,
      hasGratitudeToday: false,
      hasMealsPlanned: (todayMeals?.length ?? 0) > 0,
      isFirstVisitToday,
      isWeeklyRecapWindow,
    });

    // Choisir l'événement le plus pertinent
    let event: import('../../lib/mascot/companion-types').CompanionEvent =
      proactiveEvent ?? 'greeting';

    // Fallback sur événements classiques si pas de proactif
    if (!proactiveEvent) {
      if (recentTasksCountRef.current >= 5) {
        event = 'task_completed';
      } else if ((prof.streak ?? 0) > 0 && recentTasksCountRef.current > 0) {
        event = 'streak_milestone';
      }
    }

    // D-10 : guard gentle_nudge — max 1 nudge par jour par profil
    // Vérification async avant de lancer le timer
    const nudgeCheckPromise: Promise<boolean> = event === 'gentle_nudge'
      ? hasNudgeShownToday(prof.id).then(alreadyShown => {
          if (alreadyShown) return true; // bloquer
          markNudgeShownToday(prof.id); // fire-and-forget
          return false;
        })
      : Promise.resolve(false);

    // Phase 21 : Injecter subType depuis le bridge SecureStore (FEEDBACK-04, D-06)
    // Lire de maniere asynchrone — la valeur sera disponible avant le delayTimer (1.5s)
    const subTypePromise = SecureStore.getItemAsync('last_semantic_category').then(stored => {
      if (stored) {
        context.subType = stored;
        // Nettoyer pour eviter reutilisation du vieux subType
        SecureStore.deleteItemAsync('last_semantic_category').catch(() => {});
      }
      return stored;
    }).catch(() => null);

    // Délai avant d'afficher le message (1.5s — laisse le temps a subTypePromise de se resoudre)
    const delayTimer = setTimeout(async () => {
      // D-10 : annuler si nudge déjà affiché aujourd'hui
      const nudgeBlocked = await nudgeCheckPromise;
      if (nudgeBlocked) return;
      // Attendre le subType si la promesse n'est pas encore resolue
      await subTypePromise;
      // Afficher le template comme fallback immédiat
      showCompanionMsg(pickCompanionMessage(event, context), context, undefined, event);

      // Tenter un message IA (async, remplace le fallback si réussi)
      if (aiCall) {
        generateCompanionAIMessage(event, context, aiCall).then(msg => {
          showCompanionMsg(msg, context, undefined, event);
        });
      }
    }, 1500);

    return () => { clearTimeout(delayTimer); };
  // Dépendances stables uniquement — les refs capturent le reste
  }, [aiCall]));

  // Sunrise report + vérification usure à l'ouverture (collecte passive désactivée)
  useEffect(() => {
    if (!profile?.id) return;
    const buildings = profile.farmBuildings ?? [];
    if (buildings.length === 0) return;

    (async () => {
      const SUNRISE_KEY = 'sunrise_last_shown';
      const lastShown = await SecureStore.getItemAsync(SUNRISE_KEY);
      const now = Date.now();
      const absenceThresholdMs = 6 * 60 * 60 * 1000;
      if (!lastShown) {
        await SecureStore.setItemAsync(SUNRISE_KEY, String(now));
        return;
      }
      const lastTs = parseInt(lastShown, 10);
      const longAbsence = (now - lastTs) > absenceThresholdMs;

      // Calculer le détail par ressource (lecture seule — pas de collecte)
      const techBonuses = getTechBonuses(profile.farmTech ?? []);
      const resourceMap: Record<string, { emoji: string; label: string; qty: number }> = {};
      for (const b of buildings) {
        const pending = getPendingResources(b, new Date(), techBonuses);
        if (pending <= 0) continue;
        const def = BUILDING_CATALOG.find(d => d.id === b.buildingId);
        if (!def) continue;
        const key = def.resourceType;
        const emoji = key === 'oeuf' ? '🥚' : key === 'lait' ? '🥛' : key === 'miel' ? '🍯' : '🫓';
        const label = key === 'oeuf' ? 'Oeufs' : key === 'lait' ? 'Lait' : key === 'miel' ? 'Miel' : 'Farine';
        if (!resourceMap[key]) resourceMap[key] = { emoji, label, qty: 0 };
        resourceMap[key].qty += pending;
      }

      const totalPending = Object.values(resourceMap).reduce((s, r) => s + r.qty, 0);

      // Vérifier l'usure de la ferme (clôtures, toits, herbes, nuisibles)
      const newWearEvents = await checkWear(profile.id);
      for (const ev of newWearEvents) {
        if (ev.type === 'broken_fence') showToast(t('farm.wear.brokenFence'), 'error');
        else if (ev.type === 'damaged_roof') showToast(t('farm.wear.damagedRoof'), 'error');
        else if (ev.type === 'weeds') showToast(t('farm.wear.weeds'), 'info');
        else if (ev.type === 'pests') showToast(t('farm.wear.pests'), 'info');
      }

      if (totalPending === 0) return;

      if (longAbsence) {
        const resources: SunriseResource[] = Object.values(resourceMap).map(r => ({
          emoji: r.emoji,
          label: r.label,
          quantity: r.qty,
        }));
        setSunriseData({ resources, totalCollected: totalPending, yesterdayTasks: 0, hasBonus: false });
        await SecureStore.setItemAsync(SUNRISE_KEY, String(now));
      } else {
        const detail = Object.values(resourceMap)
          .map(r => `${r.emoji} ${r.qty} ${r.label}`)
          .join(' · ');
        showToast(`🏠 ${detail}`);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Notification cultures matures
  useEffect(() => {
    if (!profile?.farmCrops) return;
    const crops = parseCrops(profile.farmCrops);
    const matureCount = crops.filter((c: any) => c.currentStage >= 4).length;
    if (matureCount > 0) {
      showToast(`✨ ${matureCount} culture${matureCount > 1 ? 's' : ''} a recolter !`);
    }
  }, []);

  // Saga items actifs (non expirés)
  const activeSagaItems = useMemo(() => {
    if (!profile?.sagaItems) return { decoIds: [] as string[], habIds: [] as string[] };
    const today = new Date().toISOString().split('T')[0];
    const active = profile.sagaItems.filter(i => i.expiresAt >= today);
    return {
      decoIds: active.filter(i => i.type === 'decoration').map(i => i.itemId),
      habIds: active.filter(i => i.type === 'inhabitant').map(i => i.itemId),
    };
  }, [profile?.sagaItems]);

  // Décorations et habitants combinés (permanents + saga temporaires)
  const allDecoIds = useMemo(() => [...(profile?.mascotDecorations ?? []), ...activeSagaItems.decoIds], [profile?.mascotDecorations, activeSagaItems.decoIds]);
  const allHabIds = useMemo(() => [...(profile?.mascotInhabitants ?? []), ...activeSagaItems.habIds], [profile?.mascotInhabitants, activeSagaItems.habIds]);

  // Liste combinée des items possédés avec leurs infos catalogue
  const allOwnedItems = useMemo(() => {
    if (!profile) return [];
    const items: { id: string; emoji: string }[] = [];
    for (const id of allDecoIds) {
      const cat = DECORATIONS.find(d => d.id === id);
      if (cat) items.push({ id, emoji: cat.emoji });
    }
    for (const id of allHabIds) {
      const cat = INHABITANTS.find(h => h.id === id);
      if (cat) items.push({ id, emoji: cat.emoji });
    }
    return items;
  }, [allDecoIds, allHabIds]);

  // Set des items déjà placés sur un slot
  const placedItemIds = useMemo(() => {
    if (!profile) return new Set<string>();
    return new Set(Object.values(profile.mascotPlacements ?? {}));
  }, [profile?.mascotPlacements]);

  // Items possédés groupés par type (pour le picker)
  const ownedInhabitants = useMemo(() => {
    return allHabIds
      .map(id => {
        const cat = INHABITANTS.find(h => h.id === id);
        return cat ? { id, cat } : null;
      })
      .filter((x): x is { id: string; cat: typeof INHABITANTS[number] } => x !== null);
  }, [allHabIds]);

  const ownedDecorations = useMemo(() => {
    return allDecoIds
      .map(id => {
        const cat = DECORATIONS.find(d => d.id === id);
        return cat ? { id, cat } : null;
      })
      .filter((x): x is { id: string; cat: typeof DECORATIONS[number] } => x !== null);
  }, [allDecoIds]);

  // Emoji de l'item en cours de placement (pour le bandeau)
  const placingItemEmoji = useMemo(() => {
    if (!placingItem) return '';
    const found = allOwnedItems.find(i => i.id === placingItem);
    return found?.emoji ?? '';
  }, [placingItem, allOwnedItems]);

  // Nombre de cultures en croissance (pour le HUD)
  const growingCount = useMemo(() => {
    const crops = parseCrops(profile?.farmCrops ?? '');
    return crops.filter(c => c.currentStage < 4).length;
  }, [profile?.farmCrops]);

  if (!profile) return null;

  const species = profile.treeSpecies || 'cerisier';
  const hasChosenSpecies = !!profile.treeSpecies;
  const level = calculateLevel(profile.points ?? 0);
  const season = getCurrentSeason();
  const seasonInfo = SEASON_INFO[season];
  const tier = getLevelTier(level);
  const stageInfo = getTreeStageInfo(level);

  // Crops prêtes à récolter — positions pour le compagnon
  const harvestables = useMemo(() => {
    const crops = parseCrops(profile?.farmCrops ?? '');
    const cells = getUnlockedCropCells(stageInfo.stage);
    return crops
      .filter(c => c.currentStage >= 4)
      .map(c => {
        const cell = cells.find(cl => cl.unlockOrder === c.plotIndex || cells.indexOf(cl) === c.plotIndex);
        if (!cell) return null;
        const cropDef = CROP_CATALOG.find(cd => cd.id === c.cropId);
        return { fx: cell.x, fy: cell.y, cropName: cropDef?.emoji ? `${cropDef.emoji} ${t(`farm.crop.${c.cropId}`)}` : c.cropId };
      })
      .filter(Boolean) as { fx: number; fy: number; cropName: string }[];
  }, [profile?.farmCrops, stageInfo.stage, t]);

  // Positions Y des rangées cultivées — mémoïsé pour ne pas reset la patrouille du compagnon
  const plantedCropYs = useMemo(() => {
    const crops = parseCrops(profile?.farmCrops ?? '');
    const allCells = getExpandedCropCells(stageInfo.stage, techBonuses);
    const ys = new Set<number>();
    crops.forEach(c => {
      const cell = allCells[c.plotIndex];
      if (cell) ys.add(cell.y);
    });
    return [...ys];
  }, [profile?.farmCrops, stageInfo.stage, techBonuses]);

  // Positions Y des bâtiments construits — mémoïsé pour ne pas reset la patrouille du compagnon
  const builtBuildingYs = useMemo(() => {
    return (profile?.farmBuildings ?? []).map(b => {
      const cells = [...BUILDING_CELLS, EXPANSION_BUILDING_CELL];
      const cell = cells.find(c => c.id === b.cellId);
      return cell?.y ?? 0;
    }).filter(y => y > 0);
  }, [profile?.farmBuildings]);

  const stageProgress = getStageProgress(level);
  const nextEvoLevel = getNextEvolutionLevel(level);
  const levelsLeft = levelsUntilEvolution(level);
  const sp = SPECIES_INFO[species];
  const stageIdx = getStageIndex(level);

  // XP progress vers prochain niveau
  const currentXP = profile.points ?? 0;
  const nextLevelXP = xpForLevel(level);
  const prevLevelXP = level > 1 ? xpForLevel(level - 1) : 0;
  const xpInLevel = currentXP - prevLevelXP;
  const xpNeeded = nextLevelXP - prevLevelXP;
  const xpPercent = xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 1;

  // DEV ONLY — test des 10 effets sémantiques Phase 21
  const triggerDevEffect = useCallback(async (catId: CategoryId) => {
    const toastDef = EFFECT_TOASTS[catId];
    if (toastDef) {
      showToast(
        toastDef.fr,
        toastDef.type,
        undefined,
        { icon: toastDef.icon, subtitle: toastDef.subtitle_fr },
      );
    }
    const hapticFn = CATEGORY_HAPTIC_FN[catId];
    if (hapticFn) hapticFn();
    await SecureStore.setItemAsync('last_semantic_category', catId);
    setShowDevEffects(false);
  }, [showToast]);

  const handleSpeciesSelect = useCallback(async (newSpecies: TreeSpecies) => {
    const targetProfile = selectedProfileForPicker || profile;
    if (!targetProfile) return;
    try {
      await updateTreeSpecies(targetProfile.id, newSpecies);
      hapticsSpeciesChange();
      showToast(t('mascot.speciesChanged', { species: t(SPECIES_INFO[newSpecies].labelKey) }));
    } catch {
      showToast(t('common.error'), 'error');
    }
    setShowSpeciesPicker(false);
    setSelectedProfileForPicker(null);
  }, [profile, selectedProfileForPicker, updateTreeSpecies, showToast, t]);

  const openPickerFor = useCallback((p: Profile) => {
    setSelectedProfileForPicker(p);
    setShowSpeciesPicker(true);
  }, []);

  const handleShopBuy = useCallback(async (itemId: string, itemType: 'decoration' | 'inhabitant') => {
    if (!profile) return;
    await buyMascotItem(profile.id, itemId, itemType);
    const labelKey = itemType === 'decoration'
      ? `mascot.deco.${itemId}`
      : `mascot.hab.${itemId}`;
    showToast(t('mascot.shop.buySuccess', { item: t(labelKey) }));
    // Fermer la boutique et entrer en mode placement
    setShowShop(false);
    setPlacingItem(itemId);
  }, [profile, buyMascotItem, showToast, t]);

  /** Callback quand l'utilisateur sélectionne un slot en mode placement */
  const handleSlotSelect = useCallback(async (slotId: string) => {
    if (!placingItem || !profile) return;
    try {
      await placeMascotItem(profile.id, slotId, placingItem);
      showToast(t('mascot.placed'));
      setPlacingItem(null);
      // S'il reste des items non placés, rouvrir le picker
      const updatedPlacements = { ...profile.mascotPlacements, [slotId]: placingItem };
      const placedSet = new Set(Object.values(updatedPlacements));
      const allOwned = [...(profile.mascotDecorations ?? []), ...(profile.mascotInhabitants ?? [])];
      const hasUnplaced = allOwned.some(id => !placedSet.has(id));
      if (hasUnplaced) {
        setTimeout(() => setShowItemPicker(true), 400);
      }
    } catch {
      showToast(t('common.error'), 'error');
    }
  }, [placingItem, profile, placeMascotItem, unplaceMascotItem, showToast, t]);

  /** Tap sur une cellule de culture */
  const handleCropCellPress = useCallback((cellId: string, crop: PlantedCrop | null) => {
    if (!profile || !isOwnTree) return;
    // Inclure les parcelles d'expansion tech dans la recherche
    const cells = techBonuses
      ? getExpandedCropCells(stageInfo.stage, techBonuses)
      : getUnlockedCropCells(stageInfo.stage);
    const cellIdx = cells.findIndex((c: any) => c.id === cellId);
    if (cellIdx < 0) return;

    if (crop && crop.currentStage >= 4) {
      // Recolte → feedback unique via HarvestCardToast (carte en bas)
      harvest(profile.id, crop.plotIndex).then((result) => {
        if (result) {
          const harvestedCropDef = CROP_CATALOG.find(c => c.id === result.cropId);
          const emoji = harvestedCropDef?.emoji ?? '🌾';
          const cropLabel = harvestedCropDef ? t(harvestedCropDef.labelKey) : result.cropId;
          const accord = FEMININE_CROPS.has(result.cropId) ? 'récoltée' : 'récolté';
          const harvestLabel = `${result.isGolden ? '✨ ' : ''}${cropLabel} ${accord} !`;
          showHarvestCard(
            {
              emoji,
              label: harvestLabel,
              qty: result.qty,
              wager: result.wager && result.wager.won
                ? { won: true, multiplier: result.wager.multiplier, dropBack: result.wager.dropBack }
                : undefined,
            },
            result.isGolden,
          );
          // Défaite wager : toast discret en complément (carte cachera le pari
          // car wager.won=false → pas de badge doré). Message neutre, non punitif.
          if (result.wager && !result.wager.won) {
            showToast('🍄 Sporée consommée · pari non validé', 'info');
          }
          // Animation graine rare avec délai pour ne pas chevaucher le toast récolte
          if (result.seedDrop) {
            setTimeout(() => setSeedDropEvent(result.seedDrop), 1500);
          }
          if (result.harvestEvent) {
            setHarvestEvent(result.harvestEvent);
          }
          triggerActionMsg('harvest');
        }
      });
    } else if (crop) {
      // Tooltip info sur culture en croissance — calcul aligné sur farm-engine.ts:174-175
      const cropDef = CROP_CATALOG.find(c => c.id === crop.cropId);
      const stagesDone = crop.currentStage;
      const plotBonus = PLOT_LEVEL_BONUSES[getPlotLevel(profile.plotLevels, crop.plotIndex)]?.tasksPerStageReduction ?? 0;
      const sprintActive = !!(profile.growthSprintUntil && new Date(profile.growthSprintUntil) > new Date());
      const sprintBonus = sprintActive ? 1 : 0;
      const effectiveTpS = Math.max(
        1,
        (cropDef?.tasksPerStage ?? 0)
          - (techBonuses?.tasksPerStageReduction ?? 0)
          - plotBonus
          - sprintBonus
      );
      const totalCompleted = stagesDone * effectiveTpS + crop.tasksCompleted;
      setTooltipInfo({ cellId, cropId: crop.cropId, tasksCompleted: totalCompleted, plotIndex: crop.plotIndex });
      setTimeout(() => setTooltipInfo(null), 3000);
    } else {
      setSelectedPlotIndex(cellIdx);
      setShowSeedPicker(true);
    }
  }, [profile, isOwnTree, harvest, level, stageIdx, techBonuses, stageInfo.stage, triggerActionMsg]);

  /** Planter une graine sur la parcelle selectionnee.
   *  Phase 40 : si ≥1 Sporée + canSealWager ok → ouvre WagerSealerSheet
   *  (pageSheet empilé 300ms delay anti-collision iOS). Sinon plantation directe. */
  const handleSeedSelect = useCallback(async (cropId: string) => {
    if (!profile || selectedPlotIndex === null) return;

    // Gate Phase 40 — sealer Sporée si inventaire ≥1 et profil autorisé
    const sporeeCount = profile.sporeeCount ?? 0;
    if (sporeeCount >= 1) {
      const check = canSealWager({
        sealerProfileId: profile.id,
        allProfiles: profiles,
        today: getLocalDateKey(new Date()),
      });
      if (check.ok) {
        const cropDef = CROP_CATALOG.find(c => c.id === cropId);
        const tasksPerStage = cropDef?.tasksPerStage ?? 1;
        setPendingPlant({ plotIndex: selectedPlotIndex, cropId, tasksPerStage });
        setShowSeedPicker(false);
        // Gotcha G1 — stacking pageSheets iOS requiert un delay entre dismiss et present
        setTimeout(() => setShowWagerSealer(true), 300);
        setSelectedPlotIndex(null);
        return;
      }
    }

    // Plantation directe — comportement historique préservé
    try {
      await plant(profile.id, selectedPlotIndex, cropId);
      const cropDef = CROP_CATALOG.find(c => c.id === cropId);
      showToast(`${cropDef?.emoji ?? '🌱'} ${t('farm.planted')}`);
    } catch {
      showToast(t('common.error'), 'error');
    }
    setShowSeedPicker(false);
    setSelectedPlotIndex(null);
  }, [profile, profiles, selectedPlotIndex, plant, showToast, t]);

  // Phase 40 — handlers WagerSealerSheet (confirm seal / skip)
  const handleWagerSealConfirm = useCallback(async (duration: WagerDuration) => {
    if (!pendingPlant || !profile) return;
    try {
      await startWager(profile.id, pendingPlant.plotIndex, pendingPlant.cropId, duration);
      const cropDef = CROP_CATALOG.find(c => c.id === pendingPlant.cropId);
      showToast(`${cropDef?.emoji ?? '🌱'} 🍄 Pari scellé !`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Impossible de sceller';
      Alert.alert('Erreur', msg);
    } finally {
      setPendingPlant(null);
      setShowWagerSealer(false);
    }
  }, [pendingPlant, profile, startWager, showToast]);

  const handleWagerSealSkip = useCallback(async () => {
    if (!pendingPlant || !profile) return;
    try {
      await plant(profile.id, pendingPlant.plotIndex, pendingPlant.cropId);
      const cropDef = CROP_CATALOG.find(c => c.id === pendingPlant.cropId);
      showToast(`${cropDef?.emoji ?? '🌱'} ${t('farm.planted')}`);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setPendingPlant(null);
      setShowWagerSealer(false);
    }
  }, [pendingPlant, profile, plant, showToast, t]);

  // Header close (X) / dismiss = annuler — aucune plantation, retour seed picker
  const handleWagerSealCancel = useCallback(() => {
    const restoredPlot = pendingPlant?.plotIndex ?? null;
    setPendingPlant(null);
    if (restoredPlot !== null) {
      setSelectedPlotIndex(restoredPlot);
      setTimeout(() => setShowSeedPicker(true), 300);
    }
  }, [pendingPlant]);

  const handleWagerSealerClose = useCallback(() => {
    setShowWagerSealer(false);
  }, []);

  /** Tap sur une cellule batiment */
  const handleBuildingCellPress = useCallback((cellId: string, building: PlacedBuilding | null) => {
    if (!isOwnTree) return;
    if (building) {
      setSelectedBuilding(building);
      setSelectedBuildingCellId(cellId);
      setShowBuildingDetail(true);
    } else {
      setSelectedBuildingCellId(cellId);
      setShowBuildingShop(true);
    }
  }, [isOwnTree]);

  /** Réparer une clôture cassée sur une parcelle */
  const handleRepairFence = useCallback(async (plotIndex: number) => {
    if (!profile) return;
    const events = getWearEvents(profile.id);
    const event = events.find(e => e.type === 'broken_fence' && e.targetId === String(plotIndex) && !e.repairedAt);
    if (!event) return;
    const cost = 15;
    Alert.alert(
      t('farm.wear.broken_fence_title', { defaultValue: 'Clôture cassée' }),
      t('farm.wear.broken_fence_confirm', { cost, defaultValue: `Réparer pour ${cost} 🍃 ?` }),
      [
        { text: t('common.cancel', { defaultValue: 'Annuler' }), style: 'cancel' },
        {
          text: t('farm.wear.repair_btn', { cost, defaultValue: `Réparer (${cost} 🍃)` }),
          onPress: async () => {
            const ok = await repairWear(profile.id, event.id);
            if (ok) showToast(t('farm.wear.repaired', { defaultValue: 'Réparé !' }));
            else showToast(t('farm.wear.not_enough', { defaultValue: 'Pas assez de feuilles' }), 'error');
          },
        },
      ],
    );
  }, [profile, getWearEvents, repairWear, showToast, t]);

  /** Réparer les mauvaises herbes sur une parcelle */
  const handleRepairWeed = useCallback(async (plotIndex: number) => {
    if (!profile) return;
    const events = getWearEvents(profile.id);
    const event = events.find(e => e.type === 'weeds' && e.targetId === String(plotIndex) && !e.repairedAt);
    if (!event) return;
    const ok = await repairWear(profile.id, event.id);
    if (ok) showToast(t('farm.wear.repaired'));
  }, [profile, getWearEvents, repairWear, showToast, t]);

  /** Réparer les nuisibles sur un bâtiment */
  const handleRepairPest = useCallback(async (cellId: string) => {
    if (!profile) return;
    const events = getWearEvents(profile.id);
    const event = events.find(e => e.type === 'pests' && e.targetId === cellId && !e.repairedAt);
    if (!event) return;
    const ok = await repairWear(profile.id, event.id);
    if (ok) showToast(t('farm.wear.repaired'));
  }, [profile, getWearEvents, repairWear, showToast, t]);

  /** Réparer le toit du bâtiment sélectionné */
  const handleRepairRoof = useCallback(async () => {
    if (!profile || !selectedBuildingCellId) return;
    const events = getWearEvents(profile.id);
    const event = events.find(e => e.type === 'damaged_roof' && e.targetId === selectedBuildingCellId && !e.repairedAt);
    if (!event) return;
    const ok = await repairWear(profile.id, event.id);
    if (ok) showToast(t('farm.wear.repaired'));
  }, [profile, selectedBuildingCellId, getWearEvents, repairWear, showToast, t]);

  /** Construire un batiment */
  const handleBuildBuilding = useCallback(async (buildingId: string) => {
    if (!profile?.id || !selectedBuildingCellId) return;
    try {
      await buyBuilding(profile.id, buildingId, selectedBuildingCellId);
      const def = BUILDING_CATALOG.find(b => b.id === buildingId);
      showToast(`🏗️ ${def?.emoji ?? ''} Construit !`);
      setShowBuildingShop(false);
    } catch (e: any) {
      showToast(`❌ ${e.message}`);
    }
  }, [profile?.id, selectedBuildingCellId, buyBuilding, showToast]);

  /** Collecter les ressources d'un batiment */
  const handleCollectBuilding = useCallback(async (cellId: string) => {
    if (!profile?.id) return;
    const collected = await collectBuildingResources(profile.id, cellId);
    if (collected > 0) {
      const building = (profiles?.find((p: Profile) => p.id === profile.id)?.farmBuildings ?? [])
        .find((b: PlacedBuilding) => b.cellId === cellId);
      const def = building ? BUILDING_CATALOG.find(d => d.id === building.buildingId) : null;
      const resourceEmoji = def?.resourceType === 'oeuf' ? '🥚' : def?.resourceType === 'lait' ? '🥛' : def?.resourceType === 'miel' ? '🍯' : '🫓';
      showToast(`${resourceEmoji} +${collected} ${def?.resourceType ?? ''}`);
      // Fermer la modal — les profiles stale dans la closure ne reflètent pas le refresh
      setShowBuildingDetail(false);
      setSelectedBuilding(null);
    }
  }, [profile?.id, collectBuildingResources, profiles, showToast]);

  /** Ameliorer un batiment */
  const handleUpgradeBuilding = useCallback(async (cellId: string) => {
    if (!profile?.id) return;
    try {
      await upgradeBuildingAction(profile.id, cellId);
      const updatedProfile = profiles?.find((p: Profile) => p.id === profile.id);
      const updatedBuilding = (updatedProfile?.farmBuildings ?? []).find(
        (b: PlacedBuilding) => b.cellId === cellId,
      ) ?? null;
      if (updatedBuilding) {
        setSelectedBuilding(updatedBuilding);
        showToast(`⬆️ Ameliore au Niv ${updatedBuilding.level} !`);
      }
    } catch (e: any) {
      showToast(`❌ ${e.message}`);
    }
  }, [profile?.id, upgradeBuildingAction, profiles, showToast]);

  /** Complétion d'un chapitre saga depuis le diorama */
  const handleSagaChapterComplete = useCallback(async (
    choiceId: string,
    points: number,
    sagaNote: string,
    rewardItem?: { id: string; type: 'decoration' | 'inhabitant' },
    bonusCropId?: string,
  ) => {
    if (!sagaProgress || !activeSaga || !profile) return;

    const currentChapter = activeSaga.chapters.find(ch => ch.id === sagaProgress.currentChapter);
    if (!currentChapter) return;

    const choice = currentChapter.choices.find(c => c.id === choiceId);
    if (!choice) return;

    // Accumuler les traits
    const newTraits = { ...sagaProgress.traits };
    for (const [trait, val] of Object.entries(choice.traits)) {
      newTraits[trait as SagaTrait] = (newTraits[trait as SagaTrait] ?? 0) + (val ?? 0);
    }

    const nextChapterNum = sagaProgress.currentChapter + 1;
    const isFinal = nextChapterNum > activeSaga.chapters.length;

    const updatedProgress: SagaProgress = {
      ...sagaProgress,
      currentChapter: nextChapterNum,
      choices: { ...sagaProgress.choices, [currentChapter.id]: choiceId },
      traits: newTraits,
      lastChapterDate: today,
      status: isFinal ? 'completed' : 'active',
      rewardClaimed: isFinal ? true : sagaProgress.rewardClaimed,
    };

    // XP + récompense via VaultContext
    await completeSagaChapter(profile.id, points, sagaNote, rewardItem, bonusCropId);

    if (isFinal) {
      await saveLastSagaCompletion(profile.id, today);
    }

    await saveSagaProgress(updatedProgress);
    setSagaProgress(updatedProgress);

    showToast(t('mascot.adventure.reward', { points }));
  }, [sagaProgress, activeSaga, profile, today, completeSagaChapter, showToast, t]);

  /** Callback réaction aux choix saga — stocke le type de réaction pour le VisitorSlot (SAG-04) */
  const handleChoiceReaction = useCallback((reaction: ReactionType) => {
    setVisitorReaction(reaction);
  }, []);

  /**
   * onDismiss modifié — ferme le dialogue saga.
   * Si une réaction est en cours (visitorReaction est set), le départ sera déclenché par
   * onReactionComplete du VisitorSlot après la fin de l'animation de réaction.
   * Si pas de réaction (joueur ferme sans choisir), déclencher le départ directement.
   */
  const handleSagaDismiss = useCallback(() => {
    setShowSagaEvent(false);
    if (!visitorReaction) {
      setVisitorShouldDepart(true);
    }
    // Si visitorReaction est déjà set, onReactionComplete fera setVisitorShouldDepart(true)
  }, [visitorReaction]);

  /** Complétion du dialogue événement saisonnier */
  const handleEventComplete = useCallback(async (
    choiceId: string,
    points: number,
    _sagaNote: string,
  ) => {
    if (!profile?.id || !activeEventId || !activeEventContent) return;

    // 1. Récompense garantie selon l'index du choix
    const activeEvent = getActiveEvent();
    if (activeEvent) {
      const choiceIndex = activeEventContent.chapter.choices.findIndex(c => c.id === choiceId);
      const { reward } = drawGuaranteedSeasonalReward(activeEvent, choiceIndex >= 0 ? choiceIndex : 0);

      // Ajouter les bonus points de la récompense si applicable
      const bonusPoints = reward.bonusPoints ?? 0;
      const totalPoints = points + SEASONAL_EVENT_BONUS_XP + bonusPoints;

      // 2. Ajouter XP via completeSagaChapter (géré proprement par la queue d'écriture)
      const eventNote = `Événement saisonnier: ${activeEventId}`;
      await completeSagaChapter(profile.id, totalPoints, eventNote);
    } else {
      // Événement introuvable — ajouter au moins les points de base + bonus XP
      const totalPoints = points + SEASONAL_EVENT_BONUS_XP;
      const eventNote = `Événement saisonnier: ${activeEventId}`;
      await completeSagaChapter(profile.id, totalPoints, eventNote);
    }

    // 3. Persister la complétion (empêche réapparition D-08)
    const progress: SeasonalEventProgress = {
      eventId: activeEventId,
      year: new Date().getFullYear(),
      profileId: profile.id,
      completed: true,
      completedAt: new Date().toISOString().slice(0, 10),
      choiceId,
    };
    await saveEventProgress(progress);
    setEventProgressList(prev => [
      ...prev.filter(p => !(p.eventId === activeEventId && p.year === progress.year)),
      progress,
    ]);

    // 4. Déclencher le départ du visiteur
    setEventVisitorShouldDepart(true);
    showToast(t('mascot.adventure.reward', { points: points + SEASONAL_EVENT_BONUS_XP }));
  }, [profile?.id, activeEventId, activeEventContent, completeSagaChapter, showToast, t]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, Layout.contentContainer, { paddingTop: insets.top + 44 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Bandeau saga active */}
        {activeSaga && sagaProgress && sagaProgress.status !== 'completed' && (
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={[styles.seasonBadge, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
              <Text style={[styles.seasonText, { color: colors.textSub }]}>
                {t('mascot.saga.banner', {
                  title: t(activeSaga.titleKey, { context: undefined }),
                  chapter: sagaProgress.currentChapter,
                  total: activeSaga.chapters.length,
                })}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Bandeau mode placement — discret, juste l'emoji + annuler */}
        {placingItem && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.placementBanner, { backgroundColor: primary + '22', borderColor: primary }]}
          >
            <Text style={[styles.placementBannerText, { color: primary }]}>
              {placingItemEmoji ? `${placingItemEmoji} ` : ''}{t('mascot.placement.choose')}
            </Text>
            <TouchableOpacity
              style={[styles.placementCancelBtn, { borderColor: primary }]}
              onPress={() => setPlacingItem(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.placementCancelText, { color: primary }]}>{'✕'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Modal Embellir — pageSheet cozy */}
        <Modal
          visible={showItemPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowItemPicker(false)}
        >
          <View style={styles.cozyContainer}>
            {/* En-tête parchemin */}
            <View style={styles.cozyHeader}>
              <View style={styles.cozyHeaderLeft}>
                <Image source={ACTION_SPRITES.embellir} style={styles.cozyHeaderSprite} />
                <Text style={styles.cozyHeaderTitle}>{t('mascot.placement.choose')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowItemPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', 'Fermer')}
              >
                <Text style={styles.cozyHeaderClose}>{'✕'}</Text>
              </TouchableOpacity>
            </View>

            {/* Bande auvent */}
            <View style={styles.cozyAwning}>
              <View style={styles.cozyAwningStripes}>
                {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.cozyAwningStripe,
                      { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.cozyAwningShadow} />
              <View style={styles.cozyAwningScallop}>
                {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.cozyAwningScallopDot,
                      { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
                    ]}
                  />
                ))}
              </View>
            </View>

            {(() => {
              const handlePickerTap = async (itemId: string) => {
                Haptics.selectionAsync();
                const isPlaced = placedItemIds.has(itemId);
                if (isPlaced && profile) {
                  const slot = Object.entries(profile.mascotPlacements ?? {}).find(([, v]) => v === itemId)?.[0];
                  if (slot) {
                    await unplaceMascotItem(profile.id, slot);
                    showToast(t('mascot.placement.removed'));
                  }
                } else {
                  setPlacingItem(itemId);
                  setShowItemPicker(false);
                }
              };

              const renderRow = (
                id: string,
                cat: { labelKey: string; emoji: string; rarity: string },
              ) => {
                const isPlaced = placedItemIds.has(id);
                const rarityColor = PICKER_RARITY_COLORS[cat.rarity] ?? Farm.brownTextSub;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => handlePickerTap(id)}
                    activeOpacity={0.75}
                    style={[
                      styles.cozyRow,
                      isPlaced && styles.cozyRowPlaced,
                    ]}
                  >
                    {ITEM_ILLUSTRATIONS[id] ? (
                      <Image source={ITEM_ILLUSTRATIONS[id]} style={styles.cozyRowSprite} />
                    ) : (
                      <View style={styles.cozyRowEmojiWrap}>
                        <Text style={styles.cozyRowEmoji}>{cat.emoji}</Text>
                      </View>
                    )}
                    <View style={styles.cozyRowInfo}>
                      <Text style={styles.cozyRowName}>{t(cat.labelKey)}</Text>
                      <View style={styles.cozyRowMeta}>
                        <View style={[styles.cozyRarityDot, { backgroundColor: rarityColor }]} />
                        <Text style={[styles.cozyRarityText, { color: rarityColor }]}>
                          {cat.rarity}
                        </Text>
                      </View>
                    </View>
                    {isPlaced ? (
                      <View style={styles.cozyStatusChip}>
                        <Text style={styles.cozyStatusChipText}>{'✓ Placé'}</Text>
                      </View>
                    ) : (
                      <Text style={styles.cozyRowChevron}>{'›'}</Text>
                    )}
                  </TouchableOpacity>
                );
              };

              const isEmpty = ownedInhabitants.length === 0 && ownedDecorations.length === 0;

              return (
                <ScrollView
                  style={styles.cozyScroll}
                  contentContainerStyle={styles.cozyScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {isEmpty && (
                    <Text style={styles.cozyEmptyText}>
                      {t('mascot.shop.empty', 'Aucun item à placer pour l\'instant.')}
                    </Text>
                  )}

                  {ownedInhabitants.length > 0 && (
                    <>
                      <Text style={styles.cozySectionTitle}>
                        {t('mascot.shop.inhabitants')}
                      </Text>
                      {ownedInhabitants.map(({ id, cat }) => renderRow(id, cat))}
                    </>
                  )}

                  {ownedDecorations.length > 0 && (
                    <>
                      <Text style={styles.cozySectionTitle}>
                        {t('mascot.shop.decorations')}
                      </Text>
                      {ownedDecorations.map(({ id, cat }) => renderRow(id, cat))}
                    </>
                  )}
                </ScrollView>
              );
            })()}
          </View>
        </Modal>

        {/* Modal choix de graine — pageSheet */}
        <Modal
          visible={showSeedPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSeedPicker(false)}
        >
          <View style={[styles.seedSheetContainer, { backgroundColor: colors.bg }]}>
            <ModalHeader
              title={t('farm.seedPicker')}
              onClose={() => setShowSeedPicker(false)}
              closeLeft
            />
            <ScrollView
              style={styles.seedSheetScroll}
              contentContainerStyle={styles.seedSheetContent}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Graines normales (achetables) — affichées en premier ── */}
              <Text style={[styles.seedSectionTitle, { color: colors.textSub }]}>
                {t('farm.regularSeeds')}
              </Text>
              {CROP_CATALOG.filter(c => !c.dropOnly).map(crop => {
                const stageOrder = ['graine', 'pousse', 'arbuste', 'arbre', 'majestueux', 'legendaire'];
                const stageUnlocked = stageOrder.indexOf(stageInfo.stage) >= stageOrder.indexOf(crop.minTreeStage);
                const availableCrops = getAvailableCrops(stageInfo.stage, profile?.farmTech ?? []);
                const unlocked = stageUnlocked && availableCrops.some(c => c.id === crop.id);
                const stageName = t(`mascot.stages.${crop.minTreeStage}`);
                const isSeasonal = hasCropSeasonalBonus(crop.id);
                const effectiveTasksPerStage = Math.max(1, crop.tasksPerStage - (techBonuses?.tasksPerStageReduction ?? 0));
                const totalTasks = effectiveTasksPerStage * 4;
                const effectiveTasks = isSeasonal ? Math.ceil(totalTasks / 2) : totalTasks;
                const canAfford = (profile?.coins ?? 0) >= crop.cost;
                return (
                  <TouchableOpacity
                    key={crop.id}
                    onPress={unlocked && canAfford ? () => handleSeedSelect(crop.id) : undefined}
                    activeOpacity={unlocked && canAfford ? 0.7 : 1}
                    style={[
                      styles.seedRow,
                      { backgroundColor: colors.cardAlt, borderColor: isSeasonal ? '#F59E0B' : colors.borderLight },
                      isSeasonal && { borderWidth: 1.5 },
                      !unlocked && { opacity: 0.4 },
                    ]}
                  >
                    <Image source={CROP_ICONS[crop.id]} style={styles.seedRowSprite} />
                    {unlocked ? (
                      <View style={styles.seedRowInfo}>
                        <View style={styles.seedRowHeader}>
                          <Text style={[styles.seedRowName, { color: colors.text }]}>
                            {t(`farm.crop.${crop.id}`)}
                          </Text>
                          {isSeasonal && (
                            <View style={styles.seedSeasonBadge}>
                              <Text style={styles.seedSeasonBadgeText}>
                                {t('farm.inSeason')}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.seedRowDesc, { color: colors.textMuted }]} numberOfLines={2}>
                          {t(`farm.crop.${crop.id}_desc`)}
                        </Text>
                        <View style={styles.seedRowStats}>
                          <Text style={[styles.seedRowStat, { color: colors.textSub }]}>
                            {t('farm.taskCount', { count: effectiveTasks })}
                            {isSeasonal && (
                              <Text style={{ color: '#F59E0B', fontWeight: FontWeight.semibold }}>
                                {' '}({t('farm.seasonSpeed', { normal: totalTasks })})
                              </Text>
                            )}
                          </Text>
                          <Text style={[styles.seedRowStat, { color: colors.textSub }]}>
                            {crop.cost} 🍃 → {crop.harvestReward} 🍃
                          </Text>
                        </View>
                        {!canAfford && (
                          <Text style={[styles.seedRowWarn, { color: colors.error }]}>
                            {t('farm.notEnoughLeaves')}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={styles.seedRowInfo}>
                        <Text style={[styles.seedRowName, { color: colors.textMuted }]}>
                          {t(`farm.crop.${crop.id}`)}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: FontSize.caption }}>
                          🔒 {t('farm.unlocksAt', { stage: stageName })}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {/* ── Graines rares (possedees + decouverte) — affichées en dernier ── */}
              {(() => {
                const rareSeeds = profile?.farmRareSeeds ?? {};
                const allRare = CROP_CATALOG.filter(c => c.dropOnly);
                const ownedRare = allRare.filter(c => (rareSeeds[c.id] ?? 0) > 0);
                const lockedRare = allRare.filter(c => (rareSeeds[c.id] ?? 0) === 0);

                /** Construit le hint "drop depuis X" pour une graine */
                const getDropHint = (cropId: string): string => {
                  const rule = RARE_SEED_DROP_RULES.find(r =>
                    r.sourceCropIds === '*' || r.sourceCropIds.includes(cropId)
                  );
                  if (!rule) return t('farm.rareSeedDropHintAny');
                  if (rule.sourceCropIds === '*') return t('farm.rareSeedDropHintAny');
                  const sourceNames = (rule.sourceCropIds as string[])
                    .map(id => {
                      const def = CROP_CATALOG.find(c => c.id === id);
                      return def ? t(`farm.crop.${def.id}`) : id;
                    })
                    .join(', ');
                  const pct = Math.round(rule.chance * 100);
                  return t('farm.rareSeedDropHint', { sources: sourceNames, pct });
                };

                return (
                  <>
                    <View style={{ height: Spacing.md }} />
                    <Text style={[styles.seedSectionTitle, { color: primary }]}>
                      {t('farm.rareSeedsTitle')} ✨
                    </Text>
                    {/* Graines possedees — sélectionnables */}
                    {ownedRare.map(crop => {
                      const qty = rareSeeds[crop.id] ?? 0;
                      const effectiveTasksPerStage = Math.max(1, crop.tasksPerStage - (techBonuses?.tasksPerStageReduction ?? 0));
                      const totalTasks = effectiveTasksPerStage * 4;
                      return (
                        <TouchableOpacity
                          key={crop.id}
                          onPress={() => handleSeedSelect(crop.id)}
                          activeOpacity={0.7}
                          style={[
                            styles.seedRow,
                            { backgroundColor: colors.cardAlt, borderColor: primary, borderWidth: 1.5 },
                          ]}
                        >
                          <View>
                            <Image source={CROP_ICONS[crop.id]} style={styles.seedRowSprite} />
                            <View style={[styles.rareSeedBadge, { backgroundColor: primary }]}>
                              <Text style={styles.rareSeedBadgeText}>x{qty}</Text>
                            </View>
                          </View>
                          <View style={styles.seedRowInfo}>
                            <View style={styles.seedRowHeader}>
                              <Text style={[styles.seedRowName, { color: colors.text }]}>
                                {t(`farm.crop.${crop.id}`)}
                              </Text>
                              <View style={[styles.seedSeasonBadge, { backgroundColor: primary + '22' }]}>
                                <Text style={[styles.seedSeasonBadgeText, { color: primary }]}>
                                  {t('farm.rare')}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.seedRowDesc, { color: colors.textMuted }]} numberOfLines={2}>
                              {t(`farm.crop.${crop.id}_desc`)}
                            </Text>
                            <View style={styles.seedRowStats}>
                              <Text style={[styles.seedRowStat, { color: colors.textSub }]}>
                                {t('farm.taskCount', { count: totalTasks })}
                              </Text>
                              <Text style={[styles.seedRowStat, { color: colors.textSub }]}>
                                {t('farm.rareFree')} → {crop.harvestReward} 🍃
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {/* Graines non possedees — affichees en grise pour la decouverte */}
                    {lockedRare.map(crop => {
                      const effectiveTasksPerStage = Math.max(1, crop.tasksPerStage - (techBonuses?.tasksPerStageReduction ?? 0));
                      const totalTasks = effectiveTasksPerStage * 4;
                      const isExpeditionOnly = crop.expeditionExclusive === true;
                      return (
                        <View
                          key={crop.id}
                          style={[
                            styles.seedRow,
                            { backgroundColor: colors.cardAlt, borderColor: isExpeditionOnly ? 'rgba(59,130,246,0.4)' : colors.borderLight, opacity: isExpeditionOnly ? 0.75 : 0.5 },
                          ]}
                        >
                          <View>
                            <Image source={CROP_ICONS[crop.id]} style={styles.seedRowSprite} />
                            <View style={[styles.rareSeedBadge, { backgroundColor: isExpeditionOnly ? 'rgba(59,130,246,0.7)' : colors.textMuted }]}>
                              <Text style={styles.rareSeedBadgeText}>{isExpeditionOnly ? '🗺️' : '?'}</Text>
                            </View>
                          </View>
                          <View style={styles.seedRowInfo}>
                            <View style={styles.seedRowHeader}>
                              <Text style={[styles.seedRowName, { color: colors.text }]}>
                                {t(`farm.crop.${crop.id}`)}
                              </Text>
                              {isExpeditionOnly ? (
                                <View style={[styles.seedSeasonBadge, { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)', borderWidth: 1 }]}>
                                  <Text style={[styles.seedSeasonBadgeText, { color: '#2563EB' }]}>
                                    {t('mascot.shop.expedition')}
                                  </Text>
                                </View>
                              ) : (
                                <View style={[styles.seedSeasonBadge, { backgroundColor: colors.borderLight }]}>
                                  <Text style={[styles.seedSeasonBadgeText, { color: colors.textMuted }]}>
                                    {t('farm.rare')}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.seedRowDesc, { color: isExpeditionOnly ? '#2563EB' : colors.textMuted }]} numberOfLines={2}>
                              {isExpeditionOnly ? t('mascot.shop.expeditionOnly') : getDropHint(crop.id)}
                            </Text>
                            <View style={styles.seedRowStats}>
                              <Text style={[styles.seedRowStat, { color: colors.textSub }]}>
                                {t('farm.taskCount', { count: totalTasks })}
                              </Text>
                              <Text style={[styles.seedRowStat, { color: colors.textSub }]}>
                                {t('farm.rareFree')} → {crop.harvestReward} 🍃
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </>
                );
              })()}
              <View style={{ height: Spacing['3xl'] }} />
            </ScrollView>
          </View>
        </Modal>

        {/* Phase 40 — pageSheet secondaire sceller Sporée (empilé après seed picker) */}
        <WagerSealerSheet
          visible={showWagerSealer}
          onClose={handleWagerSealerClose}
          onConfirmSeal={handleWagerSealConfirm}
          onConfirmSkip={handleWagerSealSkip}
          onCancel={handleWagerSealCancel}
          cropId={pendingPlant?.cropId ?? ''}
          tasksPerStage={pendingPlant?.tasksPerStage ?? 1}
          sealerProfileId={profile?.id ?? ''}
          allProfiles={profiles}
          allTasks={tasks}
          sporeeCount={profile?.sporeeCount ?? 0}
          gamiHistory={gamiData?.history}
        />

        {/* Arbre principal — diorama saisonnier immersif (full-bleed) */}
        <Animated.View entering={FadeIn.duration(600)}>
        <Animated.View style={[styles.treeContainer, fadeStyle]}>
          <View
            style={[
              styles.treeBg,
              {
                height: DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60,
                /* Marge négative pour compenser le paddingHorizontal du scroll */
                marginHorizontal: -Spacing['2xl'],
              },
            ]}
          >
            {/* Conteneur clippé pour le terrain (empêche l'image de déborder) */}
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }]}>
              {/* Couche 0 : Fond herbe — tile foncée du tileset repetee */}
              <Image
                source={GRASS_TILE_IMAGE}
                style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
                resizeMode="repeat"
              />
              {/* Couche 1 : Tilemap Wang — transitions terrain */}
              <TileMapRenderer
                treeStage={stageInfo.stage}
                containerWidth={SCREEN_W}
                containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                season={season}
              />
            </View>

            {/* Couche 2 : Décorations sol désactivées — le terrain tileset les remplace */}

            {/* Couche 3 : Grille monde (cultures + batiments) */}
            <WorldGridView
              treeStage={stageInfo.stage}
              farmCropsCSV={profile.farmCrops ?? ''}
              ownedBuildings={profile.farmBuildings ?? []}
              containerWidth={SCREEN_W}
              containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
              techBonuses={techBonuses}
              wearEffects={profile ? getWearEffects(profile.id) : undefined}
              onCropPlotPress={isOwnTree ? handleCropCellPress : undefined}
              onBuildingCellPress={isOwnTree ? handleBuildingCellPress : undefined}
              onRepairWeed={isOwnTree ? handleRepairWeed : undefined}
              onRepairPest={isOwnTree ? handleRepairPest : undefined}
              onRepairFence={isOwnTree ? handleRepairFence : undefined}
              plotLevels={profile?.plotLevels}
              onPlotLongPress={isOwnTree ? (idx: number) => setPlotUpgradeIndex(idx) : undefined}
              playerCoins={profile?.coins ?? 0}
              paused={activeFarmTutorialStep !== null || animationsPaused}
            />

            {/* Phase 18-04 : anchors invisibles calqués sur les coordonnées exactes
                des cellules CROP_CELLS (lib/mascot/world-grid.ts).
                Cellule c2 (1ère débloquée — unlockOrder 1) : centre (0.42 * W, 0.05 * H)
                Cellule c7 (2ème débloquée — unlockOrder 2) : centre (0.42 * W, 0.14 * H)
                Formule WorldGridView : left = cell.x * W - size/2, top = cell.y * H - size/2
                Rendus systématiquement : graine et pousse ont désormais tous deux 3 crops. */}
            {(() => {
              const dioramaH = DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60;
              const ANCHOR_SIZE = 80;
              return (
                <>
                  <View
                    ref={plantationRef}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0.42 * SCREEN_W - ANCHOR_SIZE / 2,
                      top: 0.05 * dioramaH - ANCHOR_SIZE / 2,
                      width: ANCHOR_SIZE,
                      height: ANCHOR_SIZE,
                    }}
                  />
                  <View
                    ref={harvestRef}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0.42 * SCREEN_W - ANCHOR_SIZE / 2,
                      top: 0.14 * dioramaH - ANCHOR_SIZE / 2,
                      width: ANCHOR_SIZE,
                      height: ANCHOR_SIZE,
                    }}
                  />
                </>
              );
            })()}

            {/* Couche 3.5 : Compagnon mascotte — se balade sur toute la scène */}
            {companion && (
              <View style={{ ...StyleSheet.absoluteFillObject, zIndex: companionMessage ? 20 : 3 }} pointerEvents="box-none">
                <CompanionSlot
                  species={companion.activeSpecies}
                  stage={companionStage ?? 'bebe'}
                  mood={companionMood ?? 'content'}
                  name={companion.name}
                  message={companionMessage}
                  onTap={handleCompanionTap}
                  containerWidth={SCREEN_W}
                  containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                  harvestables={harvestables}
                  plantedCropYs={plantedCropYs}
                  builtBuildingYs={builtBuildingYs}
                  hasLake={stageIdx >= 1}
                  paused={animationsPaused}
                />
              </View>
            )}

            {/* Couche 3.6 : Visiteur saga — apparaît quand un chapitre est disponible */}
            {sagaChapterAvailable && isOwnTree && sagaProgress && (
              <View
                style={{ ...StyleSheet.absoluteFillObject, zIndex: showSagaEvent ? 20 : 3 }}
                pointerEvents={showEventDialogue ? 'none' : 'box-none'}
              >
                <VisitorSlot
                  visible={sagaChapterAvailable && !showSagaEvent}
                  sagaId={sagaProgress.sagaId}
                  containerWidth={SCREEN_W}
                  containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                  onTap={() => {
                    hapticsTreeTap();
                    setShowSagaEvent(true);
                  }}
                  shouldDepart={visitorShouldDepart}
                  isLastChapter={activeSaga ? sagaProgress.currentChapter >= activeSaga.chapters.length : false}
                  onDepartComplete={() => setVisitorShouldDepart(false)}
                  reactionType={visitorReaction}
                  onReactionComplete={() => {
                    setVisitorReaction(undefined);
                    setVisitorShouldDepart(true);
                  }}
                />
              </View>
            )}

            {/* Couche 3.7 : Visiteur événement saisonnier — côté gauche du diorama */}
            {activeEventId && activeEventContent && isOwnTree && (
              <View
                style={{ ...StyleSheet.absoluteFillObject, zIndex: showEventDialogue ? 20 : 3 }}
                pointerEvents={showSagaEvent ? 'none' : 'box-none'}
              >
                <VisitorSlot
                  visible={!!activeEventId && !showEventDialogue}
                  sagaId={activeEventId}
                  containerWidth={SCREEN_W}
                  containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                  targetFX={0.28}
                  targetFY={0.62}
                  onTap={() => {
                    hapticsTreeTap();
                    setShowEventDialogue(true);
                  }}
                  shouldDepart={eventVisitorShouldDepart}
                  isLastChapter={true}
                  onDepartComplete={() => setEventVisitorShouldDepart(false)}
                  reactionType={eventVisitorReaction}
                  onReactionComplete={() => setEventVisitorReaction(undefined)}
                />
              </View>
            )}

            {/* Couche saisonnières : particules emoji selon la saison */}
            <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 4 }} pointerEvents="none">
              <SeasonalParticles
                season={season}
                containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                paused={animationsPaused}
              />
            </View>

            {/* Couche ambiance : particules horaires + tint */}
            <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 5 }} pointerEvents="none">
              <AmbientParticles containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60} paused={animationsPaused} />
            </View>

            {/* Tooltip info culture */}
            {tooltipInfo && (
              <CropTooltip
                tooltipInfo={tooltipInfo}
                stageInfo={stageInfo}
                stageIdx={stageIdx}
                techBonuses={techBonuses}
                plotLevels={profile?.plotLevels}
                growthSprintActive={!!(profile?.growthSprintUntil && new Date(profile.growthSprintUntil) > new Date())}
                mainPlotIndex={getMainPlotIndex(parseCrops(profile?.farmCrops ?? ''))}
              />
            )}

            {/* Couche 4 : Arbre pixel au premier plan */}
            <View style={styles.treeOverlay} pointerEvents="box-none">
              <TreeView
                species={species}
                level={level}
                size={TREE_SIZE}
                interactive
                showGround
                decorations={allDecoIds}
                inhabitants={allHabIds}
                placements={profile.mascotPlacements ?? {}}
                placingItem={placingItem}
                onSlotSelect={handleSlotSelect}
                companion={companion}
                companionStage={companionStage}
                companionMood={companionMood}
                companionMessage={companionMessage}
                onCompanionTap={handleCompanionTap}
                paused={animationsPaused}
              />
            </View>

            {/* Couche 4.5 : Items places + slots de placement (niveau diorama) */}
            {profile && Object.keys(profile.mascotPlacements ?? {}).length > 0 && !placingItem && (
              <View style={[StyleSheet.absoluteFill, { zIndex: 8 }]} pointerEvents="none">
                <NativePlacedItems
                  placements={profile.mascotPlacements ?? {}}
                  containerWidth={SCREEN_W}
                  containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                />
              </View>
            )}
            {placingItem && (
              <View style={[StyleSheet.absoluteFill, { zIndex: 12 }]} pointerEvents="box-none">
                <NativePlacementSlots
                  placements={profile?.mascotPlacements ?? {}}
                  placingItemId={placingItem}
                  containerWidth={SCREEN_W}
                  containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                  onSelect={handleSlotSelect}
                />
              </View>
            )}

            {/* Couche 5 : Expérience immersive saga (absolute overlay, zIndex 15) */}
            {showSagaEvent && sagaProgress && profile && (
              <SagaWorldEvent
                sagaProgress={sagaProgress}
                containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                onChapterComplete={handleSagaChapterComplete}
                onDismiss={handleSagaDismiss}
                visitorIdleFrame={VISITOR_IDLE_FRAMES[sagaProgress?.sagaId ?? ''] ?? DEFAULT_VISITOR_IDLE}
                onChoiceReaction={handleChoiceReaction}
              />
            )}

            {/* Couche 5.1 : Dialogue événement saisonnier (absolute overlay, zIndex 15) */}
            {showEventDialogue && activeEventContent && profile && (() => {
              const { saga, progress } = buildSeasonalEventAsSaga(activeEventContent, profile.id);
              return (
                <SagaWorldEvent
                  sagaProgress={progress}
                  containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
                  overrideSaga={saga}
                  onChapterComplete={handleEventComplete}
                  onDismiss={() => setShowEventDialogue(false)}
                  visitorIdleFrame={SEASONAL_VISITOR_IDLE[activeEventContent.eventId] ?? DEFAULT_VISITOR_IDLE}
                  onChoiceReaction={(reaction) => setEventVisitorReaction(reaction)}
                />
              );
            })()}

            {/* Bouton saga supprimé — le tap sur le VisitorSlot dans la couche 3.6 le remplace */}

            {/* Couche 6 : Hint one-shot ferme */}
            {showFarmHint && (
              <FarmHintBanner onDismiss={() => markScreenSeen('farm')} />
            )}

            {/* Couche 7 : Portail village — sur le chemin, à côté des cannes à pêche */}
            <PortalSprite
              onPress={handlePortalPress}
              x={0.42 * SCREEN_W}
              y={0.70 * (DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60)}
              badgeCount={villagePendingCount}
            />

            {/* Couche 8 : Camp d'exploration (Phase 33) */}
            {(() => {
              const dioH = DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60;
              const remainingMinutes = activeExpeditions
                .filter(e => e.result === undefined && !isExpeditionComplete(e))
                .map(e => getExpeditionRemainingMinutes(e));
              return (
                <View
                  style={{
                    position: 'absolute',
                    left: CAMP_EXPLORATION_CELL.x * SCREEN_W - 32,
                    top: CAMP_EXPLORATION_CELL.y * dioH - 32,
                    zIndex: 6,
                  }}
                  pointerEvents="box-none"
                >
                  <CampExplorationCell
                    activeCount={activeCount}
                    hasResult={pendingResults.length > 0}
                    remainingMinutes={remainingMinutes}
                    onPress={() => setShowExpeditions(true)}
                  />
                </View>
              );
            })()}

          </View>
        </Animated.View>
        </Animated.View>

        {/* Carte 1 — Actions (panneau cozy "signpost") */}
        {isOwnTree && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: -22, zIndex: 10, position: 'relative' }}>
          <View style={styles.signpost}>
            {/* 4 actions primaires — boutons bois 3D */}
            <View style={styles.signpostBody}>
              <TouchableOpacity style={styles.btn3dWood} onPress={() => { Haptics.selectionAsync(); setShowShop(true); }} activeOpacity={0.8}>
                <Image source={ACTION_SPRITES.echoppe} style={styles.btn3dSprite} />
                <Text style={styles.btn3dLabel}>{t('mascot.shop.shortTitle', 'Échoppe')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn3dWood} onPress={() => { Haptics.selectionAsync(); setShowCraftSheet(true); }} activeOpacity={0.8}>
                <Image source={ACTION_SPRITES.atelier} style={styles.btn3dSprite} />
                <Text style={styles.btn3dLabel}>{t('craft.atelier')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn3dWood} onPress={() => { Haptics.selectionAsync(); setShowTechTree(true); }} activeOpacity={0.8}>
                <Image source={ACTION_SPRITES.savoirs} style={styles.btn3dSprite} />
                <Text style={styles.btn3dLabel}>{t('mascot.actions.savoirs', 'Savoirs')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn3dWood, (allDecoIds.length + allHabIds.length) === 0 && { opacity: 0.5 }]}
                onPress={() => {
                  if ((allDecoIds.length + allHabIds.length) === 0 || placingItem) return;
                  Haptics.selectionAsync();
                  setShowItemPicker(true);
                }}
                activeOpacity={0.8}
                disabled={(allDecoIds.length + allHabIds.length) === 0 || !!placingItem}
              >
                <Image source={ACTION_SPRITES.embellir} style={styles.btn3dSprite} />
                <Text style={styles.btn3dLabel}>{t('mascot.actions.embellir', 'Embellir')}</Text>
              </TouchableOpacity>
            </View>

            {/* Rangée secondaire — chips parchemin foncé */}
            <View style={styles.signpostMore}>
              <TouchableOpacity style={styles.chipCozy} onPress={() => { Haptics.selectionAsync(); setShowBadges(true); }} activeOpacity={0.7}>
                <Image source={ACTION_SPRITES.trophees} style={styles.chipCozySprite} />
                <Text style={styles.chipCozyLabel}>{t('mascot.actions.trophees', 'Trophées')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chipCozy} onPress={() => { Haptics.selectionAsync(); setShowMuseum(true); }} activeOpacity={0.7}>
                <Image source={ACTION_SPRITES.galerie} style={styles.chipCozySprite} />
                <Text style={styles.chipCozyLabel}>{t('mascot.actions.galerie', 'Galerie')}</Text>
              </TouchableOpacity>
              {companion && (
                <TouchableOpacity style={[styles.chipCozy, styles.chipCozyCompanion]} onPress={() => { Haptics.selectionAsync(); setShowCompanionPicker(true); }} activeOpacity={0.7}>
                  <Text style={styles.chipCozyEmoji}>{'🐾'}</Text>
                  <Text style={styles.chipCozyLabel}>{companion.name}</Text>
                </TouchableOpacity>
              )}
              {__DEV__ && (
                <TouchableOpacity
                  style={styles.chipCozy}
                  onPress={() => {
                    const toasts: Array<() => void> = [
                      () => showToast('Tâche validée !', 'success'),
                      () => showToast('Récolte terminée !', 'success', undefined, { icon: '🌾', subtitle: '+40 🍂' }),
                      () => showToast('Croissance rapide activée', 'info', undefined, { icon: '⚡', subtitle: 'Toutes les cultures' }),
                      () => showToast('Erreur de sauvegarde', 'error'),
                      () => showToast('Nouvelle graine rare trouvée !', 'success', undefined, { icon: '🌟', subtitle: 'Carotte dorée débloquée' }),
                      () => showToast('Action annulée', 'info', { label: 'Rétablir', onPress: () => {} }),
                    ];
                    toasts[Math.floor(Math.random() * toasts.length)]();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipCozyEmoji}>{'🔔'}</Text>
                  <Text style={styles.chipCozyLabel}>{'Toast'}</Text>
                </TouchableOpacity>
              )}
              {__DEV__ && (
                <TouchableOpacity style={styles.chipCozy} onPress={() => setShowDevEffects(true)} activeOpacity={0.7}>
                  <Text style={styles.chipCozyEmoji}>{'⚡'}</Text>
                  <Text style={styles.chipCozyLabel}>{'Effets'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
        )}

        {/* Carte 2 — Progression (hero doré) */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={isOwnTree ? { marginTop: Spacing.sm } : { marginTop: -22, zIndex: 10, position: 'relative' }}>
          <View style={styles.heroGoldOuter}>
            <View style={styles.heroGoldInner}>
              <Text style={styles.heroGoldSprite}>{STAGE_EMOJI[stageInfo.stage]}</Text>
              <View style={styles.heroGoldInfo}>
                <View style={styles.heroGoldTop}>
                  <Text style={styles.heroGoldStage} numberOfLines={1}>
                    {t(stageInfo.labelKey)}
                  </Text>
                  <View style={styles.heroGoldLevelPill}>
                    <Text style={styles.heroGoldLevelText}>
                      {t('mascot.screen.level')} {level}
                    </Text>
                  </View>
                </View>
                <View style={styles.heroGoldBar}>
                  <View style={[styles.heroGoldBarFill, { width: `${Math.round(xpPercent * 100)}%` }]} />
                </View>
                <View style={styles.heroGoldMeta}>
                  <Text style={styles.heroGoldMetaText}>
                    {xpInLevel} / {xpNeeded} XP
                  </Text>
                  {nextEvoLevel !== null ? (
                    <Text style={styles.heroGoldMetaText} numberOfLines={1}>
                      → {t(TREE_STAGES[stageIdx + 1]?.labelKey || stageInfo.labelKey)} · {levelsLeft} niv.
                    </Text>
                  ) : (
                    <Text style={[styles.heroGoldMetaText, { color: Farm.goldText, fontWeight: FontWeight.bold }]}>
                      {t('mascot.screen.maxStage')}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Quête coopérative familiale */}
        {activeQuest ? (
          <FamilyQuestBanner
            quest={activeQuest}
            profiles={profiles}
            colors={colors}
            primary={primary}
            t={t}
            onPress={() => setShowQuestDetail(true)}
          />
        ) : canStartQuest ? (
          <TouchableOpacity
            onPress={() => setShowQuestPicker(true)}
            style={{ padding: Spacing.sm, alignItems: 'center' }}
          >
            <Text style={{ color: primary, fontSize: 14 }}>
              + Nouvelle quête familiale
            </Text>
          </TouchableOpacity>
        ) : null}


        <View style={{ height: 100 }} />
      </ScrollView>

      {/* HUD ferme — flottant par-dessus le diorama */}
      <View style={[
        styles.farmHud,
        {
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)',
        },
      ]}>
        <View style={styles.hudContent}>
          {/* Phase 18-04 : ref cible tutoriel étape 4 (XP/loot) */}
          <View ref={hudXpRef} style={styles.hudItem}>
            <Text style={styles.hudEmoji}>{'🍃'}</Text>
            <Text style={[styles.hudValue, { color: colors.text }]}>{profile.coins ?? 0}</Text>
          </View>
          <View style={styles.hudItem}>
            <Text style={styles.hudEmoji}>{'🔥'}</Text>
            <Text style={[styles.hudValue, { color: colors.text }]}>{profile.streak ?? 0}</Text>
          </View>
          <View style={styles.hudItem}>
            <Text style={styles.hudEmoji}>{'🌿'}</Text>
            <Text style={[styles.hudValue, { color: colors.text }]}>{growingCount}</Text>
          </View>
          <View style={styles.hudItem}>
            <Text style={styles.hudEmoji}>{seasonInfo.emoji}</Text>
            <Text style={[styles.hudValue, { color: colors.text }]}>{t(seasonInfo.labelKey)}</Text>
          </View>
          {/* 5e item HUD : bouton codex ferme (Phase 17, D-12/D-13) */}
          <TouchableOpacity
            style={styles.hudItem}
            onPress={() => { Haptics.selectionAsync(); setShowCodex(true); }}
            accessibilityLabel={t('codex:modal.title')}
          >
            <Text style={styles.hudEmoji}>{'📖'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal sélecteur d'espèce */}
      <Modal
        visible={showSpeciesPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSpeciesPicker(false)}
      >
        <SpeciesPicker
          currentSpecies={species}
          level={level}
          onSelect={handleSpeciesSelect}
          onClose={() => setShowSpeciesPicker(false)}
        />
      </Modal>

      {/* Modal boutique */}
      <Modal
        visible={showShop}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShop(false)}
      >
        <TreeShop
          species={species}
          level={level}
          coins={profile.coins ?? profile.points ?? 0}
          ownedDecorations={allDecoIds}
          ownedInhabitants={allHabIds}
          ownedBuildings={(profile.farmBuildings ?? []).map((b: any) => (typeof b === 'string' ? b : b.buildingId))}
          onBuy={handleShopBuy}
          onBuyBuilding={undefined}
          onBuySporee={async () => {
            try {
              await buySporee(profile.id);
              showToast('🍄 Sporée acquise !');
            } catch (e: any) {
              const msg = String(e?.message ?? '');
              if (msg.includes('insufficient_stage')) showToast('Stade arbuste requis', 'error');
              else if (msg.includes('insufficient_coins')) showToast('Feuilles insuffisantes', 'error');
              else if (msg.includes('daily_cap')) showToast('Cap quotidien atteint', 'error');
              else if (msg.includes('inventory_full')) showToast('Inventaire Sporée plein', 'error');
              else showToast('Achat impossible', 'error');
              throw e;
            }
          }}
          sporeeCount={profile.sporeeCount ?? 0}
          sporeeShopBoughtToday={profile.sporeeShopBoughtToday ?? 0}
          sporeeShopLastResetDate={profile.sporeeShopLastResetDate}
          onClose={() => setShowShop(false)}
        />
      </Modal>

      {/* Atelier craft */}
      <CraftSheet
        visible={showCraftSheet}
        onClose={() => setShowCraftSheet(false)}
        profileId={profile?.id ?? ''}
        coins={profile?.coins ?? 0}
        harvestInventory={profile?.harvestInventory ?? {}}
        farmInventory={profile?.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 }}
        craftedItems={profile?.craftedItems ?? []}
        treeStage={stageInfo.stage}
        unlockedRecipes={unlockedRecipes}
        onCraft={async (recipeId, qty) => {
          const result = await craft(profile!.id, recipeId, qty);
          if (result && result.length > 0) triggerActionMsg('craft');
          return result;
        }}
        onSellHarvest={(cropId, qty) => sellHarvest(profile!.id, cropId, qty)}
        onSellCrafted={(recipeId, qty) => sellCrafted(profile!.id, recipeId, qty)}
        onOfferItem={(itemType, itemId, maxQty, itemName) => {
          setShowCraftSheet(false);
          setGiftOffer({ itemType, itemId, maxQty, itemName });
        }}
        giftHistory={profile?.giftHistory}
      />

      {/* Codex ferme (Phase 17) — cast vers DiscoverySource (shape minimale) */}
      <FarmCodexModal
        visible={showCodex}
        onClose={() => setShowCodex(false)}
        profile={(profile ?? null) as any}
      />

      {/* Offrir un cadeau — GiftSenderSheet */}
      <GiftSenderSheet
        visible={!!giftOffer}
        onClose={() => setGiftOffer(null)}
        itemType={(giftOffer?.itemType ?? 'harvest') as 'harvest' | 'rare_seed' | 'crafted' | 'building_resource'}
        itemId={giftOffer?.itemId ?? ''}
        itemName={giftOffer?.itemName ?? ''}
        maxQuantity={giftOffer?.maxQty ?? 1}
        profiles={profiles.filter((p: Profile) => p.id !== activeProfile?.id)}
        onSend={async (recipientId, qty) => {
          const recipient = profiles.find((p: Profile) => p.id === recipientId);
          const result = await sendGift(
            activeProfile!.id,
            recipientId,
            recipient?.name ?? '',
            (giftOffer?.itemType ?? 'harvest') as 'harvest' | 'rare_seed' | 'crafted' | 'building_resource',
            giftOffer?.itemId ?? '',
            qty,
          );
          if (result.success) setGiftOffer(null);
          return result;
        }}
      />

      {/* Reception cadeau — GiftReceiptModal */}
      <GiftReceiptModal
        visible={pendingGiftsToShow.length > 0}
        gifts={pendingGiftsToShow}
        onDone={() => setPendingGiftsToShow([])}
      />

      {/* Tech tree progression */}
      <TechTreeSheet
        visible={showTechTree}
        onClose={() => setShowTechTree(false)}
        profileId={profile?.id ?? ''}
        unlockedTechs={profile?.farmTech ?? []}
        coins={profile?.coins ?? 0}
        onUnlock={(techId) => unlockTech(profile!.id, techId)}
        onMessage={(text, type) => showToast(text, type)}
      />

      {/* Bottom sheet amélioration parcelle */}
      {plotUpgradeIndex !== null && (
        <PlotUpgradeSheet
          visible={true}
          onClose={() => setPlotUpgradeIndex(null)}
          plotIndex={plotUpgradeIndex}
          plotLevels={profile?.plotLevels}
          coins={profile?.coins ?? 0}
          onUpgrade={(idx) => upgradePlotAction(profile!.id, idx)}
          onMessage={(text, type) => showToast(text, type)}
        />
      )}

      {/* Bottom sheet construction batiment */}
      <BuildingShopSheet
        visible={showBuildingShop}
        cellId={selectedBuildingCellId ?? ''}
        treeStage={stageInfo.stage}
        coins={profile.coins ?? 0}
        ownedBuildings={profile.farmBuildings ?? []}
        unlockedTechs={profile.farmTech ?? []}
        onBuild={handleBuildBuilding}
        onClose={() => setShowBuildingShop(false)}
      />

      {/* Bottom sheet detail batiment */}
      {selectedBuilding && (
        <BuildingDetailSheet
          visible={showBuildingDetail}
          building={selectedBuilding}
          coins={profile.coins ?? 0}
          techBonuses={techBonuses}
          isDamaged={selectedBuildingCellId ? (getWearEffects(profile.id).damagedBuildings.includes(selectedBuildingCellId)) : false}
          onCollect={handleCollectBuilding}
          onUpgrade={handleUpgradeBuilding}
          onRepairRoof={handleRepairRoof}
          onClose={() => { setShowBuildingDetail(false); setSelectedBuilding(null); }}
        />
      )}

      {/* Badges */}
      <BadgesSheet
        visible={showBadges}
        onClose={() => setShowBadges(false)}
        profile={profile}
        gamiData={gamiData ?? { profiles: [], history: [], activeRewards: [] }}
      />

      {/* Musée des effets (Phase 23) */}
      <MuseumModal
        visible={showMuseum}
        onClose={() => setShowMuseum(false)}
        profileId={activeProfile?.id ?? null}
        vault={vault}
      />

      {/* Modal compagnon — choix initial ou switch */}
      <CompanionPicker
        visible={showCompanionPicker}
        onClose={() => setShowCompanionPicker(false)}
        onSelect={handleCompanionSelect}
        unlockedSpecies={companion?.unlockedSpecies ?? []}
        isInitialChoice={!companion}
      />

      {/* Rapport du matin */}
      <SunriseReport
        visible={sunriseData !== null}
        profileName={profile.name}
        resources={sunriseData?.resources ?? []}
        totalCollected={sunriseData?.totalCollected ?? 0}
        yesterdayTasks={sunriseData?.yesterdayTasks ?? 0}
        hasBonus={sunriseData?.hasBonus ?? false}
        onDismiss={() => setSunriseData(null)}
      />
      <HarvestEventOverlay
        event={harvestEvent}
        onDismiss={() => setHarvestEvent(null)}
      />
      <SeedDropOverlay
        seedDrop={seedDropEvent}
        onDismiss={() => setSeedDropEvent(null)}
      />

      {/* Quêtes coopératives — détail + picker */}
      {activeQuest && (
        <FamilyQuestDetailSheet
          quest={activeQuest}
          profiles={profiles}
          colors={colors}
          primary={primary}
          t={t}
          visible={showQuestDetail}
          onClose={() => setShowQuestDetail(false)}
          onComplete={handleCompleteQuest}
          onDelete={handleDeleteQuest}
        />
      )}
      <FamilyQuestPickerSheet
        visible={showQuestPicker}
        onClose={() => setShowQuestPicker(false)}
        onSelect={handleCreateQuest}
        colors={colors}
        primary={primary}
        t={t}
      />

      {/* Expéditions — modal catalogue (Phase 33) */}
      <ExpeditionsSheet
        visible={showExpeditions}
        onClose={() => setShowExpeditions(false)}
        dailyPool={dailyPool}
        activeExpeditions={activeExpeditions}
        completedExpeditions={completedExpeditions}
        pendingResults={pendingResults}
        canLaunch={canLaunch}
        pityCount={pityCount}
        harvestInventory={expeditionHarvestInventory}
        onLaunch={launchExpedition}
        onCollect={handleCollectExpedition}
        onDismiss={dismissExpedition}
      />

      {/* Expéditions — coffre animé résultat (Phase 33) */}
      <ExpeditionChest
        visible={chestData.visible}
        outcome={chestData.outcome}
        loot={chestData.loot}
        missionName={chestData.missionName}
        onClose={handleCloseChest}
      />

      {/* Phase 18-04 : tutoriel ferme — overlay au-dessus du HUD, refs cibles pour étapes 2-4 */}
      <FarmTutorialOverlay profile={profile} targetRefs={farmTutorialTargetRefs} />

      {/* DEV ONLY — Modal test des 10 effets sémantiques Phase 21 */}
      {__DEV__ && showDevEffects && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDevEffects(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{'DEV — Test Effets Sémantiques'}</Text>
              <TouchableOpacity onPress={() => setShowDevEffects(false)}>
                <Text style={{ fontSize: 16, color: primary }}>{'Fermer'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(Object.keys(EFFECT_TOASTS) as CategoryId[]).map((catId) => {
                const def = EFFECT_TOASTS[catId];
                const variant = CATEGORY_VARIANT[catId];
                return (
                  <TouchableOpacity
                    key={catId}
                    onPress={() => triggerDevEffect(catId)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: 14,
                      marginBottom: 8, borderRadius: 12, backgroundColor: colors.card,
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{def.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{catId.replace(/_/g, ' ')}</Text>
                      <Text style={{ fontSize: 13, color: colors.textSub }}>{def.fr}</Text>
                    </View>
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                      backgroundColor: variant === 'golden' ? '#FFD70033' : variant === 'rare' ? '#A78BFA33' : '#34D39933',
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: variant === 'golden' ? '#FFD700' : variant === 'rare' ? '#A78BFA' : '#34D399' }}>
                        {variant}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  seasonBadge: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  seasonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  treeContainer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  treeBg: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-end',
    // overflow visible pour que les tooltips/bulles companion ne soient pas clippés
    overflow: 'visible',
    // Coins arrondis bas — mockup C
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    // Ombre portée visible sous le diorama
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  farmHud: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  hudContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  hudEmoji: {
    fontSize: 14,
  },
  hudValue: {
    fontSize: FontSize.sm,
    fontWeight: '600' as const,
  },
  illustrationClip: {
    // Occupe les 70% supérieurs du conteneur — on ne montre que le ciel/horizon
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '70%',
    overflow: 'hidden',
  },
  seasonIllustration: {
    width: '100%',
    height: '155%', // surdimensionné pour que resizeMode="cover" recadre le haut de l'image
    opacity: 0.80,
  },
  illustrationFade: {
    // Gradient de fondu entre l'illustration (en haut) et le sol SVG (en bas)
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    height: '40%',
  },
  treeOverlay: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    marginLeft: '30%',
  },
  // ── Cozy action panel (signpost) ──────────────────────────────────────────
  signpost: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Farm.parchment,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    shadowColor: Farm.woodDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  signpostBody: {
    flexDirection: 'row',
    padding: 10,
    gap: 6,
  },
  signpostMore: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Farm.parchmentDark,
    borderTopWidth: 1,
    borderTopColor: Farm.woodHighlight,
    borderStyle: 'dashed',
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  btn3dWood: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Farm.woodBtnShadow,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 3,
    backgroundColor: Farm.woodBtn,
    shadowColor: Farm.woodBtnShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 0,
    elevation: 2,
  },
  btn3dSprite: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  btn3dLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  chipCozy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Farm.parchment,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    shadowColor: Farm.woodLight,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 0,
    elevation: 1,
  },
  chipCozyCompanion: {
    backgroundColor: '#FED7AA',
    borderColor: Farm.orangeShadow,
  },
  chipCozySprite: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  chipCozyEmoji: {
    fontSize: 14,
  },
  chipCozyLabel: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  // ── Hero doré (progression) ───────────────────────────────────────────────
  heroGoldOuter: {
    borderRadius: 16,
    padding: 2,
    backgroundColor: Farm.gold,
    marginBottom: Spacing['2xl'],
    shadowColor: Farm.woodBtnShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  heroGoldInner: {
    backgroundColor: Farm.parchment,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroGoldSprite: {
    fontSize: 40,
  },
  heroGoldInfo: {
    flex: 1,
    minWidth: 0,
  },
  heroGoldTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  heroGoldStage: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  heroGoldLevelPill: {
    backgroundColor: Farm.orange,
    borderWidth: 1,
    borderColor: Farm.orangeShadow,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  heroGoldLevelText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  heroGoldBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Farm.progressBg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Farm.woodLight,
  },
  heroGoldBarFill: {
    height: '100%',
    backgroundColor: Farm.progressGold,
  },
  heroGoldMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  heroGoldMetaText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Farm.brownTextSub,
    flexShrink: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  profileAvatar: {
    fontSize: FontSize.icon,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  tierLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.xxs,
  },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  speciesInfo: {
    flex: 1,
  },
  speciesLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  stageLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.xxs,
  },
  stageDesc: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xxs,
  },
  changeSpeciesBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  changeSpeciesText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  familyTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  stagesScroll: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  stageSlot: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 100,
  },
  stageSlotName: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  stageSlotLevels: {
    fontSize: FontSize.micro,
    marginTop: Spacing.xxs,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.xs,
  },
  placementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: Spacing.md,
  },
  placementBannerText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  placementCancelBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placementCancelText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  // ── Modal Embellir (picker cozy) ─────────────────────────────────────────
  cozyContainer: {
    flex: 1,
    backgroundColor: Farm.parchment,
  },
  cozyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    backgroundColor: Farm.parchmentDark,
    borderBottomWidth: 2,
    borderBottomColor: Farm.woodHighlight,
  },
  cozyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  cozyHeaderSprite: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  cozyHeaderTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    flexShrink: 1,
  },
  cozyHeaderClose: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  // Auvent
  cozyAwning: {
    height: 36,
    overflow: 'hidden',
  },
  cozyAwningStripes: {
    flexDirection: 'row',
    height: 28,
  },
  cozyAwningStripe: {
    flex: 1,
  },
  cozyAwningShadow: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  cozyAwningScallop: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
  },
  cozyAwningScallopDot: {
    flex: 1,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  // Scroll
  cozyScroll: {
    flex: 1,
  },
  cozyScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.sm,
  },
  cozySectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  // Rows
  cozyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchment,
    gap: Spacing.md,
    shadowColor: Farm.woodLight,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 0,
    elevation: 1,
  },
  cozyRowPlaced: {
    borderColor: Farm.greenBtnShadow,
    backgroundColor: '#F0EFE0',
  },
  cozyRowSprite: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  cozyRowEmojiWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cozyRowEmoji: {
    fontSize: 32,
  },
  cozyRowInfo: {
    flex: 1,
    gap: 4,
  },
  cozyRowName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  cozyRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cozyRarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cozyRarityText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    textTransform: 'capitalize' as const,
  },
  cozyRowChevron: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: Farm.woodHighlight,
  },
  cozyStatusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Farm.greenBtn,
    borderWidth: 1,
    borderColor: Farm.greenBtnShadow,
  },
  cozyStatusChipText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  cozyEmptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    marginTop: Spacing['3xl'],
    color: Farm.brownTextSub,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  // Seed picker — pageSheet
  seedSheetContainer: {
    flex: 1,
  },
  seedSheetScroll: {
    flex: 1,
  },
  seedSheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  seedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.md,
  },
  seedRowSprite: {
    width: 52,
    height: 52,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginTop: -6,
  },
  seedSectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  rareSeedBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    borderRadius: Radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  rareSeedBadgeText: {
    color: '#fff',
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },
  seedRowInfo: {
    flex: 1,
    gap: 2,
  },
  seedRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  seedRowName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  seedSeasonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  seedSeasonBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    color: '#B45309',
  },
  seedRowDesc: {
    fontSize: FontSize.caption,
  },
  seedRowStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  seedRowStat: {
    fontSize: FontSize.caption,
  },
  seedRowWarn: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
});
