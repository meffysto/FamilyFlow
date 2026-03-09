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

import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useVault } from '../../hooks/useVault';
import { useThemeColors } from '../../contexts/ThemeContext';
import {
  formatAmount,
  categoryDisplay,
  sumByCategory,
  totalSpent,
  totalBudget,
  formatMonthLabel,
} from '../../lib/budget';
import { formatDateForDisplay } from '../../lib/parser';
import type { BudgetCategory, BudgetEntry } from '../../lib/types';

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
  const {
    budgetEntries,
    budgetConfig,
    budgetMonth,
    loadBudgetData,
    addExpense,
    deleteExpense,
  } = useVault();

  const [tab, setTab] = useState<TabId>('resume');
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Add form state
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [amountText, setAmountText] = useState('');
  const [labelText, setLabelText] = useState('');
  const [dateText, setDateText] = useState(todayISO());

  useEffect(() => {
    loadBudgetData();
  }, []);

  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev' ? prevMonth(budgetMonth) : nextMonth(budgetMonth);
    loadBudgetData(newMonth);
  }, [budgetMonth, loadBudgetData]);

  const handleAdd = useCallback(async () => {
    if (!selectedCategory || !amountText.trim() || !labelText.trim()) {
      Alert.alert('Champs requis', 'Remplis la catégorie, le montant et le libellé.');
      return;
    }
    const amount = parseFloat(amountText.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Montant invalide', 'Entre un montant valide.');
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

  const spent = totalSpent(budgetEntries);
  const budget = totalBudget(budgetConfig);
  const sortedEntries = useMemo(
    () => [...budgetEntries].sort((a, b) => b.date.localeCompare(a.date)),
    [budgetEntries]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Budget</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: primary }]}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+ Dépense</Text>
        </TouchableOpacity>
      </View>

      {/* Month navigation */}
      <View style={[styles.monthNav, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => handleMonthChange('prev')} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
          <Text style={[styles.monthArrow, { color: primary }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{formatMonthLabel(budgetMonth)}</Text>
        <TouchableOpacity onPress={() => handleMonthChange('next')} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
          <Text style={[styles.monthArrow, { color: primary }]}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([['resume', 'Résumé'], ['list', 'Dépenses']] as const).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tabItem, tab === id && { borderBottomColor: primary }]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, { color: tab === id ? primary : colors.textMuted }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'resume' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Total */}
          <View style={[styles.totalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total dépensé</Text>
            <Text style={[styles.totalAmount, { color: spent > budget ? colors.error : colors.text }]}>
              {formatAmount(spent)}
            </Text>
            <Text style={[styles.totalBudget, { color: colors.textMuted }]}>
              sur {formatAmount(budget)}
            </Text>
            <View style={[styles.totalBar, { backgroundColor: colors.borderLight }]}>
              <View
                style={[
                  styles.totalBarFill,
                  {
                    width: `${Math.min((spent / budget) * 100, 100)}%`,
                    backgroundColor: spent > budget ? colors.error : primary,
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
        <FlatList
          data={sortedEntries}
          keyExtractor={(item, i) => `${item.date}-${item.lineIndex}-${i}`}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aucune dépense ce mois</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.entryRow, { backgroundColor: colors.card }]}
              onLongPress={() => handleDelete(item)}
              activeOpacity={0.7}
            >
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
          )}
        />
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
            />

            {/* Label */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Libellé</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Ex: Carrefour, couches..."
              placeholderTextColor={colors.textFaint}
              value={labelText}
              onChangeText={setLabelText}
            />

            {/* Date */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor={colors.textFaint}
              value={dateText}
              onChangeText={setDateText}
            />

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: primary }]}
              onPress={handleAdd}
              activeOpacity={0.7}
            >
              <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>Ajouter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setAddModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: '800' },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { fontWeight: '700', fontSize: 14 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 24,
  },
  monthArrow: { fontSize: 22, fontWeight: '700' },
  monthLabel: { fontSize: 17, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // Total card
  totalCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  totalAmount: { fontSize: 32, fontWeight: '800' },
  totalBudget: { fontSize: 14, marginTop: 2, marginBottom: 12 },
  totalBar: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden' },
  totalBarFill: { height: '100%', borderRadius: 4 },

  // Category cards
  catCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catName: { fontSize: 15, fontWeight: '600' },
  catAmount: { fontSize: 13, fontWeight: '600' },
  catBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },

  // Entry list
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  entryLeft: { flex: 1, marginRight: 12 },
  entryCategory: { fontSize: 15, fontWeight: '600' },
  entryLabel: { fontSize: 13, marginTop: 2 },
  entryRight: { alignItems: 'flex-end' },
  entryAmount: { fontSize: 16, fontWeight: '700' },
  entryDate: { fontSize: 12, marginTop: 2 },

  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15 },

  // Modal
  modalContainer: { flex: 1 },
  dragHandleBar: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  dragHandle: { width: 40, height: 5, borderRadius: 3 },
  modalContent: { padding: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  submitBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: { fontSize: 17, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText: { fontSize: 15 },
  bottomPad: { height: 40 },
});
