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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { callCompanionMessage } from '../../lib/ai-service';
import { TreeView } from '../../components/mascot/TreeView';
import { SpeciesPicker } from '../../components/mascot/SpeciesPicker';
import { TreeShop } from '../../components/mascot/TreeShop';
import { PIXEL_GROUND_DARK } from '../../components/mascot/PixelDiorama';
import { WorldGridView } from '../../components/mascot/WorldGridView';
import { TileMapRenderer, GRASS_TILE_IMAGE } from '../../components/mascot/TileMapRenderer';
import { BuildingShopSheet } from '../../components/mascot/BuildingShopSheet';
import { CraftSheet } from '../../components/mascot/CraftSheet';
import { TechTreeSheet } from '../../components/mascot/TechTreeSheet';
import { BuildingDetailSheet } from '../../components/mascot/BuildingDetailSheet';
import { WeeklyGoal, countWeeklyTasks } from '../../components/mascot/WeeklyGoal';
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
import { hasCropSeasonalBonus, parseCrops, getAvailableCrops } from '../../lib/mascot/farm-engine';
import { getUnlockedCropCells, getExpandedCropCells, BUILDING_CELLS, EXPANSION_BUILDING_CELL } from '../../lib/mascot/world-grid';
import { getTechBonuses, type TechBonuses } from '../../lib/mascot/tech-engine';
import { HarvestBurst, CROP_COLORS } from '../../components/mascot/HarvestBurst';
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
import { SPECIES_INFO, ALL_SPECIES, DECORATIONS, INHABITANTS, ITEM_ILLUSTRATIONS, type TreeSpecies } from '../../lib/mascot/types';
import { getCurrentSeason, SEASON_INFO, GROUND_COLORS, type Season } from '../../lib/mascot/seasons';
import type { SagaProgress } from '../../lib/mascot/sagas-types';
import { getSagaById } from '../../lib/mascot/sagas-engine';
import { loadSagaProgress } from '../../lib/mascot/sagas-storage';
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

