/**
 * voice-clone.ts — Upload d'un échantillon audio vers ElevenLabs IVC (Instant Voice Cloning).
 * Prend un enregistrement M4A local, l'envoie comme voice sample, retourne le voice_id cloné.
 * Usage : après enregistrement d'un échantillon vocal dans le flow profil famille.
 */
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Envoie un fichier audio M4A vers l'API ElevenLabs Instant Voice Cloning (IVC).
 * @param audioUri  URI local du fichier audio (ex: file:///.../sample.m4a)
 * @param profileName  Nom du profil (utilisé comme label de voix dans ElevenLabs)
 * @param apiKey  Clé API ElevenLabs (xi-api-key) — jamais hardcodée
 * @returns  Le voice_id ElevenLabs de la voix clonée
 * @throws  Error descriptive en français si le fichier est introuvable, l'upload échoue ou la réponse est invalide
 */
export async function uploadVoiceClone(
  audioUri: string,
  profileName: string,
  apiKey: string,
): Promise<string> {
  // Vérification préalable de l'existence du fichier
  const fileInfo = await FileSystem.getInfoAsync(audioUri);
  if (!fileInfo.exists) {
    throw new Error(`Fichier audio introuvable : ${audioUri}`);
  }

  // Construction du multipart/form-data
  // React Native FormData accepte {uri, name, type} pour les fichiers binaires
  const formData = new FormData();
  formData.append('name', profileName);
  formData.append('labels', JSON.stringify({ language: 'fr' }));
  formData.append('files', {
    uri: audioUri,
    name: `${profileName}.m4a`,
    type: 'audio/m4a',
  } as any);

  // POST vers l'API ElevenLabs
  // Ne pas définir Content-Type manuellement : fetch l'ajoute avec le boundary pour FormData
  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => `${response.status}`);
    throw new Error(`Échec upload voix ElevenLabs (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { voice_id?: string };
  if (!data.voice_id) {
    throw new Error('Réponse ElevenLabs invalide : voice_id manquant');
  }

  return data.voice_id;
}
