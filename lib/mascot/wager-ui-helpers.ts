/**
 * Phase 40 — Helpers purs pour l'UI Sporée (seed picker + badge).
 *
 * Fonctions pures, zéro I/O, zéro import hook/UI, testables en isolation.
 * Consommé par SporéeDurationPicker (Plan 02), PlantWagerBadge (Plan 03),
 * et useFarm.startWager (persistance totalDays — B2 élimination magic number 7).
 */

import type { WagerDuration, WagerMultiplier } from './types';

// ─────────────────────────────────────────────
// Constantes partagées (source unique de vérité)
// ─────────────────────────────────────────────

/** Facteur de durée appliqué à `tasksPerStage * 4` pour dériver absoluteTasks. */
export const DURATION_FACTORS: Record<WagerDuration, number> = {
  chill: 1.0,
  engage: 0.7,
  sprint: 0.5,
};

/** Multiplicateur de reward par durée (cultures standard — entiers, pas fractionnaires). */
export const MULTIPLIERS: Record<WagerDuration, WagerMultiplier> = {
  chill: 2,
  engage: 3,
  sprint: 4,
};

/** Multiplicateur par durée pour cultures rares/expédition — chill exclu, valeurs plus basses. */
export const MULTIPLIERS_RARE: Record<WagerDuration, WagerMultiplier> = {
  chill: 2,   // jamais utilisé (filtré côté UI) — typage seulement
  engage: 2,
  sprint: 3,
};

/** Durées autorisées selon le tier (rare + expedition = pas de chill). */
export const ALLOWED_DURATIONS: Record<'base' | 'rare' | 'expedition', WagerDuration[]> = {
  base: ['chill', 'engage', 'sprint'],
  rare: ['engage', 'sprint'],
  expedition: ['engage', 'sprint'],
};

/** Retourne le multiplier correct selon tier + duration. */
export function getMultiplierForTier(
  tier: 'base' | 'rare' | 'expedition',
  duration: WagerDuration,
): WagerMultiplier {
  return (tier === 'base' ? MULTIPLIERS : MULTIPLIERS_RARE)[duration];
}

/** Scaling du cumulTarget par durée — Chill ×2.0 / Engagé ×2.5 / Sprint ×3.0.
 *  Appliqué sur `tasksPerStage × 4` (stages totaux du plant). */
export const CUMUL_SCALING: Record<WagerDuration, number> = {
  chill: 2.0,
  engage: 2.5,
  sprint: 3.0,
};

/** Plafond absolu du cumulTarget — évite les marathons sur crops rares haut-niveau. */
export const CUMUL_MAX = 30;

/** Calcule le cumulTarget d'un pari — formule déterministe basée uniquement sur
 *  le crop (tasksPerStage) et la durée. Pas de prorata famille, pas de pending.
 *  Plafonné à CUMUL_MAX pour jouabilité. */
export function computeWagerCumul(tasksPerStage: number, duration: WagerDuration): number {
  const baseTasks = Math.max(1, tasksPerStage) * 4;
  return Math.min(CUMUL_MAX, Math.max(1, Math.ceil(baseTasks * CUMUL_SCALING[duration])));
}

/** Projection UI : heures estimées par tâche ménagère (moyenne famille). */
const HOURS_PER_TASK = 6;

/** Ordre stable des options présentées à l'UI. */
const DURATION_ORDER: WagerDuration[] = ['chill', 'engage', 'sprint'];

// ─────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────

/** Niveau de pace pour le badge 2-lignes (B1). */
export type PaceLevel = 'green' | 'yellow' | 'orange';

/** Option d'une durée présentée dans le seed picker. */
export interface WagerDurationOption {
  duration: WagerDuration;
  multiplier: WagerMultiplier;
  targetTasks: number;
  absoluteTasks: number;
  estimatedHours: number;
}

// ─────────────────────────────────────────────
// 1. computeWagerDurations (seed picker, Plan 02)
// ─────────────────────────────────────────────

/**
 * Calcule les options de durée du seed picker — formule déterministe.
 *
 * - absoluteTasks = max(1, ceil(tasksPerStage × 4 × facteur durée)) — stages plant
 * - estimatedHours = absoluteTasks × 6 (projection UI)
 * - targetTasks = computeWagerCumul(tasksPerStage, duration) — cumul du pari
 * - multiplier = getMultiplierForTier(tier, duration) — reward ×N
 *
 * Tier rare/expedition filtre le chill.
 * Retourne les options dans l'ordre stable chill → engage → sprint.
 */
export function computeWagerDurations(
  tasksPerStage: number,
  tier: 'base' | 'rare' | 'expedition' = 'base',
): WagerDurationOption[] {
  const safeTasksPerStage = Math.max(0, tasksPerStage);
  const allowed = ALLOWED_DURATIONS[tier];
  return DURATION_ORDER
    .filter(d => allowed.includes(d))
    .map(duration => {
      const factor = DURATION_FACTORS[duration];
      const absoluteTasks = Math.max(1, Math.ceil(safeTasksPerStage * 4 * factor));
      return {
        duration,
        multiplier: getMultiplierForTier(tier, duration),
        targetTasks: computeWagerCumul(safeTasksPerStage, duration),
        absoluteTasks,
        estimatedHours: absoluteTasks * HOURS_PER_TASK,
      };
    });
}

