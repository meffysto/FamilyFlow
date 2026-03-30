/**
 * building-engine.ts — Logique metier des batiments productifs
 *
 * Gere la construction, l'amelioration, la collecte et le calcul des
 * ressources en attente. Toutes les fonctions sont pures (pas de React).
 */

import {
  BUILDING_CATALOG,
  type PlacedBuilding,
  type FarmInventory,
  type BuildingTier,
} from './types';
import { type TechBonuses } from './tech-engine';

/** Nombre maximum de ressources en attente par batiment */
export const MAX_PENDING = 3;

// ── Serialisation / Parsing ─────────────────────────────────────

/** Serialiser un tableau de PlacedBuilding en CSV
 * Format: buildingId:cellId:level:lastCollectAt (separateur |)
 */
export function serializeBuildings(buildings: PlacedBuilding[]): string {
  return buildings
    .map(b => `${b.buildingId}:${b.cellId}:${b.level}:${b.lastCollectAt}`)
    .join('|');
}

/** Parser le CSV des batiments — backward-compatible avec l'ancien format string[]
 * Ancien format: "poulailler,grange" (liste d'IDs sans position)
 * Nouveau format: "poulailler:b0:1:2024-01-01T00:00:00.000Z|grange:b1:2:..."
 */
export function parseBuildings(csv: string | string[] | undefined): PlacedBuilding[] {
  if (!csv) return [];

  // Ancien format : string[] (migration)
  if (Array.isArray(csv)) {
    return csv.map((id, idx) => ({
      buildingId: id,
      cellId: `b${idx}`,
      level: 1,
      lastCollectAt: new Date(0).toISOString(),
    }));
  }

  // Verifier si c'est l'ancien format CSV simple (sans ':')
  if (!csv.includes(':')) {
    // Ancien format: "poulailler,grange"
    const ids = csv.split(',').map(s => s.trim()).filter(Boolean);
    return ids.map((id, idx) => ({
      buildingId: id,
      cellId: `b${idx}`,
      level: 1,
      lastCollectAt: new Date(0).toISOString(),
    }));
  }

  // Nouveau format
  return csv
    .split('|')
    .map(entry => {
      const parts = entry.trim().split(':');
      if (parts.length < 4) return null;
      const [buildingId, cellId, levelStr, ...restParts] = parts;
      const level = parseInt(levelStr, 10) || 1;
      const lastCollectAt = restParts.join(':'); // ISO date can contain ':'
      return { buildingId, cellId, level, lastCollectAt } as PlacedBuilding;
    })
    .filter((b): b is PlacedBuilding => b !== null && !!b.buildingId);
}

/** Serialiser l'inventaire en CSV "oeuf:N,lait:N,farine:N" */
export function serializeInventory(inventory: FarmInventory): string {
  return `oeuf:${inventory.oeuf},lait:${inventory.lait},farine:${inventory.farine}`;
}

/** Parser l'inventaire depuis CSV */
export function parseInventory(csv: string | undefined): FarmInventory {
  const inv: FarmInventory = { oeuf: 0, lait: 0, farine: 0 };
  if (!csv) return inv;
  for (const entry of csv.split(',')) {
    const [key, val] = entry.trim().split(':');
    if (key === 'oeuf' || key === 'lait' || key === 'farine') {
      inv[key] = parseInt(val, 10) || 0;
    }
  }
  return inv;
}

// ── Operations metier ────────────────────────────────────────────

/** Construire un batiment sur une cellule vide */
export function constructBuilding(
  buildings: PlacedBuilding[],
  buildingId: string,
  cellId: string,
): PlacedBuilding[] {
  // Verifier que la cellule est libre
  if (buildings.some(b => b.cellId === cellId)) {
    throw new Error(`Cellule ${cellId} deja occupee`);
  }
  // Verifier que le batiment existe
  if (!BUILDING_CATALOG.find(b => b.id === buildingId)) {
    throw new Error(`Batiment ${buildingId} introuvable dans le catalogue`);
  }
  const newBuilding: PlacedBuilding = {
    buildingId,
    cellId,
    level: 1,
    lastCollectAt: new Date().toISOString(),
  };
  return [...buildings, newBuilding];
}

/** Ameliorer un batiment au niveau suivant */
export function upgradeBuilding(
  buildings: PlacedBuilding[],
  cellId: string,
): PlacedBuilding[] {
  return buildings.map(b => {
    if (b.cellId !== cellId) return b;
    const def = BUILDING_CATALOG.find(d => d.id === b.buildingId);
    if (!def) return b;
    const maxLevel = def.tiers.length;
    if (b.level >= maxLevel) throw new Error('Niveau maximum atteint');
    return { ...b, level: b.level + 1 };
  });
}

