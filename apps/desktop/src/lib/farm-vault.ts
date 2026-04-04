/**
 * farm-vault.ts — Read/write farm & gamification data in the Obsidian vault.
 *
 * Writes to famille.md (farm state) and gami-{id}.md (coins/points)
 * in the exact same format as the mobile app.
 */

import {
  plantCrop, harvestCrop, serializeCrops, parseCrops,
  constructBuilding, upgradeBuilding, collectBuilding,
  serializeBuildings, parseBuildings, serializeInventory, parseInventory,
  getEffectiveHarvestReward, sellRawHarvest,
  BUILDING_CATALOG,
  parseWearEvents, serializeWearEvents, checkWearEvents,
  repairWearEvent, getActiveWearEffects, cleanupOldEvents,
  REPAIR_COSTS,
  type PlantedCrop, type PlacedBuilding, type FarmInventory,
  type WearEvent, type WearEffects,
} from '@family-vault/core';

type ReadFn = (path: string) => Promise<string>;
type WriteFn = (path: string, content: string) => Promise<void>;

// ─── Famille.md field patching ─────────────────────────────────────────────

/** Patch a single key: value field under ### {profileId} in famille.md */
export function patchProfileField(content: string, profileId: string, key: string, value: string): string {
  return patchProfileFields(content, profileId, { [key]: value });
}

/** Patch multiple fields at once under ### {profileId} */
export function patchProfileFields(content: string, profileId: string, fields: Record<string, string>): string {
  const lines = content.split('\n');
  const sectionHeader = `### ${profileId}`;

  let inSection = false;
  let lastPropLine = -1;
  const foundKeys = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.toLowerCase() === sectionHeader.toLowerCase()) {
      inSection = true;
      lastPropLine = i;
      continue;
    }

    if (inSection && trimmed.startsWith('### ')) {
      // Entered next section — insert missing fields before this line
      break;
    }

    if (inSection && trimmed.match(/^[a-z_]+:/)) {
      lastPropLine = i;
      // Check if this line matches a field we want to patch
      for (const [k, v] of Object.entries(fields)) {
        if (trimmed.startsWith(`${k}:`)) {
          lines[i] = `${k}: ${v}`;
          foundKeys.add(k);
        }
      }
    }
  }

  // Insert any fields that weren't found
  const missing = Object.entries(fields).filter(([k]) => !foundKeys.has(k));
  if (missing.length > 0 && lastPropLine >= 0) {
    const insertions = missing.map(([k, v]) => `${k}: ${v}`);
    lines.splice(lastPropLine + 1, 0, ...insertions);
  }

  return lines.join('\n');
}

// ─── Gami file helpers ─────────────────────────────────────────────────────

