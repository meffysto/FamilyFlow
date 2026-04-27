/**
 * themes.ts — Profile theme definitions
 *
 * Each family member can pick a visual theme that changes:
 * - Loot box pack appearance (emblem, colors)
 * - Confetti colors during loot opening
 * - Accent colors across the entire app (via ThemeContext)
 *
 * Palette refactored — couleurs atténuées, noms neutres adultes/enfants.
 * Anciens IDs (voitures, pokemon, pompier, licorne, nature, dinosaures, espace,
 * default, pirates) migrés automatiquement via THEME_MIGRATION.
 */

export type ProfileTheme =
  | 'coquelicot'
  | 'sunset'
  | 'pivoine'
  | 'foret'
  | 'ocean'
  | 'lavande'
  | 'sable';

export interface ThemeConfig {
  id: ProfileTheme;
  label: string;
  emoji: string;           // affiché dans le picker (legacy — devrait migrer vers swatch)
  primary: string;         // main accent color
  primaryDark?: string;    // dark mode variant
  tint: string;            // light background for badges, chips
  tintDark?: string;       // dark mode variant
  secondary: string;       // complementary color for loot packs
  packEmoji: string;       // booster pack closed (legacy)
  packOpenEmoji: string;   // booster pack opening (legacy)
  packLabel: string;       // affiché dans LootBoxOpener
  confettiColors: string[];
}

/** Migration map — anciens IDs → nouveaux IDs */
export const THEME_MIGRATION: Record<string, ProfileTheme> = {
  voitures: 'coquelicot',
  pokemon: 'coquelicot',
  pompier: 'sunset',
  licorne: 'pivoine',
  nature: 'foret',
  dinosaures: 'foret',
  espace: 'ocean',
  default: 'lavande',
  pirates: 'sable',
};

export const THEMES: Record<ProfileTheme, ThemeConfig> = {
  coquelicot: {
    id: 'coquelicot',
    label: 'Coquelicot',
    emoji: '🔴',
    primary: '#B85450',
    primaryDark: '#E08580',
    tint: '#FCE8E6',
    tintDark: '#3B1A1A',
    secondary: '#1F2937',
    packEmoji: '🎁',
    packOpenEmoji: '✨',
    packLabel: 'Pack Coquelicot',
    confettiColors: ['#B85450', '#E08580', '#FCE8E6', '#FFFFFF', '#F5C26B'],
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    emoji: '🟠',
    primary: '#C76A3A',
    primaryDark: '#E89868',
    tint: '#FBEAD9',
    tintDark: '#3B2A10',
    secondary: '#FBEAD9',
    packEmoji: '🎁',
    packOpenEmoji: '✨',
    packLabel: 'Pack Sunset',
    confettiColors: ['#C76A3A', '#E89868', '#FBEAD9', '#FFFFFF', '#F5C26B'],
  },
  pivoine: {
    id: 'pivoine',
    label: 'Pivoine',
    emoji: '🌸',
    primary: '#C77199',
    primaryDark: '#E5A4C0',
    tint: '#FAE3EE',
    tintDark: '#3B1A2E',
    secondary: '#FAE3EE',
    packEmoji: '🎁',
    packOpenEmoji: '✨',
    packLabel: 'Pack Pivoine',
    confettiColors: ['#C77199', '#E5A4C0', '#FAE3EE', '#FFFFFF', '#F5C26B'],
  },
  foret: {
    id: 'foret',
    label: 'Forêt',
    emoji: '🌿',
    primary: '#4A8B6B',
    primaryDark: '#7AB394',
    tint: '#E0F0E8',
    tintDark: '#1A3B2A',
    secondary: '#E0F0E8',
    packEmoji: '🎁',
    packOpenEmoji: '✨',
    packLabel: 'Pack Forêt',
    confettiColors: ['#4A8B6B', '#7AB394', '#E0F0E8', '#FFFFFF', '#F5C26B'],
  },
  ocean: {
    id: 'ocean',
    label: 'Océan',
    emoji: '🌊',
    primary: '#5577B8',
    primaryDark: '#85A4D6',
    tint: '#E2EAF6',
    tintDark: '#1A2A4B',
    secondary: '#1E3A5F',
    packEmoji: '🎁',
    packOpenEmoji: '✨',
    packLabel: 'Pack Océan',
    confettiColors: ['#5577B8', '#85A4D6', '#E2EAF6', '#FFFFFF', '#F5C26B'],
  },
  lavande: {
    id: 'lavande',
    label: 'Lavande',
    emoji: '💜',
    primary: '#8773C2',
    primaryDark: '#AA9CD6',
    tint: '#ECE7F6',
    tintDark: '#2A1A4B',
    secondary: '#ECE7F6',
    packEmoji: '🎁',
    packOpenEmoji: '✨',
    packLabel: 'Pack Lavande',
    confettiColors: ['#8773C2', '#AA9CD6', '#ECE7F6', '#FFFFFF', '#F5C26B'],
  },
  sable: {
    id: 'sable',
    label: 'Sable',
    emoji: '🟫',
    primary: '#A07952',
    primaryDark: '#C9A375',
    tint: '#F2E5D5',
    tintDark: '#3B2F10',
    secondary: '#F2E5D5',
    packEmoji: '🎁',
    packOpenEmoji: '✨',
    packLabel: 'Pack Sable',
    confettiColors: ['#A07952', '#C9A375', '#F2E5D5', '#FFFFFF', '#F5C26B'],
  },
};

export const THEME_LIST: ThemeConfig[] = Object.values(THEMES);

/** Valid theme IDs for validation (nouveaux + anciens migrables) */
export const VALID_THEMES = new Set<string>([
  ...Object.keys(THEMES),
  ...Object.keys(THEME_MIGRATION),
]);

/** Migre un ID legacy vers le nouvel ID si nécessaire. */
export function migrateThemeId(themeId?: string): ProfileTheme {
  if (!themeId) return 'lavande';
  if (themeId in THEMES) return themeId as ProfileTheme;
  if (themeId in THEME_MIGRATION) return THEME_MIGRATION[themeId];
  return 'lavande';
}

/** Get theme config with migration + fallback */
export function getTheme(themeId?: string): ThemeConfig {
  return THEMES[migrateThemeId(themeId)];
}
