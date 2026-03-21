/**
 * gamification/ — Barrel export pour tout le domaine gamification
 */

// Moteur (points, loot, streaks, leaderboard)
export {
  addPoints,
  awardTaskCompletion,
  openLootBox,
  processActiveRewards,
  applyFamilyBonus,
  calculateLevel,
  pointsToNextLevel,
  levelProgress,
  lootProgress,
  xpForLevel,
  MAX_LEVEL,
  LEVEL_TIERS,
  getLevelTier,
  calculateStreak,
  calculateStreakBonus,
  getStreakMilestone,
  STREAK_MILESTONES,
  buildLeaderboard,
  updateProfileInData,
  openAgentSecretLootBox,
} from './engine';
export type { LevelTier } from './engine';

// Rewards pool, config, display
export {
  GAMI_CONFIG_KEY,
  DEFAULT_GAMI_CONFIG,
  loadGamiConfig,
  saveGamiConfig,
  getCachedGamiConfig,
  REWARDS,
  DROP_RATES,
  LOOT_THRESHOLD,
  POINTS_PER_TASK,
  STREAK_BONUS,
  PITY_THRESHOLD,
  RARITY_COLORS,
  RARITY_LABELS,
  RARITY_EMOJIS,
} from './rewards';
export type { GamificationConfig } from './rewards';

// Événements saisonniers
export { SEASONAL_DROP_CHANCE, SEASONAL_EVENTS } from './seasonal-rewards';
export {
  getEasterDate,
  getActiveEvent,
  isSeasonalActive,
  seasonalDaysRemaining,
  getNextEvent,
  trySeasonalDraw,
} from './seasonal';
