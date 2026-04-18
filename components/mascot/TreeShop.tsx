/**
 * TreeShop.tsx — Boutique décorations & habitants pour l'arbre mascotte
 *
 * Modal accessible depuis l'écran arbre : catalogue filtré par stade,
 * fiche détail avec description + aperçu arbre, achat avec déduction de points.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { hapticsShopBuy, hapticsShopError } from '../../lib/mascot/haptics';
import { useTone } from '../../lib/mascot/tone';

import { useThemeColors } from '../../contexts/ThemeContext';
import { TreeView } from './TreeView';
import { Farm } from '../../constants/farm-theme';

import {
  DECORATIONS,
  INHABITANTS,
  TREE_STAGES,
  ITEM_ILLUSTRATIONS,
  BUILDING_CATALOG,
  type BuildingDefinition,
  type MascotDecoration,
  type MascotInhabitant,
  type TreeSpecies,
  type PlacedBuilding,
} from '../../lib/mascot/types';
import { getStageIndex } from '../../lib/mascot/engine';
import { BUILDING_CELLS } from '../../lib/mascot/world-grid';

const BUILDING_SPRITES: Record<string, any> = {
  poulailler: require('../../assets/buildings/poulailler.png'),
  grange: require('../../assets/buildings/grange.png'),
  moulin: require('../../assets/buildings/moulin.png'),
};
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

// ── Types ──────────────────────────────────────

type ShopTab = 'decorations' | 'inhabitants' | 'buildings';

interface TreeShopProps {
  species: TreeSpecies;
  level: number;
  coins: number;
  ownedDecorations: string[];
  ownedInhabitants: string[];
  ownedBuildings?: PlacedBuilding[];
  onBuy: (itemId: string, itemType: 'decoration' | 'inhabitant') => Promise<void>;
  onBuyBuilding?: (buildingId: string, cellId: string) => Promise<void>;
  onClose: () => void;
}

// ── Couleurs par rareté ────────────────────────

const RARITY_COLORS: Record<string, string> = {
  commun: '#9CA3AF',
  rare: '#3B82F6',
  'épique': '#8B5CF6',
  'légendaire': '#F59E0B',
  prestige: '#E91E63',
};

const RARITY_BG: Record<string, string> = {
  commun: 'rgba(156,163,175,0.12)',
  rare: 'rgba(59,130,246,0.12)',
  'épique': 'rgba(139,92,246,0.12)',
  'légendaire': 'rgba(245,158,11,0.12)',
  prestige: 'rgba(233,30,99,0.12)',
};

// ── Spring config ──────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Animated Buy Button ────────────────────────

interface BuyButtonProps {
  canAfford: boolean;
  disabled: boolean;
  onPress: () => void;
  label: string;
}

function BuyButton({ canAfford, disabled, onPress, label }: BuyButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.96, SPRING_CONFIG); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING_CONFIG); }}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[styles.buyBtnOuter, animStyle]}>
        <View
          style={[
            styles.buyBtnInner,
            canAfford
              ? { backgroundColor: Farm.greenBtn }
              : { backgroundColor: Farm.parchmentDark },
          ]}
        >
          {canAfford && (
            <View style={styles.buyBtnGloss} />
          )}
          <Text
            style={[
              styles.buyBtnText,
              { color: canAfford ? Farm.parchment : Farm.brownTextSub },
            ]}
          >
            {label}
          </Text>
        </View>
        <View
          style={[
            styles.buyBtnShadow,
            { backgroundColor: canAfford ? Farm.greenBtnShadow : '#D0CBC3' },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

// ── Awning Stripes ─────────────────────────────

function AwningStripes() {
  const stripes = Array.from({ length: Farm.awningStripeCount });
  return (
    <View style={styles.awning}>
      {stripes.map((_, i) => (
        <View
          key={i}
          style={[
            styles.awningStripe,
            { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
          ]}
        />
      ))}
      {/* Scallop dots row */}
      <View style={styles.awningScallops}>
        {stripes.map((_, i) => (
          <View key={i} style={styles.scallop} />
        ))}
      </View>
    </View>
  );
}

// ── Composant ──────────────────────────────────

