/**
 * elevenlabs.ts — Service TTS ElevenLabs
 * Génère un MP3 depuis le texte, le persiste dans documentDirectory/stories-audio/
 * et retourne le chemin URI. Réutilise le MP3 en cache si déjà généré pour la même
 * combinaison (histoire + voix) — évite un appel API inutile.
 */
import * as FileSystem from 'expo-file-system/legacy';
import type { StoryAudioAlignment } from './types';

export interface ElevenLabsOptions {
  model?: string;
  stability?: number;
  similarityBoost?: number;
}

type GenerateResult = { audioUri: string } | { error: string };
type GenerateWithTimestampsResult =
  | { audioUri: string; alignment: StoryAudioAlignment }
  | { error: string };

// Dossier persistant (non purgé par iOS contrairement à cacheDirectory)
const AUDIO_DIR = `${FileSystem.documentDirectory}stories-audio/`;

/**
 * Chemin du MP3 persistant pour une histoire + voix données.
 * Clé déterministe : une même histoire relue avec la même voix réutilise le fichier.
 */
export function storyAudioPath(storyId: string, voiceId: string): string {
  // storyId contient déjà date + universId (caractères sûrs), voiceId est alphanumérique
  return `${AUDIO_DIR}${storyId}_${voiceId}.mp3`;
}

/**
 * Chemin relatif vault pour l'audio MP3 d'une histoire.
 * Convention : 09 - Histoires/{enfant}/{storyId}.mp3
 */
export function storyVaultAudioRelPath(enfant: string, storyId: string): string {
  return `09 - Histoires/${enfant}/${storyId}.mp3`;
}

/**
 * Retourne le chemin d'un MP3 déjà généré s'il existe, sinon null.
 * Si le cache documentDir est absent mais que vaultUri est fourni et pointe vers
 * un fichier existant, le MP3 est copié depuis le vault vers documentDir.
 * Usage : pré-check sans déclencher la génération (ex. afficher un badge "déjà téléchargée").
 */
