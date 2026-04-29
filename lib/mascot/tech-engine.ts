// ─────────────────────────────────────────────
// Ferme — Arbre de technologies (moteur pur)
// ─────────────────────────────────────────────

/** Identifiant de branche technologique */
export type TechBranchId = 'culture' | 'elevage' | 'expansion' | 'social';

/** Noeud individuel de l'arbre de technologies */
export interface TechNode {
  id: string;              // ex: 'culture-1', 'elevage-2', 'expansion-3'
  branch: TechBranchId;
  order: number;           // position dans la branche (1, 2, 3, 4)
  labelKey: string;        // cle i18n
  descriptionKey: string;  // cle i18n description de l'effet
  emoji: string;
  cost: number;            // cout en feuilles
  requires: string | null; // id du noeud prerequis (null pour le premier de chaque branche)
}

/** Bonus agrages de tous les noeuds tech debloques */
export interface TechBonuses {
  tasksPerStageReduction: number;       // reduction du tasksPerStage (0 ou 1)
  bonusHarvestChance: number;           // chance de recolte double (0.0 = jamais, 0.25 = 25%, 0.5 = 50%)
  newCrops: string[];                   // IDs des cultures debloquees par tech
  productionIntervalMultiplier: number; // multiplicateur intervalle batiments (1.0 = normal, 0.75 = -25%)
  buildingCapacityMultiplier: number;   // multiplicateur capacite stockage (1 ou 2)
  newResources: string[];               // nouvelles ressources debloquees
  extraCropCells: number;               // parcelles crop supplementaires
  extraBuildingCells: number;           // parcelles building supplementaires
  hasLargeCropCell: boolean;            // parcelle geante disponible
  /** Phase 44 — Bonus +N visiteurs actifs simultanés à l'Auberge (default 0, social-2 → 1). */
  aubergeMaxActiveBonus: number;
  /** Phase 44 — Multiplicateur reward livraison Auberge (default 1.0, social-3 → 1.2). */
  aubergeRewardMultiplier: number;
}

// ── Arbre de technologies ──────────────────────────────────────

/** 10 noeuds repartis en 3 branches : Culture (4), Elevage (3), Expansion (3) */
export const TECH_TREE: TechNode[] = [
  // Branche Culture — vitesse de pousse et rendement
  {
    id: 'culture-1', branch: 'culture', order: 1,
    labelKey: 'tech.culture-1', descriptionKey: 'tech.culture-1_desc',
    emoji: '🧪', cost: 750, requires: null,
  },
  {
    id: 'culture-2', branch: 'culture', order: 2,
    labelKey: 'tech.culture-2', descriptionKey: 'tech.culture-2_desc',
    emoji: '🌾', cost: 2000, requires: 'culture-1',
  },
  {
    id: 'culture-3', branch: 'culture', order: 3,
    labelKey: 'tech.culture-3', descriptionKey: 'tech.culture-3_desc',
    emoji: '🌻', cost: 4000, requires: 'culture-2',
  },
  {
    id: 'culture-4', branch: 'culture', order: 4,
    labelKey: 'tech.culture-4', descriptionKey: 'tech.culture-4_desc',
    emoji: '👑', cost: 7500, requires: 'culture-3',
  },
  {
    // Phase A — Grades de récolte (probabiliste per-roll, pas un TechBonus agrégé)
    id: 'culture-5', branch: 'culture', order: 5,
    labelKey: 'tech.culture-5', descriptionKey: 'tech.culture-5_desc',
    emoji: '🔬', cost: 10000, requires: 'culture-4',
  },

  // Branche Elevage — production batiments
  {
    id: 'elevage-1', branch: 'elevage', order: 1,
    labelKey: 'tech.elevage-1', descriptionKey: 'tech.elevage-1_desc',
    emoji: '🌿', cost: 750, requires: null,
  },
  {
    id: 'elevage-2', branch: 'elevage', order: 2,
    labelKey: 'tech.elevage-2', descriptionKey: 'tech.elevage-2_desc',
    emoji: '🏠', cost: 2000, requires: 'elevage-1',
  },
  {
    id: 'elevage-3', branch: 'elevage', order: 3,
    labelKey: 'tech.elevage-3', descriptionKey: 'tech.elevage-3_desc',
    emoji: '🍯', cost: 5000, requires: 'elevage-2',
  },

  // Branche Expansion — nouvelles parcelles
  {
    id: 'expansion-1', branch: 'expansion', order: 1,
    labelKey: 'tech.expansion-1', descriptionKey: 'tech.expansion-1_desc',
    emoji: '🔨', cost: 1000, requires: null,
  },
  {
    id: 'expansion-2', branch: 'expansion', order: 2,
    labelKey: 'tech.expansion-2', descriptionKey: 'tech.expansion-2_desc',
    emoji: '🏗️', cost: 3000, requires: 'expansion-1',
  },
  {
    id: 'expansion-3', branch: 'expansion', order: 3,
    labelKey: 'tech.expansion-3', descriptionKey: 'tech.expansion-3_desc',
    emoji: '⭐', cost: 7500, requires: 'expansion-2',
  },

  // Branche Social — Auberge & visiteurs (Phase 44)
  {
    id: 'social-1', branch: 'social', order: 1,
    labelKey: 'tech.social-1', descriptionKey: 'tech.social-1_desc',
    emoji: '🛖', cost: 300, requires: null,
  },
  {
    id: 'social-2', branch: 'social', order: 2,
    labelKey: 'tech.social-2', descriptionKey: 'tech.social-2_desc',
    emoji: '🍻', cost: 1500, requires: 'social-1',
  },
  {
    id: 'social-3', branch: 'social', order: 3,
    labelKey: 'tech.social-3', descriptionKey: 'tech.social-3_desc',
    emoji: '✨', cost: 4000, requires: 'social-2',
  },
];