export function TreeShop({ species, level, coins, ownedDecorations, ownedInhabitants, ownedBuildings = [], onBuy, onBuyBuilding, onClose }: TreeShopProps) {
  const { t } = useTranslation();
  const tone = useTone();
  const { primary, tint, colors, isDark } = useThemeColors();
  const [tab, setTab] = useState<ShopTab>('decorations');
  const [buying, setBuying] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<(MascotDecoration | MascotInhabitant) | null>(null);

  const stageIdx = getStageIndex(level);

  // Trier : disponibles d'abord, puis verrouillés, puis achetés
  const sortedDecorations = useMemo(() => {
    return [...DECORATIONS].filter(d => !d.sagaExclusive).sort((a, b) => {
      const aOwned = ownedDecorations.includes(a.id);
      const bOwned = ownedDecorations.includes(b.id);
      if (aOwned !== bOwned) return aOwned ? 1 : -1;
      const aMinIdx = TREE_STAGES.findIndex((s) => s.stage === a.minStage);
      const bMinIdx = TREE_STAGES.findIndex((s) => s.stage === b.minStage);
      const aLocked = stageIdx < aMinIdx;
      const bLocked = stageIdx < bMinIdx;
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return a.cost - b.cost;
    });
  }, [stageIdx, ownedDecorations]);

  const sortedInhabitants = useMemo(() => {
    return [...INHABITANTS].filter(h => !h.sagaExclusive).sort((a, b) => {
      const aOwned = ownedInhabitants.includes(a.id);
      const bOwned = ownedInhabitants.includes(b.id);
      if (aOwned !== bOwned) return aOwned ? 1 : -1;
      const aExpedition = a.expeditionExclusive === true && !aOwned;
      const bExpedition = b.expeditionExclusive === true && !bOwned;
      if (aExpedition !== bExpedition) return aExpedition ? 1 : -1;
      const aMinIdx = TREE_STAGES.findIndex((s) => s.stage === a.minStage);
      const bMinIdx = TREE_STAGES.findIndex((s) => s.stage === b.minStage);
      const aLocked = stageIdx < aMinIdx;
      const bLocked = stageIdx < bMinIdx;
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return a.cost - b.cost;
    });
  }, [stageIdx, ownedInhabitants]);

  const items = tab === 'decorations' ? sortedDecorations : sortedInhabitants;
  const ownedList = tab === 'decorations' ? ownedDecorations : ownedInhabitants;

  const handleBuy = useCallback(async (item: MascotDecoration | MascotInhabitant) => {
    const itemType = tab === 'decorations' ? 'decoration' : 'inhabitant';
    setBuying(item.id);
    try {
      await onBuy(item.id, itemType);
      hapticsShopBuy();
      setSelectedItem(null);
    } catch {
      hapticsShopError();
    }
    setBuying(null);
  }, [tab, onBuy]);

  // Détermine la clé description pour un item
  const getDescKey = useCallback((item: MascotDecoration | MascotInhabitant) => {
    return `${item.labelKey}_desc`;
  }, []);

  const renderItem = useCallback((item: MascotDecoration | MascotInhabitant, index: number) => {
    const owned = ownedList.includes(item.id);
    const minStageIdx = TREE_STAGES.findIndex((s) => s.stage === item.minStage);
    const locked = stageIdx < minStageIdx;
    const expeditionOnly = 'expeditionExclusive' in item && (item as MascotInhabitant).expeditionExclusive === true && !owned;
    const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.commun;
    const rarityBg = RARITY_BG[item.rarity] || RARITY_BG.commun;

    return (
      <Animated.View
        key={item.id}
        entering={FadeInDown.delay(index * 60).duration(300)}
      >
        <TouchableOpacity
          style={[
            styles.itemCard,
            (locked || expeditionOnly) && styles.itemCardLocked,
          ]}
          onPress={() => setSelectedItem(item)}
          activeOpacity={0.75}
        >
          {/* Emoji + infos */}
          <View style={styles.itemContent}>
            {ITEM_ILLUSTRATIONS[item.id] ? (
              <Image source={ITEM_ILLUSTRATIONS[item.id]} style={styles.itemIllustration} />
            ) : (
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
            )}
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, (locked || expeditionOnly) && styles.itemNameLocked]}>
                {t(item.labelKey)}
              </Text>
              <Text style={styles.itemDesc} numberOfLines={1}>
                {t(getDescKey(item))}
              </Text>
              <View style={styles.itemMeta}>
                <View style={[styles.rarityBadge, { backgroundColor: rarityBg }]}>
                  <Text style={[styles.rarityText, { color: rarityColor }]}>
                    {t(`mascot.shop.rarity.${item.rarity}`)}
                  </Text>
                </View>
                {!owned && !expeditionOnly && (
                  <Text style={styles.itemCost}>
                    {t('mascot.shop.leaves', { count: item.cost })}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Badge statut */}
          {owned ? (
            <View style={styles.ownedBadge}>
              <Text style={styles.ownedText}>
                {t('mascot.shop.owned')}
              </Text>
            </View>
          ) : expeditionOnly ? (
            <View style={styles.expeditionBadge}>
              <Text style={styles.expeditionText} numberOfLines={1}>
                {t('mascot.shop.expedition')}
              </Text>
            </View>
          ) : locked ? (
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedText} numberOfLines={1}>
                {t(TREE_STAGES[minStageIdx].labelKey)}
              </Text>
            </View>
          ) : (
            <Text style={styles.chevron}>{'›'}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [ownedList, stageIdx, getDescKey, t]);

  // ── Modal de détail ──────────────────────────

  const renderDetailModal = () => {
    if (!selectedItem) return null;

    const owned = ownedList.includes(selectedItem.id);
    const minStageIdx = TREE_STAGES.findIndex((s) => s.stage === selectedItem.minStage);
    const locked = stageIdx < minStageIdx;
    const expeditionOnly = 'expeditionExclusive' in selectedItem && (selectedItem as MascotInhabitant).expeditionExclusive === true && !owned;
    const canAfford = coins >= selectedItem.cost;
    const rarityColor = RARITY_COLORS[selectedItem.rarity] || RARITY_COLORS.commun;
    const rarityBg = RARITY_BG[selectedItem.rarity] || RARITY_BG.commun;

    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.detailOverlay}>
          <Animated.View entering={FadeIn.duration(200)} style={styles.detailWoodFrame}>
            {/* Inner wood border */}
            <View style={styles.detailWoodInner}>
              {/* Close button */}
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setSelectedItem(null)}
                activeOpacity={0.75}
              >
                <Text style={styles.detailCloseBtnText}>{'✕'}</Text>
              </TouchableOpacity>

              {/* Awning */}
              <AwningStripes />

              {/* Parchment body */}
              <View style={styles.detailParchment}>
                {/* Handle */}
                <View style={styles.handle} />

                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                  {/* Header emoji + nom */}
                  <View style={styles.detailHeader}>
                    {ITEM_ILLUSTRATIONS[selectedItem.id] ? (
                      <Image source={ITEM_ILLUSTRATIONS[selectedItem.id]} style={styles.detailIllustration} />
                    ) : (
                      <Text style={styles.detailEmoji}>{selectedItem.emoji}</Text>
                    )}
                    <Text style={styles.detailName}>
                      {t(selectedItem.labelKey)}
                    </Text>
                    <View style={[styles.rarityBadge, { backgroundColor: rarityBg, alignSelf: 'center' }]}>
                      <Text style={[styles.rarityText, { color: rarityColor }]}>
                        {t(`mascot.shop.rarity.${selectedItem.rarity}`)}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  <Text style={styles.detailDescription}>
                    {t(getDescKey(selectedItem))}
                  </Text>

                  {/* Infos : stade requis + coût */}
                  <View style={styles.detailInfoRow}>
                    <View style={styles.detailInfoItem}>
                      <Text style={styles.detailInfoLabel}>
                        {t('mascot.shop.requiredStage', { stage: t(TREE_STAGES[minStageIdx].labelKey) })}
                      </Text>
                    </View>
                    <View style={styles.detailInfoDivider} />
                    <View style={styles.detailInfoItem}>
                      <Text style={styles.detailInfoLabel}>
                        {t('mascot.shop.points', { count: selectedItem.cost })}
                      </Text>
                    </View>
                  </View>

                  {/* Aperçu objet agrandi */}
                  <View style={styles.detailPreview}>
                    {ITEM_ILLUSTRATIONS[selectedItem.id] ? (
                      <Image
                        source={ITEM_ILLUSTRATIONS[selectedItem.id]}
                        style={styles.detailPreviewImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.detailPreviewEmoji}>{selectedItem.emoji}</Text>
                    )}
                  </View>

                  {/* Boutons */}
                  <View style={styles.detailActions}>
                    {owned ? (
                      <View style={styles.detailOwnedBadge}>
                        <Text style={styles.detailOwnedText}>
                          {t('mascot.shop.owned')}
                        </Text>
                      </View>
                    ) : expeditionOnly ? (
                      <View style={styles.detailExpeditionBadge}>
                        <Text style={styles.detailExpeditionText}>
                          {t('mascot.shop.expeditionOnly')}
                        </Text>
                      </View>
                    ) : locked ? (
                      <View style={styles.detailLockedBadge}>
                        <Text style={styles.detailLockedText}>
                          {t('mascot.shop.locked', { stage: t(TREE_STAGES[minStageIdx].labelKey) })}
                        </Text>
                      </View>
                    ) : (
                      <BuyButton
                        canAfford={canAfford}
                        disabled={!canAfford || buying === selectedItem.id}
                        onPress={() => handleBuy(selectedItem)}
                        label={
                          canAfford
                            ? t('mascot.shop.buyConfirm', { cost: selectedItem.cost, context: tone })
                            : t('mascot.shop.notEnoughLeaves', { context: tone })
                        }
                      />
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
        {/* Awning */}
        <AwningStripes />

        {/* Parchment content */}
        <View style={styles.parchment}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.75}>
          <Text style={styles.closeBtnText}>{'✕'}</Text>
        </TouchableOpacity>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Title + Coins */}
          <View style={styles.shopHeader}>
            <Text style={styles.shopTitle}>
              {t('mascot.shop.title', { context: tone })}
            </Text>
            <View style={styles.coinsBadge}>
              <Text style={styles.coinsText}>
                {t('mascot.shop.yourLeaves', { count: coins, context: tone })}
              </Text>
            </View>
            {/* Espace pour le bouton close */}
            <View style={{ width: 36 }} />
          </View>

          {/* Onglets */}
          <View style={styles.tabs}>
            {(['decorations', 'inhabitants', 'buildings'] as ShopTab[]).map((tabKey) => {
              const label =
                tabKey === 'decorations'
                  ? t('mascot.shop.decorations')
                  : tabKey === 'inhabitants'
                  ? t('mascot.shop.inhabitants')
                  : (t('farm.building.buy') ?? 'Bâtiments');
              const active = tab === tabKey;
              return (
                <TouchableOpacity
                  key={tabKey}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setTab(tabKey)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Liste */}
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {tab === 'buildings' ? (
              BUILDING_CATALOG.map((building, idx) => {
                const owned = (ownedBuildings ?? []).some(b => b.buildingId === building.id);
                const minStageIdx = TREE_STAGES.findIndex(s => s.stage === building.minTreeStage);
                const locked = stageIdx < minStageIdx;
                const canAfford = coins >= building.cost;

                return (
                  <Animated.View key={building.id} entering={FadeInDown.delay(idx * 60).duration(300)}>
                    <TouchableOpacity
                      style={[
                        styles.itemCard,
                        (locked || owned) && styles.itemCardLocked,
                      ]}
                      onPress={() => {
                        if (!owned && !locked && canAfford && onBuyBuilding) {
                          const occupiedCells = (ownedBuildings ?? []).map(b => b.cellId);
                          const freeCell = BUILDING_CELLS.find(c => !occupiedCells.includes(c.id));
                          if (!freeCell) return;
                          setBuying(building.id);
                          onBuyBuilding(building.id, freeCell.id).then(() => {
                            hapticsShopBuy();
                            setBuying(null);
                          }).catch(() => {
                            hapticsShopError();
                            setBuying(null);
                          });
                        }
                      }}
                      activeOpacity={0.75}
                      disabled={owned || locked || !canAfford || buying === building.id}
                    >
                      <View style={styles.itemContent}>
                        {BUILDING_SPRITES[building.id]
                          ? <Image source={BUILDING_SPRITES[building.id]} style={{ width: 32, height: 32 }} />
                          : <Text style={styles.itemEmoji}>{building.emoji}</Text>
                        }
                        <View style={styles.itemInfo}>
                          <Text style={[styles.itemName, (locked || owned) && styles.itemNameLocked]}>
                            {t(building.labelKey)}
                          </Text>
                          <Text style={styles.itemDesc} numberOfLines={1}>
                            {t(`${building.labelKey}_desc`)}
                          </Text>
                          <View style={styles.itemMeta}>
                            <Text style={styles.buildingIncome}>
                              {t('farm.building.dailyIncome', { amount: building.dailyIncome })}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {owned ? (
                        <View style={styles.ownedBadge}>
                          <Text style={styles.ownedText}>
                            {t('farm.building.owned')}
                          </Text>
                        </View>
                      ) : locked ? (
                        <View style={styles.lockedBadge}>
                          <Text style={styles.lockedText}>
                            🔒 {t(TREE_STAGES[minStageIdx].labelKey)}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.costBadge, !canAfford && styles.costBadgeDim]}>
                          <Text style={[styles.costText, !canAfford && styles.costTextDim]}>
                            {building.cost} 🍃
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })
            ) : (
              items.map((item, idx) => renderItem(item, idx))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>

      {/* Modal détail */}
      {renderDetailModal()}
    </View>
  );
}

// ── Styles ─────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Farm.parchmentDark,
  },
  // ── Wood frame shell ──
  woodFrame: {
    backgroundColor: Farm.woodDark,
    padding: 5,
    borderRadius: Radius['2xl'],
    ...Shadows.xl,
    maxHeight: '88%',
    minHeight: '88%',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
  },
  woodFrameInner: {
    backgroundColor: Farm.parchmentDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    borderRadius: Radius.xl,
    flex: 1,
  },

  // ── Close button (absolute on woodFrameInner) ──
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: Farm.parchment,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // ── Awning ──
  awning: {
    flexDirection: 'row',
    height: 28,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 4,
  },
  awningStripe: {
    flex: 1,
    height: 28,
  },
  awningScallops: {
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

  // ── Parchment body ──
  parchment: {
    backgroundColor: Farm.parchmentDark,
    flex: 1,
    paddingBottom: Spacing['3xl'],
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },

  // ── Shop header ──
  shopHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shopTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
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

  // ── Tabs ──
  tabs: {
    flexDirection: 'row',
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  tabActive: {
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

  // ── Item list ──
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    marginBottom: Spacing.sm,
  },
  itemCardLocked: {
    opacity: 0.5,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemEmoji: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  itemIllustration: {
    width: 40,
    height: 40,
    marginRight: Spacing.md,
    resizeMode: 'contain',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
    marginBottom: 2,
  },
  itemNameLocked: {
    fontStyle: 'italic',
  },
  itemDesc: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
    marginBottom: Spacing.xs,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rarityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  rarityText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  itemCost: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Farm.brownTextSub,
  },
  buildingIncome: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Farm.greenBtn,
  },
  ownedBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Farm.gold,
  },
  ownedText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.goldText,
  },
  lockedBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchment,
  },
  lockedText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    color: Farm.brownTextSub,
    fontStyle: 'italic',
  },
  expeditionBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  expeditionText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: '#2563EB',
  },
  costBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
  },
  costBadgeDim: {
    opacity: 0.6,
  },
  costText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  costTextDim: {
    color: Farm.brownTextSub,
  },
  chevron: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.normal,
    marginLeft: Spacing.sm,
    color: Farm.brownTextSub,
  },

  // ── Buy button 3D ──
  buyBtnOuter: {
    position: 'relative',
    marginBottom: 4,
  },
  buyBtnInner: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  buyBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: Farm.greenBtnHighlight,
    opacity: 0.35,
    borderTopLeftRadius: Radius.full,
    borderTopRightRadius: Radius.full,
  },
  buyBtnShadow: {
    position: 'absolute',
    bottom: -4,
    left: 4,
    right: 4,
    height: 4,
    borderRadius: Radius.full,
    zIndex: -1,
  },
  buyBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },

  // ── Detail modal overlay ──
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  detailWoodFrame: {
    backgroundColor: Farm.woodDark,
    padding: 5,
    borderRadius: Radius['2xl'],
    ...Shadows.xl,
    maxHeight: '70%',
    width: '100%',
    maxWidth: 400,
  },
  detailWoodInner: {
    backgroundColor: Farm.parchmentDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    borderRadius: Radius.xl,
    flexShrink: 1,
  },
  detailCloseBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  detailCloseBtnText: {
    color: Farm.parchment,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  detailParchment: {
    backgroundColor: Farm.parchmentDark,
    flexShrink: 1,
    paddingBottom: Spacing['3xl'],
  },
  detailHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  detailIllustration: {
    width: 72,
    height: 72,
    marginBottom: Spacing.sm,
    resizeMode: 'contain',
  },
  detailEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  detailName: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  detailDescription: {
    fontSize: FontSize.body,
    lineHeight: 22,
    textAlign: 'center',
    color: Farm.brownTextSub,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Farm.woodHighlight,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },
  detailInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailInfoDivider: {
    width: 1,
    height: 24,
    backgroundColor: Farm.woodHighlight,
  },
  detailInfoLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Farm.brownTextSub,
  },
  detailPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.xl,
    paddingVertical: Spacing['2xl'],
    marginBottom: Spacing.xl,
    marginHorizontal: Spacing.lg,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
  },
  detailPreviewImage: {
    width: 96,
    height: 96,
  },
  detailPreviewEmoji: {
    fontSize: 72,
  },
  detailActions: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  detailOwnedBadge: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: Farm.gold,
  },
  detailOwnedText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.goldText,
  },
  detailLockedBadge: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
  },
  detailLockedText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Farm.brownTextSub,
    fontStyle: 'italic',
  },
  detailExpeditionBadge: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(59,130,246,0.35)',
  },
  detailExpeditionText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: '#2563EB',
  },
});
