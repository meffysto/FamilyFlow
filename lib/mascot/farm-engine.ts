// ─────────────────────────────────────────────
// Ferme — Logique de jeu (planter, pousser, recolter)
// ─────────────────────────────────────────────

import { type TreeStage, type PlantedCrop, type CropDefinition, type FarmCropModifiers, CROP_CATALOG, PLOTS_BY_TREE_STAGE } from './types';
import { getCurrentSeason, type Season } from './seasons';
import { type TechBonuses } from './tech-engine';
import { type WearEffects } from './wear-engine';

export const MAX_CROP_STAGE = 4;

// ─── Amélioration des parcelles ──────────────────────────────────────────────

export const MAX_PLOT_LEVEL = 5;

/** Coût en feuilles pour upgrader une parcelle au niveau suivant (index = niveau cible) */
export const PLOT_UPGRADE_COSTS: Record<number, number> = {
  2: 1000,
  3: 3000,
  4: 8000,
  5: 20000,
};

/** Bonus par niveau de parcelle */
export interface PlotLevelBonus {
  tasksPerStageReduction: number;  // réduction tâches par stade
  goldenChanceMultiplier: number;  // multiplicateur de chance dorée
  doubleHarvest: boolean;          // double récolte garantie
}

export const PLOT_LEVEL_BONUSES: Record<number, PlotLevelBonus> = {
  1: { tasksPerStageReduction: 0, goldenChanceMultiplier: 1, doubleHarvest: false },
  2: { tasksPerStageReduction: 1, goldenChanceMultiplier: 1, doubleHarvest: false },
  3: { tasksPerStageReduction: 1, goldenChanceMultiplier: 2, doubleHarvest: false },
  4: { tasksPerStageReduction: 2, goldenChanceMultiplier: 3, doubleHarvest: false },
  5: { tasksPerStageReduction: 2, goldenChanceMultiplier: 3, doubleHarvest: true },
};

/** Retourne le niveau d'une parcelle (défaut 1) */
export function getPlotLevel(plotLevels: number[] | undefined, plotIndex: number): number {
  return plotLevels?.[plotIndex] ?? 1;
}

/** Retourne le coût pour upgrader une parcelle, ou null si déjà max */
export function getPlotUpgradeCost(currentLevel: number): number | null {
  if (currentLevel >= MAX_PLOT_LEVEL) return null;
  return PLOT_UPGRADE_COSTS[currentLevel + 1] ?? null;
}

