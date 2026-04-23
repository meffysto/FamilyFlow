/**
 * engine.ts — Points, streaks, loot box logic, active rewards, pity system
 *
 * All state is read from / written to gamification.md in the vault.
 * No internal database.
 */

import { Profile, LootBox, LootRarity, GamificationEntry, GamificationData, ActiveReward, RewardDefinition } from '../types';
import {
  REWARDS,
  DROP_RATES,
  LOOT_THRESHOLD,
  POINTS_PER_TASK,
  STREAK_BONUS,
  PITY_THRESHOLD,
  getCachedGamiConfig,
} from './rewards';
import { trySeasonalDraw } from './seasonal';
import { format } from 'date-fns';

// ─── Streak progressif ──────────────────────────────────────────────────────

/** Paliers de streak avec bonus progressif */
export const STREAK_MILESTONES = [
  { days: 30, bonus: 25, emoji: '🔥💎', label: 'Flamme Légendaire' },
  { days: 14, bonus: 15, emoji: '🔥🔥', label: 'Flamme Intense' },
  { days: 7, bonus: 10, emoji: '🔥', label: 'Flamme Ardente' },
  { days: 2, bonus: 5, emoji: '✨', label: 'Série en cours' },
] as const;

/** Calcule le bonus de streak progressif (basé sur le palier atteint) */
export function calculateStreakBonus(streak: number, baseBonus: number): number {
  if (streak <= 1) return 0;
  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone.days) return milestone.bonus;
  }
  return baseBonus; // fallback
}

/** Retourne le palier de streak actuel (pour l'affichage) */
export function getStreakMilestone(streak: number): { emoji: string; label: string; bonus: number } | null {
  if (streak <= 1) return null;
  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone.days) return milestone;
  }
  return { emoji: '✨', label: 'Série en cours', bonus: 5 };
}

// ─── Points ─────────────────────────────────────────────────────────────────

/**
 * Add points to a profile (respects multiplier).
 * Returns updated profile + new history entry.
 */
export function addPoints(
  profile: Profile,
  basePoints: number,
  note: string,
  activeRewards?: ActiveReward[],
): { profile: Profile; entry: GamificationEntry; activeRewards?: ActiveReward[] } {
  const effectivePoints =
    profile.multiplierRemaining > 0
      ? Math.round(basePoints * profile.multiplier)
      : basePoints;

  const newMultiplierRemaining = Math.max(0, profile.multiplierRemaining - 1);
  const newPoints = profile.points + effectivePoints;
  const newCoins = (profile.coins ?? 0) + effectivePoints;
  const newLevel = calculateLevel(newPoints);

  const entry: GamificationEntry = {
    profileId: profile.id,
    action: `+${effectivePoints}`,
    points: effectivePoints,
    note,
    timestamp: new Date().toISOString(),
  };

  const updatedProfile: Profile = {
    ...profile,
    points: newPoints,
    coins: newCoins,
    level: newLevel,
    multiplierRemaining: newMultiplierRemaining,
    // Nettoyer le multiplier quand il expire
    ...(newMultiplierRemaining === 0 && profile.multiplierRemaining > 0 ? { multiplier: 1 } : {}),
  };

  // Synchroniser activeRewards.remainingTasks avec le profile
  const updatedRewards = activeRewards?.map(r => {
    if (r.type === 'multiplier' && r.profileId === profile.id && profile.multiplierRemaining > 0) {
      return { ...r, remainingTasks: newMultiplierRemaining };
    }
    return r;
  });

  return { profile: updatedProfile, entry, activeRewards: updatedRewards };
}

/**
 * Award task completion points (+10 base, +streak bonus if applicable).
 * Streak bonus progressif : +5 (2j), +10 (7j), +15 (14j), +25 (30j+)
 * Also checks if a loot box should be awarded.
 */
