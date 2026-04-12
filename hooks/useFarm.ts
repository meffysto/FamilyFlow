/**
 * useFarm.ts — Hook pour la gestion de la ferme (planter, recolter, crafter, vendre)
 *
 * Lit/ecrit farm_crops, farm_harvest_inventory, farm_crafted_items dans famille.md
 * et deduit/ajoute les feuilles dans gamification.md.
 */

import { useCallback, useMemo } from 'react';
import { useVault } from '../contexts/VaultContext';
import type { ContributionType } from '../lib/village';
import { plantCrop, harvestCrop, parseCrops, serializeCrops, getEffectiveHarvestReward, rollHarvestEvent, rollSeedDrop, getUnlockedPlotCount, type HarvestEvent, type RareSeedDrop } from '../lib/mascot/farm-engine';
import { CROP_CATALOG, BUILDING_CATALOG } from '../lib/mascot/types';
import type { PlacedBuilding, FarmInventory, CraftedItem } from '../lib/mascot/types';
import { isLargeCropPlot } from '../lib/mascot/world-grid';
import { getTreeStageInfo } from '../lib/mascot/engine';
import {
  constructBuilding,
  upgradeBuilding,
  collectBuilding,
  serializeBuildings,
  parseBuildings,
  serializeInventory,
  parseInventory,
  getPendingResources,
  MAX_PENDING,
} from '../lib/mascot/building-engine';
import {
  CRAFT_RECIPES,
  craftItem as craftItemFn,
  sellCraftedItem as sellCraftedItemFn,
  sellRawHarvest as sellRawHarvestFn,
  serializeHarvestInventory,
  parseHarvestInventory,
  serializeCraftedItems,
  parseCraftedItems,
  serializeRareSeeds,
  parseRareSeeds,
} from '../lib/mascot/craft-engine';
import {
  TECH_TREE,
  unlockTechNode,
  canUnlockTech,
  serializeTechs,
  getTechBonuses,
} from '../lib/mascot/tech-engine';
import {
  checkWearEvents,
  repairWearEvent,
  getActiveWearEffects,
  serializeWearEvents,
  parseWearEvents,
  cleanupOldEvents,
  type WearEvent,
  type WearEffects,
} from '../lib/mascot/wear-engine';
import { parseGamification, serializeGamification, parseFarmProfile, serializeFarmProfile, parseCompanion, parseFamilyQuestsMeta, getActiveQuestEffect, FAMILY_QUESTS_FILE } from '../lib/parser';
import { EFFECT_GOLDEN_MULTIPLIER } from '../lib/semantic';
import type { FarmProfileData } from '../lib/types';
import {
  parsePendingGifts,
  serializePendingGifts,
  canSendGiftToday,
  incrementGiftsSent,
  removeFromInventory,
  addGiftToInventory,
  buildGiftHistoryEntry,
  type GiftEntry,
} from '../lib/mascot/gift-engine';

/** Helper : retourne le chemin du fichier gamification per-profil */
function gamiFile(profileId: string): string {
  return `gami-${profileId}.md`;
}

/** Helper : retourne le chemin du fichier ferme per-profil */
function farmFile(profileId: string): string {
  return `farm-${profileId}.md`;
}

/** Applique une valeur de champ sur un objet FarmProfileData (mapper fieldKey → propriété) */
function applyFarmField(data: FarmProfileData, fieldKey: string, value: string): void {
  switch (fieldKey) {
    case 'tree_species':
      data.treeSpecies = value as any;
      break;
    case 'mascot_decorations':
      data.mascotDecorations = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
      break;
    case 'mascot_inhabitants':
      data.mascotInhabitants = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
      break;
    case 'mascot_placements': {
      const placements: Record<string, string> = {};
      if (value) {
        value.split(',').forEach(pair => {
          const [slotId, itemId] = pair.split(':').map(s => s.trim());
          if (slotId && itemId) placements[slotId] = itemId;
        });
      }
      data.mascotPlacements = placements;
      break;
    }
    case 'farm_crops':
      data.farmCrops = value;
      break;
    case 'farm_buildings':
      data.farmBuildings = parseBuildings(value);
      break;
    case 'farm_inventory':
      data.farmInventory = parseInventory(value);
      break;
    case 'farm_harvest_inventory':
      data.harvestInventory = parseHarvestInventory(value);
      break;
    case 'farm_crafted_items':
      data.craftedItems = parseCraftedItems(value);
      break;
    case 'farm_tech':
      data.farmTech = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
      break;
    case 'farm_rare_seeds':
      data.farmRareSeeds = parseRareSeeds(value);
      break;
    case 'wear_events':
      data.wearEvents = parseWearEvents(value);
      break;
    case 'companion':
      data.companion = parseCompanion(value);
      break;
    case 'gift_history':
      data.giftHistory = value;
      break;
    case 'gifts_sent_today':
      data.giftsSentToday = value;
      break;
  }
}

