/**
 * fish-audio.ts — Service TTS Fish Audio
 * Genere un MP3 depuis le texte, le persiste dans documentDirectory/stories-audio/
 * et retourne le chemin URI. Reutilise le MP3 en cache si deja genere pour la meme
 * combinaison (histoire + voix) — evite un appel API inutile.
 * Pattern identique a elevenlabs.ts.
 */
import * as FileSystem from 'expo-file-system/legacy';

type GenerateResult = { audioUri: string } | { error: string };

// Dossier persistant (non purge par iOS contrairement a cacheDirectory)
const AUDIO_DIR = `${FileSystem.documentDirectory}stories-audio/`;

/**
 * Chemin du MP3 persistant pour une histoire + voix Fish Audio donnees.
 * Prefixe 'fa_' pour eviter collision avec ElevenLabs sur le meme storyId.
 */
export function storyAudioPathFish(storyId: string, referenceId: string): string {
  return `${AUDIO_DIR}fa_${storyId}_${referenceId}.mp3`;
}

/**
 * Retourne le chemin d'un MP3 deja genere s'il existe, sinon null.
 * Si le cache documentDir est absent mais que vaultUri est fourni et pointe vers
 * un fichier existant, le MP3 est copie depuis le vault vers documentDir.
 */
export async function getCachedStoryAudioFish(
  storyId: string,
  referenceId: string,
  vaultUri?: string,
): Promise<string | null> {
  try {
    const path = storyAudioPathFish(storyId, referenceId);
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
        if (__DEV__) console.warn('[fish-audio] fallback vault copy failed:', e);
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

// Dedup des requetes en vol — protege contre React StrictMode double-mount en dev.
const inflightRequests = new Map<string, Promise<GenerateResult>>();

/**
 * Genere (ou reutilise) le MP3 d'une histoire via Fish Audio.
 * - Si un fichier persistant existe deja pour ce couple (storyId, referenceId) -> reutilise
 * - Sinon -> POST Fish Audio /v1/tts, ecriture dans documentDirectory/stories-audio/
 * - Dedup automatique des requetes en vol (StrictMode safe)
 */
export async function generateSpeechFish(
  apiKey: string,
  text: string,
  referenceId: string,
  storyId: string,
): Promise<GenerateResult> {
  // 1. Reutilisation du cache persistant
  const cached = await getCachedStoryAudioFish(storyId, referenceId);
  if (cached) {
    if (__DEV__) console.log('[fish-audio] MP3 reutilise depuis cache persistant:', cached);
    return { audioUri: cached };
  }

  // 2. Dedup des requetes en vol
  const key = `fa|${storyId}|${referenceId}`;
  const existing = inflightRequests.get(key);
  if (existing) return existing;

  // 3. Generation reelle
  const promise = performGenerateSpeech(apiKey, text, referenceId, storyId)
    .finally(() => { inflightRequests.delete(key); });

  inflightRequests.set(key, promise);
  return promise;
}

async function performGenerateSpeech(
  apiKey: string,
  text: string,
  referenceId: string,
  storyId: string,
): Promise<GenerateResult> {
  try {
    const body: Record<string, unknown> = { text, format: 'mp3' };
    if (referenceId) body.reference_id = referenceId;

    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'model': 's2-pro',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => `${response.status}`);
      return { error: `Fish Audio ${response.status}: ${err}` };
    }

    // Fish Audio retourne un flux binaire MP3 (comme ElevenLabs)
    const arrayBuffer = await response.arrayBuffer();
    const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

    await ensureAudioDir();
    const uri = storyAudioPathFish(storyId, referenceId);
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { audioUri: uri };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur Fish Audio' };
  }
}

/**
 * Supprime les MP3 Fish Audio persistants d'une histoire (toutes voix confondues).
 */
export async function deleteStoryAudiosFish(storyId: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(AUDIO_DIR);
    if (!info.exists) return;
    const files = await FileSystem.readDirectoryAsync(AUDIO_DIR);
    const matching = files.filter(f => f.startsWith(`fa_${storyId}_`));
    await Promise.all(
      matching.map(f => FileSystem.deleteAsync(`${AUDIO_DIR}${f}`, { idempotent: true })),
    );
  } catch (e) {
    if (__DEV__) console.warn('[fish-audio] deleteStoryAudiosFish failed:', e);
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
