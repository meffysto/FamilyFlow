import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { useVault } from '../../contexts/VaultContext';
import VoiceRecorder from './VoiceRecorder';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withSpring, cancelAnimation, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import type { BedtimeStory, StoryReadingSpeed, StoryVoiceConfig, Profile } from '../../lib/types';
import { useThemeColors } from '../../contexts/ThemeContext';
import { generateSpeech } from '../../lib/elevenlabs';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

// ─── iOS 26 fix : activer AVAudioSession avant AVSpeechSynthesizer ────────────
// Sur iOS 17+, le synthétiseur vocal nécessite que la session audio soit
// explicitement activée (setActive:true), ce que seul un vrai appel expo-av fait.
// On génère un WAV silence de 100ms en mémoire et on le joue une fois au montage.

async function primeAudioSession(): Promise<void> {
  try {
    const N = 800; // 0.1s à 8kHz
    const hdr = new Uint8Array(44);
    const dv = new DataView(hdr.buffer);
    const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + N, true);
    str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); // PCM, mono
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); // 8kHz
    dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); // 8-bit
    str(36, 'data'); dv.setUint32(40, N, true);

    const wav = new Uint8Array(44 + N);
    wav.set(hdr);
    wav.fill(0x80, 44); // 0x80 = silence PCM 8-bit non signé

    let bin = '';
    for (let i = 0; i < wav.length; i++) bin += String.fromCharCode(wav[i]);

    const uri = `${FileSystem.cacheDirectory}story_prime.wav`;
    await FileSystem.writeAsStringAsync(uri, btoa(bin), { encoding: FileSystem.EncodingType.Base64 });

    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 0.001 });
    await new Promise<void>(r => setTimeout(r, 250));
    await sound.unloadAsync();
  } catch (e) {
    if (__DEV__) console.warn('primeAudioSession failed:', e);
  }
}

// ─── WaveBar ────────────────────────────────────────────────────────────────

const MIN_H = 4;
const MAX_H = 32;

interface WaveBarProps {
  isPlaying: boolean;
  peak: number;
  delay: number;
  color: string;
}

