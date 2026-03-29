/**
 * tree.tsx — Écran dédié arbre mascotte
 *
 * Affiche l'arbre du profil sélectionné en plein écran avec :
 * - Arbre animé grande taille
 * - Barre de progression XP vers prochaine évolution
 * - Infos espèce + stade
 * - Sélecteur d'espèce (si première fois ou via bouton)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
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
} from 'react-native';
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
import { TreeView } from '../../components/mascot/TreeView';
import { SpeciesPicker } from '../../components/mascot/SpeciesPicker';
import { TreeShop } from '../../components/mascot/TreeShop';
import { PixelDiorama, PIXEL_GROUND, PIXEL_GROUND_DARK } from '../../components/mascot/PixelDiorama';
import { WorldGridView, FarmStats } from '../../components/mascot/WorldGridView';
import { BuildingShopSheet } from '../../components/mascot/BuildingShopSheet';
import { BuildingDetailSheet } from '../../components/mascot/BuildingDetailSheet';
import { WeeklyGoal, countWeeklyTasks } from '../../components/mascot/WeeklyGoal';
import { useFarm } from '../../hooks/useFarm';
import { type PlantedCrop, type PlacedBuilding, CROP_CATALOG, BUILDING_CATALOG } from '../../lib/mascot/types';
import { hasCropSeasonalBonus, parseCrops } from '../../lib/mascot/farm-engine';
import { getUnlockedCropCells } from '../../lib/mascot/world-grid';
import { HarvestBurst, CROP_COLORS } from '../../components/mascot/HarvestBurst';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { AmbientParticles } from '../../components/mascot/AmbientParticles';
import { SeasonalParticles } from '../../components/mascot/SeasonalParticles';
import { StreakFlames } from '../../components/mascot/StreakFlames';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TREE_SIZE = Math.min(SCREEN_W * 0.9, 400);

/** Hauteur du conteneur diorama — basée sur le viewport pour un rendu immersif */
const DIORAMA_HEIGHT_BY_STAGE: Record<number, number> = {
  0: SCREEN_H * 0.50,  // graine — compact
  1: SCREEN_H * 0.54,  // pousse — un peu plus grand
  2: SCREEN_H * 0.58,  // arbuste — ratio naturel
  3: SCREEN_H * 0.60,  // arbre
  4: SCREEN_H * 0.63,  // majestueux — un poil plus
  5: SCREEN_H * 0.66,  // légendaire — max impact
};

const SEASON_ILLUSTRATIONS: Record<Season, ImageSourcePropType> = {
  printemps: require('../../assets/illustrations/tree-spring.jpg'),
  ete: require('../../assets/illustrations/tree-summer.jpg'),
  automne: require('../../assets/illustrations/tree-autumn.jpg'),
  hiver: require('../../assets/illustrations/tree-winter.jpg'),
};

/** Tooltip whisper quand on tap une culture en croissance */
function CropWhisper({ whisperInfo, stageInfo, stageIdx }: {
  whisperInfo: { cellId: string; stage: number; cropId: string };
  stageInfo: any;
  stageIdx: number;
}) {
  const { colors } = useThemeColors();
  const cells = getUnlockedCropCells(stageInfo.stage);
  const cell = cells.find((c: any) => c.id === whisperInfo.cellId);
  if (!cell) return null;

  const whispers = [
    '🌱 Je pousse, je pousse...',
    '🌿 Patience, ça vient !',
    '💪 Bientôt prêt !',
    '✨ Encore un petit effort !',
  ];
  const msg = hasCropSeasonalBonus(whisperInfo.cropId)
    ? '☀️ Le soleil m\'aide !'
    : whispers[Math.min(whisperInfo.stage, 3)];
  const TOOLTIP_W = 140;
  const TOOLTIP_H = 28;
  const rawWx = cell.x * SCREEN_W - TOOLTIP_W / 2;
  const rawWy = cell.y * (DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60) - TOOLTIP_H - 12;
  const wx = Math.max(4, Math.min(rawWx, SCREEN_W - TOOLTIP_W - 4));
  const wy = Math.max(4, rawWy);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        left: wx,
        top: wy,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        zIndex: 20,
      }}
    >
      <Text style={{ color: colors.onPrimary, fontSize: 11, textAlign: 'center' }}>{msg}</Text>
    </Animated.View>
  );
}

