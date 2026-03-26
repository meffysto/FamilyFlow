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
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { hapticsShopBuy, hapticsShopError } from '../../lib/mascot/haptics';
import { useTone } from '../../lib/mascot/tone';

import { useThemeColors } from '../../contexts/ThemeContext';
import { TreeView } from './TreeView';
import {
  DECORATIONS,
  INHABITANTS,
  TREE_STAGES,
  type MascotDecoration,
  type MascotInhabitant,
  type TreeSpecies,
} from '../../lib/mascot/types';
import { getStageIndex } from '../../lib/mascot/engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

// ── Types ──────────────────────────────────────

type ShopTab = 'decorations' | 'inhabitants';

interface TreeShopProps {
  species: TreeSpecies;
  level: number;
  points: number;
  ownedDecorations: string[];
  ownedInhabitants: string[];
  onBuy: (itemId: string, itemType: 'decoration' | 'inhabitant') => Promise<void>;
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

const { width: SCREEN_W } = Dimensions.get('window');
const PREVIEW_TREE_SIZE = Math.min(SCREEN_W * 0.55, 220);

// ── Composant ──────────────────────────────────

export function TreeShop({ species, level, points, ownedDecorations, ownedInhabitants, onBuy, onClose }: TreeShopProps) {
  const { t } = useTranslation();
  const tone = useTone();
  const { primary, tint, colors, isDark } = useThemeColors();
  const [tab, setTab] = useState<ShopTab>('decorations');
  const [buying, setBuying] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<(MascotDecoration | MascotInhabitant) | null>(null);

  const stageIdx = getStageIndex(level);

  // Trier : disponibles d'abord, puis verrouillés, puis achetés
  const sortedDecorations = useMemo(() => {
    return [...DECORATIONS].sort((a, b) => {
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
    return [...INHABITANTS].sort((a, b) => {
      const aOwned = ownedInhabitants.includes(a.id);
      const bOwned = ownedInhabitants.includes(b.id);
      if (aOwned !== bOwned) return aOwned ? 1 : -1;
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
    // labelKey = "mascot.deco.balancoire" → descKey = "mascot.deco.balancoire_desc"
    return `${item.labelKey}_desc`;
  }, []);

  const renderItem = useCallback((item: MascotDecoration | MascotInhabitant, index: number) => {
    const owned = ownedList.includes(item.id);
    const minStageIdx = TREE_STAGES.findIndex((s) => s.stage === item.minStage);
    const locked = stageIdx < minStageIdx;
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
            { backgroundColor: colors.card, borderColor: owned ? rarityColor : colors.borderLight },
            owned && { borderWidth: 2, opacity: 0.7 },
            Shadows.sm,
          ]}
          onPress={() => setSelectedItem(item)}
          activeOpacity={0.7}
        >
          {/* Emoji + infos */}
          <View style={styles.itemContent}>
            <Text style={styles.itemEmoji}>{item.emoji}</Text>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.text }]}>
                {t(item.labelKey)}
              </Text>
              <Text style={[styles.itemDesc, { color: colors.textMuted }]} numberOfLines={1}>
                {t(getDescKey(item))}
              </Text>
              <View style={styles.itemMeta}>
                <View style={[styles.rarityBadge, { backgroundColor: rarityBg }]}>
                  <Text style={[styles.rarityText, { color: rarityColor }]}>
                    {t(`mascot.shop.rarity.${item.rarity}`)}
                  </Text>
                </View>
                {!owned && (
                  <Text style={[styles.itemCost, { color: colors.textSub }]}>
                    {t('mascot.shop.points', { count: item.cost })}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Badge statut */}
          {owned ? (
            <View style={[styles.ownedBadge, { backgroundColor: tint }]}>
              <Text style={[styles.ownedText, { color: primary }]}>
                {t('mascot.shop.owned')}
              </Text>
            </View>
          ) : locked ? (
            <View style={[styles.lockedBadge, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.lockedText, { color: colors.textMuted }]} numberOfLines={1}>
                {t(TREE_STAGES[minStageIdx].labelKey)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.chevron, { color: colors.textFaint }]}>{'›'}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [ownedList, stageIdx, colors, primary, tint, getDescKey, t]);

  // ── Modal de détail ──────────────────────────

  const renderDetailModal = () => {
    if (!selectedItem) return null;

    const owned = ownedList.includes(selectedItem.id);
    const minStageIdx = TREE_STAGES.findIndex((s) => s.stage === selectedItem.minStage);
    const locked = stageIdx < minStageIdx;
    const canAfford = points >= selectedItem.cost;
    const rarityColor = RARITY_COLORS[selectedItem.rarity] || RARITY_COLORS.commun;
    const rarityBg = RARITY_BG[selectedItem.rarity] || RARITY_BG.commun;
    const itemType = tab === 'decorations' ? 'decoration' : 'inhabitant';

    // Simuler l'arbre avec cet item ajouté
    const previewDecos = itemType === 'decoration'
      ? [...ownedDecorations, ...(owned ? [] : [selectedItem.id])]
      : ownedDecorations;
    const previewHabs = itemType === 'inhabitant'
      ? [...ownedInhabitants, ...(owned ? [] : [selectedItem.id])]
      : ownedInhabitants;

    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.detailOverlay}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.detailCard, { backgroundColor: colors.card }, Shadows.lg]}
          >
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Header emoji + nom */}
              <View style={styles.detailHeader}>
                <Text style={styles.detailEmoji}>{selectedItem.emoji}</Text>
                <Text style={[styles.detailName, { color: colors.text }]}>
                  {t(selectedItem.labelKey)}
                </Text>
                <View style={[styles.rarityBadge, { backgroundColor: rarityBg, alignSelf: 'center' }]}>
                  <Text style={[styles.rarityText, { color: rarityColor }]}>
                    {t(`mascot.shop.rarity.${selectedItem.rarity}`)}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text style={[styles.detailDescription, { color: colors.textSub }]}>
                {t(getDescKey(selectedItem))}
              </Text>