export function awardTaskCompletion(
  profile: Profile,
  taskNote: string,
  xpOverride?: number
): { profile: Profile; entry: GamificationEntry; lootAwarded: boolean } {
  const config = getCachedGamiConfig();
  const basePoints = xpOverride ?? config.pointsPerTask;
  // xpOverride=0 signifie tâche sans récompense — streak bonus ignoré
  const streakBonus = basePoints === 0 ? 0 : calculateStreakBonus(profile.streak, config.streakBonus);
  const total = basePoints + streakBonus;

  const { profile: updated, entry } = addPoints(profile, total, `Tâche: ${taskNote}`);

  // Check if loot box threshold crossed
  const threshold = config.lootThreshold[profile.role] ?? LOOT_THRESHOLD[profile.role];
  const previousBoxes = Math.floor(profile.points / threshold);
  const newBoxes = Math.floor(updated.points / threshold);
  const lootAwarded = newBoxes > previousBoxes;

  const finalProfile: Profile = {
    ...updated,
    lootBoxesAvailable: updated.lootBoxesAvailable + (lootAwarded ? newBoxes - previousBoxes : 0),
  };

  return { profile: finalProfile, entry, lootAwarded };
}

// ─── Pity System ─────────────────────────────────────────────────────────────

/** Draw rarity with pity system: after PITY_THRESHOLD boxes without épique+, guarantee épique minimum */
function drawRarityWithPity(role: Profile['role'], pityCounter: number): { rarity: LootRarity; newPityCounter: number } {
  const rates = DROP_RATES[role];
  const isPityTriggered = pityCounter >= PITY_THRESHOLD;

  let rarity: LootRarity;

  if (isPityTriggered) {
    // Guaranteed épique minimum — redistribute among épique/légendaire/mythique
    const epicTotal = rates.épique + rates.légendaire + rates.mythique;
    const rand = Math.random() * epicTotal;
    if (rand < rates.mythique) {
      rarity = 'mythique';
    } else if (rand < rates.mythique + rates.légendaire) {
      rarity = 'légendaire';
    } else {
      rarity = 'épique';
    }
  } else {
    const rand = Math.random();
    if (rand < rates.mythique) {
      rarity = 'mythique';
    } else if (rand < rates.mythique + rates.légendaire) {
      rarity = 'légendaire';
    } else if (rand < rates.mythique + rates.légendaire + rates.épique) {
      rarity = 'épique';
    } else if (rand < rates.mythique + rates.légendaire + rates.épique + rates.rare) {
      rarity = 'rare';
    } else {
      rarity = 'commun';
    }
  }

  // Reset pity on épique+ drop, increment otherwise
  const isHighRarity = rarity === 'épique' || rarity === 'légendaire' || rarity === 'mythique';
  const newPityCounter = isHighRarity ? 0 : pityCounter + 1;

  return { rarity, newPityCounter };
}

// ─── Loot box ───────────────────────────────────────────────────────────────

