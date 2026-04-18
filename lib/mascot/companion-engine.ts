// ─────────────────────────────────────────────
// Compagnon Mascotte — Engine (pure functions)
// ─────────────────────────────────────────────

import {
  COMPANION_STAGES,
  COMPANION_XP_BONUS,
  SPECIES_PERSONALITY,
  type CompanionData,
  type CompanionEvent,
  type CompanionMood,
  type CompanionMessageContext,
  type CompanionStage,
} from './companion-types';

// ── Évolution ────────────────────────────────────────────

/**
 * Retourne le stade du compagnon pour un niveau donné.
 * bebe: 1-5, jeune: 6-10, adulte: 11+
 */
export function getCompanionStage(level: number): CompanionStage {
  for (const info of COMPANION_STAGES) {
    if (level >= info.minLevel && level <= info.maxLevel) {
      return info.stage;
    }
  }
  return 'bebe';
}

// ── Mood dynamique ──────────────────────────────────────

/**
 * Contexte étendu pour le calcul de mood multi-facteurs.
 * Les champs optionnels permettent un calcul plus riche.
 */
export interface MoodContext {
  recentTasksCompleted: number;
  hoursSinceLastActivity: number;
  currentHour?: number;
  streak?: number;
  hasGratitudeToday?: boolean;
  hasOverdueTasks?: boolean;
  daysWithoutInteraction?: number;
}

/**
 * Score pondéré de mood. Retourne un score numérique
 * et le mood correspondant.
 *
 * Facteurs positifs: tâches faites, streak, gratitude
 * Facteurs négatifs: inactivité, tâches en retard
 */
export function computeMoodScore(ctx: MoodContext): { mood: CompanionMood; score: number } {
  const hour = ctx.currentHour !== undefined ? ctx.currentHour : new Date().getHours();

  // Cas spéciaux absolus
  if (ctx.hoursSinceLastActivity > 48) return { mood: 'triste', score: -10 };

  let score = 0;

  // Facteurs positifs
  score += Math.min(ctx.recentTasksCompleted * 2, 10);    // max +10 pour 5+ tâches
  if (ctx.streak && ctx.streak >= 3) score += 3;           // streak bonus
  if (ctx.streak && ctx.streak >= 7) score += 2;           // streak élevé
  if (ctx.hasGratitudeToday) score += 2;                   // gratitude du jour

  // Facteurs négatifs
  if (ctx.hasOverdueTasks) score -= 3;                     // tâches en retard
  if (ctx.hoursSinceLastActivity > 24) score -= 4;         // >24h sans activité

  // Déterminer le mood selon le score
  let mood: CompanionMood;
  if (score >= 8) {
    mood = 'excite';
  } else if (score <= -3) {
    mood = 'triste';
  } else if (hour >= 22 || hour <= 7) {
    mood = 'endormi';
  } else {
    mood = 'content';
  }

  return { mood, score };
}

/**
 * Retourne l'humeur du compagnon — API rétrocompatible.
 * Utilise computeMoodScore en interne.
 */
export function getCompanionMood(
  recentTasksCompleted: number,
  hoursSinceLastActivity: number,
  currentHour?: number,
): CompanionMood {
  return computeMoodScore({ recentTasksCompleted, hoursSinceLastActivity, currentHour }).mood;
}

/**
 * Retourne le multiplicateur de bonus XP du compagnon.
 * +5% si un compagnon est actif, sinon 1.0.
 */
export function getCompanionXpBonus(companion: CompanionData | null | undefined): number {
  if (!companion) return 1.0;
  return COMPANION_XP_BONUS;
}

// ── Templates de messages ────────────────────────────────

