/**
 * DictaphoneRecorder.tsx — Enregistrement + transcription vocale pour les RDV médicaux
 *
 * Utilise expo-speech-recognition pour :
 * - Transcription en temps réel (on-device, gratuit)
 * - Enregistrement audio simultané (backup .wav)
 *
 * Après arrêt, propose de résumer via l'IA (Claude Haiku, anonymisé).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAI } from '../contexts/AIContext';
import { useVault } from '../contexts/VaultContext';
import { useToast } from '../contexts/ToastContext';
import { summarizeConsultation, summarizeTranscription, type VaultContext as AIVaultContext } from '../lib/ai-service';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';
import { ModalHeader } from './ui/ModalHeader';
import type { RDV } from '../lib/types';

/** Contexte générique pour le dictaphone hors-RDV */
interface DictaphoneContext {
  title: string;
  subtitle?: string;
}

interface DictaphoneRecorderProps {
  /** Contexte RDV (résumé médical structuré) */
  rdv?: RDV;
  /** Contexte générique (résumé libre) — ignoré si rdv est fourni */
  context?: DictaphoneContext;
  onResult: (text: string) => void;
  onClose: () => void;
}

type RecordingState = 'idle' | 'recording' | 'done' | 'summarizing';

export function DictaphoneRecorder({ rdv, context, onResult, onClose }: DictaphoneRecorderProps) {
  const { primary, tint, colors } = useThemeColors();
  const { config, isConfigured } = useAI();
  const vault = useVault();
  const { showToast } = useToast();

  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef('');
  const stoppingRef = useRef(false);

  // Animation pulsation pendant l'enregistrement
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const startPulse = useCallback(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 800 }),
        withTiming(1, { duration: 800 }),
      ),
      -1,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 800 }),
        withTiming(0.2, { duration: 800 }),
      ),
      -1,
    );
  }, []);

  const stopPulse = useCallback(() => {
    cancelAnimation(pulseScale);
    cancelAnimation(pulseOpacity);
    pulseScale.value = withTiming(1, { duration: 200 });
    pulseOpacity.value = withTiming(0, { duration: 200 });
  }, []);

  // ── Speech recognition events ──

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      // Append final segment to accumulated transcript
      transcriptRef.current = transcriptRef.current
        ? `${transcriptRef.current} ${text}`
        : text;
      setTranscript(transcriptRef.current);
    } else {
      // Show interim: accumulated + current partial
      const interim = transcriptRef.current
        ? `${transcriptRef.current} ${text}`
        : text;
      setTranscript(interim);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    // iOS peut stopper la reconnaissance après un silence — on la relance si on est encore en mode recording
    if (state === 'recording' && !stoppingRef.current) {
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
        // Si on ne peut pas relancer, on passe en mode done
        finishRecording();
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech' && state === 'recording') {
      // Pas de parole détectée — on relance silencieusement
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
        // Ignore
      }
      return;
    }
    if (event.error !== 'aborted') {
      showToast(`Erreur reconnaissance : ${event.message}`, 'error');
    }
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    setVolume(Math.max(0, Math.min(1, (event.value + 2) / 12)));
  });

  // ── Timer ──

  useEffect(() => {
    if (state === 'recording') {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  // ── Actions ──

  const startRecording = useCallback(async () => {
    try {
      const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissions.granted) {
        Alert.alert(
          'Permissions requises',
          'Autorisez le micro et la reconnaissance vocale dans les réglages.',
        );
        return;
      }

      transcriptRef.current = '';
      stoppingRef.current = false;
      setTranscript('');
      setDuration(0);
      setState('recording');
      startPulse();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      ExpoSpeechRecognitionModule.start({
        lang: 'fr-FR',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        volumeChangeEventOptions: { enabled: true, intervalMillis: 300 },
      });
    } catch (e: any) {
      showToast(`Erreur : ${e?.message ?? String(e)}`, 'error');
      setState('idle');
    }
  }, [startPulse, showToast]);

  const finishRecording = useCallback(() => {
    stoppingRef.current = true;
    setState('done');
    stopPulse();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // déjà arrêté
    }

    // Utiliser le transcript affiché (inclut les résultats intérimaires)
    // plutôt que transcriptRef qui ne contient que les segments finalisés
    setTranscript((current) => {
      const finalText = current || transcriptRef.current;
      setEditedTranscript(finalText);
      return finalText;
    });
  }, [stopPulse]);

  const stopRecording = useCallback(() => {
    finishRecording();
  }, [finishRecording]);

  const handleSummarize = useCallback(async () => {
    if (!config) {
      showToast('IA non configurée — ajoutez votre clé API dans les réglages', 'error');
      return;
    }

    setState('summarizing');

    const vaultCtx: AIVaultContext = {
      tasks: vault.tasks,
      menageTasks: vault.menageTasks,
      rdvs: vault.rdvs,
      stock: vault.stock,
      meals: vault.meals,
      courses: vault.courses,
      memories: vault.memories,
      defis: vault.defis,
      wishlistItems: vault.wishlistItems,
      recipes: vault.recipes,
      profiles: vault.profiles,
      activeProfile: vault.activeProfile,
    };

    const resp = rdv
      ? await summarizeConsultation(config, editedTranscript, rdv, vaultCtx)
      : await summarizeTranscription(config, editedTranscript, context?.title, vaultCtx);

    if (resp.error) {
      showToast(resp.error, 'error');
      setState('done');
      return;
    }

    setSummary(resp.text);
    setState('done');
  }, [config, editedTranscript, rdv, context, vault, showToast]);

  const handleUseText = useCallback((text: string) => {
    onResult(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }, [onResult, onClose]);

  const handleClose = useCallback(() => {
    // Sauvegarder le texte transcrit avant de fermer (résumé prioritaire, sinon transcription)
    const textToSave = summary.trim() || editedTranscript.trim();
    if (textToSave) {
      onResult(textToSave);
    }
    onClose();
  }, [summary, editedTranscript, onResult, onClose]);

  // ── Helpers ──

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
    };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]}>
      <ModalHeader
        title="Dictaphone"
        onClose={handleClose}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Info contexte */}
        {(rdv || context) && (
          <View style={[styles.rdvInfo, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
            <Text style={[styles.rdvInfoTitle, { color: colors.text }]}>
              {rdv ? `${rdv.type_rdv} — ${rdv.enfant}` : context!.title}
            </Text>
            {rdv ? (
              <Text style={[styles.rdvInfoSub, { color: colors.textMuted }]}>
                {rdv.médecin ? `Dr. ${rdv.médecin}` : 'Médecin non renseigné'}
              </Text>
            ) : context?.subtitle ? (
              <Text style={[styles.rdvInfoSub, { color: colors.textMuted }]}>
                {context.subtitle}
              </Text>
            ) : null}
          </View>
        )}

        {/* Zone enregistrement */}
        {state === 'idle' && (
          <View style={styles.idleContainer}>
            <Text style={[styles.instructions, { color: colors.textSub }]}>
              {rdv
                ? 'Appuyez sur le micro pour enregistrer les réponses du médecin.'
                : 'Appuyez sur le micro pour dicter votre texte.'}
              {' '}La transcription se fait en temps réel, sur votre appareil.
            </Text>
            <TouchableOpacity
              style={[styles.recordBtn, { backgroundColor: colors.error }]}
              onPress={startRecording}
              activeOpacity={0.8}
              accessibilityLabel="Démarrer l'enregistrement"
              accessibilityRole="button"
            >
              <Text style={styles.recordBtnIcon}>🎙️</Text>
              <Text style={[styles.recordBtnText, { color: colors.onPrimary }]}>
                Commencer l'enregistrement
              </Text>
            </TouchableOpacity>
            <Text style={[styles.privacyNote, { color: colors.textFaint }]}>
              🔒 Transcription 100% locale — aucune donnée audio ne quitte votre appareil
            </Text>
          </View>
        )}

        {state === 'recording' && (
          <View style={styles.recordingContainer}>
            {/* Visualisation */}
            <View style={styles.recordingVisual}>
              <Animated.View
                style={[
                  styles.pulseBg,
                  { backgroundColor: colors.error },
                  pulseStyle,
                ]}
              />
              <View style={[styles.recordDot, { backgroundColor: colors.error }]}>
                <Text style={styles.recordDotIcon}>🎙️</Text>
              </View>
            </View>

            <Text style={[styles.recordingTime, { color: colors.error }]}>
              {formatDuration(duration)}
            </Text>

            {/* Barre volume */}
            <View style={[styles.volumeBar, { backgroundColor: colors.inputBg }]}>
              <View
                style={[
                  styles.volumeFill,
                  { backgroundColor: colors.error, width: `${Math.max(5, volume * 100)}%` },
                ]}
              />
            </View>

            {/* Transcription live */}
            <View style={[styles.liveTranscript, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
              <Text style={[styles.liveLabel, { color: colors.textMuted }]}>
                Transcription en cours...
              </Text>
              <Text style={[styles.liveText, { color: colors.text }]}>
                {transcript || 'En attente de parole...'}
              </Text>
            </View>

            {/* Bouton stop */}
            <TouchableOpacity
              style={[styles.stopBtn, { backgroundColor: colors.card, borderColor: colors.error }]}
              onPress={stopRecording}
              activeOpacity={0.8}
              accessibilityLabel="Arrêter l'enregistrement"
              accessibilityRole="button"
            >
              <View style={[styles.stopIcon, { backgroundColor: colors.error }]} />
              <Text style={[styles.stopBtnText, { color: colors.error }]}>
                Arrêter
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {(state === 'done' || state === 'summarizing') && (
          <View style={styles.doneContainer}>
            {/* Durée */}
            <View style={[styles.doneHeader, { backgroundColor: colors.successBg }]}>
              <Text style={[styles.doneHeaderText, { color: colors.successText }]}>
                Enregistrement terminé — {formatDuration(duration)}
              </Text>
            </View>

            {/* Transcription éditable */}
            <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
              Transcription
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              Vous pouvez corriger le texte avant de le résumer.
            </Text>
            <TextInput
              style={[
                styles.transcriptInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              value={editedTranscript}
              onChangeText={setEditedTranscript}
              multiline
              textAlignVertical="top"
              placeholder="Transcription vide..."
              placeholderTextColor={colors.textFaint}
            />

            {/* Résumé IA */}
            {summary ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSub }]}>
                  Résumé IA
                </Text>
                <View style={[styles.summaryBlock, { backgroundColor: colors.infoBg, borderColor: colors.info }]}>
                  <Text style={[styles.summaryText, { color: colors.text }]}>
                    {summary}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: primary }]}
                  onPress={() => handleUseText(summary)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>
                    Utiliser le résumé
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {/* Actions */}
            <View style={styles.actionsRow}>
              {isConfigured && !summary && (
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: primary, flex: 1 },
                    state === 'summarizing' && { opacity: 0.6 },
                  ]}
                  onPress={handleSummarize}
                  disabled={state === 'summarizing' || !editedTranscript.trim()}
                  activeOpacity={0.8}
                >
                  {state === 'summarizing' ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>
                      Résumer avec l'IA
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
                onPress={() => handleUseText(editedTranscript)}
                disabled={!editedTranscript.trim()}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionBtnText, { color: colors.text }]}>
                  Utiliser le texte brut
                </Text>
              </TouchableOpacity>
            </View>

            {summary ? (
              <Text style={[styles.privacyNote, { color: colors.textFaint }]}>
                Ce résumé est généré par IA à titre informatif uniquement et ne constitue pas un avis médical.
              </Text>
            ) : !isConfigured ? (
              <Text style={[styles.privacyNote, { color: colors.textFaint }]}>
                Ajoutez une clé API Claude dans les réglages pour activer le résumé IA.
              </Text>
            ) : null}

            {/* Recommencer */}
            <TouchableOpacity
              style={styles.restartBtn}
              onPress={() => {
                setState('idle');
                setTranscript('');
                setEditedTranscript('');
                setSummary('');
                setDuration(0);
                transcriptRef.current = '';
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.restartBtnText, { color: colors.textMuted }]}>
                Recommencer l'enregistrement
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing['3xl'], gap: Spacing['2xl'], paddingBottom: 60 },

  rdvInfo: {
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  rdvInfoTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  rdvInfoSub: {
    fontSize: FontSize.label,
    marginTop: Spacing.xs,
  },

  // ── Idle ──
  idleContainer: {
    alignItems: 'center',
    gap: Spacing['3xl'],
    paddingTop: Spacing['4xl'],
  },
  instructions: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
    textAlign: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing['4xl'],
    borderRadius: Radius.full,
  },
  recordBtnIcon: {
    fontSize: FontSize.display,
  },
  recordBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  privacyNote: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    lineHeight: LineHeight.tight,
  },

  // ── Recording ──
  recordingContainer: {
    alignItems: 'center',
    gap: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
  },
  recordingVisual: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseBg: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  recordDot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordDotIcon: {
    fontSize: 36,
  },
  recordingTime: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'],
  },
  volumeBar: {
    width: '80%',
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  liveTranscript: {
    width: '100%',
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
    minHeight: 100,
  },
  liveLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.md,
  },
  liveText: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing['4xl'],
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  stopIcon: {
    width: 20,
    height: 20,
    borderRadius: Radius.xs,
  },
  stopBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },

  // ── Done ──
  doneContainer: {
    gap: Spacing['2xl'],
  },
  doneHeader: {
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  doneHeaderText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  sectionLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  sectionHint: {
    fontSize: FontSize.caption,
    marginTop: -Spacing.md,
  },
  transcriptInput: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
    minHeight: 150,
  },
  summaryBlock: {
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  actionBtn: {
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing['3xl'],
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  actionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  restartBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.xl,
  },
  restartBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
