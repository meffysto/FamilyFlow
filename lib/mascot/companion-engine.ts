// ─────────────────────────────────────────────
// Compagnon Mascotte — Engine (pure functions)
// ─────────────────────────────────────────────

import {
  COMPANION_STAGES,
  COMPANION_XP_BONUS,
  type CompanionData,
  type CompanionEvent,
  type CompanionMood,
  type CompanionMessageContext,
  type CompanionStage,
} from './companion-types';

/**
 * Retourne le stade du compagnon pour un niveau donné.
 * Miroir exact de getTreeStage() dans engine.ts.
 */
export function getCompanionStage(level: number): CompanionStage {
  for (let i = COMPANION_STAGES.length - 1; i >= 0; i--) {
    if (level >= COMPANION_STAGES[i].minLevel) return COMPANION_STAGES[i].stage;
  }
  return 'bebe';
}

/**
 * Retourne l'humeur du compagnon selon l'activité récente.
 *
 * Logique (per D-07) :
 * - >48h inactif → 'triste'
 * - >=5 tâches récentes → 'excite' (prioritaire sur nuit)
 * - heure 22h-7h inclus → 'endormi'
 * - sinon → 'content'
 *
 * @param recentTasksCompleted - Nombre de tâches complétées récemment (aujourd'hui)
 * @param hoursSinceLastActivity - Heures écoulées depuis la dernière activité
 * @param currentHour - Heure actuelle (0-23), optionnel pour la testabilité. Défaut: new Date().getHours()
 */
export function getCompanionMood(
  recentTasksCompleted: number,
  hoursSinceLastActivity: number,
  currentHour?: number,
): CompanionMood {
  if (hoursSinceLastActivity > 48) return 'triste';
  if (recentTasksCompleted >= 5) return 'excite';
  const hour = currentHour !== undefined ? currentHour : new Date().getHours();
  if (hour >= 22 || hour <= 7) return 'endormi';
  return 'content';
}

/**
 * Retourne le multiplicateur de bonus XP du compagnon.
 * +5% si un compagnon est actif (per D-09), sinon 1.0.
 */
export function getCompanionXpBonus(companion: CompanionData | null | undefined): number {
  if (!companion) return 1.0;
  return COMPANION_XP_BONUS;
}

/**
 * Templates de messages i18n par événement compagnon.
 * Format des clés: 'companion.msg.{event}.{n}'
 * (per D-12/D-13 — 3-5 clés par événement)
 */
export const MESSAGE_TEMPLATES: Record<CompanionEvent, string[]> = {
  task_completed: [
    'companion.msg.taskDone.1',
    'companion.msg.taskDone.2',
    'companion.msg.taskDone.3',
  ],
  loot_opened: [
    'companion.msg.loot.1',
    'companion.msg.loot.2',
  ],
  level_up: [
    'companion.msg.levelUp.1',
    'companion.msg.levelUp.2',
  ],
  greeting: [
    'companion.msg.greeting.1',
    'companion.msg.greeting.2',
    'companion.msg.greeting.3',
  ],
  streak_milestone: [
    'companion.msg.streak.1',
    'companion.msg.streak.2',
  ],
  harvest: [
    'companion.msg.harvest.1',
    'companion.msg.harvest.2',
  ],
  craft: [
    'companion.msg.craft.1',
    'companion.msg.craft.2',
  ],
};

/**
 * Sélectionne aléatoirement une clé i18n du pool pour l'événement donné.
 * Retourne la clé i18n — le composant appelant devra appeler t() pour la résolution.
 */
export function pickCompanionMessage(
  event: CompanionEvent,
  _context: CompanionMessageContext,
): string {
  const templates = MESSAGE_TEMPLATES[event];
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx];
}
