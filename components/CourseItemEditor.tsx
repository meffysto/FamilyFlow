/**
 * CourseItemEditor.tsx — Bottom sheet (Modal pageSheet) pour éditer un CourseItem
 *
 * Édite nom + qté + catégorie d'un item de la liste de courses.
 * Pré-remplit via splitCourseText, recompose via joinCourseText.
 * useThemeColors strict — aucune couleur hardcoded.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../contexts/ThemeContext';
import { ModalHeader } from './ui/ModalHeader';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { splitCourseText, joinCourseText } from '../lib/courses-text';
import { COURSES_DEFAULT_SECTION } from '../lib/courses-constants';
import type { CourseItem } from '../lib/types';

interface CourseItemEditorProps {
  visible: boolean;
  item: CourseItem | null;
  sections: string[];
  onClose: () => void;
  onSave: (patch: { text: string; section: string }) => Promise<void>;
}

// Emojis stockés dans le label de section (vault Obsidian) — pas de migration lucide.
// Les sections existantes sont parsées avec préfixe emoji (ex: '🥬 Légumes'),
// remplacer ici casserait la compatibilité bidirectionnelle markdown.
const NEW_CATEGORY_EMOJIS = ['🏷️', '🛒', '🥬', '🍎', '🥩', '🍞', '🥛', '🧊'];

export function CourseItemEditor({ visible, item, sections, onClose, onSave }: CourseItemEditorProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const nameRef = useRef<TextInput>(null);

  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [section, setSection] = useState(COURSES_DEFAULT_SECTION);
  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState(NEW_CATEGORY_EMOJIS[0]);
  const [extraSections, setExtraSections] = useState<string[]>([]);

  // Pré-remplir quand item change
  useEffect(() => {
    if (!item) return;
    const split = splitCourseText(item.text);
    setName(split.name);
    setQty(split.quantity);
    setSection(item.section || COURSES_DEFAULT_SECTION);
    setAddingNewCategory(false);
    setNewCategoryLabel('');
    setNewCategoryEmoji(NEW_CATEGORY_EMOJIS[0]);
    setExtraSections([]);
  }, [item]);

  // Liste de chips dédupliquées
  const chipSections = useMemo(() => {
    const set = new Set<string>();
    set.add(COURSES_DEFAULT_SECTION);
    for (const s of sections) if (s) set.add(s);
    for (const s of extraSections) if (s) set.add(s);
    if (item?.section) set.add(item.section);
    return Array.from(set);
  }, [sections, extraSections, item]);

  const qtyIsNumeric = /^\d+$/.test(qty.trim());

  const handleQtyMinus = () => {
    if (!qtyIsNumeric) return;
    Haptics.selectionAsync();
    const next = Math.max(0, (parseInt(qty, 10) || 0) - 1);
    setQty(next === 0 ? '' : String(next));
  };

  const handleQtyPlus = () => {
    if (!qtyIsNumeric && qty.trim() !== '') return;
    Haptics.selectionAsync();
    const next = (parseInt(qty, 10) || 0) + 1;
    setQty(String(next));
  };

  const handleSelectSection = (s: string) => {
    Haptics.selectionAsync();
    setSection(s);
  };

  const handleAddNewCategoryConfirm = () => {
    const label = newCategoryLabel.trim();
    if (!label) return;
    const newSection = `${newCategoryEmoji} ${label}`;
    setExtraSections((prev) => [...prev, newSection]);
    setSection(newSection);
    setAddingNewCategory(false);
    setNewCategoryLabel('');
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const text = joinCourseText(qty, trimmedName);
    await onSave({ text, section });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ModalHeader
          title={t('meals.shopping.editTitle')}
          onClose={onClose}
          rightLabel={t('meals.shopping.editSave')}
          onRight={handleSave}
          rightDisabled={!name.trim()}
          closeLeft
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nom */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('meals.shopping.editName')}
          </Text>
          <TextInput
            ref={nameRef}
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder={t('meals.shopping.editName')}
            placeholderTextColor={colors.textFaint}
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
          />

          {/* Quantité */}
          <Text style={[styles.label, { color: colors.textMuted, marginTop: Spacing['3xl'] }]}>
            {t('meals.shopping.editQty')}
          </Text>
          <View style={styles.qtyRow}>
            <TextInput
              value={qty}
              onChangeText={setQty}
              keyboardType="default"
              placeholder="3 / 120g"
              placeholderTextColor={colors.textFaint}
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
            />
            <TouchableOpacity
              onPress={handleQtyMinus}
              disabled={!qtyIsNumeric}
              style={[
                styles.qtyButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: qtyIsNumeric ? 1 : 0.4,
                },
              ]}
              accessibilityLabel="−"
            >
              <Text style={[styles.qtyButtonLabel, { color: colors.text }]}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleQtyPlus}
              disabled={!qtyIsNumeric && qty.trim() !== ''}
              style={[
                styles.qtyButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: qtyIsNumeric || qty.trim() === '' ? 1 : 0.4,
                },
              ]}
              accessibilityLabel="+"
            >
              <Text style={[styles.qtyButtonLabel, { color: colors.text }]}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Catégorie */}
          <Text style={[styles.label, { color: colors.textMuted, marginTop: Spacing['3xl'] }]}>
            {t('meals.shopping.editSection')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {chipSections.map((s) => {
              const selected = s === section;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => handleSelectSection(s)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? primary : colors.card,
                      borderColor: selected ? primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: selected ? colors.card : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setAddingNewCategory(true);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderStyle: 'dashed',
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: colors.textMuted }]}>
                {t('meals.shopping.editNewCategory')}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Sous-bloc nouvelle catégorie */}
          {addingNewCategory && (
            <View
              style={[
                styles.newCategoryBlock,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('meals.shopping.editNewCategoryLabel')}
              </Text>
              <TextInput
                value={newCategoryLabel}
                onChangeText={setNewCategoryLabel}
                placeholder={t('meals.shopping.editNewCategoryLabel')}
                placeholderTextColor={colors.textFaint}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.emojiRow}
              >
                {NEW_CATEGORY_EMOJIS.map((emoji) => {
                  const selected = emoji === newCategoryEmoji;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setNewCategoryEmoji(emoji);
                      }}
                      style={[
                        styles.emojiButton,
                        {
                          backgroundColor: selected ? primary : colors.inputBg,
                          borderColor: selected ? primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={styles.emojiLabel}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                onPress={handleAddNewCategoryConfirm}
                disabled={!newCategoryLabel.trim()}
                style={[
                  styles.addCategoryButton,
                  {
                    backgroundColor: primary,
                    opacity: newCategoryLabel.trim() ? 1 : 0.4,
                  },
                ]}
              >
                <Text style={[styles.addCategoryLabel, { color: colors.card }]}>
                  {t('meals.shopping.editNewCategoryAdd')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing['3xl'],
    paddingBottom: Spacing['6xl'],
  },
  label: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    fontSize: FontSize.body,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.base,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonLabel: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    maxWidth: 220,
  },
  chipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  newCategoryBlock: {
    marginTop: Spacing['2xl'],
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.base,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiLabel: {
    fontSize: FontSize.title,
  },
  addCategoryButton: {
    paddingVertical: Spacing.xl,
    borderRadius: Radius.base,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  addCategoryLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
