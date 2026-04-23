import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withSpring, cancelAnimation, Easing,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Waveform,
  type IWaveformRef,
  PlayerState,
} from '@simform_solutions/react-native-audio-waveform';
import type { BedtimeStory, StoryReadingSpeed, StoryVoiceConfig } from '../../lib/types';
import { useThemeColors } from '../../contexts/ThemeContext';
import { generateSpeech, getCachedStoryAudio, storyVaultAudioRelPath } from '../../lib/elevenlabs';
import { generateSpeechFish, getCachedStoryAudioFish } from '../../lib/fish-audio';
import { useVault } from '../../contexts/VaultContext';
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

// ─── WaveBar (fallback décoratif pour expo-speech) ────────────────────────────

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

// ─── PlaybackSparkle — point lumineux qui suit la position de lecture ──────
// Suit un sharedValue `progress` (0-1) piloté par onCurrentProgressChange.
// Deux couches : point solide + halo pulsant. Position animée sur UI thread.

const SPARKLE_SIZE = 10;
const SPARKLE_GLOW = 14;

interface PlaybackSparkleProps {
  isPlaying: boolean;
  progress: SharedValue<number>;
  width: number;
  color: string;
}

const PlaybackSparkle = React.memo(function PlaybackSparkle({ isPlaying, progress, width, color }: PlaybackSparkleProps) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      pulseOpacity.value = withTiming(1, { duration: 250 });
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.35, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 300 });
      pulseOpacity.value = withTiming(0, { duration: 400 });
    }
  }, [isPlaying, pulseScale, pulseOpacity]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * width - SPARKLE_SIZE / 2 }],
    opacity: pulseOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * width - SPARKLE_GLOW / 2 },
      { scale: pulseScale.value },
    ],
    opacity: pulseOpacity.value * 0.5,
  }));

  if (width === 0) return null;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          sparkleStyles.glow,
          { width: SPARKLE_GLOW, height: SPARKLE_GLOW, backgroundColor: color },
          glowStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          sparkleStyles.dot,
          { width: SPARKLE_SIZE, height: SPARKLE_SIZE, backgroundColor: color },
          dotStyle,
        ]}
      />
    </>
  );
});

const sparkleStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: '50%',
    left: 0,
    marginTop: -SPARKLE_SIZE / 2,
    borderRadius: SPARKLE_SIZE / 2,
  },
  glow: {
    position: 'absolute',
    top: '50%',
    left: 0,
    marginTop: -SPARKLE_GLOW / 2,
    borderRadius: SPARKLE_GLOW / 2,
  },
});

// ─── Vitesses selon le moteur ────────────────────────────────────────────────
// expo-speech: vitesses natives fines (0.8 / 1.0 / 1.2)
// ElevenLabs Waveform: lib limitée à 1.0 / 1.5 / 2.0 (type PlaybackSpeedType)

const SPEEDS_EXPO: StoryReadingSpeed[] = [0.8, 1.0, 1.2];
const SPEEDS_ELEVEN = [1.0, 1.5, 2.0] as const;
type ElevenSpeed = typeof SPEEDS_ELEVEN[number];

// ─── StoryPlayer ─────────────────────────────────────────────────────────────

interface Props {
  histoire: BedtimeStory;
  voiceConfig: StoryVoiceConfig;
  elevenLabsKey: string;
  fishAudioKey?: string;
  onFinish: () => void;
  autoGenerate?: boolean; // défaut true
}