/** Calculer le nombre de ressources en attente (clampe a MAX_PENDING ou bonus tech) */
export function getPendingResources(
  building: PlacedBuilding,
  now: Date = new Date(),
  techBonuses?: TechBonuses,
): number {
  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return 0;
  const tier = def.tiers[building.level - 1];
  if (!tier) return 0;

  const effectiveRate = tier.productionRateHours * (techBonuses?.productionIntervalMultiplier ?? 1.0);
  const effectiveMaxPending = Math.floor(MAX_PENDING * (techBonuses?.buildingCapacityMultiplier ?? 1));

  const lastCollect = new Date(building.lastCollectAt);
  const elapsedMs = now.getTime() - lastCollect.getTime();
  const rateMs = effectiveRate * 3600 * 1000;
  const produced = Math.floor(elapsedMs / rateMs);
  return Math.min(produced, effectiveMaxPending);
}

/** Minutes restantes avant la prochaine ressource produite. 0 si déjà disponible ou cap atteint. */
export function getMinutesUntilNext(
  building: PlacedBuilding,
  now: Date = new Date(),
  techBonuses?: TechBonuses,
): number {
  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return 0;
  const tier = def.tiers[building.level - 1];
  if (!tier) return 0;

  const effectiveRate = tier.productionRateHours * (techBonuses?.productionIntervalMultiplier ?? 1.0);
  const effectiveMaxPending = Math.floor(MAX_PENDING * (techBonuses?.buildingCapacityMultiplier ?? 1));

  const lastCollect = new Date(building.lastCollectAt);
  const elapsedMs = now.getTime() - lastCollect.getTime();
  const rateMs = effectiveRate * 3600 * 1000;
  const produced = Math.floor(elapsedMs / rateMs);

  if (produced >= effectiveMaxPending) return 0; // cap atteint
  const nextAt = (produced + 1) * rateMs;
  const remainingMs = nextAt - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 60000));
}

/** Collecter les ressources disponibles d'un batiment */
export function collectBuilding(
  buildings: PlacedBuilding[],
  inventory: FarmInventory,
  cellId: string,
  now: Date = new Date(),
  techBonuses?: TechBonuses,
): { buildings: PlacedBuilding[]; inventory: FarmInventory; collected: number } {
  const building = buildings.find(b => b.cellId === cellId);
  if (!building) return { buildings, inventory, collected: 0 };

  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return { buildings, inventory, collected: 0 };

  const pending = getPendingResources(building, now, techBonuses);
  if (pending === 0) return { buildings, inventory, collected: 0 };

  // Mettre a jour lastCollectAt — avancer au moment de la derniere unite produite
  // Si le cap a ete atteint, repartir de maintenant pour eviter l'accumulation infinie
  const tier = def.tiers[building.level - 1];
  const effectiveRate = tier.productionRateHours * (techBonuses?.productionIntervalMultiplier ?? 1.0);
  const effectiveMaxPending = Math.floor(MAX_PENDING * (techBonuses?.buildingCapacityMultiplier ?? 1));
  const rateMs = effectiveRate * 3600 * 1000;
  const lastCollect = new Date(building.lastCollectAt);
  const elapsedMs = now.getTime() - lastCollect.getTime();
  const totalProduced = Math.floor(elapsedMs / rateMs);
  // Si on a atteint le cap, repartir de maintenant (pas d'accumulation retro)
  const newLastCollect = totalProduced >= effectiveMaxPending
    ? now
    : new Date(lastCollect.getTime() + pending * rateMs);

  const updatedBuildings = buildings.map(b =>
    b.cellId === cellId ? { ...b, lastCollectAt: newLastCollect.toISOString() } : b,
  );

  const updatedInventory = { ...inventory };
  updatedInventory[def.resourceType] = (updatedInventory[def.resourceType] ?? 0) + pending;

  return { buildings: updatedBuildings, inventory: updatedInventory, collected: pending };
}

/** Obtenir le cout d'amelioration vers le prochain niveau */
export function getUpgradeCost(building: PlacedBuilding): number {
  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return 0;
  const nextTier = def.tiers[building.level]; // index = level (0-based), level est 1-based
  return nextTier?.upgradeCoins ?? 0;
}

/** Verifier si un batiment peut etre ameliore */
export function canUpgrade(building: PlacedBuilding): boolean {
  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return false;
  return building.level < def.tiers.length;
}

/** Obtenir le tier actuel d'un batiment */
export function getCurrentTier(building: PlacedBuilding): BuildingTier | null {
  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return null;
  return def.tiers[building.level - 1] ?? null;
}
