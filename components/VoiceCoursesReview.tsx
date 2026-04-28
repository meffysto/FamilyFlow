/**
 * VoiceCoursesReview.tsx — Modal de prévisualisation/correction des articles dictés
 *
 * Intercale une étape de révision entre la transcription vocale et l'ajout effectif
 * aux courses. Permet de corriger le nom, la quantité et le rayon de chaque article
 * avant validation. Pattern copié-adapté depuis ReceiptReview (budget) — pas extrait
 * pour préserver l'isolation des domaines (décision D-01).
 */

import React, { useCallback, useEffect, useState } from 'react';
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
import { X, Check, Plus, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import { ModalHeader } from './ui/ModalHeader';
import { Button } from './ui/Button';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import { useTranslation } from 'react-i18next';
import type { VoiceCourseItem } from '../lib/parse-voice-courses';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Item enrichi d'un ID stable pour les animations de liste */
type ItemWithId = VoiceCourseItem & {
  id: number;
  /** Texte affiché de la quantité (ex : "3" ou "120g") — string locale pour l'édition */
  qtyDisplay: string;
};

export interface VoiceCoursesReviewProps {
  visible: boolean;
  items: VoiceCourseItem[];
  sections: string[];
  onClose: () => void;
  onSave: (items: VoiceCourseItem[]) => void;
}

// ─── Composant interne : ligne article ──────────────────────────────────────

interface ItemRowProps {
  item: ItemWithId;
  index: number;
  sections: string[];
  onUpdate: (index: number, field: 'name' | 'qty' | 'section', value: string) => void;
  onDelete: (index: number) => void;
}

const ItemRow = React.memo(function ItemRow({
  item,
  index,
  sections,
  onUpdate,
  onDelete,
}: ItemRowProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.duration(250)}
      style={[styles.itemRow, { backgroundColor: colors.card }, Shadows.sm]}
    >
      {/* Ligne principale : nom + quantité + bouton supprimer */}
      <View style={styles.itemMainRow}>
        <TextInput
          style={[styles.itemName, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={item.name}
          onChangeText={(text) => onUpdate(index, 'name', text)}
          placeholder={t('meals.shopping.voiceReview.nameLabel')}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={t('meals.shopping.voiceReview.nameLabel')}
        />
        <TextInput
          style={[styles.itemQty, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={item.qtyDisplay}
          onChangeText={(text) => onUpdate(index, 'qty', text)}
          placeholder={t('meals.shopping.voiceReview.qtyPlaceholder')}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={t('meals.shopping.voiceReview.qtyLabel')}
        />
        <TouchableOpacity
          onPress={() => onDelete(index)}
          style={[styles.deleteBtn, { backgroundColor: colors.errorBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={t('meals.shopping.voiceReview.delete')}
          accessibilityRole="button"
        >
          <X size={16} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Sélecteur de rayon */}
      <View style={styles.sectionRow}>
        <TouchableOpacity
          style={[styles.sectionSelector, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
          onPress={() => setShowSectionPicker(!showSectionPicker)}
          activeOpacity={0.7}
          accessibilityLabel={t('meals.shopping.voiceReview.sectionLabel')}
          accessibilityRole="button"
        >
          <Text style={[styles.sectionSelectorText, { color: colors.text }]} numberOfLines={1}>
            {item.section}
          </Text>
          {showSectionPicker
            ? <ChevronUp size={16} color={colors.textMuted} />
            : <ChevronDown size={16} color={colors.textMuted} />
          }
        </TouchableOpacity>
      </View>

      {/* Liste des rayons (overlay inline) */}
      {showSectionPicker && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.sectionPicker, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.md]}
        >
          <ScrollView style={styles.sectionPickerScroll} nestedScrollEnabled>
            {sections.map((sec) => {
              const isSelected = sec === item.section;
              return (
                <TouchableOpacity
                  key={sec}
                  style={[
                    styles.sectionOption,
                    isSelected && { backgroundColor: primary + '18' },
                  ]}
                  onPress={() => {
                    onUpdate(index, 'section', sec);
                    setShowSectionPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sectionOptionText,
                      { color: isSelected ? primary : colors.text },
                      isSelected && { fontWeight: FontWeight.bold },
                    ]}
                  >
                    {sec}
                  </Text>
                  {isSelected && (
                    <Check size={16} color={primary} />
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

export function VoiceCoursesReview({ visible, items, sections, onClose, onSave }: VoiceCoursesReviewProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();

  // État local des articles (copie modifiable avec IDs stables)
  const [localItems, setLocalItems] = useState<ItemWithId[]>([]);
  const [nextId, setNextId] = useState(0);

  // Synchroniser quand les items entrants changent (nouvelle dictée)
  useEffect(() => {
    setLocalItems(items.map((it, i) => ({
      ...it,
      id: i,
      qtyDisplay: it.quantity !== null ? String(it.quantity) : '',
    })));
    setNextId(items.length);
  }, [items]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleUpdateItem = useCallback((index: number, field: 'name' | 'qty' | 'section', value: string) => {
    setLocalItems((prev) => {
      const next = [...prev];
      if (field === 'qty') {
        // Stocker la string brute pour l'affichage, parser en number|null pour quantity
        const parsed = parseFloat(value.replace(',', '.'));
        next[index] = { ...next[index], qtyDisplay: value, quantity: isNaN(parsed) ? null : parsed };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  }, []);

  const handleDeleteItem = useCallback((index: number) => {
    setLocalItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddRow = useCallback(() => {
    const defaultSection = sections[0] ?? '🛒 Courses';
    setLocalItems((prev) => [
      ...prev,
      {
        id: nextId,
        text: '',
        name: '',
        quantity: null,
        section: defaultSection,
        qtyDisplay: '',
      },
    ]);
    setNextId((n) => n + 1);
  }, [nextId, sections]);

  const handleSave = useCallback(() => {
    // Construire le payload final — filtrer les lignes sans nom, recomposer text
    const payload: VoiceCourseItem[] = localItems
      .filter((it) => it.name.trim().length > 0)
      .map((it) => {
        const name = it.name.trim();
        const quantity = it.quantity;
        const qtyDisplay = it.qtyDisplay.trim();
        // Reconstruction du champ text lisible
        let text: string;
        if (qtyDisplay) {
          text = `${qtyDisplay} ${name}`.trim();
        } else {
          text = name.charAt(0).toUpperCase() + name.slice(1);
        }
        return { text, name, quantity, section: it.section };
      });
    onSave(payload);
  }, [localItems, onSave]);

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
        {/* Drag handle — swipe-to-dismiss iOS natif */}
        <View style={styles.dragHandleBar}>
          <View style={[styles.dragHandle, { backgroundColor: colors.separator }]} />
        </View>

        <ModalHeader
          title={t('meals.shopping.voiceReview.title', { count: localItems.length })}
          onClose={onClose}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Titre de section */}
          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
            {t('meals.shopping.voiceReview.title', { count: localItems.length })}
          </Text>

          {/* Liste ou état vide */}
          {localItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ShoppingCart size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('meals.shopping.voiceReview.empty')}
              </Text>
            </View>
          ) : (
            localItems.map((it, idx) => (
              <ItemRow
                key={`voice-item-${it.id}`}
                item={it}
                index={idx}
                sections={sections}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            ))
          )}

          {/* Bouton « Ajouter une ligne » */}
          <TouchableOpacity
            onPress={handleAddRow}
            style={[styles.addRowBtn, { borderColor: primary + '60' }]}
            activeOpacity={0.7}
          >
            <Plus size={18} color={primary} />
            <Text style={[styles.addRowText, { color: primary }]}>
              {t('meals.shopping.voiceReview.addRow')}
            </Text>
          </TouchableOpacity>

          {/* Espace pour le bouton fixe en bas */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Bouton fixe en bas — masqué si aucun item */}
        {localItems.length > 0 && (
          <View style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
            <Button
              label={t('meals.shopping.voiceReview.save')}
              onPress={handleSave}
              variant="primary"
              size="lg"
              fullWidth
            />
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

  // Titre de section
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
  itemName: {
    flex: 1,
    fontSize: FontSize.body,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  itemQty: {
    width: 80,
    fontSize: FontSize.body,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rayon (section)
  sectionRow: {
    marginTop: Spacing.md,
  },
  sectionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  sectionSelectorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  sectionPicker: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  sectionPickerScroll: {
    maxHeight: 200,
  },
  sectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
  },
  sectionOptionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // Bouton « Ajouter une ligne »
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addRowText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },

  // État vide
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['6xl'],
    gap: Spacing['2xl'],
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
