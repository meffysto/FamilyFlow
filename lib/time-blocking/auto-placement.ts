/**
 * auto-placement.ts — Chaîne de décision pour placer une tâche dans un slot.
 *
 * Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * Ordre de priorité (court-circuit dès qu'une source répond) :
 *   1. explicit  : task.timeSlot est défini (verrou utilisateur)
 *   2. time      : task.reminderTime ou dueDate avec heure ISO
 *   3. history   : slot dominant statistique (>= 2 entrées)
 *   4. file      : pattern Routine matin/soir dans sourceFile
 *   5. nextfit   : premier slot <= 75% chargé (fallback : 'soir')
 *
 * Module pur — la décision est calculée en mémoire à chaque render.
 * SEUL le source 'explicit' provient du vault ; les autres sont volatils
 * (pas de pollution markdown).
 */

import type { Task, SlotId } from '../types';
import {
  SLOT_IDS,
  SLOT_DEFINITIONS,
  SLOT_AFFINITY,
  timeToSlot,
  fileToSlot,
  titleToSlot,
  DEFAULT_TASK_DURATION_MIN,
} from './slot-mapping';
import { getDominantSlot, type CompletionHistory } from './completion-history';
import { titleToEffort, type EffortType } from './effort';

export type AutoPlacementSource = 'explicit' | 'time' | 'history' | 'file' | 'title' | 'nextfit';

export interface AutoPlacementResult {
  slot: SlotId;
  source: AutoPlacementSource;
}

/**
 * Calcule le slot d'une tâche selon la chaîne de décision.
 *
 * @param task        Tâche à placer
 * @param dayTasks    Tâches du jour sélectionné (pour le calcul nextfit)
 * @param history     Historique de complétion (pour le mode statistique)
 */
export function computeAutoSlot(
  task: Task,
  dayTasks: Task[],
  history: CompletionHistory,
): AutoPlacementResult {
  // 1. Explicit : timeSlot verrouillé par l'utilisateur
  if (task.timeSlot) {
    return { slot: task.timeSlot, source: 'explicit' };
  }

  // 2. Time : reminderTime ou dueDate avec heure ISO
  if (task.reminderTime) {
    return { slot: timeToSlot(task.reminderTime), source: 'time' };
  }
  if (task.dueDate && task.dueDate.includes('T')) {
    const timePart = task.dueDate.split('T')[1];
    if (timePart && /^\d{2}:\d{2}/.test(timePart)) {
      return { slot: timeToSlot(timePart), source: 'time' };
    }
  }

  // 3. History : slot dominant statistique (>= 2 entrées)
  const dominant = getDominantSlot(task.text, history);
  if (dominant) {
    return { slot: dominant, source: 'history' };
  }

  // 4. File : pattern Routine matin/soir
  const fromFile = fileToSlot(task.sourceFile);
  if (fromFile) {
    return { slot: fromFile, source: 'file' };
  }

  // 4.5 Title : mot-clé temporel strict dans le titre ("biberon soir", "table matin")
  const fromTitle = titleToSlot(task.text);
  if (fromTitle) {
    return { slot: fromTitle, source: 'title' };
  }

  // 5. Next-fit : premier slot <= 75% chargé
  const used: Record<SlotId, number> = { matin: 0, midi: 0, aprem: 0, soir: 0 };
  for (const t of dayTasks) {
    const placed = t.timeSlot ?? null;
    if (!placed) continue; // ne compte que les tâches déjà placées (évite récursion)
    used[placed] += estimateTaskDuration(t);
  }
  // Pour computeAutoSlot (appel unitaire), on garde le comportement v1 (effort=null).
  // computeDayPlacement passe l'effort calculé via titleToEffort dans la Pass 2.
  return { slot: pickNextFit(used, null), source: 'nextfit' };
}

/**
 * Estimation de la durée d'une tâche en minutes.
 * Si reminderTime contient "Xmin" la lit ; sinon défaut 15min.
 */
export function estimateTaskDuration(task: Task): number {
  if (task.reminderTime) {
    const m = task.reminderTime.match(/(\d+)\s*min/i);
    if (m) return parseInt(m[1], 10);
  }
  return DEFAULT_TASK_DURATION_MIN;
}

export interface PlacedTask {
  task: Task;
  slot: SlotId;
  source: AutoPlacementSource;
}

/**
 * Bloc occupé par un événement non-tâche (RDV, événement calendrier).
 * Sa charge est ajoutée à la capacité du slot avant le calcul nextfit
 * pour éviter de saturer un slot déjà occupé par un RDV.
 */
export interface OccupiedBlock {
  slot: SlotId;
  minutes: number;
}