/** Draw a random loot box reward based on profile role, with pity system and active rewards */
export function openLootBox(
  profile: Profile,
  gamiData: GamificationData
): {
  box: LootBox;
  profile: Profile;
  entries: GamificationEntry[];
  newActiveRewards: ActiveReward[];
  extraLootBoxes: number; // for double_loot reward
} {
  if (profile.lootBoxesAvailable <= 0) {
    throw new Error('Aucune loot box disponible');
  }

  const { rarity, newPityCounter } = drawRarityWithPity(profile.role, profile.pityCounter);

  // Tenter un drop saisonnier (20% de chance si événement actif)
  const seasonalDraw = trySeasonalDraw(rarity);
  let rewardDef: RewardDefinition = seasonalDraw
    ? seasonalDraw.reward
    : REWARDS[rarity][Math.floor(Math.random() * REWARDS[rarity].length)];

  // Si c'est un item mascotte déjà possédé, re-draw un reward non-mascotte
  if (rewardDef.mascotItemId) {
    const owned = rewardDef.rewardType === 'mascot_deco'
      ? profile.mascotDecorations
      : profile.mascotInhabitants;
    if (owned.includes(rewardDef.mascotItemId)) {
      const nonMascot = REWARDS[rarity].filter((r) => !r.mascotItemId);
      rewardDef = nonMascot[Math.floor(Math.random() * nonMascot.length)];
    }
  }

  const seasonalEventId = seasonalDraw?.eventId;

  const now = new Date().toISOString();

  const box: LootBox = {
    rarity,
    reward: rewardDef.reward,
    emoji: rewardDef.emoji,
    bonusPoints: rewardDef.bonusPoints,
    requiresParent: rewardDef.requiresParent,
    multiplier: rewardDef.multiplier,
    multiplierTasks: rewardDef.multiplierTasks,
    rewardType: rewardDef.rewardType,
    openedAt: now,
    seasonal: seasonalEventId,
    mascotItemId: rewardDef.mascotItemId,
  };

  const seasonalTag = seasonalEventId ? ` [${seasonalEventId}]` : '';
  const entries: GamificationEntry[] = [
    {
      profileId: profile.id,
      action: `loot:${rarity}`,
      points: rewardDef.bonusPoints,
      note: `${rewardDef.emoji} ${rewardDef.reward}${seasonalTag}`,
      timestamp: now,
    },
  ];

  let updatedProfile: Profile = {
    ...profile,
    lootBoxesAvailable: profile.lootBoxesAvailable - 1,
    pityCounter: newPityCounter,
  };

  // Apply bonus points if any
  if (rewardDef.bonusPoints > 0) {
    const { profile: withBonus, entry: bonusEntry } = addPoints(
      updatedProfile,
      rewardDef.bonusPoints,
      `Bonus loot: ${rewardDef.reward}`
    );
    updatedProfile = withBonus;
    entries.push(bonusEntry);
  }

  // Apply multiplier if reward has one
  if (rewardDef.multiplier && rewardDef.multiplier > 1) {
    updatedProfile = {
      ...updatedProfile,
      multiplier: rewardDef.multiplier,
      multiplierRemaining: rewardDef.multiplierTasks ?? 10,
    };
  }

  // Build new active rewards
  const newActiveRewards: ActiveReward[] = [];
  let extraLootBoxes = 0;

  const rewardId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  switch (rewardDef.rewardType) {
    case 'vacation': {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2);
      newActiveRewards.push({
        id: rewardId,
        type: 'vacation',
        emoji: rewardDef.emoji,
        label: '2 jours sans tâches !',
        profileId: profile.id,
        expiresAt: format(expiresAt, 'yyyy-MM-dd'),
        remainingDays: 2,
      });
      break;
    }
    case 'crown': {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      newActiveRewards.push({
        id: rewardId,
        type: 'crown',
        emoji: rewardDef.emoji,
        label: 'Roi/Reine de la semaine',
        profileId: profile.id,
        expiresAt: format(expiresAt, 'yyyy-MM-dd'),
        remainingDays: 7,
      });
      break;
    }
    case 'skip': {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      newActiveRewards.push({
        id: rewardId,
        type: 'skip',
        emoji: rewardDef.emoji,
        label: 'Skip une tâche demain',
        profileId: profile.id,
        expiresAt: format(tomorrow, 'yyyy-MM-dd'),
        remainingDays: 1,
      });
      break;
    }
    case 'skip_all': {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      newActiveRewards.push({
        id: rewardId,
        type: 'skip_all',
        emoji: rewardDef.emoji,
        label: 'Skip TOUTES les tâches demain',
        profileId: profile.id,
        expiresAt: format(tomorrow, 'yyyy-MM-dd'),
        remainingDays: 1,
      });
      break;
    }
    case 'multiplier': {
      newActiveRewards.push({
        id: rewardId,
        type: 'multiplier',
        emoji: rewardDef.emoji,
        label: `Multiplicateur ×${rewardDef.multiplier}`,
        profileId: profile.id,
        remainingTasks: rewardDef.multiplierTasks ?? 10,
      });
      break;
    }
    case 'double_loot': {
      // Award 2 extra loot boxes
      extraLootBoxes = 2;
      updatedProfile = {
        ...updatedProfile,
        lootBoxesAvailable: updatedProfile.lootBoxesAvailable + 2,
      };
      break;
    }
    case 'family_bonus': {
      // family_bonus is handled at the caller level (useGamification)
      // We just mark it so the caller knows to apply it
      break;
    }
    case 'mascot_deco': {
      // Ajouter la décoration au profil si pas déjà possédée
      if (rewardDef.mascotItemId && !updatedProfile.mascotDecorations.includes(rewardDef.mascotItemId)) {
        updatedProfile = {
          ...updatedProfile,
          mascotDecorations: [...updatedProfile.mascotDecorations, rewardDef.mascotItemId],
        };
      }
      break;
    }
    case 'mascot_hab': {
      // Ajouter l'habitant au profil si pas déjà possédé
      if (rewardDef.mascotItemId && !updatedProfile.mascotInhabitants.includes(rewardDef.mascotItemId)) {
        updatedProfile = {
          ...updatedProfile,
          mascotInhabitants: [...updatedProfile.mascotInhabitants, rewardDef.mascotItemId],
        };
      }
      break;
    }
    case 'farm_seed': {
      // Ajouter la graine à l'inventaire de récoltes du profil (Phase B — grade 'ordinaire')
      const cropId = rewardDef.mascotItemId;
      if (cropId) {
        const currentHarvest = updatedProfile.harvestInventory ?? {};
        const existing = currentHarvest[cropId];
        let nextEntry: Partial<Record<'ordinaire' | 'beau' | 'superbe' | 'parfait', number>>;
        if (existing == null) {
          nextEntry = { ordinaire: 1 };
        } else if (typeof existing === 'number') {
          nextEntry = { ordinaire: existing + 1 };
        } else {
          nextEntry = { ...existing, ordinaire: (existing.ordinaire ?? 0) + 1 };
        }
        updatedProfile = {
          ...updatedProfile,
          harvestInventory: { ...currentHarvest, [cropId]: nextEntry },
        };
      }
      break;
    }
    // 'points', 'badge', 'reward' don't create active rewards
    default:
      break;
  }

  return { box, profile: updatedProfile, entries, newActiveRewards, extraLootBoxes };
}