/** Read coins from gami-{id}.md content */
export function readCoins(gamiContent: string, profileName: string): number {
  const lines = gamiContent.split('\n');
  const header = `## ${profileName}`;
  let inSection = false;

  for (const line of lines) {
    if (line.trim() === header) { inSection = true; continue; }
    if (inSection && line.trim().startsWith('## ')) break;
    if (inSection) {
      const m = line.match(/^coins:\s*(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
  }
  // Fallback to points
  inSection = false;
  for (const line of lines) {
    if (line.trim() === header) { inSection = true; continue; }
    if (inSection && line.trim().startsWith('## ')) break;
    if (inSection) {
      const m = line.match(/^points:\s*(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
  }
  return 0;
}

/** Update coins in gami-{id}.md content (+delta or -delta) */
export function updateCoins(gamiContent: string, profileName: string, delta: number): string {
  const current = readCoins(gamiContent, profileName);
  const newVal = current + delta;
  if (newVal < 0) throw new Error(`Pas assez de pièces (${current} + ${delta} = ${newVal})`);

  const lines = gamiContent.split('\n');
  const header = `## ${profileName}`;
  let inSection = false;
  let coinsFound = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === header) { inSection = true; continue; }
    if (inSection && lines[i].trim().startsWith('## ')) break;
    if (inSection && lines[i].match(/^coins:/)) {
      lines[i] = `coins: ${newVal}`;
      coinsFound = true;
      break;
    }
  }

  // If no coins line, insert after points line
  if (!coinsFound) {
    inSection = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === header) { inSection = true; continue; }
      if (inSection && lines[i].match(/^points:/)) {
        lines.splice(i + 1, 0, `coins: ${newVal}`);
        break;
      }
    }
  }

  return lines.join('\n');
}

/** Append a history entry to the Journal des gains section */
export function addGamiHistory(gamiContent: string, profileId: string, action: string, note: string): string {
  const lines = gamiContent.split('\n');
  const entry = `- ${new Date().toISOString()} | ${profileId} | ${action} | ${note}`;

  // Find "## Journal des gains" section
  let journalIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('## Journal des gains')) {
      journalIdx = i;
      break;
    }
  }

  if (journalIdx >= 0) {
    // Insert after the header
    lines.splice(journalIdx + 1, 0, entry);
    // Cap at 100 entries
    let count = 0;
    for (let i = journalIdx + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith('- ')) {
        count++;
        if (count > 100) {
          lines.splice(i, lines.length - i);
          break;
        }
      }
    }
  } else {
    // Append section at end
    lines.push('', '## Journal des gains', entry);
  }

  return lines.join('\n');
}

// ─── Helper: read farm fields from famille.md ──────────────────────────────

function readProfileField(familleContent: string, profileId: string, key: string): string {
  const lines = familleContent.split('\n');
  const header = `### ${profileId}`;
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase() === header.toLowerCase()) { inSection = true; continue; }
    if (inSection && trimmed.startsWith('### ')) break;
    if (inSection && trimmed.startsWith(`${key}:`)) {
      return trimmed.slice(key.length + 1).trim();
    }
  }
  return '';
}

// ─── Farm operations ───────────────────────────────────────────────────────

export async function plantCropInVault(
  readFile: ReadFn, writeFile: WriteFn,
  profileId: string, profileName: string,
  plotIndex: number, cropId: string, cost: number,
): Promise<void> {
  // 1. Update famille.md — farm_crops (with wear effects check)
  const famille = await readFile('famille.md');
  const cropsCSV = readProfileField(famille, profileId, 'farm_crops');
  const crops = cropsCSV ? parseCrops(cropsCSV) : [];
  const wearCSV = readProfileField(famille, profileId, 'wear_events');
  const wearEvents = parseWearEvents(wearCSV);
  const wearEffects = getActiveWearEffects(wearEvents);
  const newCrops = plantCrop(crops, plotIndex, cropId, wearEffects);
  const updated = patchProfileField(famille, profileId, 'farm_crops', serializeCrops(newCrops));
  await writeFile('famille.md', updated);

  // 2. Deduct coins from gami file
  if (cost > 0) {
    const gamiPath = `gami-${profileId}.md`;
    try {
      const gami = await readFile(gamiPath);
      let newGami = updateCoins(gami, profileName, -cost);
      newGami = addGamiHistory(newGami, profileId, 'farm_plant', `🌱 Planté: ${cropId} (-${cost} pièces)`);
      await writeFile(gamiPath, newGami);
    } catch { /* gami file may not exist yet */ }
  }
}