// ─────────────────────────────────────────────
// 2. computePaceLevel (badge 2-lignes B1)
// ─────────────────────────────────────────────

/**
 * Dérive la couleur du badge selon le pace actuel :
 *   ratio = (cumulCurrent / max(1, cumulTarget)) / max(0.01, daysElapsed / max(1, totalDays))
 *   ratio ≥ 1.0 → green
 *   ratio ≥ 0.7 → yellow
 *   ratio < 0.7 → orange
 *
 * Fallbacks bienveillants :
 *   - cumulTarget = 0 → green (pari auto-gagné D-04)
 *   - daysElapsed = 0 → green (premier jour jamais punitif)
 */
export function computePaceLevel(
  cumulCurrent: number,
  cumulTarget: number,
  daysElapsed: number,
  totalDays: number,
): PaceLevel {
  if (cumulTarget === 0) return 'green';
  if (daysElapsed === 0) return 'green';
  const progress = cumulCurrent / Math.max(1, cumulTarget);
  const timeShare = Math.max(0.01, daysElapsed / Math.max(1, totalDays));
  const ratio = progress / timeShare;
  if (ratio >= 1.0) return 'green';
  if (ratio >= 0.7) return 'yellow';
  return 'orange';
}

// ─────────────────────────────────────────────
// 3. computeWagerTotalDays (B2 — source unique de vérité)
// ─────────────────────────────────────────────

/**
 * Calcule `totalDays` PERSISTÉ sur WagerModifier au moment du startWager.
 * Élimine le magic number 7 côté UI (B2) : tous les consommateurs lisent
 * `wager.totalDays ?? 1` sans jamais recalculer.
 *
 *   absoluteTasks = max(1, ceil(tasksPerStage × 4 × facteur))
 *   estimatedHours = absoluteTasks × 6
 *   totalDays = max(1, ceil(estimatedHours / 24))
 */
export function computeWagerTotalDays(
  duration: WagerDuration,
  tasksPerStage: number,
): number {
  const safeTasksPerStage = Math.max(0, tasksPerStage);
  const factor = DURATION_FACTORS[duration];
  const absoluteTasks = Math.max(1, Math.ceil(safeTasksPerStage * 4 * factor));
  const estimatedHours = absoluteTasks * HOURS_PER_TASK;
  return Math.max(1, Math.ceil(estimatedHours / 24));
}

// ─────────────────────────────────────────────
// 4. daysBetween (helper date locale ISO)
// ─────────────────────────────────────────────

/**
 * Nombre de jours entre deux dates locales ISO (YYYY-MM-DD).
 * Jamais négatif : si endISO < startISO retourne 0.
 * Exploité par PlantWagerBadge (Plan 03) pour calculer daysElapsed depuis appliedAt.
 */
export function daysBetween(startISO: string, endISO: string): number {
  const startMs = new Date(startISO + 'T00:00:00').getTime();
  const endMs = new Date(endISO + 'T00:00:00').getTime();
  const diffDays = Math.round((endMs - startMs) / 86400000);
  return Math.max(0, diffDays);
}

// ─────────────────────────────────────────────
// 5. buildWagerHarvestToast (Plan 04 — format FR strict post-récolte)
// ─────────────────────────────────────────────

/**
 * Construit le message de toast affiché après récolte d'un plant scellé (SPOR-07).
 *
 * 3 variantes strictes :
 *  - won=false             → "Plant récolté · Sporée consommée" (neutre, JAMAIS punitif — Core Value)
 *  - won=true, dropBack=F  → "Victoire ! +{qty} {emoji} (×{mult})"
 *  - won=true, dropBack=T  → "Victoire ! +{qty} {emoji} (×{mult}) · Sporée retrouvée 🎁"
 *
 * `finalQty` est la quantité de crops déposée dans harvestInventory (pas des feuilles !).
 * L'emoji reflète la culture récoltée (🥔 patate, 🥕 carotte…) — la conversion en feuilles
 * dépendables se fait à la vente via sellHarvest.
 *
 * Le consommateur (useFarm.harvest) décide du `type` ToastContext (success/info)
 * selon `won`. Ce helper est pur — zéro I/O, zéro import UI.
 */
export function buildWagerHarvestToast(opts: {
  won: boolean;
  finalQty: number;
  multiplier: number;
  dropBack: boolean;
  cropEmoji?: string;
}): string {
  if (!opts.won) return 'Plant récolté · Sporée consommée';
  const suffix = opts.dropBack ? ' · Sporée retrouvée 🎁' : '';
  const emoji = opts.cropEmoji ?? '🌾';
  return `Victoire ! +${opts.finalQty} ${emoji} (×${opts.multiplier})${suffix}`;
}
