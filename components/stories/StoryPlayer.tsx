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
import type { BedtimeStory, StoryAudioAlignment, StoryReadingSpeed, StoryVoiceConfig } from '../../lib/types';
import { useThemeColors } from '../../contexts/ThemeContext';
import {
  generateSpeech,
  generateSpeechWithTimestamps,
  getCachedStoryAudio,
  storyVaultAudioRelPath,
} from '../../lib/elevenlabs';
import { generateSpeechFish, getCachedStoryAudioFish } from '../../lib/fish-audio';
import {
  STORY_AMBIENCE_ASSETS,
  AMBIENCE_VOLUME,
  AMBIENCE_FADE_IN_SECONDS,
  AMBIENCE_FADE_OUT_SECONDS,
} from '../../lib/ambience';
import { STORY_SFX_ASSETS, SFX_VOLUME } from '../../lib/sfx';
import { computeSfxScheduleFromAlignment, getSfxTagsFromScript } from '../../lib/story-script';
import type { StorySfxTag } from '../../lib/types';
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
  /** V2.3 — appelé quand l'alignement caractère→timestamp vient d'être généré.
   *  Le parent doit persister via saveStory pour sidecar `.alignment.json`. */
  onAlignmentReady?: (alignment: StoryAudioAlignment) => void;
}