export async function getCachedStoryAudio(
  storyId: string,
  voiceId: string,
  vaultUri?: string,
): Promise<string | null> {
  try {
    const path = storyAudioPath(storyId, voiceId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return path;

    // Fallback vault : copier depuis iCloud vers documentDir
    if (vaultUri) {
      try {
        const vaultInfo = await FileSystem.getInfoAsync(vaultUri);
        if (vaultInfo.exists) {
          await ensureAudioDir();
          await FileSystem.copyAsync({ from: vaultUri, to: path });
          return path;
        }
      } catch (e) {
        if (__DEV__) console.warn('[elevenlabs] fallback vault copy failed:', e);
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function ensureAudioDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
  }
}

// Dedup des requêtes en vol — protège contre React StrictMode double-mount en dev.
// Clé : storyId + voiceId. Nettoyée à la fin de chaque requête.
const inflightRequests = new Map<string, Promise<GenerateResult>>();

/**
 * Génère (ou réutilise) le MP3 d'une histoire.
 * - Si un fichier persistant existe déjà pour ce couple (storyId, voiceId) → réutilisé, aucun appel API
 * - Sinon → POST ElevenLabs, écriture dans documentDirectory/stories-audio/
 * - Dedup automatique des requêtes en vol (StrictMode safe)
 */
export async function generateSpeech(
  apiKey: string,
  text: string,
  voiceId: string,
  storyId: string,
  options: ElevenLabsOptions = {},
): Promise<GenerateResult> {
  // 1. Réutilisation du cache persistant
  const cached = await getCachedStoryAudio(storyId, voiceId);
  if (cached) {
    if (__DEV__) console.log('[elevenlabs] MP3 réutilisé depuis cache persistant:', cached);
    return { audioUri: cached };
  }

  // 2. Dedup des requêtes en vol
  const key = `${storyId}|${voiceId}`;
  const existing = inflightRequests.get(key);
  if (existing) return existing;

  // 3. Génération réelle
  const promise = performGenerateSpeech(apiKey, text, voiceId, storyId, options)
    .finally(() => { inflightRequests.delete(key); });

  inflightRequests.set(key, promise);
  return promise;
}

async function performGenerateSpeech(
  apiKey: string,
  text: string,
  voiceId: string,
  storyId: string,
  options: ElevenLabsOptions,
): Promise<GenerateResult> {
  const {
    model = 'eleven_multilingual_v2',
    stability = 0.5,
    similarityBoost = 0.75,
  } = options;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => `${response.status}`);
      return { error: `ElevenLabs ${response.status}: ${err}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

    await ensureAudioDir();
    const uri = storyAudioPath(storyId, voiceId);
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { audioUri: uri };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur ElevenLabs' };
  }
}

// ─── V2.3 — Génération avec alignement caractère→timestamp ───────────────────
// Endpoint `/v1/text-to-speech/{voice_id}/with-timestamps` retourne un JSON :
//   { audio_base64: string, alignment: { characters: string[],
//     character_start_times_seconds: number[], character_end_times_seconds: number[] } }
// On persiste le MP3 (cache local) ET l'alignment (caller s'occupe du sidecar vault).

const inflightTsRequests = new Map<string, Promise<GenerateWithTimestampsResult>>();

/**
 * Génère le MP3 d'une histoire AVEC alignement caractère→timestamp.
 * - Si un MP3 existe déjà en cache : NE le réutilise PAS (on a besoin de l'alignment),
 *   sauf si l'appelant a déjà l'alignment d'autre part. Le caller (StoryPlayer) gère
 *   le shortcut "alignment déjà chargé depuis sidecar → pas de regen".
 * - Cache MP3 écrit au même chemin que `generateSpeech` → cohabitation propre
 *   (un appel ultérieur de `getCachedStoryAudio` retournera le bon MP3).
 */
export async function generateSpeechWithTimestamps(
  apiKey: string,
  text: string,
  voiceId: string,
  storyId: string,
  options: ElevenLabsOptions = {},
): Promise<GenerateWithTimestampsResult> {
  const key = `${storyId}|${voiceId}|ts`;
  const existing = inflightTsRequests.get(key);
  if (existing) return existing;

  const promise = performGenerateWithTimestamps(apiKey, text, voiceId, storyId, options)
    .finally(() => { inflightTsRequests.delete(key); });

  inflightTsRequests.set(key, promise);
  return promise;
}

async function performGenerateWithTimestamps(
  apiKey: string,
  text: string,
  voiceId: string,
  storyId: string,
  options: ElevenLabsOptions,
): Promise<GenerateWithTimestampsResult> {
  const {
    model = 'eleven_multilingual_v2',
    stability = 0.5,
    similarityBoost = 0.75,
  } = options;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
          },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text().catch(() => `${response.status}`);
      return { error: `ElevenLabs ${response.status}: ${err}` };
    }

    const json: unknown = await response.json();
    if (!json || typeof json !== 'object') {
      return { error: 'ElevenLabs: réponse JSON invalide' };
    }
    const obj = json as Record<string, unknown>;
    const audioB64 = typeof obj.audio_base64 === 'string' ? obj.audio_base64 : null;
    const align = obj.alignment as Record<string, unknown> | undefined;

    if (!audioB64) return { error: 'ElevenLabs: audio_base64 manquant' };
    if (!align) return { error: 'ElevenLabs: alignment manquant' };

    const chars = Array.isArray(align.characters) ? align.characters as string[] : null;
    const starts = Array.isArray(align.character_start_times_seconds)
      ? align.character_start_times_seconds as number[] : null;
    const ends = Array.isArray(align.character_end_times_seconds)
      ? align.character_end_times_seconds as number[] : null;

    if (!chars || !starts || !ends || chars.length !== starts.length || chars.length !== ends.length) {
      return { error: 'ElevenLabs: alignment mal formé' };
    }

    await ensureAudioDir();
    const uri = storyAudioPath(storyId, voiceId);
    await FileSystem.writeAsStringAsync(uri, audioB64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { audioUri: uri, alignment: { chars, starts, ends } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur ElevenLabs' };
  }
}

/**
 * Supprime le MP3 persistant d'une histoire (toutes voix confondues).
 * À appeler quand une histoire est supprimée du vault.
 */
export async function deleteStoryAudios(storyId: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(AUDIO_DIR);
    if (!info.exists) return;
    const files = await FileSystem.readDirectoryAsync(AUDIO_DIR);
    const matching = files.filter(f => f.startsWith(`${storyId}_`));
    await Promise.all(
      matching.map(f => FileSystem.deleteAsync(`${AUDIO_DIR}${f}`, { idempotent: true })),
    );
  } catch (e) {
    if (__DEV__) console.warn('[elevenlabs] deleteStoryAudios failed:', e);
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
