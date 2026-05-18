/**
 * slot-mapping.ts — Définitions des 4 créneaux de la journée
 *
 * Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * 4 slots fixes : Matin (06-12), Midi (12-14), Aprem (14-18), Soir (18-06).
 * Le slot Soir wrap après minuit (englobe la nuit).
 *
 * Module pur (aucune dépendance React/RN) — testable en Node.
 */

import type { SlotId } from '../types';

export const SLOT_IDS: readonly SlotId[] = ['matin', 'midi', 'aprem', 'soir'] as const;

export interface SlotDefinition {
  id: SlotId;
  label: string;                    // 'Matin', 'Midi', 'Après-midi', 'Soir'
  iconName: 'Sunrise' | 'Sun' | 'Sunset' | 'Moon';
  startHour: number;                // inclusif (24h)
  endHour: number;                  // exclusif (peut wrap pour soir)
  capacityMinutes: number;          // ~75% de la durée du slot (estimation utile)
  timeRangeLabel: string;           // '06:00 – 12:00' etc.
  emojiMarker: '☀️' | '🍽️' | '☕' | '🌙';
  freeTimeIconName: 'Coffee' | 'Sun' | 'Leaf' | 'Heart';
  freeTimeLabel: string;            // 'PAUSE', 'RESPIRE', 'PROFITE', 'DÉTENTE'
}

export const SLOT_DEFINITIONS: Record<SlotId, SlotDefinition> = {
  matin: {
    id: 'matin',
    label: 'Matin',
    iconName: 'Sunrise',
    startHour: 6,
    endHour: 12,
    capacityMinutes: 270,
    timeRangeLabel: '06:00 – 12:00',
    emojiMarker: '☀️',
    freeTimeIconName: 'Coffee',
    freeTimeLabel: 'PAUSE',
  },
  midi: {
    id: 'midi',
    label: 'Midi',
    iconName: 'Sun',
    startHour: 12,
    endHour: 14,
    capacityMinutes: 90,
    timeRangeLabel: '12:00 – 14:00',
    emojiMarker: '🍽️',
    freeTimeIconName: 'Sun',
    freeTimeLabel: 'RESPIRE',
  },
  aprem: {
    id: 'aprem',
    label: 'Après-midi',
    iconName: 'Sunset',
    startHour: 14,
    endHour: 18,
    capacityMinutes: 180,
    timeRangeLabel: '14:00 – 18:00',
    emojiMarker: '☕',
    freeTimeIconName: 'Leaf',
    freeTimeLabel: 'PROFITE',
  },
  soir: {
    id: 'soir',
    label: 'Soir',
    iconName: 'Moon',
    startHour: 18,
    endHour: 6,
    capacityMinutes: 180,
    timeRangeLabel: '18:00 – 06:00',
    emojiMarker: '🌙',
    freeTimeIconName: 'Heart',
    freeTimeLabel: 'DÉTENTE',
  },
};

/**
 * Map une heure HH:MM (ou HH:MM:SS) vers un slot.
 * Le slot Soir wrap après minuit : 18-23 et 0-5 → 'soir'.
 */
export function timeToSlot(time: string): SlotId {
  const h = parseInt(time.slice(0, 2), 10);
  if (Number.isNaN(h)) return 'soir';
  if (h >= 6 && h < 12) return 'matin';
  if (h >= 12 && h < 14) return 'midi';
  if (h >= 14 && h < 18) return 'aprem';
  return 'soir'; // 18-23 et 0-5
}

/**
 * Détecte un slot depuis le sourceFile (pattern "Routine matin" / "Routine soir").
 * Retourne null si aucun pattern reconnu.
 */
export function fileToSlot(sourceFile: string): SlotId | null {
  if (/Routine\s+matin/i.test(sourceFile)) return 'matin';
  if (/Routine\s+soir/i.test(sourceFile)) return 'soir';
  return null;
}

/**
 * Détecte un slot depuis le titre d'une tâche via mots-clés temporels STRICTS.
 * Retourne null si aucun keyword reconnu.
 *
 * Volontairement conservateur : seuls les mots qui désignent EXPLICITEMENT un
 * moment de la journée sont matchés. Pas d'inférence sémantique du type
 * "courses → aprem" ou "bain → soir" — trop magique, risque de surprise.
 *
 * Ordre de test : soir d'abord (intercepte "biberon soir" avant que "matin"
 * apparaissant ailleurs ne se déclenche), puis matin, midi, aprem.
 */
export function titleToSlot(text: string): SlotId | null {
  if (!text) return null;
  // Soir d'abord (priorité quand un titre porte plusieurs moments — rare)
  if (/\bsoir(ée|ee)?\b|\bd[iîîe]ner\b|\bcoucher\b|\bdodo\b|\bnuit\b/i.test(text)) return 'soir';
  if (/\bmatin(al)?\b|\br[ée]veil\b|\bpetit[\s-]?d[ée]j/i.test(text)) return 'matin';
  // Aprem AVANT midi sinon `\bmidi\b` capterait "midi" dans "après-midi"
  if (/\baprem\b|\bapr[èe]s[\s-]?midi\b|\bgo[uû]ter\b/i.test(text)) return 'aprem';
  if (/\bmidi\b|\bd[ée]jeuner\b/i.test(text)) return 'midi';
  return null;
}

/** Durée estimée d'une tâche en minutes (défaut 15 si pas d'info). */
export const DEFAULT_TASK_DURATION_MIN = 15;
