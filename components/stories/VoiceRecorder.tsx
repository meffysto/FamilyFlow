/**
 * VoiceRecorder.tsx — Composant d'enregistrement vocal (1-2 min) + upload ElevenLabs IVC.
 * Affiche 5 barres animées Reanimated pendant l'enregistrement, gère les états
 * idle → recording → uploading → done, et appelle onVoiceReady avec le voice_id cloné.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Audio } from 'expo-av';
import { uploadVoiceClone } from '../../lib/voice-clone';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── Constantes module-level ──────────────────────────────────────────────────

const SPRING_WAVE = { damping: 8, stiffness: 200 };
const BAR_HEIGHT = { min: 6, max: 28 };

// ─── RecordBar ────────────────────────────────────────────────────────────────

interface RecordBarProps {
  isActive: boolean;
  delay: number;
  color: string;
}

const RecordBar = React.memo(function RecordBar({ isActive, delay, color }: RecordBarProps) {
  const height = useSharedValue(BAR_HEIGHT.min);

  useEffect(() => {
    if (isActive) {
      height.value = withRepeat(
        withSequence(
          withTiming(BAR_HEIGHT.max, { duration: 400 + delay }),
          withTiming(BAR_HEIGHT.min, { duration: 400 + delay }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(height);
      height.value = withSpring(BAR_HEIGHT.min, SPRING_WAVE);
    }
  }, [isActive, delay, height]);

  const animStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[
        { width: 4, borderRadius: Radius.xxs, marginHorizontal: Spacing.xs, backgroundColor: color },
        animStyle,
      ]}
    />
  );
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VoiceRecorderProps {
  /** Identifiant du profil — conservé pour cohérence de signature (non utilisé pour l'upload) */
  profileId: string;
  /** Nom affiché comme label de voix dans ElevenLabs */
  profileName: string;
  /** Callback appelé à la fin de l'upload avec le voice_id et la source */
  onVoiceReady: (voiceId: string, source: 'elevenlabs-cloned') => void;
  /** Clé API ElevenLabs passée depuis le parent (pas de re-lecture SecureStore) */
  apiKey: string;
}

// ─── VoiceRecorder ───────────────────────────────────────────────────────────

function VoiceRecorder({ profileId: _profileId, profileName, onVoiceReady, apiKey }: VoiceRecorderProps) {
  const { primary, colors } = useThemeColors();
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const voiceId = await uploadVoiceClone(uri, profileName, apiKey);
      setStatus('done');
      onVoiceReady(voiceId, 'elevenlabs-cloned');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de créer la voix.';
      Alert.alert('Erreur upload', msg);
      setStatus('idle');
    }
  }, [profileName, apiKey, onVoiceReady]);

  const startRecording = useCallback(async () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);

    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', 'Autorisez l\'accès au micro dans Réglages.');
      return;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setStatus('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      autoStopRef.current = setTimeout(() => stopRecording(), 120_000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur micro', msg);
      setStatus('idle');
    }
  }, [stopRecording]);

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
      {/* Texte d'instruction */}
      <Text style={[styles.instruction, { color: colors.textMuted }]}>
        Lisez à voix haute pendant 1 à 2 minutes pour créer votre voix personnalisée.
      </Text>

      {/* Waveform : 5 barres animées */}
      <View style={styles.waveformRow}>
        {[0, 1, 2, 3, 4].map(i => (
          <RecordBar
            key={i}
            isActive={status === 'recording'}
            delay={i * 60}
            color={barColor}
          />
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
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT.max + Spacing.md,
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