/**
 * Templates i18n par événement compagnon.
 * Format des clés: 'companion.msg.{event}.{n}'
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
  routine_completed: [
    'companion.msg.routine.1',
    'companion.msg.routine.2',
  ],
  budget_alert: [
    'companion.msg.budget.1',
    'companion.msg.budget.2',
  ],
  meal_planned: [
    'companion.msg.meal.1',
    'companion.msg.meal.2',
  ],
  gratitude_written: [
    'companion.msg.gratitude.1',
    'companion.msg.gratitude.2',
  ],
  photo_added: [
    'companion.msg.photo.1',
    'companion.msg.photo.2',
  ],
  defi_completed: [
    'companion.msg.defi.1',
    'companion.msg.defi.2',
  ],
  family_milestone: [
    'companion.msg.milestone.1',
    'companion.msg.milestone.2',
  ],
  weekly_recap: [
    'companion.msg.recap.1',
    'companion.msg.recap.2',
  ],
  // Messages proactifs
  morning_greeting: [
    'companion.msg.morning.1',
    'companion.msg.morning.2',
    'companion.msg.morning.3',
  ],
  gentle_nudge: [
    'companion.msg.nudge.1',
    'companion.msg.nudge.2',
  ],
  comeback: [
    'companion.msg.comeback.1',
    'companion.msg.comeback.2',
  ],
  celebration: [
    'companion.msg.celebration.1',
    'companion.msg.celebration.2',
  ],
  // Événements d'usure & bâtiments
  building_full: [
    'companion.msg.buildingFull.1',
    'companion.msg.buildingFull.2',
  ],
  fence_broken: [
    'companion.msg.fenceBroken.1',
    'companion.msg.fenceBroken.2',
  ],
  roof_damaged: [
    'companion.msg.roofDamaged.1',
    'companion.msg.roofDamaged.2',
  ],
  weeds_growing: [
    'companion.msg.weedsGrowing.1',
    'companion.msg.weedsGrowing.2',
  ],
  pests_attacking: [
    'companion.msg.pestsAttacking.1',
    'companion.msg.pestsAttacking.2',
  ],
  wear_repaired: [
    'companion.msg.wearRepaired.1',
    'companion.msg.wearRepaired.2',
    'companion.msg.wearRepaired.3',
  ],
};

/**
 * Templates sub-type pour task_completed par categorie semantique (Phase 21).
 * Cles = 'task_completed_${categoryId}' — 2 templates par categorie (D-05).
 * Dictionnaire separe pour ne pas elargir le type Record<CompanionEvent, ...>.
 */
export const SUB_TYPE_TEMPLATES: Record<string, string[]> = {
  task_completed_menage_quotidien: [
    'companion.msg.taskDone_menage_quotidien.1',
    'companion.msg.taskDone_menage_quotidien.2',
  ],
  task_completed_menage_hebdo: [
    'companion.msg.taskDone_menage_hebdo.1',
    'companion.msg.taskDone_menage_hebdo.2',
  ],
  task_completed_courses: [
    'companion.msg.taskDone_courses.1',
    'companion.msg.taskDone_courses.2',
  ],
  task_completed_enfants_routines: [
    'companion.msg.taskDone_enfants_routines.1',
    'companion.msg.taskDone_enfants_routines.2',
  ],
  task_completed_enfants_devoirs: [
    'companion.msg.taskDone_enfants_devoirs.1',
    'companion.msg.taskDone_enfants_devoirs.2',
  ],
  task_completed_rendez_vous: [
    'companion.msg.taskDone_rendez_vous.1',
    'companion.msg.taskDone_rendez_vous.2',
  ],
  task_completed_gratitude_famille: [
    'companion.msg.taskDone_gratitude_famille.1',
    'companion.msg.taskDone_gratitude_famille.2',
  ],
  task_completed_budget_admin: [
    'companion.msg.taskDone_budget_admin.1',
    'companion.msg.taskDone_budget_admin.2',
  ],
  task_completed_bebe_soins: [
    'companion.msg.taskDone_bebe_soins.1',
    'companion.msg.taskDone_bebe_soins.2',
  ],
  task_completed_cuisine_repas: [
    'companion.msg.taskDone_cuisine_repas.1',
    'companion.msg.taskDone_cuisine_repas.2',
  ],
};

/**
 * Sélectionne aléatoirement une clé i18n du pool pour l'événement donné.
 * Phase 21 : résout les sub-types task_completed avant le fallback générique.
 */
export function pickCompanionMessage(
  event: CompanionEvent,
  context: CompanionMessageContext,
): string {
  // Phase 21 : Sub-type lookup pour task_completed (D-04)
  if (event === 'task_completed' && context.subType) {
    const subKey = `task_completed_${context.subType}`;
    const subTemplates = SUB_TYPE_TEMPLATES[subKey];
    if (subTemplates && subTemplates.length > 0) {
      const idx = Math.floor(Math.random() * subTemplates.length);
      return subTemplates[idx];
    }
  }
  // Fallback — comportement existant
  const templates = MESSAGE_TEMPLATES[event];
  if (!templates || templates.length === 0) {
    return MESSAGE_TEMPLATES.greeting[0];
  }
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx];
}

// ── Prompt IA avec personnalité ─────────────────────────

