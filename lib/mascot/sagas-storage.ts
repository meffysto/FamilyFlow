// ─────────────────────────────────────────────
// Sagas narratives — Persistance SecureStore
// ─────────────────────────────────────────────

import type { SagaProgress } from './sagas-types';
import { SecureStoreCompat as SecureStore } from './utils';

/** Clé SecureStore pour la progression saga d'un profil */
function sagaKey(profileId: string): string {
  return `saga_progress_${profileId}`;
}

/** Clé pour la date de dernière complétion de saga */
function lastCompletionKey(profileId: string): string {
  return `saga_last_completion_${profileId}`;
}

/**
 * Charge la progression saga active d'un profil.
 * Retourne null si aucune saga en cours.
 */
export async function loadSagaProgress(profileId: string): Promise<SagaProgress | null> {
  try {
    const raw = await SecureStore.getItemAsync(sagaKey(profileId));
    if (!raw) return null;
    return JSON.parse(raw) as SagaProgress;
  } catch {
    return null;
  }
}

/**
 * Sauvegarde la progression saga d'un profil.
 */
export async function saveSagaProgress(progress: SagaProgress): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      sagaKey(progress.profileId),
      JSON.stringify(progress),
    );
  } catch {
    // Silently fail — non-critical
  }
}

/**
 * Supprime la progression saga d'un profil (après complétion ou reset).
 */
export async function clearSagaProgress(profileId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(sagaKey(profileId));
  } catch {
    // Silently fail
  }
}

/**
 * Charge la date de dernière complétion de saga.
 */
export async function loadLastSagaCompletion(profileId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(lastCompletionKey(profileId));
  } catch {
    return null;
  }
}

/**
 * Sauvegarde la date de dernière complétion de saga.
 */
export async function saveLastSagaCompletion(profileId: string, date: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(lastCompletionKey(profileId), date);
  } catch {
    // Silently fail
  }
}

/** Clé SecureStore pour la liste des sagas complétées d'un profil */
function completedSagasKey(profileId: string): string {
  return `saga_completed_${profileId}`;
}

/**
 * Charge la liste des IDs de sagas complétées par un profil.
 */
export async function loadCompletedSagas(profileId: string): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(completedSagasKey(profileId));
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Sauvegarde la liste des IDs de sagas complétées par un profil.
 */
export async function saveCompletedSagas(profileId: string, ids: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(completedSagasKey(profileId), JSON.stringify(ids));
  } catch {
    // Silently fail
  }
}

/**
 * Réinitialise tout l'état saga d'un profil (dev only).
 */
export async function resetAllSagaState(profileId: string): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(sagaKey(profileId)),
      SecureStore.deleteItemAsync(lastCompletionKey(profileId)),
      SecureStore.deleteItemAsync(completedSagasKey(profileId)),
    ]);
  } catch {
    // Silently fail
  }
}

// ─────────────────────────────────────────────
// Migration versionnée (FAM-24)
// ─────────────────────────────────────────────

// Bumper cette constante force un reset des sagas pour TOUS les profils
// à la prochaine ouverture de l'app. Utile quand le contenu des sagas change
// ou qu'un bug de rotation a pu emprisonner les profils sur une saga unique.
const SAGA_RESET_VERSION = 'v2-fam24';
const SAGA_RESET_VERSION_KEY = 'saga_reset_version';

/**
 * Réinitialise l'état saga de tous les profils si la version stockée diffère
 * de SAGA_RESET_VERSION. Idempotent — safe à appeler à chaque boot.
 * Retourne true si un reset a effectivement été appliqué.
 */
export async function maybeResetSagasForVersion(
  profileIds: string[],
): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(SAGA_RESET_VERSION_KEY);
    if (stored === SAGA_RESET_VERSION) return false;
    await Promise.all(profileIds.map(id => resetAllSagaState(id)));
    await SecureStore.setItemAsync(SAGA_RESET_VERSION_KEY, SAGA_RESET_VERSION);
    return true;
  } catch {
    return false;
  }
}