export async function harvestCropInVault(
  readFile: ReadFn, writeFile: WriteFn,
  profileId: string, plotIndex: number,
): Promise<{ cropId: string; reward: number; isGolden: boolean }> {
  const famille = await readFile('famille.md');
  const cropsCSV = readProfileField(famille, profileId, 'farm_crops');
  const crops = cropsCSV ? parseCrops(cropsCSV) : [];

  const result = harvestCrop(crops, plotIndex);
  const { harvestedCropId, isGolden } = result as any;
  const cropId = harvestedCropId ?? '';
  const reward = getEffectiveHarvestReward(cropId);

  // Update harvest inventory
  const harvestCSV = readProfileField(famille, profileId, 'farm_harvest_inventory');
  const inv: Record<string, number> = {};
  if (harvestCSV) {
    harvestCSV.split(',').forEach(entry => {
      const [k, v] = entry.split(':');
      if (k && v) inv[k] = parseInt(v, 10);
    });
  }
  inv[cropId] = (inv[cropId] || 0) + (isGolden ? 2 : 1);

  const newHarvestCSV = Object.entries(inv)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');

  let updated = patchProfileFields(famille, profileId, {
    farm_crops: serializeCrops(result.crops),
    farm_harvest_inventory: newHarvestCSV,
  });
  await writeFile('famille.md', updated);

  return { cropId, reward, isGolden };
}

export async function sellHarvestInVault(
  readFile: ReadFn, writeFile: WriteFn,
  profileId: string, profileName: string,
  cropId: string, qty: number,
): Promise<number> {
  const famille = await readFile('famille.md');
  const harvestCSV = readProfileField(famille, profileId, 'farm_harvest_inventory');
  const inv: Record<string, number> = {};
  if (harvestCSV) {
    harvestCSV.split(',').forEach(entry => {
      const [k, v] = entry.split(':');
      if (k && v) inv[k] = parseInt(v, 10);
    });
  }

  if ((inv[cropId] || 0) < qty) throw new Error('Pas assez en stock');
  inv[cropId] -= qty;

  const newCSV = Object.entries(inv)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');

  const updated = patchProfileField(famille, profileId, 'farm_harvest_inventory', newCSV);
  await writeFile('famille.md', updated);

  const reward = sellRawHarvest(cropId) * qty;

  // Add coins
  const gamiPath = `gami-${profileId}.md`;
  try {
    const gami = await readFile(gamiPath);
    let newGami = updateCoins(gami, profileName, reward);
    newGami = addGamiHistory(newGami, profileId, 'farm_sell', `💰 Vendu ${qty}× ${cropId} (+${reward} pièces)`);
    await writeFile(gamiPath, newGami);
  } catch { /* */ }

  return reward;
}

export async function collectBuildingInVault(
  readFile: ReadFn, writeFile: WriteFn,
  profileId: string, cellId: string,
): Promise<{ collected: number; resourceType: string }> {
  const famille = await readFile('famille.md');
  const buildingsCSV = readProfileField(famille, profileId, 'farm_buildings');
  const buildings = buildingsCSV ? parseBuildings(buildingsCSV) : [];
  const invCSV = readProfileField(famille, profileId, 'farm_inventory');
  const inventory = invCSV ? parseInventory(invCSV) : { oeuf: 0, lait: 0, farine: 0, miel: 0 } as FarmInventory;

  const result = collectBuilding(buildings, inventory, cellId);
  const { collected } = result;

  const building = buildings.find(b => b.cellId === cellId);
  const def = building ? BUILDING_CATALOG.find(d => d.id === building.buildingId) : null;
  const resourceType = def?.resourceType ?? 'ressource';

  const updated = patchProfileFields(famille, profileId, {
    farm_buildings: serializeBuildings(result.buildings),
    farm_inventory: serializeInventory(result.inventory),
  });
  await writeFile('famille.md', updated);

  return { collected, resourceType };
}

