// components/village/AtelierSheet.tsx
// Modal Atelier Village — 3 onglets : Recettes / Inventaire / Créations
// Permet de crafter des items collectifs depuis l'inventaire village.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import {
  VILLAGE_RECIPES,
  canCraftVillageRecipe,
} from '../../lib/village';
import type { VillageInventory, VillageAtelierCraft } from '../../lib/village/types';
import type { VillageRecipe } from '../../lib/village/atelier-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm, FarmDarkPalette, useFarmTheme, type FarmPalette } from '../../constants/farm-theme';

type Styles = ReturnType<typeof makeStyles>;
type FarmBtnStyles = ReturnType<typeof makeFarmBtnStyles>;

// ── Constants ──────────────────────────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Types ─────────────────────────────────────────────────────────────────

type AtelierTab = 'recettes' | 'inventaire' | 'creations';

interface AtelierSheetProps {
  visible: boolean;
  inventory: VillageInventory;
  atelierCrafts: VillageAtelierCraft[];
  unlockedRecipeTier: number;
  profileId: string;
  coins?: number;
  onCraft: (recipeId: string, profileId: string) => Promise<boolean>;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── AwningStripes ──────────────────────────────────────────────────────────

function AwningStripes({ farm }: { farm: FarmPalette }) {
  return (
    <View>
      {/* Stripe band */}
      <View style={awningStyles.band}>
        {Array.from({ length: farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              awningStyles.stripe,
              { backgroundColor: i % 2 === 0 ? farm.awningGreen : farm.awningCream },
            ]}
          />
        ))}
      </View>
      {/* Shadow bar */}
      <View style={awningStyles.shadowBar} />
      {/* Scallop dots row */}
      <View style={awningStyles.scallopRow}>
        {Array.from({ length: farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              awningStyles.scallopDot,
              { backgroundColor: i % 2 === 0 ? farm.awningGreen : farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const awningStyles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    height: 28,
    overflow: 'hidden',
  },
  stripe: {
    flex: 1,
  },
  shadowBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  scallopRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
  },
  scallopDot: {
    width: 8,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
});

// ── FarmButton (3D craft button) ───────────────────────────────────────────

function FarmButton({
  label,
  canCraft,
  onPress,
  farmBtnStyles,
}: {
  label: string;
  canCraft: boolean;
  onPress?: () => void;
  farmBtnStyles: FarmBtnStyles;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (canCraft && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  }, [canCraft, onPress]);

  if (!canCraft) {
    return (
      <View style={farmBtnStyles.disabledOuter}>
        <View style={farmBtnStyles.disabledInner}>
          <Text style={farmBtnStyles.disabledText}>{label}</Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <Animated.View style={[farmBtnStyles.greenOuter, animStyle]}>
        {/* 3D shadow base */}
        <View style={farmBtnStyles.greenShadow} />
        {/* Main button face */}
        <View style={farmBtnStyles.greenFace}>
          {/* Gloss highlight */}
          <View style={farmBtnStyles.greenGloss} />
          <Text style={farmBtnStyles.greenText}>{label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const makeFarmBtnStyles = (farm: FarmPalette) => StyleSheet.create({
  greenOuter: {
    borderRadius: Radius.md,
    overflow: 'visible',
  },
  greenShadow: {
    position: 'absolute',
    bottom: -3,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: farm.greenBtnShadow,
    borderRadius: Radius.md,
  },
  greenFace: {
    backgroundColor: farm.greenBtn,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 3,
  },
  greenGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: farm.greenBtnHighlight,
    opacity: 0.35,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  greenText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  disabledOuter: {
    borderRadius: Radius.md,
    backgroundColor: farm.parchmentDark,
    borderWidth: 1,
    borderColor: farm.woodHighlight,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  disabledInner: {},
  disabledText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: farm.brownTextSub,
  },
});

const farmBtnStylesLight = makeFarmBtnStyles(Farm);
const farmBtnStylesDark = makeFarmBtnStyles(FarmDarkPalette);

// ── RecipeCard ─────────────────────────────────────────────────────────────

const RecipeCard = React.memo(function RecipeCard({
  recipe,
  inventory,
  unlockedRecipeTier,
  onCraft,
  colors,
  primary,
  farm,
  styles,
  farmBtnStyles,
}: {
  recipe: VillageRecipe;
  inventory: VillageInventory;
  unlockedRecipeTier: number;
  onCraft: (recipeId: string) => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
  farm: FarmPalette;
  styles: Styles;
  farmBtnStyles: FarmBtnStyles;
}) {
  const { canCraft, reason } = useMemo(
    () => canCraftVillageRecipe(recipe.id, inventory, unlockedRecipeTier),
    [recipe.id, inventory, unlockedRecipeTier],
  );

  const tierLabel = recipe.minAtelierTier === 0
    ? 'Libre'
    : `Atelier niv. ${recipe.minAtelierTier}`;

  const tierLocked = recipe.minAtelierTier > unlockedRecipeTier;

  const craftLabel = tierLocked
    ? `🔒 ${tierLabel} requis`
    : canCraft
      ? `Crafter ${recipe.resultEmoji}`
      : reason ?? 'Ingrédients insuffisants';

  return (
    <View style={[
      styles.recipeCard,
      {
        borderColor: canCraft ? farm.greenBtn : farm.woodHighlight,
        opacity: tierLocked ? 0.5 : 1,
      },
    ]}>
      {/* Header recette */}
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeResultEmoji}>{recipe.resultEmoji}</Text>
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeLabel}>{recipe.labelFR}</Text>
          <Text style={styles.recipeTier}>{tierLabel}</Text>
        </View>
        <View style={styles.recipeReward}>
          <Text style={styles.recipeXp}>+{recipe.xpBonus} XP & 🍃</Text>
          {!!recipe.coinBonus && recipe.coinBonus > 0 && (
            <Text style={styles.recipeGift}>🎁 +{recipe.coinBonus} 🍃 bonus</Text>
          )}
          <Text style={styles.recipeRewardHint}>par membre</Text>
        </View>
      </View>

      {/* Ingrédients */}
      <View style={styles.ingredientsRow}>
        {recipe.ingredients.map(ing => {
          const stock = inventory[ing.itemId] ?? 0;
          const enough = stock >= ing.quantity;
          return (
            <View
              key={ing.itemId}
              style={[
                styles.ingredientPill,
                { backgroundColor: enough ? farm.greenBtn + '22' : colors.error + '22' },
              ]}
            >
              <Text style={styles.ingredientEmoji}>{ing.itemEmoji}</Text>
              <Text style={[
                styles.ingredientQty,
                { color: enough ? farm.greenBtn : colors.error },
              ]}>
                {stock}/{ing.quantity}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Bouton craft */}
      <FarmButton
        label={craftLabel}
        canCraft={canCraft && !tierLocked}
        onPress={() => onCraft(recipe.id)}
        farmBtnStyles={farmBtnStyles}
      />
    </View>
  );
});

// ── InventaireTab ──────────────────────────────────────────────────────────

function InventaireTab({
  inventory,
  colors,
  primary,
  farm,
  styles,
}: {
  inventory: VillageInventory;
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
  farm: FarmPalette;
  styles: Styles;
}) {
  // Construire la liste des items connus depuis les recettes
  const knownItems = useMemo(() => {
    const itemMap: Record<string, { emoji: string; label: string }> = {};
    for (const recipe of VILLAGE_RECIPES) {
      // Ingrédients
      for (const ing of recipe.ingredients) {
        itemMap[ing.itemId] = { emoji: ing.itemEmoji, label: ing.itemId };
      }
      // Résultats craftés (village_craft) — visibles dans l'inventaire collectif
      itemMap[recipe.id] = { emoji: recipe.resultEmoji, label: recipe.resultLabel };
    }
    // Mapper les IDs en labels lisibles
    const ITEM_LABELS: Record<string, string> = {
      eau_fraiche: 'Eau fraîche',
      pain_frais: 'Pain frais',
      panier_surprise: 'Panier surprise',
      cafe_matin: 'Café du matin',
      outil_forge: 'Outil forgé',
      farine_moulee: 'Farine moulue',
      coffre_maritime: 'Coffre maritime',
      parchemin: 'Parchemin',
    };
    return Object.entries(itemMap).map(([id, { emoji, label }]) => ({
      id,
      emoji,
      label: ITEM_LABELS[id] ?? label,
      qty: inventory[id] ?? 0,
    })).sort((a, b) => b.qty - a.qty);
  }, [inventory]);

  const totalItems = useMemo(
    () => Object.values(inventory).reduce((s, v) => s + v, 0),
    [inventory],
  );

  if (totalItems === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>📦</Text>
        <Text style={styles.emptyTitle}>Inventaire vide</Text>
        <Text style={styles.emptySubtitle}>
          Collectez les productions des bâtiments pour remplir l'inventaire.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.inventaireGrid}>
      {knownItems.map(item => (
        <View
          key={item.id}
          style={[
            styles.inventaireCell,
            {
              borderColor: item.qty > 0 ? farm.woodHighlight : farm.woodHighlight,
            },
          ]}
        >
          <Text style={styles.inventaireCellEmoji}>{item.emoji}</Text>
          <Text style={[styles.inventaireCellQty, { color: item.qty > 0 ? farm.greenBtn : farm.brownTextSub }]}>
            {item.qty}
          </Text>
          <Text style={styles.inventaireCellLabel} numberOfLines={2}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── CreationsTab ───────────────────────────────────────────────────────────

function CreationsTab({
  atelierCrafts,
  colors,
  primary,
  styles,
}: {
  atelierCrafts: VillageAtelierCraft[];
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
  styles: Styles;
}) {
  const RECIPE_MAP = useMemo(() => {
    const map: Record<string, VillageRecipe> = {};
    for (const r of VILLAGE_RECIPES) map[r.id] = r;
    return map;
  }, []);

  const sorted = useMemo(
    () => [...atelierCrafts].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [atelierCrafts],
  );

  if (sorted.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🛠️</Text>
        <Text style={styles.emptyTitle}>Aucune création</Text>
        <Text style={styles.emptySubtitle}>
          Vos créations collectives apparaîtront ici après chaque craft.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.creationsList}>
      {sorted.map((craft, idx) => {
        const recipe = RECIPE_MAP[craft.recipeId];
        return (
          <View
            key={`${craft.recipeId}-${craft.timestamp}-${idx}`}
            style={styles.creationRow}
          >
            <Text style={styles.creationEmoji}>
              {recipe?.resultEmoji ?? '🎁'}
            </Text>
            <View style={styles.creationInfo}>
              <Text style={styles.creationLabel}>
                {recipe?.labelFR ?? craft.recipeId}
              </Text>
              <Text style={styles.creationDate}>
                {formatDate(craft.timestamp)}
              </Text>
            </View>
            {recipe && (
              <Text style={styles.creationXp}>
                +{recipe.xpBonus} XP
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── AtelierSheet — composant principal ────────────────────────────────────

export function AtelierSheet({
  visible,
  inventory,
  atelierCrafts,
  unlockedRecipeTier,
  profileId,
  coins = 0,
  onCraft,
  onClose,
}: AtelierSheetProps) {
  const { colors, primary } = useThemeColors();
  const { farm, isDark } = useFarmTheme();
  const styles = isDark ? stylesDark : stylesLight;
  const farmBtnStyles = isDark ? farmBtnStylesDark : farmBtnStylesLight;
  const [activeTab, setActiveTab] = useState<AtelierTab>('recettes');
  const [crafting, setCrafting] = useState(false);

  const handleCraft = useCallback(
    async (recipeId: string) => {
      if (crafting) return;
      setCrafting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const ok = await onCraft(recipeId, profileId);
        if (ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Alert.alert('Atelier', 'Impossible de crafter cet item pour le moment.');
        }
      } finally {
        setCrafting(false);
      }
    },
    [crafting, onCraft, profileId],
  );

  const tabs: { id: AtelierTab; label: string; emoji: string }[] = [
    { id: 'recettes', label: 'Recettes', emoji: '📖' },
    { id: 'inventaire', label: 'Inventaire', emoji: '📦' },
    { id: 'creations', label: 'Créations', emoji: '🛠️' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

        {/* Wood frame outer */}
        <View style={styles.woodFrame}>
          {/* Wood frame inner */}
          <View style={styles.woodFrameInner}>
            {/* Awning stripes at the top */}
            <AwningStripes farm={farm} />

            {/* Parchment content area */}
            <View style={styles.parchment}>
              {/* Handle + total feuilles */}
              <View style={styles.handleRow}>
                <View style={styles.handle} />
                <Text style={styles.handleCoins}>🍃 {coins}</Text>
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>⚒️ Atelier Village</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Onglets */}
              <View style={styles.tabBar}>
                {tabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setActiveTab(tab.id)}
                      style={[
                        styles.tab,
                        isActive ? styles.tabActive : styles.tabInactive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tabEmoji}>{tab.emoji}</Text>
                      <Text style={[
                        styles.tabLabel,
                        { color: isActive ? farm.parchment : farm.brownTextSub },
                        isActive && { fontWeight: FontWeight.semibold },
                      ]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Contenu onglet */}
              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {activeTab === 'recettes' && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.tabContent}>
                    <View style={styles.rewardBanner}>
                      <Text style={styles.rewardBannerText}>
                        🍃 Chaque craft offre son XP <Text style={styles.rewardBannerEmph}>et autant de feuilles</Text> à chaque membre de la famille.
                      </Text>
                    </View>
                    {unlockedRecipeTier === 0 && (
                      <View style={styles.tierBanner}>
                        <Text style={styles.tierBannerText}>
                          🔒 Débloquez des techs Atelier pour accéder à plus de recettes
                        </Text>
                      </View>
                    )}
                    {VILLAGE_RECIPES.map(recipe => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        inventory={inventory}
                        unlockedRecipeTier={unlockedRecipeTier}
                        onCraft={handleCraft}
                        colors={colors}
                        primary={primary}
                        farm={farm}
                        styles={styles}
                        farmBtnStyles={farmBtnStyles}
                      />
                    ))}
                  </Animated.View>
                )}

                {activeTab === 'inventaire' && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.tabContent}>
                    <InventaireTab
                      inventory={inventory}
                      colors={colors}
                      primary={primary}
                      farm={farm}
                      styles={styles}
                    />
                  </Animated.View>
                )}

                {activeTab === 'creations' && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.tabContent}>
                    <CreationsTab
                      atelierCrafts={atelierCrafts}
                      colors={colors}
                      primary={primary}
                      styles={styles}
                    />
                  </Animated.View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const makeStyles = (farm: FarmPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  // Wood frame outer
  woodFrame: {
    flex: 1,
    backgroundColor: farm.woodDark,
    padding: Spacing['2xl'],
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    borderRadius: Radius['2xl'],
    ...Shadows.xl,
  },
  // Wood frame inner
  woodFrameInner: {
    flex: 1,
    backgroundColor: farm.woodLight,
    borderWidth: 2,
    borderColor: farm.woodHighlight,
    overflow: 'hidden',
    borderRadius: Radius.xl,
  },
  // Parchment content area
  parchment: {
    flex: 1,
    backgroundColor: farm.parchment,
    paddingBottom: Spacing['3xl'],
  },
  handleRow: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: farm.woodHighlight,
  },
  handleCoins: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: farm.brownTextSub,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: farm.brownText,
    flex: 1,
    textShadowColor: farm.textEmboss,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: farm.woodDark,
    borderWidth: 2,
    borderColor: farm.woodHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    color: farm.parchment,
    fontWeight: FontWeight.bold,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: farm.parchmentDark,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: farm.woodHighlight,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  tabActive: {
    backgroundColor: farm.woodBtn,
  },
  tabInactive: {
    backgroundColor: 'transparent',
  },
  tabEmoji: {
    fontSize: FontSize.sm,
  },
  tabLabel: {
    fontSize: FontSize.sm,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['6xl'],
  },
  tabContent: {
    gap: Spacing.xl,
  },
  // Tier banner
  tierBanner: {
    borderRadius: Radius.md,
    padding: Spacing.xl,
    backgroundColor: farm.parchmentDark,
  },
  tierBannerText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    color: farm.brownTextSub,
  },
  // RecipeCard
  recipeCard: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    backgroundColor: farm.parchmentDark,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  recipeResultEmoji: {
    fontSize: 32,
  },
  recipeInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  recipeLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: farm.brownText,
  },
  recipeTier: {
    fontSize: FontSize.label,
    color: farm.brownTextSub,
  },
  recipeReward: {
    alignItems: 'flex-end',
    gap: 1,
  },
  recipeXp: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: farm.greenBtn,
  },
  recipeGift: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    color: farm.woodBtn,
  },
  recipeRewardHint: {
    fontSize: FontSize.caption,
    color: farm.brownTextSub,
  },
  rewardBanner: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    backgroundColor: farm.greenBtn + '1A',
    borderWidth: 1,
    borderColor: farm.greenBtn + '40',
  },
  rewardBannerText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    color: farm.brownText,
  },
  rewardBannerEmph: {
    fontWeight: FontWeight.bold,
    color: farm.greenBtn,
  },
  ingredientsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  ingredientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  ingredientEmoji: {
    fontSize: FontSize.sm,
  },
  ingredientQty: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  // Inventaire
  inventaireGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xl,
  },
  inventaireCell: {
    width: '22%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: farm.woodHighlight,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: farm.parchmentDark,
  },
  inventaireCellEmoji: {
    fontSize: 28,
  },
  inventaireCellQty: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  inventaireCellLabel: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    color: farm.brownTextSub,
  },
  // Créations
  creationsList: {
    gap: 0,
  },
  creationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: farm.woodHighlight,
  },
  creationEmoji: {
    fontSize: 28,
  },
  creationInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  creationLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: farm.brownText,
  },
  creationDate: {
    fontSize: FontSize.label,
    color: farm.brownTextSub,
  },
  creationXp: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: farm.greenBtn,
  },
  // États vides
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
    gap: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    color: farm.brownText,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    color: farm.brownTextSub,
  },
});

const stylesLight = makeStyles(Farm);
const stylesDark = makeStyles(FarmDarkPalette);
