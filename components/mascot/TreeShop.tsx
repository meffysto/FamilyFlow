/**
 * TreeShop.tsx — Boutique décorations & habitants pour l'arbre mascotte
 *
 * Modal accessible depuis l'écran arbre : catalogue filtré par stade,
 * achat avec déduction de points, badges de rareté, animations.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import {
  DECORATIONS,
  INHABITANTS,
  TREE_STAGES,
  type MascotDecoration,
  type MascotInhabitant,
  type TreeStage,
} from '../../lib/mascot/types';
import { getStageIndex } from '../../lib/mascot/engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

// ── Types ──────────────────────────────────────

type ShopTab = 'decorations' | 'inhabitants';

interface TreeShopProps {
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
};

const RARITY_BG: Record<string, string> = {
  commun: 'rgba(156,163,175,0.12)',
  rare: 'rgba(59,130,246,0.12)',
  'épique': 'rgba(139,92,246,0.12)',
  'légendaire': 'rgba(245,158,11,0.12)',
};

// ── Composant ──────────────────────────────────

export function TreeShop({ level, points, ownedDecorations, ownedInhabitants, onBuy, onClose }: TreeShopProps) {
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const [tab, setTab] = useState<ShopTab>('decorations');
  const [buying, setBuying] = useState<string | null>(null);

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
    const labelKey = tab === 'decorations'
      ? (item as MascotDecoration).labelKey
      : (item as MascotInhabitant).labelKey;
    const itemName = t(labelKey);

    Alert.alert(
      t('mascot.shop.title'),
      t('mascot.shop.buyConfirm', { item: `${item.emoji} ${itemName}`, cost: item.cost }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mascot.shop.buy'),
          onPress: async () => {
            setBuying(item.id);
            try {
              await onBuy(item.id, itemType);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            setBuying(null);
          },
        },
      ]
    );
  }, [tab, onBuy, t]);

  const renderItem = useCallback((item: MascotDecoration | MascotInhabitant, index: number) => {
    const owned = ownedList.includes(item.id);
    const minStageIdx = TREE_STAGES.findIndex((s) => s.stage === item.minStage);
    const locked = stageIdx < minStageIdx;
    const canAfford = points >= item.cost;
    const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.commun;
    const rarityBg = RARITY_BG[item.rarity] || RARITY_BG.commun;

    return (
      <Animated.View
        key={item.id}
        entering={FadeInDown.delay(index * 60).duration(300)}
      >
        <View
          style={[
            styles.itemCard,
            { backgroundColor: colors.card, borderColor: owned ? rarityColor : colors.borderLight },
            owned && { borderWidth: 2, opacity: 0.7 },
            Shadows.sm,
          ]}
        >
          {/* Emoji + infos */}
          <View style={styles.itemContent}>
            <Text style={styles.itemEmoji}>{item.emoji}</Text>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.text }]}>
                {t(item.labelKey)}
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

          {/* Bouton action */}
          {owned ? (
            <View style={[styles.ownedBadge, { backgroundColor: tint }]}>
              <Text style={[styles.ownedText, { color: primary }]}>
                {t('mascot.shop.owned')}
              </Text>
            </View>
          ) : locked ? (
            <View style={[styles.lockedBadge, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.lockedText, { color: colors.textMuted }]} numberOfLines={1}>
                {t('mascot.shop.locked', { stage: t(TREE_STAGES[minStageIdx].labelKey) })}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.buyBtn,
                { backgroundColor: canAfford ? primary : colors.cardAlt },
                buying === item.id && { opacity: 0.5 },
              ]}
              onPress={() => handleBuy(item)}
              disabled={!canAfford || buying === item.id}
              activeOpacity={0.7}
            >
              <Text style={[styles.buyText, { color: canAfford ? '#FFFFFF' : colors.textMuted }]}>
                {canAfford ? t('mascot.shop.buy') : t('mascot.shop.notEnoughPoints')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  }, [ownedList, stageIdx, points, colors, primary, tint, isDark, buying, handleBuy, t]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: primary }]}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('mascot.shop.title')}
        </Text>
        <View style={styles.closeBtn} />
      </View>

      {/* Points */}
      <View style={[styles.pointsBar, { backgroundColor: tint }]}>
        <Text style={[styles.pointsText, { color: primary }]}>
          {t('mascot.shop.yourPoints', { count: points })}
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
  closeText: {
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
    paddingVertical: Spacing.md,
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
    maxWidth: 140,
  },
  lockedText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  buyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  buyText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
