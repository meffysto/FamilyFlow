/**
 * LoveNoteEditor.tsx — Modal composition love note (Phase 36 Plan 03)
 *
 * Modal presentationStyle="pageSheet" (drag-to-dismiss iOS natif) :
 * - Chips destinataire (filtre exclut auteur — Pitfall 9)
 * - TextInput body markdown + toggle preview MarkdownText
 * - Chips presets (Demain matin / Dimanche soir / Dans 1 mois / Personnaliser) + DateInput date + DateInput time
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
import { useAI } from '../../contexts/AIContext';
import { improveLoveNote, type LoveNoteStyle } from '../../lib/ai-service';
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
  const { isConfigured: aiConfigured, config: aiConfig } = useAI();
  const [to, setTo] = useState<string>('');
  const [body, setBody] = useState('');
  const [revealDate, setRevealDate] = useState('');
  const [revealTime, setRevealTime] = useState('08:00');
  const [activePreset, setActivePreset] = useState<PresetKey>('tomorrow');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [aiStyle, setAiStyle] = useState<LoveNoteStyle>('tendre');

  const handleImprove = useCallback(async () => {
    if (!aiConfig) return;
    const trimmed = body.trim();
    if (!trimmed) {
      Alert.alert('Rien à améliorer', 'Écris d\'abord ton message.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setImproving(true);
    try {
      const resp = await improveLoveNote(aiConfig, trimmed, aiStyle);
      if (resp.error || !resp.text) {
        Alert.alert('IA indisponible', resp.error || 'Réponse vide.');
        return;
      }
      setBody(resp.text.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      if (__DEV__) console.warn('[improveLoveNote]', e);
      Alert.alert('Erreur', 'Impossible d\'améliorer le message.');
    } finally {
      setImproving(false);
    }
  }, [aiConfig, body, aiStyle]);

  const AI_STYLES: Array<{ id: LoveNoteStyle; label: string; emoji: string }> = [
    { id: 'tendre', label: 'Tendre', emoji: '🫶' },
    { id: 'poetique', label: 'Poétique', emoji: '🌸' },
    { id: 'drole', label: 'Drôle', emoji: '😄' },
    { id: 'encourageant', label: 'Encourageant', emoji: '💪' },
    { id: 'concis', label: 'Concis', emoji: '✂️' },
    { id: 'romantique', label: 'Romantique', emoji: '❤️' },
  ];

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
              <View style={styles.bodyActions}>
                {aiConfigured && (
                  <Pressable
                    onPress={handleImprove}
                    disabled={improving}
                    style={{ opacity: improving ? 0.5 : 1 }}
                    accessibilityRole="button"
                    accessibilityLabel="Améliorer avec l'IA"
                  >
                    <Text style={{ color: primary, fontSize: FontSize.sm }}>
                      {improving ? '✨ …' : '✨ Améliorer'}
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setShowPreview((v) => !v)}>
                  <Text style={{ color: primary, fontSize: FontSize.sm }}>
                    {showPreview ? 'Éditer' : 'Aperçu'}
                  </Text>
                </Pressable>
              </View>
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
                placeholder="Ton message…"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.textInput,
                  { color: colors.text, backgroundColor: colors.cardAlt, borderColor: colors.border },
                ]}
              />
            )}
            {aiConfigured && (
              <View style={styles.aiStyleRow}>
                <Text style={[styles.aiStyleLabel, { color: colors.textMuted }]}>
                  Style IA
                </Text>
                <View style={styles.chipsRow}>
                  {AI_STYLES.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.label}
                      emoji={s.emoji}
                      selected={aiStyle === s.id}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setAiStyle(s.id);
                      }}
                    />
                  ))}
                </View>
              </View>
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
                label="Personnaliser"
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
  bodyActions: {
    flexDirection: 'row',
    gap: Spacing.xl,
    alignItems: 'center',
  },
  aiStyleRow: {
    marginTop: Spacing.md,
  },
  aiStyleLabel: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
    fontWeight: '500',
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
