/**
 * quest-engine.ts — Types, serialisation et moteur des quêtes coopératives familiales
 *
 * Fournit :
 * - Types FamilyQuestType, FamilyFarmReward, FamilyQuest, FamilyQuestTemplate
 * - serializeReward / parseReward — format compact "type:param"
 * - applyQuestReward — applique la récompense ferme à tous les profils
 * - createQuestFromTemplate — crée une quête depuis un template
 */

import type { VaultManager } from './vault';
import { parseGamification, serializeGamification, parseFarmProfile, serializeFarmProfile } from './parser';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  completedDate?: string; // YYYY-MM-DD
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

// ─── Serialisation récompense ─────────────────────────────────────────────────

/**
 * Sérialise une FamilyFarmReward en format compact "type:param"
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
      // Fallback safe
      return { type: 'loot_legendary', count: 1 };
  }
}

// ─── Application récompense ───────────────────────────────────────────────────

/** Chemin du fichier gamification per-profil */
function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}

/** Chemin du fichier ferme per-profil */
function farmFile(profileId: string): string {
  return `farm-${profileId}.md`;
}

/**
 * Applique la récompense ferme à tous les profils (pattern reward-first).
 *
 * @param vault VaultManager pour lire/écrire les fichiers
 * @param profileIds IDs des profils qui reçoivent la récompense
 * @param reward Récompense à appliquer
 * @param questsFilePath Chemin du fichier family-quests.md (pour les effets actifs/trophées)
 */
