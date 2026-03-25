/**
 * rewards.ts — Loot box reward pool definitions
 *
 * Five rarities (Fortnite-inspired) with weighted drop rates:
 *
 * | Rareté      | Enfant | Ado   | Adulte |
 * |-------------|--------|-------|--------|
 * | Commun      | 50%    | 52%   | 55%    |
 * | Rare        | 30%    | 29%   | 28%    |
 * | Épique      | 14%    | 13%   | 12%    |
 * | Légendaire  | 5%     | 5%    | 4%     |
 * | Mythique    | 1%     | 1%    | 1%     |
 *
 * Pity system: after 5 boxes without épique+, next is guaranteed épique minimum.
 */

import * as SecureStore from 'expo-secure-store';
import { t } from 'i18next';
import { RewardDefinition, LootRarity, Profile } from '../types';

// ─── Gamification Config (modifiable via réglages) ─────────────────────────────

export const GAMI_CONFIG_KEY = 'gami_config_v1';

export interface GamificationConfig {
  pointsPerTask: number;
  streakBonus: number;
  lootThreshold: { enfant: number; ado: number; adulte: number };
}

export const DEFAULT_GAMI_CONFIG: GamificationConfig = {
  pointsPerTask: 10,
  streakBonus: 5,
  lootThreshold: { enfant: 50, ado: 75, adulte: 100 },
};

let _cachedConfig: GamificationConfig | null = null;

/** Charge la config gamification depuis SecureStore (avec cache mémoire) */
export async function loadGamiConfig(): Promise<GamificationConfig> {
  if (_cachedConfig) return _cachedConfig;
  try {
    const raw = await SecureStore.getItemAsync(GAMI_CONFIG_KEY);
    if (raw) {
      _cachedConfig = { ...DEFAULT_GAMI_CONFIG, ...JSON.parse(raw) };
      return _cachedConfig!;
    }
  } catch {}
  _cachedConfig = DEFAULT_GAMI_CONFIG;
  return _cachedConfig;
}

/** Sauvegarde la config et invalide le cache */
export async function saveGamiConfig(config: GamificationConfig): Promise<void> {
  _cachedConfig = config;
  await SecureStore.setItemAsync(GAMI_CONFIG_KEY, JSON.stringify(config));
}

/** Retourne la config en cache (synchrone, pour les appels chauds) */
export function getCachedGamiConfig(): GamificationConfig {
  return _cachedConfig ?? DEFAULT_GAMI_CONFIG;
}

// ─── Reward Pool ──────────────────────────────────────────────────────────────