const WaveBar = React.memo(function WaveBar({ isPlaying, peak, delay, color }: WaveBarProps) {
  const height = useSharedValue(MIN_H);

  useEffect(() => {
    if (isPlaying) {
      height.value = withRepeat(
        withSequence(
          withTiming(peak, { duration: 300 + delay, easing: Easing.inOut(Easing.ease) }),
          withTiming(MIN_H, { duration: 300 + delay, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(height);
      height.value = withSpring(MIN_H, { damping: 10, stiffness: 200 });
    }
  }, [isPlaying, peak, delay, height]);

  const animStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[
        { width: 3, borderRadius: 2, marginHorizontal: 2, backgroundColor: color },
        animStyle,
      ]}
    />
  );
});

// ─── Peaks pré-calculées (organique via sin) ──────────────────────────────────

const BAR_COUNT = 20;
const PEAKS = Array.from({ length: BAR_COUNT }, (_, i) =>
  Math.round(MIN_H + (MAX_H - MIN_H) * (0.3 + 0.7 * Math.abs(Math.sin(i * 0.75 + 0.5))))
);

// ─── StoryPlayer ─────────────────────────────────────────────────────────────

interface Props {
  histoire: BedtimeStory;
  voiceConfig: StoryVoiceConfig;
  elevenLabsKey: string;
  onFinish: () => void;
}


function StoryPlayer({ histoire, voiceConfig, elevenLabsKey, onFinish }: Props) {
  const { primary, colors } = useThemeColors();
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<StoryReadingSpeed>(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const soundRef = useRef<any>(null);

  // ─── Sélecteur voix parent ────────────────────────────────────────────────
  const { profiles, updateProfile } = useVault();
  const adultProfiles = React.useMemo(
    () => profiles.filter((p: Profile) => p.role === 'adulte'),
    [profiles],
  );
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [recorderProfileId, setRecorderProfileId] = useState<string | null>(null);

  // Override session-only : remplace voiceConfig quand un parent avec voix est sélectionné
  const effectiveVoiceConfig = React.useMemo<StoryVoiceConfig>(() => {
    if (!selectedParentId) return voiceConfig;
    const parent = adultProfiles.find((p: Profile) => p.id === selectedParentId);
    if (!parent) return voiceConfig;
    if (parent.voiceElevenLabsId) {
      return { engine: 'elevenlabs', language: 'fr', elevenLabsVoiceId: parent.voiceElevenLabsId };
    }
    if (parent.voiceSource === 'ios-personal' && parent.voicePersonalId) {
      // Le support iOS Personal Voice via identifier explicite sera finalisé ultérieurement
      return { engine: 'expo-speech', language: 'fr' };
    }
    return voiceConfig;
  }, [selectedParentId, adultProfiles, voiceConfig]);

  useEffect(() => {
    // Configurer ET activer AVAudioSession dès le montage (iOS 26 fix)
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    }).then(() => primeAudioSession()).catch((e) => {
      if (__DEV__) console.warn('StoryPlayer: audio prime failed', e);
    });

    return () => {
      Speech.stop();
      if (soundRef.current?.unloadAsync) soundRef.current.unloadAsync();
    };
  }, []);

  const stopPlayback = useCallback(async () => {
    if (effectiveVoiceConfig.engine === 'expo-speech') {
      Speech.stop();
    } else {
      await soundRef.current?.stopAsync?.();
      await soundRef.current?.unloadAsync?.();
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, [effectiveVoiceConfig.engine]);

  const startPlayback = useCallback(async () => {
    if (effectiveVoiceConfig.engine === 'expo-speech') {
      const targetLang = effectiveVoiceConfig.language === 'en' ? 'en-US' : 'fr-FR';

      // iOS 17+ / iOS 26 : sans voix explicite, AVSpeechSynthesizer peut silencieusement
      // ne rien jouer si la voix par défaut n'est pas chargée. On sélectionne la première
      // voix disponible pour la langue cible.
      let voiceId: string | undefined;
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        if (__DEV__) console.log('Voix disponibles:', voices.map(v => `${v.identifier} (${v.language})`));
        const match = voices.find(v => v.language.startsWith(effectiveVoiceConfig.language === 'en' ? 'en' : 'fr'));
        voiceId = match?.identifier;
        if (__DEV__) console.log('Voix choisie:', voiceId ?? 'aucune');
      } catch (e) {
        if (__DEV__) console.warn('getAvailableVoicesAsync failed:', e);
      }

      Speech.speak(histoire.texte, {
        language: targetLang,
        voice: voiceId,
        rate: speed,
        onStart: () => { if (__DEV__) console.log('Speech démarré'); },
        onDone: () => setIsPlaying(false),
        onStopped: () => setIsPlaying(false),
        onError: (err) => {
          if (__DEV__) console.error('Speech error:', err);
          Alert.alert('Erreur de lecture', "La voix système n'a pas pu lire l'histoire. Essayez ElevenLabs ou redémarrez l'app.");
          setIsPlaying(false);
        },
      });
      setIsPlaying(true);
    } else {
      // ElevenLabs
      if (!elevenLabsKey) {
        Alert.alert('Clé ElevenLabs manquante', 'Configurez votre clé API ElevenLabs dans les paramètres.');
        return;
      }
      setIsLoading(true);
      const result = await generateSpeech(elevenLabsKey, histoire.texte, effectiveVoiceConfig.elevenLabsVoiceId ?? '');
      setIsLoading(false);
      if ('error' in result) {
        Alert.alert('Erreur ElevenLabs', result.error);
        return;
      }
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: result.audioUri },
          { shouldPlay: true, rate: speed },
        );
        soundRef.current = sound;
        setIsPlaying(true);
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            sound.unloadAsync();
            soundRef.current = null;
          }
        });
      } catch {
        Alert.alert('Erreur audio', "Impossible de lire l'histoire.");
      }
    }
  }, [effectiveVoiceConfig, histoire.texte, speed, elevenLabsKey]);

  const togglePlay = useCallback(async () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
    if (isPlaying) {
      await stopPlayback();
    } else {
      await startPlayback();
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  const changeSpeed = useCallback(async (newSpeed: StoryReadingSpeed) => {
    Haptics.selectionAsync();
    if (isPlaying) {
      await stopPlayback();
      setSpeed(newSpeed);
      setTimeout(() => startPlayback(), 50);
    } else {
      setSpeed(newSpeed);
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  const SPEEDS: StoryReadingSpeed[] = [0.8, 1.0, 1.2];

  return (
    <View style={styles.container}>
      {/* Titre */}
      <Text style={[styles.title, { color: colors.text }]}>{histoire.titre}</Text>

      {/* Section voix du narrateur (chips adultes + modal enregistrement) */}
      {adultProfiles.length > 0 && (
        <View style={styles.parentVoiceSection}>
          <Text style={[styles.parentVoiceLabel, { color: colors.textMuted }]}>
            Voix du narrateur
          </Text>
          <View style={styles.parentChipsRow}>
            {adultProfiles.map((p: Profile) => {
              const isSelected = selectedParentId === p.id;
              const hasClone = !!p.voiceElevenLabsId;
              return (
                <View key={p.id} style={styles.parentChipWrap}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedParentId(isSelected ? null : p.id);
                    }}
                    style={[
                      styles.parentChip,
                      {
                        backgroundColor: isSelected ? primary : colors.card,
                        borderColor: isSelected ? primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[
                      styles.parentChipText,
                      { color: isSelected ? '#fff' : colors.text },
                    ]}>
                      Voix de {p.name}
                    </Text>
                  </Pressable>
                  {!hasClone && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(ImpactFeedbackStyle.Light);
                        setRecorderProfileId(p.id);
                      }}
                      style={[styles.parentAddBtn, { borderColor: colors.border }]}
                      accessibilityLabel={`Enregistrer la voix de ${p.name}`}
                    >
                      <Text style={[styles.parentAddBtnText, { color: primary }]}>+</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      <Modal
        visible={recorderProfileId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRecorderProfileId(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Enregistrer votre voix
            </Text>
            <Pressable onPress={() => setRecorderProfileId(null)}>
              <Text style={[styles.modalClose, { color: primary }]}>Fermer</Text>
            </Pressable>
          </View>
          {recorderProfileId !== null && (() => {
            const target = adultProfiles.find((p: Profile) => p.id === recorderProfileId);
            if (!target) return null;
            return (
              <VoiceRecorder
                profileId={target.id}
                profileName={target.name}
                apiKey={elevenLabsKey}
                onVoiceReady={async (voiceId, source) => {
                  try {
                    await updateProfile(target.id, {
                      voiceElevenLabsId: voiceId,
                      voiceSource: source,
                    });
                    setSelectedParentId(target.id);
                    setRecorderProfileId(null);
                  } catch (e) {
                    if (__DEV__) console.warn('updateProfile voix échoué :', e);
                    Alert.alert('Erreur', "Impossible d'enregistrer la voix sur le profil.");
                  }
                }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Waveform */}
      <View style={styles.waveform}>
        {PEAKS.map((peak, i) => (
          <WaveBar
            key={i}
            isPlaying={isPlaying}
            peak={peak}
            delay={i * 20}
            color={isPlaying ? primary : colors.border}
          />
        ))}
      </View>

      {/* Bouton Play/Pause */}
      <Pressable
        style={[styles.playButton, { backgroundColor: primary }]}
        onPress={togglePlay}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Lire'}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        )}
      </Pressable>

      {/* Contrôles vitesse */}
      <View style={styles.speedRow}>
        {SPEEDS.map(s => (
          <Pressable
            key={s}
            style={[
              styles.speedChip,
              { backgroundColor: speed === s ? primary : colors.card, borderColor: colors.border },
            ]}
            onPress={() => changeSpeed(s)}
          >
            <Text style={[styles.speedText, { color: speed === s ? '#fff' : colors.text }]}>
              {s}x
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Bouton Terminer */}
      <Pressable style={styles.finishButton} onPress={onFinish}>
        <Text style={[styles.finishText, { color: colors.textMuted }]}>
          Terminer l'histoire →
        </Text>
      </Pressable>
    </View>
  );
}

export default React.memo(StoryPlayer);

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  title: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, textAlign: 'center', marginBottom: Spacing['4xl'], paddingHorizontal: Spacing['4xl'] },
  waveform: { flexDirection: 'row', alignItems: 'center', height: MAX_H + 8, marginBottom: Spacing['4xl'] },
  playButton: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing['2xl'] },
  playIcon: { fontSize: 28, color: '#fff' },
  speedRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing['4xl'] },
  speedChip: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, borderRadius: Radius.full, borderWidth: 1 },
  speedText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  finishButton: { paddingVertical: Spacing.lg },
  finishText: { fontSize: FontSize.sm },
  // Sélecteur voix parent
  parentVoiceSection: { width: '100%', paddingHorizontal: Spacing['4xl'], marginBottom: Spacing['3xl'], alignItems: 'center' },
  parentVoiceLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.md },
  parentChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center' },
  parentChipWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  parentChip: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, borderRadius: Radius.full, borderWidth: 1 },
  parentChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  parentAddBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  parentAddBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  // Modal enregistrement
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing['4xl'], borderBottomWidth: 1 },
  modalTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  modalClose: { fontSize: FontSize.body, fontWeight: FontWeight.medium },
});
