// ─────────────────────────────────────────────
// Ferme — Logique batiments productifs (construire, ameliorer, collecter)
// ─────────────────────────────────────────────

import { differenceInHours } from 'date-fns';
import { type PlacedBuilding, type FarmInventory, type ResourceType, BUILDING_CATALOG } from './types';

export const MAX_PENDING = 3;

// ── Operations batiment ──

/**
 * Construire un nouveau batiment dans une cellule libre.
 * Retourne le tableau inchange si la cellule est deja occupee ou si le buildingId est inconnu.
 */
export function constructBuilding(
  buildings: PlacedBuilding[],
  buildingId: string,
  cellId: string,
): PlacedBuilding[] {
  if (buildings.some(b => b.cellId === cellId)) return buildings;
  if (!BUILDING_CATALOG.find(b => b.id === buildingId)) return buildings;
  return [...buildings, {
    buildingId,
    cellId,
    level: 1,
    lastCollectAt: new Date().toISOString().slice(0, 16),
  }];
}

/**
 * Ameliorer un batiment au prochain niveau.
 * Retourne le tableau inchange si le batiment est deja au niveau max.
 */
export function upgradeBuilding(
  buildings: PlacedBuilding[],
  cellId: string,
): PlacedBuilding[] {
  return buildings.map(b => {
    if (b.cellId !== cellId) return b;
    const def = BUILDING_CATALOG.find(d => d.id === b.buildingId);
    if (!def || b.level >= def.tiers.length) return b;
    return { ...b, level: b.level + 1 };
  });
}

/**
 * Calculer le nombre de ressources en attente de collecte.
 * Plafonne a MAX_PENDING (3) pour eviter l'accumulation infinie.
 */
export function getPendingResources(
  building: PlacedBuilding,
  now: Date = new Date(),
): number {
  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return 0;
  const tier = def.tiers[building.level - 1];
  if (!tier) return 0;

  const lastCollect = building.lastCollectAt
    ? new Date(building.lastCollectAt.includes('T') ? building.lastCollectAt : `${building.lastCollectAt}T00:00`)
    : new Date(0);

  const hoursElapsed = differenceInHours(now, lastCollect);
  const units = Math.floor(hoursElapsed / tier.productionRateHours);
  return Math.min(units, MAX_PENDING);
}

/**
 * Collecter les ressources d'un batiment.
 * Met a jour lastCollectAt et incremente l'inventaire.
 * Retourne { buildings, inventory, collected } avec collected = 0 si rien a collecter.
 */
export function collectBuilding(
  buildings: PlacedBuilding[],
  inventory: FarmInventory,
  cellId: string,
  now: Date = new Date(),
): { buildings: PlacedBuilding[]; inventory: FarmInventory; collected: number } {
  const building = buildings.find(b => b.cellId === cellId);
  if (!building) return { buildings, inventory, collected: 0 };

  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return { buildings, inventory, collected: 0 };

  const pending = getPendingResources(building, now);
  if (pending === 0) return { buildings, inventory, collected: 0 };

  const newInventory = { ...inventory };
  newInventory[def.resourceType] = (newInventory[def.resourceType] ?? 0) + pending;

  const newBuildings = buildings.map(b =>
    b.cellId === cellId
      ? { ...b, lastCollectAt: now.toISOString().slice(0, 16) }
      : b
  );

  return { buildings: newBuildings, inventory: newInventory, collected: pending };
}

/**
 * Obtenir le cout de la prochaine amelioration.
 * Retourne 0 si le batiment est au niveau max ou inconnu.
 */
export function getUpgradeCost(building: PlacedBuilding): number {
  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return 0;
  // level est 1-indexed, tiers est 0-indexed — tier[level] est le prochain tier
  const nextTier = def.tiers[building.level];
  return nextTier?.upgradeCoins ?? 0;
}

/**
 * Verifier si un batiment peut etre ameliore.
 */
export function canUpgrade(building: PlacedBuilding): boolean {
  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return false;
  return building.level < def.tiers.length;
}

// ── Serialisation (pattern farm-engine) ──

/**
 * Serialiser les batiments en CSV pour famille.md.
 * Format: "buildingId:cellId:level:lastCollectAt,..."
 */
export function serializeBuildings(buildings: PlacedBuilding[]): string {
  if (buildings.length === 0) return '';
  return buildings
    .map(b => `${b.buildingId}:${b.cellId}:${b.level}:${b.lastCollectAt}`)
    .join(',');
}

/**
 * Parser les batiments depuis famille.md.
 * Gere la migration backward-compatible depuis l'ancien format (string seul).
 *
 * Ancien format: "poulailler,grange" (IDs separes par virgule)
 * Nouveau format: "poulailler:b0:1:2026-03-28T10:00,grange:b1:2:2026-03-28T12:00"
 */
export function parseBuildings(csv: string): PlacedBuilding[] {
  if (!csv || csv.trim() === '') return [];
  const LEGACY_CELL_MAP: Record<string, string> = { poulailler: 'b0', grange: 'b1' };

  return csv.split(',').map(entry => {
    const parts = entry.trim().split(':');

    // Ancien format: "poulailler" (ID seul) — migration implicite vers b0/b1
    if (parts.length === 1) {
      return {
        buildingId: parts[0].trim(),
        cellId: LEGACY_CELL_MAP[parts[0].trim()] ?? 'b0',
        level: 1,
        lastCollectAt: new Date().toISOString().slice(0, 16),
      };
    }

    // Nouveau format: "poulailler:b0:1:2026-03-28T10:00"
    const [buildingId, cellId, levelStr, ...dateParts] = parts;
    return {
      buildingId: buildingId.trim(),
      cellId: cellId.trim(),
      level: Math.max(1, Math.min(3, parseInt(levelStr, 10) || 1)),
      lastCollectAt: dateParts.join(':').trim() || new Date().toISOString().slice(0, 16),
    };
  }).filter(b => b.buildingId && b.cellId);
}

/**
 * Serialiser l'inventaire en CSV pour famille.md.
 * Format: "oeuf:2,lait:0,farine:1"
 */
export function serializeInventory(inv: FarmInventory): string {
  return `oeuf:${inv.oeuf ?? 0},lait:${inv.lait ?? 0},farine:${inv.farine ?? 0}`;
}

/**
 * Parser l'inventaire depuis famille.md.
 * Format: "oeuf:2,lait:0,farine:1"
 */
export function parseInventory(csv: string): FarmInventory {
  const inv: FarmInventory = { oeuf: 0, lait: 0, farine: 0 };
  if (!csv || csv.trim() === '') return inv;
  csv.split(',').forEach(pair => {
    const [key, val] = pair.split(':');
    const k = key?.trim() as ResourceType;
    if (k in inv) inv[k] = parseInt(val?.trim() ?? '0', 10) || 0;
  });
  return inv;
}
