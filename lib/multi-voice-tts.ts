/**
 * multi-voice-tts.ts — Génération TTS séquentielle pour les histoires multi-voix.
 *
 * Pour chaque beat narration/dialogue d'un script :
 *   - narration → voix narrateur (Gabriel ou voix sélectionnée par l'user)
 *   - dialogue  → voix du personnage selon le casting de l'univers
 *   - fallback  → narrateur si le slug `speaker` n'est pas dans le casting
 *
 * Cache : un MP3 par beat, clé = `{storyId}_{beatIdx}_{voiceId}_{modelSuffix}.mp3`.
 * Dans le suffixe global, on ajoute `_mv` pour distinguer du mode mono-voix.
 *
 * Le player consomme la liste retournée et joue les MP3 en séquence.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { generateSpeech, storyAudioPath, type ElevenLabsOptions } from './elevenlabs';
import { getCharacterVoice } from './story-characters';
import type { StoryScript, ElevenLabsModel } from './types';

const AUDIO_DIR = `${FileSystem.documentDirectory}stories-audio/`;

/**
 * Concatène plusieurs MP3s (codec identique attendu — tous mp3_44100_128
 * d'ElevenLabs) en un seul fichier. Concat byte-level via base64.
 * Les frames MP3 sont indépendantes : le résultat se lit naturellement par
 * expo-av comme un seul flux.
 */
async function concatMp3Files(sources: string[], outPath: string): Promise<void> {
  const chunks: Uint8Array[] = [];
  for (const src of sources) {
    const b64 = await FileSystem.readAsStringAsync(src, { encoding: FileSystem.EncodingType.Base64 });
    chunks.push(base64ToUint8Array(b64));
  }
  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  await FileSystem.writeAsStringAsync(outPath, uint8ArrayToBase64(merged), {
    encoding: FileSystem.EncodingType.Base64,
  });
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return globalThis.btoa(bin);
}

export type MultiVoiceBeat = {
  /** Index dans le tableau original `script.beats` (utile pour le SFX sync) */
  beatIdx: number;
  /** narration ou dialogue (les sfx/pause sont skippés à la génération, le player les rejoue séparément) */
  kind: 'narration' | 'dialogue';
  /** Locuteur (slug de personnage ou 'narrator') */
  speaker: string;
  /** voiceId ElevenLabs effectivement utilisé */
  voiceId: string;
  /** Texte effectivement envoyé à l'API (déjà sanitizé en aval par generateSpeech) */
  text: string;
  /** URI local du MP3 (cache ou nouvellement généré) */
  audioUri?: string;
  /** Erreur de génération éventuelle (le player skippe le beat ou retombe sur narrateur) */
  error?: string;
};

export type MultiVoiceGenerateInput = {
  apiKey: string;
  storyId: string;
  universId: string;
  script: StoryScript;
  /** Voix narrateur par défaut (Gabriel ou autre choix user) */
  narratorVoiceId: string;
  /** Modèle pour le narrateur (les personnages utilisent leur propre modèle, défini dans le casting) */
  narratorModel: ElevenLabsModel;
};

/**
 * Chemin de cache d'un beat individuel — séparé du cache mono-voix
 * (suffixe `_mv_b{idx}` pour cohabiter sans collision).
 */
export function beatAudioPath(
  storyId: string,
  beatIdx: number,
  voiceId: string,
  model: ElevenLabsModel,
): string {
  const modelSfx =
    model === 'eleven_v3' ? '_v3'
    : model === 'eleven_turbo_v2_5' ? '_t25'
    : model === 'eleven_flash_v2_5' ? '_f25'
    : '';
  return `${AUDIO_DIR}${storyId}_mv_b${String(beatIdx).padStart(3, '0')}_${voiceId}${modelSfx}.mp3`;
}

/**
 * Génère (ou réutilise depuis cache) le MP3 de chaque beat parlé du script.
 *
 * Stratégie :
 *  - On itère séquentiellement (les requêtes parallèles risqueraient le rate-limit ElevenLabs)
 *  - Chaque beat appelle `generateSpeech` avec un storyId synthétique `{storyId}_b{idx}` pour
 *    que le cache de generateSpeech soit indépendant par beat
 *  - On rapatrie le MP3 sous le path canonique `beatAudioPath` après génération
 *
 * Erreurs :
 *  - Si un beat échoue, on conserve l'erreur dans le résultat mais on continue les autres
 *  - Le player peut alors choisir de rejouer le texte concerné par le narrateur en TTS de secours
 */
