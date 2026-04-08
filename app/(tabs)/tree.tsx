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
  Dimensions,
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
  withSpring,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { hapticsTreeTap, hapticsSpeciesChange } from '../../lib/mascot/haptics';

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
import { GiftSenderSheet } from '../../components/mascot/GiftSenderSheet';
import { GiftReceiptModal } from '../../components/mascot/GiftReceiptModal';
import { TechTreeSheet } from '../../components/mascot/TechTreeSheet';
import { BuildingDetailSheet } from '../../components/mascot/BuildingDetailSheet';
import { WeeklyGoal, countWeeklyTasks } from '../../components/mascot/WeeklyGoal';
import { FamilyQuestBanner } from '../../components/mascot/FamilyQuestBanner';
import { FamilyQuestDetailSheet } from '../../components/mascot/FamilyQuestDetailSheet';
import { FamilyQuestPickerSheet } from '../../components/mascot/FamilyQuestPickerSheet';
import * as Haptics from 'expo-haptics';
import { useFarm } from '../../hooks/useFarm';
import { SunriseReport, type SunriseResource } from '../../components/mascot/SunriseReport';
import { BadgesSheet } from '../../components/mascot/BadgesSheet';
import { CompanionPicker } from '../../components/mascot/CompanionPicker';
import { CompanionSlot } from '../../components/mascot/CompanionSlot';
import { buildAnonymizationMap, anonymize, deanonymize } from '../../lib/anonymizer';
import { getPendingResources } from '../../lib/mascot/building-engine';
import {
  COMPANION_UNLOCK_LEVEL,
  type CompanionData,
  type CompanionSpecies,
} from '../../lib/mascot/companion-types';
import {
  getCompanionStage,
  getCompanionMood,
  pickCompanionMessage,
  generateCompanionAIMessage,
  detectProactiveEvent,
  computeMoodScore,
} from '../../lib/mascot/companion-engine';
import * as SecureStore from 'expo-secure-store';
import { type PlantedCrop, type PlacedBuilding, CROP_CATALOG, BUILDING_CATALOG } from '../../lib/mascot/types';
import type { GiftEntry } from '../../lib/mascot/gift-engine';
import { hasCropSeasonalBonus, parseCrops, getAvailableCrops, RARE_SEED_DROP_RULES } from '../../lib/mascot/farm-engine';
import { getUnlockedCropCells, getExpandedCropCells, BUILDING_CELLS, EXPANSION_BUILDING_CELL } from '../../lib/mascot/world-grid';
import { getTechBonuses, type TechBonuses } from '../../lib/mascot/tech-engine';
import { HarvestBurst, CROP_COLORS } from '../../components/mascot/HarvestBurst';
import { HarvestEventOverlay } from '../../components/mascot/HarvestEventOverlay';
import type { HarvestEvent } from '../../lib/mascot/farm-engine';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { AmbientParticles } from '../../components/mascot/AmbientParticles';
import { SeasonalParticles } from '../../components/mascot/SeasonalParticles';
// StreakFlames supprime — infos dans le HUD
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
import { getTodayStr } from '../../lib/mascot/adventures';
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