// ─── Loot box Agent Secret (missions secrètes) ─────────────────────────────

/**
 * Ouvre une loot box spéciale Agent Secret.
 * - Rareté minimale : épique (jamais commun ni rare)
 * - Ne décrémente PAS lootBoxesAvailable (bonus gratuit)
 * - Utilise le pool de récompenses existant filtré épique+
 */
export function openAgentSecretLootBox(
  profile: Profile,
  gamiData: GamificationData
): {
  box: LootBox;
  profile: Profile;
  entries: GamificationEntry[];
  newActiveRewards: ActiveReward[];
  extraLootBoxes: number;
} {
  const rates = DROP_RATES[profile.role];

  // Redistribuer parmi épique/légendaire/mythique
  const epicTotal = rates.épique + rates.légendaire + rates.mythique;
  const rand = Math.random() * epicTotal;
  let rarity: LootRarity;
  if (rand < rates.mythique) {
    rarity = 'mythique';
  } else if (rand < rates.mythique + rates.légendaire) {
    rarity = 'légendaire';
  } else {
    rarity = 'épique';
  }

  const rewardDef: RewardDefinition = REWARDS[rarity][Math.floor(Math.random() * REWARDS[rarity].length)];
  const now = new Date().toISOString();

  const box: LootBox = {
    rarity,
    reward: rewardDef.reward,
    emoji: rewardDef.emoji,
    bonusPoints: rewardDef.bonusPoints,
    requiresParent: rewardDef.requiresParent,
    multiplier: rewardDef.multiplier,
    multiplierTasks: rewardDef.multiplierTasks,
    rewardType: rewardDef.rewardType,
    openedAt: now,
  };

  const entries: GamificationEntry[] = [
    {
      profileId: profile.id,
      action: `loot:agent-secret:${rarity}`,
      points: rewardDef.bonusPoints,
      note: `🕵️ Agent Secret: ${rewardDef.emoji} ${rewardDef.reward}`,
      timestamp: now,
    },
  ];

  // NE PAS décrémenter lootBoxesAvailable — c'est un bonus gratuit
  let updatedProfile: Profile = { ...profile };

  // Appliquer les points bonus
  if (rewardDef.bonusPoints > 0) {
    const { profile: withBonus, entry: bonusEntry } = addPoints(
      updatedProfile,
      rewardDef.bonusPoints,
      `Bonus Agent Secret: ${rewardDef.reward}`
    );
    updatedProfile = withBonus;
    entries.push(bonusEntry);
  }

  // Appliquer le multiplicateur si présent
  if (rewardDef.multiplier && rewardDef.multiplier > 1) {
    updatedProfile = {
      ...updatedProfile,
      multiplier: rewardDef.multiplier,
      multiplierRemaining: rewardDef.multiplierTasks ?? 10,
    };
  }

  // Gérer les récompenses actives (même logique que openLootBox)
  const newActiveRewards: ActiveReward[] = [];
  let extraLootBoxes = 0;
  const rewardId = `ar_agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  switch (rewardDef.rewardType) {
    case 'vacation': {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2);
      newActiveRewards.push({
        id: rewardId,
        type: 'vacation',
        emoji: rewardDef.emoji,
        label: '2 jours sans tâches !',
        profileId: profile.id,
        expiresAt: format(expiresAt, 'yyyy-MM-dd'),
        remainingDays: 2,
      });
      break;
    }
    case 'crown': {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      newActiveRewards.push({
        id: rewardId,
        type: 'crown',
        emoji: rewardDef.emoji,
        label: 'Roi/Reine de la semaine',
        profileId: profile.id,
        expiresAt: format(expiresAt, 'yyyy-MM-dd'),
        remainingDays: 7,
      });
      break;
    }
    case 'skip': {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      newActiveRewards.push({
        id: rewardId,
        type: 'skip',
        emoji: rewardDef.emoji,
        label: 'Skip une tâche demain',
        profileId: profile.id,
        expiresAt: format(tomorrow, 'yyyy-MM-dd'),
        remainingDays: 1,
      });
      break;
    }
    case 'skip_all': {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      newActiveRewards.push({
        id: rewardId,
        type: 'skip_all',
        emoji: rewardDef.emoji,
        label: 'Skip TOUTES les tâches demain',
        profileId: profile.id,
        expiresAt: format(tomorrow, 'yyyy-MM-dd'),
        remainingDays: 1,
      });
      break;
    }
    case 'multiplier': {
      newActiveRewards.push({
        id: rewardId,
        type: 'multiplier',
        emoji: rewardDef.emoji,
        label: `Multiplicateur ×${rewardDef.multiplier}`,
        profileId: profile.id,
        remainingTasks: rewardDef.multiplierTasks ?? 10,
      });
      break;
    }
    case 'double_loot': {
      extraLootBoxes = 2;
      updatedProfile = {
        ...updatedProfile,
        lootBoxesAvailable: updatedProfile.lootBoxesAvailable + 2,
      };
      break;
    }
    default:
      break;
  }

  return { box, profile: updatedProfile, entries, newActiveRewards, extraLootBoxes };
}

// ─── Active Rewards Processing ──────────────────────────────────────────────

/** Process active rewards: expire finished ones, return updated list */
export function processActiveRewards(activeRewards: ActiveReward[]): ActiveReward[] {
  const today = format(new Date(), 'yyyy-MM-dd');

  return activeRewards.filter((r) => {
    // Expire by date
    if (r.expiresAt && r.expiresAt < today) return false;
    // Expire multipliers with 0 remaining tasks
    if (r.type === 'multiplier' && r.remainingTasks !== undefined && r.remainingTasks <= 0) return false;
    return true;
  });
}

/** Apply family bonus: add points to all profiles in data */
export function applyFamilyBonus(
  data: GamificationData,
  bonusPoints: number,
  sourceProfileId: string
): { data: GamificationData; entries: GamificationEntry[] } {
  const now = new Date().toISOString();
  const entries: GamificationEntry[] = [];

  const updatedProfiles = data.profiles.map((p) => {
    // Skip the source profile (already got their bonus via the loot box)
    if (p.id === sourceProfileId) return p;

    const newPoints = p.points + bonusPoints;
    const entry: GamificationEntry = {
      profileId: p.id,
      action: `+${bonusPoints}`,
      points: bonusPoints,
      note: `🌈✨ Bonus familial de ${sourceProfileId}`,
      timestamp: now,
    };
    entries.push(entry);

    return {
      ...p,
      points: newPoints,
      level: calculateLevel(newPoints),
    };
  });

  return {
    data: { ...data, profiles: updatedProfiles, history: [...data.history, ...entries] },
    entries,
  };
}

// ─── Level calculation ───────────────────────────────────────────────────────

/**
 * Courbe de progression quadratique adoucie (inspirée Habitica/Pokémon GO).
 * XP cumulé pour atteindre le niveau n = 50n² + 50n
 * Formule inversée : level = floor((-50 + sqrt(2500 + 200 * points)) / 100)
 */
export const MAX_LEVEL = 50;

/** XP cumulé nécessaire pour atteindre un niveau donné */
export function xpForLevel(level: number): number {
  return 50 * level * level + 50 * level;
}

/** Calcule le niveau actuel à partir des points totaux */
export function calculateLevel(points: number): number {
  // Résolution quadratique : 50n² + 50n = points → n = (-50 + sqrt(2500 + 200*points)) / 100
  const level = Math.floor((-50 + Math.sqrt(2500 + 200 * points)) / 100);
  return Math.min(MAX_LEVEL, Math.max(1, level + 1));
}

/** Points needed for next level */
export function pointsToNextLevel(points: number): number {
  const level = calculateLevel(points);
  if (level >= MAX_LEVEL) return 0;
  return xpForLevel(level) - points;
}

/** Progress (0-1) toward next level */
export function levelProgress(points: number): number {
  const level = calculateLevel(points);
  if (level >= MAX_LEVEL) return 1;
  const levelStart = xpForLevel(level - 1);
  const levelEnd = xpForLevel(level);
  if (levelEnd === levelStart) return 1;
  return Math.min(1, Math.max(0, (points - levelStart) / (levelEnd - levelStart)));
}

// ─── Paliers de niveau (thème Explorateur) ──────────────────────────────────

export interface LevelTier {
  name: string;
  emoji: string;
  minLevel: number;
  maxLevel: number;
  color: string;
}

export const LEVEL_TIERS: LevelTier[] = [
  { name: 'Curieux',            emoji: '🔍', minLevel: 1,  maxLevel: 3,  color: '#4ADE80' },  // vert tendre
  { name: 'Aventurier',         emoji: '🧭', minLevel: 4,  maxLevel: 7,  color: '#38BDF8' },  // bleu ciel
  { name: 'Explorateur',        emoji: '🗺️', minLevel: 8,  maxLevel: 12, color: '#2563EB' },  // bleu profond
  { name: 'Découvreur',         emoji: '🔭', minLevel: 13, maxLevel: 18, color: '#8B5CF6' },  // violet
  { name: 'Navigateur',         emoji: '⛵', minLevel: 19, maxLevel: 25, color: '#F97316' },  // orange
  { name: 'Capitaine',          emoji: '⚓', minLevel: 26, maxLevel: 32, color: '#EF4444' },  // rouge
  { name: 'Maître du Voyage',   emoji: '⭐', minLevel: 33, maxLevel: 40, color: '#EAB308' },  // or
  { name: 'Légende Familiale',  emoji: '👑', minLevel: 41, maxLevel: 47, color: '#94A3B8' },  // platine
  { name: 'Gardien du Vault',   emoji: '🏆', minLevel: 48, maxLevel: 50, color: '#E879F9' },  // prismatique
];

/** Retourne le palier (tier) correspondant au niveau donné */
export function getLevelTier(level: number): LevelTier {
  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (level >= LEVEL_TIERS[i].minLevel) return LEVEL_TIERS[i];
  }
  return LEVEL_TIERS[0];
}

/** Progress (0-1) toward next loot box for a given profile */
export function lootProgress(profile: Profile): { progress: number; current: number; threshold: number } {
  const config = getCachedGamiConfig();
  const threshold = config.lootThreshold[profile.role] ?? LOOT_THRESHOLD[profile.role];
  const current = profile.points % threshold;
  return { progress: current / threshold, current, threshold };
}

// ─── Streak ─────────────────────────────────────────────────────────────────

/** Calculate streak from history (consecutive days with completed tasks) */
export function calculateStreak(history: GamificationEntry[], profileId: string): number {
  const taskDays = new Set<string>();
  for (const entry of history) {
    if (entry.profileId === profileId && entry.action.startsWith('+') && entry.note.startsWith('Tâche:')) {
      taskDays.add(entry.timestamp.slice(0, 10));
    }
  }

  if (taskDays.size === 0) return 0;

  const today = format(new Date(), 'yyyy-MM-dd');
  let streak = 0;
  let checkDate = today;

  while (taskDays.has(checkDate)) {
    streak++;
    const d = new Date(checkDate);
    d.setDate(d.getDate() - 1);
    checkDate = format(d, 'yyyy-MM-dd');
  }

  return streak;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/** Sort profiles by points descending */
export function buildLeaderboard(profiles: Profile[]): Profile[] {
  return [...profiles].sort((a, b) => b.points - a.points);
}

// ─── Data updates ────────────────────────────────────────────────────────────

/** Update a profile in the GamificationData, return new data */
export function updateProfileInData(
  data: GamificationData,
  updatedProfile: Profile,
  newEntries: GamificationEntry[]
): GamificationData {
  return {
    profiles: data.profiles.map((p) =>
      p.id === updatedProfile.id ? updatedProfile : p
    ),
    history: [...data.history, ...newEntries],
    activeRewards: data.activeRewards ?? [],
    usedLoots: data.usedLoots ?? [],
  };
}
