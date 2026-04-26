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

/** Gradient 4-stops (haut-gauche → bas-droite) du hero dashboard. */
export type SeasonGradient = readonly [string, string, string, string];

export interface SeasonTheme {
  /** Label FR pour usage UI (sub-titles, footers Caveat, etc.) */
  label: string;
  /** Ambiance courte FR pour copy contextuel (« matin doré », « soir givré ») */
  mood: string;
  /** Gradient 4-stops pour le hero du dashboard (mode light) */
  gradient: SeasonGradient;
  /** Variante dark (warm-deep, jamais bleu froid) */
  gradientDark: SeasonGradient;
}

export const SEASON_THEME: Record<Season, SeasonTheme> = {
  spring: {
    label: 'Printemps',
    mood: 'pollen au vent',
    // 4-stops vert tendre → beige doré → pêche claire → coral pollen.
    // Avant : terminait sur terracotta #B85C3D qui muddait la palette en automne foncé.
    // Maintenant : `#E89B7A` coral léger qui garde la chaleur sans assombrir.
    gradient: ['#D4EBB8', '#EDDCAE', '#F8DCAA', '#E89B7A'],
    // Dark : olive léger → beige cuir → pêche désaturée → coral muted.
    // Avant : tout en muddy brown #4A2820. Maintenant : retient un soupçon de printemps.
    gradientDark: ['#4A5832', '#4A4530', '#4A3A28', '#5D3A2E'],
  },
  summer: {
    label: 'Été',
    mood: 'lumière haute',
    gradient: ['#FFE9B0', '#E8C858', '#C49A4A', '#A4502B'],
    gradientDark: ['#3D3520', '#3A2E18', '#2E2418', '#3A1E14'],
  },
  autumn: {
    label: 'Automne',
    mood: 'feuilles qui tombent',
    gradient: ['#E8C5A0', '#C4824D', '#A4502B', '#7C3F1C'],
    gradientDark: ['#352820', '#2E1F18', '#28160E', '#1E1108'],
  },
  winter: {
    label: 'Hiver',
    mood: 'premier givre',
    gradient: ['#C8D4E1', '#9DB1C7', '#5A6B7E', '#2C3D54'],
    gradientDark: ['#1E2A38', '#1A2030', '#141A24', '#0E121A'],
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
