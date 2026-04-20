/**
 * la-bubbles.ts — Phrase courte de la mascotte pour la Live Activity (Lock Screen / DI)
 *
 * Layer mince par-dessus `companion-engine` :
 * - Map chaque stage LA sur un `CompanionEvent` existant
 * - Injecte une contrainte de longueur dure dans le prompt IA ("Max 40 chars")
 * - Fallback cascade : IA → template LA court → template long tronqué
 * - Truncate défensif à 44 chars avant push dans ContentState
 *
 * Pas de dédup du moteur (budget IA, cache 2h, anti-répétition) : tout est réutilisé.
 */

import { t } from 'i18next';
import {
  generateCompanionAIMessage,
  pickCompanionMessage,
} from './companion-engine';
import type { CompanionEvent, CompanionMessageContext } from './companion-types';

/** Stages de la Live Activity (miroir de MascotteStageOverride côté Swift/TS) */
export type LAStage = 'reveil' | 'travail' | 'midi' | 'jeu' | 'routine' | 'dodo' | 'recap';

/** Longueur max tolérée dans la ContentState (DI expanded 1 ligne ~28-35 chars visibles) */
export const LA_BUBBLE_MAX = 44;

/**
 * Ring buffer in-memory des dernières bulles IA générées (tous stages confondus).
 * Passé comme `recentMessages` au prompt → Claude reçoit "INTERDIT de répéter : X, Y, Z".
 * Garde 6 entrées. Non persisté : reset au relaunch (acceptable, l'IA re-diversifie).
 */
const recentLABubbles: string[] = [];
function rememberBubble(bubble: string): void {
  if (!bubble) return;
  recentLABubbles.push(bubble);
  if (recentLABubbles.length > 6) recentLABubbles.shift();
}

/** Mapping stage → event existant du moteur compagnon */
const STAGE_TO_EVENT: Record<LAStage, CompanionEvent> = {
  reveil: 'morning_greeting',
  travail: 'gentle_nudge',
  midi: 'meal_planned',
  jeu: 'greeting',
  routine: 'routine_completed',
  dodo: 'greeting',
  recap: 'weekly_recap',
};

/**
 * Pool de phrases courtes dédiées à la Live Activity, par stage.
 * Clés i18n dans `locales/{lang}/common.json` → `companion.la.{stage}.{n}`.
 * Doivent toutes tenir dans LA_BUBBLE_MAX caractères.
 */
const LA_TEMPLATES: Record<LAStage, string[]> = {
  reveil: [
    'companion.la.reveil.1',
    'companion.la.reveil.2',
    'companion.la.reveil.3',
    'companion.la.reveil.4',
  ],
  travail: [
    'companion.la.travail.1',
    'companion.la.travail.2',
    'companion.la.travail.3',
    'companion.la.travail.4',
  ],
  midi: [
    'companion.la.midi.1',
    'companion.la.midi.2',
    'companion.la.midi.3',
    'companion.la.midi.4',
  ],
  jeu: [
    'companion.la.jeu.1',
    'companion.la.jeu.2',
    'companion.la.jeu.3',
    'companion.la.jeu.4',
  ],
  routine: [
    'companion.la.routine.1',
    'companion.la.routine.2',
    'companion.la.routine.3',
    'companion.la.routine.4',
  ],
  dodo: [
    'companion.la.dodo.1',
    'companion.la.dodo.2',
    'companion.la.dodo.3',
    'companion.la.dodo.4',
  ],
  recap: [
    'companion.la.recap.1',
    'companion.la.recap.2',
    'companion.la.recap.3',
    'companion.la.recap.4',
  ],
};

/** Tronque proprement à LA_BUBBLE_MAX caractères avec ellipsis si dépassement. */
export function truncateBubble(text: string): string {
  if (!text) return '';
  const trimmed = text.trim().replace(/["«»]/g, '');
  if (trimmed.length <= LA_BUBBLE_MAX) return trimmed;
  return trimmed.slice(0, LA_BUBBLE_MAX - 1) + '…';
}

/** Phrase courte synchrone depuis les templates LA. Pas d'IA. */
export function pickLABubbleShort(stage: LAStage): string {
  const pool = LA_TEMPLATES[stage];
  const key = pool[Math.floor(Math.random() * pool.length)];
  const translated = t(key) as string;
  // Si la clé n'est pas encore en i18n, le fallback est la clé elle-même — on tombe alors
  // sur un template long générique du moteur.
  if (translated === key) {
    const event = STAGE_TO_EVENT[stage];
    const fallbackKey = pickCompanionMessage(event, makeMinimalContext(stage));
    return truncateBubble(t(fallbackKey) as string);
  }
  return truncateBubble(translated);
}

/**
 * Phrase LA avec IA (si `aiCall` fourni) + fallback cascade. Respecte budget + cache
 * du moteur companion-engine existant. Wrapper le `aiCall` pour injecter la contrainte
 * de longueur.
 */
export async function generateLABubble(
  stage: LAStage,
  ctx: CompanionMessageContext,
  aiCall: ((prompt: string) => Promise<string>) | null,
  options?: { skipCache?: boolean },
): Promise<string> {
  const event = STAGE_TO_EVENT[stage];
  // Injecte les dernières bulles dans recentMessages → prompt inclura "INTERDIT de répéter".
  const enrichedCtx: CompanionMessageContext = {
    ...ctx,
    recentMessages: [...(ctx.recentMessages ?? []), ...recentLABubbles],
  };
  const shortAICall = aiCall
    ? async (prompt: string): Promise<string> => {
        const constrained = prompt +
          ' IMPORTANT : Maximum 40 caractères, 5-7 mots, une seule phrase très courte. Pas de virgule, pas d\'emoji, pas de guillemets.';
        return aiCall(constrained);
      }
    : null;
  try {
    // skipCache par défaut à true pour la LA : chaque régénération explicite doit être fraîche
    // (l'anti-répétition via recentMessages empêche Claude de ressortir une phrase déjà dite).
    const raw = await generateCompanionAIMessage(event, enrichedCtx, shortAICall, {
      skipCache: options?.skipCache ?? true,
    });
    const resolved = raw.startsWith('companion.') ? (t(raw) as string) : raw;
    const bubble = truncateBubble(resolved);
    if (bubble.length === LA_BUBBLE_MAX || resolved.length > LA_BUBBLE_MAX * 2) {
      const fallback = pickLABubbleShort(stage);
      rememberBubble(fallback);
      return fallback;
    }
    rememberBubble(bubble);
    return bubble;
  } catch {
    const fallback = pickLABubbleShort(stage);
    rememberBubble(fallback);
    return fallback;
  }
}

function makeMinimalContext(stage: LAStage): CompanionMessageContext {
  return {
    profileName: '',
    companionName: '',
    companionSpecies: 'chat',
    tasksToday: 0,
    streak: 0,
    level: 1,
    timeOfDay: stage === 'reveil' ? 'matin'
      : stage === 'dodo' || stage === 'recap' ? 'nuit'
      : stage === 'routine' ? 'soir'
      : 'apres-midi',
  };
}
