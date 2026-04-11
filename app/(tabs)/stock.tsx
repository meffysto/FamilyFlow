/**
 * stock.tsx — Écran de gestion du stock avec onglets par emplacement
 *
 * Affiche les produits groupés par emplacement (Frigo, Congélateur, Placards, Bébé),
 * avec des sections repliables pour les sous-catégories, recherche, et +/- quantité.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { StockEditor } from '../../components/StockEditor';
import { EmptyState } from '../../components/EmptyState';
import { StockItem } from '../../lib/types';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { EMPLACEMENTS, SUBCATEGORIES, getEmplacementDisplayLabel, getSubcategoryDisplayLabel } from '../../constants/stock';
import type { EmplacementId } from '../../constants/stock';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

// ─── Sous-composant : Section repliable ────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  count: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  count,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const { primary, tint, colors } = useThemeColors();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotation = useSharedValue(defaultExpanded ? 1 : 0);
  const contentHeight = useSharedValue(defaultExpanded ? 1 : 0);

  const toggleExpanded = useCallback(() => {
    Haptics.selectionAsync();
    const next = !expanded;
    setExpanded(next);
    rotation.value = withTiming(next ? 1 : 0, { duration: 250 });
    contentHeight.value = withTiming(next ? 1 : 0, { duration: 250 });
  }, [expanded]);

  // Rotation du chevron (0° → 90°)
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 90}deg` }],
  }));

  // Animation hauteur du contenu (maxHeight trick)
  const containerStyle = useAnimatedStyle(() => ({
    maxHeight: contentHeight.value * 2000,
    opacity: contentHeight.value,
    overflow: 'hidden' as const,
  }));

  return (
    <View style={sectionStyles.wrapper}>
      <TouchableOpacity
        style={[sectionStyles.header, { backgroundColor: colors.cardAlt }]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${count} produit${count > 1 ? 's' : ''}`}
        accessibilityState={{ expanded }}
      >
        <Animated.Text style={[sectionStyles.chevron, { color: colors.textSub }, chevronStyle]}>
          ▸
        </Animated.Text>
        <Text style={[sectionStyles.title, { color: colors.text }]}>{title}</Text>
        <View style={[sectionStyles.badge, { backgroundColor: tint }]}>
          <Text style={[sectionStyles.badgeText, { color: primary }]}>{count}</Text>
        </View>
      </TouchableOpacity>
      <Animated.View style={containerStyle}>{children}</Animated.View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.base,
    gap: Spacing.md,
  },
  chevron: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    width: 18,
    textAlign: 'center',
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
});

// ─── Composant principal ────────────────────────────────────────────────────────

export default function StockScreen() {
  const {
    stock,
    stockSections,
    updateStockQuantity,
    addStockItem,
    deleteStockItem,
    updateStockItem,
    addCourseItem,
    refresh,
  } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { refreshing, onRefresh } = useRefresh(refresh);

  const stockListRef = useRef<View>(null);
  const [selectedEmplacement, setSelectedEmplacement] = useState<EmplacementId>('tous');
  const [search, setSearch] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | undefined>(undefined);

  // ─── Compteur total par emplacement ──────────────────────────────────
  const countsByEmplacement = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const emp of EMPLACEMENTS) {
      counts[emp.id] = emp.id === 'tous' ? stock.length : stock.filter((s) => s.emplacement === emp.id).length;
    }
    return counts;
  }, [stock]);

  // ─── Items filtrés par emplacement + recherche + stocks bas ─────────
  const filteredItems = useMemo(() => {
    let items = selectedEmplacement === 'tous' ? [...stock] : stock.filter((s) => s.emplacement === selectedEmplacement);
    if (showLowStockOnly) {
      items = items.filter((s) => s.tracked !== false && s.seuil > 0 && s.quantite <= s.seuil);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.produit.toLowerCase().includes(q) ||
          (item.detail ?? '').toLowerCase().includes(q) ||
          (item.section ?? '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [stock, selectedEmplacement, search, showLowStockOnly]);

  // ─── Groupement par section/sous-catégorie ───────────────────────────
  const subcategories = SUBCATEGORIES[selectedEmplacement];
  const isTous = selectedEmplacement === 'tous';
  const hasSubcategories = subcategories.length > 0 || isTous;

  const grouped = useMemo(() => {
    if (!hasSubcategories) return null;
    const map = new Map<string, StockItem[]>();

    if (isTous) {
      // Grouper par emplacement
      for (const item of filteredItems) {
        const emp = EMPLACEMENTS.find(e => e.id === item.emplacement);
        const key = emp ? `${emp.emoji} ${emp.label}` : 'Autre';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
      // Trier dans l'ordre des emplacements
      const sorted = new Map<string, StockItem[]>();
      for (const emp of EMPLACEMENTS) {
        if (emp.id === 'tous') continue;
        const key = `${emp.emoji} ${emp.label}`;
        if (map.has(key)) sorted.set(key, map.get(key)!);
      }
      for (const [key, items] of map) {
        if (!sorted.has(key)) sorted.set(key, items);
      }
      for (const [key, items] of sorted) {
        sorted.set(key, items.sort((a, b) => a.produit.localeCompare(b.produit, 'fr')));
      }
      return sorted;
    }

    // Groupement par sous-catégorie (comportement existant)
    for (const item of filteredItems) {
      const key = item.section ?? 'Autre';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    const sorted = new Map<string, StockItem[]>();
    for (const sub of subcategories) {
      if (map.has(sub)) sorted.set(sub, map.get(sub)!);
    }
    for (const [key, items] of map) {
      if (!sorted.has(key)) sorted.set(key, items);
    }
    for (const [key, items] of sorted) {
      sorted.set(key, items.sort((a, b) => a.produit.localeCompare(b.produit, 'fr')));
    }
    return sorted;
  }, [filteredItems, hasSubcategories, subcategories, isTous]);

  // Items triés pour liste plate (frigo, congélateur)
  const sortedFlatItems = useMemo(() => {
    if (hasSubcategories) return [];
    return [...filteredItems].sort((a, b) => a.produit.localeCompare(b.produit, 'fr'));
  }, [filteredItems, hasSubcategories]);

  // ─── Stock bas total ─────────────────────────────────────────────────
  const lowStockCount = useMemo(
    () => stock.filter((s) => s.tracked !== false && s.seuil > 0 && s.quantite <= s.seuil).length,
    [stock]
  );

  // ─── Actions ─────────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingItem(undefined);
    setEditorVisible(true);
  }, []);

  const openEdit = useCallback((item: StockItem) => {
    setEditingItem(item);
    setEditorVisible(true);
  }, []);

  const handleAddToCourses = useCallback(
    (item: StockItem) => {
      const qty = item.qteAchat ? ` x${item.qteAchat}` : '';
      const detail =
        item.detail && !/^\d+$/.test(item.detail.trim()) ? ` (${item.detail})` : '';
      addCourseItem(`${item.produit}${detail}${qty}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('stock.addedToCourses', { name: item.produit }));
    },
    [addCourseItem, showToast]
  );

  const getStatusColor = useCallback(
    (item: StockItem) => {
      if (item.tracked === false || item.seuil === 0) return colors.success;
      if (item.quantite <= item.seuil) return colors.error;
      if (item.quantite <= item.seuil + 1) return colors.warning;
      return colors.success;
    },
    [colors]
  );

  const handleQuantityChange = useCallback(
    (lineIndex: number, newQty: number) => {
      Haptics.selectionAsync();
      updateStockQuantity(lineIndex, Math.max(0, newQty));
    },
    [updateStockQuantity]
  );

  // ─── Emplacement courant (pour l'empty state) ───────────────────────
  const currentEmplacement = EMPLACEMENTS.find((e) => e.id === selectedEmplacement);

  // ─── Rendu d'un item ─────────────────────────────────────────────────
  const renderItem = (item: StockItem, index: number) => {
    const statusColor = getStatusColor(item);
    const isLow = item.seuil > 0 && item.quantite <= item.seuil;

    return (
      <Animated.View key={item.lineIndex} entering={FadeIn.delay(Math.min(index * 40, 300))}>
        <TouchableOpacity
          style={[styles.itemRow, { backgroundColor: colors.card }, Shadows.sm]}
          onPress={() => openEdit(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${item.produit}, quantité ${item.quantite}`}
        >
          {/* Point de statut */}
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />

          {/* Infos produit */}
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
              {item.produit}
              {item.detail ? (
                <Text style={[styles.itemDetail, { color: colors.textMuted }]}>
                  {' '}
                  · {item.detail}
                </Text>
              ) : null}
            </Text>
          </View>

          {/* Quantité affichée */}
          <Text
            style={[
              styles.qtyLabel,
              { color: colors.textSub },
              isLow && { color: colors.error },
            ]}
          >
            {item.quantite}
          </Text>

          {/* Boutons +/- */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.bg }]}
              onPress={() => handleQuantityChange(item.lineIndex, item.quantite - 1)}
              disabled={item.quantite <= 0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('stock.a11y.decreaseQty')}
            >
              <Text
                style={[
                  styles.qtyBtnText,
                  { color: colors.textSub },
                  item.quantite <= 0 && styles.qtyBtnDisabled,
                ]}
              >
                −
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: colors.bg }]}
              onPress={() => handleQuantityChange(item.lineIndex, item.quantite + 1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('stock.a11y.increaseQty')}
            >
              <Text style={[styles.qtyBtnText, { color: colors.textSub }]}>+</Text>
            </TouchableOpacity>

            {/* Bouton courses (uniquement si stock bas) */}
            {isLow && (
              <TouchableOpacity
                style={[styles.courseBtn, { backgroundColor: colors.warningBg }]}
                onPress={() => handleAddToCourses(item)}
                accessibilityLabel={t('stock.a11y.addToCourses', { name: item.produit })}
              >
                <Text style={styles.courseBtnText}>🛒</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* ─── Header ────────────────────────────────────────── */}
      <View ref={stockListRef} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>{t('stock.title')}</Text>
          {lowStockCount > 0 && (
            <TouchableOpacity
              style={[
                styles.lowBadge,
                { backgroundColor: showLowStockOnly ? colors.error : colors.errorBg },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setShowLowStockOnly((v) => !v);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('stock.a11y.filterLowStock')}
              accessibilityState={{ selected: showLowStockOnly }}
            >
              <Text style={[styles.lowBadgeText, { color: showLowStockOnly ? colors.onPrimary : colors.error }]}>
                {lowStockCount} {t('stock.low')}{showLowStockOnly ? ' ✕' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: tint, borderColor: primary }]}
          onPress={openCreate}
          accessibilityRole="button"
          accessibilityLabel={t('stock.a11y.addProduct')}
        >
          <Text style={[styles.addBtnText, { color: primary }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Onglets emplacement ───────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        style={styles.tabsScroll}
      >
        {EMPLACEMENTS.map((emp) => {
          const isSelected = emp.id === selectedEmplacement;
          const count = countsByEmplacement[emp.id] ?? 0;
          return (
            <TouchableOpacity
              key={emp.id}
              style={[
                styles.tab,
                { backgroundColor: colors.cardAlt },
                isSelected && { backgroundColor: tint, borderColor: primary, borderWidth: 1.5 },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedEmplacement(emp.id);
                setSearch('');
              }}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${getEmplacementDisplayLabel(emp.id)}, ${count} ${t('stock.productCount', { count })}`}
            >
              <Text style={styles.tabEmoji}>{emp.emoji}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  { color: colors.textMuted },
                  isSelected && { color: primary, fontWeight: FontWeight.bold },
                ]}
              >
                {getEmplacementDisplayLabel(emp.id)}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    { backgroundColor: isSelected ? primary : colors.textMuted },
                  ]}
                >
                  <Text style={[styles.tabBadgeText, { color: colors.onPrimary }]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── Barre de recherche ────────────────────────────── */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.text,
            },
          ]}
          placeholder={t('stock.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* ─── Contenu ───────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Liste plate (Frigo, Congélateur) */}
        {!hasSubcategories && sortedFlatItems.length > 0 && (
          <View style={styles.itemsList}>
            {sortedFlatItems.map((item, index) => renderItem(item, index))}
          </View>
        )}

        {/* Sections repliables (Placards, Bébé) */}
        {hasSubcategories &&
          grouped &&
          Array.from(grouped.entries()).map(([sectionName, items]) => (
            <CollapsibleSection
              key={sectionName}
              title={getSubcategoryDisplayLabel(sectionName)}
              count={items.length}
              defaultExpanded={true}
            >
              <View style={styles.itemsList}>
                {items.map((item, index) => renderItem(item, index))}
              </View>
            </CollapsibleSection>
          ))}

        {/* État vide */}
        {filteredItems.length === 0 && (
          <EmptyState
            emoji={search.trim() ? '🔍' : currentEmplacement?.emoji ?? '📦'}
            title={
              search.trim()
                ? t('stock.noResults')
                : t('stock.emptyLocation', { location: currentEmplacement ? getEmplacementDisplayLabel(currentEmplacement.id) : t('stock.thisStock') })
            }
            subtitle={
              search.trim()
                ? t('stock.tryAnother')
                : t('stock.addFirst')
            }
            ctaLabel={search.trim() ? undefined : t('stock.addBtn')}
            onCta={search.trim() ? undefined : openCreate}
          />
        )}

        {/* Espacement bas pour le tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ─── Modal StockEditor ─────────────────────────────── */}
      <Modal visible={editorVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setEditorVisible(false); setEditingItem(undefined); }}>
        <StockEditor
          item={editingItem}
          sections={stockSections}
          defaultEmplacement={selectedEmplacement}
          onSave={async (data) => {
            if (editingItem) {
              await updateStockItem(editingItem.lineIndex, data);
            } else {
              await addStockItem(data);
            }
          }}
          onDelete={
            editingItem
              ? () => {
                  deleteStockItem(editingItem.lineIndex);
                  setEditorVisible(false);
                  setEditingItem(undefined);
                }
              : undefined
          }
          onClose={() => {
            setEditorVisible(false);
            setEditingItem(undefined);
          }}
        />
      </Modal>

      {/* ─── Aide contextuelle ─────────────────────────────── */}
      <ScreenGuide
        screenId="stock"
        targets={[{ ref: stockListRef, ...HELP_CONTENT.stock[0] }]}
      />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.heavy,
  },
  lowBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.full,
  },
  lowBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.base,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },

  // Onglets emplacement
  tabsScroll: {
    flexGrow: 0,
  },
  tabsContainer: {
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabEmoji: {
    fontSize: FontSize.lg,
  },
  tabLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  tabBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },

  // Recherche
  searchContainer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.md,
  },
  searchInput: {
    height: 40,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.xl,
    fontSize: FontSize.body,
    borderWidth: 1,
  },

  // Contenu
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    gap: Spacing['2xl'],
  },
  itemsList: {
    gap: Spacing.md,
  },
  bottomSpacer: {
    height: Spacing['6xl'],
  },

  // Item row (compact, 1 ligne)
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.xs,
  },
  itemInfo: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  itemName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  itemDetail: {
    fontWeight: FontWeight.normal,
  },
  qtyLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    minWidth: 22,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  qtyBtnDisabled: {
    opacity: 0.3,
  },
  courseBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseBtnText: {
    fontSize: FontSize.sm,
  },
});
