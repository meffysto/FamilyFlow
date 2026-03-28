// ─────────────────────────────────────────────
// Ferme — Logique de jeu (planter, pousser, recolter)
// ─────────────────────────────────────────────

import { type TreeStage, type PlantedCrop, type CropDefinition, CROP_CATALOG, PLOTS_BY_TREE_STAGE } from './types';

const MAX_CROP_STAGE = 4;

/** Nombre de parcelles deblocables pour un stade d'arbre */
export function getUnlockedPlotCount(treeStage: TreeStage): number {
  return PLOTS_BY_TREE_STAGE[treeStage] ?? 0;
}

/** Planter une culture sur une parcelle vide */
export function plantCrop(
  crops: PlantedCrop[],
  plotIndex: number,
  cropId: string,
): PlantedCrop[] {
  // Verifier que la parcelle est vide
  if (crops.some(c => c.plotIndex === plotIndex)) return crops;
  // Verifier que la culture existe
  if (!CROP_CATALOG.find(c => c.id === cropId)) return crops;

  return [
    ...crops,
    {
      cropId,
      plotIndex,
      currentStage: 0,
      tasksCompleted: 0,
      plantedAt: new Date().toISOString().slice(0, 10),
    },
  ];
}

/**
 * Avancer les cultures apres une tache completee.
 * Regle FIFO : la culture la plus ancienne non-mature recoit le point.
 * Retourne le nouveau state + les cultures devenues matures.
 */
export function advanceFarmCrops(
  crops: PlantedCrop[],
): { crops: PlantedCrop[]; matured: PlantedCrop[] } {
  if (crops.length === 0) return { crops, matured: [] };

  // Trier par date de plantation (FIFO)
  const sorted = [...crops].sort(
    (a, b) => a.plantedAt.localeCompare(b.plantedAt) || a.plotIndex - b.plotIndex,
  );

  // Trouver la premiere culture non-mature
  const targetIdx = sorted.findIndex(c => c.currentStage < MAX_CROP_STAGE);
  if (targetIdx < 0) return { crops, matured: [] }; // toutes matures

  const target = { ...sorted[targetIdx] };
  const cropDef = CROP_CATALOG.find(c => c.id === target.cropId);
  if (!cropDef) return { crops, matured: [] };

  target.tasksCompleted += 1;
  const matured: PlantedCrop[] = [];

  // Avancer d'un stade si assez de taches
  if (target.tasksCompleted >= cropDef.tasksPerStage) {
    target.currentStage += 1;
    target.tasksCompleted = 0;
    if (target.currentStage >= MAX_CROP_STAGE) {
      matured.push(target);
    }
  }

  sorted[targetIdx] = target;
  return { crops: sorted, matured };
}

/**
 * Recolter une culture mature.
 * Retourne les cultures mises a jour (sans la recoltee) + la recompense.
 */
export function harvestCrop(
  crops: PlantedCrop[],
  plotIndex: number,
): { crops: PlantedCrop[]; reward: number } {
  const crop = crops.find(c => c.plotIndex === plotIndex);
  if (!crop || crop.currentStage < MAX_CROP_STAGE) {
    return { crops, reward: 0 };
  }

  const cropDef = CROP_CATALOG.find(c => c.id === crop.cropId);
  const reward = cropDef?.harvestReward ?? 0;

  return {
    crops: crops.filter(c => c.plotIndex !== plotIndex),
    reward,
  };
}

/** Serialiser les cultures en CSV compact pour le markdown */
export function serializeCrops(crops: PlantedCrop[]): string {
  return crops
    .map(c => `${c.plotIndex}:${c.cropId}:${c.currentStage}:${c.tasksCompleted}:${c.plantedAt}`)
    .join(',');
}

/** Deserialiser les cultures depuis le CSV markdown */
export function parseCrops(csv: string): PlantedCrop[] {
  if (!csv || csv.trim() === '') return [];
  return csv.split(',').map(entry => {
    const [plotIndex, cropId, currentStage, tasksCompleted, plantedAt] = entry.split(':');
    return {
      plotIndex: parseInt(plotIndex, 10),
      cropId,
      currentStage: parseInt(currentStage, 10),
      tasksCompleted: parseInt(tasksCompleted, 10),
      plantedAt: plantedAt || new Date().toISOString().slice(0, 10),
    };
  }).filter(c => !isNaN(c.plotIndex) && c.cropId);
}