export default function TreeScreen() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const { profiles, activeProfile, updateTreeSpecies, buyMascotItem, placeMascotItem, gamiData } = useVault();
  const { showToast } = useToast();

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
  const { plant, harvest, buyBuilding, upgradeBuildingAction, collectBuildingResources, collectPassiveIncome, craft, sellHarvest, sellCrafted } = useFarm();
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
  const [harvestBurst, setHarvestBurst] = useState<{ x: number; y: number; reward: number; cropId: string } | null>(null);
  const [whisperInfo, setWhisperInfo] = useState<{ cellId: string; stage: number; cropId: string } | null>(null);

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

  // Collecter le revenu passif des batiments a l'ouverture
  useEffect(() => {
    if (!profile?.id) return;
    collectPassiveIncome(profile.id).then(totalCollected => {
      if (totalCollected > 0) {
        showToast(`🏠 +${totalCollected} ressources collectees`);
      }
    });
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

  if (!profile) return null;

  const species = profile.treeSpecies || 'cerisier';
  const hasChosenSpecies = !!profile.treeSpecies;
  const level = calculateLevel(profile.points ?? 0);
  const season = getCurrentSeason();
  const seasonInfo = SEASON_INFO[season];
  const tier = getLevelTier(level);
  const stageInfo = getTreeStageInfo(level);
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
  }, [placingItem, profile, placeMascotItem, showToast, t]);

  /** Tap sur une cellule de culture */
  const handleCropCellPress = useCallback((cellId: string, crop: PlantedCrop | null) => {
    if (!profile || !isOwnTree) return;
    const cells = getUnlockedCropCells(stageInfo.stage);
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
        }
      });
    } else if (crop) {
      // Whisper sur culture en croissance
      setWhisperInfo({ cellId, stage: crop.currentStage, cropId: crop.cropId });
      setTimeout(() => setWhisperInfo(null), 2500);
    } else {
      setSelectedPlotIndex(cellIdx);
      setShowSeedPicker(true);
    }
  }, [profile, isOwnTree, harvest, level, stageIdx]);

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
      <ScrollView
        contentContainerStyle={[styles.scroll, Layout.contentContainer]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: primary }]}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('mascot.screen.title')}
          </Text>
          <View style={styles.backBtn} />
        </View>

        {/* Badge saison */}
        <View style={[styles.seasonBadge, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
          <Text style={[styles.seasonText, { color: colors.textSub }]}>
            {seasonInfo.emoji} {t(seasonInfo.labelKey)}
          </Text>
        </View>

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
                      onPress={() => {
                        setPlacingItem(item.id);
                        setShowItemPicker(false);
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.pickerItem,
                        { backgroundColor: colors.cardAlt, borderColor: colors.borderLight },
                      ]}
                    >
                      {ITEM_ILLUSTRATIONS[item.id] ? (
                        <Image source={ITEM_ILLUSTRATIONS[item.id]} style={styles.pickerIllustration} />
                      ) : (
                        <Text style={styles.pickerEmoji}>{item.emoji}</Text>
                      )}
                      {isPlaced && (
                        <View style={[styles.pickerDot, { backgroundColor: '#4CAF50' }]} />
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
                const unlocked = stageOrder.indexOf(stageInfo.stage) >= stageOrder.indexOf(crop.minTreeStage);
                const stageName = t(`mascot.stages.${crop.minTreeStage}`);
                const isSeasonal = hasCropSeasonalBonus(crop.id);
                const totalTasks = crop.tasksPerStage * 4;
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
            {/* Couche 0 : Sol top-down — herbe saisonnière plein écran */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: PIXEL_GROUND[season] }]} />

            {/* Couche 1 : Texture herbe subtile — variation de teinte */}
            <LinearGradient
              colors={[PIXEL_GROUND[season] + 'CC', PIXEL_GROUND[season], PIXEL_GROUND_DARK[season]]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Couche 2 : Décorations sol (fleurs, pierres) vues du dessus */}
            <PixelDiorama
              season={season}
              level={level}
              width={SCREEN_W}
              groundHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
            />

            {/* Couche 3 : Grille monde (cultures + batiments) */}
            <WorldGridView
              treeStage={stageInfo.stage}
              farmCropsCSV={profile.farmCrops ?? ''}
              ownedBuildings={profile.farmBuildings ?? []}
              containerWidth={SCREEN_W}
              containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
              onCropPlotPress={isOwnTree ? handleCropCellPress : undefined}
              onBuildingCellPress={isOwnTree ? handleBuildingCellPress : undefined}
            />

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

            {/* Crop Whisper tooltip */}
            {whisperInfo && <CropWhisper whisperInfo={whisperInfo} stageInfo={stageInfo} stageIdx={stageIdx} />}

            {/* Couche 4 : Arbre pixel au premier plan */}
            <View style={styles.treeOverlay}>
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

        {/* Compteur ferme */}
        <FarmStats farmCropsCSV={profile.farmCrops ?? ''} colors={colors} t={t} />

        {/* Flammes de streak */}
        {profile && <StreakFlames streak={profile.streak ?? 0} />}

        {/* Objectif hebdomadaire */}
        {gamiData && profile && (
          <WeeklyGoal
            weeklyTaskCount={countWeeklyTasks(gamiData.history ?? [], profile.id)}
            colors={colors}
            t={t}
          />
        )}

        {/* Info profil + stade */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.infoCard}>
          <View style={[styles.infoContainer, { backgroundColor: colors.card, borderColor: colors.borderLight }, Shadows.md]}>
            {/* Avatar + nom + tier */}
            <View style={styles.profileRow}>
              <Text style={styles.profileAvatar}>{profile.avatar}</Text>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                <Text style={[styles.tierLabel, { color: tier.color }]}>
                  {tier.emoji} {tier.name} — {t('dashboard.loot.level', { level })}
                </Text>
              </View>
            </View>

            {/* Espèce + stade */}
            <View style={[styles.speciesRow, { borderTopColor: colors.borderLight }]}>
              <View style={styles.speciesInfo}>
                <Text style={[styles.speciesLabel, { color: colors.textSub }]}>
                  {sp.emoji} {t(sp.labelKey)}
                </Text>
                <Text style={[styles.stageLabel, { color: colors.text }]}>
                  {t(stageInfo.labelKey)}
                </Text>
                <Text style={[styles.stageDesc, { color: colors.textMuted }]}>
                  {t(stageInfo.descriptionKey)}
                </Text>
              </View>
              {isOwnTree && (
                <TouchableOpacity
                  style={[styles.changeSpeciesBtn, { backgroundColor: tint }]}
                  onPress={() => openPickerFor(profile)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.changeSpeciesText, { color: primary }]}>
                    {hasChosenSpecies ? t('mascot.screen.changeSpecies') : t('mascot.screen.chooseSpecies')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Boutons boutique + décorer (uniquement son propre arbre) */}
            {isOwnTree && (
            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={[styles.shopBtn, { backgroundColor: tint, borderColor: primary }]}
                onPress={() => setShowShop(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.shopBtnText, { color: primary }]}>
                  {'🛒 ' + t('mascot.shop.title')}
                </Text>
              </TouchableOpacity>
              {/* Bouton décorer : visible si des items sont achetés */}
              {(allDecoIds.length + allHabIds.length) > 0 && !placingItem && (
                <TouchableOpacity
                  style={[styles.shopBtn, { backgroundColor: tint, borderColor: primary }]}
                  onPress={() => setShowItemPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.shopBtnText, { color: primary }]}>
                    {t('mascot.decorate')}
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

        {/* Aperçu des 6 stades */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <Text style={[styles.familyTitle, { color: colors.text }]}>
            {t('mascot.screen.allStages')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stagesScroll}
          >
            {TREE_STAGES.map((s, idx) => {
              const isCurrent = s.stage === stageInfo.stage;
              const isReached = stageIdx >= idx;
              return (
                <View
                  key={s.stage}
                  style={[
                    styles.stageSlot,
                    { backgroundColor: colors.card, borderColor: isCurrent ? sp.accent : colors.borderLight },
                    isCurrent && { borderWidth: 2 },
                  ]}
                >
                  <View style={{ opacity: isReached ? 1 : 0.35 }}>
                    <TreeView species={species} level={s.minLevel} size={80} showGround interactive={false} />
                  </View>
                  <Text style={[styles.stageSlotName, { color: isCurrent ? sp.accent : isReached ? colors.text : colors.textFaint }]}>
                    {t(s.labelKey)}
                  </Text>
                  <Text style={[styles.stageSlotLevels, { color: colors.textMuted }]}>
                    {t('mascot.screen.stageLevels', { min: s.minLevel, max: s.maxLevel })}
                  </Text>
                  {isCurrent && (
                    <View style={[styles.currentDot, { backgroundColor: sp.accent }]} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>

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
          onCollect={handleCollectBuilding}
          onUpgrade={handleUpgradeBuilding}
          onClose={() => { setShowBuildingDetail(false); setSelectedBuilding(null); }}
        />
      )}
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
    overflow: 'hidden',
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
  actionBtns: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.md,
  },
  shopBtn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  shopBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
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
