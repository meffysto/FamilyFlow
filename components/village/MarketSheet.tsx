// components/village/MarketSheet.tsx
// Modal Marché Boursier Village — interface achat/vente avec prix dynamiques O&D.
// Esthétique cozy farm game : cadre bois, auvent rayé, fond parchemin.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import {
  getAllMarketSummaries,
  getTrendLabel,
  getStockLabel,
  transactionsRemainingToday,
  MAX_MARKET_TXN_PER_DAY,
} from '../../lib/village/market-engine';
import type { MarketItemSummary } from '../../lib/village/market-engine';
import type { MarketStock, MarketTransaction } from '../../lib/village/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

// ── Types ─────────────────────────────────────────────────────────────────

type MarketTab = 'acheter' | 'vendre';
type MarketCategoryFilter = 'all' | 'village' | 'farm' | 'harvest' | 'crafted' | 'village_craft';

const CATEGORY_FILTERS: { key: MarketCategoryFilter; label: string; emoji: string }[] = [
  { key: 'all',           label: 'Tout',      emoji: '🏪' },
  { key: 'village',       label: 'Village',    emoji: '🏘️' },
  { key: 'farm',          label: 'Ferme',      emoji: '🐔' },
  { key: 'harvest',       label: 'Récoltes',   emoji: '🌾' },
  { key: 'crafted',       label: 'Crafts',     emoji: '🍳' },
  { key: 'village_craft', label: 'Atelier',    emoji: '⚒️' },
];

interface MarketSheetProps {
  visible: boolean;
  marketStock: MarketStock;
  marketTransactions: MarketTransaction[];
  profileId: string;
  profileCoins: number;
  /** Items village + village_craft (inventaire collectif) */
  villageInventory: Record<string, number>;
  /** Items ferme (oeuf/lait/farine/miel — per-profile) */
  farmInventory: Record<string, number>;
  /** Récoltes cultures (per-profile) */
  harvestInventory: Record<string, number>;
  /** Items craftés ferme — recipeId → count (per-profile) */
  craftedCounts: Record<string, number>;
  onBuy: (itemId: string, quantity: number) => Promise<{ success: boolean; totalCost?: number; error?: string }>;
  onSell: (itemId: string, quantity: number) => Promise<{ success: boolean; totalGain?: number; error?: string }>;
  onClose: () => void;
}

// ── Constantes ────────────────────────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

const TREND_COLORS: Record<string, string> = {
  tres_cher: '#EF4444',
  cher: '#F97316',
  normal: Farm.brownTextSub,
  bon_prix: Farm.greenBtn,
  brade: '#3B82F6',
};

const STOCK_COLORS: Record<string, string> = {
  rupture: '#EF4444',
  faible: '#F97316',
  normal: Farm.brownTextSub,
  abondant: Farm.greenBtn,
};

// ── Sous-composant : auvent rayé ────────────────────────────────

