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

/**
 * Construit un prompt court (<200 tokens) pour Claude Haiku.
 * Instructions en français car l'app est en français.
 */
function buildCompanionPrompt(event: CompanionEvent, ctx: CompanionMessageContext): string {
  const eventDescriptions: Record<CompanionEvent, string> = {
    task_completed: `${ctx.profileName} vient de compléter une tâche`,
    loot_opened: `${ctx.profileName} vient d'ouvrir un coffre à butin`,
    level_up: `${ctx.profileName} vient de monter au niveau ${ctx.level}`,
    greeting: `${ctx.profileName} vient d'arriver sur l'écran de son arbre`,
    streak_milestone: `${ctx.profileName} a un streak de ${ctx.streak} jours`,
    harvest: `${ctx.profileName} vient de récolter sur sa ferme`,
    craft: `${ctx.profileName} vient de créer un objet dans son atelier`,
  };

  return `Tu es ${ctx.companionName}, un ${ctx.companionSpecies} mignon et attachant. ${eventDescriptions[event]}. Réponds en UNE phrase courte, encourageante et mignonne (max 80 caractères). Pas d'emoji. Tutoie ${ctx.profileName}.`;
}

// ── Cache messages IA ────────────────────────────────

const AI_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface AICacheEntry {
  message: string;
  event: CompanionEvent;
  cacheKey: string;
  timestamp: number;
}

let aiMessageCache: AICacheEntry | null = null;

/** Clé de cache basée sur le contexte — change si l'activité change */
function buildCacheKey(event: CompanionEvent, ctx: CompanionMessageContext): string {
  return `${ctx.profileName}:${ctx.companionName}:${event}:${ctx.tasksToday}:${ctx.streak}:${ctx.level}`;
}

/**
 * Génère un message compagnon hybride : tente l'IA Haiku, fallback sur prédéfinis.
 * Cache le message IA pendant 30min — ne refait un appel que si le contexte change.
 */
export async function generateCompanionAIMessage(
  event: CompanionEvent,
  context: CompanionMessageContext,
  aiCall: ((prompt: string) => Promise<string>) | null,
): Promise<string> {
  const fallbackKey = pickCompanionMessage(event, context);
  if (!aiCall) return fallbackKey;

  const cacheKey = buildCacheKey(event, context);

  // Cache hit — même contexte et pas expiré
  if (
    aiMessageCache &&
    aiMessageCache.cacheKey === cacheKey &&
    Date.now() - aiMessageCache.timestamp < AI_CACHE_TTL_MS
  ) {
    return aiMessageCache.message;
  }

  try {
    const prompt = buildCompanionPrompt(event, context);
    const result = await Promise.race([
      aiCall(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    const message = result || fallbackKey;

    // Stocker en cache seulement si c'est un message IA (pas le fallback)
    if (result) {
      aiMessageCache = { message, event, cacheKey, timestamp: Date.now() };
    }

    return message;
  } catch {
    return fallbackKey;
  }
}
