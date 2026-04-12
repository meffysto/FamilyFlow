/**
 * voice-clone-fish.ts — Upload d'un echantillon audio vers Fish Audio pour cloner une voix.
 * Prend un enregistrement M4A local, l'envoie comme voice sample, retourne le reference_id clone.
 * Pattern identique a voice-clone.ts (ElevenLabs).
 */
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Envoie un fichier audio M4A vers l'API Fish Audio /model pour creer une voix clonee.
 * @param audioUri  URI local du fichier audio (ex: file:///.../sample.m4a)
 * @param profileName  Nom du profil (utilise comme titre du modele dans Fish Audio)
 * @param apiKey  Cle API Fish Audio (Bearer token) — jamais hardcodee
 * @returns  Le reference_id Fish Audio de la voix clonee (_id dans la reponse)
 * @throws  Error descriptive en francais si le fichier est introuvable, l'upload echoue ou la reponse est invalide
 */
export async function uploadVoiceCloneFish(
  audioUri: string,
  profileName: string,
  apiKey: string,
): Promise<string> {
  // Verification prealable de l'existence du fichier
  const fileInfo = await FileSystem.getInfoAsync(audioUri);
  if (!fileInfo.exists) {
    throw new Error(`Fichier audio introuvable : ${audioUri}`);
  }

  // Construction du multipart/form-data
  // React Native FormData accepte {uri, name, type} pour les fichiers binaires
  const formData = new FormData();
  formData.append('title', profileName);
  formData.append('description', `Voix clonee pour ${profileName} (FamilyFlow)`);
  formData.append('voices', {
    uri: audioUri,
    name: `${profileName}.m4a`,
    type: 'audio/m4a',
  } as any);

  // POST vers l'API Fish Audio
  // Ne pas definir Content-Type manuellement : fetch l'ajoute avec le boundary pour FormData
  const response = await fetch('https://api.fish.audio/model', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => `${response.status}`);
    throw new Error(`Echec upload voix Fish Audio (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { _id?: string };
  if (!data._id) {
    throw new Error('Reponse Fish Audio invalide : _id manquant');
  }

  return data._id;
}
