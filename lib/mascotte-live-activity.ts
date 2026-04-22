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
import { COMPANION_SPRITES, type CompanionMood } from './mascot/companion-sprites';
import type { CompanionSpecies, CompanionStage } from './mascot/companion-types';

export type MascotteStageOverride = 'reveil' | 'travail' | 'midi' | 'jeu' | 'routine' | 'dodo' | 'recap';

export interface MascotteSnapshot {
  mascotteName: string;
  tasksDone: number;
  tasksTotal: number;
  xpGained: number;
  currentMeal: string | null;
  stageOverride?: MascotteStageOverride | null;
  /** Sprite compagnon encodé base64 (PNG). Affiché sur le Lock Screen. */
  companionSpriteBase64?: string | null;
  /** Ligne bonus optionnelle affichée en stage recap (ex: level up du jour). */
  bonusText?: string | null;
  /** Prochaine tâche à faire (récurrente prioritaire). Affichée pendant reveil/travail/jeu/routine. */
  nextTaskText?: string | null;
  /** ID unique de la prochaine tâche — consommé par ToggleNextTaskIntent (iOS 17+). */
  nextTaskId?: string | null;
  /** Prochain RDV dans les 24h (ex: "Pédiatre 14:30"). Affiché pendant midi. */
  nextRdvText?: string | null;
  /** Bulle de dialogue courte du compagnon (≤44 chars). Remplace le subtitle narratif. */
  speechBubble?: string | null;
  /** Phase 42 — Buff XP actif (D-22). Override speechBubble par défaut en "Boosté ! +X%". */
  feedBuffActive?: { multiplier: number; expiresAtIso: string } | null;
}

let lastSnapshot: MascotteSnapshot | null = null;

/**
 * Charge le PNG d'un compagnon (idle ou happy) et renvoie sa représentation base64.
 * Retourne null si l'espèce ou le stade n'ont pas de sprite mappé.
 */
export async function loadCompanionSpriteBase64(
  species: CompanionSpecies,
  stage: CompanionStage,
  mood: CompanionMood = 'idle',
): Promise<string | null> {
  try {
    const entry = COMPANION_SPRITES[species]?.[stage];
    if (!entry) return null;
    const module = mood === 'happy' ? entry.happy : entry.idle_1;
    const asset = Asset.fromModule(module);
    if (!asset.localUri) await asset.downloadAsync();
    if (!asset.localUri) return null;
    return await FileSystem.readAsStringAsync(asset.localUri, { encoding: 'base64' });
  } catch {
    return null;
  }
}

/**
 * Phase 42 — Construit la bulle de dialogue Live Activity pour un buff actif (D-23).
 * Format ≤44 chars : "Boosté ! +X% XP ⚡ (Ymin)"
 */
export function buildFeedSpeechBubble(
  buff: { multiplier: number; expiresAtIso: string },
  nowMs: number = Date.now(),
): string {
  const pct = Math.round((buff.multiplier - 1) * 100);
  const remainingMs = Math.max(0, new Date(buff.expiresAtIso).getTime() - nowMs);
  const min = Math.ceil(remainingMs / 60000);
  const label = `Boosté ! +${pct}% XP ⚡ (${min}min)`;
  return label.length <= 44 ? label : label.slice(0, 44);
}

/**
 * Démarre la Live Activity mascotte. Idempotent :
 * si une activity tourne déjà, elle est remplacée.
 */
export async function startMascotte(snap: MascotteSnapshot): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  // Phase 42 — Override speechBubble si buff actif et non-fourni explicitement (D-23)
  const effectiveBubble =
    snap.speechBubble ??
    (snap.feedBuffActive ? buildFeedSpeechBubble(snap.feedBuffActive) : null);
  lastSnapshot = { ...snap, speechBubble: effectiveBubble };
  try {
    return await startMascotteActivity(
      snap.mascotteName,
      snap.tasksDone,
      snap.tasksTotal,
      snap.xpGained,
      snap.currentMeal,
      snap.stageOverride ?? null,
      snap.companionSpriteBase64 ?? null,
      snap.bonusText ?? null,
      snap.nextTaskText ?? null,
      snap.nextTaskId ?? null,
      snap.nextRdvText ?? null,
      effectiveBubble,
    );
  } catch (e) {
    if (__DEV__) console.warn('[mascotte] startMascotteActivity threw:', e);
    return false;
  }
}

/**
 * Met à jour l'état affiché si une activity est active. No-op sinon.
 * Appeler quand une tâche est cochée, un repas mis à jour, ou des XP gagnés.
 */
export async function refreshMascotte(snap: MascotteSnapshot): Promise<void> {
  if (Platform.OS !== 'ios') return;
  // Phase 42 — Override speechBubble si buff actif et non-fourni explicitement (D-23)
  const effectiveBubble =
    snap.speechBubble ??
    (snap.feedBuffActive ? buildFeedSpeechBubble(snap.feedBuffActive) : null);
  lastSnapshot = { ...snap, speechBubble: effectiveBubble };
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
      snap.bonusText ?? null,
      snap.nextTaskText ?? null,
      snap.nextTaskId ?? null,
      snap.nextRdvText ?? null,
      effectiveBubble,
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
