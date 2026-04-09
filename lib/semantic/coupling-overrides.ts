// lib/semantic/coupling-overrides.ts
// Persistance des overrides per-categorie + stats semaine pour le couplage semantique.
// Phase 22 — UI config famille (COUPLING-03, COUPLING-05, COUPLING-06).
//
// Decisions : D-02a (cle absente = active par defaut), D-04a (cles SecureStore),
// D-04b (stats semaine incrementees apres effet applique), D-04d (reset auto lundi).
// Research Pitfall 6 : cache module-level pour eviter 5-15ms SecureStore sur hot path.

import * as SecureStore from 'expo-secure-store';
import type { CategoryId } from './categories';
import { getWeekStart } from './caps';

// ---------------------------------------------------------------------------
// Cles SecureStore (D-04a)
// ---------------------------------------------------------------------------

/** Cle SecureStore pour les overrides per-categorie (D-02a). */
export const OVERRIDES_KEY = 'semantic-overrides';

/** Cle SecureStore pour les stats semaine (D-04a). */
export const WEEK_STATS_KEY = 'semantic-stats-week';

// ---------------------------------------------------------------------------
// Cache module-level (Research Pitfall 6 — eviter 5-15ms SecureStore sur hot path)
// ---------------------------------------------------------------------------

let _overridesCache: Record<string, boolean> | null = null;

// ---------------------------------------------------------------------------
// Overrides per-categorie
// ---------------------------------------------------------------------------

/**
 * Charge les overrides per-categorie depuis SecureStore.
 * Utilise le cache module-level si disponible (evite les acces SecureStore sur hot path).
 * Cle absente = categorie active par defaut (D-02a).
 */
export async function loadOverrides(): Promise<Record<string, boolean>> {
  if (_overridesCache !== null) {
    return _overridesCache;
  }
  try {
    const raw = await SecureStore.getItemAsync(OVERRIDES_KEY);
    if (!raw) {
      _overridesCache = {};
      return _overridesCache;
    }
    _overridesCache = JSON.parse(raw) as Record<string, boolean>;
    return _overridesCache;
  } catch {
    return {};
  }
}

/**
 * Persiste les overrides per-categorie dans SecureStore.
 * Met a jour le cache module-level immediatement.
 */
export async function saveOverrides(overrides: Record<string, boolean>): Promise<void> {
  _overridesCache = overrides;
  await SecureStore.setItemAsync(OVERRIDES_KEY, JSON.stringify(overrides));
}

/**
 * Verifie si une categorie est active selon les overrides.
 * Cle absente = active par defaut (D-02a).
 */
export function isCategoryEnabled(catId: CategoryId, overrides: Record<string, boolean>): boolean {
  return overrides[catId] !== false;
}

// ---------------------------------------------------------------------------
// Stats semaine
// ---------------------------------------------------------------------------

/**
 * Charge les stats semaine depuis SecureStore.
 * Reset automatique si la semaine a change (D-04b/D-04d).
 * Retourne { weekKey: lundi courant, counts: {} } en cas d'absence ou d'erreur.
 */
export async function loadWeekStats(): Promise<{ weekKey: string; counts: Record<string, number> }> {
  const currentWeekKey = getWeekStart();
  try {
    const raw = await SecureStore.getItemAsync(WEEK_STATS_KEY);
    if (!raw) {
      return { weekKey: currentWeekKey, counts: {} };
    }
    const parsed = JSON.parse(raw) as { weekKey: string; counts: Record<string, number> };
    // Reset auto si la semaine a change (D-04d)
    if (parsed.weekKey !== currentWeekKey) {
      return { weekKey: currentWeekKey, counts: {} };
    }
    return parsed;
  } catch {
    return { weekKey: currentWeekKey, counts: {} };
  }
}

/**
 * Incremente le compteur de la categorie pour la semaine courante (D-04b).
 * Silencieux en cas d'erreur (stats — non-critical).
 */
export async function incrementWeekStat(catId: CategoryId): Promise<void> {
  try {
    const stats = await loadWeekStats();
    stats.counts[catId] = (stats.counts[catId] ?? 0) + 1;
    await SecureStore.setItemAsync(WEEK_STATS_KEY, JSON.stringify(stats));
  } catch { /* stats — non-critical */ }
}
