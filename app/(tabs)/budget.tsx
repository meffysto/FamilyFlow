/**
 * budget.tsx — Suivi du budget familial
 *
 * Quatre vues :
 * 1. Résumé mensuel (barres de progression par catégorie)
 * 2. Liste des dépenses du mois (avec filtrage)
 * 3. Évolution des prix (comparaison multi-mois)
 * 4. Modal d'ajout rapide
 *
 * Accessible depuis Menu (more.tsx) et Dashboard card.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Camera, Search, Settings } from 'lucide-react-native';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAI } from '../../contexts/AIContext';
import { useToast } from '../../contexts/ToastContext';
import {
  formatAmount,
  categoryDisplay,
  sumByCategory,
  totalSpent,
  totalBudget,
  formatMonthLabel,
} from '../../lib/budget';
import { formatDateLocalized } from '../../lib/date-locale';
import { DateInput } from '../../components/ui/DateInput';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PillTabSwitcher, type PillTab } from '../../components/ui/PillTabSwitcher';
import { ReceiptReview } from '../../components/ReceiptReview';
import { captureAndScanReceipt } from '../../lib/receipt-scanner';
import type { ScanOutcome } from '../../lib/receipt-scanner';
import type { ReceiptScanResult } from '../../lib/ai-service';
import type { BudgetCategory, BudgetEntry } from '../../lib/types';
import { useParentalControls } from '../../contexts/ParentalControlsContext';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { EmptyState } from '../../components/EmptyState';

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Types pour l'onglet évolution ──────────────────────────────────────────

interface PriceEvolution {
  label: string;
  category: string;
  count: number;
  avgFirst: number;  // moyenne des premiers achats
  avgLast: number;   // moyenne des derniers achats
  firstDate: string;
  lastDate: string;
  change: number; // pourcentage
}

type TabId = 'resume' | 'list' | 'evolution';

export default function BudgetScreen() {
  const { t } = useTranslation();
  const { primary, colors, isDark } = useThemeColors();
  const { showToast } = useToast();
  const {
    budgetEntries,
    budgetConfig,
    budgetMonth,
    loadBudgetData,
    loadBudgetMonths,
    addExpense,
    deleteExpense,
    updateBudgetConfig,
    activeProfile,
    refresh,
  } = useVault();

  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
  const { isAllowed } = useParentalControls();

  // Guard : les enfants n'ont pas accès au budget (sauf si autorisé)
  if (isChildMode && !isAllowed('budget', activeProfile!.role)) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
        <Text style={{ color: colors.textMuted, fontSize: FontSize.lg }}>{t('budget.parentOnly')}</Text>
      </SafeAreaView>
    );
  }

  const { refreshing, onRefresh } = useRefresh(refresh);

  const [tab, setTab] = useState<TabId>('resume');
  const budgetHeaderRef = useRef<View>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // État modal "Configurer le budget"
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configLimits, setConfigLimits] = useState<Record<string, string>>({});

  // Add form state
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [amountText, setAmountText] = useState('');
  const [labelText, setLabelText] = useState('');
  const [dateText, setDateText] = useState(todayISO());

  // Scanner ticket
  const { config: aiConfig, isConfigured: aiConfigured } = useAI();
  const [scanning, setScanning] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptScanResult | null>(null);
  const [receiptReviewVisible, setReceiptReviewVisible] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const [evoMonths, setEvoMonths] = useState<6 | 12>(6);
  const [evoEntries, setEvoEntries] = useState<BudgetEntry[]>([]);
  const [evoLoading, setEvoLoading] = useState(false);

  // Mode sélection multiple (dépenses)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set()); // lineIndex set

  const toggleSelection = useCallback((lineIndex: number) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(lineIndex)) next.delete(lineIndex);
      else next.add(lineIndex);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback((lineIndex: number) => {
    setSelectionMode(true);
    setSelectedEntries(new Set([lineIndex]));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedEntries(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const count = selectedEntries.size;
    const totalAmount = formatAmount([...selectedEntries].reduce((sum, li) => {
      const entry = budgetEntries.find(e => e.lineIndex === li);
      return sum + (entry?.amount ?? 0);
    }, 0));
    Alert.alert(
      t('budget.deleteMultiple.title', { count }),
      t('budget.deleteMultiple.totalAmount', { amount: totalAmount }),
      [
        { text: t('budget.delete.cancel'), style: 'cancel' },
        {
          text: t('budget.delete.confirm'),
          style: 'destructive',
          onPress: async () => {
            // Supprimer du plus grand lineIndex au plus petit pour éviter le décalage
            const sorted = [...selectedEntries].sort((a, b) => b - a);
            for (const li of sorted) {
              await deleteExpense(li);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast(t('budget.toast.deleted', { count }), 'success');
            cancelSelection();
          },
        },
      ]
    );
  }, [selectedEntries, budgetEntries, deleteExpense, showToast, cancelSelection]);

  // Valeurs dérivées mémorisées
  const spent = useMemo(() => totalSpent(budgetEntries), [budgetEntries]);
  const budgetTotal = useMemo(() => totalBudget(budgetConfig), [budgetConfig]);
  const categoryNames = useMemo(() => budgetConfig.categories.map(categoryDisplay), [budgetConfig]);
  const sortedEntries = useMemo(
    () => [...budgetEntries].sort((a, b) => b.date.localeCompare(a.date)),
    [budgetEntries]
  );

  // ─── Filtrage des entrées ──────────────────────────────────────
  const filteredEntries = useMemo(() => {
    let entries = sortedEntries;
    if (filterCategory) {
      entries = entries.filter(e => e.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      entries = entries.filter(e => e.label.toLowerCase().includes(q));
    }
    return entries;
  }, [sortedEntries, filterCategory, searchQuery]);

  const isFiltered = !!filterCategory || !!searchQuery.trim();

  // ─── Montants par catégorie pour les chips de filtre ──────────
  const categorySpentMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of budgetConfig.categories) {
      const display = categoryDisplay(cat);
      map.set(display, sumByCategory(sortedEntries, display));
    }
    return map;
  }, [budgetConfig, sortedEntries]);

  // ─── Total montant des entrées filtrées ───────────────────────
  const filteredTotalAmount = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + e.amount, 0),
    [filteredEntries]
  );

  // ─── Tri catégories par urgence (dépassées > proches > reste décroissant) ──
  const sortedCategories = useMemo(() => {
    return [...budgetConfig.categories]
      .map((cat) => {
        const catSpent = sumByCategory(budgetEntries, categoryDisplay(cat));
        const pct = cat.limit > 0 ? (catSpent / cat.limit) * 100 : 0;
        return { cat, catSpent, pct, overBudget: catSpent > cat.limit };
      })
      .sort((a, b) => {
        // Dépassées en premier
        if (a.overBudget && !b.overBudget) return -1;
        if (!a.overBudget && b.overBudget) return 1;
        // Puis proches (>80%) avant le reste
        const aWarn = a.pct > 80 && !a.overBudget;
        const bWarn = b.pct > 80 && !b.overBudget;
        if (aWarn && !bWarn) return -1;
        if (!aWarn && bWarn) return 1;
        // Enfin, % décroissant
        return b.pct - a.pct;
      });
  }, [budgetConfig, budgetEntries]);

  // ─── Calcul évolution des prix ────────────────────────────────
  const priceEvolutions = useMemo((): PriceEvolution[] => {
    if (evoEntries.length === 0) return [];

    // Grouper par label normalisé
    const groups = new Map<string, BudgetEntry[]>();
    for (const entry of evoEntries) {
      const key = entry.label.trim().toLowerCase();
      const existing = groups.get(key) || [];
      existing.push(entry);
      groups.set(key, existing);
    }

    const results: PriceEvolution[] = [];
    for (const [, entries] of groups) {
      // Minimum 2 achats pour comparer
      if (entries.length < 2) continue;

      // Trier par date croissante
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      // Moyenne mobile : prendre les N premiers/derniers (N = min(3, moitié des achats))
      const n = Math.min(3, Math.floor(sorted.length / 2)) || 1;
      const avgFirst = sorted.slice(0, n).reduce((s, e) => s + e.amount, 0) / n;
      const avgLast = sorted.slice(-n).reduce((s, e) => s + e.amount, 0) / n;
      const change = avgFirst > 0 ? ((avgLast - avgFirst) / avgFirst) * 100 : 0;

      // Catégorie la plus fréquente
      const catCounts = new Map<string, number>();
      for (const e of entries) {
        catCounts.set(e.category, (catCounts.get(e.category) || 0) + 1);
      }
      let topCat = entries[0].category;
      let topCount = 0;
      for (const [cat, count] of catCounts) {
        if (count > topCount) { topCat = cat; topCount = count; }
      }

      results.push({
        label: sorted[0].label, // Garder la casse originale
        category: topCat,
        count: entries.length,
        avgFirst,
        avgLast,
        firstDate: sorted[0].date,
        lastDate: sorted[sorted.length - 1].date,
        change,
      });
    }

    // Trier par plus grande augmentation en premier
    results.sort((a, b) => b.change - a.change);
    return results;
  }, [evoEntries]);

  useEffect(() => {
    loadBudgetData();
  }, []);

  // Charger les données d'évolution quand on arrive sur l'onglet ou change la période
  useEffect(() => {
    if (tab !== 'evolution') return;
    let cancelled = false;
    setEvoLoading(true);
    loadBudgetMonths(evoMonths).then(entries => {
      if (!cancelled) {
        setEvoEntries(entries);
        setEvoLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setEvoLoading(false);
    });
    return () => { cancelled = true; setEvoEntries([]); };
  }, [tab, evoMonths, loadBudgetMonths]);

  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev' ? prevMonth(budgetMonth) : nextMonth(budgetMonth);
    loadBudgetData(newMonth);
  }, [budgetMonth, loadBudgetData]);

  const handleAdd = useCallback(async () => {
    if (!selectedCategory || !amountText.trim() || !labelText.trim()) {
      showToast(t('budget.toast.fillRequired'), 'error');
      return;
    }
    const amount = parseFloat(amountText.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      showToast(t('budget.toast.invalidAmount'), 'error');
      return;
    }

    await addExpense(dateText, categoryDisplay(selectedCategory), amount, labelText.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset form
    setAmountText('');
    setLabelText('');
    setSelectedCategory(null);
    setDateText(todayISO());
    setAddModalVisible(false);
  }, [selectedCategory, amountText, labelText, dateText, addExpense]);

  const handleDelete = useCallback((entry: BudgetEntry) => {
    Alert.alert(
      t('budget.delete.title'),
      `${entry.label} — ${formatAmount(entry.amount)}`,
      [
        { text: t('budget.delete.cancel'), style: 'cancel' },
        {
          text: t('budget.delete.confirm'),
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(entry.lineIndex);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [deleteExpense]);

  const handleScanReceipt = useCallback(async () => {
    if (!aiConfig) {
      showToast(t('budget.toast.configureApi'), 'error');
      return;
    }
    setScanning(true);
    try {
      const outcome = await captureAndScanReceipt(aiConfig, categoryNames);
      switch (outcome.status) {
        case 'success':
          setReceiptData(outcome.data);
          setReceiptReviewVisible(true);
          break;
        case 'error':
          showToast(outcome.message, 'error');
          break;
        case 'cancelled':
          // L'utilisateur a annulé le picker — pas de feedback
          break;
      }
    } catch {
      showToast(t('budget.toast.scanError'), 'error');
    } finally {
      setScanning(false);
    }
  }, [aiConfig, categoryNames, showToast]);

  const handleReceiptSave = useCallback(async (items: Array<{ date: string; category: string; amount: number; label: string }>) => {
    for (const item of items) {
      await addExpense(item.date, item.category, item.amount, item.label);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t('budget.toast.added', { count: items.length }), 'success');
    setReceiptReviewVisible(false);
    setReceiptData(null);
  }, [addExpense, showToast]);

  // ─── Modal "Configurer le budget" ─────────────────────────────────────────

  const handleOpenConfigModal = useCallback(() => {
    setConfigLimits(
      Object.fromEntries(budgetConfig.categories.map((c) => [c.name, String(c.limit)]))
    );
    setConfigModalVisible(true);
  }, [budgetConfig]);

  const handleSaveBudgetConfig = useCallback(async () => {
    for (const cat of budgetConfig.categories) {
      const raw = (configLimits[cat.name] ?? '').replace(',', '.');
      const val = parseFloat(raw);
      if (isNaN(val) || val < 0) {
        showToast(t('budget.config.invalidAmount', { name: cat.name }), 'error');
        return;
      }
    }
    const newConfig = {
      ...budgetConfig,
      categories: budgetConfig.categories.map((c) => ({
        ...c,
        limit: parseFloat((configLimits[c.name] ?? '0').replace(',', '.')),
      })),
    };
    await updateBudgetConfig(newConfig);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t('budget.config.savedToast'), 'success');
    setConfigModalVisible(false);
  }, [budgetConfig, configLimits, updateBudgetConfig, showToast, t]);

  // ─── Rendu onglet évolution ────────────────────────────────────────────────

  const renderEvolutionItem = useCallback(({ item }: { item: PriceEvolution }) => {
    const arrow = item.change > 1 ? '↗' : item.change < -1 ? '↘' : '→';
    const changeColor = item.change > 1 ? colors.error : item.change < -1 ? colors.success : colors.textMuted;

    return (
      <View style={[styles.evoCard, { backgroundColor: colors.card }]}>
        <View style={styles.evoHeader}>
          <View style={styles.evoLabelRow}>
            <Text style={[styles.evoCategory, { color: colors.textMuted }]}>{item.category}</Text>
            <Text style={[styles.evoLabel, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
          </View>
          <View style={[styles.evoBadge, { backgroundColor: changeColor + '18' }]}>
            <Text style={[styles.evoBadgeText, { color: changeColor }]}>
              {arrow} {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
            </Text>
          </View>
        </View>
        <View style={styles.evoPriceRow}>
          <View style={styles.evoPriceBlock}>
            <Text style={[styles.evoPriceLabel, { color: colors.textFaint }]}>
              {t('budget.evolution.avgFirst')}
            </Text>
            <Text style={[styles.evoPrice, { color: colors.textSub }]}>{formatAmount(item.avgFirst)}</Text>
          </View>
          <Text style={[styles.evoArrow, { color: changeColor }]}>{arrow}</Text>
          <View style={[styles.evoPriceBlock, { alignItems: 'flex-end' as const }]}>
            <Text style={[styles.evoPriceLabel, { color: colors.textFaint }]}>
              {t('budget.evolution.avgLast')}
            </Text>
            <Text style={[styles.evoPrice, { color: colors.text }]}>{formatAmount(item.avgLast)}</Text>
          </View>
        </View>
        <Text style={[styles.evoMeta, { color: colors.textFaint }]}>
          {t('budget.evolution.purchases', { count: item.count })}
          {' · '}
          {formatDateLocalized(item.firstDate)} → {formatDateLocalized(item.lastDate)}
        </Text>
      </View>
    );
  }, [colors, t]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <View ref={budgetHeaderRef}>
        <ScreenHeader
          title={t('budget.title')}
          actions={
            <>
              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: colors.card }]}
                onPress={handleOpenConfigModal}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel={t('budget.config.title')}
                accessibilityRole="button"
              >
                <Settings size={20} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
              {aiConfigured && (
                <TouchableOpacity
                  style={[styles.headerIconBtn, { backgroundColor: colors.card }]}
                  onPress={handleScanReceipt}
                  activeOpacity={0.7}
                  disabled={scanning}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel={scanning ? t('budget.scan.scanning') : t('budget.scan.button')}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: scanning }}
                >
                  {scanning ? (
                    <ActivityIndicator size="small" color={primary} />
                  ) : (
                    <Camera size={20} color={colors.text} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: primary }]}
                onPress={() => setAddModalVisible(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel={t('budget.header.addExpenseA11y')}
                accessibilityRole="button"
              >
                <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+</Text>
              </TouchableOpacity>
            </>
          }
          bottom={
            <View style={styles.tabsWrap}>
              <PillTabSwitcher
                tabs={[
                  { id: 'resume', label: t('budget.tabs.summary') },
                  { id: 'list', label: t('budget.tabs.expenses') },
                  { id: 'evolution', label: t('budget.tabs.evolution') },
                ] as ReadonlyArray<PillTab<TabId>>}
                activeTab={tab}
                onTabChange={setTab}
                primary={primary}
                colors={colors}
                marginHorizontal={0}
              />
            </View>
          }
        />
      </View>

      {/* Month navigation — masquée sur l'onglet évolution */}
      {tab !== 'evolution' && (
        <View style={[styles.monthNav, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => handleMonthChange('prev')} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }} accessibilityLabel={t('budget.a11y.prevMonth')} accessibilityRole="button">
            <Text style={[styles.monthArrow, { color: primary }]}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.text }]} accessibilityLabel={t('budget.month', { month: formatMonthLabel(budgetMonth) })}>{formatMonthLabel(budgetMonth)}</Text>
          <TouchableOpacity onPress={() => handleMonthChange('next')} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }} accessibilityLabel={t('budget.a11y.nextMonth')} accessibilityRole="button">
            <Text style={[styles.monthArrow, { color: primary }]}>{'›'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'resume' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, Layout.contentContainer]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {/* Total */}
          <View style={[styles.totalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t('budget.totalSpent')}</Text>
            <Text style={[styles.totalAmount, { color: spent > budgetTotal ? colors.error : colors.text }]}>
              {formatAmount(spent)}
            </Text>
            <Text style={[styles.totalBudget, { color: colors.textMuted }]}>
              {t('budget.outOf', { amount: formatAmount(budgetTotal) })}
            </Text>
            <View style={[styles.totalBar, { backgroundColor: colors.borderLight }]}>
              <View
                style={[
                  styles.totalBarFill,
                  {
                    width: `${Math.min((spent / budgetTotal) * 100, 100)}%`,
                    backgroundColor: spent > budgetTotal ? colors.error : primary,
                  },
                ]}
              />
            </View>
            {/* % utilisé + nb dépenses */}
            {(() => {
              const usagePct = budgetTotal > 0 ? Math.round((spent / budgetTotal) * 100) : 0;
              const entriesCount = budgetEntries.length;
              return (
                <Text style={[styles.totalStats, { color: colors.textMuted }]}>
                  {t('budget.usageStats', { percent: usagePct, count: entriesCount })}
                </Text>
              );
            })()}
          </View>

          {/* Catégories triées par urgence */}
          {sortedCategories.map(({ cat, catSpent, pct, overBudget }) => (
            <View key={cat.name} style={[styles.catCard, { backgroundColor: colors.card }]}>
              <View style={styles.catHeader}>
                <Text style={[styles.catName, { color: colors.text }]}>
                  {cat.emoji} {cat.name}
                </Text>
                <Text style={[styles.catPct, {
                  color: overBudget ? colors.error : pct > 80 ? colors.warning : colors.textMuted,
                }]}>
                  {Math.round(pct)}{'%'}
                </Text>
                <Text style={[styles.catAmount, { color: overBudget ? colors.error : colors.textSub }]}>
                  {formatAmount(catSpent)} / {formatAmount(cat.limit)}
                </Text>
              </View>
              <View style={[styles.catBar, { backgroundColor: colors.borderLight }]}>
                <View
                  style={[
                    styles.catBarFill,
                    {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: overBudget ? colors.error : pct > 80 ? colors.warning : colors.success,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
          <View style={styles.bottomPad} />
        </ScrollView>
      ) : tab === 'list' ? (
        <>
          {/* Barre d'action en mode sélection */}
          {selectionMode && (
            <View style={[styles.selectionBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={cancelSelection} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }} accessibilityLabel={t('budget.selection.cancelA11y')} accessibilityRole="button">
                <Text style={[styles.selectionCancel, { color: primary }]}>{t('budget.selection.cancel')}</Text>
              </TouchableOpacity>
              <Text style={[styles.selectionCount, { color: colors.text }]} accessibilityLabel={t('budget.selection.selectedA11y', { count: selectedEntries.size })}>
                {t('budget.selection.selected', { count: selectedEntries.size })}
              </Text>
              <TouchableOpacity onPress={handleDeleteSelected} accessibilityLabel={t('budget.selection.deleteA11y', { count: selectedEntries.size })} accessibilityRole="button">
                <Text style={[styles.selectionDelete, { color: colors.error }]}>{t('budget.selection.delete')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Barre de recherche + filtres catégorie */}
          <View style={[styles.filterContainer, { backgroundColor: colors.bg }]}>
            <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Search size={16} color={colors.textFaint} strokeWidth={2} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('budget.filter.search')}
                placeholderTextColor={colors.textFaint}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel={t('budget.filter.searchA11y')}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              {budgetConfig.categories.map((cat) => {
                const catDisplay = categoryDisplay(cat);
                const isActive = filterCategory === catDisplay;
                const catSpent = categorySpentMap.get(catDisplay) ?? 0;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive ? primary : colors.cardAlt,
                        borderColor: isActive ? primary : colors.border,
                      },
                    ]}
                    onPress={() => setFilterCategory(isActive ? null : catDisplay)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, { color: isActive ? colors.onPrimary : colors.text }]}>
                      {cat.emoji} {cat.name}{' · '}{formatAmount(catSpent)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {/* Compteur de résultats + total montant filtré */}
            <Text style={[styles.resultCount, { color: colors.textMuted }]}>
              {isFiltered
                ? t('budget.filter.resultFiltered', {
                    filtered: filteredEntries.length,
                    total: sortedEntries.length,
                  })
                : t('budget.filter.resultAll', {
                    count: sortedEntries.length,
                  })
              }
              {' · '}{formatAmount(filteredTotalAmount)}
            </Text>
          </View>

          <FlatList
            data={filteredEntries}
            keyExtractor={(item, i) => `${item.date}-${item.lineIndex}-${i}`}
            contentContainerStyle={[styles.content, Layout.contentContainer]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
            ListEmptyComponent={
              isFiltered ? (
                <EmptyState
                  emoji="🔍"
                  title={t('budget.filter.emptyTitle')}
                  subtitle={t('budget.filter.emptySubtitle')}
                />
              ) : (
                <EmptyState
                  emoji="💰"
                  title={t('budget.empty.title')}
                  subtitle={t('budget.empty.subtitle')}
                  ctaLabel={t('budget.empty.cta')}
                  onCta={() => setAddModalVisible(true)}
                />
              )
            }
            renderItem={({ item }) => {
              const isSelected = selectedEntries.has(item.lineIndex);
              return (
                <SwipeToDelete
                  onDelete={() => handleDelete(item)}
                  skipConfirm
                  disabled={selectionMode}
                  hintId="budget"
                >
                  <TouchableOpacity
                    style={[
                      styles.entryRow,
                      { backgroundColor: isSelected ? primary + '15' : colors.card },
                      isSelected && { borderColor: primary, borderWidth: 1 },
                    ]}
                    onPress={selectionMode ? () => toggleSelection(item.lineIndex) : undefined}
                    onLongPress={selectionMode ? undefined : () => enterSelectionMode(item.lineIndex)}
                    activeOpacity={0.7}
                  >
                    {selectionMode && (
                      <View style={[
                        styles.checkbox,
                        { borderColor: isSelected ? primary : colors.border },
                        isSelected && { backgroundColor: primary },
                      ]}>
                        {isSelected && <Text style={[styles.checkmark, { color: colors.onPrimary }]}>✓</Text>}
                      </View>
                    )}
                    <View style={styles.entryLeft}>
                      <Text style={[styles.entryCategory, { color: colors.text }]}>{item.category}</Text>
                      <Text style={[styles.entryLabel, { color: colors.textMuted }]}>{item.label}</Text>
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={[styles.entryAmount, { color: colors.text }]}>{formatAmount(item.amount)}</Text>
                      <Text style={[styles.entryDate, { color: colors.textFaint }]}>
                        {formatDateLocalized(item.date)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </SwipeToDelete>
              );
            }}
          />
        </>
      ) : (
        /* ─── Onglet Évolution ──────────────────────────────────────────── */
        <>
          {/* Toggle période */}
          <View style={[styles.evoPeriodRow, { backgroundColor: colors.bg }]}>
            {([6, 12] as const).map((m) => {
              const active = evoMonths === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.evoPeriodBtn,
                    { backgroundColor: active ? primary : colors.card, borderColor: active ? primary : colors.border },
                  ]}
                  onPress={() => setEvoMonths(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.evoPeriodBtnText, { color: active ? colors.onPrimary : colors.text }]}>
                    {m === 6 ? t('budget.evolution.sixMonths') : t('budget.evolution.twelveMonths')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {evoLoading ? (
            <View style={styles.evoLoadingContainer}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={[styles.evoLoadingText, { color: colors.textMuted }]}>
                {t('budget.evolution.loading')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={priceEvolutions}
              keyExtractor={(item, i) => `${item.label}-${i}`}
              contentContainerStyle={[styles.content, Layout.contentContainer]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
              ListEmptyComponent={
                <EmptyState
                  emoji="📊"
                  title={t('budget.evolution.emptyTitle')}
                  subtitle={t('budget.evolution.emptySubtitle')}
                />
              }
              ListHeaderComponent={
                priceEvolutions.length > 0 ? (
                  <Text style={[styles.evoHeaderText, { color: colors.textMuted }]}>
                    {t('budget.evolution.header', { count: priceEvolutions.length })}
                  </Text>
                ) : null
              }
              renderItem={renderEvolutionItem}
            />
          )}
        </>
      )}

      {/* Add expense modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: colors.bg }]}
        >
          {/* Drag handle */}
          <View style={styles.dragHandleBar}>
            <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('budget.addModal.title')}</Text>

            {/* Category picker */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>{t('budget.addModal.category')}</Text>
            <View style={styles.chipRow}>
              {budgetConfig.categories.map((cat) => {
                const selected = selectedCategory?.name === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? primary : colors.cardAlt,
                        borderColor: selected ? primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                    accessibilityLabel={t('budget.addModal.categoryA11y', { name: cat.name })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>
                      {cat.emoji} {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>{t('budget.addModal.amount')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder={t('budget.addModal.amountPlaceholder')}
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              accessibilityLabel={t('budget.addModal.amountA11y')}
            />

            {/* Label */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>{t('budget.addModal.labelField')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder={t('budget.addModal.labelPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={labelText}
              onChangeText={setLabelText}
              accessibilityLabel={t('budget.addModal.labelA11y')}
            />

            {/* Date */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>{t('budget.addModal.date')}</Text>
            <DateInput value={dateText} onChange={setDateText} placeholder={t('budget.addModal.datePlaceholder')} />

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: primary }]}
              onPress={handleAdd}
              activeOpacity={0.7}
              accessibilityLabel={t('budget.addModal.submitA11y')}
              accessibilityRole="button"
            >
              <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>{t('budget.addModal.submit')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setAddModalVisible(false)}
              activeOpacity={0.7}
              accessibilityLabel={t('budget.addModal.cancel')}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>{t('budget.addModal.cancel')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal "Configurer le budget" */}
      <Modal
        visible={configModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: colors.bg }]}
        >
          <View style={styles.dragHandleBar}>
            <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('budget.config.title')}</Text>
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>{t('budget.config.sectionLabel')}</Text>
            {budgetConfig.categories.map((cat) => (
              <View key={cat.name} style={styles.configRow}>
                <Text style={[styles.configCatLabel, { color: colors.text }]}>
                  {cat.emoji} {cat.name}
                </Text>
                <TextInput
                  style={[styles.configInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  keyboardType="decimal-pad"
                  value={configLimits[cat.name] ?? ''}
                  onChangeText={(txt) => setConfigLimits((prev) => ({ ...prev, [cat.name]: txt }))}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel={t('budget.config.limitA11y', { name: cat.name })}
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: primary }]}
              onPress={handleSaveBudgetConfig}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>{t('budget.config.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setConfigModalVisible(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>{t('budget.config.cancel')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal review ticket scanné */}
      <ReceiptReview
        visible={receiptReviewVisible}
        onClose={() => { setReceiptReviewVisible(false); setReceiptData(null); }}
        onSave={handleReceiptSave}
        data={receiptData}
        categories={categoryNames}
      />


      <ScreenGuide
        screenId="budget"
        targets={[
          { ref: budgetHeaderRef, ...HELP_CONTENT.budget[0] },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    lineHeight: 22,
  },
  tabsWrap: { paddingVertical: Spacing.xs },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing['4xl'],
  },
  monthArrow: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.hero,
    paddingHorizontal: Spacing.md,
  },
  monthLabel: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], paddingBottom: 90 },

  // Total card
  totalCard: {
    borderRadius: Radius.xl,
    padding: Spacing['3xl'],
    marginBottom: Spacing['2xl'],
    alignItems: 'center',
    ...Shadows.sm,
  },
  totalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs },
  totalAmount: { fontSize: FontSize.hero, fontWeight: FontWeight.heavy },
  totalBudget: { fontSize: FontSize.sm, marginTop: 2, marginBottom: Spacing.xl },
  totalBar: { width: '100%', height: 8, borderRadius: Spacing.xs, overflow: 'hidden' },
  totalBarFill: { height: '100%', borderRadius: Spacing.xs },
  totalStats: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.md },

  // Category cards
  catCard: {
    borderRadius: Radius['lg+'],
    padding: Radius['lg+'],
    marginBottom: Spacing.lg,
    ...Shadows.xs,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  catName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  catPct: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginHorizontal: Spacing.md },
  catAmount: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  catBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },

  // ─── Filtrage ─────────────────────────────────────────────────
  filterContainer: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  searchIcon: {
    marginRight: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    paddingVertical: Spacing.lg,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  resultCount: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },

  // Entry list
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Radius['lg+'],
    marginBottom: Spacing.md,
    ...Shadows.xs,
  },
  entryLeft: { flex: 1, marginRight: Spacing.xl },
  entryCategory: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  entryLabel: { fontSize: FontSize.label, marginTop: 2 },
  entryRight: { alignItems: 'flex-end' },
  entryAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  entryDate: { fontSize: FontSize.caption, marginTop: 2 },

  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: FontSize.body },

  // Modal
  modalContainer: { flex: 1 },
  dragHandleBar: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  dragHandle: { width: 40, height: 5, borderRadius: 3 },
  modalContent: { padding: Spacing['3xl'] },
  modalTitle: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy, marginBottom: Spacing['3xl'] },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.md, marginTop: Spacing['2xl'] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  chip: {
    paddingHorizontal: Radius['lg+'],
    paddingVertical: Spacing.md,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Radius['lg+'],
    fontSize: FontSize.lg,
  },
  submitBtn: {
    borderRadius: Radius['lg+'],
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginTop: Spacing['4xl'],
  },
  submitBtnText: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  cancelBtn: { alignItems: 'center', paddingVertical: Radius['lg+'] },
  cancelBtnText: { fontSize: FontSize.body },
  bottomPad: { height: 40 },

  // Sélection multiple
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  selectionCancel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  selectionCount: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  selectionDelete: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Spacing.xl,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xl,
  },
  checkmark: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // ─── Modal "Configurer le budget" ─────────────────────────────
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  configCatLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  configInput: {
    width: 110,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    textAlign: 'right',
  },

  // ─── Évolution ────────────────────────────────────────────────
  evoPeriodRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  evoPeriodBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    alignItems: 'center',
  },
  evoPeriodBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  evoLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['6xl'],
  },
  evoLoadingText: {
    fontSize: FontSize.body,
    marginTop: Spacing.xl,
  },
  evoHeaderText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.lg,
  },
  evoCard: {
    borderRadius: Radius['lg+'],
    padding: Spacing['2xl'],
    marginBottom: Spacing.lg,
    ...Shadows.xs,
  },
  evoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  evoLabelRow: {
    flex: 1,
    marginRight: Spacing.xl,
  },
  evoCategory: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xxs,
  },
  evoLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  evoBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  evoBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  evoPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  evoPriceBlock: {
    flex: 1,
  },
  evoPriceLabel: {
    fontSize: FontSize.caption,
    marginBottom: Spacing.xxs,
  },
  evoPrice: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  evoArrow: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    marginHorizontal: Spacing.xl,
  },
  evoMeta: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
});