function StoryPlayer({ histoire, voiceConfig, elevenLabsKey, fishAudioKey = '', onFinish, autoGenerate = true, onAlignmentReady }: Props) {
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

  // ─── Mode Spectacle : piste d'ambiance sous la voix ───────────────────────
  const ambienceSoundRef = useRef<Audio.Sound | null>(null);
  const [ambienceReady, setAmbienceReady] = useState(false);
  // Volume courant de l'ambiance, utilisé pour throttler le fade-out continu
  // depuis la progress callback (qui se déclenche à haute fréquence).
  const ambienceVolumeRef = useRef<number>(AMBIENCE_VOLUME);
  // True dès que la voix a démarré au moins une fois → autorise le fade-out
  // en fin de piste (évite que le fade-in initial soit écrasé par 0).
  const ambienceFadeInDoneRef = useRef(false);
  // Mode audio effectif (avec compat ascendante : `spectacle: true` → 'spectacle')
  const audioMode = histoire.audioMode ?? (histoire.spectacle === true ? 'spectacle' : 'off');
  const ambienceActive = audioMode !== 'off';
  const spectacleActive = audioMode === 'spectacle';
  // Volume d'ambiance (override par histoire ou défaut constante)
  const ambienceTargetVolume = typeof histoire.ambienceVolume === 'number'
    ? Math.max(0, Math.min(1, histoire.ambienceVolume))
    : AMBIENCE_VOLUME;
  const ambienceAsset = ambienceActive ? STORY_AMBIENCE_ASSETS[histoire.univers] : undefined;

  // ─── V2 : SFX déclenchés par le script (timing approximatif par paragraphe)
  // Pool de Sound préchargés pour chaque tag utilisé, déclenchés au passage
  // du curseur waveform via onWaveformProgress.
  const sfxPoolRef = useRef<Map<StorySfxTag, Audio.Sound>>(new Map());
  // V2.3 : si `atSec` présent → planning absolu (alignment word-level).
  // Sinon `ratio` → fallback V2.2 (proportionnel cumul caractères).
  const sfxScheduleRef = useRef<{ tag: StorySfxTag; ratio?: number; atSec?: number }[]>([]);
  const sfxTriggeredRef = useRef<Set<number>>(new Set());
  // Dernier ratio de progression observé (sert à détecter un skip arrière)
  const lastProgressRatioRef = useRef<number>(0);
  // État alignment : transmis depuis l'histoire OU récupéré post-génération
  const [alignment, setAlignment] = useState<StoryAudioAlignment | undefined>(histoire.alignment);
  const scriptForPlayer = spectacleActive ? histoire.script : undefined;
  const alignmentForPlayer = spectacleActive ? alignment : undefined;

  if (__DEV__) {
    // Diagnostic au premier render uniquement (ces valeurs sont stables par histoire)
    console.log('[StoryPlayer] spectacle:', spectacleActive,
      '| univers:', histoire.univers,
      '| ambienceAsset:', ambienceAsset ? 'présent' : 'absent');
  }

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

  // ─── Mode Spectacle : chargement de l'ambiance au montage ────────────────
  useEffect(() => {
    if (!ambienceAsset) return;
    let cancelled = false;

    (async () => {
      try {
        // S'assure que la session audio iOS est active (silent switch bypass)
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        }).catch(() => {});

        if (__DEV__) console.log('[StoryPlayer] ambience: loading…');
        const { sound } = await Audio.Sound.createAsync(
          ambienceAsset as number,
          { isLooping: true, volume: 0, shouldPlay: false },
        );
        if (cancelled) {
          await sound.unloadAsync().catch(() => {});
          return;
        }
        ambienceSoundRef.current = sound;
        setAmbienceReady(true);
        if (__DEV__) console.log('[StoryPlayer] ambience: ready');
      } catch (e) {
        if (__DEV__) console.warn('[StoryPlayer] ambience load failed:', e);
      }
    })();

    return () => {
      cancelled = true;
      const s = ambienceSoundRef.current;
      ambienceSoundRef.current = null;
      setAmbienceReady(false);
      if (s) s.unloadAsync().catch(() => {});
    };
  }, [ambienceAsset]);

  // ─── Endormissement : opacité d'overlay sombre sur les 30 dernières secondes
  const SLEEP_DIM_SECONDS = 30;
  const SLEEP_DIM_MAX_OPACITY = 0.55;
  const dimOpacity = useSharedValue(0);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dimOpacity.value }));

  // ─── Indicateur visuel SFX : pulse global déclenché à chaque trigger ─────
  const sfxPulse = useSharedValue(0);
  const sfxPulseStyle = useAnimatedStyle(() => ({
    opacity: sfxPulse.value,
    transform: [{ scale: 0.9 + sfxPulse.value * 0.2 }],
  }));
  const triggerSfxPulse = useCallback(() => {
    'worklet';
    sfxPulse.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) }),
    );
  }, [sfxPulse]);

  // ─── V2 : précharge des SFX utilisés + calcul du planning ──────────────
  // V2.3 : si `alignmentForPlayer` est dispo → planning absolu en secondes (word-level).
  // Sinon → fallback V2.2 ratio (cumul caractères narration/dialogue).
  useEffect(() => {
    if (!scriptForPlayer) return;
    let cancelled = false;

    let schedule: { tag: StorySfxTag; ratio?: number; atSec?: number }[] = [];

    if (alignmentForPlayer) {
      const aligned = computeSfxScheduleFromAlignment(scriptForPlayer, alignmentForPlayer);
      if (aligned && aligned.length > 0) {
        schedule = aligned.map(s => ({ tag: s.tag, atSec: s.atSec }));
        if (__DEV__) console.log('[StoryPlayer] SFX schedule (V2.3 word-level):', schedule.length);
      }
    }

    // Fallback ratio si pas d'alignment exploitable
    if (schedule.length === 0) {
      let cumulChars = 0;
      let totalChars = 0;
      for (const b of scriptForPlayer.beats) {
        if (b.kind === 'narration' || b.kind === 'dialogue') totalChars += b.text.length + 1;
      }
      if (totalChars > 0) {
        for (const b of scriptForPlayer.beats) {
          if (b.kind === 'narration' || b.kind === 'dialogue') {
            cumulChars += b.text.length + 1;
          } else if (b.kind === 'sfx') {
            schedule.push({ tag: b.tag, ratio: cumulChars / totalChars });
          }
        }
        if (__DEV__) console.log('[StoryPlayer] SFX schedule (V2.2 ratio fallback):', schedule.length);
      }
    }

    sfxScheduleRef.current = schedule;
    sfxTriggeredRef.current.clear();
    if (schedule.length === 0) return;

    // 2. Précharge unique de chaque tag utilisé
    const tags = getSfxTagsFromScript(scriptForPlayer);
    (async () => {
      for (const tag of tags) {
        const asset = STORY_SFX_ASSETS[tag];
        if (!asset) continue;
        try {
          const { sound } = await Audio.Sound.createAsync(
            asset as number,
            { shouldPlay: false, volume: SFX_VOLUME },
          );
          if (cancelled) {
            await sound.unloadAsync().catch(() => {});
            return;
          }
          sfxPoolRef.current.set(tag, sound);
        } catch (e) {
          if (__DEV__) console.warn('[StoryPlayer] SFX preload failed:', tag, e);
        }
      }
      if (__DEV__) console.log('[StoryPlayer] SFX pool ready:', sfxPoolRef.current.size);
    })();

    return () => {
      cancelled = true;
      const pool = sfxPoolRef.current;
      sfxPoolRef.current = new Map();
      pool.forEach(s => s.unloadAsync().catch(() => {}));
    };
  }, [scriptForPlayer, alignmentForPlayer]);

  // ─── V2 : reset du compteur de SFX déclenchés à chaque play (relecture) ──
  useEffect(() => {
    if (isPlaying) {
      sfxTriggeredRef.current.clear();
      lastProgressRatioRef.current = 0;
    } else {
      // Reset overlay d'endormissement quand on met en pause
      dimOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [isPlaying, dimOpacity]);

  // ─── Mode Spectacle : sync play/pause avec la voix narrée ────────────────
  useEffect(() => {
    if (!ambienceAsset || !ambienceReady) return;
    const sound = ambienceSoundRef.current;
    if (!sound) return;

    let cancelled = false;
    const FADE_STEP_MS = 80;
    const fadeSteps = Math.max(1, Math.round((AMBIENCE_FADE_IN_SECONDS * 1000) / FADE_STEP_MS));

    (async () => {
      try {
        if (isPlaying) {
          if (__DEV__) console.log('[StoryPlayer] ambience: play + fade in');
          ambienceFadeInDoneRef.current = false;
          await sound.setVolumeAsync(0);
          ambienceVolumeRef.current = 0;
          await sound.playAsync();
          for (let i = 1; i <= fadeSteps; i++) {
            if (cancelled) return;
            const vol = (ambienceTargetVolume * i) / fadeSteps;
            await sound.setVolumeAsync(vol);
            ambienceVolumeRef.current = vol;
            await new Promise(r => setTimeout(r, FADE_STEP_MS));
          }
          ambienceFadeInDoneRef.current = true;
        } else {
          if (__DEV__) console.log('[StoryPlayer] ambience: fade out + pause');
          ambienceFadeInDoneRef.current = false;
          for (let i = fadeSteps; i >= 0; i--) {
            if (cancelled) return;
            const vol = (ambienceTargetVolume * i) / fadeSteps;
            await sound.setVolumeAsync(vol);
            ambienceVolumeRef.current = vol;
            await new Promise(r => setTimeout(r, FADE_STEP_MS / 2));
          }
          await sound.pauseAsync();
        }
      } catch (e) {
        if (__DEV__) console.warn('[StoryPlayer] ambience sync failed:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [isPlaying, ambienceAsset, ambienceReady]);

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
      // V2.3 : si Mode Spectacle + ElevenLabs + script présent ET alignment absent,
      // on appelle l'endpoint /with-timestamps pour récupérer l'alignement caractère→temps.
      // Sinon (mode doux/off, Fish Audio, ou alignment déjà en cache), endpoint classique.
      const useTimestamps = isElevenLabs
        && spectacleActive
        && !!histoire.script
        && !alignment;
      if (__DEV__) {
        console.log('[StoryPlayer] runGeneration decision:', {
          isElevenLabs, isFishAudio, spectacleActive,
          hasScript: !!histoire.script, hasAlignment: !!alignment,
          useTimestamps,
        });
      }

      const result = isFishAudio
        ? await generateSpeechFish(apiKey, histoire.texte, voiceConfig.fishAudioReferenceId ?? '', histoire.id)
        : useTimestamps
          ? await generateSpeechWithTimestamps(apiKey, histoire.texte, voiceConfig.elevenLabsVoiceId ?? '', histoire.id)
          : await generateSpeech(apiKey, histoire.texte, voiceConfig.elevenLabsVoiceId ?? '', histoire.id);
      if (__DEV__) {
        if ('error' in result) {
          console.warn('[StoryPlayer] generation error:', result.error);
        } else {
          const alignFromResult = (result as { alignment?: StoryAudioAlignment }).alignment;
          console.log('[StoryPlayer] generation OK:', {
            hasAlignment: !!alignFromResult,
            alignChars: alignFromResult?.chars.length,
          });
        }
      }
      if (signal.cancelled) return;
      if ('error' in result) {
        setGenError(result.error);
      } else {
        setAudioPath(result.audioUri);
        // V2.3 : alignment dispo → state local + remontée parent (persistance sidecar)
        const maybeAlignment = (result as { alignment?: StoryAudioAlignment }).alignment;
        if (maybeAlignment) {
          setAlignment(maybeAlignment);
          if (onAlignmentReady) {
            try { onAlignmentReady(maybeAlignment); } catch { /* non-critique */ }
          }
        }
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
  }, [isFishAudio, isElevenLabs, spectacleActive, fishAudioKey, elevenLabsKey, histoire.texte, histoire.id, histoire.enfant, histoire.script, alignment, voiceConfig.fishAudioReferenceId, voiceConfig.elevenLabsVoiceId, vault, onAlignmentReady]);

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
        // V2.3 — si Spectacle + ElevenLabs + script + pas d'alignment, on doit
        // quand même récupérer l'alignment via /with-timestamps. Sinon le player
        // restera en V2.2 fallback pour une histoire censée avoir du word-level.
        const needsAlignmentFetch = isElevenLabs
          && spectacleActive
          && !!histoire.script
          && !alignment;
        if (__DEV__) {
          console.log('[StoryPlayer] cache hit:', { needsAlignmentFetch });
        }
        if (!needsAlignmentFetch) return;
        // sinon on continue vers runGeneration pour fetch l'alignment
      }

      // Aucun cache disponible (ou cache + besoin d'alignment)
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

  // ─── Progression lecture → sharedValue pour le sparkle + fade-out ambiance
  const onWaveformProgress = useCallback((current: number, duration: number) => {
    if (duration > 0) {
      playProgress.value = current / duration;
    }

    // ─── Détection skip arrière : reset des SFX déjà tirés au-delà du curseur
    if (duration > 0) {
      const ratio = current / duration;
      const last = lastProgressRatioRef.current;
      if (last - ratio > 0.05 && sfxScheduleRef.current.length > 0) {
        const currentSec = current / 1000;
        sfxTriggeredRef.current.forEach((idx) => {
          const beat = sfxScheduleRef.current[idx];
          if (!beat) return;
          // V2.3 : compare en secondes — V2.2 fallback : compare en ratio
          if (typeof beat.atSec === 'number') {
            if (beat.atSec > currentSec) sfxTriggeredRef.current.delete(idx);
          } else if (typeof beat.ratio === 'number') {
            if (beat.ratio > ratio) sfxTriggeredRef.current.delete(idx);
          }
        });
        if (__DEV__) console.log('[StoryPlayer] SFX retrigger après skip arrière', { from: last.toFixed(2), to: ratio.toFixed(2) });
      }
      lastProgressRatioRef.current = ratio;
    }

    // ─── Endormissement : overlay sombre sur les 30 dernières secondes
    const remainingSec = (duration - current) / 1000;
    if (Number.isFinite(remainingSec) && remainingSec >= 0) {
      const dimRatio = Math.max(0, Math.min(1, 1 - remainingSec / SLEEP_DIM_SECONDS));
      const targetDim = dimRatio * SLEEP_DIM_MAX_OPACITY;
      if (Math.abs(targetDim - dimOpacity.value) > 0.02) {
        dimOpacity.value = withTiming(targetDim, { duration: 400 });
      }
    }

    // Fade-out progressif de l'ambiance sur les dernières secondes (endormissement).
    // Démarre seulement après la fin du fade-in initial, pour ne pas se battre avec.
    if (!ambienceFadeInDoneRef.current) return;
    const sound = ambienceSoundRef.current;
    if (!sound) return;
    if (remainingSec < 0 || !Number.isFinite(remainingSec)) return;

    let target: number;
    if (remainingSec >= AMBIENCE_FADE_OUT_SECONDS) {
      target = ambienceTargetVolume;
    } else {
      const ratio = Math.max(0, remainingSec / AMBIENCE_FADE_OUT_SECONDS);
      target = ambienceTargetVolume * ratio;
    }
    // Throttle : ne pousse setVolumeAsync que sur un delta significatif (~3%)
    if (Math.abs(target - ambienceVolumeRef.current) >= 0.012) {
      ambienceVolumeRef.current = target;
      sound.setVolumeAsync(target).catch(() => { /* non-critique */ });
    }

    // ─── V2 : déclenche les SFX dont le seuil est dépassé ────────────────
    // V2.3 : compare en secondes absolues si `atSec` présent (alignment word-level)
    // V2.2 : fallback ratio sinon
    if (duration > 0 && sfxScheduleRef.current.length > 0) {
      const ratio = current / duration;
      const currentSec = current / 1000;
      sfxScheduleRef.current.forEach((beat, idx) => {
        if (sfxTriggeredRef.current.has(idx)) return;
        let reached = false;
        if (typeof beat.atSec === 'number') {
          reached = currentSec >= beat.atSec;
        } else if (typeof beat.ratio === 'number') {
          reached = ratio >= beat.ratio;
        }
        if (!reached) return;
        sfxTriggeredRef.current.add(idx);
        const sound = sfxPoolRef.current.get(beat.tag);
        if (!sound) return;
        if (__DEV__) {
          const at = typeof beat.atSec === 'number'
            ? `${beat.atSec.toFixed(2)}s`
            : `r=${(beat.ratio ?? 0).toFixed(2)}`;
          console.log('[StoryPlayer] SFX play:', beat.tag, '@', at);
        }
        // Pulse visuel synchronisé (UI thread)
        triggerSfxPulse();
        // Replay depuis 0 puis play (fire-and-forget, async)
        sound.setPositionAsync(0)
          .then(() => sound.playAsync())
          .catch((e) => { if (__DEV__) console.warn('[StoryPlayer] SFX play failed:', beat.tag, e); });
      });
    }
  }, [playProgress, dimOpacity, triggerSfxPulse]);

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{histoire.titre}</Text>

      {/* Indicateur visuel SFX : halo coloré qui pulse à chaque trigger */}
      {spectacleActive && (
        <Animated.View
          pointerEvents="none"
          style={[styles.sfxPulse, { backgroundColor: primary }, sfxPulseStyle]}
        />
      )}

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

      {/* Overlay endormissement : assombrit progressivement les 30 dernières secondes */}
      <Animated.View
        pointerEvents="none"
        style={[styles.sleepDim, dimStyle]}
      />
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
  sleepDim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
  },
  sfxPulse: {
    position: 'absolute',
    top: Spacing['2xl'],
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0,
  },
});
