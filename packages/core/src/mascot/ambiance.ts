/**
 * ambiance.ts — Logique pure pour l'ambiance horaire du diorama arbre
 *
 * Determines the time slot and ambient particle configuration
 * based on the current hour. No React imports.
 */

/** Moment de la journee pour l'ambiance du diorama */
export type TimeSlot = 'matin' | 'jour' | 'soir' | 'nuit';

/** Retourne le slot horaire pour une date donnee */
export function getTimeSlot(date: Date = new Date()): TimeSlot {
  const h = date.getHours();
  if (h >= 5 && h < 9) return 'matin';
  if (h >= 9 && h < 19) return 'jour';
  if (h >= 19 && h < 21) return 'soir';
  return 'nuit';
}

export interface AmbiantConfig {
  particleColor: string;
  particleCount: number;
  particleSize: number;
  direction: 'down' | 'float';
  opacity: number;
  duration: number;
  colorOverlay?: string;
}

export const AMBIENT_CONFIGS: Record<TimeSlot, AmbiantConfig | null> = {
  matin: {
    particleColor: '#C8E6FF',
    particleCount: 7,
    particleSize: 3,
    direction: 'down',
    opacity: 0.45,
    duration: 7000,
    colorOverlay: 'rgba(180, 220, 255, 0.06)',
  },
  jour: null,
  soir: {
    particleColor: '#FFD59E',
    particleCount: 4,
    particleSize: 4,
    direction: 'float',
    opacity: 0.35,
    duration: 5000,
    colorOverlay: 'rgba(255, 170, 80, 0.07)',
  },
  nuit: {
    particleColor: '#AAFF66',
    particleCount: 6,
    particleSize: 5,
    direction: 'float',
    opacity: 0.70,
    duration: 4500,
    colorOverlay: 'rgba(20, 10, 60, 0.12)',
  },
};
