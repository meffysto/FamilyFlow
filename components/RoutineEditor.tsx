/**
 * RoutineEditor.tsx — Modal d'édition / création de routine
 *
 * Permet d'ajouter, modifier et supprimer des routines et leurs étapes.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';
import { useTranslation } from 'react-i18next';
import { ModalHeader } from './ui';
import { Routine, RoutineStep } from '../lib/types';

interface RoutineEditorProps {
  routine?: Routine; // undefined = nouvelle routine
  onSave: (routine: Routine) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const EMOJI_SUGGESTIONS = ['☀️', '🌙', '📚', '🏃', '🧹', '🍽️', '🎵', '🛁', '💪', '🧘', '🎒', '⭐'];

export function RoutineEditor({ routine, onSave, onDelete, onClose }: RoutineEditorProps) {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const isNew = !routine;

  const [emoji, setEmoji] = useState(routine?.emoji || '📋');
  const [label, setLabel] = useState(routine?.label || '');
  const [steps, setSteps] = useState<RoutineStep[]>(
    routine?.steps.length ? [...routine.steps] : [{ text: '' }]
  );
  const [isVisual, setIsVisual] = useState(routine?.isVisual ?? false);

  const canSave = label.trim().length > 0 && steps.some(s => s.text.trim().length > 0);

  const handleSave = useCallback(() => {
    const cleanSteps = steps.filter(s => s.text.trim().length > 0).map(s => ({
      text: s.text.trim(),
      durationMinutes: s.durationMinutes,
    }));

    if (!label.trim() || cleanSteps.length === 0) return;

    const id = routine?.id || label.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

    onSave({
      id,
      label: label.trim(),
      emoji,
      steps: cleanSteps,
      isVisual,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [label, emoji, steps, routine, onSave]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      t('routineEditor.alert.deleteTitle'),
      t('routineEditor.alert.deleteMsg', { name: routine?.label }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: onDelete },
      ]
    );
  }, [routine, onDelete]);

  const addStep = useCallback(() => {
    setSteps(prev => [...prev, { text: '' }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updateStepText = useCallback((index: number, text: string) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, text } : s));
  }, []);

  const updateStepDuration = useCallback((index: number, value: string) => {
    const num = parseInt(value, 10);
    setSteps(prev => prev.map((s, i) =>
      i === index ? { ...s, durationMinutes: isNaN(num) || num <= 0 ? undefined : num } : s
    ));
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const moveStep = useCallback((index: number, direction: -1 | 1) => {
    setSteps(prev => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <KeyboardAvoidingView
      style={[st.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ModalHeader
        title={isNew ? t('routineEditor.titleNew') : t('routineEditor.titleEdit')}
        onClose={onClose}
        rightLabel={t('routineEditor.save')}
        onRight={handleSave}
        rightDisabled={!canSave}
      />

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Emoji */}
        <Text style={[st.sectionLabel, { color: colors.textMuted }]}>{t('routineEditor.iconLabel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.emojiRow}>
          {EMOJI_SUGGESTIONS.map(e => (
            <TouchableOpacity
              key={e}
              style={[
                st.emojiBtn,
                { backgroundColor: emoji === e ? primary + '20' : colors.cardAlt, borderColor: emoji === e ? primary : 'transparent' },
              ]}
              onPress={() => { setEmoji(e); Haptics.selectionAsync(); }}
              activeOpacity={0.7}
            >
              <Text style={st.emojiBtnText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Nom */}
        <Text style={[st.sectionLabel, { color: colors.textMuted }]}>{t('routineEditor.nameLabel')}</Text>
        <TextInput
          style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={label}
          onChangeText={setLabel}
          placeholder={t('routineEditor.namePlaceholder')}
          placeholderTextColor={colors.textFaint}
          autoFocus={isNew}
        />

        {/* Mode visuel */}
        <View style={st.visualRow}>
          <View style={{ flex: 1 }}>
            <Text style={[st.sectionLabel, { color: colors.textMuted, marginTop: 0 }]}>{t('routineEditor.visualMode')}</Text>
            <Text style={[st.visualHint, { color: colors.textFaint }]}>
              {t('routineEditor.visualHint')}
            </Text>
          </View>
          <Switch
            value={isVisual}
            onValueChange={setIsVisual}
            trackColor={{ false: colors.switchOff, true: primary + '60' }}
            thumbColor={isVisual ? primary : colors.textMuted}
          />
        </View>

        {/* Étapes */}
        <Text style={[st.sectionLabel, { color: colors.textMuted }]}>{t('routineEditor.stepsLabel')}</Text>
        {steps.map((step, i) => (
          <View key={i} style={[st.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={st.stepHeader}>
              <Text style={[st.stepNum, { color: primary }]}>{i + 1}</Text>
              <View style={st.stepActions}>
                {i > 0 && (
                  <TouchableOpacity onPress={() => moveStep(i, -1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[st.stepActionText, { color: colors.textMuted }]}>▲</Text>
                  </TouchableOpacity>
                )}
                {i < steps.length - 1 && (
                  <TouchableOpacity onPress={() => moveStep(i, 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[st.stepActionText, { color: colors.textMuted }]}>▼</Text>
                  </TouchableOpacity>
                )}
                {steps.length > 1 && (
                  <TouchableOpacity onPress={() => removeStep(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[st.stepActionText, { color: colors.error }]}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <TextInput
              style={[st.stepInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={step.text}
              onChangeText={(t) => updateStepText(i, t)}
              placeholder={t('routineEditor.stepPlaceholder', { n: i + 1 })}
              placeholderTextColor={colors.textFaint}
            />
            <View style={st.durationRow}>
              <Text style={[st.durationLabel, { color: colors.textSub }]}>{t('routineEditor.timerLabel')}</Text>
              <TextInput
                style={[st.durationInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                value={step.durationMinutes ? String(step.durationMinutes) : ''}
                onChangeText={(v) => updateStepDuration(i, v)}
                placeholder={t('routineEditor.timerPlaceholder')}
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[st.addStepBtn, { backgroundColor: primary + '15', borderColor: primary + '40' }]}
          onPress={addStep}
          activeOpacity={0.7}
        >
          <Text style={[st.addStepText, { color: primary }]}>{t('routineEditor.addStep')}</Text>
        </TouchableOpacity>

        {/* Supprimer */}
        {!isNew && onDelete && (
          <TouchableOpacity
            style={[st.deleteBtn, { backgroundColor: colors.errorBg }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Text style={[st.deleteBtnText, { color: colors.error }]}>{t('routineEditor.deleteRoutine')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing['2xl'], gap: Spacing.lg },

  sectionLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
  },

  emojiRow: { flexDirection: 'row' },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    borderWidth: 2,
  },
  emojiBtnText: { fontSize: FontSize.display },

  input: {
    fontSize: FontSize.body,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  stepCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    gap: Spacing.md,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepNum: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.heavy,
  },
  stepActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  stepActionText: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  stepInput: {
    fontSize: FontSize.body,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  durationLabel: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  durationInput: {
    width: 70,
    fontSize: FontSize.body,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    textAlign: 'center',
  },

  visualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  visualHint: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },

  addStepBtn: {
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addStepText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },

  deleteBtn: {
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  deleteBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
