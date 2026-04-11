/**
 * quest-types.ts — Types et sérialisation des récompenses de quêtes familiales.
 *
 * Fichier sans dépendances circulaires : importé par parser.ts ET quest-engine.ts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FamilyQuestType =
  | 'tasks'
  | 'defis'
  | 'checkins'
  | 'harvest'
  | 'craft'
  | 'production'
  | 'plant'
  | 'composite';

export type FamilyFarmReward =
  | { type: 'unlock_plot' }
  | { type: 'rare_seeds'; count: number }
  | { type: 'building'; buildingId: string }
  | { type: 'rain_bonus'; durationHours: number }
  | { type: 'golden_rain'; durationHours: number }
  | { type: 'production_boost'; durationHours: number }
  | { type: 'loot_legendary'; count: number }
  | { type: 'crafting_recipe'; recipeId: string }
  | { type: 'tech_unlock'; nodeId: string }
  | { type: 'family_trophy'; trophyId: string }
  | { type: 'seasonal_decoration'; decorationId: string };

export interface FamilyQuest {
  id: string;
  title: string;
  description: string;
  emoji: string;
  type: FamilyQuestType;
  target: number;
  current: number;
  contributions: Record<string, number>;
  farmReward: FamilyFarmReward;
  status: 'active' | 'completed' | 'expired';
  startDate: string;
  endDate: string;
  completedDate?: string;
}

export interface FamilyQuestTemplate {
  id: string;
  title: string;
  emoji: string;
  type: FamilyQuestType;
  target: number;
  durationDays: number;
  reward: FamilyFarmReward;
  description: string;
}

// ─── Sérialisation récompense ─────────────────────────────────────────────────

/**
 * Sérialise une FamilyFarmReward en format compact "type:param".
 * Exemples : "loot_legendary:2", "unlock_plot", "rain_bonus:24"
 */
export function serializeReward(r: FamilyFarmReward): string {
  switch (r.type) {
    case 'unlock_plot':
      return 'unlock_plot';
    case 'rare_seeds':
      return `rare_seeds:${r.count}`;
    case 'building':
      return `building:${r.buildingId}`;
    case 'rain_bonus':
      return `rain_bonus:${r.durationHours}`;
    case 'golden_rain':
      return `golden_rain:${r.durationHours}`;
    case 'production_boost':
      return `production_boost:${r.durationHours}`;
    case 'loot_legendary':
      return `loot_legendary:${r.count}`;
    case 'crafting_recipe':
      return `crafting_recipe:${r.recipeId}`;
    case 'tech_unlock':
      return `tech_unlock:${r.nodeId}`;
    case 'family_trophy':
      return `family_trophy:${r.trophyId}`;
    case 'seasonal_decoration':
      return `seasonal_decoration:${r.decorationId}`;
  }
}

/**
 * Parse un format compact "type:param" en FamilyFarmReward.
 * Inverse de serializeReward.
 */
export function parseReward(s: string): FamilyFarmReward {
  const colonIdx = s.indexOf(':');
  const type = colonIdx === -1 ? s : s.slice(0, colonIdx);
  const param = colonIdx === -1 ? '' : s.slice(colonIdx + 1);

  switch (type) {
    case 'unlock_plot':
      return { type: 'unlock_plot' };
    case 'rare_seeds':
      return { type: 'rare_seeds', count: parseInt(param, 10) || 1 };
    case 'building':
      return { type: 'building', buildingId: param };
    case 'rain_bonus':
      return { type: 'rain_bonus', durationHours: parseInt(param, 10) || 24 };
    case 'golden_rain':
      return { type: 'golden_rain', durationHours: parseInt(param, 10) || 48 };
    case 'production_boost':
      return { type: 'production_boost', durationHours: parseInt(param, 10) || 48 };
    case 'loot_legendary':
      return { type: 'loot_legendary', count: parseInt(param, 10) || 1 };
    case 'crafting_recipe':
      return { type: 'crafting_recipe', recipeId: param };
    case 'tech_unlock':
      return { type: 'tech_unlock', nodeId: param };
    case 'family_trophy':
      return { type: 'family_trophy', trophyId: param };
    case 'seasonal_decoration':
      return { type: 'seasonal_decoration', decorationId: param };
    default:
      return { type: 'loot_legendary', count: 1 };
  }
}
