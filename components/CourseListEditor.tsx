/**
 * CourseListEditor.tsx — Modal pageSheet pour créer/renommer une liste de courses (Phase D)
 *
 * Mode 'create' : nom + icône lucide → onSave(nom, icon)
 * Mode 'edit'   : nom modifiable, icône affichée en lecture (rename ne change que le nom — voir Plan 260428-huh task 4 décision)
 *
 * useThemeColors strict — aucune couleur hardcoded. Drag-to-dismiss natif iOS via pageSheet.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Modal,
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
import { LIST_ICONS, renderListIcon } from '../lib/list-icons';

interface CourseListEditorProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialNom?: string;
  initialIcon?: string;
  /** IDs (slugs) existants pour valider la collision. En mode edit, exclure self via excludeId. */
  existingIds: string[];
  /** Mode edit : id de la liste éditée (à exclure du check de collision) */
  excludeId?: string;
  onClose: () => void;
  onSave: (nom: string, icon: string) => Promise<void>;
}

const DEFAULT_ICON = 'shopping-cart';

export function CourseListEditor({
  visible,
  mode,
  initialNom,
  initialIcon,
  existingIds,
  excludeId,
  onClose,
  onSave,
}: CourseListEditorProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const nameRef = useRef<TextInput>(null);

  const [nom, setNom] = useState(initialNom ?? '');
  const [icon, setIcon] = useState(initialIcon ?? DEFAULT_ICON);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNom(initialNom ?? '');
      setIcon(initialIcon ?? DEFAULT_ICON);
      setSaving(false);
    }
  }, [visible, initialNom, initialIcon]);

  const trimmedNom = nom.trim();
  const computedSlug = slugifyListName(trimmedNom);
  const collision =
    trimmedNom.length > 0 &&
    existingIds.some((id) => id === computedSlug && id !== excludeId);
  const isInvalid = trimmedNom.length === 0 || collision || saving;

  const errorMessage = collision
    ? t('meals.shopping.lists.collisionError', { defaultValue: 'Une liste porte déjà ce nom.' })
    : null;

  const handleSelectIcon = (name: string) => {
    if (mode === 'edit') return; // icon read-only en edit (Plan 260428-huh)
    Haptics.selectionAsync();
    setIcon(name);
  };

  const handleSave = async () => {
    if (isInvalid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    try {
      await onSave(trimmedNom, icon);
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

          {/* Icône */}
          <Text style={[styles.label, { color: colors.textMuted, marginTop: Spacing['3xl'] }]}>
            {t('meals.shopping.lists.icon', { defaultValue: 'Icône' })}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.iconRow}
          >
            {LIST_ICONS.map(({ name }) => {
              const selected = name === icon;
              const disabled = mode === 'edit';
              const tint = selected ? colors.onPrimary : colors.textSub;
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => handleSelectIcon(name)}
                  disabled={disabled && !selected}
                  style={[
                    styles.iconButton,
                    {
                      backgroundColor: selected ? primary : colors.card,
                      borderColor: selected ? primary : colors.border,
                      opacity: disabled && !selected ? 0.4 : 1,
                    },
                  ]}
                >
                  {renderListIcon(name, 22, tint)}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {mode === 'edit' && (
            <Text style={[styles.hint, { color: colors.textFaint }]}>
              {t('meals.shopping.lists.iconEditHint', {
                defaultValue: 'L\'icône ne peut pas être modifiée pour le moment.',
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
  iconRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.base,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
