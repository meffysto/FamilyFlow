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
  timeToSlot,
  fileToSlot,
  DEFAULT_TASK_DURATION_MIN,
} from './slot-mapping';
import { getDominantSlot, type CompletionHistory } from './completion-history';

export type AutoPlacementSource = 'explicit' | 'time' | 'history' | 'file' | 'nextfit';

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

  // 5. Next-fit : premier slot <= 75% chargé
  const used: Record<SlotId, number> = { matin: 0, midi: 0, aprem: 0, soir: 0 };
  for (const t of dayTasks) {
    const placed = t.timeSlot ?? null;
    if (!placed) continue; // ne compte que les tâches déjà placées (évite récursion)
    used[placed] += estimateTaskDuration(t);
  }
  for (const slot of SLOT_IDS) {
    if (used[slot] < 0.75 * SLOT_DEFINITIONS[slot].capacityMinutes) {
      return { slot, source: 'nextfit' };
    }
  }
  // Tout est plein → fallback dernier slot
  return { slot: 'soir', source: 'nextfit' };
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
