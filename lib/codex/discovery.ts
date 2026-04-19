// lib/codex/discovery.ts — Calcul lazy des entrées codex découvertes (Phase 17, per D-06)
//
// Appelé à l'ouverture de FarmCodexModal pour déterminer quelles entrées dropOnly
// doivent s'afficher en silhouette. AUCUN nouveau champ persisté dans farm-{profileId}.md
// (D-06) : on dérive l'état à la volée depuis farmInventory / harvestInventory / farmAnimals
// / farmCrops / completedSagas. Trade-off accepté (D-07) : consommer une orchidée peut
// la re-silhouetter tant que le cache local n'est pas recomputé.

/**
 * Shape minimale du profil dont on a besoin pour calculer la découverte codex.
 * On ne prend pas `Profile` complet pour garder cette fonction pure et testable.
 */
export interface DiscoverySource {
  farmInventory?: Record<string, number> | null;
  harvestInventory?: Record<string, number> | null;
  farmCrops?: Array<{ cropId?: string } | string> | null;
  farmAnimals?: Array<{ animalId?: string } | string> | null;
  farmBuildings?: Array<{ buildingId?: string } | string> | null;
  completedSagas?: string[] | null;
  wagerMarathonWins?: number;              // total paris Sporée gagnés (vanité, Phase 41 SPOR-10)
}

/**
 * Retourne l'ensemble des sourceId découverts par le profil.
 * Compare contre `entry.sourceId` dans FarmCodexModal :
 *   const isDiscovered = !entry.dropOnly || discoveredIds.has(entry.sourceId);
 */
export function computeDiscoveredCodexIds(source: DiscoverySource | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (!source) return ids;

  // 1. farmInventory (resources : oeuf, lait, farine, miel)
  if (source.farmInventory) {
    for (const [key, value] of Object.entries(source.farmInventory)) {
      if (typeof value === 'number' && value > 0) ids.add(key);
    }
  }

  // 2. harvestInventory (crops récoltés : cropId → count)
  if (source.harvestInventory) {
    for (const [cropId, count] of Object.entries(source.harvestInventory)) {
      if (typeof count === 'number' && count > 0) ids.add(cropId);
    }
  }

  // 3. farmCrops (crops actuellement plantés)
  if (Array.isArray(source.farmCrops)) {
    for (const crop of source.farmCrops) {
      if (typeof crop === 'string') ids.add(crop);
      else if (crop && typeof crop.cropId === 'string') ids.add(crop.cropId);
    }
  }

  // 4. farmAnimals (animaux possédés)
  if (Array.isArray(source.farmAnimals)) {
    for (const animal of source.farmAnimals) {
      if (typeof animal === 'string') ids.add(animal);
      else if (animal && typeof animal.animalId === 'string') ids.add(animal.animalId);
    }
  }

  // 5. farmBuildings (bâtiments construits)
  if (Array.isArray(source.farmBuildings)) {
    for (const building of source.farmBuildings) {
      if (typeof building === 'string') ids.add(building);
      else if (building && typeof building.buildingId === 'string') ids.add(building.buildingId);
    }
  }

  // 6. completedSagas (sagas terminées → débloquent sagaExclusive animals)
  if (Array.isArray(source.completedSagas)) {
    for (const sagaId of source.completedSagas) {
      if (typeof sagaId === 'string') ids.add(sagaId);
    }
  }

  return ids;
}
