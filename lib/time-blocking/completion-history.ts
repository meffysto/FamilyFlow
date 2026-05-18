/**
 * completion-history.ts — Historique de complétion par slot (FIFO 10 par titre).
 *
 * Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * Stocké dans expo-secure-store sous clé `tasks.completionHistory`.
 * Format : { [taskTitle]: CompletionEntry[] } (max 10 par titre, FIFO).
 *
 * Utilisé par auto-placement.ts (source 'history' — mode statistique si >= 2 entrées).
 * Toutes les opérations sont silent-catch : l'historique est un bonus, jamais critique.
 */

import * as SecureStore from 'expo-secure-store';
import type { SlotId } from '../types';
import { SLOT_IDS } from './slot-mapping';

const STORAGE_KEY = 'tasks.completionHistory';
const MAX_ENTRIES_PER_TITLE = 10;
const MIN_ENTRIES_FOR_DOMINANT = 2;

export interface CompletionEntry {
  slot: SlotId;
  timestamp: string; // ISO
}

export type CompletionHistory = Record<string, CompletionEntry[]>;

/** Charge l'historique depuis SecureStore. Retourne {} si absent/corrompu. */
export async function loadHistory(): Promise<CompletionHistory> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as CompletionHistory;
  } catch {
    return {};
  }
}

/**
 * Ajoute une entrée de complétion pour ce titre. FIFO max 10 entrées par titre.
 * Silent-catch : ne lève jamais, même si SecureStore échoue.
 */
export async function saveCompletion(title: string, slot: SlotId): Promise<void> {
  try {
    const history = await loadHistory();
    const entries = history[title] ?? [];
    entries.push({ slot, timestamp: new Date().toISOString() });
    // FIFO max 10
    while (entries.length > MAX_ENTRIES_PER_TITLE) entries.shift();
    history[title] = entries;
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Silent : historique = bonus, jamais critique
  }
}

/**
 * Retourne le slot dominant (mode statistique) pour ce titre.
 * Requiert au moins 2 entrées — sinon retourne undefined (pas assez de signal).
 */
export function getDominantSlot(title: string, history: CompletionHistory): SlotId | undefined {
  const entries = history[title] ?? [];
  if (entries.length < MIN_ENTRIES_FOR_DOMINANT) return undefined;

  const counts: Record<SlotId, number> = { matin: 0, midi: 0, aprem: 0, soir: 0 };
  for (const e of entries) counts[e.slot]++;

  let best: SlotId = SLOT_IDS[0];
  let bestCount = 0;
  for (const slot of SLOT_IDS) {
    if (counts[slot] > bestCount) {
      best = slot;
      bestCount = counts[slot];
    }
  }
  return bestCount >= MIN_ENTRIES_FOR_DOMINANT ? best : undefined;
}
