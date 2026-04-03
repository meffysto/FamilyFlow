// ─────────────────────────────────────────────
// Événements saisonniers — Persistance SecureStore
// ─────────────────────────────────────────────

import { SecureStoreCompat as SecureStore } from './utils';
import type { SeasonalEventProgress } from './seasonal-events-types';

/** Clé SecureStore pour la liste de progression événements d'un profil */
function eventKey(profileId: string): string {
  return `seasonal_events_${profileId}`;
}

/**
 * Charge la liste de toutes les progressions événements d'un profil.
 * Retourne un tableau vide si aucune donnée ou en cas d'erreur.
 */
export async function loadEventProgressList(profileId: string): Promise<SeasonalEventProgress[]> {
  try {
    const raw = await SecureStore.getItemAsync(eventKey(profileId));
    if (!raw) return [];
    return JSON.parse(raw) as SeasonalEventProgress[];
  } catch {
    return [];
  }
}

/**
 * Sauvegarde ou met à jour la progression d'un événement pour un profil.
 * La clé composite (eventId + year) garantit l'unicité par événement et par année.
 */
export async function saveEventProgress(progress: SeasonalEventProgress): Promise<void> {
  try {
    const current = await loadEventProgressList(progress.profileId);
    const updated = [
      ...current.filter(
        (p) => !(p.eventId === progress.eventId && p.year === progress.year),
      ),
      progress,
    ];
    await SecureStore.setItemAsync(eventKey(progress.profileId), JSON.stringify(updated));
  } catch {
    // Non-critical — ignorer silencieusement
  }
}
