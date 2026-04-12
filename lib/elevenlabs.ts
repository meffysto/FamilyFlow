/**
 * elevenlabs.ts — Service TTS ElevenLabs
 * Génère un MP3 depuis le texte, le persiste dans documentDirectory/stories-audio/
 * et retourne le chemin URI. Réutilise le MP3 en cache si déjà généré pour la même
 * combinaison (histoire + voix) — évite un appel API inutile.
 */
import * as FileSystem from 'expo-file-system/legacy';

export interface ElevenLabsOptions {
  model?: string;
  stability?: number;
  similarityBoost?: number;
}

type GenerateResult = { audioUri: string } | { error: string };

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
 * Retourne le chemin d'un MP3 déjà généré s'il existe, sinon null.
 * Usage : pré-check sans déclencher la génération (ex. afficher un badge "déjà téléchargée").
 */
export async function getCachedStoryAudio(
  storyId: string,
  voiceId: string,
): Promise<string | null> {
  try {
    const path = storyAudioPath(storyId, voiceId);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists ? path : null;
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