export const REWARDS: Record<LootRarity, RewardDefinition[]> = {
  commun: [
    { emoji: '⭐', reward: '+5 points bonus', bonusPoints: 5, rewardType: 'points' },
    { emoji: '🌟', reward: '+8 points bonus', bonusPoints: 8, rewardType: 'points' },
    { emoji: '🍪', reward: 'Un cookie/goûter au choix', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '📱', reward: '+15 min d\'écran', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '🎵', reward: 'Choisir la musique du repas', bonusPoints: 0, rewardType: 'reward' },
    { emoji: '🛋️', reward: 'Choisir sa place dans le canapé', bonusPoints: 0, rewardType: 'reward' },
    { emoji: '🎨', reward: 'Choisir l\'activité du soir', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '🐻', reward: 'Badge Ourson', bonusPoints: 0, rewardType: 'badge' },
    { emoji: '🌈', reward: 'Badge Arc-en-ciel', bonusPoints: 0, rewardType: 'badge' },
    { emoji: '🦋', reward: 'Badge Papillon', bonusPoints: 0, rewardType: 'badge' },
    { emoji: '🍀', reward: 'Badge Trèfle Chanceux', bonusPoints: 0, rewardType: 'badge' },
    { emoji: '🎈', reward: 'Badge Ballon Festif', bonusPoints: 0, rewardType: 'badge' },
  ],
  rare: [
    { emoji: '💫', reward: '+15 points bonus', bonusPoints: 15, rewardType: 'points' },
    { emoji: '🍕', reward: 'Choisir le dîner ce soir !', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '🎬', reward: 'Choisir le film de la soirée', bonusPoints: 0, rewardType: 'reward' },
    { emoji: '📱', reward: '+30 min d\'écran', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '🐞', reward: 'Coccinelle pour ton arbre', bonusPoints: 0, rewardType: 'mascot_hab', mascotItemId: 'coccinelle' },
    { emoji: '🦋', reward: 'Papillons pour ton arbre', bonusPoints: 0, rewardType: 'mascot_hab', mascotItemId: 'papillons' },
    { emoji: '🎄', reward: 'Guirlandes pour ton arbre', bonusPoints: 0, rewardType: 'mascot_deco', mascotItemId: 'guirlandes' },
    { emoji: '🐦', reward: 'Oiseau pour ton arbre', bonusPoints: 0, rewardType: 'mascot_hab', mascotItemId: 'oiseau' },
    { emoji: '🧹', reward: 'Échange une tâche avec quelqu\'un', bonusPoints: 0, rewardType: 'reward' },
    { emoji: '🎮', reward: '+1h de jeux vidéo', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '🦄', reward: 'Badge Licorne Rare', bonusPoints: 0, rewardType: 'badge' },
    { emoji: '🐉', reward: 'Badge Dragon', bonusPoints: 0, rewardType: 'badge' },
    { emoji: '🚀', reward: 'Badge Fusée', bonusPoints: 0, rewardType: 'badge' },
    { emoji: '🏆', reward: 'Badge Trophée d\'Or', bonusPoints: 5, rewardType: 'badge' },
  ],
  épique: [
    { emoji: '💎', reward: '+30 points bonus', bonusPoints: 30, rewardType: 'points' },
    { emoji: '🍦', reward: 'Sortie glace/dessert !', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '🎮', reward: 'Soirée jeux vidéo illimitée', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '😴', reward: 'Coucher tardif : +30 min ce soir', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '🧹', reward: 'Skip une tâche demain (au choix)', bonusPoints: 0, rewardType: 'skip' },
    { emoji: '⚡', reward: 'Multiplicateur ×2 (5 tâches)', bonusPoints: 0, multiplier: 2, multiplierTasks: 5, rewardType: 'multiplier' },
    { emoji: '👑', reward: 'Badge Couronne Royale', bonusPoints: 10, rewardType: 'badge' },
    { emoji: '🌠', reward: 'Badge Étoile Filante', bonusPoints: 15, rewardType: 'badge' },
    { emoji: '🏠', reward: 'Cabane pour ton arbre', bonusPoints: 0, rewardType: 'mascot_deco', mascotItemId: 'cabane' },
    { emoji: '🪹', reward: 'Nid d\'oiseau pour ton arbre', bonusPoints: 0, rewardType: 'mascot_deco', mascotItemId: 'nid' },
    { emoji: '🛌', reward: 'Hamac pour ton arbre', bonusPoints: 0, rewardType: 'mascot_deco', mascotItemId: 'hamac' },
    { emoji: '😺', reward: 'Chat pour ton arbre', bonusPoints: 0, rewardType: 'mascot_hab', mascotItemId: 'chat' },
    { emoji: '🦉', reward: 'Hibou pour ton arbre', bonusPoints: 0, rewardType: 'mascot_hab', mascotItemId: 'hibou' },
  ],
  légendaire: [
    { emoji: '⚡⚡', reward: 'Multiplicateur ×3 (10 tâches) !', bonusPoints: 0, multiplier: 3, multiplierTasks: 10, rewardType: 'multiplier' },
    { emoji: '🎉', reward: 'Sortie spéciale en famille !', bonusPoints: 50, requiresParent: true, rewardType: 'reward' },
    { emoji: '🎂', reward: 'Petit-déjeuner au lit ce week-end', bonusPoints: 0, requiresParent: true, rewardType: 'reward' },
    { emoji: '🧹✨', reward: 'Skip TOUTES les tâches demain', bonusPoints: 0, rewardType: 'skip_all' },
    { emoji: '🌈✨', reward: '+20 pts pour TOUTE la famille', bonusPoints: 20, rewardType: 'family_bonus' },
  ],
  mythique: [
    { emoji: '🏖️', reward: '2 JOURS SANS TÂCHES !', bonusPoints: 100, rewardType: 'vacation' },
    { emoji: '👑💎', reward: 'Roi/Reine de la semaine — choisis le menu !', bonusPoints: 0, rewardType: 'crown' },
    { emoji: '⚡⚡⚡', reward: 'Multiplicateur ×5 (20 tâches) !!', bonusPoints: 0, multiplier: 5, multiplierTasks: 20, rewardType: 'multiplier' },
    { emoji: '🎁🎁', reward: 'Double loot box instantanée !', bonusPoints: 0, rewardType: 'double_loot' },
    { emoji: '🌀', reward: 'Portail magique pour ton arbre', bonusPoints: 0, rewardType: 'mascot_deco', mascotItemId: 'portail' },
    { emoji: '💎', reward: 'Cristal céleste pour ton arbre', bonusPoints: 0, rewardType: 'mascot_deco', mascotItemId: 'cristal' },
    { emoji: '🔥', reward: 'Phénix immortel pour ton arbre', bonusPoints: 0, rewardType: 'mascot_hab', mascotItemId: 'phoenix' },
    { emoji: '🦄', reward: 'Licorne céleste pour ton arbre', bonusPoints: 0, rewardType: 'mascot_hab', mascotItemId: 'licorne' },
  ],
};

