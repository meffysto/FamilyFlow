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
import { FarmPlots, FarmStats } from '../../components/mascot/FarmPlots';
import { useFarm } from '../../hooks/useFarm';
import { type PlantedCrop, CROP_CATALOG } from '../../lib/mascot/types';
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

export default function TreeScreen() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const { profiles, activeProfile, updateTreeSpecies, buyMascotItem, placeMascotItem } = useVault();
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
  const { plant, harvest } = useFarm();
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);

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

  /** Tap sur une parcelle de ferme */
  const handlePlotPress = useCallback((plotIndex: number, crop: PlantedCrop | null) => {
    if (!profile || !isOwnTree) return;
    if (crop && crop.currentStage >= 4) {
      // Recolter
      harvest(profile.id, plotIndex).then((reward) => {
        if (reward > 0) {
          showToast(`+${reward} 🍃`);
        }
      });
    } else if (!crop) {
      // Ouvrir le picker de graines
      setSelectedPlotIndex(plotIndex);
      setShowSeedPicker(true);
    }
  }, [profile, isOwnTree, harvest, showToast]);

  /** Planter une graine sur la parcelle selectionnee */
  const handleSeedSelect = useCallback(async (cropId: string) => {
    if (!profile || selectedPlotIndex === null) return;
    try {
      await plant(profile.id, selectedPlotIndex, cropId);
      const cropDef = CROP_CATALOG.find(c => c.id === cropId);
      showToast(`${cropDef?.emoji ?? '🌱'} Plante !`);
    } catch {
      showToast(t('common.error'), 'error');
    }
    setShowSeedPicker(false);
    setSelectedPlotIndex(null);
  }, [profile, selectedPlotIndex, plant, showToast, t]);

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

        {/* Modal choix de graine */}
        <Modal
          visible={showSeedPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSeedPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowSeedPicker(false)}
          >
            <View style={[styles.pickerCard, { backgroundColor: colors.card }, Shadows.lg]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                Choisir une graine
              </Text>
              <View style={styles.pickerGrid}>
                {CROP_CATALOG.map(crop => {
                  const stageOrder = ['graine', 'pousse', 'arbuste', 'arbre', 'majestueux', 'legendaire'];
                  const unlocked = stageOrder.indexOf(stageInfo.stage) >= stageOrder.indexOf(crop.minTreeStage);
                  const stageName = t(`mascot.stages.${crop.minTreeStage}`);
                  return (
                    <TouchableOpacity
                      key={crop.id}
                      onPress={unlocked ? () => handleSeedSelect(crop.id) : undefined}
                      activeOpacity={unlocked ? 0.7 : 1}
                      style={[
                        styles.pickerItem,
                        { backgroundColor: colors.cardAlt, borderColor: colors.borderLight },
                        !unlocked && { opacity: 0.4 },
                      ]}
                    >
                      <Text style={styles.pickerEmoji}>{crop.emoji}</Text>
                      {unlocked ? (
                        <Text style={{ color: colors.textSub, fontSize: 10, marginTop: 2 }}>
                          {crop.cost} 🍃
                        </Text>
                      ) : (
                        <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 2, textAlign: 'center' }}>
                          🔒 {stageName}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => setShowSeedPicker(false)}
                style={[styles.pickerCloseBtn, { borderColor: colors.borderLight }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerCloseText, { color: colors.textSub }]}>
                  Annuler
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Arbre principal — diorama saisonnier immersif (full-bleed) */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.treeContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={hapticsTreeTap}
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

            {/* Couche 3 : Parcelles de culture */}
            <FarmPlots
              treeStage={stageInfo.stage}
              farmCropsCSV={profile.farmCrops ?? ''}
              containerWidth={SCREEN_W}
              containerHeight={DIORAMA_HEIGHT_BY_STAGE[stageIdx] ?? SCREEN_H * 0.60}
              onPlotPress={isOwnTree ? handlePlotPress : undefined}
            />

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

          </TouchableOpacity>
        </Animated.View>


        {/* Transition douce diorama → contenu : gradient sol → fond de page */}
        <LinearGradient
          colors={[PIXEL_GROUND_DARK[season], colors.bg]}
          style={styles.groundTransition}
        />

        {/* Compteur ferme */}
        <FarmStats farmCropsCSV={profile.farmCrops ?? ''} colors={colors} />

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
          onBuy={handleShopBuy}
          onClose={() => setShowShop(false)}
        />
      </Modal>
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
});
