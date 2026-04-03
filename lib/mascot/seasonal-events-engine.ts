// ─────────────────────────────────────────────
// Événements saisonniers — Moteur de détection et récompenses
// ─────────────────────────────────────────────

import type { SeasonalEvent, RewardDefinition } from '../types';
import { getActiveEvent } from '../gamification/seasonal';
import type { Saga, SagaProgress } from './sagas-types';
import { createEmptySagaProgress } from './sagas-types';
import type { SeasonalEventProgress, SeasonalEventContent } from './seasonal-events-types';

/** Bonus XP accordé à la complétion d'un événement saisonnier */
export const SEASONAL_EVENT_BONUS_XP = 15;

/**
 * Mapping choiceIndex → rareté cible du pool de récompenses.
 * choiceIndex 0 → commun, 1 → rare, 2 → épique
 */
export const CHOICE_RARITY_MAP: string[] = ['commun', 'rare', 'épique'];

/**
 * Détermine si le visiteur événementiel doit apparaître.
 * Retourne true si :
 *  - un événement est actif (selon le calendrier)
 *  - le profil n'a pas encore complété cet événement pour l'année en cours
 */
export function shouldShowEventVisitor(
  progressList: SeasonalEventProgress[],
  profileId: string,
  now: Date = new Date(),
): boolean {
  const event = getActiveEvent(now);
  if (!event) return false;

  const year = now.getFullYear();
  const already = progressList.find(
    (p) => p.eventId === event.id && p.year === year && p.profileId === profileId && p.completed,
  );
  return !already;
}

/**
 * Retourne l'eventId de l'événement actif non encore complété, ou null.
 */
export function getVisibleEventId(
  progressList: SeasonalEventProgress[],
  profileId: string,
  now: Date = new Date(),
): string | null {
  const event = getActiveEvent(now);
  if (!event) return null;

  const year = now.getFullYear();
  const already = progressList.find(
    (p) => p.eventId === event.id && p.year === year && p.profileId === profileId && p.completed,
  );
  return already ? null : event.id;
}

/**
 * Tire une récompense GARANTIE dans le pool saisonnier correspondant au choix.
 * Le choiceIndex influence la rareté (0 → commun, 1 → rare, 2 → épique).
 * Fallback : si le pool cible est vide, descend au pool inférieur, puis commun.
 */
export function drawGuaranteedSeasonalReward(
  event: SeasonalEvent,
  choiceIndex: number,
): { reward: RewardDefinition; rarity: string } {
  // Ordre de tentative : rareté cible → rarétés inférieures → commun
  const targetRarity = CHOICE_RARITY_MAP[choiceIndex] ?? 'commun';
  const fallbackOrder: string[] = ['commun', 'rare', 'épique'];

  // Construire la séquence de tentative (cible en premier, puis descendre)
  const targetIndex = fallbackOrder.indexOf(targetRarity);
  const candidates: string[] = [];

  // Ajouter la cible et les pools sous la cible, puis commun en dernier recours
  for (let i = targetIndex; i >= 0; i--) {
    candidates.push(fallbackOrder[i]);
  }
  // Dédupliquer (commun peut être dans les deux)
  const unique = Array.from(new Set(candidates));

  for (const rarity of unique) {
    const pool = event.rewards[rarity as keyof typeof event.rewards];
    if (pool && pool.length > 0) {
      const reward = pool[Math.floor(Math.random() * pool.length)];
      return { reward, rarity };
    }
  }

  // Fallback ultime : pool commun ou premier pool disponible
  const rarities = Object.keys(event.rewards) as Array<keyof typeof event.rewards>;
  for (const rarity of rarities) {
    const pool = event.rewards[rarity];
    if (pool && pool.length > 0) {
      const reward = pool[Math.floor(Math.random() * pool.length)];
      return { reward, rarity: String(rarity) };
    }
  }

  // Dernier recours absolu — ne devrait jamais arriver si les events sont correctement configurés
  return {
    reward: {
      emoji: '🎁',
      reward: 'Récompense saisonnière',
      bonusPoints: 5,
      rewardType: 'points',
    },
    rarity: 'commun',
  };
}

/**
 * Construit un objet Saga + SagaProgress à partir du contenu d'un événement saisonnier.
 * Produit une saga à un seul chapitre sans finale (interaction courte).
 */
export function buildSeasonalEventAsSaga(
  content: SeasonalEventContent,
  profileId: string,
): { saga: Saga; progress: SagaProgress } {
  const today = new Date().toISOString().slice(0, 10);

  const saga: Saga = {
    id: content.eventId,
    emoji: content.emoji,
    titleKey: content.titleKey,
    descriptionKey: content.visitorNameKey,
    chapters: [content.chapter],
    finale: {
      variants: {},
      defaultTrait: 'courage',
    },
    sceneEmoji: content.emoji,
  };

  const progress = createEmptySagaProgress(content.eventId, profileId, today);

  return { saga, progress };
}