/**
 * Construit le prompt pour Claude Haiku avec personnalité espèce,
 * mémoire courte et contexte enrichi.
 */
function buildCompanionPrompt(event: CompanionEvent, ctx: CompanionMessageContext): string {
  const personality = SPECIES_PERSONALITY[ctx.companionSpecies];

  // Description d'événement enrichie avec le contexte réel
  const morningDesc = () => {
    const parts = [`${ctx.profileName} commence sa journée`];
    if (ctx.pendingTasks && ctx.pendingTasks.length > 0) {
      parts.push(`avec ${ctx.pendingTasks.length} tâche${ctx.pendingTasks.length > 1 ? 's' : ''} à faire`);
      if (ctx.pendingTasks.length <= 3) parts.push(`(${ctx.pendingTasks.join(', ')})`);
    }
    if (ctx.streak && ctx.streak > 1) parts.push(`— série de ${ctx.streak} jours`);
    return parts.join(' ');
  };

  const greetingDesc = () => {
    const tod = ctx.timeOfDay ?? 'matin';
    const base = tod === 'soir' ? `${ctx.profileName} passe en soirée`
      : tod === 'apres-midi' ? `${ctx.profileName} revient cet après-midi`
      : tod === 'nuit' ? `${ctx.profileName} est encore là en pleine nuit`
      : `${ctx.profileName} vient d'arriver sur l'écran de son arbre`;
    return base;
  };

  const nudgeDesc = () => {
    if (ctx.pendingTasks && ctx.pendingTasks.length > 0) {
      const sample = ctx.pendingTasks.slice(0, 2).join(' et ');
      return `${ctx.profileName} n'a pas encore fait ${sample} aujourd'hui`;
    }
    return `${ctx.profileName} n'a pas encore fait certaines choses aujourd'hui`;
  };

  const eventDescriptions: Record<CompanionEvent, string> = {
    task_completed: `${ctx.profileName} vient de compléter des tâches (${ctx.tasksToday} aujourd'hui)`,
    loot_opened: `${ctx.profileName} vient d'ouvrir un coffre à butin`,
    level_up: `${ctx.profileName} vient de monter au niveau ${ctx.level} !`,
    greeting: greetingDesc(),
    streak_milestone: `${ctx.profileName} est régulier dans ses tâches (${ctx.streak} jours d'affilée)`,
    harvest: `${ctx.profileName} vient de récolter sur sa ferme`,
    craft: `${ctx.profileName} vient de créer un objet dans son atelier`,
    routine_completed: `${ctx.profileName} a terminé sa routine`,
    budget_alert: `${ctx.profileName} a un événement budget`,
    meal_planned: `${ctx.profileName} a planifié les repas`,
    gratitude_written: `${ctx.profileName} vient d'écrire dans son journal de gratitude`,
    photo_added: `${ctx.profileName} a ajouté un nouveau souvenir photo`,
    defi_completed: `${ctx.profileName} a relevé un défi familial`,
    family_milestone: `Un événement familial important approche`,
    weekly_recap: `C'est le moment du bilan de la semaine`,
    morning_greeting: morningDesc(),
    gentle_nudge: nudgeDesc(),
    comeback: `${ctx.profileName} revient après une absence`,
    celebration: `Il y a quelque chose à fêter pour la famille`,
    // Événements d'usure & bâtiments
    building_full: `Un bâtiment de la ferme de ${ctx.profileName} est plein à craquer`,
    fence_broken: `Une clôture de la ferme de ${ctx.profileName} vient de se casser`,
    roof_damaged: `Le toit d'un bâtiment de la ferme de ${ctx.profileName} est endommagé`,
    weeds_growing: `Des mauvaises herbes poussent sur la ferme de ${ctx.profileName}`,
    pests_attacking: `Des nuisibles attaquent la ferme de ${ctx.profileName}`,
    wear_repaired: `${ctx.profileName} vient de réparer quelque chose sur la ferme`,
  };

  // Contexte conditionnel — n'injecter que ce qui est pertinent à l'événement
  const taskEvents: CompanionEvent[] = ['task_completed', 'streak_milestone', 'gentle_nudge', 'morning_greeting', 'weekly_recap'];
  const mealEvents: CompanionEvent[] = ['meal_planned', 'morning_greeting'];
  const rdvEvents: CompanionEvent[] = ['greeting', 'morning_greeting', 'weekly_recap'];

  let taskContext = '';
  if (taskEvents.includes(event) && ctx.recentTasks && ctx.recentTasks.length > 0) {
    taskContext = ` Tâches terminées aujourd'hui : ${ctx.recentTasks.join(', ')}.`;
  }

  let rdvContext = '';
  if (rdvEvents.includes(event) && ctx.nextRdv) {
    rdvContext = ` Prochain rendez-vous : "${ctx.nextRdv.title}" le ${ctx.nextRdv.date}.`;
  }

  let mealsContext = '';
  if (mealEvents.includes(event) && ctx.todayMeals && ctx.todayMeals.length > 0) {
    mealsContext = ` Au menu aujourd'hui : ${ctx.todayMeals.join(', ')}.`;
  }

  // Mood du compagnon — influence le ton du message
  let moodContext = '';
  if (ctx.mood) {
    const moodDesc: Record<string, string> = {
      excite: 'Tu es surexcité et très fier',
      content: 'Tu es de bonne humeur',
      triste: 'Tu es un peu inquiet, ça fait longtemps',
      endormi: 'Tu es somnolent mais content de voir ton ami',
    };
    moodContext = ` ${moodDesc[ctx.mood] ?? ''}.`;
  }

  // Mémoire courte — anti-répétition stricte
  let memoryContext = '';
  if (ctx.recentMessages && ctx.recentMessages.length > 0) {
    memoryContext = ` INTERDIT de répéter ou paraphraser ces messages déjà dits : ${ctx.recentMessages.map(m => `"${m}"`).join(', ')}. Dis quelque chose de complètement différent.`;
  }

  return [
    `Ton nom : ${ctx.companionName}. Ton style : ${personality.tone}. ${personality.quirk}.`,
    moodContext,
    `${eventDescriptions[event]}.`,
    taskContext,
    rdvContext,
    mealsContext,
    memoryContext,
    `Réponds en 1 phrase courte et naturelle à ${ctx.profileName}. Tutoie. Pas d'emoji. Pas de guillemets. Pas de présentation. Varie ton vocabulaire.`,
  ].filter(Boolean).join(' ');
}

