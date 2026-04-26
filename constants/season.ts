/**
 * season.ts — Saisonnalité partagée FamilyFlow
 *
 * Source de vérité pour la saison courante. Utilisé par LivingGradient,
 * SeasonalParticles, copy contextuel (greeting Caveat, Sporée), etc.
 *
 *   Printemps : 1er mars – 31 mai      (pollen, fleurs)
 *   Été       : 1er juin – 31 août     (soleil, étincelles)
 *   Automne   : 1er sept – 30 nov      (feuilles, ocre)
 *   Hiver     : 1er déc – 28 février   (neige, givre, bleu nuit)
 *
 * Convention : noms de saisons en EN (winter/spring/summer/autumn) pour la
 * compat avec `SeasonalParticles.tsx` existant. Les copy/labels visibles
 * utilisateur sont en FR (`label`, `mood`).
 */

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export interface SeasonTheme {
  /** Label FR pour usage UI (sub-titles, footers Caveat, etc.) */
  label: string;
  /** Ambiance courte FR pour copy contextuel (« matin doré », « soir givré ») */
  mood: string;
  /**
   * Tint warm injecté dans LivingGradient. Mixé avec la palette time-of-day
   * pour colorer subtilement l'ambiance globale par saison.
   */
  tint: string;
  /**
   * Poids du mix (0–1). Plus c'est élevé, plus la saison domine sur l'heure.
   * 0.25 = palette time reste lisible, saison ajoute une teinte.
   */
  blend: number;
}

export const SEASON_THEME: Record<Season, SeasonTheme> = {
  spring: {
    label: 'Printemps',
    mood: 'pollen au vent',
    tint: '#9DAE7E', // mousse claire
    blend: 0.22,
  },
  summer: {
    label: 'Été',
    mood: 'lumière haute',
    tint: '#E8C858', // or doux
    blend: 0.20,
  },
  autumn: {
    label: 'Automne',
    mood: 'feuilles qui tombent',
    tint: '#B85C3D', // terracotta
    blend: 0.28,
  },
  winter: {
    label: 'Hiver',
    mood: 'premier givre',
    tint: '#5A6B7E', // bleu nuit doux
    blend: 0.30,
  },
};

/**
 * Calcule la saison à partir d'une date (par défaut maintenant).
 * Mois 0-indexés en JS : déc=11, jan=0, fév=1.
 */
export function getCurrentSeason(date: Date = new Date()): Season {
  const m = date.getMonth();
  if (m === 11 || m === 0 || m === 1) return 'winter';
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  return 'autumn';
}
