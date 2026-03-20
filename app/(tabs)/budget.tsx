/**
 * budget.tsx — Suivi du budget familial
 *
 * Trois vues :
 * 1. Résumé mensuel (barres de progression par catégorie)
 * 2. Liste des dépenses du mois
 * 3. Modal d'ajout rapide
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
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
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
import { formatDateForDisplay } from '../../lib/parser';
import { DateInput } from '../../components/ui/DateInput';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { ReceiptReview } from '../../components/ReceiptReview';
import { StockUpdateReview } from '../../components/StockUpdateReview';
import type { StockUpdateAction } from '../../components/StockUpdateReview';
import { captureAndScanReceipt } from '../../lib/receipt-scanner';
import { matchReceiptToStock } from '../../lib/stock-matcher';
import type { StockMatch } from '../../lib/stock-matcher';
import type { ScanOutcome } from '../../lib/receipt-scanner';
import type { ReceiptScanResult } from '../../lib/ai-service';
import type { BudgetCategory, BudgetEntry } from '../../lib/types';
import { useParentalControls } from '../../contexts/ParentalControlsContext';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { Spacing, Radius } from '../../constants/spacing';
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

type TabId = 'resume' | 'list';

export default function BudgetScreen() {
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const {
    budgetEntries,
    budgetConfig,
    budgetMonth,
    loadBudgetData,
    addExpense,
    deleteExpense,
    activeProfile,
    refresh,
    stock,
    updateStockQuantity,
    addStockItem,
  } = useVault();

  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
  const { isAllowed } = useParentalControls();

  // Guard : les enfants n'ont pas accès au budget (sauf si autorisé)
  if (isChildMode && !isAllowed('budget', activeProfile!.role)) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
        <Text style={{ color: colors.textMuted, fontSize: FontSize.lg }}>Accès réservé aux parents</Text>
      </SafeAreaView>
    );
  }

  const { refreshing, onRefresh } = useRefresh(refresh);

  const [tab, setTab] = useState<TabId>('resume');
  const budgetHeaderRef = useRef<View>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

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

  // Mise à jour stock après ticket
  const [stockMatches, setStockMatches] = useState<StockMatch[]>([]);
  const [stockUpdateVisible, setStockUpdateVisible] = useState(false);

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
    Alert.alert(
      `Supprimer ${count} dépense${count > 1 ? 's' : ''} ?`,
      `${formatAmount([...selectedEntries].reduce((sum, li) => {
        const entry = budgetEntries.find(e => e.lineIndex === li);
        return sum + (entry?.amount ?? 0);
      }, 0))} au total`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            // Supprimer du plus grand lineIndex au plus petit pour éviter le décalage
            const sorted = [...selectedEntries].sort((a, b) => b - a);
            for (const li of sorted) {
              await deleteExpense(li);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast(`${count} dépense${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}`, 'success');
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

  useEffect(() => {
    loadBudgetData();
  }, []);

  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev' ? prevMonth(budgetMonth) : nextMonth(budgetMonth);
    loadBudgetData(newMonth);
  }, [budgetMonth, loadBudgetData]);

  const handleAdd = useCallback(async () => {
    if (!selectedCategory || !amountText.trim() || !labelText.trim()) {
      showToast('Remplis la catégorie, le montant et le libellé', 'error');
      return;
    }
    const amount = parseFloat(amountText.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      showToast('Montant invalide', 'error');
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
      'Supprimer la dépense ?',
      `${entry.label} — ${formatAmount(entry.amount)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
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
      showToast('Configure ta clé API dans les réglages', 'error');
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
      showToast('Erreur lors du scan', 'error');
    } finally {
      setScanning(false);
    }
  }, [aiConfig, categoryNames, showToast]);

  const handleReceiptSave = useCallback(async (items: Array<{ date: string; category: string; amount: number; label: string }>) => {
    for (const item of items) {
      await addExpense(item.date, item.category, item.amount, item.label);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(`${items.length} dépense${items.length > 1 ? 's' : ''} ajoutée${items.length > 1 ? 's' : ''}`, 'success');
    setReceiptReviewVisible(false);

    // Proposer la mise à jour du stock si des produits matchent
    const matches = matchReceiptToStock(items, stock);
    if (matches.length > 0) {
      setStockMatches(matches);
      setStockUpdateVisible(true);
    } else {
      setReceiptData(null);
    }
  }, [addExpense, showToast, stock]);

  const handleStockUpdate = useCallback(async (actions: StockUpdateAction[]) => {
    // Fermer la modal immédiatement pour éviter le freeze UI
    setStockUpdateVisible(false);
    setStockMatches([]);
    setReceiptData(null);

    const count = actions.length;
    showToast(`Mise à jour du stock en cours…`, 'info');

    try {
      // 1. D'abord les incréments (par lineIndex décroissant pour éviter les décalages)
      const increments = actions
        .filter((a): a is Extract<StockUpdateAction, { type: 'increment' }> => a.type === 'increment')
        .sort((a, b) => b.stockItem.lineIndex - a.stockItem.lineIndex);

      for (const action of increments) {
        await updateStockQuantity(action.stockItem.lineIndex, action.stockItem.quantite + action.qtyToAdd);
      }

      // 2. Ensuite les créations
      const creates = actions.filter((a): a is Extract<StockUpdateAction, { type: 'create' }> => a.type === 'create');
      for (const action of creates) {
        await addStockItem({
          produit: action.label,
          quantite: 1,
          seuil: 1,
          qteAchat: 1,
          emplacement: action.emplacement,
          section: action.section,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Stock mis à jour (${count} produit${count > 1 ? 's' : ''})`, 'success');
    } catch (e) {
      showToast('Erreur lors de la mise à jour du stock', 'error');
    }
  }, [updateStockQuantity, addStockItem, showToast]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View ref={budgetHeaderRef} style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>Budget</Text>
        <View style={styles.headerActions}>
          {aiConfigured && (
            <TouchableOpacity
              style={[styles.scanBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
              onPress={handleScanReceipt}
              activeOpacity={0.7}
              disabled={scanning}
              accessibilityLabel={scanning ? 'Scan en cours' : 'Scanner un ticket de caisse'}
              accessibilityRole="button"
              accessibilityState={{ disabled: scanning }}
            >
              {scanning ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <Text style={[styles.scanBtnText, { color: primary }]}>📷 Ticket</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: primary }]}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Ajouter une dépense"
            accessibilityRole="button"
          >
            <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+ Dépense</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Month navigation */}
      <View style={[styles.monthNav, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => handleMonthChange('prev')} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }} accessibilityLabel="Mois précédent" accessibilityRole="button">
          <Text style={[styles.monthArrow, { color: primary }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]} accessibilityLabel={`Mois : ${formatMonthLabel(budgetMonth)}`}>{formatMonthLabel(budgetMonth)}</Text>
        <TouchableOpacity onPress={() => handleMonthChange('next')} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }} accessibilityLabel="Mois suivant" accessibilityRole="button">
          <Text style={[styles.monthArrow, { color: primary }]}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SegmentedControl
          segments={[
            { id: 'resume', label: 'Résumé' },
            { id: 'list', label: 'Dépenses' },
          ]}
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
      </View>

      {tab === 'resume' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {/* Total */}
          <View style={[styles.totalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total dépensé</Text>
            <Text style={[styles.totalAmount, { color: spent > budgetTotal ? colors.error : colors.text }]}>
              {formatAmount(spent)}
            </Text>
            <Text style={[styles.totalBudget, { color: colors.textMuted }]}>
              sur {formatAmount(budgetTotal)}
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
          </View>

          {/* Per category */}
          {budgetConfig.categories.map((cat) => {
            const catSpent = sumByCategory(budgetEntries, categoryDisplay(cat));
            const pct = cat.limit > 0 ? (catSpent / cat.limit) * 100 : 0;
            const overBudget = catSpent > cat.limit;

            return (
              <View key={cat.name} style={[styles.catCard, { backgroundColor: colors.card }]}>
                <View style={styles.catHeader}>
                  <Text style={[styles.catName, { color: colors.text }]}>
                    {cat.emoji} {cat.name}
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
            );
          })}
          <View style={styles.bottomPad} />
        </ScrollView>
      ) : (
        <>
          {/* Barre d'action en mode sélection */}
          {selectionMode && (
            <View style={[styles.selectionBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={cancelSelection} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }} accessibilityLabel="Annuler la sélection" accessibilityRole="button">
                <Text style={[styles.selectionCancel, { color: primary }]}>Annuler</Text>
              </TouchableOpacity>
              <Text style={[styles.selectionCount, { color: colors.text }]} accessibilityLabel={`${selectedEntries.size} dépense${selectedEntries.size > 1 ? 's' : ''} sélectionnée${selectedEntries.size > 1 ? 's' : ''}`}>
                {selectedEntries.size} sélectionnée{selectedEntries.size > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity onPress={handleDeleteSelected} accessibilityLabel={`Supprimer ${selectedEntries.size} dépense${selectedEntries.size > 1 ? 's' : ''}`} accessibilityRole="button">
                <Text style={[styles.selectionDelete, { color: colors.error }]}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={sortedEntries}
            keyExtractor={(item, i) => `${item.date}-${item.lineIndex}-${i}`}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
            ListEmptyComponent={
              <EmptyState
                emoji="💰"
                title="Aucun budget"
                subtitle="Suivez vos dépenses familiales"
                ctaLabel="Ajouter une entrée"
                onCta={() => setAddModalVisible(true)}
              />
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
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    )}
                    <View style={styles.entryLeft}>
                      <Text style={[styles.entryCategory, { color: colors.text }]}>{item.category}</Text>
                      <Text style={[styles.entryLabel, { color: colors.textMuted }]}>{item.label}</Text>
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={[styles.entryAmount, { color: colors.text }]}>{formatAmount(item.amount)}</Text>
                      <Text style={[styles.entryDate, { color: colors.textFaint }]}>
                        {formatDateForDisplay(item.date)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </SwipeToDelete>
              );
            }}
          />
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nouvelle dépense</Text>

            {/* Category picker */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Catégorie</Text>
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
                    accessibilityLabel={`Catégorie ${cat.name}`}
                    accessibilityRole="tab"
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
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Montant</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="0,00"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              accessibilityLabel="Montant de la dépense"
            />

            {/* Label */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Libellé</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Ex: Carrefour, couches..."
              placeholderTextColor={colors.textFaint}
              value={labelText}
              onChangeText={setLabelText}
              accessibilityLabel="Libellé de la dépense"
            />

            {/* Date */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Date</Text>
            <DateInput value={dateText} onChange={setDateText} placeholder="Choisir une date" />

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: primary }]}
              onPress={handleAdd}
              activeOpacity={0.7}
              accessibilityLabel="Ajouter la dépense"
              accessibilityRole="button"
            >
              <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>Ajouter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setAddModalVisible(false)}
              activeOpacity={0.7}
              accessibilityLabel="Annuler"
              accessibilityRole="button"
            >
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Annuler</Text>
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

      {/* Modal mise à jour stock après ticket */}
      <StockUpdateReview
        visible={stockUpdateVisible}
        onClose={() => { setStockUpdateVisible(false); setStockMatches([]); setReceiptData(null); }}
        onConfirm={handleStockUpdate}
        matches={stockMatches}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Radius['lg+'],
  },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scanBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  scanBtnText: { fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  addBtn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius['2xl'],
  },
  addBtnText: { fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing['4xl'],
  },
  monthArrow: { fontSize: FontSize.titleLg, fontWeight: FontWeight.bold },
  monthLabel: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  tabBar: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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
  catAmount: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  catBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },

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
  checkmark: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