// ── Cache intelligent + budget quotidien ────────────────

/** Nombre max d'appels IA par jour par profil */
const DAILY_AI_BUDGET = 15;

/** TTL du cache par catégorie d'événement (ms) */
const CACHE_TTL: Partial<Record<CompanionEvent, number>> = {
  greeting:           4 * 60 * 60 * 1000,  // 4h — un seul appel IA par demi-journée
  morning_greeting:  10 * 60 * 60 * 1000,  // 10h — un seul message matinal par jour
  task_completed:    45 * 60 * 1000,       // 45min — ~1 appel toutes les 3 tâches
  harvest:            2 * 60 * 60 * 1000,  // 2h — template suffit la plupart du temps
  craft:              2 * 60 * 60 * 1000,  // 2h
  gentle_nudge:       4 * 60 * 60 * 1000,  // 4h
  comeback:           8 * 60 * 60 * 1000,  // 8h
};
const DEFAULT_CACHE_TTL = 30 * 60 * 1000; // 30min par défaut

/** Événements toujours prioritaires pour l'IA (rares, méritent un message unique) */
const ALWAYS_AI_EVENTS: CompanionEvent[] = [
  'level_up', 'streak_milestone', 'defi_completed',
  'family_milestone', 'weekly_recap', 'comeback',
  'morning_greeting', 'celebration',
];

interface AICacheEntry {
  message: string;
  event: CompanionEvent;
  cacheKey: string;
  timestamp: number;
}

interface DailyBudget {
  date: string;  // YYYY-MM-DD
  count: number;
}

let aiMessageCache = new Map<string, AICacheEntry>();
let dailyBudget: DailyBudget = { date: '', count: 0 };

/** Retourne le nombre d'appels IA restants aujourd'hui */
export function getRemainingAIBudget(): number {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyBudget.date !== today) return DAILY_AI_BUDGET;
  return Math.max(0, DAILY_AI_BUDGET - dailyBudget.count);
}

/** Clé de cache basée sur le contexte + slot horaire pour varier */
function buildCacheKey(event: CompanionEvent, ctx: CompanionMessageContext): string {
  // Slot horaire de 2h → force un nouveau message IA toutes les 2h même contexte identique
  const hourSlot = Math.floor(new Date().getHours() / 2);
  const mood = ctx.mood ?? 'content';
  return `${ctx.profileName}:${ctx.companionSpecies}:${event}:${ctx.tasksToday}:${ctx.streak}:${ctx.level}:${mood}:${hourSlot}`;
}

