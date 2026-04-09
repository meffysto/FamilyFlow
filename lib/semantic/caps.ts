// lib/semantic/caps.ts
// Système anti-abus caps daily/weekly pour le couplage sémantique (SEMANTIC-07 / Phase 20).
// Décisions : D-06 (persistance SecureStore par-profil), D-07 (reset auto au changement
// de jour/semaine), D-08 (pure functions pour check et increment — testables sans SecureStore).
//
// Pattern identique à giftsSentToday déjà en production.
// Clé SecureStore : coupling-caps-{profileId} (chaîne JSON).

import * as SecureStore from 'expo-secure-store';
import type { CategoryId } from './categories';

// ---------------------------------------------------------------------------
// Types exportés
// ---------------------------------------------------------------------------

/** Compteurs daily/weekly pour un effet catégorie. */
export interface EffectCap {
  daily: number;     // compteur jour courant
  weekly: number;    // compteur semaine courante
  dayStart: string;  // YYYY-MM-DD — reset si différent de today
  weekStart: string; // YYYY-MM-DD (lundi) — reset si différent de thisWeek
}

/** Map partielle des caps par CategoryId. Si une entrée est absente, l'effet n'a jamais été déclenché. */
export type CouplingCaps = Partial<Record<CategoryId, EffectCap>>;

// ---------------------------------------------------------------------------
// Constantes de limites
// ---------------------------------------------------------------------------

/**
 * Cap daily par catégorie. 0 = pas de cap daily (cap hebdo uniquement).
 * Aligné sur le tableau PROJECT.md §Mapping 10 catégories → effets wow.
 */
export const DAILY_CAPS: Record<CategoryId, number> = {
  menage_quotidien: 1,
  menage_hebdo: 1,
  courses: 1,
  enfants_routines: 2,
  enfants_devoirs: 1,
  rendez_vous: 1,
  gratitude_famille: 2,
  budget_admin: 1,
  bebe_soins: 1,
  cuisine_repas: 0,       // 0 = pas de cap daily (cap hebdo uniquement — EFFECTS-10)
};

/**
 * Cap weekly par catégorie. Reinitialisation le lundi.
 * EFFECTS-10 : 1 recipe unlock / semaine.
 */
export const WEEKLY_CAPS: Record<CategoryId, number> = {
  menage_quotidien: 5,
  menage_hebdo: 3,
  courses: 3,
  enfants_routines: 10,
  enfants_devoirs: 5,
  rendez_vous: 3,
  gratitude_famille: 7,
  budget_admin: 3,
  bebe_soins: 5,
  cuisine_repas: 1,       // EFFECTS-10 : 1 recipe unlock / semaine
};

// ---------------------------------------------------------------------------
// Clé SecureStore
// ---------------------------------------------------------------------------

const CAPS_KEY_PREFIX = 'coupling-caps-';

// ---------------------------------------------------------------------------
// Helper interne
// ---------------------------------------------------------------------------

/**
 * Retourne la date du lundi de la semaine contenant `now` au format YYYY-MM-DD.
 * Exportée pour permettre les tests unitaires sans SecureStore.
 */
export function getWeekStart(now: Date = new Date()): string {
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// I/O SecureStore
// ---------------------------------------------------------------------------

/**
 * Charge les caps persistés pour un profil. Retourne `{}` si aucun cap
 * n'a encore été enregistré ou si SecureStore est indisponible (ARCH-03).
 */
export async function loadCaps(profileId: string): Promise<CouplingCaps> {
  try {
    const raw = await SecureStore.getItemAsync(`${CAPS_KEY_PREFIX}${profileId}`);
    if (!raw) return {};
    return JSON.parse(raw) as CouplingCaps;
  } catch {
    return {};
  }
}

/**
 * Persiste les caps d'un profil. Silencieux en cas d'erreur (non-critical).
 */
export async function saveCaps(profileId: string, caps: CouplingCaps): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      `${CAPS_KEY_PREFIX}${profileId}`,
      JSON.stringify(caps),
    );
  } catch { /* non-critical */ }
}

// ---------------------------------------------------------------------------
// Pure functions — check et increment (testables sans SecureStore)
// ---------------------------------------------------------------------------

/**
 * Vérifie si un effet est bloqué par son cap daily ou weekly.
 * Retourne `false` si la catégorie n'a encore aucun compteur (jamais déclenchée).
 *
 * @param now  Optionnel pour la testabilité (évite les tests fragiles selon l'heure).
 */
export function isCapExceeded(
  categoryId: CategoryId,
  caps: CouplingCaps,
  now?: Date,
): boolean {
  const today = (now ?? new Date()).toISOString().slice(0, 10);
  const thisWeek = getWeekStart(now);
  const cap = caps[categoryId];

  // Jamais utilisé = pas cappé
  if (!cap) return false;

  const dailyCount = cap.dayStart === today ? cap.daily : 0;
  const weeklyCount = cap.weekStart === thisWeek ? cap.weekly : 0;

  const dailyLimit = DAILY_CAPS[categoryId];
  const weeklyLimit = WEEKLY_CAPS[categoryId];

  // 0 signifie "pas de cap daily" (ex : cuisine_repas)
  if (dailyLimit > 0 && dailyCount >= dailyLimit) return true;
  if (weeklyLimit > 0 && weeklyCount >= weeklyLimit) return true;

  return false;
}

/**
 * Incrémente les compteurs daily et weekly pour une catégorie.
 * Pure function — retourne un nouvel objet (pas de mutation de `caps`).
 * Réinitialise automatiquement les compteurs périmés (jour ou semaine différente).
 *
 * @param now  Optionnel pour la testabilité.
 */
export function incrementCap(
  caps: CouplingCaps,
  categoryId: CategoryId,
  now?: Date,
): CouplingCaps {
  const today = (now ?? new Date()).toISOString().slice(0, 10);
  const thisWeek = getWeekStart(now);
  const existing = caps[categoryId];

  const dailyCount = existing && existing.dayStart === today ? existing.daily : 0;
  const weeklyCount = existing && existing.weekStart === thisWeek ? existing.weekly : 0;

  return {
    ...caps,
    [categoryId]: {
      daily: dailyCount + 1,
      weekly: weeklyCount + 1,
      dayStart: today,
      weekStart: thisWeek,
    },
  };
}
