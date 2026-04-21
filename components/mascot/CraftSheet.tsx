/**
 * CraftSheet.tsx — Atelier de craft (bottom sheet)
 *
 * 3 onglets : Recettes (catalogue), Inventaire (recoltes brutes), Mes creations.
 * Catalogue : grille 2 colonnes groupee par stade d'arbre, avec filtre Tout/Disponibles,
 * sections verrouillee/grisees, et mini-modal detail au tap.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { format, parseISO } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import {
  CRAFT_RECIPES,
  canCraft,
  maxCraftableQty,
} from '../../lib/mascot/craft-engine';
import { parseGiftHistory } from '../../lib/mascot/gift-engine';
import type { GiftHistoryEntry } from '../../lib/mascot/gift-engine';
import {
  CROP_CATALOG,
  BUILDING_CATALOG,
  TREE_STAGES,
  TREE_STAGE_ORDER,
  type TreeStage,
  type CraftRecipe,
  type CraftedItem,
  type HarvestInventory,
  type FarmInventory,
} from '../../lib/mascot/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

// ── Types ──────────────────────────────────────

type CraftTab = 'catalogue' | 'inventaire' | 'creations';
type FilterMode = 'all' | 'craftable';

interface CraftSheetProps {
  visible: boolean;
  onClose: () => void;
  profileId: string;
  coins: number;
  harvestInventory: HarvestInventory;
  farmInventory: FarmInventory;
  craftedItems: CraftedItem[];
  treeStage: TreeStage;
  onCraft: (recipeId: string, qty?: number) => Promise<CraftedItem[] | CraftedItem | null>;
  onSellHarvest: (cropId: string, qty: number) => Promise<number>;
  onSellCrafted: (recipeId: string, qty: number) => Promise<number>;
  onOfferItem?: (itemType: string, itemId: string, maxQty: number, itemName: string) => void;
  giftHistory?: string;
  unlockedRecipes?: string[];
}

// ── Noms de ressources batiment ──────────────────────

const RESOURCE_EMOJI: Record<string, string> = {
  oeuf: '🥚',
  lait: '🥛',
  farine: '🫓',
  miel: '🍯',
};

// ── Emojis par stade ─────────────────────────────────

const CROP_ICON_SPRITES: Record<string, ReturnType<typeof require>> = {
  carrot:       require('../../assets/garden/crops/carrot/icon.png'),
  wheat:        require('../../assets/garden/crops/wheat/icon.png'),
  beetroot:     require('../../assets/garden/crops/beetroot/icon.png'),
  cabbage:      require('../../assets/garden/crops/cabbage/icon.png'),
  tomato:       require('../../assets/garden/crops/tomato/icon.png'),
  potato:       require('../../assets/garden/crops/potato/icon.png'),
  cucumber:     require('../../assets/garden/crops/cucumber/icon.png'),
  corn:         require('../../assets/garden/crops/corn/icon.png'),
  strawberry:   require('../../assets/garden/crops/strawberry/icon.png'),
  sunflower:    require('../../assets/garden/crops/sunflower/icon.png'),
  pumpkin:      require('../../assets/garden/crops/pumpkin/icon.png'),
  orchidee:     require('../../assets/garden/crops/orchidee/icon.png'),
  truffe:       require('../../assets/garden/crops/truffe/icon.png'),
  rose_doree:   require('../../assets/garden/crops/rose_doree/icon.png'),
  fruit_dragon: require('../../assets/garden/crops/fruit_dragon/icon.png'),
};

const STAGE_EMOJI: Record<TreeStage, string> = {
  graine:     '🌱',
  pousse:     '🌿',
  arbuste:    '🌳',
  arbre:      '🏔️',
  majestueux: '👑',
  legendaire: '⭐',
};

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── AwningStripes ─────────────────────────────────────

function AwningStripes() {
  const stripes = Array.from({ length: Farm.awningStripeCount });
  return (
    <View style={awningStyles.container}>
      {stripes.map((_, i) => (
        <View
          key={i}
          style={[
            awningStyles.stripe,
            { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
          ]}
        />
      ))}
      {/* Bande de festons marron — ligne de fermeture sous l'auvent */}
      <View style={awningStyles.scallopRow}>
        {stripes.map((_, i) => (
          <View key={i} style={awningStyles.scallop} />
        ))}
      </View>
    </View>
  );
}

const awningStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 28,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 4,
  },
  stripe: {
    flex: 1,
    height: 28,
  },
  scallopRow: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  scallop: {
    flex: 1,
    height: 8,
    backgroundColor: Farm.woodLight,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
});

// ── Composant principal ──────────────────────────────

