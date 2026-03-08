/**
 * themes.ts — Profile theme definitions
 *
 * Each family member can pick a visual theme that changes:
 * - Loot box pack appearance (emoji, label, colors)
 * - Confetti colors during loot opening
 * - Accent colors across the entire app (via ThemeContext)
 */

export type ProfileTheme =
  | 'voitures'
  | 'nature'
  | 'pompier'
  | 'licorne'
  | 'espace'
  | 'pirates'
  | 'dinosaures'
  | 'pokemon'
  | 'default';

export interface ThemeConfig {
  id: ProfileTheme;
  label: string;
  emoji: string;
  primary: string;         // main accent color
  tint: string;            // light background for badges, chips (always light)
  secondary: string;       // complementary color for loot packs (can be dark)
  packEmoji: string;       // booster pack closed
  packOpenEmoji: string;   // booster pack opening
  packLabel: string;       // "Booster Turbo", etc.
  confettiColors: string[];
}

export const THEMES: Record<ProfileTheme, ThemeConfig> = {
  voitures: {
    id: 'voitures',
    label: 'Voitures',
    emoji: '🏎️',
    primary: '#DC2626',
    tint: '#FEE2E2',
    secondary: '#1F2937',
    packEmoji: '🏎️',
    packOpenEmoji: '🏁',
    packLabel: 'Booster Turbo',
    confettiColors: ['#DC2626', '#FF6B6B', '#1F2937', '#FFFFFF', '#F59E0B'],
  },
  nature: {
    id: 'nature',
    label: 'Nature',
    emoji: '🌿',
    primary: '#059669',
    tint: '#D1FAE5',
    secondary: '#D1FAE5',
    packEmoji: '🌿',
    packOpenEmoji: '🌸',
    packLabel: 'Pack Forêt',
    confettiColors: ['#059669', '#34D399', '#A7F3D0', '#FDE68A', '#FFFFFF'],
  },
  pompier: {
    id: 'pompier',
    label: 'Pompier',
    emoji: '🚒',
    primary: '#EA580C',
    tint: '#FEF3C7',
    secondary: '#FEF3C7',
    packEmoji: '🚒',
    packOpenEmoji: '🔥',
    packLabel: 'Pack Héros',
    confettiColors: ['#EA580C', '#F59E0B', '#EF4444', '#FFFFFF', '#FDE68A'],
  },
  licorne: {
    id: 'licorne',
    label: 'Licorne',
    emoji: '🦄',
    primary: '#EC4899',
    tint: '#FCE7F3',
    secondary: '#FCE7F3',
    packEmoji: '🦄',
    packOpenEmoji: '✨',
    packLabel: 'Pack Magique',
    confettiColors: ['#EC4899', '#A855F7', '#F0ABFC', '#FFFFFF', '#FDE68A'],
  },
  espace: {
    id: 'espace',
    label: 'Espace',
    emoji: '🚀',
    primary: '#2563EB',
    tint: '#DBEAFE',
    secondary: '#1E3A5F',
    packEmoji: '🚀',
    packOpenEmoji: '🌟',
    packLabel: 'Pack Cosmos',
    confettiColors: ['#2563EB', '#60A5FA', '#FFFFFF', '#FDE68A', '#A855F7'],
  },
  pirates: {
    id: 'pirates',
    label: 'Pirates',
    emoji: '🏴‍☠️',
    primary: '#78350F',
    tint: '#FDE68A',
    secondary: '#FDE68A',
    packEmoji: '🏴‍☠️',
    packOpenEmoji: '💰',
    packLabel: 'Pack Trésor',
    confettiColors: ['#78350F', '#F59E0B', '#FDE68A', '#FFFFFF', '#DC2626'],
  },
  dinosaures: {
    id: 'dinosaures',
    label: 'Dinosaures',
    emoji: '🦕',
    primary: '#16A34A',
    tint: '#DCFCE7',
    secondary: '#DCFCE7',
    packEmoji: '🦕',
    packOpenEmoji: '🦖',
    packLabel: 'Pack Jurassique',
    confettiColors: ['#16A34A', '#4ADE80', '#DCFCE7', '#78350F', '#FFFFFF'],
  },
  pokemon: {
    id: 'pokemon',
    label: 'Pokémon',
    emoji: '🔴',
    primary: '#E3350D',
    tint: '#FEE2E2',
    secondary: '#1A1A2E',
    packEmoji: '🔴',
    packOpenEmoji: '⚡',
    packLabel: 'Booster Pokémon',
    confettiColors: ['#E3350D', '#FFFFFF', '#FFD700', '#3B82F6', '#16A34A'],
  },
  default: {
    id: 'default',
    label: 'Classique',
    emoji: '🎁',
    primary: '#7C3AED',
    tint: '#EDE9FE',
    secondary: '#EDE9FE',
    packEmoji: '🎁',
    packOpenEmoji: '✨',
    packLabel: 'Loot Box',
    confettiColors: ['#7C3AED', '#A855F7', '#C4B5FD', '#FFFFFF', '#F59E0B'],
  },
};

export const THEME_LIST: ThemeConfig[] = Object.values(THEMES);

/** Valid theme IDs for validation */
export const VALID_THEMES = new Set<string>(Object.keys(THEMES));

/** Get theme config with fallback to default */
export function getTheme(themeId?: string): ThemeConfig {
  if (themeId && VALID_THEMES.has(themeId)) {
    return THEMES[themeId as ProfileTheme];
  }
  return THEMES.default;
}
