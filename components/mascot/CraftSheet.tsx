/**
 * CraftSheet.tsx — Atelier de craft (bottom sheet)
 *
 * 3 onglets : Recettes (catalogue), Inventaire (recoltes brutes), Mes creations.
 * Catalogue : grille 2 colonnes groupee par stade d'arbre, avec filtre Tout/Disponibles,
 * sections verrouillee/grisees, et mini-modal detail au tap.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import {
  CRAFT_RECIPES,
  canCraft,
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
  onCraft: (recipeId: string) => Promise<CraftedItem | null>;
  onSellHarvest: (cropId: string) => Promise<number>;
  onSellCrafted: (recipeId: string) => Promise<number>;
  onOfferItem?: (itemType: string, itemId: string, maxQty: number, itemName: string) => void;
  giftHistory?: string;
}

// ── Noms de ressources batiment ──────────────────────

const RESOURCE_EMOJI: Record<string, string> = {
  oeuf: '🥚',
  lait: '🥛',
  farine: '🌾',
  miel: '🍯',
};

// ── Emojis par stade ─────────────────────────────────

const STAGE_EMOJI: Record<TreeStage, string> = {
  graine:     '🌱',
  pousse:     '🌿',
  arbuste:    '🌳',
  arbre:      '🏔️',
  majestueux: '👑',
  legendaire: '⭐',
};

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
}: CraftSheetProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const [tab, setTab] = useState<CraftTab>('catalogue');
  const [crafting, setCrafting] = useState<string | null>(null);
  const [selling, setSelling] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<CraftRecipe | null>(null);

  // Animation bounce sur le bouton craft
  const craftBtnScale = useSharedValue(1);
  const craftBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: craftBtnScale.value }],
  }));

  // ── Handlers ──────────────────────────────────

  const handleCraft = useCallback(async (recipe: CraftRecipe) => {
    setCrafting(recipe.id);
    try {
      const result = await onCraft(recipe.id);
      if (result) {
        craftBtnScale.value = withSequence(
          withSpring(0.85, { damping: 8, stiffness: 300 }),
          withSpring(1, { damping: 6, stiffness: 200 }),
        );
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        showToast(t('craft.craftReussi', { emoji: recipe.emoji, name: t(recipe.labelKey) }));
      }
    } catch {
      showToast(t('common.error'), 'error');
    }
    setCrafting(null);
  }, [onCraft, craftBtnScale, showToast, t]);

  const handleSellHarvest = useCallback(async (cropId: string) => {
    setSelling(cropId);
    try {
      const amount = await onSellHarvest(cropId);
      if (amount > 0) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        showToast(t('craft.venteReussie', { amount }));
      }
    } catch {
      showToast(t('common.error'), 'error');
    }
    setSelling(null);
  }, [onSellHarvest, showToast, t]);

  const handleSellCrafted = useCallback(async (recipeId: string) => {
    setSelling(recipeId);
    try {
      const amount = await onSellCrafted(recipeId);
      if (amount > 0) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        showToast(t('craft.venteReussie', { amount }));
      }
    } catch {
      showToast(t('common.error'), 'error');
    }
    setSelling(null);
  }, [onSellCrafted, showToast, t]);

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
      const allStageRecipes = CRAFT_RECIPES.filter(r => r.minTreeStage === stage);
      if (allStageRecipes.length === 0) return null;
      const recipes = filterMode === 'craftable' && !locked
        ? allStageRecipes.filter(r => canCraft(r, harvestInventory, farmInventory))
        : allStageRecipes;
      // Toujours inclure les stades qui ont des recettes (meme si filtre vide)
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
              ? { backgroundColor: primary }
              : { backgroundColor: tint },
          ]}
          onPress={() => setFilterMode('all')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.catChipText,
            { color: filterMode === 'all' ? colors.onPrimary : primary },
          ]}>
            {t('craft.filtreToutes')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.catChip,
            filterMode === 'craftable'
              ? { backgroundColor: primary }
              : { backgroundColor: tint },
          ]}
          onPress={() => setFilterMode('craftable')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.catChipText,
            { color: filterMode === 'craftable' ? colors.onPrimary : primary },
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
            <View style={[styles.catSectionHeader, { backgroundColor: colors.bg }]}>
              <Text style={styles.catSectionEmoji}>
                {locked ? '🔒' : STAGE_EMOJI[stage]}
              </Text>
              <Text style={[styles.catSectionLabel, { color: colors.text }]}>
                {t(stageInfo.labelKey)}
              </Text>
              <Text style={[styles.catSectionLevel, { color: colors.textMuted }]}>
                {' '}{t('craft.niveauRequis', { level: stageInfo.minLevel })}
              </Text>
              <View style={styles.catSectionSpacer} />
              <View style={[styles.catSectionBadge, { backgroundColor: tint }]}>
                <Text style={[styles.catSectionBadgeText, { color: primary }]}>
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
                        { backgroundColor: colors.card },
                        craftable && { borderColor: colors.success, borderWidth: 1.5 },
                        !craftable && !locked && { borderColor: colors.borderLight, borderWidth: StyleSheet.hairlineWidth },
                        locked && { opacity: 0.5, borderColor: colors.borderLight, borderWidth: StyleSheet.hairlineWidth },
                        Shadows.sm,
                      ]}
                      onPress={locked ? undefined : () => setSelectedRecipe(recipe)}
                      activeOpacity={locked ? 1 : 0.7}
                      disabled={locked}
                    >
                      {/* Emoji + badge craftable */}
                      <View style={styles.catCardEmojiRow}>
                        <Text style={styles.catCardEmoji}>{recipe.emoji}</Text>
                        {craftable && (
                          <View style={[styles.catCraftableBadge, { backgroundColor: colors.success }]}>
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
                        style={[styles.catCardName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {t(recipe.labelKey)}
                      </Text>

                      {/* Valeur + XP */}
                      <Text style={[styles.catCardValue, { color: colors.textMuted }]}>
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
                                { backgroundColor: enough ? colors.successBg : colors.errorBg },
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
              style={[styles.catModalContent, { backgroundColor: colors.card }, Shadows.lg]}
              activeOpacity={1}
              onPress={() => { /* empêche la fermeture au tap sur le contenu */ }}
            >
              {/* Bouton fermer */}
              <TouchableOpacity
                style={styles.catModalClose}
                onPress={() => setSelectedRecipe(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.catModalCloseText, { color: colors.textMuted }]}>{'✕'}</Text>
              </TouchableOpacity>

              {/* Header */}
              <Text style={styles.catModalEmoji}>{selectedRecipe.emoji}</Text>
              <Text style={[styles.catModalTitle, { color: colors.text }]}>
                {t(selectedRecipe.labelKey)}
              </Text>
              <Text style={[styles.catModalValue, { color: colors.textSub }]}>
                {t('craft.valeurVente', { amount: selectedRecipe.sellValue })}
                {selectedRecipe.xpBonus > 0 ? `  +${selectedRecipe.xpBonus} XP` : ''}
              </Text>

              {/* Ingredients */}
              <ScrollView style={styles.catModalIngList} showsVerticalScrollIndicator={false}>
                <Text style={[styles.ingredientsTitle, { color: colors.textMuted }]}>
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
                        <Text style={[styles.ingredientName, { color: colors.textSub }]}>
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
                        <Text style={[styles.ingredientHint, { color: colors.textMuted }]}>
                          {'💡 '}{hint}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Bouton Crafter */}
              <Animated.View style={crafting === selectedRecipe.id ? craftBtnAnimStyle : undefined}>
                <TouchableOpacity
                  style={[
                    styles.craftBtn,
                    {
                      backgroundColor: canCraft(selectedRecipe, harvestInventory, farmInventory)
                        ? primary
                        : colors.cardAlt,
                    },
                    crafting === selectedRecipe.id && { opacity: 0.5 },
                  ]}
                  onPress={canCraft(selectedRecipe, harvestInventory, farmInventory)
                    ? async () => {
                        const r = selectedRecipe;
                        setSelectedRecipe(null);
                        await handleCraft(r);
                      }
                    : undefined}
                  disabled={
                    !canCraft(selectedRecipe, harvestInventory, farmInventory) ||
                    crafting === selectedRecipe.id
                  }
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.craftBtnText,
                    {
                      color: canCraft(selectedRecipe, harvestInventory, farmInventory)
                        ? colors.onPrimary
                        : colors.textMuted,
                    },
                  ]}>
                    {t('craft.crafter')}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
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
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('craft.aucuneRecolte')}
        </Text>
      )}
      {/* Récoltes */}
      {harvestEntries.length > 0 && (
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          {t('craft.recoltes', '🌱 Récoltes')}
        </Text>
      )}
      {harvestEntries.map(({ cropId, qty, cropDef }, idx) => {
        const cropName = cropDef ? t(cropDef.labelKey) : cropId;
        return (
          <Animated.View key={cropId} entering={FadeInDown.delay(idx * 60).duration(300)}>
            <TouchableOpacity
              style={[
                styles.inventoryRow,
                { backgroundColor: colors.card, borderColor: colors.borderLight },
                Shadows.sm,
              ]}
              onLongPress={() => onOfferItem?.('harvest', cropId, qty, cropName)}
              delayLongPress={400}
              activeOpacity={1}
            >
              <Text style={styles.inventoryEmoji}>{cropDef?.emoji ?? '?'}</Text>
              <View style={styles.inventoryInfo}>
                <Text style={[styles.inventoryName, { color: colors.text }]}>
                  {cropName}
                </Text>
                <Text style={[styles.inventoryQty, { color: colors.textSub }]}>
                  x{qty} — {cropDef?.harvestReward ?? 0} 🍃/{t('craft.vendre').toLowerCase()}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.sellBtn,
                  { backgroundColor: tint, borderColor: primary },
                  selling === cropId && { opacity: 0.5 },
                ]}
                onPress={() => handleSellHarvest(cropId)}
                disabled={selling === cropId}
                activeOpacity={0.7}
              >
                <Text style={[styles.sellBtnText, { color: primary }]}>
                  {t('craft.vendre')}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
      {/* Ressources bâtiments */}
      {resourceEntries.length > 0 && (
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: harvestEntries.length > 0 ? Spacing.lg : 0 }]}>
          {t('craft.ressources', '🏠 Ressources')}
        </Text>
      )}
      {resourceEntries.map(({ resourceId, qty, emoji, labelKey }, idx) => {
        const resName = t(labelKey);
        return (
          <Animated.View key={resourceId} entering={FadeInDown.delay((harvestEntries.length + idx) * 60).duration(300)}>
            <TouchableOpacity
              style={[
                styles.inventoryRow,
                { backgroundColor: colors.card, borderColor: colors.borderLight },
                Shadows.sm,
              ]}
              onLongPress={() => onOfferItem?.('building_resource', resourceId, qty, resName)}
              delayLongPress={400}
              activeOpacity={1}
            >
              <Text style={styles.inventoryEmoji}>{emoji}</Text>
              <View style={styles.inventoryInfo}>
                <Text style={[styles.inventoryName, { color: colors.text }]}>
                  {resName}
                </Text>
                <Text style={[styles.inventoryQty, { color: colors.textSub }]}>
                  x{qty}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
      {/* Historique cadeaux */}
      {giftHistoryEntries.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: Spacing.xl }]}>
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
                <View style={[styles.giftHistoryRow, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
                  <Text style={styles.giftHistoryIcon}>{isReceived ? '📥' : '📤'}</Text>
                  <View style={styles.giftHistoryInfo}>
                    <Text style={[styles.giftHistoryItem, { color: colors.text }]} numberOfLines={1}>
                      {entry.itemId}{' x'}{entry.quantity}
                    </Text>
                    <Text style={[styles.giftHistoryMeta, { color: colors.textMuted }]} numberOfLines={1}>
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
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('craft.aucunItem')}
        </Text>
      )}
      {craftedGroups.map(({ recipe, count }, idx) => {
        const recipeName = t(recipe.labelKey);
        return (
          <Animated.View key={recipe.id} entering={FadeInDown.delay(idx * 60).duration(300)}>
            <TouchableOpacity
              style={[
                styles.inventoryRow,
                { backgroundColor: colors.card, borderColor: colors.borderLight },
                Shadows.sm,
              ]}
              onLongPress={() => onOfferItem?.('crafted', recipe.id, count, recipeName)}
              delayLongPress={400}
              activeOpacity={1}
            >
              <Text style={styles.inventoryEmoji}>{recipe.emoji}</Text>
              <View style={styles.inventoryInfo}>
                <Text style={[styles.inventoryName, { color: colors.text }]}>
                  {recipeName}
                </Text>
                <Text style={[styles.inventoryQty, { color: colors.textSub }]}>
                  x{count} — {recipe.sellValue} 🍃 + {recipe.xpBonus} XP
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.sellBtn,
                  { backgroundColor: tint, borderColor: primary },
                  selling === recipe.id && { opacity: 0.5 },
                ]}
                onPress={() => handleSellCrafted(recipe.id)}
                disabled={selling === recipe.id}
                activeOpacity={0.7}
              >
                <Text style={[styles.sellBtnText, { color: primary }]}>
                  {t('craft.vendre')}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
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
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: primary }]}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {'🔨 ' + t('craft.atelier')}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Points */}
        <View style={[styles.pointsBar, { backgroundColor: tint }]}>
          <Text style={[styles.pointsText, { color: primary }]}>
            {coins} 🍃
          </Text>
        </View>

        {/* Onglets */}
        <View style={[styles.tabs, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity
            style={[styles.tab, tab === 'catalogue' && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            onPress={() => setTab('catalogue')}
          >
            <Text style={[styles.tabText, { color: tab === 'catalogue' ? primary : colors.textMuted }]}>
              {t('craft.catalogue')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'inventaire' && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            onPress={() => setTab('inventaire')}
          >
            <Text style={[styles.tabText, { color: tab === 'inventaire' ? primary : colors.textMuted }]}>
              {t('craft.inventaire')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'creations' && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            onPress={() => setTab('creations')}
          >
            <Text style={[styles.tabText, { color: tab === 'creations' ? primary : colors.textMuted }]}>
              {t('craft.mesCreations')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contenu de l'onglet actif */}
        {tab === 'catalogue' && renderCatalogue()}
        {tab === 'inventaire' && renderInventaire()}
        {tab === 'creations' && renderCreations()}
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  pointsBar: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  pointsText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  tabText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSize.body,
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  catSectionEmoji: {
    fontSize: FontSize.body,
    marginRight: Spacing.xs,
  },
  catSectionLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  catSectionLevel: {
    fontSize: FontSize.caption,
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
  },
  catSectionBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
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
    borderRadius: Radius.lg,
    padding: Spacing.md,
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
  },
  catCardValue: {
    fontSize: FontSize.micro,
    marginBottom: Spacing.xs,
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
  },
  catModalClose: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    padding: Spacing.sm,
    zIndex: 1,
  },
  catModalCloseText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  catModalEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  catModalTitle: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: 2,
  },
  catModalValue: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  catModalIngList: {
    maxHeight: 200,
    marginBottom: Spacing.md,
  },

  // ── Catalogue existant (recipeCard conservé pour compatibilité) ──
  recipeCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
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
  },
  recipeSellValue: {
    fontSize: FontSize.caption,
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
  },
  ingredientEmoji: {
    fontSize: 18,
    width: 28,
  },
  ingredientName: {
    flex: 1,
    fontSize: FontSize.sm,
  },
  ingredientQty: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  craftBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
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
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  inventoryEmoji: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  inventoryInfo: {
    flex: 1,
  },
  inventoryName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  inventoryQty: {
    fontSize: FontSize.caption,
  },
  sellBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  sellBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  giftHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
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
  },
  giftHistoryMeta: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
});
