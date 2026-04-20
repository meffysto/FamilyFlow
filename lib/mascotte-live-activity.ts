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
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import {
  startMascotteActivity,
  updateMascotteActivity,
  stopMascotteActivity,
  isMascotteActivityActive,
} from '../modules/vault-access/src';
import { COMPANION_SPRITES } from './mascot/companion-sprites';
import type { CompanionSpecies, CompanionStage } from './mascot/companion-types';

export type MascotteStageOverride = 'reveil' | 'travail' | 'midi' | 'jeu' | 'routine' | 'dodo';

export interface MascotteSnapshot {
  mascotteName: string;
  tasksDone: number;
  tasksTotal: number;
  xpGained: number;
  currentMeal: string | null;
  stageOverride?: MascotteStageOverride | null;
  /** Sprite compagnon encodé base64 (PNG). Affiché sur le Lock Screen. */
  companionSpriteBase64?: string | null;
  /** Mode récap de fin de journée (21-23h) — change la layout du widget. */
  recapMode?: boolean | null;
  /** Ligne bonus optionnelle affichée en mode récap (ex: level up du jour). */
  bonusText?: string | null;
}

let lastSnapshot: MascotteSnapshot | null = null;

/**
 * Charge le PNG idle_1 d'un compagnon et renvoie sa représentation base64.
 * Retourne null si l'espèce ou le stade n'ont pas de sprite mappé.
 */
export async function loadCompanionSpriteBase64(
  species: CompanionSpecies,
  stage: CompanionStage,
): Promise<string | null> {
  try {
    const entry = COMPANION_SPRITES[species]?.[stage];
    if (!entry) return null;
    const asset = Asset.fromModule(entry.idle_1);
    if (!asset.localUri) await asset.downloadAsync();
    if (!asset.localUri) return null;
    return await FileSystem.readAsStringAsync(asset.localUri, { encoding: 'base64' });
  } catch {
    return null;
  }
}

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
      snap.stageOverride ?? null,
      snap.companionSpriteBase64 ?? null,
      snap.recapMode ?? false,
      snap.bonusText ?? null,
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
      snap.stageOverride ?? null,
      snap.companionSpriteBase64 ?? null,
      snap.recapMode ?? false,
      snap.bonusText ?? null,
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
