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

// ─── Points ─────────────────────────────────────────────────────────────────

/**
 * Add points to a profile (respects multiplier).
 * Returns updated profile + new history entry.
 */
export function addPoints(
  profile: Profile,
  basePoints: number,
  note: string
): { profile: Profile; entry: GamificationEntry } {
  const effectivePoints =
    profile.multiplierRemaining > 0
      ? Math.round(basePoints * profile.multiplier)
      : basePoints;

  const newMultiplierRemaining = Math.max(0, profile.multiplierRemaining - 1);
  const newPoints = profile.points + effectivePoints;
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
    level: newLevel,
    multiplierRemaining: newMultiplierRemaining,
  };

  return { profile: updatedProfile, entry };
}

/**
 * Award task completion points (+10 base, +streak bonus if applicable).
 * Also checks if a loot box should be awarded.
 */
export function awardTaskCompletion(
  profile: Profile,
  taskNote: string
): { profile: Profile; entry: GamificationEntry; lootAwarded: boolean } {
  const config = getCachedGamiConfig();
  const basePoints = config.pointsPerTask;
  const streakBonus = profile.streak > 1 ? config.streakBonus : 0;
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
  const rewardDef: RewardDefinition = seasonalDraw
    ? seasonalDraw.reward
    : REWARDS[rarity][Math.floor(Math.random() * REWARDS[rarity].length)];
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
    // 'points', 'badge', 'reward' don't create active rewards
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

/** Level thresholds: level = floor(points / 100) + 1, max level 50 */
export function calculateLevel(points: number): number {
  return Math.min(50, Math.floor(points / 100) + 1);
}

/** Points needed for next level */
export function pointsToNextLevel(points: number): number {
  const nextLevel = calculateLevel(points) + 1;
  return nextLevel * 100 - points;
}

/** Progress (0-1) toward next level */
export function levelProgress(points: number): number {
  const level = calculateLevel(points);
  const levelStart = (level - 1) * 100;
  const levelEnd = level * 100;
  return (points - levelStart) / (levelEnd - levelStart);
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
  };
}
