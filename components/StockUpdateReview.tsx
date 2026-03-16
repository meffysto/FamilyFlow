/**
 * StockUpdateReview.tsx — Modal de vérification et confirmation des mises à jour stock
 * depuis un ticket de caisse scanné.
 *
 * Affiche les produits reconnus (pré-sélectionnés) et les nouveaux produits (opt-in),
 * avec choix d'emplacement pour les nouveaux.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '../contexts/ThemeContext';
import { ModalHeader } from './ui/ModalHeader';
import { Button } from './ui/Button';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { EMPLACEMENTS } from '../constants/stock';
import type { StockMatch } from '../lib/stock-matcher';
import type { StockItem } from '../lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StockUpdateAction =
  | {
      type: 'increment';
      stockItem: StockItem;
      qtyToAdd: number;
    }
  | {
      type: 'create';
      label: string;
      emplacement: string;
      section?: string;
    };

interface StockUpdateReviewProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (updates: StockUpdateAction[]) => void;
  matches: StockMatch[];
}

// État local mutable par article
interface LocalMatch {
  receiptLabel: string;
  receiptAmount: number;
  stockItem: StockItem | null;
  qtyToAdd: number;
  selected: boolean;
  emplacement: string;
  section?: string;
}

// ─── Composant ligne produit reconnu ─────────────────────────────────────────

interface MatchedRowProps {
  item: LocalMatch;
  index: number;
  onToggle: (index: number) => void;
}

const MatchedRow = React.memo(function MatchedRow({
  item,
  index,
  onToggle,
}: MatchedRowProps) {
  const { primary, colors } = useThemeColors();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(250)}
    >
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.card }, Shadows.sm]}
        onPress={() => onToggle(index)}
        activeOpacity={0.7}
        accessibilityLabel={`${item.selected ? 'Désélectionner' : 'Sélectionner'} ${item.receiptLabel}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.selected }}
      >
        {/* Checkbox */}
        <View
          style={[
            styles.checkbox,
            {
              borderColor: item.selected ? primary : colors.border,
              backgroundColor: item.selected ? primary : 'transparent',
            },
          ]}
        >
          {item.selected && (
            <Text style={[styles.checkmark, { color: colors.onPrimary }]}>
              ✓
            </Text>
          )}
        </View>

        {/* Infos produit */}
        <View style={styles.rowContent}>
          <Text
            style={[styles.receiptLabel, { color: colors.textSub }]}
            numberOfLines={1}
          >
            {item.receiptLabel}
          </Text>
          <Text style={[styles.arrowText, { color: colors.textMuted }]}>
            →
          </Text>
          <Text
            style={[styles.stockLabel, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.stockItem?.produit}
          </Text>
        </View>

        {/* Quantité à ajouter */}
        <View style={[styles.qtyBadge, { backgroundColor: primary + '18' }]}>
          <Text style={[styles.qtyText, { color: primary }]}>
            +{item.qtyToAdd}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Composant ligne nouveau produit ─────────────────────────────────────────

interface NewProductRowProps {
  item: LocalMatch;
  index: number;
  onToggle: (index: number) => void;
  onEmplacementChange: (index: number, emplacement: string) => void;
}

const NewProductRow = React.memo(function NewProductRow({
  item,
  index,
  onToggle,
  onEmplacementChange,
}: NewProductRowProps) {
  const { primary, colors } = useThemeColors();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(250)}
    >
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.card }, Shadows.sm]}
        onPress={() => onToggle(index)}
        activeOpacity={0.7}
        accessibilityLabel={`${item.selected ? 'Désélectionner' : 'Sélectionner'} ${item.receiptLabel}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.selected }}
      >
        {/* Checkbox */}
        <View
          style={[
            styles.checkbox,
            {
              borderColor: item.selected ? primary : colors.border,
              backgroundColor: item.selected ? primary : 'transparent',
            },
          ]}
        >
          {item.selected && (
            <Text style={[styles.checkmark, { color: colors.onPrimary }]}>
              ✓
            </Text>
          )}
        </View>

        {/* Label du ticket */}
        <View style={styles.newRowContent}>
          <Text
            style={[styles.newProductLabel, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.receiptLabel}
          </Text>

          {/* Chips d'emplacement (affichés uniquement si sélectionné) */}
          {item.selected && (
            <View style={styles.emplacementChips}>
              {EMPLACEMENTS.map((emp) => {
                const isActive = item.emplacement === emp.id;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[
                      styles.emplacementChip,
                      {
                        backgroundColor: isActive ? primary + '18' : colors.cardAlt,
                        borderColor: isActive ? primary : colors.borderLight,
                      },
                    ]}
                    onPress={() => onEmplacementChange(index, emp.id)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Emplacement ${emp.label}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={styles.emplacementEmoji}>{emp.emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Composant principal ─────────────────────────────────────────────────────

export function StockUpdateReview({
  visible,
  onClose,
  onConfirm,
  matches,
}: StockUpdateReviewProps) {
  const { colors } = useThemeColors();

  // État local : copie mutable des matches
  const [localItems, setLocalItems] = useState<LocalMatch[]>([]);

  // Synchroniser quand les matches changent
  useEffect(() => {
    setLocalItems(
      matches.map((m) => ({
        receiptLabel: m.receiptLabel,
        receiptAmount: m.receiptAmount,
        stockItem: m.stockItem,
        qtyToAdd: m.qtyToAdd,
        selected: m.selected,
        emplacement: m.suggestedEmplacement ?? 'placards',
        section: undefined,
      })),
    );
  }, [matches]);

  // ─── Listes filtrées ───────────────────────────────────────────────────────

  // Index globaux des produits reconnus et nouveaux
  const matchedIndices = useMemo(
    () => localItems.reduce<number[]>((acc, item, i) => {
      if (item.stockItem) acc.push(i);
      return acc;
    }, []),
    [localItems],
  );

  const newIndices = useMemo(
    () => localItems.reduce<number[]>((acc, item, i) => {
      if (!item.stockItem) acc.push(i);
      return acc;
    }, []),
    [localItems],
  );

  const selectedCount = useMemo(
    () => localItems.filter((it) => it.selected).length,
    [localItems],
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleToggle = useCallback((globalIndex: number) => {
    setLocalItems((prev) => {
      const next = [...prev];
      next[globalIndex] = { ...next[globalIndex], selected: !next[globalIndex].selected };
      return next;
    });
  }, []);

  const handleEmplacementChange = useCallback((globalIndex: number, emplacement: string) => {
    setLocalItems((prev) => {
      const next = [...prev];
      next[globalIndex] = { ...next[globalIndex], emplacement };
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const actions: StockUpdateAction[] = localItems
      .filter((it) => it.selected)
      .map((it) => {
        if (it.stockItem) {
          return {
            type: 'increment' as const,
            stockItem: it.stockItem,
            qtyToAdd: it.qtyToAdd,
          };
        }
        return {
          type: 'create' as const,
          label: it.receiptLabel,
          emplacement: it.emplacement,
          section: it.section,
        };
      });
    onConfirm(actions);
  }, [localItems, onConfirm]);

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  // État vide
  if (matches.length === 0 && visible) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <View style={styles.dragHandleBar}>
            <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
          </View>
          <ModalHeader title="Mettre à jour le stock ?" onClose={onClose} />
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Aucun produit à mettre à jour
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Drag handle */}
        <View style={styles.dragHandleBar}>
          <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
        </View>

        <ModalHeader title="Mettre à jour le stock ?" onClose={onClose} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section produits reconnus */}
          {matchedIndices.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
                Produits reconnus
              </Text>
              {matchedIndices.map((globalIdx, listIdx) => (
                <MatchedRow
                  key={`matched-${globalIdx}`}
                  item={localItems[globalIdx]}
                  index={listIdx}
                  onToggle={() => handleToggle(globalIdx)}
                />
              ))}
            </View>
          )}

          {/* Section nouveaux produits */}
          {newIndices.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
                Nouveaux produits
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Ajouter au suivi du stock ?
              </Text>
              {newIndices.map((globalIdx, listIdx) => (
                <NewProductRow
                  key={`new-${globalIdx}`}
                  item={localItems[globalIdx]}
                  index={listIdx}
                  onToggle={() => handleToggle(globalIdx)}
                  onEmplacementChange={(_, emp) =>
                    handleEmplacementChange(globalIdx, emp)
                  }
                />
              ))}
            </View>
          )}

          {/* Espace pour le bouton fixe */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Barre du bas */}
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.bg, borderTopColor: colors.border },
          ]}
        >
          {selectedCount > 0 ? (
            <Button
              label={`Mettre à jour (${selectedCount} produit${selectedCount > 1 ? 's' : ''})`}
              onPress={handleConfirm}
              variant="primary"
              size="lg"
              fullWidth
            />
          ) : (
            <Button
              label="Ignorer"
              onPress={onClose}
              variant="secondary"
              size="lg"
              fullWidth
            />
          )}
        </View>
      </View>
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

  // Sections
  section: {
    marginBottom: Spacing['3xl'],
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xl,
  },
  sectionSubtitle: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.normal,
    marginBottom: Spacing.xl,
    marginTop: -Spacing.md,
  },

  // Lignes
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    gap: Spacing.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Ligne produit reconnu
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  receiptLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.normal,
    flexShrink: 1,
  },
  arrowText: {
    fontSize: FontSize.label,
  },
  stockLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  qtyBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  qtyText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Ligne nouveau produit
  newRowContent: {
    flex: 1,
    gap: Spacing.md,
  },
  newProductLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  emplacementChips: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  emplacementChip: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emplacementEmoji: {
    fontSize: FontSize.lg,
  },

  // État vide
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
