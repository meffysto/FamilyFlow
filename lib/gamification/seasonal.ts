/**
 * seasonal.ts — Détection d'événements saisonniers et injection dans le pool loot
 *
 * Zéro config : les événements se déclenchent automatiquement par date.
 * Pâques est calculé dynamiquement (algorithme de Meeus/Jones/Butcher).
 */

import { SeasonalEvent, LootRarity, RewardDefinition } from '../types';
import { SEASONAL_EVENTS, SEASONAL_DROP_CHANCE } from './seasonal-rewards';

// ─── Calcul date de Pâques (Meeus/Jones/Butcher) ────────────────────────────

/** Retourne le dimanche de Pâques pour une année donnée */
export function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// ─── Résolution des dates ────────────────────────────────────────────────────

interface ResolvedDates {
  start: Date;
  end: Date;
}

/** Résout les dates d'un événement pour l'année en cours */
function resolveEventDates(event: SeasonalEvent, year: number): ResolvedDates {
  if (event.id === 'paques') {
    const easter = getEasterDate(year);
    const start = new Date(easter);
    start.setDate(start.getDate() - 3);
    const end = new Date(easter);
    end.setDate(end.getDate() + 3);
    // Fin de journée
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // Format MM-DD
  const [startMonth, startDay] = event.startDate.split('-').map(Number);
  const [endMonth, endDay] = event.endDate.split('-').map(Number);

  let startYear = year;
  let endYear = year;

  // Gestion du passage d'année (ex: nouvel-an 27 déc → 2 jan)
  if (endMonth < startMonth) {
    // On est dans la période qui chevauche l'année
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    if (currentMonth <= endMonth) {
      // On est en janvier, le start était l'année dernière
      startYear = year - 1;
    } else {
      // On est en décembre, le end sera l'année prochaine
      endYear = year + 1;
    }
  }

  const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
  const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

  return { start, end };
}

// ─── API publique ────────────────────────────────────────────────────────────

/** Retourne l'événement saisonnier actif, ou null */
export function getActiveEvent(now: Date = new Date()): SeasonalEvent | null {
  const year = now.getFullYear();

  for (const event of SEASONAL_EVENTS) {
    const { start, end } = resolveEventDates(event, year);
    if (now >= start && now <= end) {
      return event;
    }
  }
  return null;
}

/** Vérifie si un événement est actif */
export function isSeasonalActive(now: Date = new Date()): boolean {
  return getActiveEvent(now) !== null;
}

/** Jours restants pour l'événement actif (0 = dernier jour) */
export function seasonalDaysRemaining(now: Date = new Date()): number {
  const event = getActiveEvent(now);
  if (!event) return 0;
  const year = now.getFullYear();
  const { end } = resolveEventDates(event, year);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Retourne le prochain événement à venir (pas encore actif) + jours restants */
export function getNextEvent(now: Date = new Date()): { event: SeasonalEvent; daysUntil: number } | null {
  const year = now.getFullYear();
  let best: { event: SeasonalEvent; daysUntil: number } | null = null;

  for (const event of SEASONAL_EVENTS) {
    // Tester l'année en cours et l'année suivante (pour les événements en janvier)
    for (const y of [year, year + 1]) {
      const { start } = resolveEventDates(event, y);
      const diff = start.getTime() - now.getTime();
      if (diff > 0) {
        const daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (!best || daysUntil < best.daysUntil) {
          best = { event, daysUntil };
        }
        break; // pas besoin de tester year+1 si year est déjà dans le futur
      }
    }
  }

  return best;
}

/**
 * Tente de piocher une reward saisonnière pour une rareté donnée.
 * Retourne la reward + l'event id, ou null si pas de drop saisonnier.
 */
export function trySeasonalDraw(
  rarity: LootRarity,
  now: Date = new Date()
): { reward: RewardDefinition; eventId: string } | null {
  const event = getActiveEvent(now);
  if (!event) return null;

  // 20% de chance de drop saisonnier
  if (Math.random() >= SEASONAL_DROP_CHANCE) return null;

  const pool = event.rewards[rarity];
  if (!pool || pool.length === 0) return null;

  const reward = pool[Math.floor(Math.random() * pool.length)];
  return { reward, eventId: event.id };
}
