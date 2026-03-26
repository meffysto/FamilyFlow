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
