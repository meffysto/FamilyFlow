/**
 * ReceiptReview.tsx — Modal de vérification des articles scannés sur un ticket de caisse
 *
 * Affiche les articles détectés par le scan, permet de modifier label/montant/catégorie,
 * supprimer des lignes, puis valider l'ajout au budget.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { useThemeColors } from '../contexts/ThemeContext';
import { ModalHeader } from './ui/ModalHeader';
import { Button } from './ui/Button';
import { formatAmount } from '../lib/budget';
import { formatDateLocalized } from '../lib/date-locale';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { useTranslation } from 'react-i18next';
import type { ReceiptScanResult } from '../lib/ai-service';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReceiptItem = ReceiptScanResult['items'][number];

interface ReceiptReviewProps {
  visible: boolean;
  onClose: () => void;
  onSave: (items: Array<{ date: string; category: string; amount: number; label: string }>) => void;
  data: ReceiptScanResult | null;
  categories: string[];
}

// ─── Composant interne : ligne article ──────────────────────────────────────

interface ReceiptItemWithId extends ReceiptItem {
  id: number;
}

interface ItemRowProps {
  item: ReceiptItemWithId;
  index: number;
  categories: string[];
  onUpdate: (index: number, field: keyof ReceiptItem, value: string | number) => void;
  onDelete: (index: number) => void;
}

const ItemRow = React.memo(function ItemRow({
  item,
  index,
  categories,
  onUpdate,
  onDelete,
}: ItemRowProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const handleAmountChange = useCallback((text: string) => {
    // Accepter virgule ou point, stocker comme nombre
    const cleaned = text.replace(',', '.');
    const parsed = parseFloat(cleaned);
    onUpdate(index, 'amount', isNaN(parsed) ? 0 : parsed);
  }, [index, onUpdate]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.duration(250)}
      style={[styles.itemRow, { backgroundColor: colors.card }, Shadows.sm]}
    >
      {/* Ligne principale : label + montant */}
      <View style={styles.itemMainRow}>
        <TextInput
          style={[styles.itemLabel, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={item.label}
          onChangeText={(text) => onUpdate(index, 'label', text)}
          placeholder="Libellé"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={`Libellé article ${index + 1}`}
        />
        <TextInput
          style={[styles.itemAmount, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={item.amount === 0 ? '' : item.amount.toString().replace('.', ',')}
          onChangeText={handleAmountChange}
          placeholder="0,00"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          accessibilityLabel={`Montant article ${index + 1}`}
        />
        <TouchableOpacity
          onPress={() => onDelete(index)}
          style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Supprimer article ${item.label}`}
          accessibilityRole="button"
        >
          <Text style={[styles.deleteBtnText, { color: colors.error }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Sélecteur de catégorie */}
      <View style={styles.categoryRow}>
        <TouchableOpacity
          style={[styles.categorySelector, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
          onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          activeOpacity={0.7}
          accessibilityLabel={`Catégorie : ${item.category}`}
          accessibilityRole="button"
          accessibilityHint={t('receiptReview.categoryHint')}
        >
          <Text style={[styles.categorySelectorText, { color: colors.text }]} numberOfLines={1}>
            {item.category}
          </Text>
          <Text style={[styles.categoryChevron, { color: colors.textMuted }]}>
            {showCategoryPicker ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liste des catégories (overlay inline) */}
      {showCategoryPicker && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.categoryPicker, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.md]}
        >
          <ScrollView style={styles.categoryPickerScroll} nestedScrollEnabled>
            {categories.map((cat) => {
              const isSelected = cat === item.category;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    isSelected && { backgroundColor: primary + '18' },
                  ]}
                  onPress={() => {
                    onUpdate(index, 'category', cat);
                    setShowCategoryPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      { color: isSelected ? primary : colors.text },
                      isSelected && { fontWeight: FontWeight.bold },
                    ]}
                  >
                    {cat}
                  </Text>
                  {isSelected && (
                    <Text style={[styles.categoryCheck, { color: primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}
    </Animated.View>
  );
});

// ─── Composant principal ────────────────────────────────────────────────────

export function ReceiptReview({ visible, onClose, onSave, data, categories }: ReceiptReviewProps) {
  const { primary, colors } = useThemeColors();

  // État local des articles (copie modifiable avec IDs stables)
  const [items, setItems] = useState<ReceiptItemWithId[]>([]);
  const [nextId, setNextId] = useState(0);

  // Synchroniser quand les données changent
  useEffect(() => {
    if (data?.items) {
      setItems(data.items.map((item, i) => ({ ...item, id: i })));
      setNextId(data.items.length);
    } else {
      setItems([]);
      setNextId(0);
    }
  }, [data]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleUpdateItem = useCallback((index: number, field: keyof ReceiptItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleDeleteItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    if (!data || items.length === 0) return;
    const payload = items.map((item) => ({
      date: data.date,
      category: item.category,
      amount: item.amount,
      label: item.label,
    }));
    onSave(payload);
  }, [data, items, onSave]);

  // ─── Totaux ────────────────────────────────────────────────────────────────

  const computedTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items],
  );

  const detectedTotal = data?.total ?? 0;
  const totalDiff = Math.abs(computedTotal - detectedTotal);
  const hasDiff = totalDiff > 0.01;

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.bg }]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandleBar}>
          <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
        </View>

        <ModalHeader title="Vérifier le ticket" onClose={onClose} />

        {data ? (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* En-tête magasin + date */}
              <View style={[styles.storeCard, { backgroundColor: colors.card }, Shadows.sm]}>
                <Text style={[styles.storeName, { color: colors.text }]}>{data.store}</Text>
                <Text style={[styles.storeDate, { color: colors.textMuted }]}>
                  {formatDateLocalized(data.date)}
                </Text>
              </View>

              {/* Liste des articles */}
              <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
                {items.length} article{items.length !== 1 ? 's' : ''} détecté{items.length !== 1 ? 's' : ''}
              </Text>

              {items.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyIcon]}>🧾</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Aucun article détecté
                  </Text>
                </View>
              ) : (
                items.map((item, index) => (
                  <ItemRow
                    key={`item-${item.id}`}
                    item={item}
                    index={index}
                    categories={categories}
                    onUpdate={handleUpdateItem}
                    onDelete={handleDeleteItem}
                  />
                ))
              )}

              {/* Total */}
              {items.length > 0 && (
                <View style={[styles.totalCard, { backgroundColor: colors.card }, Shadows.sm]}>
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.textSub }]}>Total calculé</Text>
                    <Text style={[styles.totalAmount, { color: colors.text }]}>
                      {formatAmount(computedTotal)}
                    </Text>
                  </View>
                  {hasDiff && (
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalDetectedLabel, { color: colors.textMuted }]}>
                        Total ticket
                      </Text>
                      <Text style={[styles.totalDetected, { color: colors.textMuted }]}>
                        {formatAmount(detectedTotal)}
                      </Text>
                    </View>
                  )}
                  {hasDiff && (
                    <View style={[styles.diffBadge, { backgroundColor: colors.warningBg }]}>
                      <Text style={[styles.diffText, { color: colors.warningText }]}>
                        Écart de {formatAmount(totalDiff)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Espace pour le bouton fixe */}
              <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Bouton fixe en bas */}
            {items.length > 0 && (
              <View style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
                <Button
                  label="Ajouter tout"
                  onPress={handleSave}
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon="✅"
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyIcon]}>🧾</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Aucun article détecté
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHandleBar: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: Radius.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing['2xl'],
    paddingBottom: Spacing['6xl'],
  },

  // En-tête magasin
  storeCard: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    marginBottom: Spacing['2xl'],
    alignItems: 'center',
  },
  storeName: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
    marginBottom: Spacing.xs,
  },
  storeDate: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // Section titre
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xl,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Ligne article
  itemRow: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  itemMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  itemLabel: {
    flex: 1,
    fontSize: FontSize.body,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  itemAmount: {
    width: 90,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    textAlign: 'right',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Catégorie
  categoryRow: {
    marginTop: Spacing.md,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  categorySelectorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  categoryChevron: {
    fontSize: FontSize.caption,
    marginLeft: Spacing.md,
  },
  categoryPicker: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  categoryPickerScroll: {
    maxHeight: 200,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
  },
  categoryOptionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  categoryCheck: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },

  // Total
  totalCard: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    marginTop: Spacing['2xl'],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  totalLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  totalAmount: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.heavy,
  },
  totalDetectedLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  totalDetected: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  diffBadge: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignSelf: 'flex-start',
  },
  diffText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },

  // État vide
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['6xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing['2xl'],
  },
  emptyText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },

  // Barre du bas
  bottomSpacer: {
    height: 100,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
    borderTopWidth: 1,
  },
});