export function CraftSheet({
  visible,
  onClose,
  profileId,
  coins,
  harvestInventory,
  farmInventory,
  craftedItems,
  treeStage,
  onCraft,
  onSellHarvest,
  onSellCrafted,
  onOfferItem,
  giftHistory,
  unlockedRecipes = [],
}: CraftSheetProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [feedback, setFeedback] = useState<{ emoji: string; text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFeedback = useCallback((emoji: string, text: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ emoji, text, type });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
  }, []);
  const [tab, setTab] = useState<CraftTab>('catalogue');
  const [crafting, setCrafting] = useState<string | null>(null);
  const [selling, setSelling] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<CraftRecipe | null>(null);
  const [craftQty, setCraftQty] = useState<number>(1);

  // Animation bounce sur le bouton craft
  const craftBtnScale = useSharedValue(1);
  const craftBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: craftBtnScale.value }],
  }));

  // Animation press bouton craft (3D translateY)
  const craftBtnY = useSharedValue(0);
  const craftBtnYStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: craftBtnY.value }],
  }));

  // ── Handlers ──────────────────────────────────

  const handleCraft = useCallback(async (recipe: CraftRecipe, qty: number = 1) => {
    setCrafting(recipe.id);
    try {
      const result = await onCraft(recipe.id, qty);
      const success = Array.isArray(result) ? result.length > 0 : !!result;
      if (success) {
        craftBtnScale.value = withSequence(
          withSpring(0.85, { damping: 8, stiffness: 300 }),
          withSpring(1, { damping: 6, stiffness: 200 }),
        );
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        const name = t(recipe.labelKey);
        const displayName = qty > 1 ? `${name} ×${qty}` : name;
        showFeedback(recipe.emoji, t('craft.craftReussi', { emoji: '', name: displayName }).replace(/^\s+/, ''), 'success');
      }
    } catch {
      showFeedback('⚠️', t('common.error'), 'error');
    }
    setCrafting(null);
  }, [onCraft, craftBtnScale, showFeedback, t]);

  const [sellQty, setSellQty] = useState<Record<string, number>>({});

  const getSellQty = useCallback((id: string) => sellQty[id] ?? 1, [sellQty]);
  const adjustSellQty = useCallback((id: string, delta: number, max: number) => {
    setSellQty(prev => {
      const current = prev[id] ?? 1;
      const next = Math.max(1, Math.min(max, current + delta));
      return { ...prev, [id]: next };
    });
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  }, []);

  const handleSellHarvest = useCallback(async (cropId: string) => {
    const qty = sellQty[cropId] ?? 1;
    setSelling(cropId);
    try {
      const amount = await onSellHarvest(cropId, qty);
      if (amount > 0) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        showFeedback('💰', t('craft.venteReussie', { amount }), 'success');
        setSellQty(prev => { const next = { ...prev }; delete next[cropId]; return next; });
      }
    } catch {
      showFeedback('⚠️', t('common.error'), 'error');
    }
    setSelling(null);
  }, [onSellHarvest, showFeedback, t, sellQty]);

  const handleSellCrafted = useCallback(async (recipeId: string) => {
    const qty = sellQty[recipeId] ?? 1;
    setSelling(recipeId);
    try {
      const amount = await onSellCrafted(recipeId, qty);
      if (amount > 0) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        showFeedback('💰', t('craft.venteReussie', { amount }), 'success');
        setSellQty(prev => { const next = { ...prev }; delete next[recipeId]; return next; });
      }
    } catch {
      showFeedback('⚠️', t('common.error'), 'error');
    }
    setSelling(null);
  }, [onSellCrafted, showFeedback, t, sellQty]);

  // ── Compteur recettes craftables ──────────────

  const craftableCount = useMemo(() => {
    return CRAFT_RECIPES.filter(r => canCraft(r, harvestInventory, farmInventory)).length;
  }, [harvestInventory, farmInventory]);

  // ── Groupement par stade ──────────────────────

  const groupedByStage = useMemo(() => {
    const currentStageIdx = TREE_STAGE_ORDER.indexOf(treeStage);
    return TREE_STAGE_ORDER.map((stage) => {
      const stageInfo = TREE_STAGES.find(s => s.stage === stage)!;
      const stageIdx = TREE_STAGE_ORDER.indexOf(stage);
      const locked = stageIdx > currentStageIdx;
      const allStageRecipes = CRAFT_RECIPES.filter(r =>
        r.minTreeStage === stage && (!r.requiredUnlock || unlockedRecipes.includes(r.requiredUnlock))
      );
      if (allStageRecipes.length === 0) return null;
      const recipes = filterMode === 'craftable' && !locked
        ? allStageRecipes.filter(r => canCraft(r, harvestInventory, farmInventory))
        : allStageRecipes;
      return { stage, stageInfo, recipes, locked, totalCount: allStageRecipes.length };
    }).filter(Boolean) as Array<{
      stage: TreeStage;
      stageInfo: typeof TREE_STAGES[0];
      recipes: CraftRecipe[];
      locked: boolean;
      totalCount: number;
    }>;
  }, [treeStage, filterMode, harvestInventory, farmInventory]);

  // ── Tab : Catalogue (Recettes) ────────────────

  const renderCatalogue = () => (
    <View style={{ flex: 1 }}>
      {/* Chips filtre */}
      <View style={styles.catChipRow}>
        <TouchableOpacity
          style={[
            styles.catChip,
            filterMode === 'all'
              ? { backgroundColor: Farm.woodBtn }
              : { backgroundColor: Farm.parchmentDark },
          ]}
          onPress={() => setFilterMode('all')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.catChipText,
            { color: filterMode === 'all' ? Farm.parchment : Farm.brownTextSub },
          ]}>
            {t('craft.filtreToutes')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.catChip,
            filterMode === 'craftable'
              ? { backgroundColor: Farm.woodBtn }
              : { backgroundColor: Farm.parchmentDark },
          ]}
          onPress={() => setFilterMode('craftable')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.catChipText,
            { color: filterMode === 'craftable' ? Farm.parchment : Farm.brownTextSub },
          ]}>
            {t('craft.filtreDisponibles', { count: craftableCount })}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.catScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {groupedByStage.map(({ stage, stageInfo, recipes, locked, totalCount }) => (
          <View key={stage}>
            {/* Header de section stade */}
            <View style={styles.catSectionHeader}>
              <Text style={styles.catSectionEmoji}>
                {locked ? '🔒' : STAGE_EMOJI[stage]}
              </Text>
              <Text style={styles.catSectionLabel}>
                {t(stageInfo.labelKey)}
              </Text>
              <Text style={styles.catSectionLevel}>
                {' '}{t('craft.niveauRequis', { level: stageInfo.minLevel })}
              </Text>
              <View style={styles.catSectionSpacer} />
              <View style={styles.catSectionBadge}>
                <Text style={styles.catSectionBadgeText}>
                  {filterMode === 'craftable' && !locked ? recipes.length : totalCount}
                </Text>
              </View>
            </View>

            {/* Grille 2 colonnes */}
            <View style={styles.catGrid}>
              {recipes.map((recipe, idx) => {
                const craftable = !locked && canCraft(recipe, harvestInventory, farmInventory);
                return (
                  <Animated.View
                    key={recipe.id}
                    entering={FadeInDown.delay(idx * 40).duration(250)}
                    style={styles.catCardWrapper}
                  >
                    <TouchableOpacity
                      style={[
                        styles.catCard,
                        craftable && { borderColor: Farm.greenBtn, borderWidth: 1.5 },
                        !craftable && !locked && { borderColor: Farm.woodHighlight, borderWidth: 1.5 },
                        locked && { opacity: 0.5, borderColor: Farm.woodHighlight, borderWidth: 1.5 },
                      ]}
                      onPress={locked ? undefined : () => { setCraftQty(1); setSelectedRecipe(recipe); }}
                      activeOpacity={locked ? 1 : 0.7}
                      disabled={locked}
                    >
                      {/* Sprite/Emoji + badge craftable */}
                      <View style={styles.catCardEmojiRow}>
                        {recipe.sprite ? (
                          <Image source={recipe.sprite} style={styles.catCardSprite} />
                        ) : (
                          <Text style={styles.catCardEmoji}>{recipe.emoji}</Text>
                        )}
                        {craftable && (
                          <View style={[styles.catCraftableBadge, { backgroundColor: Farm.greenBtn }]}>
                            <Text style={styles.catCraftableBadgeText}>{'✓'}</Text>
                          </View>
                        )}
                        {locked && (
                          <View style={styles.catLockOverlay}>
                            <Text style={styles.catLockBadge}>{'🔒'}</Text>
                          </View>
                        )}
                      </View>

                      {/* Nom */}
                      <Text
                        style={styles.catCardName}
                        numberOfLines={1}
                      >
                        {t(recipe.labelKey)}
                      </Text>

                      {/* Valeur + XP */}
                      <Text style={styles.catCardValue}>
                        {recipe.sellValue}{' 🍃 +'}{recipe.xpBonus}{'XP'}
                      </Text>

                      {/* Emojis ingredients */}
                      <View style={styles.catDotRow}>
                        {recipe.ingredients.map((ing) => {
                          const have = ing.source === 'crop'
                            ? (harvestInventory[ing.itemId] ?? 0)
                            : (farmInventory[ing.itemId as keyof FarmInventory] ?? 0);
                          const enough = have >= ing.quantity;
                          const cropDef = ing.source === 'crop'
                            ? CROP_CATALOG.find(c => c.id === ing.itemId)
                            : null;
                          const emoji = ing.source === 'crop'
                            ? (cropDef?.emoji ?? '?')
                            : (RESOURCE_EMOJI[ing.itemId] ?? '?');
                          return (
                            <View
                              key={ing.itemId}
                              style={[
                                styles.catIngBadge,
                                { backgroundColor: enough ? (colors.success + '22') : (colors.error + '22') },
                              ]}
                            >
                              <Text style={styles.catIngEmoji}>{emoji}</Text>
                              {ing.quantity > 1 && (
                                <Text style={[styles.catIngQty, { color: enough ? colors.success : colors.error }]}>
                                  {ing.quantity}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
              {/* Remplissage si nombre impair */}
              {recipes.length % 2 !== 0 && <View style={styles.catCardWrapper} />}
            </View>
          </View>
        ))}
        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      {/* Mini-modal detail recette */}
      {selectedRecipe !== null && (
        <Modal
          transparent
          animationType="fade"
          visible={selectedRecipe !== null}
          onRequestClose={() => setSelectedRecipe(null)}
        >
          <TouchableOpacity
            style={styles.catModalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedRecipe(null)}
          >
            <TouchableOpacity
              style={[styles.catModalContent, Shadows.lg]}
              activeOpacity={1}
              onPress={() => { /* empêche la fermeture au tap sur le contenu */ }}
            >
              {/* Bouton fermer */}
              <TouchableOpacity
                style={styles.catModalClose}
                onPress={() => setSelectedRecipe(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.catModalCloseText}>{'✕'}</Text>
              </TouchableOpacity>

              {/* Header */}
              {selectedRecipe.sprite ? (
                <Image source={selectedRecipe.sprite} style={styles.catModalSprite} />
              ) : (
                <Text style={styles.catModalEmoji}>{selectedRecipe.emoji}</Text>
              )}
              <Text style={styles.catModalTitle}>
                {t(selectedRecipe.labelKey)}
              </Text>
              <Text style={styles.catModalValue}>
                {t('craft.valeurVente', { amount: selectedRecipe.sellValue })}
                {selectedRecipe.xpBonus > 0 ? `  +${selectedRecipe.xpBonus} XP` : ''}
              </Text>

              {/* Ingredients */}
              <ScrollView style={styles.catModalIngList} showsVerticalScrollIndicator={false}>
                <Text style={styles.ingredientsTitle}>
                  {t('craft.ingredients')}
                </Text>
                {selectedRecipe.ingredients.map((ing) => {
                  const have = ing.source === 'crop'
                    ? (harvestInventory[ing.itemId] ?? 0)
                    : (farmInventory[ing.itemId as keyof FarmInventory] ?? 0);
                  const enough = have >= ing.quantity;
                  const cropDef = ing.source === 'crop'
                    ? CROP_CATALOG.find(c => c.id === ing.itemId)
                    : null;
                  const emoji = ing.source === 'crop'
                    ? (cropDef?.emoji ?? '?')
                    : (RESOURCE_EMOJI[ing.itemId] ?? '?');
                  const name = ing.source === 'crop'
                    ? (cropDef ? t(cropDef.labelKey) : ing.itemId)
                    : t(`farm.building.resource.${ing.itemId}`);

                  const hint = !enough
                    ? ing.source === 'crop'
                      ? t('craft.hintPlant', { name })
                      : (() => {
                          const bld = BUILDING_CATALOG.find(b => b.resourceType === ing.itemId);
                          const bldName = bld ? t(bld.labelKey) : t('craft.hintBuildingGeneric', 'un bâtiment');
                          return t('craft.hintBuilding', { name: bldName });
                        })()
                    : null;

                  return (
                    <View key={ing.itemId} style={styles.ingredientBlock}>
                      <View style={styles.ingredientRow}>
                        <Text style={styles.ingredientEmoji}>{emoji}</Text>
                        <Text style={styles.ingredientName}>
                          {name}
                        </Text>
                        <Text style={[
                          styles.ingredientQty,
                          { color: enough ? colors.success : colors.error },
                        ]}>
                          {have}/{ing.quantity}
                        </Text>
                      </View>
                      {hint && (
                        <Text style={styles.ingredientHint}>
                          {'💡 '}{hint}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Selector qty + Bouton Crafter — FarmButton 3D */}
              {(() => {
                const maxQty = maxCraftableQty(selectedRecipe, harvestInventory, farmInventory);
                const craftable = maxQty >= 1;
                const isCurrentlyCrafting = crafting === selectedRecipe.id;
                const clampedQty = Math.min(Math.max(1, craftQty), Math.max(1, maxQty));
                const adjustQty = (delta: number) => {
                  setCraftQty((prev) => {
                    const base = Math.min(Math.max(1, prev), Math.max(1, maxQty));
                    const next = Math.max(1, Math.min(maxQty, base + delta));
                    return next;
                  });
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                };
                return (
                  <View style={styles.craftActionRow}>
                    {craftable && maxQty > 1 && (
                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          onPress={() => adjustQty(-1)}
                          style={styles.qtyBtn}
                          activeOpacity={0.7}
                          disabled={clampedQty <= 1}
                        >
                          <Text style={[styles.qtyBtnText, clampedQty <= 1 && { opacity: 0.3 }]}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{clampedQty}</Text>
                        <TouchableOpacity
                          onPress={() => adjustQty(1)}
                          style={styles.qtyBtn}
                          activeOpacity={0.7}
                          disabled={clampedQty >= maxQty}
                        >
                          <Text style={[styles.qtyBtnText, clampedQty >= maxQty && { opacity: 0.3 }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <Animated.View style={[styles.craftBtnFlex, craftable ? craftBtnAnimStyle : undefined, craftBtnYStyle]}>
                      <Pressable
                        onPressIn={() => {
                          if (craftable && !isCurrentlyCrafting) {
                            craftBtnY.value = withSpring(4, SPRING_CONFIG);
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                          }
                        }}
                        onPressOut={() => {
                          craftBtnY.value = withSpring(0, SPRING_CONFIG);
                        }}
                        onPress={craftable && !isCurrentlyCrafting
                          ? async () => {
                              const r = selectedRecipe;
                              const qtyToCraft = clampedQty;
                              setSelectedRecipe(null);
                              setCraftQty(1);
                              await handleCraft(r, qtyToCraft);
                            }
                          : undefined}
                        disabled={!craftable || isCurrentlyCrafting}
                        style={[
                          styles.craftBtnOuter,
                          craftable
                            ? { backgroundColor: Farm.greenBtnShadow }
                            : { backgroundColor: '#D0CBC3' },
                        ]}
                      >
                        <View style={[
                          styles.craftBtnInner,
                          craftable
                            ? { backgroundColor: Farm.greenBtn }
                            : { backgroundColor: Farm.parchmentDark },
                          isCurrentlyCrafting && { opacity: 0.6 },
                        ]}>
                          {/* Gloss highlight */}
                          {craftable && (
                            <View style={styles.craftBtnGloss} pointerEvents="none" />
                          )}
                          <Text style={[
                            styles.craftBtnText,
                            { color: craftable ? Farm.parchment : Farm.brownTextSub },
                          ]}>
                            {craftable && clampedQty > 1
                              ? `${t('craft.crafter')} ×${clampedQty}`
                              : t('craft.crafter')}
                          </Text>
                        </View>
                      </Pressable>
                    </Animated.View>
                  </View>
                );
              })()}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );

  // ── Tab : Inventaire (recoltes brutes) ────────

  const harvestEntries = useMemo(() => {
    return Object.entries(harvestInventory)
      .filter(([, qty]) => qty > 0)
      .map(([cropId, qty]) => {
        const cropDef = CROP_CATALOG.find(c => c.id === cropId);
        return { cropId, qty, cropDef };
      });
  }, [harvestInventory]);

  const resourceEntries = useMemo(() => {
    return (Object.entries(farmInventory) as [string, number][])
      .filter(([, qty]) => qty > 0)
      .map(([resourceId, qty]) => ({
        resourceId,
        qty,
        emoji: RESOURCE_EMOJI[resourceId] ?? '?',
        labelKey: `farm.building.resource.${resourceId}`,
      }));
  }, [farmInventory]);

  // Historique cadeaux
  const giftHistoryEntries = useMemo((): GiftHistoryEntry[] => {
    return parseGiftHistory(giftHistory);
  }, [giftHistory]);

  const renderInventaire = () => (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {harvestEntries.length === 0 && resourceEntries.length === 0 && (
        <Text style={styles.emptyText}>
          {t('craft.aucuneRecolte')}
        </Text>
      )}
      {/* Récoltes */}
      {harvestEntries.length > 0 && (
        <Text style={styles.sectionLabel}>
          {t('craft.recoltes', '🌱 Récoltes')}
        </Text>
      )}
      {harvestEntries.map(({ cropId, qty, cropDef }, idx) => {
        const cropName = cropDef ? t(cropDef.labelKey) : cropId;
        const currentQty = getSellQty(cropId);
        const clampedQty = Math.min(currentQty, qty);
        const unitPrice = cropDef?.harvestReward ?? 0;
        return (
          <Animated.View key={cropId} entering={FadeInDown.delay(idx * 60).duration(300)}>
            <View style={styles.inventoryRow}>
              {CROP_ICON_SPRITES[cropId] ? (
                <Image source={CROP_ICON_SPRITES[cropId]} style={styles.inventorySprite} />
              ) : (
                <Text style={styles.inventoryEmoji}>{cropDef?.emoji ?? '?'}</Text>
              )}
              <View style={styles.inventoryInfo}>
                <Text style={styles.inventoryName}>
                  {cropName}
                </Text>
                <Text style={styles.inventoryQty}>
                  x{qty} — {unitPrice} 🍃/{t('craft.vendre').toLowerCase()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.giftBtn}
                onPress={() => onOfferItem?.('harvest', cropId, qty, cropName)}
                activeOpacity={0.7}
              >
                <Text style={styles.giftBtnText}>{'🎁'}</Text>
              </TouchableOpacity>
              {qty > 1 && (
                <View style={styles.qtySelector}>
                  <TouchableOpacity onPress={() => adjustSellQty(cropId, -1, qty)} style={styles.qtyBtn} activeOpacity={0.7}>
                    <Text style={[styles.qtyBtnText, clampedQty <= 1 && { opacity: 0.3 }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{clampedQty}</Text>
                  <TouchableOpacity onPress={() => adjustSellQty(cropId, 1, qty)} style={styles.qtyBtn} activeOpacity={0.7}>
                    <Text style={[styles.qtyBtnText, clampedQty >= qty && { opacity: 0.3 }]}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.sellBtn,
                  selling === cropId && { opacity: 0.5 },
                ]}
                onPress={() => handleSellHarvest(cropId)}
                disabled={selling === cropId}
                activeOpacity={0.7}
              >
                <Text style={styles.sellBtnText}>
                  {clampedQty > 1 ? `${unitPrice * clampedQty} 🍃` : t('craft.vendre')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      })}
      {/* Ressources bâtiments */}
      {resourceEntries.length > 0 && (
        <Text style={[styles.sectionLabel, { marginTop: harvestEntries.length > 0 ? Spacing.lg : 0 }]}>
          {t('craft.ressources', '🏠 Ressources')}
        </Text>
      )}
      {resourceEntries.map(({ resourceId, qty, emoji, labelKey }, idx) => {
        const resName = t(labelKey);
        return (
          <Animated.View key={resourceId} entering={FadeInDown.delay((harvestEntries.length + idx) * 60).duration(300)}>
            <View style={styles.inventoryRow}>
              <Text style={styles.inventoryEmoji}>{emoji}</Text>
              <View style={styles.inventoryInfo}>
                <Text style={styles.inventoryName}>
                  {resName}
                </Text>
                <Text style={styles.inventoryQty}>
                  x{qty}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.giftBtn}
                onPress={() => onOfferItem?.('building_resource', resourceId, qty, resName)}
                activeOpacity={0.7}
              >
                <Text style={styles.giftBtnText}>{'🎁'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      })}
      {/* Historique cadeaux */}
      {giftHistoryEntries.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>
            {t('gamification:gift_history_title')}
          </Text>
          {giftHistoryEntries.map((entry, idx) => {
            let dateStr = '';
            try {
              dateStr = format(parseISO(entry.date), 'dd/MM/yyyy');
            } catch {
              dateStr = entry.date.slice(0, 10);
            }
            const isReceived = entry.direction === 'received';
            return (
              <Animated.View key={idx} entering={FadeInDown.delay(idx * 40).duration(250)}>
                <View style={styles.giftHistoryRow}>
                  <Text style={styles.giftHistoryIcon}>{isReceived ? '📥' : '📤'}</Text>
                  <View style={styles.giftHistoryInfo}>
                    <Text style={styles.giftHistoryItem} numberOfLines={1}>
                      {entry.itemId}{' x'}{entry.quantity}
                    </Text>
                    <Text style={styles.giftHistoryMeta} numberOfLines={1}>
                      {isReceived
                        ? t('gamification:gift_history_received', { name: entry.fromId })
                        : t('gamification:gift_history_sent', { name: entry.toId })
                      }{' · '}{dateStr}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </>
      )}
      <View style={{ height: Spacing['3xl'] }} />
    </ScrollView>
  );

  // ── Tab : Mes creations (items craftes) ───────

  const craftedGroups = useMemo(() => {
    const groups: Record<string, { recipe: CraftRecipe; count: number }> = {};
    for (const item of craftedItems) {
      const recipe = CRAFT_RECIPES.find(r => r.id === item.recipeId);
      if (!recipe) continue;
      if (!groups[item.recipeId]) {
        groups[item.recipeId] = { recipe, count: 0 };
      }
      groups[item.recipeId].count++;
    }
    return Object.values(groups);
  }, [craftedItems]);

  const renderCreations = () => (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {craftedGroups.length === 0 && (
        <Text style={styles.emptyText}>
          {t('craft.aucunItem')}
        </Text>
      )}
      {craftedGroups.map(({ recipe, count }, idx) => {
        const recipeName = t(recipe.labelKey);
        const currentQty = getSellQty(recipe.id);
        const clampedQty = Math.min(currentQty, count);
        return (
          <Animated.View key={recipe.id} entering={FadeInDown.delay(idx * 60).duration(300)}>
            <View style={styles.inventoryRow}>
              {recipe.sprite ? (
                <Image source={recipe.sprite} style={styles.inventorySprite} />
              ) : (
                <Text style={styles.inventoryEmoji}>{recipe.emoji}</Text>
              )}
              <View style={styles.inventoryInfo}>
                <Text style={styles.inventoryName}>
                  {recipeName}
                </Text>
                <Text style={styles.inventoryQty}>
                  x{count} — {recipe.sellValue} 🍃 + {recipe.xpBonus} XP
                </Text>
              </View>
              <TouchableOpacity
                style={styles.giftBtn}
                onPress={() => onOfferItem?.('crafted', recipe.id, count, recipeName)}
                activeOpacity={0.7}
              >
                <Text style={styles.giftBtnText}>{'🎁'}</Text>
              </TouchableOpacity>
              {count > 1 && (
                <View style={styles.qtySelector}>
                  <TouchableOpacity onPress={() => adjustSellQty(recipe.id, -1, count)} style={styles.qtyBtn} activeOpacity={0.7}>
                    <Text style={[styles.qtyBtnText, clampedQty <= 1 && { opacity: 0.3 }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{clampedQty}</Text>
                  <TouchableOpacity onPress={() => adjustSellQty(recipe.id, 1, count)} style={styles.qtyBtn} activeOpacity={0.7}>
                    <Text style={[styles.qtyBtnText, clampedQty >= count && { opacity: 0.3 }]}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.sellBtn,
                  selling === recipe.id && { opacity: 0.5 },
                ]}
                onPress={() => handleSellCrafted(recipe.id)}
                disabled={selling === recipe.id}
                activeOpacity={0.7}
              >
                <Text style={styles.sellBtnText}>
                  {clampedQty > 1 ? `${recipe.sellValue * clampedQty} 🍃` : t('craft.vendre')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      })}
      <View style={{ height: Spacing['3xl'] }} />
    </ScrollView>
  );

  // ── Rendu ─────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Auvent */}
        <AwningStripes />

        {/* Contenu parchemin */}
        <View style={styles.parchment}>
          {/* Bouton fermer */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>{'✕'}</Text>
          </TouchableOpacity>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header : titre centré + badge coins en dessous (pattern Boutique) */}
              <View style={styles.headerRow}>
                <Text style={styles.title}>
                  {t('craft.atelier')}
                </Text>
                <View style={styles.coinsBadge}>
                  <Text style={styles.coinsText}>
                    {t('mascot.shop.yourLeaves', { count: coins })}
                  </Text>
                </View>
              </View>

              {/* Onglets */}
              <View style={styles.tabsRow}>
                {(['catalogue', 'inventaire', 'creations'] as CraftTab[]).map((tabKey) => {
                  const labels: Record<CraftTab, string> = {
                    catalogue: t('craft.catalogue'),
                    inventaire: t('craft.inventaire'),
                    creations: t('craft.mesCreations'),
                  };
                  const active = tab === tabKey;
                  return (
                    <TouchableOpacity
                      key={tabKey}
                      style={[styles.tabItem, active && styles.tabItemActive]}
                      onPress={() => setTab(tabKey)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>
                        {labels[tabKey]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bandeau feedback inline (par-dessus le contenu du sheet) */}
              {feedback && (
                <Animated.View
                  entering={FadeInDown.duration(250)}
                  exiting={FadeOutUp.duration(200)}
                  style={[
                    styles.feedbackBanner,
                    {
                      backgroundColor: feedback.type === 'success' ? '#4ADE80'
                        : feedback.type === 'error' ? '#FCA5A5'
                        : Farm.parchmentDark,
                    },
                  ]}
                >
                  <Text style={styles.feedbackEmoji}>{feedback.emoji}</Text>
                  <Text
                    style={[
                      styles.feedbackText,
                      {
                        color: feedback.type === 'success' ? '#065F46'
                          : feedback.type === 'error' ? '#7F1D1D'
                          : Farm.brownText,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {feedback.text}
                  </Text>
                </Animated.View>
              )}

              {/* Contenu de l'onglet actif */}
              <View style={{ flex: 1 }}>
                {tab === 'catalogue' && renderCatalogue()}
                {tab === 'inventaire' && renderInventaire()}
                {tab === 'creations' && renderCreations()}
              </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Farm.parchmentDark,
  },

  // ── Bouton fermer ──
  closeBtn: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing['2xl'],
    width: 32,
    height: 32,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: Farm.parchment,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },

  // ── Parchemin ──
  parchment: {
    flex: 1,
    backgroundColor: Farm.parchmentDark,
  },

  // ── Handle seul ──
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  // ── Badge coins à droite du titre (pattern Boutique) ──
  coinsBadge: {
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  coinsText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
  },
  // ── Header colonne centrée (pattern Boutique) ──
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  // ── Onglets ──
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.lg,
    padding: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: 'transparent',
  },
  tabItemActive: {
    backgroundColor: Farm.woodBtn,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
  },
  tabTextActive: {
    color: Farm.parchment,
  },

  // ── Bandeau feedback inline (pattern TechTreeSheet) ──
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  feedbackEmoji: {
    fontSize: 20,
  },
  feedbackText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // ── Contenu commun ──
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSize.body,
    color: Farm.brownText,
    marginTop: Spacing['3xl'],
  },

  // ── Catalogue — chips filtre ──
  catChipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  catChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
  },
  catChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // ── Catalogue — scroll ──
  catScrollContent: {
    paddingBottom: Spacing['3xl'],
  },

  // ── Catalogue — header de section ──
  catSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Farm.woodHighlight,
    marginBottom: Spacing.sm,
  },
  catSectionEmoji: {
    fontSize: FontSize.body,
    marginRight: Spacing.xs,
  },
  catSectionLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  catSectionLevel: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
  },
  catSectionSpacer: {
    flex: 1,
  },
  catSectionBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
  },
  catSectionBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },

  // ── Catalogue — grille ──
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  catCardWrapper: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: Spacing.sm,
  },
  catCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
  },

  // ── Catalogue — carte ──
  catCardEmojiRow: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  catCardEmoji: {
    fontSize: 32,
  },
  catCardSprite: {
    width: 32,
    height: 32,
  },
  catCraftableBadge: {
    position: 'absolute',
    top: -2,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCraftableBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  catLockOverlay: {
    position: 'absolute',
    top: 0,
    right: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLockBadge: {
    fontSize: 14,
  },
  catCardName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
    color: Farm.brownText,
  },
  catCardValue: {
    fontSize: FontSize.micro,
    marginBottom: Spacing.xs,
    color: Farm.brownTextSub,
  },
  catDotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  catIngBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
  },
  catIngEmoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  catIngQty: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },

  // ── Catalogue — modal detail ──
  catModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catModalContent: {
    width: '85%',
    maxHeight: '60%',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
  },
  catModalClose: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  catModalCloseText: {
    color: Farm.parchment,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },
  catModalEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  catModalSprite: {
    width: 48,
    height: 48,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  catModalTitle: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: 2,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  catModalValue: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginBottom: Spacing.md,
    color: Farm.brownTextSub,
  },
  catModalIngList: {
    maxHeight: 200,
    marginBottom: Spacing.md,
  },

  // ── Catalogue existant (recipeCard conservé pour compatibilité) ──
  recipeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Farm.parchmentDark,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  recipeEmoji: {
    fontSize: 36,
    marginRight: Spacing.md,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
    color: Farm.brownText,
  },
  recipeSellValue: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
  },
  ingredientsList: {
    marginBottom: Spacing.md,
  },
  ingredientsTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    color: Farm.brownTextSub,
  },
  ingredientBlock: {
    paddingVertical: Spacing.xs,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientHint: {
    fontSize: FontSize.micro,
    marginLeft: 28,
    marginTop: 2,
    color: Farm.brownTextSub,
  },
  ingredientEmoji: {
    fontSize: 18,
    width: 28,
  },
  ingredientName: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Farm.brownTextSub,
  },
  ingredientQty: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // ── Action row (selector + bouton craft) ──
  craftActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  craftBtnFlex: {
    flex: 1,
  },

  // ── Bouton craft 3D ──
  craftBtnOuter: {
    borderRadius: Radius.md,
    paddingBottom: 4,
  },
  craftBtnInner: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  craftBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: Farm.greenBtnHighlight,
    opacity: 0.3,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  craftBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },

  // ── Inventaire + Creations ──
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Farm.parchmentDark,
  },
  inventoryEmoji: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  inventorySprite: {
    width: 28,
    height: 28,
    marginRight: Spacing.md,
    resizeMode: 'contain',
  },
  inventoryInfo: {
    flex: 1,
  },
  inventoryName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
    color: Farm.brownText,
  },
  inventoryQty: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
  },
  giftBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  giftBtnText: {
    fontSize: FontSize.body,
  },
  sellBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
  },
  sellBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
  },
  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginRight: Spacing.sm,
  },
  qtyBtn: {
    width: 18,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  qtyValue: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    minWidth: 12,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    color: Farm.brownTextSub,
  },
  giftHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
    backgroundColor: Farm.parchmentDark,
  },
  giftHistoryIcon: {
    fontSize: 18,
  },
  giftHistoryInfo: {
    flex: 1,
  },
  giftHistoryItem: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
  },
  giftHistoryMeta: {
    fontSize: FontSize.caption,
    marginTop: 2,
    color: Farm.brownTextSub,
  },
});
