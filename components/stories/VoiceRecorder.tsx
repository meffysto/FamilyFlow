/**
 * VoiceRecorder.tsx — Composant d'enregistrement vocal avec deux modes :
 *  - 'instant' (IVC) : 1 prise de 1-2 min, upload immédiat → voice_id (compat existante)
 *  - 'professional' (PVC) : multi-prises de ≥30s chacune, training asynchrone (~3-4h)
 *
 * Waveform réelle pilotée par le metering dB d'Audio.Recording (expo-av),
 * avec 40 barres qui défilent de droite à gauche au rythme du son.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Audio } from 'expo-av';
import { uploadVoiceClone } from '../../lib/voice-clone';
import { uploadVoiceCloneFish } from '../../lib/voice-clone-fish';
import {
  createPvcVoice,
  addPvcSamples,
  triggerPvcTraining,
} from '../../lib/voice-clone-pro';
import {
  VOICE_CLONE_SCRIPT_FR,
  VOICE_CLONE_SCRIPT_EN,
  VOICE_CLONE_SCRIPT_FR_PRO,
  VOICE_CLONE_SCRIPT_EN_PRO,
} from '../../lib/stories';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── Constantes module-level ──────────────────────────────────────────────────

const BAR_COUNT = 40;
const BAR_WIDTH = 5;
const BAR_GAP = 3;
const BAR_MIN_H = 4;
const BAR_MAX_H = 48;
const METERING_FLOOR = -60;
const METERING_CEIL = 0;

// IVC : auto-stop à 2 min. PVC : auto-stop à 5 min par prise (l'utilisateur cumule plusieurs prises).
const IVC_AUTO_STOP_MS = 120_000;
const PVC_AUTO_STOP_MS = 300_000;
const PVC_MIN_SAMPLE_SECS = 30;
// Seuil minimal pour autoriser le training PVC : 15 min cumulées.
// En dessous, ElevenLabs accepte la requête mais produit une voix de qualité médiocre.
const PVC_MINIMUM_TOTAL_SECS = 900;
// Seuil recommandé pour un PVC de qualité : 30 min (recommandation officielle ElevenLabs).
// Idéal : 1h+. La voix sera nettement plus fidèle au-delà de 30 min.
const PVC_RECOMMENDED_TOTAL_SECS = 1800;

// ─── LiveBar ──────────────────────────────────────────────────────────────────

interface LiveBarProps {
  index: number;
  amplitudes: SharedValue<number[]>;
  color: string;
}

const LiveBar = React.memo(function LiveBar({ index, amplitudes, color }: LiveBarProps) {
  const animStyle = useAnimatedStyle(() => {
    const v = amplitudes.value[index] ?? 0;
    return {
      height: BAR_MIN_H + (BAR_MAX_H - BAR_MIN_H) * v,
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: BAR_WIDTH,
          marginHorizontal: BAR_GAP / 2,
          borderRadius: BAR_WIDTH / 2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
});

// ─── Props ────────────────────────────────────────────────────────────────────

export type VoiceCloneSource =
  | 'elevenlabs-cloned'
  | 'fish-audio-cloned'
  | 'elevenlabs-cloned-pro';

export interface VoiceRecorderProps {
  profileId: string;
  profileName: string;
  /**
   * Callback de fin :
   *  - IVC : déclenché immédiatement après upload, voiceId utilisable.
   *  - PVC : déclenché après triggerPvcTraining ; voiceId NON utilisable tant que
   *          le training n'est pas terminé (~3-4h). status='training' à ce moment.
   */
  onVoiceReady: (
    voiceId: string,
    source: VoiceCloneSource,
    status: 'ready' | 'training',
  ) => void;
  apiKey: string;
  cloneEngine?: 'elevenlabs' | 'fish-audio';
  language?: 'fr' | 'en';
  /** 'instant' (défaut, comportement actuel) ou 'professional' (multi-prises + training). */
  cloneType?: 'instant' | 'professional';
}

// ─── Options d'enregistrement avec metering activé ───────────────────────────

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

