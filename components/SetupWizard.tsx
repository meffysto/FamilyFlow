/**
 * SetupWizard.tsx — Onboarding wizard for creating a new vault
 *
 * 3-step flow: Parents → Children → Confirm & Create
 * Creates a complete vault structure in documentDirectory.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import { VaultManager } from '../lib/vault';
import { useThemeColors } from '../contexts/ThemeContext';
import { FontSize, FontWeight } from '../constants/typography';

interface SetupWizardProps {
  onComplete: (vaultPath: string) => void;
  onCancel: () => void;
  /** Si fourni, le vault sera créé dans ce dossier au lieu de documentDirectory */
  targetPath?: string;
  /** Données pré-remplies depuis l'onboarding (évite de redemander) */
  initialParents?: PersonInput[];
  initialChildren?: ChildInput[];
}

export interface PersonInput {
  name: string;
  avatar: string;
}

export interface ChildInput {
  name: string;
  avatar: string;
  birthdate: string;
}

const PARENT_AVATARS = ['👨', '👩', '👨‍💻', '👩‍💼', '🧑', '👴', '👵'];
const CHILD_AVATARS = ['👶', '🍼', '👧', '👦', '🧒', '🐣', '🌟'];

export function SetupWizard({ onComplete, onCancel, targetPath, initialParents, initialChildren }: SetupWizardProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();
  const hasInitialData = !!(initialParents?.length && initialParents.some(p => p.name.trim()));
  const [step, setStep] = useState(hasInitialData ? 2 : 0);
  const [parents, setParents] = useState<PersonInput[]>(initialParents?.length ? initialParents : [{ name: '', avatar: '👨' }]);
  const [children, setChildren] = useState<ChildInput[]>(initialChildren?.length ? initialChildren : [{ name: '', avatar: '👶', birthdate: '' }]);
  const [isCreating, setIsCreating] = useState(false);

  // --- Step 0: Parents ---
  const addParent = () => {
    if (parents.length < 4) {
      setParents([...parents, { name: '', avatar: '👩' }]);
    }
  };

  const removeParent = (i: number) => {
    if (parents.length > 1) {
      setParents(parents.filter((_, idx) => idx !== i));
    }
  };

  const updateParent = (i: number, field: keyof PersonInput, value: string) => {
    const updated = [...parents];
    updated[i] = { ...updated[i], [field]: value };
    setParents(updated);
  };

  // --- Step 1: Children ---
  const addChild = () => {
    if (children.length < 6) {
      setChildren([...children, { name: '', avatar: '👶', birthdate: '' }]);
    }
  };

  const removeChild = (i: number) => {
    setChildren(children.filter((_, idx) => idx !== i));
  };

  const updateChild = (i: number, field: keyof ChildInput, value: string) => {
    const updated = [...children];
    updated[i] = { ...updated[i], [field]: value };
    setChildren(updated);
  };

  // --- Validation ---
  const canProceedStep0 = parents.every((p) => p.name.trim().length > 0);
  const canProceedStep1 = children.length === 0 || children.every((c) => c.name.trim().length > 0);

  // --- Step 2: Create vault ---
  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const vaultPath = targetPath || `${FileSystem.documentDirectory}family-vault`;

      // Ensure the root dir exists
      const info = await FileSystem.getInfoAsync(vaultPath);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(vaultPath, { intermediates: true });
      }

      const vault = new VaultManager(vaultPath);
      await vault.scaffoldVault(
        parents.map((p) => ({ name: p.name.trim(), avatar: p.avatar })),
        children
          .filter((c) => c.name.trim().length > 0)
          .map((c) => {
            // Convert DD/MM/YYYY → YYYY-MM-DD
            let bd = c.birthdate.trim();
            const ddmmyyyy = bd.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (ddmmyyyy) bd = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
            return {
              name: c.name.trim(),
              avatar: c.avatar,
              birthdate: bd || new Date().toISOString().slice(0, 10),
            };
          })
      );

      onComplete(vaultPath);
    } catch (e) {
      Alert.alert(t('common.error'), t('setup.wizard.createError', { error: String(e) }));
    }
    setIsCreating(false);
  };

  const renderPersonRow = (
    person: PersonInput,
    index: number,
    avatars: string[],
    onUpdate: (i: number, field: keyof PersonInput, value: string) => void,
    onRemove: (i: number) => void,
    canRemove: boolean
  ) => (
    <View key={index} style={[styles.personRow, { backgroundColor: colors.cardAlt }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarRow}>
        {avatars.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.avatarBtn,
              person.avatar === emoji && { backgroundColor: tint, borderColor: primary },
            ]}
            onPress={() => onUpdate(index, 'avatar', emoji)}
          >
            <Text style={styles.avatarEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.nameRow}>
        <TextInput
          style={[styles.nameInput, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.card }]}
          value={person.name}
          onChangeText={(v) => onUpdate(index, 'name', v)}
          placeholder={t('setup.wizard.firstNamePlaceholder')}
          placeholderTextColor={colors.textFaint}
        />
        {canRemove && (
          <TouchableOpacity style={[styles.removeBtn, { backgroundColor: colors.errorBg }]} onPress={() => onRemove(index)}>
            <Text style={[styles.removeBtnText, { color: colors.error }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderChildRow = (child: ChildInput, index: number) => (
    <View key={index} style={[styles.personRow, { backgroundColor: colors.cardAlt }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarRow}>
        {CHILD_AVATARS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.avatarBtn,
              child.avatar === emoji && { backgroundColor: tint, borderColor: primary },
            ]}
            onPress={() => updateChild(index, 'avatar', emoji)}
          >
            <Text style={styles.avatarEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.nameRow}>
        <TextInput
          style={[styles.nameInput, { flex: 1, borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.card }]}
          value={child.name}
          onChangeText={(v) => updateChild(index, 'name', v)}
          placeholder={t('setup.wizard.firstNamePlaceholder')}
          placeholderTextColor={colors.textFaint}
        />
        <TextInput
          style={[styles.nameInput, { flex: 1, borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.card }]}
          value={child.birthdate}
          onChangeText={(v) => updateChild(index, 'birthdate', v)}
          placeholder={t('setup.wizard.datePlaceholder')}
          placeholderTextColor={colors.textFaint}
          keyboardType="numbers-and-punctuation"
        />
        <TouchableOpacity style={[styles.removeBtn, { backgroundColor: colors.errorBg }]} onPress={() => removeChild(index)}>
          <Text style={[styles.removeBtnText, { color: colors.error }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {[0, 1, 2].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              s <= step ? { backgroundColor: primary } : { backgroundColor: colors.separator },
            ]}
          />
        ))}
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{t('setup.wizard.parentsTitle')}</Text>
            <Text style={[styles.stepDesc, { color: colors.textMuted }]}>{t('setup.wizard.parentsDesc')}</Text>
            {parents.map((p, i) =>
              renderPersonRow(p, i, PARENT_AVATARS, updateParent, removeParent, parents.length > 1)
            )}
            {parents.length < 4 && (
              <TouchableOpacity style={[styles.addBtn, { borderColor: primary }]} onPress={addParent}>
                <Text style={[styles.addBtnText, { color: primary }]}>{t('setup.wizard.addParent')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{t('setup.wizard.childrenTitle')}</Text>
            <Text style={[styles.stepDesc, { color: colors.textMuted }]}>{t('setup.wizard.childrenDesc')}</Text>
            {children.map((c, i) => renderChildRow(c, i))}
            {children.length < 6 && (
              <TouchableOpacity style={[styles.addBtn, { borderColor: primary }]} onPress={addChild}>
                <Text style={[styles.addBtnText, { color: primary }]}>{t('setup.wizard.addChild')}</Text>
              </TouchableOpacity>
            )}
            {children.length === 0 && (
              <Text style={[styles.noChildHint, { color: colors.textFaint }]}>{t('setup.wizard.noChildHint')}</Text>
            )}
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{t('setup.wizard.summaryTitle')}</Text>
            <Text style={[styles.stepDesc, { color: colors.textMuted }]}>{t('setup.wizard.summaryDesc')}</Text>

            <View style={[styles.summaryCard, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t('setup.wizard.parentsLabel')}</Text>
              {parents.map((p, i) => (
                <Text key={i} style={[styles.summaryItem, { color: colors.text }]}>
                  {p.avatar} {p.name}
                </Text>
              ))}
            </View>

            {children.filter((c) => c.name.trim()).length > 0 && (
              <View style={[styles.summaryCard, { backgroundColor: colors.cardAlt }]}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t('setup.wizard.childrenLabel')}</Text>
                {children
                  .filter((c) => c.name.trim())
                  .map((c, i) => (
                    <Text key={i} style={[styles.summaryItem, { color: colors.text }]}>
                      {c.avatar} {c.name}
                      {c.birthdate ? ` — ${c.birthdate}` : ''}
                    </Text>
                  ))}
              </View>
            )}

            <View style={[styles.summaryCard, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t('setup.wizard.willCreateLabel')}</Text>
              <Text style={[styles.summaryDetail, { color: colors.textSub }]}>
                {t('setup.wizard.willCreateDetail')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={[styles.navRow, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.navBtnSecondary, { borderColor: colors.separator }]}
          onPress={() => {
            if (step === 0 || (hasInitialData && step === 2)) onCancel();
            else setStep(step - 1);
          }}
        >
          <Text style={[styles.navBtnSecondaryText, { color: colors.textMuted }]}>{step === 0 ? t('common.cancel') : t('setup.wizard.back')}</Text>
        </TouchableOpacity>

        {step < 2 ? (
          <TouchableOpacity
            style={[
              styles.navBtnPrimary,
              { backgroundColor: primary },
              !(step === 0 ? canProceedStep0 : canProceedStep1) && styles.navBtnDisabled,
            ]}
            onPress={() => setStep(step + 1)}
            disabled={!(step === 0 ? canProceedStep0 : canProceedStep1)}
          >
            <Text style={[styles.navBtnPrimaryText, { color: colors.onPrimary }]}>{t('common.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtnPrimary, { backgroundColor: primary }, isCreating && styles.navBtnDisabled]}
            onPress={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.navBtnPrimaryText, { color: colors.onPrimary }]}>{t('setup.wizard.letsGo')}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
  },
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.heavy,
  },
  stepDesc: {
    fontSize: FontSize.sm,
    marginBottom: 4,
  },
  personRow: {
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  avatarRow: {
    flexDirection: 'row',
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 6,
  },
  avatarEmoji: {
    fontSize: FontSize.titleLg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 10,
    fontSize: FontSize.body,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  addBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  noChildHint: {
    fontSize: FontSize.label,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  summaryCard: {
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  summaryLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryItem: {
    fontSize: FontSize.lg,
  },
  summaryDetail: {
    fontSize: FontSize.label,
    lineHeight: 18,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1,
  },
  navBtnSecondary: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  navBtnSecondaryText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  navBtnPrimary: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  navBtnPrimaryText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
});