export default function TreeScreen() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const { profiles, activeProfile, updateTreeSpecies, buyMascotItem, placeMascotItem, unplaceMascotItem, gamiData, setCompanion, tasks, rdvs, meals } = useVault();
  const { showToast } = useToast();
  const { config: aiConfig } = useAI();

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
  const { plant, harvest, buyBuilding, upgradeBuildingAction, collectBuildingResources, collectPassiveIncome, craft, sellHarvest, sellCrafted, unlockTech } = useFarm();
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
  const [harvestBurst, setHarvestBurst] = useState<{ x: number; y: number; reward: number; cropId: string } | null>(null);

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

  // Tech tree
  const [showTechTree, setShowTechTree] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const techBonuses = useMemo(() => {
    return getTechBonuses(profile?.farmTech ?? []);
  }, [profile?.farmTech]);

  // Compagnon mascotte
  const [showCompanionPicker, setShowCompanionPicker] = useState(false);
  const [companionMessage, setCompanionMessage] = useState<string | null>(null);
  const companionPickerShownRef = useRef(false);

  // Batiments productifs
  const [showBuildingShop, setShowBuildingShop] = useState(false);
  const [showBuildingDetail, setShowBuildingDetail] = useState(false);
  const [selectedBuildingCellId, setSelectedBuildingCellId] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<PlacedBuilding | null>(null);

  // Saga active — pour bandeau + élément visuel
  const [sagaProgress, setSagaProgress] = useState<SagaProgress | null>(null);
  useEffect(() => {
    if (!profile?.id) return;
    loadSagaProgress(profile.id).then(p => {
      if (p && p.status === 'active') setSagaProgress(p);
      else setSagaProgress(null);
    });
  }, [profile?.id]);
  const activeSaga = sagaProgress ? getSagaById(sagaProgress.sagaId) : null;

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
      mood: 'content',
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

  // Sauvegarder un message dans la mémoire courte du compagnon (via refs pour éviter les boucles)
  const saveToMemory = useCallback((msg: string) => {
    const comp = companionRef.current;
    const prof = activeProfileRef.current;
    if (!comp || !prof || msg.startsWith('companion.msg.')) return;
    const recent = comp.recentMessages ?? [];
    // Pas de doublon avec le dernier message
    if (recent.length > 0 && recent[recent.length - 1] === msg) return;
    const updated = [...recent, msg].slice(-3);
    setCompanion(prof.id, { ...comp, recentMessages: updated });
  }, [setCompanion]);

  // Timer unique pour éviter les races de timers entre fallback et IA
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Afficher un message compagnon (template ou IA) et le persister en mémoire
  const showCompanionMsg = useCallback((msg: string, context: any, duration = 8000) => {
    // Annuler tout timer précédent pour éviter les races
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    const isI18nKey = msg.startsWith('companion.msg.');
    const displayMsg = isI18nKey ? String(t(msg, context)) : msg;
    setCompanionMessage(displayMsg);
    if (!isI18nKey) saveToMemory(displayMsg);
    msgTimerRef.current = setTimeout(() => setCompanionMessage(null), duration);
  }, [t, saveToMemory]);

  // Handler tap sur le compagnon — affiche message greeting
  const handleCompanionTap = useCallback(() => {
    if (!companion || !activeProfile) return;
    const context = {
      profileName: activeProfile.name,
      companionName: companion.name,
      companionSpecies: companion.activeSpecies,
      tasksToday: recentTasksCount,
      streak: activeProfile.streak ?? 0,
      level: calculateLevel(activeProfile.points ?? 0),
      recentTasks: recentCompletedTasks,
      nextRdv,
      todayMeals,
      recentMessages: companion.recentMessages,
    };

    // Afficher le template immédiatement comme fallback
    showCompanionMsg(pickCompanionMessage('greeting', context), context, 4000);

    // Tenter un message IA au tap (remplace le fallback si réussi)
    if (aiCall) {
      generateCompanionAIMessage('greeting', context, aiCall).then(msg => {
        showCompanionMsg(msg, context, 4000);
      });
    }
  }, [companion, activeProfile, recentTasksCount, recentCompletedTasks, nextRdv, todayMeals, aiCall, showCompanionMsg]);

  // Compter les tâches totales du jour (faites + à faire)
  const totalTasksToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter(t => t.dueDate === today).length;
  }, [tasks]);

  // Dernière visite (pour détecter première visite du jour et absence)
  const lastVisitRef = useRef<string | null>(null);

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

    const context: import('../../lib/mascot/companion-types').CompanionMessageContext = {
      profileName: prof.name,
      companionName: comp.name,
      companionSpecies: comp.activeSpecies,
      tasksToday: recentTasksCountRef.current,
      streak: prof.streak ?? 0,
      level: calculateLevel(prof.points ?? 0),
      recentMessages: comp.recentMessages,
    };

    // Fallback template immédiat
    showCompanionMsg(pickCompanionMessage(event, context), context, 5000);

    // Tenter IA (remplace si réussi)
    if (aiCall) {
      generateCompanionAIMessage(event, context, aiCall).then(msg => {
        showCompanionMsg(msg, context, 5000);
      });
    }
  }, [aiCall, showCompanionMsg]);

  // Message de bienvenue au focus — une seule fois par visite, cooldown 5min
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    const comp = companionRef.current;
    const prof = activeProfileRef.current;
    if (!comp || !prof) return;

    // Cooldown 20s entre deux messages automatiques
    if (now - lastFocusMessageRef.current < 20 * 1000) return;
    lastFocusMessageRef.current = now;

    const level = calculateLevel(prof.points ?? 0);
    const context = {
      profileName: prof.name,
      companionName: comp.name,
      companionSpecies: comp.activeSpecies,
      tasksToday: recentTasksCountRef.current,
      streak: prof.streak ?? 0,
      level,
      recentTasks: recentCompletedTasks,
      nextRdv,
      todayMeals,
      recentMessages: comp.recentMessages,
    };

    const today = new Date().toISOString().slice(0, 10);
    const isFirstVisitToday = lastVisitRef.current !== today;
    lastVisitRef.current = today;

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
        const emoji = key === 'oeuf' ? '🥚' : key === 'lait' ? '🥛' : '🌾';
        if (!resourceMap[key]) resourceMap[key] = { emoji, label: key === 'oeuf' ? 'Oeufs' : key === 'lait' ? 'Lait' : 'Farine', qty: 0 };
        resourceMap[key].qty += pending;
      }

      // Collecter
      const totalCollected = await collectPassiveIncome(profile.id);
      if (totalCollected === 0) return;

      // Compter les taches d'hier
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const yesterdayTasks = gamiData?.history?.filter(
        e => e.profileId === profile.id && e.timestamp?.slice(0, 10) === yesterdayStr
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
        showToast(`🏠 +${totalCollected} ressources collect\u00E9es`);
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
      harvest(profile.id, cellIdx).then((result) => {
        if (result) {
          const harvestedCropDef = CROP_CATALOG.find(c => c.id === result.cropId);
          const displayReward = harvestedCropDef?.harvestReward ?? 0;
          setHarvestBurst({ x: burstX, y: burstY, reward: displayReward, cropId: result.cropId });
          const emoji = harvestedCropDef?.emoji ?? '🌾';
          showToast(`${emoji} ${result.cropId} récolté !`);
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
      const resourceEmoji = def?.resourceType === 'oeuf' ? '🥚' : def?.resourceType === 'lait' ? '🥛' : '🌾';
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        {/* HUD ferme — fixe au-dessus du diorama */}
        <View style={[styles.farmHud, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)' }]}>
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
          </View>
        </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, Layout.contentContainer]}
        showsVerticalScrollIndicator={false}
      >

        {/* Bandeau saga active */}
        {activeSaga && sagaProgress && (
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
              {CROP_CATALOG.map(crop => {
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
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
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
              onCropPlotPress={isOwnTree ? handleCropCellPress : undefined}
              onBuildingCellPress={isOwnTree ? handleBuildingCellPress : undefined}
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
              {/* Élément visuel temporaire de la saga active */}
              {activeSaga && (
                <Animated.View entering={FadeIn.duration(500)} style={styles.sagaSceneElement}>
                  <Text style={styles.sagaSceneEmoji}>{activeSaga.sceneEmoji}</Text>
                </Animated.View>
              )}
            </View>

          </View>
        </Animated.View>


        {/* Transition douce diorama → contenu : gradient sol → fond de page */}
        <LinearGradient
          colors={[PIXEL_GROUND_DARK[season], colors.bg]}
          style={styles.groundTransition}
        />


        {/* Info profil + stade */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.infoCard}>
          <View style={[styles.infoContainer, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.md]}>
            {/* Barre d'outils compacte (uniquement son propre arbre) */}
            {isOwnTree && (
            <View style={styles.toolbar}>
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: tint, borderColor: primary }]}
                onPress={() => setShowShop(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.toolBtnIcon}>{'🛒'}</Text>
                <Text style={[styles.toolBtnLabel, { color: primary }]}>
                  {t('mascot.shop.shortTitle', 'Boutique')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: tint, borderColor: primary }]}
                onPress={() => setShowCraftSheet(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.toolBtnIcon}>{'🔨'}</Text>
                <Text style={[styles.toolBtnLabel, { color: primary }]}>
                  {t('craft.atelier')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: tint, borderColor: primary }]}
                onPress={() => setShowTechTree(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.toolBtnIcon}>{'🔬'}</Text>
                <Text style={[styles.toolBtnLabel, { color: primary }]}>
                  {'Techs'}
                </Text>
              </TouchableOpacity>
              {(allDecoIds.length + allHabIds.length) > 0 && !placingItem && (
                <TouchableOpacity
                  style={[styles.toolBtn, { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => setShowItemPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.toolBtnIcon}>{'🎨'}</Text>
                  <Text style={[styles.toolBtnLabel, { color: primary }]}>
                    {t('mascot.shortDecorate', 'D\u00E9corer')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: tint, borderColor: primary }]}
                onPress={() => setShowBadges(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.toolBtnIcon}>{'🏅'}</Text>
                <Text style={[styles.toolBtnLabel, { color: primary }]}>
                  {'Badges'}
                </Text>
              </TouchableOpacity>
              {companion && (
                <TouchableOpacity
                  style={[styles.toolBtn, { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => setShowCompanionPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.toolBtnIcon}>{'🐾'}</Text>
                  <Text style={[styles.toolBtnLabel, { color: primary }]}>
                    {companion.name}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            )}

            {/* Barre XP */}
            <View style={styles.xpSection}>
              <View style={styles.xpHeader}>
                <Text style={[styles.xpLabel, { color: colors.textSub }]}>
                  {t('mascot.screen.xpProgress')}
                </Text>
                <Text style={[styles.xpValue, { color: colors.textMuted }]}>
                  {xpInLevel} / {xpNeeded} XP
                </Text>
              </View>
              <View style={[styles.xpBar, { backgroundColor: colors.cardAlt }]}>
                <View style={[styles.xpFill, { width: `${Math.round(xpPercent * 100)}%`, backgroundColor: tier.color }]} />
              </View>
            </View>

            {/* Progression vers évolution */}
            {nextEvoLevel !== null && (
              <View style={[styles.evoSection, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.evoTitle, { color: colors.textSub }]}>
                  {t('mascot.screen.nextEvolution')}
                </Text>
                <View style={styles.evoRow}>
                  <View style={styles.evoStage}>
                    <TreeView species={species} level={level} size={70} showGround={false} interactive={false} />
                    <Text style={[styles.evoStageName, { color: colors.text }]}>
                      {t(stageInfo.labelKey)}
                    </Text>
                  </View>
                  <Text style={[styles.evoArrow, { color: colors.textFaint }]}>→</Text>
                  <View style={styles.evoStage}>
                    <TreeView species={species} level={nextEvoLevel} size={70} showGround={false} interactive={false} />
                    <Text style={[styles.evoStageName, { color: colors.textMuted }]}>
                      {t(TREE_STAGES[stageIdx + 1]?.labelKey || stageInfo.labelKey)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.evoHint, { color: colors.textFaint }]}>
                  {t('mascot.screen.levelsToEvo', { count: levelsLeft })}
                </Text>
                {/* Barre progression évolution */}
                <View style={[styles.xpBar, { backgroundColor: colors.cardAlt, marginTop: Spacing.sm }]}>
                  <View style={[styles.xpFill, { width: `${Math.round(stageProgress * 100)}%`, backgroundColor: sp.accent }]} />
                </View>
              </View>
            )}

            {/* Stade max atteint */}
            {nextEvoLevel === null && (
              <View style={[styles.evoSection, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.maxStage, { color: '#FFD700' }]}>
                  {t('mascot.screen.maxStage')}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

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
        farmInventory={profile?.farmInventory ?? { oeuf: 0, lait: 0, farine: 0 }}
        craftedItems={profile?.craftedItems ?? []}
        onCraft={async (recipeId) => {
          const result = await craft(profile!.id, recipeId);
          if (result) triggerActionMsg('craft');
          return result;
        }}
        onSellHarvest={(cropId) => sellHarvest(profile!.id, cropId)}
        onSellCrafted={(recipeId) => sellCrafted(profile!.id, recipeId)}
        techBonuses={techBonuses}
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
          onCollect={handleCollectBuilding}
          onUpgrade={handleUpgradeBuilding}
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
    </SafeAreaView>
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
    // Full-bleed : pas de borderRadius, largeur 100%
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-end',
    // overflow visible pour que les tooltips/bulles companion ne soient pas clippés
    overflow: 'visible',
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
  sagaSceneElement: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.xl,
    opacity: 0.85,
  },
  sagaSceneEmoji: {
    fontSize: 28,
  },
  groundTransition: {
    // Transition douce du sol vers le fond de page
    height: 48,
    marginHorizontal: -Spacing['2xl'],
    marginTop: -1, // éviter le pixel gap entre diorama et gradient
  },
  infoCard: {
    marginBottom: Spacing['2xl'],
  },
  infoContainer: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  toolBtn: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  toolBtnIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  toolBtnLabel: {
    fontSize: 9,
    fontWeight: FontWeight.semibold,
    lineHeight: 11,
  },
  xpSection: {
    marginBottom: Spacing.lg,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  xpLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  xpValue: {
    fontSize: FontSize.caption,
  },
  xpBar: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  evoSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xl,
  },
  evoTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.md,
  },
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  evoStage: {
    alignItems: 'center',
  },
  evoEmoji: {
    fontSize: FontSize.display,
  },
  evoStageName: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.xxs,
  },
  evoArrow: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  evoHint: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  maxStage: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
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