function StoryPlayer({ histoire, voiceConfig, elevenLabsKey, fishAudioKey = '', onFinish, autoGenerate = true }: Props) {
  const { primary, colors } = useThemeColors();
  const { vault } = useVault();
  const isElevenLabs = voiceConfig.engine === 'elevenlabs';
  const isFishAudio = voiceConfig.engine === 'fish-audio';
  const isApiVoice = isElevenLabs || isFishAudio;

  // État commun
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // État expo-speech
  const [expoSpeed, setExpoSpeed] = useState<StoryReadingSpeed>(1.0);

  // État ElevenLabs
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [waveformReady, setWaveformReady] = useState(false);
  const [needsGeneration, setNeedsGeneration] = useState(false);
  const [elevenSpeed, setElevenSpeed] = useState<ElevenSpeed>(1.0);
  const [waveformWidth, setWaveformWidth] = useState(0);
  const waveformRef = useRef<IWaveformRef>(null);
  const playProgress = useSharedValue(0); // 0-1 pour le sparkle

  // ─── Montage : session audio + pré-génération ElevenLabs si besoin ─────────
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    }).then(() => primeAudioSession()).catch((e) => {
      if (__DEV__) console.warn('StoryPlayer: audio prime failed', e);
    });

    return () => {
      Speech.stop();
    };
  }, []);

  // Construit l'URI absolue du fichier MP3 dans le vault iCloud
  const vaultUri = React.useMemo(() => {
    if (!vault) return undefined;
    const relPath = storyVaultAudioRelPath(histoire.enfant, histoire.id);
    // Reproduit la logique VaultManager.uri() (méthode privée)
    const isUri = vault.vaultPath.startsWith('file://') || vault.vaultPath.startsWith('content://');
    const rel = isUri
      ? relPath.split('/').map((c) => encodeURIComponent(c)).join('/')
      : relPath;
    const path = `${vault.vaultPath}/${rel}`;
    return isUri ? path : `file://${path}`;
  }, [vault, histoire.enfant, histoire.id]);

  // Génère l'audio via l'API (appelable à la demande ou automatiquement)
  const runGeneration = React.useCallback(async (signal: { cancelled: boolean }) => {
    const apiKey = isFishAudio ? fishAudioKey : elevenLabsKey;
    const engineLabel = isFishAudio ? 'Fish Audio' : 'ElevenLabs';

    if (!apiKey) {
      if (!signal.cancelled) setGenError(`Cle ${engineLabel} manquante. Configurez votre cle API dans les parametres.`);
      return;
    }

    if (!signal.cancelled) {
      setIsLoading(true);
      setGenError(null);
    }

    try {
      const result = isFishAudio
        ? await generateSpeechFish(apiKey, histoire.texte, voiceConfig.fishAudioReferenceId ?? '', histoire.id)
        : await generateSpeech(apiKey, histoire.texte, voiceConfig.elevenLabsVoiceId ?? '', histoire.id);
      if (signal.cancelled) return;
      if ('error' in result) {
        setGenError(result.error);
      } else {
        setAudioPath(result.audioUri);
        // Persister dans le vault iCloud (best-effort silencieux)
        if (vault) {
          vault
            .copyFileToVault(result.audioUri, storyVaultAudioRelPath(histoire.enfant, histoire.id))
            .catch(() => { /* best-effort — iCloud indisponible */ });
        }
      }
    } catch (e) {
      if (!signal.cancelled) setGenError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      if (!signal.cancelled) setIsLoading(false);
    }
  }, [isFishAudio, fishAudioKey, elevenLabsKey, histoire.texte, histoire.id, histoire.enfant, voiceConfig.fishAudioReferenceId, voiceConfig.elevenLabsVoiceId, vault]);

  // Pre-generation API voice (ElevenLabs ou Fish Audio) au montage (une fois)
  useEffect(() => {
    if (!isApiVoice) return;

    let signal = { cancelled: false };

    const init = async () => {
      const voiceId = isFishAudio
        ? (voiceConfig.fishAudioReferenceId ?? '')
        : (voiceConfig.elevenLabsVoiceId ?? '');

      // Vérifier le cache local (et fallback vault si disponible)
      const cached = isFishAudio
        ? await getCachedStoryAudioFish(histoire.id, voiceId, vaultUri)
        : await getCachedStoryAudio(histoire.id, voiceId, vaultUri);

      if (signal.cancelled) return;

      if (cached) {
        setAudioPath(cached);
        return;
      }

      // Aucun cache disponible
      if (!autoGenerate) {
        setNeedsGeneration(true);
        return;
      }

      // Génération automatique
      await runGeneration(signal);
    };

    init();
    return () => { signal.cancelled = true; };
  }, [isApiVoice, isFishAudio, autoGenerate, vaultUri, histoire.id, voiceConfig.elevenLabsVoiceId, voiceConfig.fishAudioReferenceId, runGeneration]);

  // ─── Playback expo-speech ────────────────────────────────────────────────
  const startExpoSpeech = useCallback(async () => {
    const targetLang = voiceConfig.language === 'en' ? 'en-US' : 'fr-FR';
    let voiceId: string | undefined = voiceConfig.voiceIdentifier;

    if (!voiceId) {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const match = voices.find(v => v.language.startsWith(voiceConfig.language === 'en' ? 'en' : 'fr'));
        voiceId = match?.identifier;
      } catch (e) {
        if (__DEV__) console.warn('getAvailableVoicesAsync failed:', e);
      }
    }

    Speech.speak(histoire.texte, {
      language: targetLang,
      voice: voiceId,
      rate: expoSpeed,
      onDone: () => setIsPlaying(false),
      onStopped: () => setIsPlaying(false),
      onError: (err) => {
        if (__DEV__) console.error('Speech error:', err);
        Alert.alert('Erreur de lecture', "La voix système n'a pas pu lire l'histoire.");
        setIsPlaying(false);
      },
    });
    setIsPlaying(true);
  }, [voiceConfig, histoire.texte, expoSpeed]);

  const stopExpoSpeech = useCallback(() => {
    Speech.stop();
    setIsPlaying(false);
  }, []);

  // ─── Playback ElevenLabs via Waveform ─────────────────────────────────────
  const startElevenLabs = useCallback(async () => {
    if (!waveformRef.current || !audioPath) return;
    try {
      await waveformRef.current.startPlayer();
    } catch (e) {
      if (__DEV__) console.error('Waveform start error:', e);
      Alert.alert('Erreur audio', "Impossible de lire l'histoire.");
    }
  }, [audioPath]);

  const pauseElevenLabs = useCallback(async () => {
    if (!waveformRef.current) return;
    try {
      await waveformRef.current.pausePlayer();
    } catch (e) {
      if (__DEV__) console.error('Waveform pause error:', e);
    }
  }, []);

  // ─── Toggle play/pause unifié ─────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
    if (isApiVoice) {
      if (!audioPath) return;
      if (isPlaying) {
        await pauseElevenLabs();
      } else {
        await startElevenLabs();
      }
    } else {
      if (isPlaying) {
        stopExpoSpeech();
      } else {
        await startExpoSpeech();
      }
    }
  }, [isApiVoice, isPlaying, audioPath, startElevenLabs, pauseElevenLabs, startExpoSpeech, stopExpoSpeech]);

  // ─── Changement de vitesse ────────────────────────────────────────────────
  const changeExpoSpeed = useCallback(async (newSpeed: StoryReadingSpeed) => {
    Haptics.selectionAsync();
    if (isPlaying) {
      stopExpoSpeech();
      setExpoSpeed(newSpeed);
      setTimeout(() => {
        const targetLang = voiceConfig.language === 'en' ? 'en-US' : 'fr-FR';
        Speech.speak(histoire.texte, {
          language: targetLang,
          voice: voiceConfig.voiceIdentifier,
          rate: newSpeed,
          onDone: () => setIsPlaying(false),
          onStopped: () => setIsPlaying(false),
          onError: () => setIsPlaying(false),
        });
        setIsPlaying(true);
      }, 50);
    } else {
      setExpoSpeed(newSpeed);
    }
  }, [isPlaying, stopExpoSpeech, voiceConfig, histoire.texte]);

  const changeElevenSpeed = useCallback((newSpeed: ElevenSpeed) => {
    Haptics.selectionAsync();
    setElevenSpeed(newSpeed);
    // Le prop playbackSpeed s'applique automatiquement au player Waveform
  }, []);

  // ─── Sync PlayerState Waveform → isPlaying local ──────────────────────────
  const onWaveformStateChange = useCallback((state: PlayerState) => {
    setIsPlaying(state === PlayerState.playing);
    if (state === PlayerState.stopped) {
      playProgress.value = 0;
    }
  }, [playProgress]);

  // ─── Progression lecture → sharedValue pour le sparkle ────────────────────
  const onWaveformProgress = useCallback((current: number, duration: number) => {
    if (duration > 0) {
      playProgress.value = current / duration;
    }
  }, [playProgress]);

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{histoire.titre}</Text>

      {/* Waveform : vraie pour ElevenLabs/Fish Audio, decorative pour expo-speech */}
      {isApiVoice ? (
        <View style={styles.waveformEleven}>
          {audioPath ? (
            <View
              style={styles.waveformInner}
              onLayout={(e) => setWaveformWidth(e.nativeEvent.layout.width)}
            >
              <Waveform
                mode="static"
                ref={waveformRef}
                path={audioPath}
                playbackSpeed={elevenSpeed}
                candleSpace={2}
                candleWidth={3}
                candleHeightScale={4}
                waveColor={colors.border}
                scrubColor={primary}
                containerStyle={styles.waveformContainer}
                onPlayerStateChange={onWaveformStateChange}
                onCurrentProgressChange={onWaveformProgress}
                onChangeWaveformLoadState={(loading) => setWaveformReady(!loading)}
                onError={(err) => {
                  if (__DEV__) console.error('Waveform error:', err);
                  setGenError('Erreur de chargement de la forme d\'onde');
                }}
              />
              <PlaybackSparkle
                isPlaying={isPlaying}
                progress={playProgress}
                width={waveformWidth}
                color={primary}
              />
            </View>
          ) : needsGeneration && !isLoading ? (
            <View style={styles.placeholderCenter}>
              <Pressable
                style={[styles.generateButton, { backgroundColor: primary }]}
                onPress={() => {
                  setNeedsGeneration(false);
                  const signal = { cancelled: false };
                  runGeneration(signal);
                }}
                accessibilityRole="button"
                accessibilityLabel="Générer l'audio"
              >
                <Text style={styles.generateButtonText}>🔊 Générer l'audio</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.placeholderCenter}>
              {isLoading ? (
                <>
                  <ActivityIndicator color={primary} />
                  <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                    Génération en cours…
                  </Text>
                </>
              ) : genError ? (
                <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                  {genError}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      ) : (
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
      )}

      {/* Bouton Play/Pause */}
      <Pressable
        style={[styles.playButton, { backgroundColor: primary }]}
        onPress={togglePlay}
        disabled={isApiVoice && (!audioPath || !waveformReady || isLoading)}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Lire'}
      >
        {isLoading || (isApiVoice && audioPath && !waveformReady) ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        )}
      </Pressable>

      {/* Contrôles vitesse */}
      <View style={styles.speedRow}>
        {isApiVoice
          ? SPEEDS_ELEVEN.map(s => (
              <Pressable
                key={s}
                style={[
                  styles.speedChip,
                  { backgroundColor: elevenSpeed === s ? primary : colors.card, borderColor: colors.border },
                ]}
                onPress={() => changeElevenSpeed(s)}
              >
                <Text style={[styles.speedText, { color: elevenSpeed === s ? '#fff' : colors.text }]}>
                  {s}x
                </Text>
              </Pressable>
            ))
          : SPEEDS_EXPO.map(s => (
              <Pressable
                key={s}
                style={[
                  styles.speedChip,
                  { backgroundColor: expoSpeed === s ? primary : colors.card, borderColor: colors.border },
                ]}
                onPress={() => changeExpoSpeed(s)}
              >
                <Text style={[styles.speedText, { color: expoSpeed === s ? '#fff' : colors.text }]}>
                  {s}x
                </Text>
              </Pressable>
            ))}
      </View>

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
  waveformEleven: { width: '90%', height: 80, marginBottom: Spacing['4xl'], justifyContent: 'center' },
  waveformInner: { position: 'relative', width: '100%', height: 80, justifyContent: 'center' },
  waveformContainer: { height: 80, width: '100%' },
  placeholderCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, height: 80 },
  placeholderText: { fontSize: FontSize.sm },
  playButton: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing['2xl'] },
  playIcon: { fontSize: 28, color: '#fff' },
  speedRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing['4xl'] },
  speedChip: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, borderRadius: Radius.full, borderWidth: 1 },
  speedText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  finishButton: { paddingVertical: Spacing.lg },
  finishText: { fontSize: FontSize.sm },
  generateButton: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center' },
  generateButtonText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: '#fff' },
});
