// ─────────────────────────────────────────────
// Ferme — Logique de jeu (planter, pousser, recolter)
// ─────────────────────────────────────────────

import { type TreeStage, type PlantedCrop, type CropDefinition, CROP_CATALOG, PLOTS_BY_TREE_STAGE } from './types';
import { getCurrentSeason, type Season } from './seasons';

const MAX_CROP_STAGE = 4;

/** Probabilite de mutation doree a la plantation */
export const GOLDEN_CROP_CHANCE = 0.03;

/** Multiplicateur de recompense pour les cultures dorees */
export const GOLDEN_HARVEST_MULTIPLIER = 5;

/** Bonus saisonnier : certaines cultures poussent plus vite selon la saison.
 * Retourne le nombre de points bonus (0 = pas de bonus, 1 = double avancement).
 */
export const SEASONAL_CROP_BONUS: Record<Season, string[]> = {
  printemps: ['carrot', 'potato', 'cabbage', 'beetroot'],  // legumes de printemps
  ete:       ['tomato', 'cucumber', 'corn', 'strawberry'],  // fruits d'ete
  automne:   ['pumpkin', 'wheat', 'beetroot'],               // recoltes d'automne
  hiver:     [],                                              // pas de bonus en hiver
};

/** Verifie si une culture a un bonus saisonnier actif */
export function hasCropSeasonalBonus(cropId: string): boolean {
  const season = getCurrentSeason();
  return SEASONAL_CROP_BONUS[season]?.includes(cropId) ?? false;
}

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
      isGolden: Math.random() < GOLDEN_CROP_CHANCE,
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

  // Bonus saisonnier : +2 au lieu de +1 si la culture est en saison
  const seasonBonus = hasCropSeasonalBonus(target.cropId) ? 2 : 1;
  target.tasksCompleted += seasonBonus;
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
  const baseReward = cropDef?.harvestReward ?? 0;
  const reward = crop.isGolden ? baseReward * GOLDEN_HARVEST_MULTIPLIER : baseReward;

  return {
    crops: crops.filter(c => c.plotIndex !== plotIndex),
    reward,
  };
}

/** Serialiser les cultures en CSV compact pour le markdown */
export function serializeCrops(crops: PlantedCrop[]): string {
  return crops
    .map(c => `${c.plotIndex}:${c.cropId}:${c.currentStage}:${c.tasksCompleted}:${c.plantedAt}:${c.isGolden ? '1' : ''}`)
    .join(',');
}

/** Deserialiser les cultures depuis le CSV markdown */
export function parseCrops(csv: string): PlantedCrop[] {
  if (!csv || csv.trim() === '') return [];
  return csv.split(',').map(entry => {
    const [plotIndex, cropId, currentStage, tasksCompleted, plantedAt, goldenFlag] = entry.split(':');
    return {
      plotIndex: parseInt(plotIndex, 10),
      cropId,
      currentStage: parseInt(currentStage, 10),
      tasksCompleted: parseInt(tasksCompleted, 10),
      plantedAt: plantedAt || new Date().toISOString().slice(0, 10),
      isGolden: goldenFlag === '1',
    };
  }).filter(c => !isNaN(c.plotIndex) && c.cropId);
}
