/**
 * AnniversaryEditor.tsx — Modal ajout/édition d'anniversaire
 *
 * Présentation pageSheet + drag-to-dismiss.
 * Utilise DateInput pour la date (jour+mois), TextInput pour nom/année/notes.
 * Chips pour la catégorie.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { ModalHeader } from './ui/ModalHeader';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { useTranslation } from 'react-i18next';
import type { Anniversary } from '../lib/types';

interface AnniversaryEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Anniversary, 'sourceFile'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Anniversaire existant (mode édition) */
  existing?: Anniversary;
}

export function AnniversaryEditor({
  visible,
  onClose,
  onSave,
  onDelete,
  existing,
}: AnniversaryEditorProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();

  const CATEGORIES = [
    { label: t('anniversaryEditor.categories.family'), emoji: '👨‍👩‍👧‍👦' },
    { label: t('anniversaryEditor.categories.friend'), emoji: '🤝' },
    { label: t('anniversaryEditor.categories.colleague'), emoji: '💼' },
    { label: t('anniversaryEditor.categories.other'), emoji: '🌟' },
  ];

  const MONTHS: string[] = t('anniversaryEditor.months', { returnObjects: true }) as string[];

  const [name, setName] = useState('');
  const [month, setMonth] = useState(1); // 1-indexed
  const [day, setDay] = useState(1);
  const [birthYear, setBirthYear] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Pré-remplir en mode édition
  useEffect(() => {
    if (visible && existing) {
      setName(existing.name);
      const [mm, dd] = existing.date.split('-').map(Number);
      setMonth(mm);
      setDay(dd);
      setBirthYear(existing.birthYear?.toString() ?? '');
      setCategory(existing.category ?? '');
      setNotes(existing.notes ?? '');
    } else if (visible) {
      setName('');
      setMonth(new Date().getMonth() + 1);
      setDay(new Date().getDate());
      setBirthYear('');
      setCategory('');
      setNotes('');
    }
  }, [visible, existing]);

  const daysInMonth = new Date(2024, month, 0).getDate(); // 2024 = année bissextile pour couvrir le 29 fév

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      showToast(t('anniversaryEditor.toast.nameRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      const dateStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const yearNum = birthYear.trim() ? parseInt(birthYear.trim(), 10) : undefined;
      await onSave({
        name: name.trim(),
        date: dateStr,
        birthYear: yearNum && !isNaN(yearNum) ? yearNum : undefined,
        contactId: existing?.contactId,
        category: category || undefined,
        notes: notes.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(existing ? t('anniversaryEditor.toast.updated') : t('anniversaryEditor.toast.added'));
      onClose();
    } catch {
      showToast(t('anniversaryEditor.toast.saveError'), 'error');
    } finally {
      setSaving(false);
    }
  }, [name, month, day, birthYear, category, notes, existing, onSave, onClose, showToast]);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    Alert.alert(
      t('anniversaryEditor.alert.deleteTitle'),
      t('anniversaryEditor.alert.deleteMsg', { name: existing?.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await onDelete();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showToast(t('anniversaryEditor.toast.deleted'));
            onClose();
          },
        },
      ],
    );
  }, [onDelete, existing, onClose, showToast]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <ModalHeader
          title={existing ? t('anniversaryEditor.titleEdit') : t('anniversaryEditor.titleNew')}
          onClose={onClose}
          rightLabel={t('anniversaryEditor.save')}
          onRight={handleSave}
          rightDisabled={saving || !name.trim()}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Nom */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('anniversaryEditor.nameLabel')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={name}
                onChangeText={setName}
                placeholder={t('anniversaryEditor.namePlaceholder')}
                placeholderTextColor={colors.textFaint}
                autoFocus={!existing}
              />
            </View>

            {/* Date : Mois + Jour */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('anniversaryEditor.dateLabel')}</Text>
              <View style={styles.dateRow}>
                {/* Jour */}
                <View style={styles.dayPicker}>
                  <Text style={[styles.dateSubLabel, { color: colors.textFaint }]}>{t('anniversaryEditor.dayLabel')}</Text>
                  <View style={[styles.pickerContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <TextInput
                      style={[styles.dateInput, { color: colors.text }]}
                      value={String(day)}
                      onChangeText={(t) => {
                        const n = parseInt(t, 10);
                        if (!isNaN(n) && n >= 1 && n <= daysInMonth) setDay(n);
                        else if (t === '') setDay(1);
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      textAlign="center"
                    />
                  </View>
                </View>
                {/* Mois */}
                <View style={styles.monthPicker}>
                  <Text style={[styles.dateSubLabel, { color: colors.textFaint }]}>{t('anniversaryEditor.monthLabel')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.monthChips}
                  >
                    {MONTHS.map((m, i) => (
                      <Chip
                        key={m}
                        label={m.slice(0, 3)}
                        selected={month === i + 1}
                        onPress={() => {
                          setMonth(i + 1);
                          // Ajuster le jour si nécessaire
                          const maxD = new Date(2024, i + 1, 0).getDate();
                          if (day > maxD) setDay(maxD);
                        }}
                        size="sm"
                      />
                    ))}
                  </ScrollView>
                </View>
              </View>
              <Text style={[styles.datePreview, { color: primary }]}>
                {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')}
              </Text>
            </View>

            {/* Année de naissance */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('anniversaryEditor.birthYearLabel')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={birthYear}
                onChangeText={setBirthYear}
                placeholder={t('anniversaryEditor.birthYearPlaceholder')}
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>

            {/* Catégorie */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('anniversaryEditor.categoryLabel')}</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.label}
                    label={cat.label}
                    emoji={cat.emoji}
                    selected={category.toLowerCase() === cat.label.toLowerCase()}
                    onPress={() =>
                      setCategory(
                        category.toLowerCase() === cat.label.toLowerCase() ? '' : cat.label.toLowerCase(),
                      )
                    }
                  />
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('anniversaryEditor.notesLabel')}</Text>
              <TextInput
                style={[styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('anniversaryEditor.notesPlaceholder')}
                placeholderTextColor={colors.textFaint}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Bouton Supprimer (mode édition) */}
            {existing && onDelete && (
              <View style={styles.deleteSection}>
                <Button
                  label={t('anniversaryEditor.deleteBtn')}
                  onPress={handleDelete}
                  variant="danger"
                  icon="🗑"
                  fullWidth
                />
              </View>
            )}

            <View style={styles.bottomPad} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: Spacing['2xl'],
    gap: Spacing['2xl'],
  },
  field: {
    gap: Spacing.md,
  },
  label: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    fontSize: FontSize.body,
    minHeight: 44,
  },
  inputMulti: {
    borderWidth: 1,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    fontSize: FontSize.body,
    minHeight: 88,
  },
  dateRow: {
    gap: Spacing.lg,
  },
  dayPicker: {
    gap: Spacing.xs,
  },
  monthPicker: {
    gap: Spacing.xs,
  },
  dateSubLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: Radius.base,
    width: 60,
    height: 44,
    justifyContent: 'center',
  },
  dateInput: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  datePreview: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  monthChips: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  deleteSection: {
    marginTop: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
    borderTopWidth: 1,
    borderTopColor: 'transparent', // overridden inline
  },
  bottomPad: { height: 40 },
});