// ─── Drop Rates ───────────────────────────────────────────────────────────────

export const DROP_RATES: Record<Profile['role'], Record<LootRarity, number>> = {
  enfant: { commun: 0.50, rare: 0.30, épique: 0.14, légendaire: 0.05, mythique: 0.01 },
  ado:    { commun: 0.52, rare: 0.29, épique: 0.13, légendaire: 0.05, mythique: 0.01 },
  adulte: { commun: 0.55, rare: 0.28, épique: 0.12, légendaire: 0.04, mythique: 0.01 },
};

// ─── Thresholds & Constants ───────────────────────────────────────────────────

export const LOOT_THRESHOLD: Record<Profile['role'], number> = {
  enfant: 50,
  ado: 75,
  adulte: 100,
};

export const POINTS_PER_TASK = 10;
export const STREAK_BONUS = 5;

/** Pity system: guaranteed épique+ after this many boxes without one */
export const PITY_THRESHOLD = 5;

// ─── Display ──────────────────────────────────────────────────────────────────

export const RARITY_COLORS: Record<LootRarity, string> = {
  commun: '#9CA3AF',
  rare: '#3B82F6',
  épique: '#8B5CF6',
  légendaire: '#F59E0B',
  mythique: '#EF4444',
};

export const RARITY_LABELS: Record<LootRarity, string> = {
  commun: 'Commun',
  rare: 'Rare',
  épique: 'Épique',
  légendaire: 'Légendaire',
  mythique: 'MYTHIQUE',
};

/** Retourne le label traduit d'une rareté (appeler au render, pas au module load) */
export function getRarityLabel(rarity: LootRarity): string {
  return t(`gamification:rarity.${rarity}`, { defaultValue: RARITY_LABELS[rarity] });
}

/** Retourne le texte traduit d'une récompense (appeler au render) */
export function getRewardText(rarity: LootRarity, index: number, fallback: string): string {
  return t(`gamification:rewards.${rarity}.${index + 1}`, { defaultValue: fallback });
}

export const RARITY_EMOJIS: Record<LootRarity, string> = {
  commun: '🩶',
  rare: '💙',
  épique: '💜',
  légendaire: '🧡',
  mythique: '❤️',
};