/** Upgrade une parcelle et retourne le nouveau tableau de niveaux */
export function upgradePlot(plotLevels: number[] | undefined, plotIndex: number, maxPlots: number): number[] {
  const levels = plotLevels ? [...plotLevels] : Array(maxPlots).fill(1);
  // Étendre si nécessaire
  while (levels.length <= plotIndex) levels.push(1);
  const current = levels[plotIndex] ?? 1;
  if (current >= MAX_PLOT_LEVEL) return levels;
  levels[plotIndex] = current + 1;
  return levels;
}

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
  hiver:     ['pumpkin', 'cabbage', 'beetroot', 'potato'],   // recoltes de conservation
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
  wearEffects?: WearEffects,
): PlantedCrop[] {
  // Verifier que la parcelle n'est pas bloquee par une cloture cassee
  if (wearEffects?.blockedPlots.includes(plotIndex)) {
    throw new Error('Parcelle bloquée par une clôture cassée');
  }
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
 * Effet quête actif sur la croissance des cultures.
 * - rain_bonus : toutes les cultures avancent à vitesse pleine (pas de penalite FIFO)
 * - golden_rain : toutes les cultures avancent à 2× vitesse pleine
 */
export type QuestFarmEffect = 'rain_bonus' | 'golden_rain';

/**
 * Avancer les cultures apres une tache completee.
 * Systeme hybride FIFO : le plot principal (le plus ancien non-mature) avance a vitesse pleine,
 * les autres plots non-matures avancent a demi-vitesse (seasonBonus * 0.5).
 * Retourne le nouveau state + les cultures devenues matures.
 * Si techBonuses est fourni, applique la reduction de tasksPerStage.
 * Si questEffect est fourni, applique le bonus de quete active.
 */
export function advanceFarmCrops(
  crops: PlantedCrop[],
  techBonuses?: TechBonuses,
  questEffect?: QuestFarmEffect,
  plotLevels?: number[],
): { crops: PlantedCrop[]; matured: PlantedCrop[] } {
  if (crops.length === 0) return { crops, matured: [] };

  // Trier par date de plantation (FIFO)
  const sorted = [...crops].sort(
    (a, b) => a.plantedAt.localeCompare(b.plantedAt) || a.plotIndex - b.plotIndex,
  );

  // Trouver l'index du plot principal (premier non-mature)
  const targetIdx = sorted.findIndex(c => c.currentStage < MAX_CROP_STAGE);
  if (targetIdx < 0) return { crops, matured: [] }; // toutes matures

  const matured: PlantedCrop[] = [];

  // Avancer TOUS les crops non-matures
  for (let i = 0; i < sorted.length; i++) {
    const crop = sorted[i];
    if (crop.currentStage >= MAX_CROP_STAGE) continue; // deja mature

    const cropDef = CROP_CATALOG.find(c => c.id === crop.cropId);
    if (!cropDef) continue;

    const updated = { ...crop };

    // Bonus saisonnier base sur la culture courante
    const seasonBonus = hasCropSeasonalBonus(updated.cropId) ? 2 : 1;

    // Effet quête : rain_bonus = tous à vitesse pleine, golden_rain = tous à 2x
    const questMultiplier = questEffect === 'golden_rain' ? 2 : 1;
    const isQuestBoost = questEffect === 'rain_bonus' || questEffect === 'golden_rain';
    // Plot principal : vitesse pleine ; autres plots : demi-vitesse (sauf si quête active)
    const increment = isQuestBoost
      ? seasonBonus * questMultiplier
      : (i === targetIdx ? seasonBonus : seasonBonus * 0.5);
    updated.tasksCompleted += increment;

    // Avancer d'un stade si assez de taches (bonus tech + bonus parcelle reduisent le seuil)
    const plotBonus = PLOT_LEVEL_BONUSES[getPlotLevel(plotLevels, crop.plotIndex)]?.tasksPerStageReduction ?? 0;
    const effectiveTasksPerStage = Math.max(1, cropDef.tasksPerStage - (techBonuses?.tasksPerStageReduction ?? 0) - plotBonus);
    if (updated.tasksCompleted >= effectiveTasksPerStage) {
      updated.currentStage += 1;
      updated.tasksCompleted = 0;
      if (updated.currentStage >= MAX_CROP_STAGE) {
        matured.push(updated);
      }
    }

    sorted[i] = updated;
  }

  return { crops: sorted, matured };
}

/**
 * Retourne le plotIndex du crop le plus ancien non-mature (plot principal FIFO),
 * ou null si tous les crops sont matures ou si la liste est vide.
 */
export function getMainPlotIndex(crops: PlantedCrop[]): number | null {
  if (crops.length === 0) return null;
  const sorted = [...crops].sort(
    (a, b) => a.plantedAt.localeCompare(b.plantedAt) || a.plotIndex - b.plotIndex,
  );
  const target = sorted.find(c => c.currentStage < 4);
  return target ? target.plotIndex : null;
}

/**
 * Recolter une culture mature.
 * Retourne les cultures mises a jour (sans la recoltee) + l'id de la culture recoltee.
 * Le reward n'est plus calcule ici — c'est le caller qui decide (inventaire ou vente directe).
 */
export function harvestCrop(
  crops: PlantedCrop[],
  plotIndex: number,
): { crops: PlantedCrop[]; harvestedCropId: string | null; isGolden: boolean } {
  const crop = crops.find(c => c.plotIndex === plotIndex);
  if (!crop || crop.currentStage < MAX_CROP_STAGE) {
    return { crops, harvestedCropId: null, isGolden: false };
  }

  return {
    crops: crops.filter(c => c.plotIndex !== plotIndex),
    harvestedCropId: crop.cropId,
    isGolden: crop.isGolden ?? false,
  };
}

// Phase 38 (MOD-01) : encodage modifiers JSON avec escape des séparateurs CSV
// `,` → `|`   (séparateur entre plants)
// `:` → `§`   (séparateur entre champs d'un plant)
// Résultat lisible à l'œil dans Obsidian. Voir 38-RESEARCH.md §1.
export function encodeModifiers(modifiers: FarmCropModifiers | undefined): string {
  if (!modifiers || Object.keys(modifiers).length === 0) return '';
  return JSON.stringify(modifiers).replace(/,/g, '|').replace(/:/g, '§');
}

export function decodeModifiers(raw: string | undefined): FarmCropModifiers | undefined {
  if (!raw || raw.trim() === '') return undefined;
  try {
    const restored = raw.replace(/§/g, ':').replace(/\|/g, ',');
    const parsed = JSON.parse(restored) as FarmCropModifiers;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/** Serialiser les cultures en CSV compact pour le markdown */
export function serializeCrops(crops: PlantedCrop[]): string {
  return crops
    .map(c => {
      const base = `${c.plotIndex}:${c.cropId}:${c.currentStage}:${c.tasksCompleted}:${c.plantedAt}:${c.isGolden ? '1' : ''}`;
      const modStr = encodeModifiers(c.modifiers);
      return modStr ? `${base}:${modStr}` : base;
    })
    .join(',');
}

/** Deserialiser les cultures depuis le CSV markdown */
export function parseCrops(csv: string): PlantedCrop[] {
  if (!csv || csv.trim() === '') return [];
  return csv.split(',').map(entry => {
    const parts = entry.split(':');
    const [plotIndex, cropId, currentStage, tasksCompleted, plantedAt, goldenFlag, modifiersRaw] = parts;
    const modifiers = parts.length >= 7 ? decodeModifiers(modifiersRaw) : undefined;
    const crop: PlantedCrop = {
      plotIndex: parseInt(plotIndex, 10),
      cropId,
      currentStage: parseInt(currentStage, 10),
      tasksCompleted: parseFloat(tasksCompleted),
      plantedAt: plantedAt || new Date().toISOString().slice(0, 10),
      isGolden: goldenFlag === '1',
    };
    if (modifiers) crop.modifiers = modifiers;
    return crop;
  }).filter(c => !isNaN(c.plotIndex) && c.cropId);
}

/** Calculer la recompense d'une recolte (prix brut, pas de multiplicateur tech) */
export function getEffectiveHarvestReward(cropId: string): number {
  const cropDef = CROP_CATALOG.find(c => c.id === cropId);
  if (!cropDef) return 0;
  return cropDef.harvestReward;
}

/** Types d'evenements aleatoires a la recolte */
export type HarvestEventType = 'insectes' | 'pluie_doree' | 'mutation_rare';

export interface HarvestEvent {
  type: HarvestEventType;
  modifier: number; // multiplicateur sur la quantite recoltee (0 = perte, 3 = triple)
  labelKey: string; // cle i18n pour le message
  emoji: string;
}

export const HARVEST_EVENTS: HarvestEvent[] = [
  { type: 'insectes', modifier: 0, labelKey: 'farm.event.insectes', emoji: '🐛' },
  { type: 'pluie_doree', modifier: 3, labelKey: 'farm.event.pluie_doree', emoji: '🌧️' },
  { type: 'mutation_rare', modifier: 2, labelKey: 'farm.event.mutation_rare', emoji: '✨' },
];

/** Probabilité globale de déclenchement d'un événement à la récolte */
export const HARVEST_EVENT_CHANCE = 0.05;

/** Pondérations des types d'événements (somme = 1.0) */
export const HARVEST_EVENT_WEIGHTS: Readonly<Record<HarvestEventType, number>> = {
  insectes: 0.4,
  pluie_doree: 0.35,
  mutation_rare: 0.25,
};

/** Tente de declencher un evenement aleatoire (5% de chance) */
export function rollHarvestEvent(): HarvestEvent | null {
  if (Math.random() >= HARVEST_EVENT_CHANCE) return null;
  // Ponderation : insectes 40%, pluie doree 35%, mutation 25%
  const roll = Math.random();
  if (roll < HARVEST_EVENT_WEIGHTS.insectes) return HARVEST_EVENTS[0];
  if (roll < HARVEST_EVENT_WEIGHTS.insectes + HARVEST_EVENT_WEIGHTS.pluie_doree) return HARVEST_EVENTS[1];
  return HARVEST_EVENTS[2];
}

// ─────────────────────────────────────────────
// Graines rares — Systeme de drop a la recolte
// ─────────────────────────────────────────────

/** Resultat d'un drop de graine rare */
export interface RareSeedDrop {
  seedId: string;   // id de la culture rare obtenue
  emoji: string;    // emoji pour l'affichage
  labelKey: string; // cle i18n
}

/** Regle de drop : quelles recoltes peuvent donner quelle graine rare */
interface SeedDropRule {
  sourceCropIds: string[] | '*';  // '*' = n'importe quelle culture
  seedId: string;
  chance: number;  // probabilite (0.04 = 4%)
}

/** Table de drop des graines rares */
export const RARE_SEED_DROP_RULES: SeedDropRule[] = [
  // Recolte arbuste+ → orchidee (4%)
  { sourceCropIds: ['tomato', 'cabbage', 'cucumber', 'corn', 'strawberry', 'pumpkin', 'sunflower'], seedId: 'orchidee', chance: 0.04 },
  // Recolte arbre+ → rose doree (4%)
  { sourceCropIds: ['corn', 'strawberry', 'pumpkin'], seedId: 'rose_doree', chance: 0.04 },
  // Recolte citrouille/tournesol → truffe (4%)
  { sourceCropIds: ['pumpkin', 'sunflower'], seedId: 'truffe', chance: 0.04 },
  // Recolte n'importe quoi → fruit du dragon (2%)
  { sourceCropIds: '*', seedId: 'fruit_dragon', chance: 0.02 },
];

/** Tente d'obtenir une graine rare apres une recolte.
 * Parcourt les regles dans l'ordre et retourne le premier drop reussi (ou null).
 */
export function rollSeedDrop(harvestedCropId: string): RareSeedDrop | null {
  for (const rule of RARE_SEED_DROP_RULES) {
    // Verifier si la culture source est eligible
    if (rule.sourceCropIds !== '*' && !rule.sourceCropIds.includes(harvestedCropId)) continue;
    // Ne pas dropper une graine rare a partir d'une culture rare elle-meme
    const harvestedDef = CROP_CATALOG.find(c => c.id === harvestedCropId);
    if (harvestedDef?.dropOnly) continue;
    // Lancer le de
    if (Math.random() < rule.chance) {
      const seedDef = CROP_CATALOG.find(c => c.id === rule.seedId);
      if (!seedDef) continue;
      return {
        seedId: rule.seedId,
        emoji: seedDef.emoji,
        labelKey: seedDef.labelKey,
      };
    }
  }
  return null;
}

/** Retourne les cultures disponibles selon le stade d'arbre et les techs debloquees */
export function getAvailableCrops(treeStage: TreeStage, unlockedTechs: string[]): CropDefinition[] {
  const stageOrder: TreeStage[] = ['graine', 'pousse', 'arbuste', 'arbre', 'majestueux', 'legendaire'];
  const currentIdx = stageOrder.indexOf(treeStage);

  return CROP_CATALOG.filter(crop => {
    // Exclure les cultures dropOnly (graines rares) — elles ne sont pas achetables
    if (crop.dropOnly) return false;

    // Verifier le stade d'arbre minimum
    const requiredIdx = stageOrder.indexOf(crop.minTreeStage);
    if (requiredIdx > currentIdx) return false;

    // Verifier la tech requise si presente
    if (crop.techRequired && !unlockedTechs.includes(crop.techRequired)) return false;

    return true;
  });
}