export function useFarm(
  onQuestProgress?: (profileId: string, type: string, amount: number) => Promise<void>,
  onContribution?: (type: ContributionType, profileId: string) => Promise<void>,
) {
  const { vault, profiles, refreshFarm, refreshGamification } = useVault();

  /** Deduire des feuilles dans gami-{profileId}.md */
  const deductCoins = useCallback(async (profileId: string, amount: number, note: string) => {
    if (!vault || amount <= 0) return;
    const file = gamiFile(profileId);
    const gamiContent = await vault.readFile(file).catch(() => '');
    const gami = parseGamification(gamiContent);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) - amount;
    const newEntry = {
      profileId,
      action: `-${amount}`,
      points: -amount,
      note,
      timestamp: new Date().toISOString(),
    };
    const singleData = {
      profiles: [gamiProfile],
      history: [...gami.history.filter((e: any) => e.profileId === profileId), newEntry],
      activeRewards: (gami.activeRewards ?? []).filter((r: any) => r.profileId === profileId),
      usedLoots: (gami.usedLoots ?? []).filter((u: any) => u.profileId === profileId),
    };

    await vault.writeFile(file, serializeGamification(singleData));
  }, [vault]);

  /** Ajouter des feuilles dans gami-{profileId}.md */
  const addCoins = useCallback(async (profileId: string, amount: number, note: string) => {
    if (!vault || amount <= 0) return;
    const file = gamiFile(profileId);
    const gamiContent = await vault.readFile(file).catch(() => '');
    const gami = parseGamification(gamiContent);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) + amount;
    const newEntry = {
      profileId,
      action: `+${amount}`,
      points: amount,
      note,
      timestamp: new Date().toISOString(),
    };
    const singleData = {
      profiles: [gamiProfile],
      history: [...gami.history.filter((e: any) => e.profileId === profileId), newEntry],
      activeRewards: (gami.activeRewards ?? []).filter((r: any) => r.profileId === profileId),
      usedLoots: (gami.usedLoots ?? []).filter((u: any) => u.profileId === profileId),
    };

    await vault.writeFile(file, serializeGamification(singleData));
  }, [vault]);

  const writeProfileField = useCallback(async (profileId: string, fieldKey: string, value: string) => {
    if (!vault) return;
    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const farmData = parseFarmProfile(content);
    applyFarmField(farmData, fieldKey, value);
    const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
    await vault.writeFile(file, serializeFarmProfile(profileName, farmData));
  }, [vault, profiles]);

  const writeProfileFields = useCallback(async (profileId: string, fields: Record<string, string>) => {
    if (!vault) return;
    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const farmData = parseFarmProfile(content);
    for (const [fieldKey, value] of Object.entries(fields)) {
      applyFarmField(farmData, fieldKey, value);
    }
    const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
    await vault.writeFile(file, serializeFarmProfile(profileName, farmData));
  }, [vault, profiles]);

  /** Planter une culture sur une parcelle */
  const plant = useCallback(async (profileId: string, plotIndex: number, cropId: string) => {
    if (!vault) return;
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return;

    const cropDef = CROP_CATALOG.find(c => c.id === cropId);
    if (!cropDef) return;

    const isRareSeed = cropDef.dropOnly === true;

    if (isRareSeed) {
      // Verifier le stock de graines rares
      const rareSeeds = profile.farmRareSeeds ?? {};
      if ((rareSeeds[cropId] ?? 0) <= 0) throw new Error('Pas de graine rare disponible');
    } else {
      // Verifier les feuilles
      const coins = profile.coins ?? 0;
      if (coins < cropDef.cost) throw new Error('Pas assez de feuilles');
    }


    const content = await vault.readFile(farmFile(profileId)).catch(() => '');
    const freshFarm = parseFarmProfile(content);

    // Vérifier blocage usure (clôture cassée)
    const freshWearEffects = getActiveWearEffects(freshFarm.wearEvents ?? []);
    if (freshWearEffects.blockedPlots.includes(plotIndex)) {
      throw new Error('Cette parcelle est bloquée par une clôture cassée');
    }

    const currentCrops = parseCrops(freshFarm.farmCrops ?? '');
    const newCrops = plantCrop(currentCrops, plotIndex, cropId);
    if (newCrops.length === currentCrops.length) return;

    if (isRareSeed) {
      // Consommer la graine rare du stock
      const currentRareSeeds = freshFarm.farmRareSeeds ?? {};
      const updatedRareSeeds = { ...currentRareSeeds };
      updatedRareSeeds[cropId] = (updatedRareSeeds[cropId] ?? 0) - 1;
      await writeProfileFields(profileId, {
        farm_crops: serializeCrops(newCrops),
        farm_rare_seeds: serializeRareSeeds(updatedRareSeeds),
      });
    } else {
      await writeProfileField(profileId, 'farm_crops', serializeCrops(newCrops));
      await deductCoins(profileId, cropDef.cost, `🌱 Graine : ${cropId}`);
    }
    await refreshFarm(profileId);
    await refreshGamification();

    // Progression quêtes coopératives (plant)
    if (onQuestProgress) {
      try { await onQuestProgress(profileId, 'plant', 1); } catch { /* Quest — non-critical */ }
    }
  }, [vault, profiles, writeProfileField, writeProfileFields, deductCoins, refreshFarm, refreshGamification, onQuestProgress]);

  /** Recolter une culture mature — stocke en inventaire au lieu de donner des feuilles */
  const harvest = useCallback(async (profileId: string, plotIndex: number): Promise<{ cropId: string; isGolden: boolean; harvestEvent: HarvestEvent | null; seedDrop: RareSeedDrop | null } | null> => {
    if (!vault) return null;


    const content = await vault.readFile(farmFile(profileId)).catch(() => '');
    const profile = parseFarmProfile(content);

    const currentCrops = parseCrops(profile.farmCrops ?? '');
    const result = harvestCrop(currentCrops, plotIndex);
    if (!result.harvestedCropId) return null;

    // Ajouter la recolte a l'inventaire
    const currentHarvestInv = profile.harvestInventory ?? {};
    const updatedHarvestInv = { ...currentHarvestInv };
    // Parcelle geante (c20) = double recolte
    const profileTech = getTechBonuses(profile.farmTech ?? []);
    const vaultProfile = profiles.find(p => p.id === profileId);
    const treeStage = getTreeStageInfo(vaultProfile?.level ?? 1).stage;
    const isLarge = isLargeCropPlot(plotIndex, treeStage, profileTech);
    const baseQty = isLarge ? 2 : 1;
    const bonusDrop = profileTech.bonusHarvestChance > 0 && Math.random() < profileTech.bonusHarvestChance ? 1 : 0;
    const harvestQty = baseQty + bonusDrop;
    const harvestEvent = rollHarvestEvent();
    let finalQty = harvestEvent ? Math.max(0, Math.round(harvestQty * harvestEvent.modifier)) : harvestQty;
    // Phase 20 : Golden Harvest (EFFECTS-09) — quantite x3 si flag actif
    const wasGoldenEffect = profile.nextHarvestGolden === true;
    if (wasGoldenEffect) {
      finalQty = Math.round(finalQty * EFFECT_GOLDEN_MULTIPLIER);
      profile.nextHarvestGolden = false; // reset flag — persiste via serializeFarmProfile ci-dessous
    }
    updatedHarvestInv[result.harvestedCropId] = (updatedHarvestInv[result.harvestedCropId] ?? 0) + finalQty;

    // Tenter un drop de graine rare
    const seedDrop = rollSeedDrop(result.harvestedCropId);

    if (wasGoldenEffect) {
      // Ecrire farm en une seule operation (crops + harvest inv + reset golden flag)
      const updatedProfile = {
        ...profile,
        farmCrops: serializeCrops(result.crops),
        harvestInventory: updatedHarvestInv,
        ...(seedDrop ? { farmRareSeeds: { ...(profile.farmRareSeeds ?? {}), [seedDrop.seedId]: ((profile.farmRareSeeds ?? {})[seedDrop.seedId] ?? 0) + 1 } } : {}),
      };
      const profileName = profiles.find(p => p.id === profileId)?.name ?? profileId;
      await vault.writeFile(farmFile(profileId), serializeFarmProfile(profileName, updatedProfile));
      await refreshFarm(profileId);
      if (onQuestProgress) {
        try { await onQuestProgress(profileId, 'harvest', 1); } catch { /* Quest — non-critical */ }
      }
      // Contribution village (COOP-01) -- désactivé temporairement (seules les tâches comptent)
      // if (onContribution) {
      //   try { await onContribution('harvest', profileId); } catch { /* Village -- non-critical */ }
      // }
      return { cropId: result.harvestedCropId, isGolden: result.isGolden, harvestEvent, seedDrop };
    }

    // Preparer les champs a ecrire (chemin standard — pas de golden effect)
    const fieldsToWrite: Record<string, string> = {
      farm_crops: serializeCrops(result.crops),
      farm_harvest_inventory: serializeHarvestInventory(updatedHarvestInv),
    };

    // Si drop de graine rare, ajouter au stock
    if (seedDrop) {
      const currentRareSeeds = profile.farmRareSeeds ?? {};
      const updatedRareSeeds = { ...currentRareSeeds };
      updatedRareSeeds[seedDrop.seedId] = (updatedRareSeeds[seedDrop.seedId] ?? 0) + 1;
      fieldsToWrite.farm_rare_seeds = serializeRareSeeds(updatedRareSeeds);
    }

    // Ecrire tous les champs en une seule operation
    await writeProfileFields(profileId, fieldsToWrite);
    await refreshFarm(profileId);

    // Progression quêtes coopératives (harvest)
    if (onQuestProgress) {
      try { await onQuestProgress(profileId, 'harvest', 1); } catch { /* Quest — non-critical */ }
    }
    // Contribution village (COOP-01) -- fire-and-forget non-critical
    if (onContribution) {
      try { await onContribution('harvest', profileId); } catch { /* Village -- non-critical */ }
    }

    return { cropId: result.harvestedCropId, isGolden: result.isGolden, harvestEvent, seedDrop };
  }, [vault, profiles, writeProfileFields, refreshFarm, onQuestProgress, onContribution]);

  /** Vendre une recolte brute depuis l'inventaire */
  const sellHarvest = useCallback(async (profileId: string, cropId: string): Promise<number> => {
    if (!vault) return 0;


    const content = await vault.readFile(farmFile(profileId)).catch(() => '');
    const profile = parseFarmProfile(content);

    const harvestInv = profile.harvestInventory ?? {};
    if ((harvestInv[cropId] ?? 0) <= 0) return 0;

    // Deduire de l'inventaire
    const updatedInv = { ...harvestInv };
    updatedInv[cropId] = updatedInv[cropId] - 1;

    const reward = getEffectiveHarvestReward(cropId);
    if (reward <= 0) return 0;

    await writeProfileField(profileId, 'farm_harvest_inventory', serializeHarvestInventory(updatedInv));
    await addCoins(profileId, reward, `🍃 Vente recolte : ${cropId}`);
    await refreshFarm(profileId);
    await refreshGamification();
    return reward;
  }, [vault, writeProfileField, addCoins, refreshFarm, refreshGamification]);

  /** Crafter un item a partir des ingredients */
  const craft = useCallback(async (profileId: string, recipeId: string): Promise<CraftedItem | null> => {
    if (!vault) return null;


    const content = await vault.readFile(farmFile(profileId)).catch(() => '');
    const profile = parseFarmProfile(content);

    const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return null;

    const harvestInv = profile.harvestInventory ?? {};
    const farmInv: FarmInventory = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 };

    const result = craftItemFn(recipe, harvestInv, farmInv);
    if (!result) throw new Error('Ingredients insuffisants');

    // Ajouter l'item crafte
    const craftedItems = profile.craftedItems ?? [];
    const updatedCraftedItems = [...craftedItems, result.item];


    await writeProfileFields(profileId, {
      farm_harvest_inventory: serializeHarvestInventory(result.harvestInv),
      farm_inventory: serializeInventory(result.farmInv),
      farm_crafted_items: serializeCraftedItems(updatedCraftedItems),
    });
    // Bonus XP pour le craft
    if (recipe.xpBonus > 0) {
      await addCoins(profileId, recipe.xpBonus, `✨ Bonus craft : ${recipeId}`);
    }
    await refreshFarm(profileId);
    await refreshGamification();

    // Progression quêtes coopératives (craft)
    if (onQuestProgress) {
      try { await onQuestProgress(profileId, 'craft', 1); } catch { /* Quest — non-critical */ }
    }

    return result.item;
  }, [vault, writeProfileFields, refreshFarm, refreshGamification, onQuestProgress]);

  /** Vendre un item crafte */
  const sellCrafted = useCallback(async (profileId: string, recipeId: string): Promise<number> => {
    if (!vault) return 0;


    const content = await vault.readFile(farmFile(profileId)).catch(() => '');
    const profile = parseFarmProfile(content);

    const craftedItems = profile.craftedItems ?? [];
    const itemIdx = craftedItems.findIndex(i => i.recipeId === recipeId);
    if (itemIdx < 0) return 0;

    const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return 0;

    // Supprimer le premier item correspondant
    const updatedItems = [...craftedItems];
    updatedItems.splice(itemIdx, 1);

    const sellValue = sellCraftedItemFn(recipe);

    await writeProfileField(profileId, 'farm_crafted_items', serializeCraftedItems(updatedItems));
    await addCoins(profileId, sellValue, `🎁 Vente craft : ${recipeId}`);
    await refreshFarm(profileId);
    await refreshGamification();
    return sellValue;
  }, [vault, writeProfileField, addCoins, refreshFarm, refreshGamification]);

  /** Construire un batiment sur une cellule (nouveau systeme PlacedBuilding) */
  const buyBuilding = useCallback(async (profileId: string, buildingId: string, cellId: string) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return;

    const building = BUILDING_CATALOG.find(b => b.id === buildingId);
    if (!building) return;

    const currentBuildings = (profile.farmBuildings ?? []);
    if (currentBuildings.some(b => b.buildingId === buildingId)) return; // deja construit
    if ((profile.coins ?? 0) < building.cost) throw new Error('Pas assez de feuilles');

    const newBuildings = constructBuilding(currentBuildings, buildingId, cellId);
    await writeProfileField(profileId, 'farm_buildings', serializeBuildings(newBuildings));
    await deductCoins(profileId, building.cost, `🏗️ Construction : ${buildingId}`);
    await refreshFarm(profileId);
    await refreshGamification();
  }, [profiles, writeProfileField, deductCoins, refreshFarm, refreshGamification]);

  /** Ameliorer un batiment */
  const upgradeBuildingAction = useCallback(async (profileId: string, cellId: string): Promise<void> => {
    if (!vault) return;

    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const freshFarm = parseFarmProfile(content);

    const currentBuildings = freshFarm.farmBuildings ?? [];
    const building = currentBuildings.find(b => b.cellId === cellId);
    if (!building) return;

    const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
    if (!def) return;

    const cost = def.tiers[building.level]?.upgradeCoins ?? 0;
    if (cost === 0) throw new Error('Niveau maximum atteint');

    // Coins depuis le contexte (merge gami, fichier different)
    const profileCtx = profiles?.find(p => p.id === profileId);
    if ((profileCtx?.coins ?? 0) < cost) throw new Error('Pas assez de feuilles');

    const newFarm = { ...freshFarm, farmBuildings: upgradeBuilding(currentBuildings, cellId) };
    const profileName = profiles?.find(p => p.id === profileId)?.name ?? profileId;
    await vault.writeFile(file, serializeFarmProfile(profileName, newFarm));

    await deductCoins(profileId, cost, `⬆️ Amelioration : ${building.buildingId}`);
    await refreshFarm(profileId);
    await refreshGamification();
  }, [profiles, vault, deductCoins, refreshFarm, refreshGamification]);

  /** Collecter les ressources d'un batiment specifique */
  const collectBuildingResources = useCallback(async (profileId: string, cellId: string): Promise<number> => {
    if (!vault) return 0;

    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const profile = parseFarmProfile(content);

    const currentBuildings = profile.farmBuildings ?? [];
    const currentInventory: FarmInventory = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 };

    const profileTechBonuses = getTechBonuses(profile.farmTech ?? []);
    const wearEffects = getActiveWearEffects(profile.wearEvents ?? []);
    let productionBoost = 1;
    try {
      const questsContent = await vault.readFile(FAMILY_QUESTS_FILE).catch(() => '');
      const activeEffect = getActiveQuestEffect(parseFamilyQuestsMeta(questsContent));
      if (activeEffect?.type === 'production_boost') productionBoost = 2;
    } catch { /* Quest — non-critical */ }
    // Phase 20 : Building Turbo (EFFECTS-03) — production 2x plus rapide si actif
    if (profile.buildingTurboUntil && new Date(profile.buildingTurboUntil) > new Date()) {
      productionBoost *= 2;
    }
    const result = collectBuilding(currentBuildings, currentInventory, cellId, new Date(), profileTechBonuses, wearEffects, productionBoost);
    if (result.collected === 0) return 0;

    const profileName = profiles?.find(p => p.id === profileId)?.name ?? profileId;
    const newFarm = { ...profile, farmBuildings: result.buildings, farmInventory: result.inventory };
    await vault.writeFile(file, serializeFarmProfile(profileName, newFarm));

    await refreshFarm(profileId);

    // Progression quêtes coopératives (production)
    if (onQuestProgress && result.collected > 0) {
      try { await onQuestProgress(profileId, 'production', 1); } catch { /* Quest — non-critical */ }
    }

    return result.collected;
  }, [vault, profiles, refreshFarm, onQuestProgress]);

  /** Collecter le revenu passif de tous les batiments (appele a l'ouverture de l'ecran) */
  const collectPassiveIncome = useCallback(async (profileId: string): Promise<number> => {
    if (!vault) return 0;

    const file = farmFile(profileId);
    const content = await vault.readFile(file).catch(() => '');
    const profile = parseFarmProfile(content);

    const placedBuildings = profile.farmBuildings ?? [];
    if (placedBuildings.length === 0) return 0;

    let currentBuildings = placedBuildings;
    const currentInventory: FarmInventory = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 };
    let updatedInventory = { ...currentInventory };
    let total = 0;

    const passiveTechBonuses = getTechBonuses(profile.farmTech ?? []);
    const passiveWearEffects = getActiveWearEffects(profile.wearEvents ?? []);
    let passiveProductionBoost = 1;
    try {
      const questsContent = await vault.readFile(FAMILY_QUESTS_FILE).catch(() => '');
      const activeEffect = getActiveQuestEffect(parseFamilyQuestsMeta(questsContent));
      if (activeEffect?.type === 'production_boost') passiveProductionBoost = 2;
    } catch { /* Quest — non-critical */ }
    // Phase 20 : Building Turbo (EFFECTS-03) — production 2x plus rapide si actif
    if (profile.buildingTurboUntil && new Date(profile.buildingTurboUntil) > new Date()) {
      passiveProductionBoost *= 2;
    }
    for (const building of placedBuildings) {
      const result = collectBuilding(currentBuildings, updatedInventory, building.cellId, new Date(), passiveTechBonuses, passiveWearEffects, passiveProductionBoost);
      if (result.collected > 0) {
        total += result.collected;
        currentBuildings = result.buildings;
        updatedInventory = result.inventory;
      }
    }

    if (total === 0) return 0;

    const profileName = profiles?.find(p => p.id === profileId)?.name ?? profileId;
    const newFarm = { ...profile, farmBuildings: currentBuildings, farmInventory: updatedInventory };
    await vault.writeFile(file, serializeFarmProfile(profileName, newFarm));

    await refreshFarm(profileId);
    return total;
  }, [vault, profiles, refreshFarm]);

  /** Debloquer un noeud tech en depensant des feuilles */
  const unlockTech = useCallback(async (profileId: string, techId: string): Promise<boolean> => {
    if (!vault) return false;


    const content = await vault.readFile(farmFile(profileId)).catch(() => '');
    const familleProfile = parseFarmProfile(content);

    // Coins depuis le contexte profiles (merge gami)
    const fullProfile = profiles?.find(p => p.id === profileId);
    const coins = fullProfile?.coins ?? 0;

    const currentTechs = familleProfile.farmTech ?? [];
    const node = TECH_TREE.find(n => n.id === techId);
    if (!node) return false;

    const check = canUnlockTech(techId, currentTechs, coins);
    if (!check.canUnlock) throw new Error(check.reason ?? 'Impossible de debloquer');

    const newTechs = unlockTechNode(currentTechs, techId);
    await writeProfileField(profileId, 'farm_tech', serializeTechs(newTechs));
    await deductCoins(profileId, node.cost, `🔬 Tech : ${techId}`);
    await refreshFarm(profileId);
    await refreshGamification();
    return true;
  }, [vault, profiles, writeProfileField, deductCoins, refreshFarm, refreshGamification]);

  /** Verifier et generer de nouveaux evenements d'usure (appele a l'ouverture) */
  const checkWear = useCallback(async (profileId: string): Promise<WearEvent[]> => {
    if (!vault) return [];

    const content = await vault.readFile(farmFile(profileId)).catch(() => '');
    const profile = parseFarmProfile(content);

    const currentEvents = profile.wearEvents ?? [];
    const crops = parseCrops(profile.farmCrops ?? '');
    const buildings = profile.farmBuildings ?? [];
    const vaultProfile = profiles?.find(p => p.id === profileId);
    const treeStage = getTreeStageInfo(vaultProfile?.level ?? 1).stage;
    const totalPlots = getUnlockedPlotCount(treeStage);
    const profileTech = getTechBonuses(profile.farmTech ?? []);
    const now = new Date();

    // Calculer fullBuildingSince : heuristique basee sur le remplissage des batiments
    const fullBuildingSince: Record<string, string> = {};
    for (const b of buildings) {
      // Phase 20 : Capacity Boost (EFFECTS-08) — capacite batiments x2 si actif
      let effectiveCapacityMultiplier = profileTech?.buildingCapacityMultiplier ?? 1;
      if (profile.capacityBoostUntil && new Date(profile.capacityBoostUntil) > new Date()) {
        effectiveCapacityMultiplier *= 2;
      }
      const effectiveMaxPending = Math.floor(MAX_PENDING * effectiveCapacityMultiplier);
      const pending = getPendingResources(b, now, profileTech);
      if (pending >= effectiveMaxPending) {
        const def = BUILDING_CATALOG.find(d => d.id === b.buildingId);
        if (def) {
          const tier = def.tiers[b.level - 1];
          if (tier) {
            const effectiveRate = tier.productionRateHours * (profileTech?.productionIntervalMultiplier ?? 1.0);
            const rateMs = effectiveRate * 3600 * 1000;
            const fullSinceMs = new Date(b.lastCollectAt).getTime() + effectiveMaxPending * rateMs;
            fullBuildingSince[b.cellId] = new Date(fullSinceMs).toISOString();
          }
        }
      }
    }

    // Cooldown 24h : ne pas generer de nouveaux evenements si le dernier check est recent
    const lastGenerated = currentEvents
      .filter(e => !e.repairedAt)
      .map(e => new Date(e.startedAt).getTime())
      .sort((a, b) => b - a)[0];
    if (lastGenerated && now.getTime() - lastGenerated < 8 * 60 * 60 * 1000) {
      // Juste nettoyer les anciens evenements si necessaire
      const cleaned = cleanupOldEvents(currentEvents, now);
      if (cleaned.length !== currentEvents.length) {
        await writeProfileField(profileId, 'wear_events', serializeWearEvents(cleaned));
        await refreshFarm(profileId);
      }
      return [];
    }

    const newEvents = checkWearEvents(currentEvents, crops, buildings, totalPlots, fullBuildingSince, now);
    if (newEvents.length === 0) {
      // Juste nettoyer les anciens evenements si necessaire
      const cleaned = cleanupOldEvents(currentEvents, now);
      if (cleaned.length !== currentEvents.length) {
        await writeProfileField(profileId, 'wear_events', serializeWearEvents(cleaned));
        await refreshFarm(profileId);
      }
      return [];
    }

    const merged = cleanupOldEvents([...currentEvents, ...newEvents], now);
    await writeProfileField(profileId, 'wear_events', serializeWearEvents(merged));
    await refreshFarm(profileId);
    return newEvents;
  }, [vault, profiles, writeProfileField, refreshFarm]);

  /** Reparer un evenement d'usure (deduit les feuilles) */
  const repairWear = useCallback(async (profileId: string, eventId: string): Promise<boolean> => {
    if (!vault) return false;

    const content = await vault.readFile(farmFile(profileId)).catch(() => '');
    const profile = parseFarmProfile(content);

    const currentEvents = profile.wearEvents ?? [];
    const vaultProfile = profiles?.find(p => p.id === profileId);
    const coins = vaultProfile?.coins ?? 0;

    const result = repairWearEvent(currentEvents, eventId, coins);
    if (!result) return false;

    await writeProfileField(profileId, 'wear_events', serializeWearEvents(result.events));
    if (result.cost > 0) {
      await deductCoins(profileId, result.cost, `🔧 Reparation usure`);
    }
    await refreshFarm(profileId);
    await refreshGamification();
    return true;
  }, [vault, profiles, writeProfileField, deductCoins, refreshFarm, refreshGamification]);

  /** Effets d'usure actifs pour le profil courant (memoises) */
  const getWearEffects = useCallback((profileId: string): WearEffects => {
    const profile = profiles?.find(p => p.id === profileId);
    return getActiveWearEffects(profile?.wearEvents ?? []);
  }, [profiles]);

  /** Evenements d'usure bruts pour le profil courant */
  const getWearEvents = useCallback((profileId: string): WearEvent[] => {
    const profile = profiles?.find(p => p.id === profileId);
    return profile?.wearEvents ?? [];
  }, [profiles]);

  /** Envoyer un cadeau a un autre profil */
  const sendGift = useCallback(async (
    senderId: string,
    recipientId: string,
    _recipientName: string,
    itemType: 'harvest' | 'rare_seed' | 'crafted' | 'building_resource',
    itemId: string,
    quantity: number,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!vault) return { success: false, error: 'no_vault' };

    // 1. Lire farm-{senderId}.md
    const senderContent = await vault.readFile(farmFile(senderId)).catch(() => '');
    const senderFarm = parseFarmProfile(senderContent);

    // 2. Verifier anti-abus
    if (!canSendGiftToday(senderFarm.giftsSentToday)) {
      return { success: false, error: 'daily_limit' };
    }

    // 3. Retirer de l'inventaire expediteur
    const { success, updated } = removeFromInventory(senderFarm, itemType, itemId, quantity);
    if (!success) return { success: false, error: 'not_enough' };

    // 4. Construire le GiftEntry
    const senderProfile = profiles?.find(p => p.id === senderId);
    const gift: GiftEntry = {
      sender_id: senderId,
      sender_name: senderProfile?.name ?? senderId,
      sender_avatar: '',
      item_type: itemType,
      item_id: itemId,
      quantity,
      sent_at: new Date().toISOString(),
    };

    // 5. Lire pending existant, merger, ecrire
    const pendingFile = `gifts-pending-${recipientId}.md`;
    const pendingContent = await vault.readFile(pendingFile).catch(() => '');
    const pending = parsePendingGifts(pendingContent);
    pending.gifts.push(gift);
    await vault.writeFile(pendingFile, serializePendingGifts(pending.gifts));

    // 6. Ecrire farm expediteur avec inventaire reduit + historique + compteur
    const historyEntry = buildGiftHistoryEntry('sent', senderId, recipientId, itemType, itemId, quantity);
    const existingHistory = updated.giftHistory ?? '';
    const allHistory = existingHistory ? `${historyEntry}, ${existingHistory}` : historyEntry;
    const trimmedHistory = allHistory.split(', ').slice(0, 10).join(', ');

    // Serialiser les champs inventaire modifies selon itemType
    const inventoryFields: Record<string, string> = {};
    if (itemType === 'harvest') {
      inventoryFields['farm_harvest_inventory'] = serializeHarvestInventory(updated.harvestInventory ?? {});
    } else if (itemType === 'rare_seed') {
      inventoryFields['farm_rare_seeds'] = serializeRareSeeds(updated.farmRareSeeds ?? {});
    } else if (itemType === 'crafted') {
      inventoryFields['farm_crafted_items'] = serializeCraftedItems(updated.craftedItems ?? []);
    } else if (itemType === 'building_resource') {
      inventoryFields['farm_inventory'] = serializeInventory(updated.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 });
    }
    inventoryFields['gift_history'] = trimmedHistory;
    inventoryFields['gifts_sent_today'] = incrementGiftsSent(senderFarm.giftsSentToday);

    await writeProfileFields(senderId, inventoryFields);
    await refreshFarm(senderId);
    return { success: true };
  }, [vault, profiles, writeProfileFields, refreshFarm]);

  /** Consommer les cadeaux en attente pour un profil (claim-first) */
  const receiveGifts = useCallback(async (
    recipientId: string,
  ): Promise<GiftEntry[]> => {
    if (!vault) return [];

    const pendingFile = `gifts-pending-${recipientId}.md`;
    const pendingContent = await vault.readFile(pendingFile).catch(() => null);
    if (!pendingContent) return [];

    const pending = parsePendingGifts(pendingContent);
    if (pending.gifts.length === 0) return [];
    if (pending.gifts.length === 0) return [];

    // 1. CLAIM FIRST — supprimer le fichier pending AVANT d'appliquer (evite double-consommation)
    await vault.deleteFile(pendingFile);

    // 2. Lire farm destinataire
    const content = await vault.readFile(farmFile(recipientId)).catch(() => '');
    let farmData = parseFarmProfile(content);

    // 3. Appliquer chaque cadeau
    for (const gift of pending.gifts) {
      farmData = addGiftToInventory(farmData, gift);
    }

    // 4. Ajouter a l'historique
    const recipientProfile = profiles?.find(p => p.id === recipientId);
    const newEntries = pending.gifts.map(g =>
      buildGiftHistoryEntry('received', g.sender_id, recipientId, g.item_type, g.item_id, g.quantity)
    );
    const existingHistory = farmData.giftHistory ?? '';
    const allHistory = [...newEntries, ...existingHistory.split(', ').filter(Boolean)].slice(0, 10).join(', ');

    // 5. Ecrire farm destinataire complet via serializeFarmProfile
    const profileName = recipientProfile?.name ?? recipientId;
    await vault.writeFile(farmFile(recipientId), serializeFarmProfile(profileName, { ...farmData, giftHistory: allHistory }));

    await refreshFarm(recipientId);
    return pending.gifts;
  }, [vault, profiles, refreshFarm]);

  return {
    plant,
    harvest,
    buyBuilding,
    upgradeBuildingAction,
    collectBuildingResources,
    collectPassiveIncome,
    craft,
    sellHarvest,
    sellCrafted,
    unlockTech,
    checkWear,
    repairWear,
    getWearEffects,
    getWearEvents,
    sendGift,
    receiveGifts,
  };
}
