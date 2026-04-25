/**
 * voice-clone-pro.ts — Wrapper ElevenLabs Professional Voice Cloning (PVC).
 * Plus exigeant que l'IVC : samples ≥30s chacun, 30min+ recommandés au total,
 * training asynchrone (~3-4h), modèle dédié par voix.
 *
 * Endpoints utilisés (validés via spike avril 2026) :
 * - POST /v1/voices/pvc                       crée la voix         → { voice_id }
 * - POST /v1/voices/pvc/{id}/samples          upload multipart     → [{ sample_id, ... }]
 * - POST /v1/voices/pvc/{id}/train            déclenche training   → { status: 'ok' }
 * - GET  /v1/voices/{id}                      lit l'état           → fine_tuning.{state,progress}
 */
import * as FileSystem from 'expo-file-system/legacy';

const PVC_BASE = 'https://api.elevenlabs.io/v1/voices/pvc';

/** Modèle de référence utilisé pour suivre l'état du training (FR multilingue). */
export const PVC_REFERENCE_MODEL = 'eleven_multilingual_v2';

export type PvcModelState =
  | 'not_started'
  | 'queued'
  | 'fine_tuning'
  | 'fine_tuned'
  | 'failed';

export interface PvcVoiceState {
  /** État du modèle de référence (eleven_multilingual_v2). */
  state: PvcModelState | string;
  /** Progression 0..1 du modèle de référence (0 si non démarré). */
  progress: number;
  /** True si la voix est prête à être utilisée pour générer du TTS. */
  isReady: boolean;
  /** True si le training a échoué de manière irrécupérable. */
  isFailed: boolean;
  /** Durée d'audio totale acceptée par ElevenLabs (peut différer de la somme uploadée). */
  datasetDurationSeconds: number | null;
  /** Nombre d'échantillons enregistrés. */
  samplesCount: number;
  /** Modèles supportés une fois la voix entraînée — utilisé pour griser les options incompatibles. */
  supportedModels: string[];
  /** Message d'erreur ou d'info si présent. */
  message: string | null;
}

/**
 * Crée une voix PVC vide. Doit être suivie d'au moins un upload de sample
 * de ≥30s avant que le training puisse être déclenché.
 */
export async function createPvcVoice(
  apiKey: string,
  name: string,
  language: string = 'fr',
  description: string = '',
): Promise<string> {
  const response = await fetch(PVC_BASE, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ name, language, description }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => `${response.status}`);
    throw new Error(`Échec création voix Pro (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { voice_id?: string };
  if (!data.voice_id) {
    throw new Error('Réponse ElevenLabs invalide : voice_id manquant');
  }
  return data.voice_id;
}

/**
 * Ajoute un ou plusieurs samples à une voix PVC existante.
 * Chaque sample doit faire au moins 30 secondes (sinon HTTP 400 voice_too_short).
 * @returns Tableau { sample_id, duration_secs } pour chaque fichier accepté.
 */
export async function addPvcSamples(
  apiKey: string,
  voiceId: string,
  audioUris: string[],
): Promise<Array<{ sampleId: string; durationSecs: number }>> {
  if (audioUris.length === 0) {
    throw new Error('Aucun fichier audio à uploader');
  }

  const formData = new FormData();
  for (let i = 0; i < audioUris.length; i++) {
    const uri = audioUris[i];
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error(`Fichier audio introuvable : ${uri}`);
    }
    formData.append('files', {
      uri,
      name: `sample_${i + 1}.m4a`,
      type: 'audio/m4a',
    } as any);
  }

  const response = await fetch(`${PVC_BASE}/${voiceId}/samples`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => `${response.status}`);
    if (response.status === 400 && errorText.includes('voice_too_short')) {
      throw new Error('Chaque enregistrement doit durer au moins 30 secondes.');
    }
    throw new Error(`Échec upload sample Pro (${response.status}): ${errorText}`);
  }

  const data = await response.json() as Array<{ sample_id: string; duration_secs: number }>;
  return data.map(s => ({ sampleId: s.sample_id, durationSecs: s.duration_secs }));
}

/**
 * Déclenche l'entraînement de la voix PVC. Async — le training dure ~3-4h.
 * Suivre via {@link getPvcVoiceState}.
 *
 * Note : l'API renvoie `{status: "ok"}` même si le dataset est insuffisant.
 * Vérifier ensuite via getPvcVoiceState que `state` passe bien à `queued/fine_tuning`.
 */
export async function triggerPvcTraining(apiKey: string, voiceId: string): Promise<void> {
  const response = await fetch(`${PVC_BASE}/${voiceId}/train`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: '{}',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => `${response.status}`);
    if (response.status === 400 && errorText.includes('no_samples')) {
      throw new Error('Ajoutez au moins un enregistrement avant de lancer l\'entraînement.');
    }
    throw new Error(`Échec lancement entraînement (${response.status}): ${errorText}`);
  }
}

/**
 * Lit l'état d'une voix PVC (samples, training, modèles disponibles).
 * À utiliser pour le polling après triggerPvcTraining.
 */
export async function getPvcVoiceState(
  apiKey: string,
  voiceId: string,
  referenceModel: string = PVC_REFERENCE_MODEL,
): Promise<PvcVoiceState> {
  const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => `${response.status}`);
    throw new Error(`Échec lecture état voix (${response.status}): ${errorText}`);
  }

  type VoiceResp = {
    samples?: Array<{ sample_id: string }> | null;
    fine_tuning?: {
      state?: Record<string, string> | null;
      progress?: Record<string, number> | null;
      message?: Record<string, string> | null;
      dataset_duration_seconds?: number | null;
    } | null;
    high_quality_base_model_ids?: string[] | null;
  };

  const data = await response.json() as VoiceResp;
  const ft = data.fine_tuning ?? {};
  const stateMap = ft.state ?? {};
  const progressMap = ft.progress ?? {};
  const messageMap = ft.message ?? {};

  const refState = stateMap[referenceModel] ?? 'not_started';
  const refProgress = typeof progressMap[referenceModel] === 'number' ? progressMap[referenceModel] : 0;
  const refMessage = typeof messageMap[referenceModel] === 'string' ? messageMap[referenceModel] : null;
  const supportedModels = data.high_quality_base_model_ids ?? [];

  return {
    state: refState,
    progress: refProgress,
    isReady: refState === 'fine_tuned' || supportedModels.includes(referenceModel),
    isFailed: refState === 'failed',
    datasetDurationSeconds: ft.dataset_duration_seconds ?? null,
    samplesCount: (data.samples ?? []).length,
    supportedModels,
    message: refMessage,
  };
}

/**
 * Supprime une voix PVC (utile pour libérer un slot voix sur le compte ElevenLabs).
 */
export async function deletePvcVoice(apiKey: string, voiceId: string): Promise<void> {
  const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => `${response.status}`);
    throw new Error(`Échec suppression voix (${response.status}): ${errorText}`);
  }
}
