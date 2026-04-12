/**
 * VoiceRecorder.tsx — Composant d'enregistrement vocal (1-2 min) + upload ElevenLabs IVC.
 * Waveform réelle pilotée par le metering dB d'Audio.Recording (expo-av),
 * avec 40 barres qui défilent de droite à gauche au rythme du son.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Audio } from 'expo-av';
import { uploadVoiceClone } from '../../lib/voice-clone';
import { uploadVoiceCloneFish } from '../../lib/voice-clone-fish';
import { VOICE_CLONE_SCRIPT_FR, VOICE_CLONE_SCRIPT_EN } from '../../lib/stories';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── Constantes module-level ──────────────────────────────────────────────────

const BAR_COUNT = 40;
const BAR_WIDTH = 5;
const BAR_GAP = 3;
const BAR_MIN_H = 4;
const BAR_MAX_H = 48;
// Plage dB exploitable : -60 dB (quasi-silence) → 0 dB (saturation)
const METERING_FLOOR = -60;
const METERING_CEIL = 0;

// ─── LiveBar ──────────────────────────────────────────────────────────────────
// Lit sa hauteur dans un sharedValue tableau partagé par position.

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

export interface VoiceRecorderProps {
  /** Identifiant du profil — conserve pour coherence de signature (non utilise pour l'upload) */
  profileId: string;
  /** Nom affiche comme label de voix dans le service TTS */
  profileName: string;
  /** Callback appele a la fin de l'upload avec le voice_id et la source */
  onVoiceReady: (voiceId: string, source: 'elevenlabs-cloned' | 'fish-audio-cloned') => void;
  /** Cle API passee depuis le parent (pas de re-lecture SecureStore) */
  apiKey: string;
  /** Moteur de clonage — defaut 'elevenlabs' */
  cloneEngine?: 'elevenlabs' | 'fish-audio';
  /** Langue du script de lecture a afficher — defaut 'fr' */
  language?: 'fr' | 'en';
}

// ─── Options d'enregistrement avec metering activé ───────────────────────────

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

// ─── VoiceRecorder ───────────────────────────────────────────────────────────

function VoiceRecorder({ profileId: _profileId, profileName, onVoiceReady, apiKey, cloneEngine = 'elevenlabs', language = 'fr' }: VoiceRecorderProps) {
  const { primary, colors } = useThemeColors();
  const script = language === 'en' ? VOICE_CLONE_SCRIPT_EN : VOICE_CLONE_SCRIPT_FR;
  const instructionText = language === 'en'
    ? 'Read the text below in a natural voice, as if telling your child a bedtime story. About 1 to 2 minutes, in a quiet place.'
    : 'Lisez le texte ci-dessous à voix naturelle, comme si vous racontiez une histoire à votre enfant. Environ 1 à 2 minutes, dans un endroit calme.';
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SharedValue d'un tableau de BAR_COUNT valeurs normalisées (0-1)
  const amplitudes = useSharedValue<number[]>(new Array(BAR_COUNT).fill(0));

  // Réinitialise la waveform à l'état de repos
  const resetAmplitudes = useCallback(() => {
    amplitudes.value = new Array(BAR_COUNT).fill(0);
  }, [amplitudes]);

  // Callback appelé par Audio.Recording à chaque tick de metering.
  // On convertit les dB (-160..0) en valeur normalisée (0..1) et on shift
  // le tableau d'amplitudes à gauche en insérant la nouvelle valeur à droite.
  const onRecordingStatus = useCallback((s: Audio.RecordingStatus) => {
    if (!s.isRecording || s.metering == null) return;
    const clamped = Math.max(METERING_FLOOR, Math.min(METERING_CEIL, s.metering));
    const normalized = (clamped - METERING_FLOOR) / (METERING_CEIL - METERING_FLOOR);
    // Petit boost visuel — le metering ElevenLabs reste souvent bas
    const boosted = Math.min(1, Math.pow(normalized, 0.5) * 1.1);
    amplitudes.value = [...amplitudes.value.slice(1), boosted];
  }, [amplitudes]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const stopRecording = useCallback(async () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);

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

    // Restaurer le mode lecture audio
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
      const source = cloneEngine === 'fish-audio' ? 'fish-audio-cloned' as const : 'elevenlabs-cloned' as const;
      setStatus('done');
      onVoiceReady(voiceId, source);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de creer la voix.';
      Alert.alert('Erreur upload', msg);
      setStatus('idle');
    }
  }, [profileName, apiKey, cloneEngine, onVoiceReady, resetAmplitudes]);

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
      // Tick metering ~16/s — fréquence confortable pour la waveform
      recording.setProgressUpdateInterval(60);
      recording.setOnRecordingStatusUpdate(onRecordingStatus);
      await recording.startAsync();

      recordingRef.current = recording;
      setStatus('recording');
      setElapsed(0);
      resetAmplitudes();
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      autoStopRef.current = setTimeout(() => stopRecording(), 120_000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur micro', msg);
      setStatus('idle');
    }
  }, [stopRecording, onRecordingStatus, resetAmplitudes]);

  const handlePress = useCallback(() => {
    if (status === 'idle') startRecording();
    else if (status === 'recording') stopRecording();
  }, [status, startRecording, stopRecording]);

  // Formatage du timer m:ss
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timerLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const isDisabled = status === 'uploading' || status === 'done';
  const barColor = status === 'recording' ? primary : colors.border;

  return (
    <View style={styles.container}>
      {/* Consignes de lecture */}
      <Text style={[styles.instruction, { color: colors.textMuted }]}>
        {instructionText}
      </Text>

      {/* Script à lire — encadré défilable */}
      <ScrollView
        style={[styles.scriptBox, { backgroundColor: colors.card, borderColor: colors.border }]}
        contentContainerStyle={styles.scriptContent}
        showsVerticalScrollIndicator
      >
        <Text style={[styles.scriptText, { color: colors.text }]}>
          {script}
        </Text>
      </ScrollView>

      {/* Waveform : BAR_COUNT barres pilotées par le metering */}
      <View style={styles.waveformRow}>
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <LiveBar key={i} index={i} amplitudes={amplitudes} color={barColor} />
        ))}
      </View>

      {/* Timer — visible uniquement pendant l'enregistrement */}
      {(status === 'recording') && (
        <Text style={[styles.timer, { color: colors.text }]}>{timerLabel}</Text>
      )}

      {/* Zone de statut selon l'état */}
      {status === 'uploading' && (
        <View style={styles.uploadRow}>
          <ActivityIndicator color={primary} />
          <Text style={[styles.uploadText, { color: colors.textMuted }]}>
            Création de votre voix…
          </Text>
        </View>
      )}

      {status === 'done' && (
        <Text style={[styles.doneText, { color: primary }]}>
          ✓ Voix créée !
        </Text>
      )}

      {/* Bouton principal */}
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
            {status === 'idle' ? '🎤 Commencer' : '⏹ Arrêter'}
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
  },
});