export async function applyQuestReward(
  vault: VaultManager,
  profileIds: string[],
  reward: FamilyFarmReward,
  questsFilePath: string = 'family-quests.md',
): Promise<void> {
  switch (reward.type) {
    case 'loot_legendary': {
      // Pour chaque profil, incrémenter lootBoxesAvailable dans gami-{id}.md
      for (const pid of profileIds) {
        try {
          const file = gamiFile(pid);
          const content = await vault.readFile(file).catch(() => '');
          const gami = parseGamification(content);
          const profile = gami.profiles[0];
          if (profile) {
            profile.lootBoxesAvailable = (profile.lootBoxesAvailable ?? 0) + reward.count;
            await vault.writeFile(file, serializeGamification(gami));
          }
        } catch { /* Quest — non-critical */ }
      }
      break;
    }

    case 'rare_seeds': {
      // Pour chaque profil, ajouter au farmRareSeeds dans farm-{id}.md
      for (const pid of profileIds) {
        try {
          const file = farmFile(pid);
          const content = await vault.readFile(file).catch(() => '');
          const farm = parseFarmProfile(content);
          const currentRareSeeds = farm.farmRareSeeds ?? {};
          // Ajouter les graines rares comme "rare_quest_seed"
          const seedKey = 'rare_quest_seed';
          const updated = { ...currentRareSeeds, [seedKey]: (currentRareSeeds[seedKey] ?? 0) + reward.count };
          farm.farmRareSeeds = updated;
          // Trouver le nom du profil (utiliser pid comme fallback)
          await vault.writeFile(file, serializeFarmProfile(pid, farm));
        } catch { /* Quest — non-critical */ }
      }
      break;
    }

    case 'rain_bonus':
    case 'golden_rain':
    case 'production_boost': {
      // Écrire un champ activeEffect dans family-quests.md
      try {
        const content = await vault.readFile(questsFilePath).catch(() => '');
        const expiresAt = new Date(Date.now() + reward.durationHours * 60 * 60 * 1000).toISOString();
        const effectLine = `activeEffect: ${reward.type}:${expiresAt}`;
        // Remplacer ou ajouter la ligne activeEffect
        if (content.includes('activeEffect:')) {
          const updated = content.replace(/^activeEffect:.*$/m, effectLine);
          await vault.writeFile(questsFilePath, updated);
        } else {
          // Ajouter après le H1
          const updated = content.replace(/^(# .+)$/m, `$1\n${effectLine}`);
          await vault.writeFile(questsFilePath, updated);
        }
      } catch { /* Quest — non-critical */ }
      break;
    }

    case 'building': {
      // Pour chaque profil, ajouter offeredBuilding dans farm-{id}.md
      for (const pid of profileIds) {
        try {
          const file = farmFile(pid);
          const content = await vault.readFile(file).catch(() => '');
          const farm = parseFarmProfile(content);
          // Stocker dans un champ texte (parse/serialize géré via writeFile direct)
          const offeredLine = `offeredBuilding: ${reward.buildingId}`;
          if (!content.includes('offeredBuilding:')) {
            await vault.writeFile(file, content.trim() + `\n${offeredLine}\n`);
          }
        } catch { /* Quest — non-critical */ }
      }
      break;
    }

    case 'tech_unlock': {
      // Pour chaque profil, ajouter nodeId à farm_tech dans farm-{id}.md
      for (const pid of profileIds) {
        try {
          const file = farmFile(pid);
          const content = await vault.readFile(file).catch(() => '');
          const farm = parseFarmProfile(content);
          const currentTech = farm.farmTech ?? [];
          if (!currentTech.includes(reward.nodeId)) {
            farm.farmTech = [...currentTech, reward.nodeId];
            await vault.writeFile(file, serializeFarmProfile(pid, farm));
          }
        } catch { /* Quest — non-critical */ }
      }
      break;
    }

    case 'unlock_plot': {
      // Pour chaque profil, ajouter 'unlock_extra_plot' à farm_tech dans farm-{id}.md
      for (const pid of profileIds) {
        try {
          const file = farmFile(pid);
          const content = await vault.readFile(file).catch(() => '');
          const farm = parseFarmProfile(content);
          const currentTech = farm.farmTech ?? [];
          const UNLOCK_PLOT_NODE = 'unlock_extra_plot';
          if (!currentTech.includes(UNLOCK_PLOT_NODE)) {
            farm.farmTech = [...currentTech, UNLOCK_PLOT_NODE];
            await vault.writeFile(file, serializeFarmProfile(pid, farm));
          }
        } catch { /* Quest — non-critical */ }
      }
      break;
    }

    case 'family_trophy': {
      // Ajouter trophyId dans le fichier family-quests.md
      try {
        const content = await vault.readFile(questsFilePath).catch(() => '');
        const trophyLine = `trophies: ${reward.trophyId}`;
        if (content.includes('trophies:')) {
          // Ajouter au CSV existant
          const updated = content.replace(/^(trophies:.*)$/m, (_match, existing) => {
            const existingTrophies = existing.replace('trophies: ', '').split(',').map((s: string) => s.trim()).filter(Boolean);
            if (!existingTrophies.includes(reward.trophyId)) {
              existingTrophies.push(reward.trophyId);
            }
            return `trophies: ${existingTrophies.join(', ')}`;
          });
          await vault.writeFile(questsFilePath, updated);
        } else {
          const updated = content.replace(/^(# .+)$/m, `$1\n${trophyLine}`);
          await vault.writeFile(questsFilePath, updated);
        }
      } catch { /* Quest — non-critical */ }
      break;
    }

    case 'crafting_recipe': {
      // Stocker dans unlockedRecipes dans family-quests.md
      try {
        const content = await vault.readFile(questsFilePath).catch(() => '');
        if (content.includes('unlockedRecipes:')) {
          const updated = content.replace(/^(unlockedRecipes:.*)$/m, (_match, existing) => {
            const existingRecipes = existing.replace('unlockedRecipes: ', '').split(',').map((s: string) => s.trim()).filter(Boolean);
            if (!existingRecipes.includes(reward.recipeId)) {
              existingRecipes.push(reward.recipeId);
            }
            return `unlockedRecipes: ${existingRecipes.join(', ')}`;
          });
          await vault.writeFile(questsFilePath, updated);
        } else {
          const updated = content.replace(/^(# .+)$/m, `$1\nunlockedRecipes: ${reward.recipeId}`);
          await vault.writeFile(questsFilePath, updated);
        }
      } catch { /* Quest — non-critical */ }
      break;
    }

    case 'seasonal_decoration': {
      // Stocker dans unlockedDecorations dans family-quests.md
      try {
        const content = await vault.readFile(questsFilePath).catch(() => '');
        if (content.includes('unlockedDecorations:')) {
          const updated = content.replace(/^(unlockedDecorations:.*)$/m, (_match, existing) => {
            const existingDecos = existing.replace('unlockedDecorations: ', '').split(',').map((s: string) => s.trim()).filter(Boolean);
            if (!existingDecos.includes(reward.decorationId)) {
              existingDecos.push(reward.decorationId);
            }
            return `unlockedDecorations: ${existingDecos.join(', ')}`;
          });
          await vault.writeFile(questsFilePath, updated);
        } else {
          const updated = content.replace(/^(# .+)$/m, `$1\nunlockedDecorations: ${reward.decorationId}`);
          await vault.writeFile(questsFilePath, updated);
        }
      } catch { /* Quest — non-critical */ }
      break;
    }
  }
}

// ─── Création depuis template ─────────────────────────────────────────────────

/**
 * Crée une FamilyQuest depuis un template.
 * Génère un id unique, startDate = aujourd'hui, endDate = aujourd'hui + durationDays.
 */
export function createQuestFromTemplate(template: FamilyQuestTemplate): FamilyQuest {
  const id = `quest_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDateObj = new Date(today);
  endDateObj.setDate(endDateObj.getDate() + template.durationDays);
  const endDate = endDateObj.toISOString().slice(0, 10);

  return {
    id,
    title: template.title,
    description: template.description,
    emoji: template.emoji,
    type: template.type,
    target: template.target,
    current: 0,
    contributions: {},
    farmReward: template.reward,
    status: 'active',
    startDate,
    endDate,
  };
}
