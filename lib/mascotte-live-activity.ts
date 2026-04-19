/**
 * mascotte-live-activity.ts — Orchestre la Live Activity "journée de la mascotte"
 *
 * V1 :
 * - Démarrage manuel via startMascotte() depuis un bouton UI.
 * - Updates déclenchées sur tâche cochée, repas sélectionné, XP gagné.
 * - Arrêt manuel via stopMascotte() ou automatique par iOS après ~8h.
 *
 * Fire-and-forget : aucune erreur ne remonte, l'app continue toujours.
 */

import { Platform } from 'react-native';
import {
  startMascotteActivity,
  updateMascotteActivity,
  stopMascotteActivity,
  isMascotteActivityActive,
} from '../modules/vault-access/src';

export interface MascotteSnapshot {
  mascotteName: string;
  tasksDone: number;
  tasksTotal: number;
  xpGained: number;
  currentMeal: string | null;
}

let lastSnapshot: MascotteSnapshot | null = null;

/**
 * Démarre la Live Activity mascotte. Idempotent :
 * si une activity tourne déjà, elle est remplacée.
 */
export async function startMascotte(snap: MascotteSnapshot): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  lastSnapshot = snap;
  try {
    return await startMascotteActivity(
      snap.mascotteName,
      snap.tasksDone,
      snap.tasksTotal,
      snap.xpGained,
      snap.currentMeal,
    );
  } catch {
    return false;
  }
}

/**
 * Met à jour l'état affiché si une activity est active. No-op sinon.
 * Appeler quand une tâche est cochée, un repas mis à jour, ou des XP gagnés.
 */
export async function refreshMascotte(snap: MascotteSnapshot): Promise<void> {
  if (Platform.OS !== 'ios') return;
  lastSnapshot = snap;
  try {
    const active = await isMascotteActivityActive();
    if (!active) return;
    await updateMascotteActivity(
      snap.tasksDone,
      snap.tasksTotal,
      snap.xpGained,
      snap.currentMeal,
    );
  } catch {
    // silencieux — feature non critique
  }
}

/**
 * Met à jour depuis le dernier snapshot avec des valeurs partielles.
 * Utile pour les sites d'appel qui ne connaissent qu'une partie des données.
 */
export async function patchMascotte(patch: Partial<MascotteSnapshot>): Promise<void> {
  if (!lastSnapshot) return;
  const merged: MascotteSnapshot = { ...lastSnapshot, ...patch };
  return refreshMascotte(merged);
}

export async function stopMascotte(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  lastSnapshot = null;
  try {
    await stopMascotteActivity();
  } catch {
    // silencieux
  }
}

export async function isMascotteActive(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await isMascotteActivityActive();
  } catch {
    return false;
  }
}