function AwningStripes() {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
      <View style={styles.awningShadow} />
      <View style={styles.awningScallop}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningScallopDot,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Sous-composant : bouton farm 3D ─────────────────────────────

function FarmButton({
  label,
  enabled,
  variant,
  onPress,
}: {
  label: string;
  enabled: boolean;
  variant: 'buy' | 'sell';
  onPress?: () => void;
}) {
  const pressedY = useSharedValue(0);

  const btnBg = variant === 'buy' ? Farm.woodBtn : Farm.greenBtn;
  const btnShadow = variant === 'buy' ? Farm.woodBtnShadow : Farm.greenBtnShadow;
  const btnHighlight = variant === 'buy' ? Farm.woodBtnHighlight : Farm.greenBtnHighlight;
  const bg = enabled ? btnBg : Farm.parchmentDark;
  const shadow = enabled ? btnShadow : '#D0CBC3';
  const highlight = enabled ? btnHighlight : Farm.parchment;

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressedY.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressedY.value / 4,
  }));

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      onPressIn={() => {
        if (enabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          pressedY.value = withSpring(4, SPRING_CONFIG);
        }
      }}
      onPressOut={() => { pressedY.value = withSpring(0, SPRING_CONFIG); }}
      style={styles.farmBtnTouchable}
    >
      <Animated.View style={[styles.farmBtnShadow, { backgroundColor: shadow }, shadowStyle]} />
      <Animated.View style={[styles.farmBtnBody, { backgroundColor: bg }, btnStyle]}>
        <View style={[styles.farmBtnGloss, { backgroundColor: highlight }]} />
        <Text style={[
          styles.farmBtnText,
          { color: enabled ? '#FFFFFF' : Farm.brownTextSub, textShadowColor: enabled ? 'rgba(0,0,0,0.25)' : 'transparent' },
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── MarketItemRow (memoïsé) ──────────────────────────────────────────────

const MarketItemRow = React.memo(function MarketItemRow({
  summary,
  mode,
  sellableQty,
  onAction,
}: {
  summary: MarketItemSummary;
  mode: MarketTab;
  sellableQty: number;
  onAction: (itemId: string, qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const price = mode === 'acheter' ? summary.buyPrice : summary.sellPrice;
  const total = price * qty;
  const maxQty = mode === 'acheter' ? summary.stock : sellableQty;
  const trendColor = TREND_COLORS[summary.trend] ?? Farm.brownTextSub;
  const stockColor = STOCK_COLORS[summary.stockLevel] ?? Farm.brownTextSub;

  const handlePress = useCallback(() => {
    onAction(summary.def.itemId, qty);
    setQty(1);
  }, [summary.def.itemId, qty, onAction]);

  const canAct = maxQty >= qty && qty > 0;

  return (
    <View style={styles.itemRow}>
      {/* Info item */}
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <View style={styles.itemEmojiCircle}>
            <Text style={styles.itemEmoji}>{summary.def.emoji}</Text>
          </View>
          <View style={styles.itemNameCol}>
            <Text style={styles.itemName} numberOfLines={1}>
              {summary.def.label}
            </Text>
            <View style={styles.indicatorRow}>
              <Text style={[styles.trendBadge, { color: trendColor }]}>
                {summary.trendEmoji} {getTrendLabel(summary.trend)}
              </Text>
              <Text style={[styles.stockBadge, { color: stockColor }]}>
                {summary.stockEmoji} {getStockLabel(summary.stockLevel)}
              </Text>
            </View>
          </View>
        </View>

        {/* Prix */}
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>
            {mode === 'acheter' ? 'Prix' : 'Rachat'}
          </Text>
          <Text style={[styles.priceValue, { color: trendColor }]}>
            {price} 🍃
          </Text>
          {summary.buyPrice !== summary.def.basePrice && (
            <Text style={styles.basePrice}>
              base {summary.def.basePrice}
            </Text>
          )}
        </View>

        {/* Stock marché */}
        <Text style={styles.stockInfo}>
          {mode === 'acheter'
            ? `${summary.stock} au marché`
            : `Vous : ${sellableQty} · Marché : ${summary.stock}`}
        </Text>
      </View>

      {/* Contrôles quantité + bouton */}
      <View style={styles.actionCol}>
        <View style={styles.qtyRow}>
          <TouchableOpacity
            onPress={() => setQty(Math.max(1, qty - 1))}
            style={styles.qtyBtn}
            activeOpacity={0.6}
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{qty}</Text>
          <TouchableOpacity
            onPress={() => setQty(Math.min(maxQty, qty + 1))}
            style={styles.qtyBtn}
            activeOpacity={0.6}
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <FarmButton
          label={mode === 'acheter' ? `${total} 🍃` : `+${total} 🍃`}
          enabled={canAct}
          variant={mode === 'acheter' ? 'buy' : 'sell'}
          onPress={handlePress}
        />
      </View>
    </View>
  );
});

// ── TransactionRow (memoïsé) ──────────────────────────────────────────────

const TransactionRow = React.memo(function TransactionRow({
  txn,
}: {
  txn: MarketTransaction;
}) {
  const isBuy = txn.action === 'buy';
  return (
    <View style={styles.txnRow}>
      <Text style={[styles.txnAction, { color: isBuy ? '#3B82F6' : Farm.greenBtn }]}>
        {isBuy ? '📥' : '📤'}
      </Text>
      <View style={styles.txnInfo}>
        <Text style={styles.txnLabel} numberOfLines={1}>
          {txn.quantity}× {txn.itemId.replace(/_/g, ' ')}
        </Text>
        <Text style={styles.txnMeta}>
          {isBuy ? `-${txn.totalPrice}` : `+${txn.totalPrice}`} 🍃 · {formatTime(txn.timestamp)}
        </Text>
      </View>
    </View>
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── MarketSheet ──────────────────────────────────────────────────────────

export function MarketSheet({
  visible,
  marketStock,
  marketTransactions,
  profileId,
  profileCoins,
  villageInventory,
  farmInventory,
  harvestInventory,
  craftedCounts,
  onBuy,
  onSell,
  onClose,
}: MarketSheetProps) {
  const { colors, primary } = useThemeColors();
  const [tab, setTab] = useState<MarketTab>('acheter');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MarketCategoryFilter>('all');

  // Animation flash quand transaction réussie
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const summaries = useMemo(
    () => getAllMarketSummaries(marketStock),
    [marketStock],
  );

  const txnsRemaining = useMemo(
    () => transactionsRemainingToday(marketTransactions, profileId),
    [marketTransactions, profileId],
  );

  const recentTxns = useMemo(
    () => [...marketTransactions].reverse().slice(0, 15),
    [marketTransactions],
  );

  const sellableQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of summaries) {
      const cat = s.def.category;
      if (cat === 'village' || cat === 'village_craft') {
        map[s.def.itemId] = villageInventory[s.def.itemId] ?? 0;
      } else if (cat === 'farm') {
        map[s.def.itemId] = farmInventory[s.def.itemId] ?? 0;
      } else if (cat === 'harvest') {
        map[s.def.itemId] = harvestInventory[s.def.itemId] ?? 0;
      } else if (cat === 'crafted') {
        map[s.def.itemId] = craftedCounts[s.def.itemId] ?? 0;
      }
    }
    return map;
  }, [summaries, villageInventory, farmInventory, harvestInventory, craftedCounts]);

  const handleBuy = useCallback(async (itemId: string, qty: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await onBuy(itemId, qty);
    if (result.success) {
      flashOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 400 }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Achat impossible', result.error ?? 'Erreur inconnue');
    }
  }, [onBuy, flashOpacity]);

  const handleSell = useCallback(async (itemId: string, qty: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await onSell(itemId, qty);
    if (result.success) {
      flashOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 400 }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Vente impossible', result.error ?? 'Erreur inconnue');
    }
  }, [onSell, flashOpacity]);

  const filteredSummaries = useMemo(() => {
    let items = tab === 'acheter'
      ? summaries.filter(s => s.stock > 0)
      : summaries.filter(s => (sellableQtyMap[s.def.itemId] ?? 0) > 0);

    // Filtre catégorie
    if (categoryFilter !== 'all') {
      items = items.filter(s => s.def.category === categoryFilter);
    }

    // Filtre recherche
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(s =>
        s.def.label.toLowerCase().includes(q) ||
        s.def.itemId.toLowerCase().includes(q),
      );
    }

    return items;
  }, [summaries, tab, sellableQtyMap, categoryFilter, search]);

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

        {/* Panneau farm game */}
        <View style={styles.woodFrame}>
          <View style={styles.woodFrameInner}>
            <AwningStripes />

            <View style={styles.parchment}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.title}>Marché du Village</Text>
                  <Text style={styles.subtitle}>Offre & Demande</Text>
                </View>
              </View>

              {/* Barre info — coins + transactions restantes */}
              <View style={styles.infoBar}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoValue}>
                    {profileCoins} 🍃
                  </Text>
                  <Text style={styles.infoLabel}>Solde</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoItem}>
                  <Text style={[styles.infoValue, txnsRemaining === 0 && { color: '#EF4444' }]}>
                    {txnsRemaining}/{MAX_MARKET_TXN_PER_DAY}
                  </Text>
                  <Text style={styles.infoLabel}>Transactions</Text>
                </View>
              </View>

              {/* Flash de succès */}
              <Animated.View
                style={[styles.flash, flashStyle]}
                pointerEvents="none"
              />

              {/* Onglets */}
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tab, tab === 'acheter' && styles.tabActive]}
                  onPress={() => setTab('acheter')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, tab === 'acheter' && styles.tabTextActive]}>
                    📥 Acheter
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, tab === 'vendre' && styles.tabActiveSell]}
                  onPress={() => setTab('vendre')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, tab === 'vendre' && styles.tabTextActive]}>
                    📤 Vendre
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Barre de recherche */}
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un item..."
                  placeholderTextColor={Farm.brownTextSub}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              {/* Chips catégorie */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {CATEGORY_FILTERS.map(f => {
                  const active = categoryFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCategoryFilter(active ? 'all' : f.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {f.emoji} {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {txnsRemaining === 0 && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    style={styles.limitBanner}
                  >
                    <Text style={styles.limitText}>
                      Limite atteinte — revenez demain !
                    </Text>
                  </Animated.View>
                )}

                {filteredSummaries.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>
                      {tab === 'acheter' ? '🏪' : '📦'}
                    </Text>
                    <Text style={styles.emptyText}>
                      {tab === 'acheter'
                        ? 'Le marché est vide — les prix vont monter !'
                        : 'Rien à vendre — produisez des items !'}
                    </Text>
                  </View>
                ) : (
                  filteredSummaries.map((s, idx) => (
                    <Animated.View
                      key={s.def.itemId}
                      entering={FadeInDown.delay(idx * 40).duration(200)}
                    >
                      <MarketItemRow
                        summary={s}
                        mode={tab}
                        sellableQty={sellableQtyMap[s.def.itemId] ?? 0}
                        onAction={tab === 'acheter' ? handleBuy : handleSell}
                      />
                    </Animated.View>
                  ))
                )}

                {/* Historique des dernières transactions */}
                {recentTxns.length > 0 && (
                  <View style={styles.txnSection}>
                    <Text style={styles.txnTitle}>
                      Dernières transactions
                    </Text>
                    {recentTxns.map((txn, idx) => (
                      <TransactionRow key={`${txn.timestamp}-${idx}`} txn={txn} />
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Bouton fermer */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtnFarm}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnFarmText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // ── Cadre bois ──────────────────────────────────
  woodFrame: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    borderRadius: Radius['2xl'],
    backgroundColor: Farm.woodDark,
    padding: 5,
    ...Shadows.xl,
    maxHeight: '90%',
  },
  woodFrameInner: {
    borderRadius: Radius.xl,
    backgroundColor: Farm.woodLight,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    flexShrink: 1,
  },

  // ── Auvent ──────────────────────────────────────
  awning: {
    height: 36,
    overflow: 'hidden',
  },
  awningStripes: {
    flexDirection: 'row',
    height: 28,
  },
  awningStripe: {
    flex: 1,
  },
  awningShadow: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  awningScallop: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
  },
  awningScallopDot: {
    flex: 1,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  // ── Fond parchemin ──────────────────────────────
  parchment: {
    backgroundColor: Farm.parchment,
    flexShrink: 1,
    paddingBottom: Spacing['3xl'],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Farm.woodHighlight,
  },

  // ── Header ──────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Farm.brownTextSub,
    marginTop: 2,
  },

  // ── Barre info ──────────────────────────────────
  infoBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing['2xl'],
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  infoLabel: {
    fontSize: FontSize.label,
    marginTop: 2,
    color: Farm.brownTextSub,
  },
  infoDivider: {
    width: 1.5,
    backgroundColor: Farm.woodHighlight,
  },

  // ── Flash succès ────────────────────────────────
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Farm.greenBtn,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },

  // ── Onglets ─────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing['2xl'],
    backgroundColor: Farm.parchmentDark,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    padding: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  tabActive: {
    backgroundColor: Farm.woodBtn,
  },
  tabActiveSell: {
    backgroundColor: Farm.greenBtn,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
  },
  tabTextActive: {
    color: Farm.parchment,
  },

  // ── Contenu ─────────────────────────────────────
  // Recherche
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing['2xl'],
    marginTop: Spacing.lg,
    backgroundColor: Farm.parchmentDark,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Farm.woodDark,
    paddingHorizontal: Spacing.lg,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Farm.brownText,
    paddingVertical: 0,
  },

  // Chips catégorie
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1.5,
    borderColor: Farm.woodDark,
  },
  chipActive: {
    backgroundColor: Farm.woodBtn,
    borderColor: Farm.woodBtnShadow,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    paddingBottom: 100,
    gap: Spacing.lg,
  },

  // ── Limite ──────────────────────────────────────
  limitBanner: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.orange,
    backgroundColor: Farm.parchmentDark,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  limitText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.orange,
  },

  // ── Item row ────────────────────────────────────
  itemRow: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    padding: Spacing.xl,
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  itemInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  itemEmojiCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchment,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemEmoji: {
    fontSize: 20,
  },
  itemNameCol: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 2,
  },
  trendBadge: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  stockBadge: {
    fontSize: FontSize.label,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  priceLabel: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
  },
  priceValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  basePrice: {
    fontSize: FontSize.label,
    textDecorationLine: 'line-through',
    color: Farm.brownTextSub,
  },
  stockInfo: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
  },

  // ── Action column ───────────────────────────────
  actionCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Farm.parchment,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
  },
  qtyBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  qtyValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    minWidth: 20,
    textAlign: 'center',
    color: Farm.brownText,
  },

  // ── Bouton farm 3D ──────────────────────────────
  farmBtnTouchable: {
    minWidth: 80,
  },
  farmBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  farmBtnBody: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  farmBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    opacity: 0.3,
  },
  farmBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  // ── État vide ───────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
    gap: Spacing.lg,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    color: Farm.brownTextSub,
  },

  // ── Transactions ────────────────────────────────
  txnSection: {
    borderTopWidth: 1.5,
    borderTopColor: Farm.woodHighlight,
    paddingTop: Spacing.xl,
    marginTop: Spacing.xl,
  },
  txnTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
    color: Farm.brownText,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Farm.woodHighlight,
    gap: Spacing.md,
  },
  txnAction: {
    fontSize: 18,
  },
  txnInfo: {
    flex: 1,
  },
  txnLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
  },
  txnMeta: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
  },

  // ── Bouton fermer ───────────────────────────────
  closeBtnFarm: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnFarmText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
  },
});
