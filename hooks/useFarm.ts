/**
 * useFarm.ts — Hook pour la gestion de la ferme (planter, recolter)
 *
 * Lit/ecrit farm_crops dans famille.md et deduit les feuilles dans gamification.md.
 */

import { useCallback } from 'react';
import { useVault } from '../contexts/VaultContext';
import { plantCrop, harvestCrop, parseCrops, serializeCrops } from '../lib/mascot/farm-engine';
import { CROP_CATALOG, BUILDING_CATALOG, type PlacedBuilding, type FarmInventory } from '../lib/mascot/types';
import {
  constructBuilding as constructBuildingFn,
  upgradeBuilding as upgradeBuildingFn,
  collectBuilding as collectBuildingFn,
  serializeBuildings,
  parseBuildings,
  serializeInventory,
  parseInventory,
  getUpgradeCost,
  canUpgrade,
} from '../lib/mascot/building-engine';
import { parseGamification, serializeGamification } from '../lib/parser';

const FAMILLE_FILE = 'famille.md';
const GAMI_FILE = 'gamification.md';

export function useFarm() {
  const { vault, profiles, refresh } = useVault();

  /** Helper generique pour ecrire un champ dans la section du profil */
  const writeField = useCallback(async (profileId: string, fieldKey: string, value: string) => {
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

  /** Ecrire farm_crops dans la section du profil */
  const writeFarmCrops = useCallback(async (profileId: string, cropsCSV: string) => {
    await writeField(profileId, 'farm_crops', cropsCSV);
  }, [writeField]);

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

  /** Recolter une culture mature */
  const harvest = useCallback(async (profileId: string, plotIndex: number) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return 0;

    const currentCrops = parseCrops(profile.farmCrops ?? '');
    const result = harvestCrop(currentCrops, plotIndex);
    if (result.reward === 0) return 0;

    // Supprimer la culture + ajouter les feuilles
    await writeFarmCrops(profileId, serializeCrops(result.crops));
    const crop = currentCrops.find(c => c.plotIndex === plotIndex);
    await addCoins(profileId, result.reward, `🌾 Recolte : ${crop?.cropId ?? '?'}`);
    await refresh();
    return result.reward;
  }, [profiles, writeFarmCrops, addCoins, refresh]);

  /** Acheter et placer un batiment dans une cellule */
  const buyBuilding = useCallback(async (profileId: string, buildingId: string, cellId: string) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return;

    const building = BUILDING_CATALOG.find(b => b.id === buildingId);
    if (!building) return;

    const currentBuildings: PlacedBuilding[] = profile.farmBuildings ?? [];
    if (currentBuildings.some((b: PlacedBuilding) => b.cellId === cellId)) return; // cellule deja occupee
    if ((profile.coins ?? 0) < building.cost) throw new Error('Pas assez de feuilles');

    const newBuildings = constructBuildingFn(currentBuildings, buildingId, cellId);
    await writeField(profileId, 'farm_buildings', serializeBuildings(newBuildings));
    await deductCoins(profileId, building.cost, `🏗️ Construction : ${buildingId}`);
    await refresh();
  }, [profiles, writeField, deductCoins, refresh]);

  /** Ameliorer un batiment au prochain niveau */
  const upgradeBuildingAction = useCallback(async (profileId: string, cellId: string) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return;

    const currentBuildings: PlacedBuilding[] = profile.farmBuildings ?? [];
    const building = currentBuildings.find(b => b.cellId === cellId);
    if (!building) return;

    const cost = getUpgradeCost(building);
    if (cost === 0 || !canUpgrade(building)) return;
    if ((profile.coins ?? 0) < cost) throw new Error('Pas assez de feuilles');

    const newBuildings = upgradeBuildingFn(currentBuildings, cellId);
    await writeField(profileId, 'farm_buildings', serializeBuildings(newBuildings));
    await deductCoins(profileId, cost, `⬆️ Amelioration : ${building.buildingId} Niv ${building.level + 1}`);
    await refresh();
  }, [profiles, writeField, deductCoins, refresh]);

  /** Collecter les ressources d'un batiment specifique */
  const collectBuildingResources = useCallback(async (profileId: string, cellId: string): Promise<number> => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile || !vault) return 0;

    const currentBuildings: PlacedBuilding[] = profile.farmBuildings ?? [];
    const currentInventory: FarmInventory = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0 };

    const result = collectBuildingFn(currentBuildings, currentInventory, cellId);
    if (result.collected === 0) return 0;

    await writeField(profileId, 'farm_buildings', serializeBuildings(result.buildings));
    await writeField(profileId, 'farm_inventory', serializeInventory(result.inventory));
    await refresh();
    return result.collected;
  }, [profiles, vault, writeField, refresh]);

  /** Collecter le revenu passif de tous les batiments */
  const collectPassiveIncome = useCallback(async (profileId: string): Promise<number> => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile || !vault) return 0;

    const buildings: PlacedBuilding[] = profile.farmBuildings ?? [];
    if (buildings.length === 0) return 0;

    let totalCollected = 0;
    let currentBuildings = [...buildings];
    let currentInventory: FarmInventory = profile.farmInventory ?? { oeuf: 0, lait: 0, farine: 0 };

    for (const b of buildings) {
      const result = collectBuildingFn(currentBuildings, currentInventory, b.cellId);
      totalCollected += result.collected;
      currentBuildings = result.buildings;
      currentInventory = result.inventory;
    }

    if (totalCollected === 0) return 0;

    await writeField(profileId, 'farm_buildings', serializeBuildings(currentBuildings));
    await writeField(profileId, 'farm_inventory', serializeInventory(currentInventory));
    await refresh();
    return totalCollected;
  }, [profiles, vault, writeField, refresh]);

  return { plant, harvest, buyBuilding, upgradeBuildingAction, collectBuildingResources, collectPassiveIncome };
}
