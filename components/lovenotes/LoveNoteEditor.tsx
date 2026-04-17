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

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

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

/** Concatene le texte de base + la dictee avec un espacement propre. */
function joinBase(base: string, dictated: string): string {
  if (!dictated) return base;
  if (!base) return dictated;
  const needsSpace = !base.endsWith(' ') && !base.endsWith('\n');
  return needsSpace ? `${base} ${dictated}` : `${base}${dictated}`;
}

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
  const [showAiStyles, setShowAiStyles] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [dictating, setDictating] = useState(false);
  const dictationBaseRef = useRef<string>('');
  const dictationFinalRef = useRef<string>('');
  const stoppingDictationRef = useRef(false);

  // ── Dictaphone : reception des segments reconnus en live ──
  useSpeechRecognitionEvent('result', (event) => {
    if (!dictating) return;
    const text = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      dictationFinalRef.current = dictationFinalRef.current
        ? `${dictationFinalRef.current} ${text}`
        : text;
      setBody(joinBase(dictationBaseRef.current, dictationFinalRef.current));
    } else {
      const interim = dictationFinalRef.current
        ? `${dictationFinalRef.current} ${text}`
        : text;
      setBody(joinBase(dictationBaseRef.current, interim));
    }
  });

  useSpeechRecognitionEvent('end', () => {
    // Relance silencieuse si l'utilisateur dicte toujours (iOS stoppe apres silence)
    if (dictating && !stoppingDictationRef.current) {
      try {
        ExpoSpeechRecognitionModule.start({
          lang: 'fr-FR',
          interimResults: true,
          continuous: true,
          requiresOnDeviceRecognition: true,
          addsPunctuation: true,
          iosTaskHint: 'dictation',
        });
      } catch {
        setDictating(false);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech' && dictating && !stoppingDictationRef.current) {
      try {
        ExpoSpeechRecognitionModule.start({
          lang: 'fr-FR',
          interimResults: true,
          continuous: true,
          requiresOnDeviceRecognition: true,
          addsPunctuation: true,
          iosTaskHint: 'dictation',
        });
      } catch {
        /* ignore */
      }
      return;
    }
    if (event.error !== 'aborted' && dictating) {
      if (__DEV__) console.warn('[lovenote dictation]', event.error, event.message);
    }
  });

  const startDictation = useCallback(async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission refusée',
          "Autorise l'accès au micro dans Réglages pour dicter.",
        );
        return;
      }
      dictationBaseRef.current = body;
      dictationFinalRef.current = '';
      stoppingDictationRef.current = false;
      setDictating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      ExpoSpeechRecognitionModule.start({
        lang: 'fr-FR',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
      });
    } catch (e) {
      if (__DEV__) console.warn('[startDictation]', e);
      Alert.alert('Erreur', 'Impossible de démarrer la dictée.');
      setDictating(false);
    }
  }, [body]);

  const stopDictation = useCallback(() => {
    stoppingDictationRef.current = true;
    setDictating(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* deja arrete */
    }
  }, []);

  const handleDictateTap = useCallback(() => {
    if (dictating) stopDictation();
    else startDictation();
  }, [dictating, startDictation, stopDictation]);

  // Cleanup au unmount du modal
  useEffect(() => {
    if (!visible && dictating) {
      stoppingDictationRef.current = true;
      setDictating(false);
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
    }
    return () => {
      if (dictating) {
        try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
      }
    };
  }, [visible, dictating]);

  const runImprove = useCallback(async (style: LoveNoteStyle) => {
    if (!aiConfig) return;
    const trimmed = body.trim();
    if (!trimmed) {
      Alert.alert('Rien à améliorer', 'Écris d\'abord ton message.');
      return;
    }
    setShowAiStyles(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setImproving(true);
    try {
      const resp = await improveLoveNote(aiConfig, trimmed, style);
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
  }, [aiConfig, body]);

  const handleImproveTap = useCallback(() => {
    if (!body.trim()) {
      Alert.alert('Rien à améliorer', 'Écris d\'abord ton message.');
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setShowAiStyles(true);
  }, [body]);

  // Toolbar markdown : wrap la selection (ou insert au curseur si selection vide)
  const wrapSelection = useCallback(
    (marker: string) => {
      const { start, end } = selection;
      Haptics.selectionAsync().catch(() => {});
      if (start === end) {
        const placeholder = 'texte';
        const next = body.slice(0, start) + marker + placeholder + marker + body.slice(end);
        setBody(next);
        const selStart = start + marker.length;
        setSelection({ start: selStart, end: selStart + placeholder.length });
      } else {
        const selected = body.slice(start, end);
        const next = body.slice(0, start) + marker + selected + marker + body.slice(end);
        setBody(next);
        setSelection({ start: start + marker.length, end: end + marker.length });
      }
    },
    [body, selection],
  );

  const AI_STYLES: Array<{ id: LoveNoteStyle; label: string; emoji: string; hint: string }> = [
    { id: 'normal', label: 'Normal', emoji: '✍️', hint: 'Corrige fautes + fluidifie' },
    { id: 'tendre', label: 'Tendre', emoji: '🫶', hint: 'Chaleureux et doux' },
    { id: 'poetique', label: 'Poétique', emoji: '🌸', hint: 'Images évocatrices' },
    { id: 'drole', label: 'Drôle', emoji: '😄', hint: 'Léger et taquin' },
    { id: 'encourageant', label: 'Encourageant', emoji: '💪', hint: 'Positif et motivant' },
    { id: 'concis', label: 'Concis', emoji: '✂️', hint: '1-2 phrases max' },
    { id: 'romantique', label: 'Romantique', emoji: '❤️', hint: 'Intense, partenaire' },
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
    setShowAiStyles(false);
    setSelection({ start: 0, end: 0 });
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
                <Pressable
                  onPress={handleDictateTap}
                  accessibilityRole="button"
                  accessibilityLabel={dictating ? 'Arrêter la dictée' : 'Dicter'}
                >
                  <Text style={{
                    color: dictating ? (colors.error ?? primary) : primary,
                    fontSize: FontSize.sm,
                    fontWeight: dictating ? '700' : '400',
                  }}>
                    {dictating ? '⏹ Arrêter' : '🎤 Dicter'}
                  </Text>
                </Pressable>
                {aiConfigured && (
                  <Pressable
                    onPress={handleImproveTap}
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
              <>
                {/* Toolbar markdown : gras / italique / barre */}
                <View style={styles.markdownToolbar}>
                  <Pressable
                    onPress={() => wrapSelection('**')}
                    style={[styles.mdBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                    accessibilityLabel="Gras"
                  >
                    <Text style={[styles.mdBtnTextBold, { color: colors.text }]}>B</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => wrapSelection('*')}
                    style={[styles.mdBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                    accessibilityLabel="Italique"
                  >
                    <Text style={[styles.mdBtnTextItalic, { color: colors.text }]}>I</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => wrapSelection('~~')}
                    style={[styles.mdBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                    accessibilityLabel="Barré"
                  >
                    <Text style={[styles.mdBtnTextStrike, { color: colors.text }]}>S</Text>
                  </Pressable>
                </View>
                <TextInput
                  multiline
                  value={body}
                  onChangeText={setBody}
                  selection={selection}
                  onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                  placeholder="Ton message…"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.textInput,
                    { color: colors.text, backgroundColor: colors.cardAlt, borderColor: colors.border },
                  ]}
                />
              </>
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

      {/* Popup choix du style IA */}
      <Modal
        visible={showAiStyles}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAiStyles(false)}
      >
        <Pressable style={styles.aiBackdrop} onPress={() => setShowAiStyles(false)}>
          <Pressable
            style={[styles.aiSheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.aiSheetTitle, { color: colors.text }]}>
              ✨ Choisis un style
            </Text>
            <Text style={[styles.aiSheetSub, { color: colors.textMuted }]}>
              Ton message sera reformulé en gardant l'intention. Envoyé anonymisé.
            </Text>
            {AI_STYLES.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => runImprove(s.id)}
                style={({ pressed }) => [
                  styles.aiOption,
                  {
                    backgroundColor: pressed ? colors.cardAlt : 'transparent',
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text style={styles.aiOptionEmoji}>{s.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aiOptionLabel, { color: colors.text }]}>
                    {s.label}
                  </Text>
                  <Text style={[styles.aiOptionHint, { color: colors.textMuted }]}>
                    {s.hint}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowAiStyles(false)}
              style={styles.aiCancel}
            >
              <Text style={[styles.aiCancelText, { color: primary }]}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  // ─── AI style popup ─────────────────────────────────────
  aiBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['3xl'],
  },
  aiSheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: Spacing['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  aiSheetTitle: {
    fontSize: FontSize.title,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  aiSheetSub: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xl,
    lineHeight: 18,
  },
  aiOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  aiOptionEmoji: {
    fontSize: 24,
  },
  aiOptionLabel: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
  aiOptionHint: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  aiCancel: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  aiCancelText: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
  markdownToolbar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  mdBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mdBtnTextBold: {
    fontSize: FontSize.body,
    fontWeight: '900',
  },
  mdBtnTextItalic: {
    fontSize: FontSize.body,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  mdBtnTextStrike: {
    fontSize: FontSize.body,
    textDecorationLine: 'line-through',
    fontWeight: '600',
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