export async function buyBuildingInVault(
  readFile: ReadFn, writeFile: WriteFn,
  profileId: string, profileName: string,
  buildingId: string, cellId: string, cost: number,
): Promise<void> {
  const famille = await readFile('famille.md');
  const buildingsCSV = readProfileField(famille, profileId, 'farm_buildings');
  const buildings = buildingsCSV ? parseBuildings(buildingsCSV) : [];

  const newBuildings = constructBuilding(buildings, buildingId, cellId);

  const updated = patchProfileField(famille, profileId, 'farm_buildings', serializeBuildings(newBuildings));
  await writeFile('famille.md', updated);

  if (cost > 0) {
    const gamiPath = `gami-${profileId}.md`;
    try {
      const gami = await readFile(gamiPath);
      let newGami = updateCoins(gami, profileName, -cost);
      newGami = addGamiHistory(newGami, profileId, 'farm_build', `🏗️ Construit: ${buildingId} (-${cost} pièces)`);
      await writeFile(gamiPath, newGami);
    } catch { /* */ }
  }
}

export async function upgradeBuildingInVault(
  readFile: ReadFn, writeFile: WriteFn,
  profileId: string, profileName: string,
  cellId: string, cost: number,
): Promise<void> {
  const famille = await readFile('famille.md');
  const buildingsCSV = readProfileField(famille, profileId, 'farm_buildings');
  const buildings = buildingsCSV ? parseBuildings(buildingsCSV) : [];

  const newBuildings = upgradeBuilding(buildings, cellId);

  const updated = patchProfileField(famille, profileId, 'farm_buildings', serializeBuildings(newBuildings));
  await writeFile('famille.md', updated);

  if (cost > 0) {
    const gamiPath = `gami-${profileId}.md`;
    try {
      const gami = await readFile(gamiPath);
      let newGami = updateCoins(gami, profileName, -cost);
      newGami = addGamiHistory(newGami, profileId, 'farm_upgrade', `⬆️ Amélioré (-${cost} pièces)`);
      await writeFile(gamiPath, newGami);
    } catch { /* */ }
  }
}

// ─── Wear system operations ───────────────────────────────────────────────

export async function checkWearInVault(
  readFile: ReadFn, writeFile: WriteFn,
  profileId: string,
  crops: PlantedCrop[],
  buildings: PlacedBuilding[],
  totalPlots: number,
): Promise<WearEffects> {
  const famille = await readFile('famille.md');
  const wearCSV = readProfileField(famille, profileId, 'wear_events');
  let events = parseWearEvents(wearCSV);

  // Nettoyage des anciens evenements repares
  events = cleanupOldEvents(events);

  // Verifier si nouveaux evenements d'usure (fullBuildingSince simplifie)
  const newEvents = checkWearEvents(events, crops, buildings, totalPlots, {});
  if (newEvents.length > 0) {
    events = [...events, ...newEvents];
    const updated = patchProfileField(famille, profileId, 'wear_events', serializeWearEvents(events));
    await writeFile('famille.md', updated);
  }

  return getActiveWearEffects(events);
}

export async function repairWearInVault(
  readFile: ReadFn, writeFile: WriteFn,
  profileId: string, profileName: string,
  eventId: string,
): Promise<number> {
  const famille = await readFile('famille.md');
  const wearCSV = readProfileField(famille, profileId, 'wear_events');
  const events = parseWearEvents(wearCSV);

  // Lire les coins
  const gamiPath = `gami-${profileId}.md`;
  let gami: string;
  try {
    gami = await readFile(gamiPath);
  } catch {
    throw new Error('Fichier gamification introuvable');
  }
  const coins = readCoins(gami, profileName);

  const result = repairWearEvent(events, eventId, coins);
  if (!result) throw new Error('Réparation impossible (pas assez de pièces ou événement introuvable)');

  // Ecrire les events mis a jour
  const updatedFamille = patchProfileField(famille, profileId, 'wear_events', serializeWearEvents(result.events));
  await writeFile('famille.md', updatedFamille);

  // Deduire le cout
  if (result.cost > 0) {
    let newGami = updateCoins(gami, profileName, -result.cost);
    newGami = addGamiHistory(newGami, profileId, 'wear_repair', `🔧 Réparation (-${result.cost} pièces)`);
    await writeFile(gamiPath, newGami);
  }

  return result.cost;
}