// ── Fonctions pures ────────────────────────────────────────────

/** Parse le CSV farm_tech et retourne la liste des IDs debloques */
export function getUnlockedTechs(farmTechCSV: string): string[] {
  if (!farmTechCSV || farmTechCSV.trim() === '') return [];
  return farmTechCSV.split(',').map(s => s.trim()).filter(Boolean);
}

/** Verifie si un noeud peut etre debloque (prerequis + feuilles) */
export function canUnlockTech(
  techId: string,
  unlockedTechs: string[],
  coins: number,
): { canUnlock: boolean; reason?: string } {
  // Deja debloque ?
  if (unlockedTechs.includes(techId)) {
    return { canUnlock: false, reason: 'Deja debloque' };
  }

  const node = TECH_TREE.find(n => n.id === techId);
  if (!node) {
    return { canUnlock: false, reason: 'Noeud tech introuvable' };
  }

  // Verifier le prerequis
  if (node.requires && !unlockedTechs.includes(node.requires)) {
    const reqNode = TECH_TREE.find(n => n.id === node.requires);
    return {
      canUnlock: false,
      reason: reqNode ? `Necessite : ${reqNode.labelKey}` : `Prerequis manquant : ${node.requires}`,
    };
  }

  // Verifier les feuilles
  if (coins < node.cost) {
    return { canUnlock: false, reason: 'Pas assez de feuilles' };
  }

  return { canUnlock: true };
}

/** Ajoute le techId a la liste et retourne la nouvelle liste */
export function unlockTechNode(unlockedTechs: string[], techId: string): string[] {
  if (unlockedTechs.includes(techId)) return unlockedTechs;
  return [...unlockedTechs, techId];
}

/** Serialise la liste de techs en CSV */
export function serializeTechs(techs: string[]): string {
  return techs.join(',');
}

/** Calcule les bonus agrages de tous les noeuds debloques */
export function getTechBonuses(unlockedTechs: string[]): TechBonuses {
  const bonuses: TechBonuses = {
    tasksPerStageReduction: 0,
    bonusHarvestChance: 0,
    newCrops: [],
    productionIntervalMultiplier: 1.0,
    buildingCapacityMultiplier: 1,
    newResources: [],
    extraCropCells: 0,
    extraBuildingCells: 0,
    hasLargeCropCell: false,
    aubergeMaxActiveBonus: 0,
    aubergeRewardMultiplier: 1.0,
  };

  for (const techId of unlockedTechs) {
    switch (techId) {
      // Culture
      case 'culture-1':
        bonuses.tasksPerStageReduction = 1;
        break;
      case 'culture-2':
        bonuses.bonusHarvestChance = 0.25;
        break;
      case 'culture-3':
        bonuses.newCrops.push('sunflower');
        break;
      case 'culture-4':
        bonuses.bonusHarvestChance = 0.5;
        break;

      // Elevage
      case 'elevage-1':
        bonuses.productionIntervalMultiplier = 0.75;
        break;
      case 'elevage-2':
        bonuses.buildingCapacityMultiplier = 2;
        break;
      case 'elevage-3':
        bonuses.newResources.push('miel');
        break;

      // Expansion
      case 'expansion-1':
        bonuses.extraBuildingCells = 1;
        break;
      case 'expansion-2':
        bonuses.extraCropCells = 5;
        break;
      case 'expansion-3':
        bonuses.hasLargeCropCell = true;
        break;

      // Social (Phase 44)
      case 'social-1':
        // Gating pur — débloque la construction de l'Auberge via BUILDING_CATALOG.techRequired
        break;
      case 'social-2':
        bonuses.aubergeMaxActiveBonus = 1;
        break;
      case 'social-3':
        bonuses.aubergeRewardMultiplier = 1.2;
        break;
    }
  }

  return bonuses;
}
