/**
 * useFarm.ts — Hook pour la gestion de la ferme (planter, recolter, crafter, vendre)
 *
 * Lit/ecrit farm_crops, farm_harvest_inventory, farm_crafted_items dans famille.md
 * et deduit/ajoute les feuilles dans gamification.md.
 */

import { useCallback } from 'react';
import { useVault } from '../contexts/VaultContext';
import { plantCrop, harvestCrop, parseCrops, serializeCrops } from '../lib/mascot/farm-engine';
import { CROP_CATALOG, BUILDING_CATALOG } from '../lib/mascot/types';
import type { PlacedBuilding, FarmInventory, CraftedItem } from '../lib/mascot/types';
import {
  constructBuilding,
  upgradeBuilding,
  collectBuilding,
  serializeBuildings,
  parseBuildings,
  serializeInventory,
  parseInventory,
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
} from '../lib/mascot/craft-engine';
import { parseGamification, serializeGamification, parseFamille } from '../lib/parser';

const FAMILLE_FILE = 'famille.md';
const GAMI_FILE = 'gamification.md';

export function useFarm() {
  const { vault, profiles, refresh } = useVault();

  /** Ecrire farm_crops dans la section du profil */
  const writeFarmCrops = useCallback(async (profileId: string, cropsCSV: string) => {
    if (!vault) return;
    const content = await vault.readFile(FAMILLE_FILE);
    const lines = content.split('\n');
    let inSection = false;
    let fieldLine = -1;
    let lastPropIdx = -1;
    const fieldKey = 'farm_crops';

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) break;
        if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
      } else if (inSection && lines[i].includes(': ')) {
        lastPropIdx = i;
        if (lines[i].trim().startsWith(`${fieldKey}:`)) fieldLine = i;
      }
    }

    const newValue = `${fieldKey}: ${cropsCSV}`;
    if (fieldLine >= 0) {
      lines[fieldLine] = newValue;
    } else if (lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1, 0, newValue);
    }

    await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
  }, [vault]);

  /** Deduire des feuilles dans gamification.md */
  const deductCoins = useCallback(async (profileId: string, amount: number, note: string) => {
    if (!vault || amount <= 0) return;
    const gamiContent = await vault.readFile(GAMI_FILE);
    const gami = parseGamification(gamiContent);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) - amount;
    gami.history.push({
      profileId,
      action: `-${amount}`,
      points: -amount,
      note,
      timestamp: new Date().toISOString(),
    });

    await vault.writeFile(GAMI_FILE, serializeGamification(gami));
  }, [vault]);

  /** Ajouter des feuilles dans gamification.md */
  const addCoins = useCallback(async (profileId: string, amount: number, note: string) => {
    if (!vault || amount <= 0) return;
    const gamiContent = await vault.readFile(GAMI_FILE);
    const gami = parseGamification(gamiContent);
    const gamiProfile = gami.profiles.find(
      (p: any) => p.name.toLowerCase().replace(/\s+/g, '') === profileId.toLowerCase()
    );
    if (!gamiProfile) return;

    gamiProfile.coins = (gamiProfile.coins ?? gamiProfile.points) + amount;
    gami.history.push({
      profileId,
      action: `+${amount}`,
      points: amount,
      note,
      timestamp: new Date().toISOString(),
    });

    await vault.writeFile(GAMI_FILE, serializeGamification(gami));
  }, [vault]);

  /** Ecrire un champ string dans la section d'un profil dans famille.md */
  const writeProfileField = useCallback(async (profileId: string, fieldKey: string, value: string) => {
    if (!vault) return;
    const content = await vault.readFile(FAMILLE_FILE);
    const lines = content.split('\n');
    let inSection = false;
    let fieldLine = -1;
    let lastPropIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) break;
        if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
      } else if (inSection && lines[i].includes(': ')) {
        lastPropIdx = i;
        if (lines[i].trim().startsWith(`${fieldKey}:`)) fieldLine = i;
      }
    }

    const newValue = `${fieldKey}: ${value}`;
    if (fieldLine >= 0) {
      lines[fieldLine] = newValue;
    } else if (lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1, 0, newValue);
    }

    await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
  }, [vault]);

  /** Ecrire plusieurs champs en une seule operation atomique (evite les race conditions) */
  const writeProfileFields = useCallback(async (profileId: string, fields: Record<string, string>) => {
    if (!vault) return;
    const content = await vault.readFile(FAMILLE_FILE);
    const lines = content.split('\n');
    let inSection = false;
    let lastPropIdx = -1;
    const fieldLines: Record<string, number> = {};

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) break;
        if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
      } else if (inSection && lines[i].includes(': ')) {
        lastPropIdx = i;
        for (const key of Object.keys(fields)) {
          if (lines[i].trim().startsWith(`${key}:`)) fieldLines[key] = i;
        }
      }
    }

    // Mettre a jour les champs existants
    for (const [key, lineIdx] of Object.entries(fieldLines)) {
      lines[lineIdx] = `${key}: ${fields[key]}`;
    }

    // Ajouter les champs manquants apres la derniere propriete
    let insertOffset = 0;
    for (const [key, value] of Object.entries(fields)) {
      if (fieldLines[key] === undefined && lastPropIdx >= 0) {
        lines.splice(lastPropIdx + 1 + insertOffset, 0, `${key}: ${value}`);
        insertOffset++;
      }
    }

    await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
  }, [vault]);

  /** Planter une culture sur une parcelle */
  const plant = useCallback(async (profileId: string, plotIndex: number, cropId: string) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return;

    const cropDef = CROP_CATALOG.find(c => c.id === cropId);
    if (!cropDef) return;

    // Verifier les feuilles
    const coins = profile.coins ?? 0;
    if (coins < cropDef.cost) throw new Error('Pas assez de feuilles');

    const currentCrops = parseCrops(profile.farmCrops ?? '');
    const newCrops = plantCrop(currentCrops, plotIndex, cropId);
    if (newCrops.length === currentCrops.length) return;

    // Ecrire les cultures + deduire les feuilles
    await writeFarmCrops(profileId, serializeCrops(newCrops));
    await deductCoins(profileId, cropDef.cost, `🌱 Graine : ${cropId}`);
    await refresh();
  }, [profiles, writeFarmCrops, deductCoins, refresh]);

  /** Recolter une culture mature — stocke en inventaire au lieu de donner des feuilles */
  const harvest = useCallback(async (profileId: string, plotIndex: number): Promise<{ cropId: string; isGolden: boolean } | null> => {
    if (!vault) return null;

    // Lire frais pour eviter les stale closures
    const content = await vault.readFile(FAMILLE_FILE);
    const freshProfiles = parseFamille(content);
    const profile = freshProfiles.find(p => p.id === profileId);
    if (!profile) return null;

    const currentCrops = parseCrops(profile.farmCrops ?? '');
    const result = harvestCrop(currentCrops, plotIndex);
    if (!result.harvestedCropId) return null;

    // Ajouter la recolte a l'inventaire
    const harvestInv = parseHarvestInventory(
      (profile as any).farm_harvest_inventory ?? undefined
    );
    // Utiliser le champ parse du profile si disponible
    const currentHarvestInv = profile.harvestInventory ?? harvestInv;
    const updatedHarvestInv = { ...currentHarvestInv };
    updatedHarvestInv[result.harvestedCropId] = (updatedHarvestInv[result.harvestedCropId] ?? 0) + 1;

    // Ecrire farm_crops + farm_harvest_inventory en une seule operation
    await writeProfileFields(profileId, {
      farm_crops: serializeCrops(result.crops),
      farm_harvest_inventory: serializeHarvestInventory(updatedHarvestInv),
    });
    await refresh();

    return { cropId: result.harvestedCropId, isGolden: result.isGolden };
  }, [vault, writeProfileFields, refresh]);

  /** Vendre une recolte brute depuis l'inventaire */
  const sellHarvest = useCallback(async (profileId: string, cropId: string): Promise<number> => {
    if (!vault) return 0;

    // Lire frais
    const content = await vault.readFile(FAMILLE_FILE);
    const freshProfiles = parseFamille(content);
    const profile = freshProfiles.find(p => p.id === profileId);
    if (!profile) return 0;

    const harvestInv = profile.harvestInventory ?? {};
    if ((harvestInv[cropId] ?? 0) <= 0) return 0;

    // Deduire de l'inventaire
    const updatedInv = { ...harvestInv };
    updatedInv[cropId] = updatedInv[cropId] - 1;

    const reward = sellRawHarvestFn(cropId);
    if (reward <= 0) return 0;

    await writeProfileField(profileId, 'farm_harvest_inventory', serializeHarvestInventory(updatedInv));
    await addCoins(profileId, reward, `🍃 Vente recolte : ${cropId}`);
    await refresh();
    return reward;
  }, [vault, writeProfileField, addCoins, refresh]);

  /** Crafter un item a partir des ingredients */
  const craft = useCallback(async (profileId: string, recipeId: string): Promise<CraftedItem | null> => {
    if (!vault) return null;

    // Lire frais
    const content = await vault.readFile(FAMILLE_FILE);
    const freshProfiles = parseFamille(content);
    const profile = freshProfiles.find(p => p.id === profileId);
    if (!profile) return null;

    const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return null;

    const harvestInv = profile.harvestInventory ?? {};
    const farmInv: FarmInventory = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0 };

    const result = craftItemFn(recipe, harvestInv, farmInv);
    if (!result) throw new Error('Ingredients insuffisants');

    // Ajouter l'item crafte
    const craftedItems = profile.craftedItems ?? [];
    const updatedCraftedItems = [...craftedItems, result.item];

    // Ecrire les 3 champs en une seule operation
    await writeProfileFields(profileId, {
      farm_harvest_inventory: serializeHarvestInventory(result.harvestInv),
      farm_inventory: serializeInventory(result.farmInv),
      farm_crafted_items: serializeCraftedItems(updatedCraftedItems),
    });
    await refresh();
    return result.item;
  }, [vault, writeProfileFields, refresh]);

  /** Vendre un item crafte */
  const sellCrafted = useCallback(async (profileId: string, recipeId: string): Promise<number> => {
    if (!vault) return 0;

    // Lire frais
    const content = await vault.readFile(FAMILLE_FILE);
    const freshProfiles = parseFamille(content);
    const profile = freshProfiles.find(p => p.id === profileId);
    if (!profile) return 0;

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
    await refresh();
    return sellValue;
  }, [vault, writeProfileField, addCoins, refresh]);

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
    await refresh();
  }, [profiles, writeProfileField, deductCoins, refresh]);

  /** Ameliorer un batiment */
  const upgradeBuildingAction = useCallback(async (profileId: string, cellId: string): Promise<void> => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile || !vault) return;

    const currentBuildings = (profile.farmBuildings ?? []);
    const building = currentBuildings.find(b => b.cellId === cellId);
    if (!building) return;

    const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
    if (!def) return;

    const upgradeCost = def.tiers[building.level]?.upgradeCoins ?? 0;
    if (upgradeCost === 0) throw new Error('Niveau maximum atteint');
    if ((profile.coins ?? 0) < upgradeCost) throw new Error('Pas assez de feuilles');

    const newBuildings = upgradeBuilding(currentBuildings, cellId);
    await writeProfileField(profileId, 'farm_buildings', serializeBuildings(newBuildings));
    await deductCoins(profileId, upgradeCost, `⬆️ Amelioration : ${building.buildingId}`);
    await refresh();
  }, [profiles, vault, writeProfileField, deductCoins, refresh]);

  /** Collecter les ressources d'un batiment specifique */
  const collectBuildingResources = useCallback(async (profileId: string, cellId: string): Promise<number> => {
    if (!vault) return 0;

    // Lire depuis le fichier pour eviter les stale closures
    const content = await vault.readFile(FAMILLE_FILE);
    const freshProfiles = parseFamille(content);
    const profile = freshProfiles.find(p => p.id === profileId);
    if (!profile) return 0;

    const currentBuildings = profile.farmBuildings ?? [];
    const currentInventory: FarmInventory = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0 };

    const result = collectBuilding(currentBuildings, currentInventory, cellId);
    if (result.collected === 0) return 0;

    // Ecrire les 2 champs en une seule operation pour eviter les race conditions
    const lines = content.split('\n');
    let inSection = false;
    let buildingsLine = -1;
    let inventoryLine = -1;
    let lastPropIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('### ')) {
        if (inSection) break;
        if (lines[i].replace('### ', '').trim() === profileId) inSection = true;
      } else if (inSection && lines[i].includes(': ')) {
        lastPropIdx = i;
        if (lines[i].trim().startsWith('farm_buildings:')) buildingsLine = i;
        if (lines[i].trim().startsWith('farm_inventory:')) inventoryLine = i;
      }
    }

    const buildingsValue = `farm_buildings: ${serializeBuildings(result.buildings)}`;
    const inventoryValue = `farm_inventory: ${serializeInventory(result.inventory)}`;

    if (buildingsLine >= 0) {
      lines[buildingsLine] = buildingsValue;
    } else if (lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1, 0, buildingsValue);
      lastPropIdx++;
      // Recalculer inventoryLine si il etait apres l'insertion
      if (inventoryLine > lastPropIdx) inventoryLine++;
    }

    if (inventoryLine >= 0) {
      lines[inventoryLine] = inventoryValue;
    } else if (lastPropIdx >= 0) {
      lines.splice(lastPropIdx + 1, 0, inventoryValue);
    }

    await vault.writeFile(FAMILLE_FILE, lines.join('\n'));
    await refresh();
    return result.collected;
  }, [vault, refresh]);

  /** Collecter le revenu passif de tous les batiments (appele a l'ouverture de l'ecran) */
  const collectPassiveIncome = useCallback(async (profileId: string): Promise<number> => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile || !vault) return 0;

    const placedBuildings = (profile.farmBuildings ?? []);
    if (placedBuildings.length === 0) return 0;

    let totalCollected = 0;
    let currentBuildings = placedBuildings;
    const currentInventory: FarmInventory = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0 };
    let updatedInventory = { ...currentInventory };

    for (const building of placedBuildings) {
      const result = collectBuilding(currentBuildings, updatedInventory, building.cellId);
      if (result.collected > 0) {
        totalCollected += result.collected;
        currentBuildings = result.buildings;
        updatedInventory = result.inventory;
      }
    }

    if (totalCollected === 0) return 0;

    await writeProfileField(profileId, 'farm_buildings', serializeBuildings(currentBuildings));
    await writeProfileField(profileId, 'farm_inventory', serializeInventory(updatedInventory));
    await refresh();

    return totalCollected;
  }, [profiles, vault, writeProfileField, refresh]);

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
  };
}