// ─── VoiceRecorder ───────────────────────────────────────────────────────────

interface PvcTake {
  uri: string;
  durationSecs: number;
  sampleId?: string; // rempli après upload effectif
}

function VoiceRecorder({
  profileId: _profileId,
  profileName,
  onVoiceReady,
  apiKey,
  cloneEngine = 'elevenlabs',
  language = 'fr',
  cloneType = 'instant',
}: VoiceRecorderProps) {
  const { primary, colors } = useThemeColors();
  const isPvc = cloneType === 'professional';

  const script = isPvc
    ? (language === 'en' ? VOICE_CLONE_SCRIPT_EN_PRO : VOICE_CLONE_SCRIPT_FR_PRO)
    : (language === 'en' ? VOICE_CLONE_SCRIPT_EN : VOICE_CLONE_SCRIPT_FR);

  const instructionText = isPvc
    ? (language === 'en'
        ? 'Pro cloning: record several takes (≥30s each) varying tone — calm, joyful, whispered, dialogue. Aim for 5+ minutes total. Training takes ~3-4 hours after you finish.'
        : 'Clonage Pro : faites plusieurs prises (≥30s chacune) en variant le ton — calme, joyeux, chuchoté, dialogue. Visez 30 min au total pour une voix fidèle (15 min minimum, 1h idéal). L\'entraînement prend ~3-4h après validation.')
    : (language === 'en'
        ? 'Read the text below in a natural voice, as if telling your child a bedtime story. About 1 to 2 minutes, in a quiet place.'
        : 'Lisez le texte ci-dessous à voix naturelle, comme si vous racontiez une histoire à votre enfant. Environ 1 à 2 minutes, dans un endroit calme.');

  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'training' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  // PVC : voice_id créé au 1er sample, conservé pour les suivants
  const [pvcVoiceId, setPvcVoiceId] = useState<string | null>(null);
  const [pvcTakes, setPvcTakes] = useState<PvcTake[]>([]);
  // PVC option C : mode "lecture libre" (pas de script imposé) — utile pour les longues sessions
  const [pvcFreeReading, setPvcFreeReading] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const amplitudes = useSharedValue<number[]>(new Array(BAR_COUNT).fill(0));

  const resetAmplitudes = useCallback(() => {
    amplitudes.value = new Array(BAR_COUNT).fill(0);
  }, [amplitudes]);

  const onRecordingStatus = useCallback((s: Audio.RecordingStatus) => {
    if (!s.isRecording || s.metering == null) return;
    const clamped = Math.max(METERING_FLOOR, Math.min(METERING_CEIL, s.metering));
    const normalized = (clamped - METERING_FLOOR) / (METERING_CEIL - METERING_FLOOR);
    const boosted = Math.min(1, Math.pow(normalized, 0.5) * 1.1);
    amplitudes.value = [...amplitudes.value.slice(1), boosted];
  }, [amplitudes]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  // ── IVC : flow original (1 prise → upload → done) ────────────────────────
  const stopRecordingIvc = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }

    try {
      await recordingRef.current?.stopAndUnloadAsync();
    } catch (e) {
      if (__DEV__) console.warn('VoiceRecorder: stopAndUnloadAsync failed:', e);
    }

    const uri = recordingRef.current?.getURI();
    resetAmplitudes();

    if (!uri) {
      Alert.alert('Erreur', 'Enregistrement introuvable.');
      setStatus('idle');
      return;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    } catch (e) {
      if (__DEV__) console.warn('VoiceRecorder: restauration mode audio failed:', e);
    }

    setStatus('uploading');
    try {
      const voiceId = cloneEngine === 'fish-audio'
        ? await uploadVoiceCloneFish(uri, profileName, apiKey)
        : await uploadVoiceClone(uri, profileName, apiKey);
      const source: VoiceCloneSource = cloneEngine === 'fish-audio'
        ? 'fish-audio-cloned'
        : 'elevenlabs-cloned';
      setStatus('done');
      onVoiceReady(voiceId, source, 'ready');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de creer la voix.';
      Alert.alert('Erreur upload', msg);
      setStatus('idle');
    }
  }, [profileName, apiKey, cloneEngine, onVoiceReady, resetAmplitudes]);

  // ── PVC : stop d'une prise → upload sample → reste en mode "ajout" ─────────
  const stopRecordingPvc = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }

    const elapsedSecs = elapsed;
    try {
      await recordingRef.current?.stopAndUnloadAsync();
    } catch (e) {
      if (__DEV__) console.warn('VoiceRecorder: stopAndUnloadAsync failed:', e);
    }

    const uri = recordingRef.current?.getURI();
    resetAmplitudes();

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    } catch (e) {
      if (__DEV__) console.warn('VoiceRecorder: restauration mode audio failed:', e);
    }

    if (!uri) {
      Alert.alert('Erreur', 'Enregistrement introuvable.');
      setStatus('idle');
      return;
    }

    if (elapsedSecs < PVC_MIN_SAMPLE_SECS) {
      Alert.alert(
        'Prise trop courte',
        `Chaque enregistrement doit durer au moins ${PVC_MIN_SAMPLE_SECS} secondes pour le clonage Pro. Recommencez la prise.`,
      );
      setStatus('idle');
      return;
    }

    setStatus('uploading');
    try {
      // Crée la voix au premier sample, sinon réutilise le voice_id existant
      let voiceId = pvcVoiceId;
      if (!voiceId) {
        voiceId = await createPvcVoice(apiKey, profileName, language);
        setPvcVoiceId(voiceId);
      }
      const uploaded = await addPvcSamples(apiKey, voiceId, [uri]);
      const sampleId = uploaded[0]?.sampleId;
      const durationSecs = uploaded[0]?.durationSecs ?? elapsedSecs;
      setPvcTakes(prev => [...prev, { uri, durationSecs, sampleId }]);
      setStatus('idle');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible d\'ajouter cette prise.';
      Alert.alert('Erreur upload', msg);
      setStatus('idle');
    }
  }, [elapsed, pvcVoiceId, apiKey, profileName, language, resetAmplitudes]);

  const stopRecording = useCallback(async () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
    if (isPvc) await stopRecordingPvc();
    else await stopRecordingIvc();
  }, [isPvc, stopRecordingIvc, stopRecordingPvc]);

  const startRecording = useCallback(async () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);

    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', 'Autorisez l\'accès au micro dans Réglages.');
      return;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      recording.setProgressUpdateInterval(60);
      recording.setOnRecordingStatusUpdate(onRecordingStatus);
      await recording.startAsync();

      recordingRef.current = recording;
      setStatus('recording');
      setElapsed(0);
      resetAmplitudes();
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      autoStopRef.current = setTimeout(
        () => stopRecording(),
        isPvc ? PVC_AUTO_STOP_MS : IVC_AUTO_STOP_MS,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur micro', msg);
      setStatus('idle');
    }
  }, [stopRecording, onRecordingStatus, resetAmplitudes, isPvc]);

  // PVC : valider → déclencher training
  const finishPvc = useCallback(async () => {
    if (!pvcVoiceId) return;
    setStatus('training');
    try {
      await triggerPvcTraining(apiKey, pvcVoiceId);
      onVoiceReady(pvcVoiceId, 'elevenlabs-cloned-pro', 'training');
      setStatus('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de lancer l\'entraînement.';
      Alert.alert('Erreur entraînement', msg);
      setStatus('idle');
    }
  }, [pvcVoiceId, apiKey, onVoiceReady]);

  const handlePress = useCallback(() => {
    if (status === 'idle') startRecording();
    else if (status === 'recording') stopRecording();
  }, [status, startRecording, stopRecording]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timerLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const isDisabled = status === 'uploading' || status === 'training' || status === 'done';
  const barColor = status === 'recording' ? primary : colors.border;

  // PVC stats
  const pvcTotalSecs = pvcTakes.reduce((sum, t) => sum + t.durationSecs, 0);
  const pvcTotalMin = Math.floor(pvcTotalSecs / 60);
  const pvcTotalSec = Math.floor(pvcTotalSecs % 60);
  // Le training n'est autorisé qu'à partir de 15 min cumulées (sinon voix de mauvaise qualité).
  const pvcReadyToTrain = pvcTakes.length > 0 && pvcTotalSecs >= PVC_MINIMUM_TOTAL_SECS;
  const pvcRecommendedReached = pvcTotalSecs >= PVC_RECOMMENDED_TOTAL_SECS;
  const pvcMinutesLeft = Math.max(0, Math.ceil((PVC_MINIMUM_TOTAL_SECS - pvcTotalSecs) / 60));

  return (
    <View style={styles.container}>
      <Text style={[styles.instruction, { color: colors.textMuted }]}>
        {instructionText}
      </Text>

      {/* PVC : toggle script vs lecture libre — caché pour IVC */}
      {isPvc && status === 'idle' && (
        <View style={styles.modeToggleRow}>
          <Pressable
            style={[
              styles.modeToggleChip,
              {
                backgroundColor: !pvcFreeReading ? primary : colors.card,
                borderColor: !pvcFreeReading ? primary : colors.border,
              },
            ]}
            onPress={() => setPvcFreeReading(false)}
          >
            <Text style={[styles.modeToggleText, { color: !pvcFreeReading ? '#fff' : colors.text }]}>
              📖 Suivre le script
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeToggleChip,
              {
                backgroundColor: pvcFreeReading ? primary : colors.card,
                borderColor: pvcFreeReading ? primary : colors.border,
              },
            ]}
            onPress={() => setPvcFreeReading(true)}
          >
            <Text style={[styles.modeToggleText, { color: pvcFreeReading ? '#fff' : colors.text }]}>
              🎙 Lecture libre
            </Text>
          </Pressable>
        </View>
      )}

      {/* Script ou consignes lecture libre */}
      {(!isPvc || !pvcFreeReading) ? (
        <ScrollView
          style={[styles.scriptBox, { backgroundColor: colors.card, borderColor: colors.border }]}
          contentContainerStyle={styles.scriptContent}
          showsVerticalScrollIndicator
        >
          <Text style={[styles.scriptText, { color: colors.text }]}>
            {script}
          </Text>
        </ScrollView>
      ) : (
        <View style={[styles.scriptBox, styles.freeReadingBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.freeReadingTitle, { color: colors.text }]}>
            🎙 Lecture libre
          </Text>
          <Text style={[styles.freeReadingText, { color: colors.textMuted }]}>
            {language === 'en'
              ? 'Read anything you like — a favorite book, a story you remember, even improvise. Vary your tone across takes:'
              : 'Lis ce que tu veux — un livre que tu aimes, une histoire que tu connais par cœur, ou improvise. Varie le ton entre les prises :'}
          </Text>
          <Text style={[styles.freeReadingText, { color: colors.textMuted }]}>
            {language === 'en'
              ? '• Calm reading — like bedtime\n• Joyful, with exclamations\n• Whispered, like a secret\n• Dialogues with different character voices\n• Suspense, with pauses\n\nEach take must be at least 30 seconds. Aim for 5+ minutes total across multiple takes.'
              : '• Lecture calme — comme au coucher\n• Joyeuse, avec des exclamations\n• Chuchotée, comme un secret\n• Dialogues avec voix de personnages différents\n• Suspense, avec des pauses\n\nChaque prise doit durer au moins 30 secondes. Vise 30 min au total pour une voix vraiment fidèle (1h idéal). 15 min minimum.'}
          </Text>
        </View>
      )}

      <View style={styles.waveformRow}>
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <LiveBar key={i} index={i} amplitudes={amplitudes} color={barColor} />
        ))}
      </View>

      {(status === 'recording') && (
        <Text style={[styles.timer, { color: colors.text }]}>{timerLabel}</Text>
      )}

      {/* PVC : récap des prises accumulées */}
      {isPvc && pvcTakes.length > 0 && status !== 'done' && (
        <View style={[styles.pvcRecap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.pvcRecapTitle, { color: colors.text }]}>
            {pvcTakes.length} prise{pvcTakes.length > 1 ? 's' : ''} — {pvcTotalMin}:{pvcTotalSec.toString().padStart(2, '0')} au total
          </Text>
          <Text style={[styles.pvcRecapSub, { color: colors.textMuted }]}>
            {pvcRecommendedReached
              ? '✓ 30 min recommandées atteintes — voix de très bonne qualité. Tu peux continuer pour 1h+ (idéal) ou lancer l\'entraînement.'
              : pvcReadyToTrain
                ? `⚠️ Minimum atteint mais qualité limitée. Continue jusqu'à 30 min pour une voix vraiment fidèle (encore ${Math.max(0, Math.ceil((PVC_RECOMMENDED_TOTAL_SECS - pvcTotalSecs) / 60))} min).`
                : `Encore ${pvcMinutesLeft} min minimum avant de pouvoir lancer (qualité ElevenLabs requiert 15 min mini, 30 min recommandés).`}
          </Text>
        </View>
      )}

      {status === 'uploading' && (
        <View style={styles.uploadRow}>
          <ActivityIndicator color={primary} />
          <Text style={[styles.uploadText, { color: colors.textMuted }]}>
            {isPvc ? 'Envoi de la prise…' : 'Création de votre voix…'}
          </Text>
        </View>
      )}

      {status === 'training' && (
        <View style={styles.uploadRow}>
          <ActivityIndicator color={primary} />
          <Text style={[styles.uploadText, { color: colors.textMuted }]}>
            Lancement de l'entraînement…
          </Text>
        </View>
      )}

      {status === 'done' && (
        <Text style={[styles.doneText, { color: primary }]}>
          {isPvc ? '✓ Entraînement lancé ! La voix sera prête dans ~3-4h.' : '✓ Voix créée !'}
        </Text>
      )}

      {/* Bouton principal d'enregistrement */}
      {(status === 'idle' || status === 'recording') && (
        <Pressable
          onPress={handlePress}
          disabled={isDisabled}
          style={[
            styles.button,
            { backgroundColor: status === 'recording' ? colors.error ?? primary : primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel={status === 'idle' ? 'Commencer l\'enregistrement' : 'Arrêter l\'enregistrement'}
        >
          <Text style={styles.buttonText}>
            {status === 'idle'
              ? (isPvc && pvcTakes.length > 0 ? '🎤 Ajouter une prise' : '🎤 Commencer')
              : '⏹ Arrêter'}
          </Text>
        </Pressable>
      )}

      {/* PVC : bouton "Lancer l'entraînement" (apparaît dès qu'on a au moins 1 prise valide) */}
      {isPvc && status === 'idle' && pvcReadyToTrain && (
        <Pressable
          onPress={finishPvc}
          style={[styles.button, { backgroundColor: colors.success ?? primary, marginTop: Spacing.md }]}
          accessibilityRole="button"
          accessibilityLabel="Lancer l'entraînement"
        >
          <Text style={styles.buttonText}>
            {pvcRecommendedReached ? '✨ Lancer l\'entraînement' : '⚡ Lancer (qualité limitée)'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default React.memo(VoiceRecorder);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: Spacing['4xl'],
    alignItems: 'center',
    gap: Spacing['2xl'],
  },
  instruction: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  scriptBox: {
    width: '100%',
    maxHeight: 260,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  scriptContent: {
    padding: Spacing['2xl'],
  },
  scriptText: {
    fontSize: FontSize.body,
    lineHeight: 26,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_MAX_H + Spacing.md,
  },
  timer: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  uploadText: {
    fontSize: FontSize.sm,
  },
  doneText: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: Spacing['4xl'],
    paddingVertical: Spacing['2xl'],
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: '#fff',
    textAlign: 'center',
  },
  pvcRecap: {
    width: '100%',
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  pvcRecapTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  pvcRecapSub: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modeToggleChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeToggleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  freeReadingBox: {
    padding: Spacing['2xl'],
    gap: Spacing.lg,
  },
  freeReadingTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  freeReadingText: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
});
