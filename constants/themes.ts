/**
 * themes.ts — Profile theme definitions
 *
 * Each family member can pick a visual theme that changes:
 * - Loot box pack appearance (emoji, label, colors)
 * - Confetti colors during loot opening
 * - Accent color on the loot screen
 */

export type ProfileTheme =
  | 'voitures'
  | 'nature'
  | 'pompier'
  | 'licorne'
  | 'espace'
  | 'pirates'
  | 'dinosaures'
  | 'default';

export interface ThemeConfig {
  id: ProfileTheme;
  label: string;
  emoji: string;
  primary: string;         // main accent color
  secondary: string;       // light background
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
    secondary: '#DCFCE7',
    packEmoji: '🦕',
    packOpenEmoji: '🦖',
    packLabel: 'Pack Jurassique',
    confettiColors: ['#16A34A', '#4ADE80', '#DCFCE7', '#78350F', '#FFFFFF'],
  },
  default: {
    id: 'default',
    label: 'Classique',
    emoji: '🎁',
    primary: '#7C3AED',
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
