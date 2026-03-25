// ─────────────────────────────────────────────
// Mascotte Arbre — Saisons automatiques
// ─────────────────────────────────────────────

import { type TreeSpecies, type SpeciesVisual, SPECIES_INFO } from './types';

/** 4 saisons */
export type Season = 'printemps' | 'ete' | 'automne' | 'hiver';

/** Emoji + clé i18n par saison */
export const SEASON_INFO: Record<Season, { emoji: string; labelKey: string }> = {
  printemps: { emoji: '🌸', labelKey: 'mascot.season.printemps' },
  ete:       { emoji: '☀️', labelKey: 'mascot.season.ete' },
  automne:   { emoji: '🍂', labelKey: 'mascot.season.automne' },
  hiver:     { emoji: '❄️', labelKey: 'mascot.season.hiver' },
};

/**
 * Retourne la saison courante basée sur le mois.
 * Hémisphère nord (France).
 */
export function getCurrentSeason(date: Date = new Date()): Season {
  const month = date.getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'printemps';  // mars–mai
  if (month >= 5 && month <= 7) return 'ete';         // juin–août
  if (month >= 8 && month <= 10) return 'automne';    // sept–nov
  return 'hiver';                                      // déc–fév
}

/** Couleurs du ciel par saison */
export const SKY_COLORS: Record<Season, { top: string; bottom: string }> = {
  printemps: { top: '#87CEEB', bottom: '#E0F7FA' },
  ete:       { top: '#4FC3F7', bottom: '#E1F5FE' },
  automne:   { top: '#FFAB91', bottom: '#FFF3E0' },
  hiver:     { top: '#B0BEC5', bottom: '#ECEFF1' },
};

/** Couleurs du sol par saison */
export const GROUND_COLORS: Record<Season, { top: string; bottom: string }> = {
  printemps: { top: '#7CB342', bottom: '#558B2F' },
  ete:       { top: '#8BC34A', bottom: '#689F38' },
  automne:   { top: '#A1887F', bottom: '#795548' },
  hiver:     { top: '#CFD8DC', bottom: '#90A4AE' },
};

/** Type de particule saisonnière */
export interface SeasonalParticle {
  emoji: string;
  color: string;
  count: number;
  speed: 'slow' | 'normal' | 'fast';
  direction: 'up' | 'down' | 'float';
}

/** Particules ambiantes par saison */
export const SEASONAL_PARTICLES: Record<Season, SeasonalParticle> = {
  printemps: { emoji: '🌸', color: '#FFB7C5', count: 6, speed: 'slow', direction: 'down' },
  ete:       { emoji: '✨', color: '#FFE082', count: 4, speed: 'slow', direction: 'float' },
  automne:   { emoji: '🍂', color: '#D4A373', count: 8, speed: 'normal', direction: 'down' },
  hiver:     { emoji: '❄️', color: '#E3F2FD', count: 10, speed: 'slow', direction: 'down' },
};

// ── Palettes saisonnières par espèce ──────────

type SeasonalPalette = Pick<SpeciesVisual, 'leaves' | 'leavesDark' | 'leavesLight' | 'accent' | 'accentLight' | 'particle'>;

/**
 * Overrides de couleurs par saison et espèce.
 * printemps = couleurs par défaut (SPECIES_INFO inchangé).
 * Les champs omis héritent de SPECIES_INFO.
 */
const SEASONAL_OVERRIDES: Record<Season, Partial<Record<TreeSpecies, Partial<SeasonalPalette>>>> = {
  printemps: {}, // couleurs par défaut

  ete: {
    cerisier: {
      leaves: '#2E7D32',
      leavesDark: '#1B5E20',
      leavesLight: '#66BB6A',
      accent: '#E91E63',      // cerises rouges
      accentLight: '#F48FB1',
      particle: '#FF5252',
    },
    chene: {
      leaves: '#1B5E20',
      leavesDark: '#0D3B12',
      leavesLight: '#43A047',
      particle: '#558B2F',
    },
    bambou: {
      leaves: '#66BB6A',
      leavesDark: '#2E7D32',
      leavesLight: '#A5D6A7',
      particle: '#76FF03',
    },
    oranger: {
      leaves: '#1B5E20',
      leavesDark: '#004D00',
      leavesLight: '#2E7D32',
      accent: '#FF6D00',      // oranges mûres
      accentLight: '#FF9100',
      particle: '#FFAB00',
    },
    palmier: {
      leaves: '#00695C',
      leavesDark: '#004D40',
      leavesLight: '#26A69A',
      particle: '#80DEEA',
    },
  },

  automne: {
    cerisier: {
      leaves: '#E65100',
      leavesDark: '#BF360C',
      leavesLight: '#FF8A65',
      accent: '#D84315',
      accentLight: '#FF7043',
      particle: '#FF6E40',
    },
    chene: {
      leaves: '#BF360C',
      leavesDark: '#8D2C0B',
      leavesLight: '#E64A19',
      accent: '#795548',      // glands bruns
      accentLight: '#A1887F',
      particle: '#D4A373',
    },
    bambou: {
      leaves: '#8BC34A',
      leavesDark: '#689F38',
      leavesLight: '#C5E1A5',
      particle: '#AED581',
    },
    oranger: {
      leaves: '#F57F17',
      leavesDark: '#E65100',
      leavesLight: '#FFB74D',
      accent: '#FF6D00',
      accentLight: '#FF9100',
      particle: '#FFAB40',
    },
    palmier: {
      leaves: '#558B2F',
      leavesDark: '#33691E',
      leavesLight: '#8BC34A',
      particle: '#C0CA33',
    },
  },

  hiver: {
    cerisier: {
      leaves: '#78909C',
      leavesDark: '#546E7A',
      leavesLight: '#B0BEC5',
      accent: '#B0BEC5',      // pas de fleurs en hiver
      accentLight: '#CFD8DC',
      particle: '#E3F2FD',
    },
    chene: {
      leaves: '#5D4037',
      leavesDark: '#3E2723',
      leavesLight: '#795548',
      accent: '#6D4C41',
      accentLight: '#8D6E63',
      particle: '#D7CCC8',
    },
    bambou: {
      leaves: '#4CAF50',      // bambou reste vert (sempervirent)
      leavesDark: '#2E7D32',
      leavesLight: '#81C784',
      particle: '#C8E6C9',
    },
    oranger: {
      leaves: '#546E7A',
      leavesDark: '#37474F',
      leavesLight: '#78909C',
      accent: '#FF8F00',      // quelques oranges tardives
      accentLight: '#FFB300',
      particle: '#CFD8DC',
    },
    palmier: {
      leaves: '#37474F',
      leavesDark: '#263238',
      leavesLight: '#546E7A',
      particle: '#B0BEC5',
    },
  },
};

/**
 * Retourne les couleurs visuelles d'une espèce adaptées à la saison.
 * Fusionne SPECIES_INFO avec les overrides saisonniers.
 */
export function getSeasonalPalette(species: TreeSpecies, season: Season): SpeciesVisual {
  const base = SPECIES_INFO[species];
  const overrides = SEASONAL_OVERRIDES[season]?.[species];

  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
  };
}
