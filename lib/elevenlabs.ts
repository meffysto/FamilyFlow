/**
 * elevenlabs.ts — Service TTS ElevenLabs
 * Génère un MP3 depuis le texte, sauvegarde en cache local, retourne le chemin URI.
 */
import * as FileSystem from 'expo-file-system/legacy';

export interface ElevenLabsOptions {
  model?: string;
  stability?: number;
  similarityBoost?: number;
}

export async function generateSpeech(
  apiKey: string,
  text: string,
  voiceId: string,
  options: ElevenLabsOptions = {},
): Promise<{ audioUri: string } | { error: string }> {
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
    const uri = `${FileSystem.cacheDirectory}story_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { audioUri: uri };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur ElevenLabs' };
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
