// components/village/AtelierSheet.tsx
// Modal Atelier Village — 3 onglets : Recettes / Inventaire / Créations
// Permet de crafter des items collectifs depuis l'inventaire village.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
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

// ── Types ─────────────────────────────────────────────────────────────────

type AtelierTab = 'recettes' | 'inventaire' | 'creations';

interface AtelierSheetProps {
  visible: boolean;
  inventory: VillageInventory;
  atelierCrafts: VillageAtelierCraft[];
  unlockedRecipeTier: number;
  profileId: string;
  onCraft: (recipeId: string, profileId: string) => Promise<boolean>;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── RecipeCard ─────────────────────────────────────────────────────────────

const RecipeCard = React.memo(function RecipeCard({
  recipe,
  inventory,
  unlockedRecipeTier,
  onCraft,
  colors,
  primary,
}: {
  recipe: VillageRecipe;
  inventory: VillageInventory;
  unlockedRecipeTier: number;
  onCraft: (recipeId: string) => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
}) {
  const { canCraft, reason } = useMemo(
    () => canCraftVillageRecipe(recipe.id, inventory, unlockedRecipeTier),
    [recipe.id, inventory, unlockedRecipeTier],
  );

  const tierLabel = recipe.minAtelierTier === 0
    ? 'Libre'
    : `Atelier niv. ${recipe.minAtelierTier}`;

  const tierLocked = recipe.minAtelierTier > unlockedRecipeTier;

  return (
    <View style={[
      styles.recipeCard,
      {
        backgroundColor: colors.cardAlt,
        borderColor: canCraft ? primary : colors.borderLight,
        opacity: tierLocked ? 0.5 : 1,
      },
    ]}>
      {/* Header recette */}
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeResultEmoji}>{recipe.resultEmoji}</Text>
        <View style={styles.recipeInfo}>
          <Text style={[styles.recipeLabel, { color: colors.text }]}>{recipe.labelFR}</Text>
          <Text style={[styles.recipeTier, { color: colors.textMuted }]}>{tierLabel}</Text>
        </View>
        <Text style={[styles.recipeXp, { color: primary }]}>+{recipe.xpBonus} XP</Text>
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
                { backgroundColor: enough ? colors.success + '22' : colors.error + '22' },
              ]}
            >
              <Text style={styles.ingredientEmoji}>{ing.itemEmoji}</Text>
              <Text style={[
                styles.ingredientQty,
                { color: enough ? colors.success : colors.error },
              ]}>
                {stock}/{ing.quantity}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Bouton craft */}
      <TouchableOpacity
        onPress={canCraft ? () => onCraft(recipe.id) : undefined}
        activeOpacity={canCraft ? 0.7 : 1}
        style={[
          styles.craftBtn,
          { backgroundColor: canCraft ? primary : colors.borderLight },
        ]}
      >
        <Text style={[
          styles.craftBtnText,
          { color: canCraft ? '#FFFFFF' : colors.textMuted },
        ]}>
          {tierLocked
            ? `🔒 ${tierLabel} requis`
            : canCraft
              ? `Crafner ${recipe.resultEmoji}`
              : reason ?? 'Ingrédients insuffisants'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// ── InventaireTab ──────────────────────────────────────────────────────────

function InventaireTab({
  inventory,
  colors,
  primary,
}: {
  inventory: VillageInventory;
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
}) {
  // Construire la liste des items connus depuis les recettes
  const knownItems = useMemo(() => {
    const itemMap: Record<string, { emoji: string; label: string }> = {};
    for (const recipe of VILLAGE_RECIPES) {
      for (const ing of recipe.ingredients) {
        itemMap[ing.itemId] = { emoji: ing.itemEmoji, label: ing.itemId };
      }
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
    return Object.entries(itemMap).map(([id, { emoji }]) => ({
      id,
      emoji,
      label: ITEM_LABELS[id] ?? id,
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
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Inventaire vide</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
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
              backgroundColor: colors.cardAlt,
              borderColor: item.qty > 0 ? primary : colors.borderLight,
            },
          ]}
        >
          <Text style={styles.inventaireCellEmoji}>{item.emoji}</Text>
          <Text style={[styles.inventaireCellQty, { color: item.qty > 0 ? primary : colors.textMuted }]}>
            {item.qty}
          </Text>
          <Text style={[styles.inventaireCellLabel, { color: colors.textSub }]} numberOfLines={2}>
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
}: {
  atelierCrafts: VillageAtelierCraft[];
  colors: ReturnType<typeof useThemeColors>['colors'];
  primary: string;
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
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune création</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
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
            style={[styles.creationRow, { borderBottomColor: colors.borderLight }]}
          >
            <Text style={styles.creationEmoji}>
              {recipe?.resultEmoji ?? '🎁'}
            </Text>
            <View style={styles.creationInfo}>
              <Text style={[styles.creationLabel, { color: colors.text }]}>
                {recipe?.labelFR ?? craft.recipeId}
              </Text>
              <Text style={[styles.creationDate, { color: colors.textMuted }]}>
                {formatDate(craft.timestamp)}
              </Text>
            </View>
            {recipe && (
              <Text style={[styles.creationXp, { color: primary }]}>
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
  onCraft,
  onClose,
}: AtelierSheetProps) {
  const { colors, primary } = useThemeColors();
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
      transparent
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>⚒️ Atelier Village</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeBtnText, { color: colors.textSub }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Onglets */}
          <View style={[styles.tabBar, { borderBottomColor: colors.borderLight }]}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.tab,
                    isActive && { borderBottomColor: primary, borderBottomWidth: 2 },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tabEmoji}>{tab.emoji}</Text>
                  <Text style={[
                    styles.tabLabel,
                    { color: isActive ? primary : colors.textSub },
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
              <>
                {unlockedRecipeTier === 0 && (
                  <View style={[styles.tierBanner, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[styles.tierBannerText, { color: colors.textMuted }]}>
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
                  />
                ))}
              </>
            )}

            {activeTab === 'inventaire' && (
              <InventaireTab
                inventory={inventory}
                colors={colors}
                primary={primary}
              />
            )}

            {activeTab === 'creations' && (
              <CreationsTab
                atelierCrafts={atelierCrafts}
                colors={colors}
                primary={primary}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '88%',
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  closeBtn: {
    padding: Spacing.md,
  },
  closeBtnText: {
    fontSize: FontSize.lg,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: Spacing['2xl'],
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
  tabEmoji: {
    fontSize: FontSize.sm,
  },
  tabLabel: {
    fontSize: FontSize.sm,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['6xl'],
    gap: Spacing.xl,
  },
  // Tier banner
  tierBanner: {
    borderRadius: Radius.md,
    padding: Spacing.xl,
  },
  tierBannerText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  // RecipeCard
  recipeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
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
  },
  recipeTier: {
    fontSize: FontSize.label,
  },
  recipeXp: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
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
  craftBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  craftBtnText: {
    fontSize: FontSize.sm,
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
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
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
  },
  creationDate: {
    fontSize: FontSize.label,
  },
  creationXp: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
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
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