/** Vérifie si un événement devrait utiliser l'IA (budget + priorité) */
function shouldUseAI(event: CompanionEvent): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyBudget.date !== today) {
    dailyBudget = { date: today, count: 0 };
  }

  // Événements prioritaires consomment toujours le budget
  if (ALWAYS_AI_EVENTS.includes(event)) {
    return dailyBudget.count < DAILY_AI_BUDGET;
  }

  // Événements courants — ne pas dépasser 80% du budget
  return dailyBudget.count < Math.floor(DAILY_AI_BUDGET * 0.8);
}

/** Incrémente le compteur de budget quotidien */
function consumeAIBudget(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyBudget.date !== today) {
    dailyBudget = { date: today, count: 1 };
  } else {
    dailyBudget.count++;
  }
}

/**
 * Génère un message compagnon hybride : tente l'IA, fallback sur templates.
 * Cache intelligent par événement + budget quotidien limité.
 */
export async function generateCompanionAIMessage(
  event: CompanionEvent,
  context: CompanionMessageContext,
  aiCall: ((prompt: string) => Promise<string>) | null,
): Promise<string> {
  const fallbackKey = pickCompanionMessage(event, context);
  if (!aiCall) return fallbackKey;

  const cacheKey = buildCacheKey(event, context);
  const ttl = CACHE_TTL[event] ?? DEFAULT_CACHE_TTL;

  // Cache hit
  const cached = aiMessageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.message;
  }

  // Vérifier le budget
  if (!shouldUseAI(event)) {
    return fallbackKey;
  }

  try {
    const prompt = buildCompanionPrompt(event, context);
    const result = await Promise.race([
      aiCall(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    const message = result || fallbackKey;

    if (result) {
      aiMessageCache.set(cacheKey, { message, event, cacheKey, timestamp: Date.now() });
      consumeAIBudget();

      // Limiter la taille du cache (garder les 20 plus récentes)
      if (aiMessageCache.size > 20) {
        const oldest = [...aiMessageCache.entries()]
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        if (oldest) aiMessageCache.delete(oldest[0]);
      }
    }

    return message;
  } catch {
    return fallbackKey;
  }
}

// ── Messages proactifs ──────────────────────────────────

/** Contexte pour la détection de messages proactifs */
export interface ProactiveContext {
  hoursSinceLastVisit: number;
  currentHour: number;
  tasksToday: number;
  totalTasksToday: number;  // tâches totales (faites + à faire)
  streak: number;
  hasGratitudeToday: boolean;
  hasMealsPlanned: boolean;
  isFirstVisitToday: boolean;
  familyMilestone?: string;  // ex: "Anniversaire d'Emma dans 2 jours"
  /** Dimanche entre 18h et 21h — fenêtre du récap hebdomadaire (D-09) */
  isWeeklyRecapWindow?: boolean;
}

/**
 * Détecte le message proactif le plus pertinent selon le contexte.
 * Retourne l'événement proactif ou null si aucun message n'est pertinent.
 */
export function detectProactiveEvent(ctx: ProactiveContext): CompanionEvent | null {
  // Retour après longue absence (>24h) — toujours prioritaire
  if (ctx.hoursSinceLastVisit > 24) return 'comeback';

  // Les autres proactifs ne se déclenchent qu'à la première visite du jour
  if (!ctx.isFirstVisitToday) return null;

  // Message matinal (entre 6h et 11h)
  if (ctx.currentHour >= 6 && ctx.currentHour <= 11) {
    return 'morning_greeting';
  }

  // Milestone familial
  if (ctx.familyMilestone) return 'family_milestone';

  // Célébration de série (multiple de 7)
  if (ctx.streak > 0 && ctx.streak % 7 === 0) return 'celebration';

  // Weekly recap dimanche soir (D-09)
  if (ctx.isWeeklyRecapWindow) return 'weekly_recap';

  // Rappel doux l'après-midi (pas de tâches faites et il y en a à faire)
  if (
    ctx.currentHour >= 14 &&
    ctx.currentHour <= 19 &&
    ctx.tasksToday === 0 &&
    ctx.totalTasksToday > 0
  ) {
    return 'gentle_nudge';
  }

  return null;
}

// ── Reset (pour les tests) ──────────────────────────────

export function _resetCacheForTests(): void {
  aiMessageCache = new Map();
  dailyBudget = { date: '', count: 0 };
}