export async function generateMultiVoiceBeats(
  input: MultiVoiceGenerateInput,
): Promise<MultiVoiceBeat[]> {
  const { apiKey, storyId, universId, script, narratorVoiceId, narratorModel } = input;
  const out: MultiVoiceBeat[] = [];

  if (__DEV__) {
    console.log('[multi-voice] start:', {
      storyId, universId,
      narratorVoiceId: narratorVoiceId.slice(0, 8) + '…',
      narratorModel,
      beatCount: script.beats.length,
    });
  }

  for (let i = 0; i < script.beats.length; i++) {
    const beat = script.beats[i];
    if (beat.kind !== 'narration' && beat.kind !== 'dialogue') continue;

    let voiceId = narratorVoiceId;
    let model: ElevenLabsModel = narratorModel;
    let speakerSlug = 'narrator';

    if (beat.kind === 'dialogue') {
      const character = getCharacterVoice(universId, beat.speaker);
      if (character) {
        voiceId = character.voiceId;
        model = character.model;
        speakerSlug = character.slug;
      } else {
        // Slug inconnu → narrateur (fallback gratuit)
        if (__DEV__) {
          console.warn(`[multi-voice] speaker "${beat.speaker}" inconnu pour univers "${universId}" — fallback narrateur`);
        }
      }
    }

    const path = beatAudioPath(storyId, i, voiceId, model);
    const cached = await FileSystem.getInfoAsync(path);
    if (cached.exists) {
      if (__DEV__) console.log(`[multi-voice] beat ${i} cache HIT (${speakerSlug})`);
      out.push({ beatIdx: i, kind: beat.kind, speaker: speakerSlug, voiceId, text: beat.text, audioUri: path });
      continue;
    }
    if (__DEV__) {
      console.log(`[multi-voice] beat ${i} → API`, {
        kind: beat.kind, speaker: speakerSlug,
        voiceId: voiceId.slice(0, 8) + '…',
        model, chars: beat.text.length,
      });
    }

    const opts: ElevenLabsOptions = { model };
    // generateSpeech utilise sa propre clé de cache (storyId_voiceId_model). Pour
    // ne pas collisionner avec le cache mono-voix d'autres histoires, on suffixe
    // le storyId avec l'index du beat.
    const beatStoryId = `${storyId}_mv_b${String(i).padStart(3, '0')}`;
    const res = await generateSpeech(apiKey, beat.text, voiceId, beatStoryId, opts);

    if ('error' in res) {
      out.push({ beatIdx: i, kind: beat.kind, speaker: speakerSlug, voiceId, text: beat.text, error: res.error });
      continue;
    }

    // Renomme/copie vers le path canonique multi-voix pour pouvoir le retrouver sans
    // reconstruire le storyId synthétique côté player.
    try {
      const targetInfo = await FileSystem.getInfoAsync(path);
      if (!targetInfo.exists) {
        await FileSystem.copyAsync({ from: res.audioUri, to: path });
      }
    } catch (e) {
      if (__DEV__) console.warn('[multi-voice] copy beat path failed', e);
    }

    out.push({ beatIdx: i, kind: beat.kind, speaker: speakerSlug, voiceId, text: beat.text, audioUri: path });
  }

  if (__DEV__) {
    const speakers = out.reduce<Record<string, number>>((acc, b) => {
      acc[b.speaker] = (acc[b.speaker] ?? 0) + 1;
      return acc;
    }, {});
    const errors = out.filter(b => b.error).length;
    console.log('[multi-voice] beats done:', {
      total: out.length,
      bySpeaker: speakers,
      errors,
    });
  }

  return out;
}

/**
 * Génère tous les beats parlés ET concatène les MP3s en un seul fichier au
 * `storyAudioPath` canonique du narrateur. Le player existant retrouve donc
 * l'audio au chemin habituel et le lit comme un MP3 mono-voix classique.
 *
 * Mode doux uniquement (pas de SFX). Pour Spectacle multi-voix, il faudrait
 * intercaler les MP3 d'assets SFX, qui peuvent avoir un codec différent —
 * traité dans une itération ultérieure.
 *
 * Returns le chemin du MP3 concaténé, ou une erreur.
 */
export async function generateMultiVoiceConcatenated(
  input: MultiVoiceGenerateInput,
): Promise<{ audioUri: string } | { error: string }> {
  // Cache hit direct sur le path canonique → on saute toute la génération.
  // Le suffixe `_mv` distingue d'un MP3 mono-voix pour la même histoire.
  const canonicalPath = storyAudioPath(`${input.storyId}_mv`, input.narratorVoiceId, input.narratorModel);
  const cached = await FileSystem.getInfoAsync(canonicalPath);
  if (cached.exists) {
    if (__DEV__) console.log('[multi-voice] concat cache HIT:', canonicalPath);
    return { audioUri: canonicalPath };
  }

  const beats = await generateMultiVoiceBeats(input);

  const errors = beats.filter(b => b.error).map(b => `beat ${b.beatIdx} (${b.speaker}): ${b.error}`);
  if (errors.length > 0) {
    return { error: `Génération multi-voix échouée — ${errors.length} beat(s) en erreur : ${errors[0]}` };
  }

  const audioPaths = beats.map(b => b.audioUri).filter((p): p is string => !!p);
  if (audioPaths.length === 0) {
    return { error: 'Aucun beat parlé valide dans le script.' };
  }

  try {
    await concatMp3Files(audioPaths, canonicalPath);
    if (__DEV__) {
      const info = await FileSystem.getInfoAsync(canonicalPath);
      const size = info.exists && 'size' in info ? info.size : 0;
      console.log('[multi-voice] concat OK:', {
        path: canonicalPath,
        sourceCount: audioPaths.length,
        sizeKB: Math.round(size / 1024),
      });
    }
    return { audioUri: canonicalPath };
  } catch (e) {
    if (__DEV__) console.warn('[multi-voice] concat FAIL:', e);
    return { error: e instanceof Error ? e.message : 'Concat MP3 échouée' };
  }
}

/**
 * Vérifie si tous les beats parlés d'un script sont déjà en cache (zéro appel API
 * nécessaire). Utile pour afficher un état "déjà téléchargée" dans l'UI.
 */
export async function isMultiVoiceFullyCached(
  storyId: string,
  universId: string,
  script: StoryScript,
  narratorVoiceId: string,
  narratorModel: ElevenLabsModel,
): Promise<boolean> {
  for (let i = 0; i < script.beats.length; i++) {
    const beat = script.beats[i];
    if (beat.kind !== 'narration' && beat.kind !== 'dialogue') continue;

    let voiceId = narratorVoiceId;
    let model = narratorModel;
    if (beat.kind === 'dialogue') {
      const character = getCharacterVoice(universId, beat.speaker);
      if (character) {
        voiceId = character.voiceId;
        model = character.model;
      }
    }
    const path = beatAudioPath(storyId, i, voiceId, model);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return false;
  }
  return true;
}