              {/* Infos : stade requis + coût */}
              <View style={[styles.detailInfoRow, { borderColor: colors.borderLight }]}>
                <View style={styles.detailInfoItem}>
                  <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>
                    {t('mascot.shop.requiredStage', { stage: t(TREE_STAGES[minStageIdx].labelKey) })}
                  </Text>
                </View>
                <View style={[styles.detailInfoDivider, { backgroundColor: colors.borderLight }]} />
                <View style={styles.detailInfoItem}>
                  <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>
                    {t('mascot.shop.points', { count: selectedItem.cost })}
                  </Text>
                </View>
              </View>

              {/* Aperçu arbre — au stade requis si pas encore atteint */}
              <Text style={[styles.detailPreviewTitle, { color: colors.textSub }]}>
                {locked
                  ? `${t('mascot.shop.preview')} (${t(TREE_STAGES[minStageIdx].labelKey)})`
                  : t('mascot.shop.preview')}
              </Text>
              <View style={[styles.detailPreview, { backgroundColor: isDark ? 'rgba(16,32,48,0.4)' : 'rgba(200,230,255,0.3)' }]}>
                <TreeView
                  species={species}
                  level={locked ? TREE_STAGES[minStageIdx].minLevel : level}
                  size={PREVIEW_TREE_SIZE}
                  interactive={false}
                  decorations={previewDecos}
                  inhabitants={previewHabs}
                  previewMode
                />
              </View>

              {/* Boutons */}
              <View style={styles.detailActions}>
                {owned ? (
                  <View style={[styles.detailOwnedBadge, { backgroundColor: tint }]}>
                    <Text style={[styles.detailOwnedText, { color: primary }]}>
                      {t('mascot.shop.owned')}
                    </Text>
                  </View>
                ) : locked ? (
                  <View style={[styles.detailLockedBadge, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[styles.detailLockedText, { color: colors.textMuted }]}>
                      {t('mascot.shop.locked', { stage: t(TREE_STAGES[minStageIdx].labelKey) })}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.detailBuyBtn,
                      { backgroundColor: canAfford ? primary : colors.cardAlt },
                      buying === selectedItem.id && { opacity: 0.5 },
                    ]}
                    onPress={() => handleBuy(selectedItem)}
                    disabled={!canAfford || buying === selectedItem.id}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.detailBuyText, { color: canAfford ? '#FFFFFF' : colors.textMuted }]}>
                      {canAfford
                        ? t('mascot.shop.buyConfirm', { cost: selectedItem.cost, context: tone })
                        : t('mascot.shop.notEnoughPoints', { context: tone })}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.detailCloseBtn, { borderColor: colors.borderLight }]}
                  onPress={() => setSelectedItem(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.detailCloseText, { color: colors.textSub }]}>
                    {t('mascot.shop.close')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.closeBtnText, { color: primary }]}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('mascot.shop.title', { context: tone })}
        </Text>
        <View style={styles.closeBtn} />
      </View>

      {/* Points */}
      <View style={[styles.pointsBar, { backgroundColor: tint }]}>
        <Text style={[styles.pointsText, { color: primary }]}>
          {t('mascot.shop.yourPoints', { count: points, context: tone })}
        </Text>
      </View>

      {/* Onglets */}
      <View style={[styles.tabs, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[styles.tab, tab === 'decorations' && { borderBottomColor: primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('decorations')}
        >
          <Text style={[styles.tabText, { color: tab === 'decorations' ? primary : colors.textMuted }]}>
            {t('mascot.shop.decorations')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'inhabitants' && { borderBottomColor: primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('inhabitants')}
        >
          <Text style={[styles.tabText, { color: tab === 'inhabitants' ? primary : colors.textMuted }]}>
            {t('mascot.shop.inhabitants')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, idx) => renderItem(item, idx))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal détail */}
      {renderDetailModal()}
    </SafeAreaView>
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
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
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
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: FontSize.caption,
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
  },
  ownedBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  ownedText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  lockedBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  lockedText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  chevron: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.normal,
    marginLeft: Spacing.sm,
  },

  // ── Detail modal ──
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  detailCard: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    maxHeight: '90%',
    width: '100%',
    maxWidth: 400,
  },
  detailHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  detailEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  detailName: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  detailDescription: {
    fontSize: FontSize.body,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  detailInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailInfoDivider: {
    width: 1,
    height: 24,
  },
  detailInfoLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  detailPreviewTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailPreview: {
    alignItems: 'center',
    borderRadius: Radius.xl,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  detailActions: {
    gap: Spacing.md,
  },
  detailOwnedBadge: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  detailOwnedText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  detailLockedBadge: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  detailLockedText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  detailBuyBtn: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  detailBuyText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  detailCloseBtn: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    borderWidth: 1,
  },
  detailCloseText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
});
