/**
 * CraftSheet.tsx — Atelier de craft (bottom sheet)
 *
 * 3 onglets : Recettes (catalogue), Inventaire (recoltes brutes), Mes creations.
 * Permet de crafter des items a partir d'ingredients, et de vendre items ou recoltes.
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
import {
  CROP_CATALOG,
  BUILDING_CATALOG,
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

interface CraftSheetProps {
  visible: boolean;
  onClose: () => void;
  profileId: string;
  coins: number;
  harvestInventory: HarvestInventory;
  farmInventory: FarmInventory;
  craftedItems: CraftedItem[];
  onCraft: (recipeId: string) => Promise<CraftedItem | null>;
  onSellHarvest: (cropId: string) => Promise<number>;
  onSellCrafted: (recipeId: string) => Promise<number>;
}

// ── Noms de ressources batiment ──────────────────────

const RESOURCE_EMOJI: Record<string, string> = {
  oeuf: '🥚',
  lait: '🥛',
  farine: '🌾',
  miel: '🍯',
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
  onCraft,
  onSellHarvest,
  onSellCrafted,
}: CraftSheetProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const [tab, setTab] = useState<CraftTab>('catalogue');
  const [crafting, setCrafting] = useState<string | null>(null);
  const [selling, setSelling] = useState<string | null>(null);

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
        // Petit bounce sur le bouton
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

  // ── Tab : Catalogue (Recettes) ────────────────

  const sortedRecipes = useMemo(() => {
    return [...CRAFT_RECIPES].sort((a, b) => {
      const aCraftable = canCraft(a, harvestInventory, farmInventory) ? 1 : 0;
      const bCraftable = canCraft(b, harvestInventory, farmInventory) ? 1 : 0;
      if (bCraftable !== aCraftable) return bCraftable - aCraftable;
      return a.sellValue - b.sellValue;
    });
  }, [harvestInventory, farmInventory]);

  const renderCatalogue = () => (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {sortedRecipes.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('craft.aucuneRecette')}
        </Text>
      )}
      {sortedRecipes.map((recipe, idx) => {
        const craftable = canCraft(recipe, harvestInventory, farmInventory);
        return (
          <Animated.View key={recipe.id} entering={FadeInDown.delay(idx * 60).duration(300)}>
              <View
                style={[
                  styles.recipeCard,
                  { backgroundColor: colors.card, borderColor: craftable ? colors.success : colors.borderLight },
                  craftable && { borderWidth: 1.5 },
                  Shadows.sm,
                ]}
              >
                {/* Header recette */}
                <View style={styles.recipeHeader}>
                  <Text style={styles.recipeEmoji}>{recipe.emoji}</Text>
                  <View style={styles.recipeInfo}>
                    <Text style={[styles.recipeName, { color: colors.text }]}>
                      {t(recipe.labelKey)}
                    </Text>
                    <Text style={[styles.recipeSellValue, { color: colors.textSub }]}>
                      {t('craft.valeurVente', { amount: recipe.sellValue })}
                      {recipe.xpBonus > 0 ? `  +${recipe.xpBonus} XP` : ''}
                    </Text>
                  </View>
                </View>

                {/* Liste ingredients */}
                <View style={styles.ingredientsList}>
                  <Text style={[styles.ingredientsTitle, { color: colors.textMuted }]}>
                    {t('craft.ingredients')}
                  </Text>
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
                    const name = ing.source === 'crop'
                      ? (cropDef ? t(cropDef.labelKey) : ing.itemId)
                      : t(`farm.building.resource.${ing.itemId}`);

                    // Hint pour ingrédients manquants
                    const hint = !enough
                      ? ing.source === 'crop'
                        ? t('craft.hintPlant', { name, defaultValue: `Plante ${name} sur une parcelle` })
                        : (() => {
                            const bld = BUILDING_CATALOG.find(b => b.resourceType === ing.itemId);
                            const bldName = bld ? t(bld.labelKey) : t('craft.hintBuildingGeneric', 'un bâtiment');
                            return t('craft.hintBuilding', { name: bldName, defaultValue: `Produit par ${bldName}` });
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
                </View>

                {/* Bouton crafter */}
                <Animated.View style={crafting === recipe.id ? craftBtnAnimStyle : undefined}>
                  <TouchableOpacity
                    style={[
                      styles.craftBtn,
                      { backgroundColor: craftable ? primary : colors.cardAlt },
                      crafting === recipe.id && { opacity: 0.5 },
                    ]}
                    onPress={craftable ? () => handleCraft(recipe) : undefined}
                    disabled={!craftable || crafting === recipe.id}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.craftBtnText,
                      { color: craftable ? colors.onPrimary : colors.textMuted },
                    ]}>
                      {t('craft.crafter')}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
          </Animated.View>
        );
      })}
      <View style={{ height: Spacing['3xl'] }} />
    </ScrollView>
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
      {harvestEntries.map(({ cropId, qty, cropDef }, idx) => (
        <Animated.View key={cropId} entering={FadeInDown.delay(idx * 60).duration(300)}>
          <View
            style={[
              styles.inventoryRow,
              { backgroundColor: colors.card, borderColor: colors.borderLight },
              Shadows.sm,
            ]}
          >
            <Text style={styles.inventoryEmoji}>{cropDef?.emoji ?? '?'}</Text>
            <View style={styles.inventoryInfo}>
              <Text style={[styles.inventoryName, { color: colors.text }]}>
                {cropDef ? t(cropDef.labelKey) : cropId}
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
          </View>
        </Animated.View>
      ))}
      {/* Ressources bâtiments */}
      {resourceEntries.length > 0 && (
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: harvestEntries.length > 0 ? Spacing.lg : 0 }]}>
          {t('craft.ressources', '🏠 Ressources')}
        </Text>
      )}
      {resourceEntries.map(({ resourceId, qty, emoji, labelKey }, idx) => (
        <Animated.View key={resourceId} entering={FadeInDown.delay((harvestEntries.length + idx) * 60).duration(300)}>
          <View
            style={[
              styles.inventoryRow,
              { backgroundColor: colors.card, borderColor: colors.borderLight },
              Shadows.sm,
            ]}
          >
            <Text style={styles.inventoryEmoji}>{emoji}</Text>
            <View style={styles.inventoryInfo}>
              <Text style={[styles.inventoryName, { color: colors.text }]}>
                {t(labelKey)}
              </Text>
              <Text style={[styles.inventoryQty, { color: colors.textSub }]}>
                x{qty}
              </Text>
            </View>
          </View>
        </Animated.View>
      ))}
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
      {craftedGroups.map(({ recipe, count }, idx) => (
        <Animated.View key={recipe.id} entering={FadeInDown.delay(idx * 60).duration(300)}>
          <View
            style={[
              styles.inventoryRow,
              { backgroundColor: colors.card, borderColor: colors.borderLight },
              Shadows.sm,
            ]}
          >
            <Text style={styles.inventoryEmoji}>{recipe.emoji}</Text>
            <View style={styles.inventoryInfo}>
              <Text style={[styles.inventoryName, { color: colors.text }]}>
                {t(recipe.labelKey)}
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
          </View>
        </Animated.View>
      ))}
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

  // ── Catalogue ──
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
});
