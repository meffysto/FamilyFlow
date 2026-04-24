/**
 * mascotte-live-activity.ts — Orchestre la Live Activity "journée de la mascotte"
 *
 * V1 :
 * - Démarrage manuel via startMascotte() depuis un bouton UI.
 * - Updates déclenchées sur tâche cochée, repas sélectionné, XP gagné.
 * - Arrêt manuel via stopMascotte() ou automatique par iOS après ~8h.
 *
 * Phase 260425-0qf :
 * - companionSpriteBase64 retiré de MascotteSnapshot (allégement ContentState).
 * - Ajout pose?: CompanionMood dans MascotteSnapshot.
 * - writeCompanionPosesToAppGroup() écrit les 5 PNG dans l'App Group au start.
 * - derivePoseFromStage() dérive la pose narrative depuis le stageOverride courant.
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
  writeCompanionPoseFile,
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
  /**
   * Pose courante du compagnon. Propagée dans ContentState.pose (String, ~500B)
   * à la place de l'ancien companionSpriteBase64 (~5-15KB). Les 5 PNG sont
   * écrits dans l'App Group au start() via writeCompanionPosesToAppGroup().
   * Phase 260425-0qf — remplace companionSpriteBase64 retiré.
   */
  pose?: CompanionMood | null;
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
 * Dérive la pose narrative depuis le stage actuel et les compteurs de tâches.
 * Mapping déterministe (Phase 260425-0qf) :
 *   dodo → sleeping
 *   midi → eating
 *   recap & toutes tâches faites → celebrating
 *   autres → idle
 */
export function derivePoseFromStage(
  stage: MascotteStageOverride | null | undefined,
  tasksDone: number,
  tasksTotal: number,
): CompanionMood {
  if (stage === 'dodo') return 'sleeping';
  if (stage === 'midi') return 'eating';
  if (stage === 'recap' && tasksTotal > 0 && tasksDone >= tasksTotal) return 'celebrating';
  return 'idle';
}

/**
 * Charge le PNG d'un compagnon dans la pose demandée et renvoie sa représentation base64.
 * Retourne null si l'espèce ou le stade n'ont pas de sprite mappé.
 * 'idle' → idle_1, toutes les autres poses → clé directe dans l'entrée sprites.
 */
export async function loadCompanionSpriteBase64(
  species: CompanionSpecies,
  stage: CompanionStage,
  mood: CompanionMood = 'idle',
): Promise<string | null> {
  try {
    const entry = COMPANION_SPRITES[species]?.[stage];
    if (!entry) return null;
    // 'idle' utilise idle_1 ; les autres poses ont leur clé directe
    const module = mood === 'idle' ? entry.idle_1 : entry[mood];
    if (!module) return null;
    const asset = Asset.fromModule(module);
    if (!asset.localUri) await asset.downloadAsync();
    if (!asset.localUri) return null;
    return await FileSystem.readAsStringAsync(asset.localUri, { encoding: 'base64' });
  } catch {
    return null;
  }
}

/**
 * Phase 260425-0qf — Écrit les 5 PNG (idle/happy/sleeping/eating/celebrating)
 * dans le container App Group partagé avant le start de la Live Activity.
 * Ces fichiers restent stables pendant toute la durée de la LA (l'espèce et le
 * stade ne changent pas) — on ne réécrit qu'au startMascotte().
 */
export async function writeCompanionPosesToAppGroup(
  species: CompanionSpecies,
  stage: CompanionStage,
): Promise<void> {
  const poses: CompanionMood[] = ['idle', 'happy', 'sleeping', 'eating', 'celebrating'];
  await Promise.all(
    poses.map(async (pose) => {
      const base64 = await loadCompanionSpriteBase64(species, stage, pose);
      if (base64) {
        await writeCompanionPoseFile(pose, base64);
      }
    }),
  );
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
 * Phase 260425-0qf : écrit les 5 PNG dans l'App Group AVANT de démarrer la LA,
 * puis passe uniquement la pose courante (String) dans le ContentState.
 */
export async function startMascotte(snap: MascotteSnapshot): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  // Phase 42 — Override speechBubble si buff actif et non-fourni explicitement (D-23)
  const effectiveBubble =
    snap.speechBubble ??
    (snap.feedBuffActive ? buildFeedSpeechBubble(snap.feedBuffActive) : null);
  // Phase 260425-0qf — dériver la pose si non fournie explicitement
  const effectivePose: CompanionMood =
    snap.pose ?? derivePoseFromStage(snap.stageOverride, snap.tasksDone, snap.tasksTotal);
  lastSnapshot = { ...snap, speechBubble: effectiveBubble, pose: effectivePose };
  try {
    return await startMascotteActivity(
      snap.mascotteName,
      snap.tasksDone,
      snap.tasksTotal,
      snap.xpGained,
      snap.currentMeal,
      snap.stageOverride ?? null,
      effectivePose,
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
 * Phase 260425-0qf : ne réécrit PAS les fichiers App Group (fait au start uniquement).
 */
export async function refreshMascotte(snap: MascotteSnapshot): Promise<void> {
  if (Platform.OS !== 'ios') return;
  // Phase 42 — Override speechBubble si buff actif et non-fourni explicitement (D-23)
  const effectiveBubble =
    snap.speechBubble ??
    (snap.feedBuffActive ? buildFeedSpeechBubble(snap.feedBuffActive) : null);
  // Phase 260425-0qf — dériver la pose si non fournie explicitement
  const effectivePose: CompanionMood =
    snap.pose ?? derivePoseFromStage(snap.stageOverride, snap.tasksDone, snap.tasksTotal);
  lastSnapshot = { ...snap, speechBubble: effectiveBubble, pose: effectivePose };
  try {
    const active = await isMascotteActivityActive();
    if (!active) return;
    await updateMascotteActivity(
      snap.tasksDone,
      snap.tasksTotal,
      snap.xpGained,
      snap.currentMeal,
      snap.stageOverride ?? null,
      effectivePose,
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
