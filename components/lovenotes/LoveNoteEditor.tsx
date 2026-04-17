/**
 * LoveNoteEditor.tsx — Modal composition love note (Phase 36 Plan 03)
 *
 * Modal presentationStyle="pageSheet" (drag-to-dismiss iOS natif) :
 * - Chips destinataire (filtre exclut auteur — Pitfall 9)
 * - TextInput body markdown + toggle preview MarkdownText
 * - Chips presets (Demain matin / Dimanche soir / Dans 1 mois / Custom) + DateInput date + DateInput time
 * - Pré-rempli avec preset "Demain matin" au mount (RESEARCH Open Q 5)
 * - Validation : destinataire non vide, body trim non vide, revealAt > now+60s
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { ModalHeader } from '../ui/ModalHeader';
import { Chip } from '../ui/Chip';
import { MarkdownText } from '../ui/MarkdownText';
import { DateInput } from '../ui/DateInput';
import { Button } from '../ui/Button';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import {
  presetTomorrowMorning,
  presetNextSundayEvening,
  presetInOneMonth,
} from '../../lib/lovenotes/reveal-engine';
import type { Profile } from '../../lib/types';

type PresetKey = 'tomorrow' | 'sunday' | 'month' | 'custom';

interface LoveNoteEditorProps {
  visible: boolean;
  fromProfile: Profile;
  recipientProfiles: Profile[]; // déjà filtrés (excluding author)
  onSave: (to: string, body: string, revealAt: string) => Promise<void>;
  onClose: () => void;
}

export function LoveNoteEditor({
  visible,
  fromProfile: _fromProfile,
  recipientProfiles,
  onSave,
  onClose,
}: LoveNoteEditorProps) {
  const { colors, primary } = useThemeColors();
  const [to, setTo] = useState<string>('');
  const [body, setBody] = useState('');
  const [revealDate, setRevealDate] = useState('');
  const [revealTime, setRevealTime] = useState('08:00');
  const [activePreset, setActivePreset] = useState<PresetKey>('tomorrow');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset state au mount du Modal (préremplit preset "Demain matin")
  useEffect(() => {
    if (!visible) return;
    const tm = presetTomorrowMorning();
    setTo('');
    setBody('');
    setRevealDate(tm.date);
    setRevealTime(tm.time);
    setActivePreset('tomorrow');
    setShowPreview(false);
    setSaving(false);
  }, [visible]);

  const applyPreset = useCallback((key: PresetKey) => {
    // NOTE : Chip déclenche Haptics.selectionAsync() en interne — pas besoin ici
    setActivePreset(key);
    if (key === 'custom') return;
    const p =
      key === 'tomorrow'
        ? presetTomorrowMorning()
        : key === 'sunday'
          ? presetNextSundayEvening()
          : presetInOneMonth();
    setRevealDate(p.date);
    setRevealTime(p.time);
  }, []);

  const onDateChange = useCallback((iso: string) => {
    setRevealDate(iso); // 'YYYY-MM-DD' (cf DateInput.toISO)
    setActivePreset('custom');
  }, []);
  const onTimeChange = useCallback((hhmm: string) => {
    setRevealTime(hhmm); // 'HH:MM' (cf DateInput.toHHMM — pas de secondes)
    setActivePreset('custom');
  }, []);

  const handleSave = useCallback(async () => {
    if (!to) {
      Alert.alert('Choisis un destinataire');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Le message ne peut pas être vide');
      return;
    }
    if (!revealDate) {
      Alert.alert('Choisis une date de révélation');
      return;
    }

    // revealTime est 'HH:MM' (DateInput.toHHMM) → composer ISO local sans Z
    const revealAt = `${revealDate}T${revealTime}:00`;
    const [y, m, d] = revealDate.split('-').map(Number);
    const [hh, mm] = revealTime.split(':').map(Number);
    const revealDt = new Date(y, m - 1, d, hh, mm, 0);
    if (revealDt.getTime() <= Date.now() + 60_000) {
      Alert.alert('La date de révélation doit être dans le futur');
      return;
    }

    setSaving(true);
    try {
      await onSave(to, body.trim(), revealAt);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de programmer la note');
      if (__DEV__) console.error('[LoveNoteEditor] save', e);
    } finally {
      setSaving(false);
    }
  }, [to, body, revealDate, revealTime, onSave, onClose]);

  // Garde — famille à 1 profil
  const noRecipients = recipientProfiles.length === 0;

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <ModalHeader title="Nouvelle love note" onClose={onClose} />
        <ScrollView
          contentContainerStyle={{ padding: Spacing['2xl'], gap: Spacing['2xl'] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Destinataire */}
          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Pour qui ?</Text>
            {noRecipients ? (
              <Text style={{ color: colors.textMuted, marginTop: Spacing.md }}>
                Tu es seul·e dans ta famille — invite un proche pour utiliser les Love Notes.
              </Text>
            ) : (
              <View style={styles.chipsRow}>
                {recipientProfiles.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    emoji={p.avatar}
                    selected={to === p.id}
                    onPress={() => setTo(p.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Body + preview toggle */}
          <View>
            <View style={styles.bodyHeader}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Message</Text>
              <Pressable onPress={() => setShowPreview((v) => !v)}>
                <Text style={{ color: primary, fontSize: FontSize.sm }}>
                  {showPreview ? 'Éditer' : 'Aperçu'}
                </Text>
              </Pressable>
            </View>
            {showPreview ? (
              <View
                style={[
                  styles.preview,
                  { backgroundColor: colors.cardAlt, borderColor: colors.border },
                ]}
              >
                <MarkdownText>{body || '_Aperçu vide_'}</MarkdownText>
              </View>
            ) : (
              <TextInput
                multiline
                value={body}
                onChangeText={setBody}
                placeholder="Ton message... (markdown supporté : **gras**, *italique*)"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.textInput,
                  { color: colors.text, backgroundColor: colors.cardAlt, borderColor: colors.border },
                ]}
              />
            )}
          </View>

          {/* Presets reveal */}
          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Révéler quand ?</Text>
            <View style={styles.chipsRow}>
              <Chip
                label="Demain matin"
                emoji="🌅"
                selected={activePreset === 'tomorrow'}
                onPress={() => applyPreset('tomorrow')}
              />
              <Chip
                label="Dimanche soir"
                emoji="🌙"
                selected={activePreset === 'sunday'}
                onPress={() => applyPreset('sunday')}
              />
              <Chip
                label="Dans 1 mois"
                emoji="📅"
                selected={activePreset === 'month'}
                onPress={() => applyPreset('month')}
              />
              <Chip
                label="Custom"
                emoji="✏️"
                selected={activePreset === 'custom'}
                onPress={() => applyPreset('custom')}
              />
            </View>
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <DateInput
                  value={revealDate}
                  onChange={onDateChange}
                  mode="date"
                  placeholder="JJ/MM/AAAA"
                />
              </View>
              <View style={{ flex: 1 }}>
                <DateInput
                  value={revealTime}
                  onChange={onTimeChange}
                  mode="time"
                  placeholder="HH:MM"
                />
              </View>
            </View>
          </View>

          <Button
            label={saving ? 'Programmation...' : 'Programmer la note'}
            onPress={handleSave}
            disabled={saving || noRecipients}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold as any,
    marginBottom: Spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  bodyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.xl,
    minHeight: 140,
    textAlignVertical: 'top',
    fontSize: FontSize.body,
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.xl,
    minHeight: 140,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});
