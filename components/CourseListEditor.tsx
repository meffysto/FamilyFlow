/**
 * CourseListEditor.tsx — Modal pageSheet pour créer/renommer une liste de courses (Phase D)
 *
 * Mode 'create' : nom + emoji → onSave(nom, emoji)
 * Mode 'edit'   : nom modifiable, emoji affiché en lecture (rename ne change que le nom — voir Plan 260428-huh task 4 décision)
 *
 * useThemeColors strict — aucune couleur hardcoded. Drag-to-dismiss natif iOS via pageSheet.
 */

import { useEffect, useRef, useState } from 'react';
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
import { slugifyListName } from '../lib/parser';

const LIST_EMOJIS = ['🛒', '🥬', '🍎', '🥩', '🐟', '🧀', '💊', '🎁', '🍷', '🌿'];

interface CourseListEditorProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialNom?: string;
  initialEmoji?: string;
  /** IDs (slugs) existants pour valider la collision. En mode edit, exclure self via excludeId. */
  existingIds: string[];
  /** Mode edit : id de la liste éditée (à exclure du check de collision) */
  excludeId?: string;
  onClose: () => void;
  onSave: (nom: string, emoji: string) => Promise<void>;
}

export function CourseListEditor({
  visible,
  mode,
  initialNom,
  initialEmoji,
  existingIds,
  excludeId,
  onClose,
  onSave,
}: CourseListEditorProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const nameRef = useRef<TextInput>(null);

  const [nom, setNom] = useState(initialNom ?? '');
  const [emoji, setEmoji] = useState(initialEmoji ?? LIST_EMOJIS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNom(initialNom ?? '');
      setEmoji(initialEmoji ?? LIST_EMOJIS[0]);
      setSaving(false);
    }
  }, [visible, initialNom, initialEmoji]);

  const trimmedNom = nom.trim();
  const computedSlug = slugifyListName(trimmedNom);
  const collision =
    trimmedNom.length > 0 &&
    existingIds.some((id) => id === computedSlug && id !== excludeId);
  const isInvalid = trimmedNom.length === 0 || collision || saving;

  const errorMessage = collision
    ? t('meals.shopping.lists.collisionError', { defaultValue: 'Une liste porte déjà ce nom.' })
    : null;

  const handleSelectEmoji = (e: string) => {
    if (mode === 'edit') return; // emoji read-only en edit (Plan 260428-huh)
    Haptics.selectionAsync();
    setEmoji(e);
  };

  const handleSave = async () => {
    if (isInvalid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    try {
      await onSave(trimmedNom, emoji);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const title = mode === 'create'
    ? t('meals.shopping.lists.createTitle')
    : t('meals.shopping.lists.editTitle');

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
          title={title}
          onClose={onClose}
          rightLabel={t('meals.shopping.lists.save', { defaultValue: 'Enregistrer' })}
          onRight={handleSave}
          rightDisabled={isInvalid}
          closeLeft
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nom */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('meals.shopping.lists.name')}
          </Text>
          <TextInput
            ref={nameRef}
            value={nom}
            onChangeText={setNom}
            autoFocus
            maxLength={40}
            placeholder={t('meals.shopping.lists.name')}
            placeholderTextColor={colors.textFaint}
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: errorMessage ? colors.error : colors.inputBorder,
                color: colors.text,
              },
            ]}
          />
          {errorMessage && (
            <Text style={[styles.error, { color: colors.error }]}>{errorMessage}</Text>
          )}

          {/* Emoji */}
          <Text style={[styles.label, { color: colors.textMuted, marginTop: Spacing['3xl'] }]}>
            {t('meals.shopping.lists.emoji', { defaultValue: 'Emoji' })}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiRow}
          >
            {LIST_EMOJIS.map((e) => {
              const selected = e === emoji;
              const disabled = mode === 'edit';
              return (
                <TouchableOpacity
                  key={e}
                  onPress={() => handleSelectEmoji(e)}
                  disabled={disabled && !selected}
                  style={[
                    styles.emojiButton,
                    {
                      backgroundColor: selected ? primary : colors.card,
                      borderColor: selected ? primary : colors.border,
                      opacity: disabled && !selected ? 0.4 : 1,
                    },
                  ]}
                >
                  <Text style={styles.emojiLabel}>{e}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {mode === 'edit' && (
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              {t('meals.shopping.lists.emojiEditHint', {
                defaultValue: 'L\'emoji ne peut pas être modifié pour le moment.',
              })}
            </Text>
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
  error: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
  },
  hint: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },
  emojiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.base,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiLabel: {
    fontSize: FontSize.title,
  },
});