// Terrain tileset images (pré-rendues par saison)
const TERRAIN_IMAGES: Record<Season, any> = {
  printemps: require('../../assets/terrain/ground_printemps.png'),
  ete: require('../../assets/terrain/ground_ete.png'),
  automne: require('../../assets/terrain/ground_automne.png'),
  hiver: require('../../assets/terrain/ground_hiver.png'),
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TREE_SIZE = Math.min(SCREEN_W * 0.65, 280);

/** Hauteur du conteneur diorama — calée sur le ratio 2:1 du tileset terrain (800×1600) */
const TERRAIN_HEIGHT = SCREEN_W * 2;
const DIORAMA_HEIGHT_BY_STAGE: Record<number, number> = {
  0: TERRAIN_HEIGHT,  // graine
  1: TERRAIN_HEIGHT,  // pousse
  2: TERRAIN_HEIGHT,  // arbuste
  3: TERRAIN_HEIGHT,  // arbre
  4: TERRAIN_HEIGHT,  // majestueux
  5: TERRAIN_HEIGHT,  // légendaire
};

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
function CropTooltip({ tooltipInfo, stageInfo, stageIdx, techBonuses }: {
  tooltipInfo: { cellId: string; cropId: string; tasksCompleted: number };
  stageInfo: any;
  stageIdx: number;
  techBonuses?: TechBonuses;
}) {
  const { colors } = useThemeColors();
  const { t } = useTranslation();
  const cells = getUnlockedCropCells(stageInfo.stage);
  const cell = cells.find((c: any) => c.id === tooltipInfo.cellId);
  if (!cell) return null;

  const cropDef = CROP_CATALOG.find(c => c.id === tooltipInfo.cropId);
  if (!cropDef) return null;
  const cropEmoji = cropDef.emoji;
  const cropName = t(`farm.crop.${cropDef.id}`);
  const effectiveTasksPerStage = Math.max(1, cropDef.tasksPerStage - (techBonuses?.tasksPerStageReduction ?? 0));
  const totalPoints = effectiveTasksPerStage * 4;
  const isSeasonal = hasCropSeasonalBonus(cropDef.id);
  const pointsRemaining = Math.max(0, totalPoints - tooltipInfo.tasksCompleted);
  const remaining = isSeasonal ? Math.ceil(pointsRemaining / 2) : pointsRemaining;

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

export default function TreeScreen() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { profiles, activeProfile, updateTreeSpecies, buyMascotItem, placeMascotItem, unplaceMascotItem, gamiData, setCompanion, tasks, rdvs, meals, completeSagaChapter, familyQuests, unlockedRecipes, startFamilyQuest, completeFamilyQuest, deleteFamilyQuest, contributeFamilyQuest } = useVault();
  const { showToast } = useToast();
  const { config: aiConfig } = useAI();
  const { hasSeenScreen, markScreenSeen, isLoaded: helpLoaded } = useHelp();
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

  // Ferme
  const { plant, harvest, buyBuilding, upgradeBuildingAction, collectBuildingResources, collectPassiveIncome, craft, sellHarvest, sellCrafted, unlockTech, checkWear, repairWear, getWearEffects, getWearEvents, sendGift, receiveGifts } = useFarm(contributeFamilyQuest);
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
  const [harvestBurst, setHarvestBurst] = useState<{ x: number; y: number; reward: number; cropId: string } | null>(null);
  const [harvestEvent, setHarvestEvent] = useState<HarvestEvent | null>(null);
  // Sunrise report
  const [sunriseData, setSunriseData] = useState<{
    resources: SunriseResource[];
    totalCollected: number;
    yesterdayTasks: number;
    hasBonus: boolean;
  } | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ cellId: string; cropId: string; tasksCompleted: number } | null>(null);

  // Craft
  const [showCraftSheet, setShowCraftSheet] = useState(false);

  // Codex ferme (Phase 17)
  const [showCodex, setShowCodex] = useState(false);

  // Cadeaux — envoi
  const [giftOffer, setGiftOffer] = useState<{ itemType: string; itemId: string; maxQty: number; itemName: string } | null>(null);
  // Cadeaux — reception
  const [pendingGiftsToShow, setPendingGiftsToShow] = useState<GiftEntry[]>([]);

  // Tech tree
  const [showTechTree, setShowTechTree] = useState(false);
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
  const today = getTodayStr();

  // ── État visiteur événement saisonnier ──
  const [eventProgressList, setEventProgressList] = useState<SeasonalEventProgress[]>([]);
  const [eventProgressLoaded, setEventProgressLoaded] = useState(false);
  const [showEventDialogue, setShowEventDialogue] = useState(false);
  const [eventVisitorShouldDepart, setEventVisitorShouldDepart] = useState(false);
  const [eventVisitorReaction, setEventVisitorReaction] = useState<ReactionType | undefined>(undefined);

  // Handlers quêtes coopératives
  const handleCompleteQuest = useCallback(async () => {
    if (activeQuest) {
      await completeFamilyQuest(activeQuest.id);
      setShowQuestDetail(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [activeQuest, completeFamilyQuest]);

  const handleDeleteQuest = useCallback(async () => {
    if (activeQuest) {
      await deleteFamilyQuest(activeQuest.id);
      setShowQuestDetail(false);
    }
  }, [activeQuest, deleteFamilyQuest]);

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

  useEffect(() => {
    checkPendingGifts();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPendingGifts();
    });
    return () => sub.remove();
  }, [checkPendingGifts]);

  useFocusEffect(useCallback(() => {
    checkPendingGifts();
  }, [checkPendingGifts]));

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
      (e: any) => e.profileId === activeProfile.id && e.timestamp?.slice(0, 10) === today
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

  // Sauvegarder un message dans la mémoire courte du compagnon (en mémoire uniquement, jamais persistée)
  // Sauvegarde TOUS les messages (IA et templates traduits) pour l'anti-répétition
  const saveToMemory = useCallback((msg: string) => {
    if (!companionRef.current || !msg) return;
    const recent = companionRecentMessagesRef.current;
    // Pas de doublon avec le dernier message
    if (recent.length > 0 && recent[recent.length - 1] === msg) return;
    companionRecentMessagesRef.current = [...recent, msg].slice(-5);
  }, []);

  // Timer unique pour éviter les races de timers entre fallback et IA
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Afficher un message compagnon (template ou IA) et le persister en mémoire
  const showCompanionMsg = useCallback((msg: string, context: any, duration = 8000) => {
    // Annuler tout timer précédent pour éviter les races
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    const isI18nKey = msg.startsWith('companion.msg.');
    const displayMsg = isI18nKey ? String(t(msg, context)) : msg;
    setCompanionMessage(displayMsg);
    // Sauvegarder TOUS les messages affichés (traduits) pour l'anti-répétition
    saveToMemory(displayMsg);
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
    showCompanionMsg(pickCompanionMessage('greeting', context), context, 4000);

    // Tenter un message IA au tap (remplace le fallback si réussi)
    if (aiCall) {
      generateCompanionAIMessage('greeting', context, aiCall).then(msg => {
        showCompanionMsg(msg, context, 4000);
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
    showCompanionMsg(pickCompanionMessage(event, context), context, 5000);

    // Tenter IA (remplace si réussi)
    if (aiCall) {
      generateCompanionAIMessage(event, context, aiCall).then(msg => {
        showCompanionMsg(msg, context, 5000);
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
    const proactiveEvent = detectProactiveEvent({
      hoursSinceLastVisit: hoursSinceLastActivity,
      currentHour: new Date().getHours(),
      tasksToday: recentTasksCountRef.current,
      totalTasksToday,
      streak: prof.streak ?? 0,
      hasGratitudeToday: false,
      hasMealsPlanned: (todayMeals?.length ?? 0) > 0,
      isFirstVisitToday,
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

    // Délai avant d'afficher le message
    const delayTimer = setTimeout(() => {
      // Afficher le template comme fallback immédiat
      showCompanionMsg(pickCompanionMessage(event, context), context);

      // Tenter un message IA (async, remplace le fallback si réussi)
      if (aiCall) {
        generateCompanionAIMessage(event, context, aiCall).then(msg => {
          showCompanionMsg(msg, context);
        });
      }
    }, 1500);

    return () => { clearTimeout(delayTimer); };
  // Dépendances stables uniquement — les refs capturent le reste
  }, [aiCall]));

  // Collecter le revenu passif des batiments a l'ouverture + sunrise report
  useEffect(() => {
    if (!profile?.id) return;
    const buildings = profile.farmBuildings ?? [];
    if (buildings.length === 0) return;

    (async () => {
      // Verifier si absence > 8h
      const SUNRISE_KEY = 'sunrise_last_shown';
      const lastShown = await SecureStore.getItemAsync(SUNRISE_KEY);
      const now = Date.now();
      const absenceThresholdMs = 6 * 60 * 60 * 1000;
      // Première ouverture : initialiser le timestamp sans afficher le popup
      if (!lastShown) {
        await SecureStore.setItemAsync(SUNRISE_KEY, String(now));
        return;
      }
      const lastTs = parseInt(lastShown, 10);
      const longAbsence = (now - lastTs) > absenceThresholdMs;

      // Calculer le detail par ressource AVANT la collecte
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

      // Collecter
      const totalCollected = await collectPassiveIncome(profile.id);

      // Vérifier l'usure de la ferme (clôtures, toits, herbes, nuisibles)
      const newWearEvents = await checkWear(profile.id);
      for (const ev of newWearEvents) {
        if (ev.type === 'broken_fence') showToast(t('farm.wear.brokenFence'), 'error');
        else if (ev.type === 'damaged_roof') showToast(t('farm.wear.damagedRoof'), 'error');
        else if (ev.type === 'weeds') showToast(t('farm.wear.weeds'), 'info');
        else if (ev.type === 'pests') showToast(t('farm.wear.pests'), 'info');
      }

      if (totalCollected === 0) return;

      // Compter les taches d'hier
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const yesterdayTasks = gamiData?.history?.filter(
        e => e.profileId === profile.id && e.timestamp?.slice(0, 10) === yesterdayStr && e.note?.startsWith('Tâche:')
      ).length ?? 0;
      const hasBonus = yesterdayTasks >= 3;

      if (longAbsence) {
        const resources: SunriseResource[] = Object.values(resourceMap).map(r => ({
          emoji: r.emoji,
          label: r.label,
          quantity: hasBonus ? Math.ceil(r.qty * 1.5) : r.qty,
        }));
        const displayTotal = hasBonus ? Math.ceil(totalCollected * 1.5) : totalCollected;
        setSunriseData({ resources, totalCollected: displayTotal, yesterdayTasks, hasBonus });
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
      // Recolte avec burst anime
      const cell = cells[cellIdx];
      const burstX = cell.x * SCREEN_W;
      const burstY = cell.y * (DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60);
      const cropDef = CROP_CATALOG.find(c => c.id === crop.cropId);
      harvest(profile.id, crop.plotIndex).then((result) => {
        if (result) {
          const harvestedCropDef = CROP_CATALOG.find(c => c.id === result.cropId);
          const displayReward = harvestedCropDef?.harvestReward ?? 0;
          setHarvestBurst({ x: burstX, y: burstY, reward: displayReward, cropId: result.cropId });
          const emoji = harvestedCropDef?.emoji ?? '🌾';
          const cropLabel = harvestedCropDef ? t(harvestedCropDef.labelKey) : result.cropId;
          const accord = FEMININE_CROPS.has(result.cropId) ? 'récoltée' : 'récolté';
          const goldenPrefix = result.isGolden ? '✨ ' : '';
          const finalReward = displayReward * (result.isGolden ? 5 : 1);
          showToast(
            `${goldenPrefix}${cropLabel} ${accord} !`,
            'success',
            undefined,
            { icon: emoji, subtitle: `+${finalReward} 🍂${result.isGolden ? ' · Culture dorée !' : ''}` }
          );
          // Toast spécial graine rare avec délai pour ne pas masquer le toast récolte
          if (result.seedDrop) {
            setTimeout(() => {
              showToast(`🌟 ${result.seedDrop!.emoji} Graine rare trouvée : ${t(result.seedDrop!.labelKey)} !`);
            }, 1500);
          }
          if (result.harvestEvent) {
            setHarvestEvent(result.harvestEvent);
          }
          triggerActionMsg('harvest');
        }
      });
    } else if (crop) {
      // Tooltip info sur culture en croissance
      const cropDef = CROP_CATALOG.find(c => c.id === crop.cropId);
      const stagesDone = crop.currentStage;
      const effectiveTpS = Math.max(1, (cropDef?.tasksPerStage ?? 0) - (techBonuses?.tasksPerStageReduction ?? 0));
      const totalCompleted = stagesDone * effectiveTpS + crop.tasksCompleted;
      setTooltipInfo({ cellId, cropId: crop.cropId, tasksCompleted: totalCompleted });
      setTimeout(() => setTooltipInfo(null), 3000);
    } else {
      setSelectedPlotIndex(cellIdx);
      setShowSeedPicker(true);
    }
  }, [profile, isOwnTree, harvest, level, stageIdx, techBonuses, stageInfo.stage, triggerActionMsg]);

  /** Planter une graine sur la parcelle selectionnee */
  const handleSeedSelect = useCallback(async (cropId: string) => {
    if (!profile || selectedPlotIndex === null) return;
    try {
      await plant(profile.id, selectedPlotIndex, cropId);
      const cropDef = CROP_CATALOG.find(c => c.id === cropId);
      showToast(`${cropDef?.emoji ?? '🌱'} ${t('farm.planted')}`);
    } catch {
      showToast(t('common.error'), 'error');
    }
    setShowSeedPicker(false);
    setSelectedPlotIndex(null);
  }, [profile, selectedPlotIndex, plant, showToast, t]);

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

        {/* Modal sélection d'item à placer */}
        <Modal
          visible={showItemPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowItemPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowItemPicker(false)}
          >
            <View style={[styles.pickerCard, { backgroundColor: colors.card }, Shadows.lg]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                {t('mascot.placement.choose')}
              </Text>
              <View style={styles.pickerGrid}>
                {allOwnedItems.map(item => {
                  const isPlaced = placedItemIds.has(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={async () => {
                        if (isPlaced && profile) {
                          // Retirer l'item placé
                          const slot = Object.entries(profile.mascotPlacements ?? {}).find(([, v]) => v === item.id)?.[0];
                          if (slot) {
                            await unplaceMascotItem(profile.id, slot);
                            showToast(t('mascot.placement.removed'));
                          }
                        } else {
                          setPlacingItem(item.id);
                          setShowItemPicker(false);
                        }
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.pickerItem,
                        { backgroundColor: colors.cardAlt, borderColor: isPlaced ? colors.error : colors.borderLight },
                      ]}
                    >
                      {ITEM_ILLUSTRATIONS[item.id] ? (
                        <Image source={ITEM_ILLUSTRATIONS[item.id]} style={styles.pickerIllustration} />
                      ) : (
                        <Text style={styles.pickerEmoji}>{item.emoji}</Text>
                      )}
                      {isPlaced && (
                        <Text style={styles.pickerRemoveLabel}>{'✕'}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => setShowItemPicker(false)}
                style={[styles.pickerCloseBtn, { borderColor: colors.borderLight }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerCloseText, { color: colors.textSub }]}>
                  {t('mascot.shop.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
              {/* ── Graines rares (possedees + decouverte) ── */}
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
                            <Text style={styles.seedRowEmoji}>{crop.emoji}</Text>
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
                      return (
                        <View
                          key={crop.id}
                          style={[
                            styles.seedRow,
                            { backgroundColor: colors.cardAlt, borderColor: colors.borderLight, opacity: 0.5 },
                          ]}
                        >
                          <View>
                            <Text style={styles.seedRowEmoji}>{crop.emoji}</Text>
                            <View style={[styles.rareSeedBadge, { backgroundColor: colors.textMuted }]}>
                              <Text style={styles.rareSeedBadgeText}>?</Text>
                            </View>
                          </View>
                          <View style={styles.seedRowInfo}>
                            <View style={styles.seedRowHeader}>
                              <Text style={[styles.seedRowName, { color: colors.text }]}>
                                {t(`farm.crop.${crop.id}`)}
                              </Text>
                              <View style={[styles.seedSeasonBadge, { backgroundColor: colors.borderLight }]}>
                                <Text style={[styles.seedSeasonBadgeText, { color: colors.textMuted }]}>
                                  {t('farm.rare')}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.seedRowDesc, { color: colors.textMuted }]} numberOfLines={2}>
                              {getDropHint(crop.id)}
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
                    <View style={{ height: Spacing.md }} />
                    <Text style={[styles.seedSectionTitle, { color: colors.textSub }]}>
                      {t('farm.regularSeeds')}
                    </Text>
                  </>
                );
              })()}
              {/* ── Graines normales (achetables) ── */}
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
                    <Text style={styles.seedRowEmoji}>{crop.emoji}</Text>
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
              <View style={{ height: Spacing['3xl'] }} />
            </ScrollView>
          </View>
        </Modal>

        {/* Arbre principal — diorama saisonnier immersif (full-bleed) */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.treeContainer}>
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
            />

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
              />
            </View>

            {/* Couche ambiance : particules horaires + tint */}
            <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 5 }} pointerEvents="none">
              <AmbientParticles containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60} />
            </View>

            {/* Harvest Burst animation */}
            {harvestBurst && (
              <HarvestBurst
                x={harvestBurst.x}
                y={harvestBurst.y}
                reward={harvestBurst.reward}
                cropColor={CROP_COLORS[harvestBurst.cropId] ?? '#FFD700'}
                onComplete={() => setHarvestBurst(null)}
              />
            )}

            {/* Tooltip info culture */}
            {tooltipInfo && <CropTooltip tooltipInfo={tooltipInfo} stageInfo={stageInfo} stageIdx={stageIdx} techBonuses={techBonuses} />}

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

          </View>
        </Animated.View>


        {/* Carte 1 — Actions */}
        {isOwnTree && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: -22, zIndex: 10, position: 'relative' }}>
          <View style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionItem} onPress={() => setShowShop(true)} activeOpacity={0.7}>
                <Text style={styles.actionItemIcon}>{'🛒'}</Text>
                <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{t('mascot.shop.shortTitle', 'Boutique')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => setShowCraftSheet(true)} activeOpacity={0.7}>
                <Text style={styles.actionItemIcon}>{'🔨'}</Text>
                <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{t('craft.atelier')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => setShowTechTree(true)} activeOpacity={0.7}>
                <Text style={styles.actionItemIcon}>{'🔬'}</Text>
                <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{'Techs'}</Text>
              </TouchableOpacity>
              {__DEV__ && (
                <TouchableOpacity
                  style={[styles.actionItem, devEventOverride ? { opacity: 0.5 } : null]}
                  onPress={() => setDevEventOverride(prev => prev ? null : 'poisson-avril')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionItemIcon}>{'🐟'}</Text>
                  <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{'DEV'}</Text>
                </TouchableOpacity>
              )}
              {(allDecoIds.length + allHabIds.length) > 0 && !placingItem && (
                <TouchableOpacity style={styles.actionItem} onPress={() => setShowItemPicker(true)} activeOpacity={0.7}>
                  <Text style={styles.actionItemIcon}>{'🎨'}</Text>
                  <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{t('mascot.shortDecorate', 'Décorer')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionItem} onPress={() => setShowBadges(true)} activeOpacity={0.7}>
                <Text style={styles.actionItemIcon}>{'🏅'}</Text>
                <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{'Badges'}</Text>
              </TouchableOpacity>
              {companion && (
                <TouchableOpacity style={styles.actionItem} onPress={() => setShowCompanionPicker(true)} activeOpacity={0.7}>
                  <Text style={styles.actionItemIcon}>{'🐾'}</Text>
                  <Text style={[styles.actionItemLabel, { color: colors.textSub }]}>{companion.name}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
        )}

        {/* Carte 2 — Progression */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={isOwnTree ? { marginTop: Spacing.sm } : { marginTop: -22, zIndex: 10, position: 'relative' }}>
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.sm]}>
            {/* Header : stade + XP */}
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: colors.text }]}>
                {STAGE_EMOJI[stageInfo.stage]} {t(stageInfo.labelKey)} · {t('mascot.screen.level')} {level}
              </Text>
              <Text style={[styles.progressXp, { color: colors.textMuted }]}>
                {xpInLevel} / {xpNeeded} XP
              </Text>
            </View>

            {/* Barre XP */}
            <View style={[styles.progressBar, { backgroundColor: colors.cardAlt }]}>
              <View style={[styles.progressFill, { width: `${Math.round(xpPercent * 100)}%`, backgroundColor: tier.color }]} />
            </View>

            {/* Ligne evolution */}
            {nextEvoLevel !== null ? (
              <View style={styles.evoLine}>
                <Text style={[styles.evoLineText, { color: colors.textSub }]}>
                  → {t(TREE_STAGES[stageIdx + 1]?.labelKey || stageInfo.labelKey)}
                </Text>
                <View style={[styles.evoLineBar, { backgroundColor: colors.cardAlt }]}>
                  <View style={[styles.evoLineFill, { width: `${Math.round(stageProgress * 100)}%`, backgroundColor: sp.accent }]} />
                </View>
                <Text style={[styles.evoLineHint, { color: colors.textFaint }]}>
                  {t('mascot.screen.levelsToEvo', { count: levelsLeft })}
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#FFD700', fontWeight: FontWeight.bold, textAlign: 'center', marginTop: Spacing.xs }}>
                {t('mascot.screen.maxStage')}
              </Text>
            )}
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

        {/* Objectif hebdomadaire */}
        {gamiData && profile && (
          <WeeklyGoal
            weeklyTaskCount={countWeeklyTasks(gamiData.history ?? [], profile.id)}
            colors={colors}
            t={t}
          />
        )}

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
          <View style={styles.hudItem}>
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
        onCraft={async (recipeId) => {
          const result = await craft(profile!.id, recipeId);
          if (result) triggerActionMsg('craft');
          return result;
        }}
        onSellHarvest={(cropId) => sellHarvest(profile!.id, cropId)}
        onSellCrafted={(recipeId) => sellCrafted(profile!.id, recipeId)}
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
  actionCard: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionItemIcon: {
    fontSize: 22,
    lineHeight: 28,
  },
  actionItemLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
  progressCard: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: Spacing['2xl'],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  progressXp: {
    fontSize: FontSize.caption,
  },
  progressBar: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  evoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  evoLineText: {
    fontSize: FontSize.caption,
    flexShrink: 0,
  },
  evoLineBar: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  evoLineFill: {
    height: '100%',
  },
  evoLineHint: {
    fontSize: FontSize.caption,
    flexShrink: 0,
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
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerCard: {
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    marginHorizontal: Spacing['2xl'],
    maxWidth: 320,
    width: '85%',
  },
  pickerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  pickerItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pickerEmoji: {
    fontSize: 28,
  },
  pickerIllustration: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  pickerRemoveLabel: {
    position: 'absolute',
    top: -6,
    right: -4,
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  pickerDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  pickerCloseBtn: {
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
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
  seedRowEmoji: {
    fontSize: 32,
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