/**
 * Calcule le placement de TOUTES les tâches d'une journée en cumulant la charge.
 *
 * Différence cruciale avec un appel naïf de `computeAutoSlot` par tâche :
 * - Pass 1 : place les tâches à signal fort (explicit, time, history, file)
 * - Pass 2 : place les tâches sans signal via nextfit, en CUMULANT la charge
 *   au fur et à mesure pour qu'elles se répartissent dans les 4 slots
 *
 * Sans ce two-pass, 22 tâches sans signal finiraient toutes en matin
 * (le nextfit ne voit aucune charge accumulée car les autres tâches
 *  volatiles n'ont pas de timeSlot écrit dans le vault).
 *
 * `occupiedBlocks` permet de réserver la capacité utilisée par les RDV du jour
 * pour qu'ils soient pris en compte dans le bilan de charge (un slot avec
 * RDV de 60min commence avec 60min de charge initiale).
 */
export function computeDayPlacement(
  dayTasks: Task[],
  history: CompletionHistory,
  occupiedBlocks: OccupiedBlock[] = [],
): PlacedTask[] {
  const placed: PlacedTask[] = [];
  const needsNextfit: Task[] = [];

  // Pass 1 — signal fort, pas de nextfit
  for (const task of dayTasks) {
    const result = computeAutoSlotSignalOnly(task, history);
    if (result) {
      placed.push({ task, slot: result.slot, source: result.source });
    } else {
      needsNextfit.push(task);
    }
  }

  // Charge initiale : blocs RDV + tâches déjà placées par signal fort
  const used: Record<SlotId, number> = { matin: 0, midi: 0, aprem: 0, soir: 0 };
  for (const block of occupiedBlocks) {
    used[block.slot] += block.minutes;
  }
  for (const p of placed) {
    used[p.slot] += estimateTaskDuration(p.task);
  }

  // Pass 2 — nextfit avec charge cumulée (RDV-aware)
  for (const task of needsNextfit) {
    const effort = titleToEffort(task.text);
    const slot = pickNextFit(used, effort);
    placed.push({ task, slot, source: 'nextfit' });
    used[slot] += estimateTaskDuration(task);
  }

  return placed;
}

/**
 * Variante de computeAutoSlot qui s'arrête avant le nextfit (sources 1-4 uniquement).
 * Retourne null si aucun signal n'est trouvé.
 */
function computeAutoSlotSignalOnly(
  task: Task,
  history: CompletionHistory,
): AutoPlacementResult | null {
  if (task.timeSlot) {
    return { slot: task.timeSlot, source: 'explicit' };
  }
  if (task.reminderTime) {
    return { slot: timeToSlot(task.reminderTime), source: 'time' };
  }
  if (task.dueDate && task.dueDate.includes('T')) {
    const timePart = task.dueDate.split('T')[1];
    if (timePart && /^\d{2}:\d{2}/.test(timePart)) {
      return { slot: timeToSlot(timePart), source: 'time' };
    }
  }
  const dominant = getDominantSlot(task.text, history);
  if (dominant) {
    return { slot: dominant, source: 'history' };
  }
  const fromFile = fileToSlot(task.sourceFile);
  if (fromFile) {
    return { slot: fromFile, source: 'file' };
  }
  const fromTitle = titleToSlot(task.text);
  if (fromTitle) {
    return { slot: fromTitle, source: 'title' };
  }
  return null;
}

/**
 * Renvoie le premier slot adapté pour la tâche.
 *
 * 1. Si un effort est fourni : priorité aux slots dont l'affinité chronotype
 *    correspond ET qui ont encore de la capacité (< 75% chargé).
 * 2. Fallback : premier slot avec capacité (comportement v1).
 * 3. Tous saturés : slot le moins chargé.
 */
function pickNextFit(used: Record<SlotId, number>, effort: EffortType | null): SlotId {
  // 1. Slot avec capacité ET affinité matching (préférence chronotype)
  if (effort) {
    for (const slot of SLOT_IDS) {
      const def = SLOT_DEFINITIONS[slot];
      if (used[slot] < 0.75 * def.capacityMinutes && SLOT_AFFINITY[slot] === effort) {
        return slot;
      }
    }
  }
  // 2. Fallback : premier slot avec capacité (comportement v1)
  for (const slot of SLOT_IDS) {
    if (used[slot] < 0.75 * SLOT_DEFINITIONS[slot].capacityMinutes) {
      return slot;
    }
  }
  // 3. Tous saturés → on retombe sur le slot le moins chargé pour ne jamais
  // empiler 100% dans le premier (évite le "tout matin" en cas de surcharge).
  let bestSlot: SlotId = 'soir';
  let bestUsed = used[bestSlot];
  for (const slot of SLOT_IDS) {
    if (used[slot] < bestUsed) {
      bestSlot = slot;
      bestUsed = used[slot];
    }
  }
  return bestSlot;
}
