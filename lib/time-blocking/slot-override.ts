/**
 * slot-override.ts — apprentissage des déplacements manuels.
 *
 * Quand l'utilisateur tap le SlotBadge et choisit un slot différent, on
 * enregistre la préférence par titre. Au bout de 2 occurrences (≥ 2 tap sur
 * le même slot pour le même titre), l'auto-placement utilise cette préférence
 * comme signal au-dessus de l'historique de complétion (corriger explicitement
 * est un signal plus fort qu'observer indirectement).
 *
 * Time-blocking v2.
 *
 * Stocké dans expo-secure-store sous clé `tasks.slotOverride`.
 * Toutes les opérations sont silent-catch : l'override est un bonus, jamais
 * critique pour le fonctionnement de l'app.
 */

import * as SecureStore from 'expo-secure-store';
import type { SlotId } from '../types';

const STORAGE_KEY = 'tasks.slotOverride';
const MIN_COUNT_FOR_OVERRIDE = 2;

export interface SlotOverrideEntry {
  slot: SlotId;
  count: number;
  lastUpdate: string;
}

export type SlotOverrideStore = Record<string, SlotOverrideEntry>;

/** Charge le store depuis SecureStore. Retourne {} si absent/corrompu. */
export async function loadOverrides(): Promise<SlotOverrideStore> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as SlotOverrideStore;
  } catch {
    return {};
  }
}

/**
 * Enregistre un déplacement manuel pour ce titre.
 * - Si le slot est le même qu'avant : incrémente le compteur.
 * - Sinon : reset à 1 (l'utilisateur change d'avis).
 * Silent-catch : ne lève jamais.
 */
export async function recordOverride(title: string, slot: SlotId): Promise<void> {
  try {
    const store = await loadOverrides();
    const existing = store[title];
    if (existing && existing.slot === slot) {
      store[title] = { slot, count: existing.count + 1, lastUpdate: new Date().toISOString() };
    } else {
      // Slot différent : reset count à 1
      store[title] = { slot, count: 1, lastUpdate: new Date().toISOString() };
    }
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* silent — non-critical */
  }
}

/**
 * Retourne le slot override SI count >= 2 pour ce titre, sinon null.
 * Pure function — accepte le store déjà chargé pour éviter une await.
 */
export function getOverride(title: string, store: SlotOverrideStore): SlotId | null {
  const entry = store[title];
  if (entry && entry.count >= MIN_COUNT_FOR_OVERRIDE) return entry.slot;
  return null;
}

/** Réinitialise un titre (pour tests / nettoyage utilisateur). */
export async function clearOverride(title: string): Promise<void> {
  try {
    const store = await loadOverrides();
    delete store[title];
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* silent */
  }
}
