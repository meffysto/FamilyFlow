// ─────────────────────────────────────────────
// Mascotte Arbre — Engine (calculs stade, évolution)
// ─────────────────────────────────────────────

import { TREE_STAGES, type TreeStage, type TreeStageInfo, type EvolutionEvent } from './types';

/**
 * Retourne le stade de l'arbre pour un niveau donné.
 */
export function getTreeStage(level: number): TreeStage {
  for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
    if (level >= TREE_STAGES[i].minLevel) return TREE_STAGES[i].stage;
  }
  return 'graine';
}

/**
 * Retourne les infos complètes du stade pour un niveau donné.
 */
export function getTreeStageInfo(level: number): TreeStageInfo {
  for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
    if (level >= TREE_STAGES[i].minLevel) return TREE_STAGES[i];
  }
  return TREE_STAGES[0];
}

/**
 * Retourne l'index du stade (0-5) pour un niveau donné.
 */
export function getStageIndex(level: number): number {
  for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
    if (level >= TREE_STAGES[i].minLevel) return i;
  }
  return 0;
}

/**
 * Retourne la progression (0.0–1.0) au sein du stade actuel.
 * Utile pour interpoler la taille/détails de l'arbre entre deux stades.
 */
export function getStageProgress(level: number): number {
  const info = getTreeStageInfo(level);
  const range = info.maxLevel - info.minLevel;
  if (range <= 0) return 1;
  return Math.min(1, (level - info.minLevel) / range);
}

/**
 * Détecte si un changement de niveau provoque une évolution de stade.
 */
export function detectEvolution(oldLevel: number, newLevel: number): EvolutionEvent {
  const oldStage = getTreeStage(oldLevel);
  const newStage = getTreeStage(newLevel);

  if (oldStage !== newStage) {
    return {
      evolved: true,
      fromStage: oldStage,
      toStage: newStage,
      newLevel,
    };
  }

  return { evolved: false, newLevel };
}

/**
 * Retourne le niveau nécessaire pour la prochaine évolution.
 * Retourne null si déjà au stade max.
 */
export function getNextEvolutionLevel(level: number): number | null {
  const idx = getStageIndex(level);
  if (idx >= TREE_STAGES.length - 1) return null;
  return TREE_STAGES[idx + 1].minLevel;
}

/**
 * Retourne le nombre de niveaux restants avant la prochaine évolution.
 */
export function levelsUntilEvolution(level: number): number | null {
  const next = getNextEvolutionLevel(level);
  if (next === null) return null;
  return next - level;
}

/**
 * Retourne la taille normalisée de l'arbre (0.0–1.0) basée sur le stade + progression.
 * Utile pour le scaling du rendu SVG.
 */
export function getTreeScale(level: number): number {
  const idx = getStageIndex(level);
  const progress = getStageProgress(level);

  // Chaque stade occupe une bande de 1/6 de l'échelle totale
  const stageWidth = 1 / TREE_STAGES.length;
  return idx * stageWidth + progress * stageWidth;
}

/**
 * Retourne le multiplicateur de complexité visuelle (nombre de branches, feuilles, etc.)
 * Plus le stade est avancé, plus l'arbre est riche visuellement.
 */
export function getVisualComplexity(level: number): {
  branches: number;     // nombre de branches (0-8)
  leafClusters: number; // nombre de groupes de feuilles (0-12)
  hasFlowers: boolean;  // fleurs visibles
  hasFruits: boolean;   // fruits visibles
  hasParticles: boolean; // particules (sparkles, lucioles)
  hasGlow: boolean;     // halo lumineux
  hasAura: boolean;     // aura dorée
} {
  const stage = getTreeStage(level);
  const progress = getStageProgress(level);

  switch (stage) {
    case 'graine':
      return {
        branches: 0,
        leafClusters: 0,
        hasFlowers: false,
        hasFruits: false,
        hasParticles: false,
        hasGlow: false,
        hasAura: false,
      };
    case 'pousse':
      return {
        branches: Math.floor(1 + progress * 2),
        leafClusters: Math.floor(2 + progress * 2),
        hasFlowers: false,
        hasFruits: false,
        hasParticles: false,
        hasGlow: false,
        hasAura: false,
      };
    case 'arbuste':
      return {
        branches: Math.floor(3 + progress * 2),
        leafClusters: Math.floor(4 + progress * 3),
        hasFlowers: progress > 0.5,
        hasFruits: false,
        hasParticles: false,
        hasGlow: false,
        hasAura: false,
      };
    case 'arbre':
      return {
        branches: Math.floor(5 + progress * 2),
        leafClusters: Math.floor(7 + progress * 3),
        hasFlowers: true,
        hasFruits: progress > 0.3,
        hasParticles: false,
        hasGlow: false,
        hasAura: false,
      };
    case 'majestueux':
      return {
        branches: 7,
        leafClusters: Math.floor(10 + progress * 2),
        hasFlowers: true,
        hasFruits: true,
        hasParticles: true,
        hasGlow: progress > 0.5,
        hasAura: false,
      };
    case 'legendaire':
      return {
        branches: 8,
        leafClusters: 12,
        hasFlowers: true,
        hasFruits: true,
        hasParticles: true,
        hasGlow: true,
        hasAura: true,
      };
  }
}
