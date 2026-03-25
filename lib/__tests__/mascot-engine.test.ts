/**
 * mascot-engine.test.ts — Tests du moteur de l'arbre mascotte
 */

import {
  getTreeStage,
  getTreeStageInfo,
  getStageIndex,
  getStageProgress,
  detectEvolution,
  getNextEvolutionLevel,
  levelsUntilEvolution,
  getTreeScale,
  getVisualComplexity,
} from '../mascot/engine';
import { TREE_STAGES } from '../mascot/types';
import { parseFamille } from '../parser';

describe('getTreeStage', () => {
  it('retourne graine pour niveaux 1-3', () => {
    expect(getTreeStage(1)).toBe('graine');
    expect(getTreeStage(2)).toBe('graine');
    expect(getTreeStage(3)).toBe('graine');
  });

  it('retourne pousse pour niveaux 4-7', () => {
    expect(getTreeStage(4)).toBe('pousse');
    expect(getTreeStage(7)).toBe('pousse');
  });

  it('retourne arbuste pour niveaux 8-18', () => {
    expect(getTreeStage(8)).toBe('arbuste');
    expect(getTreeStage(18)).toBe('arbuste');
  });

  it('retourne arbre pour niveaux 19-32', () => {
    expect(getTreeStage(19)).toBe('arbre');
    expect(getTreeStage(32)).toBe('arbre');
  });

  it('retourne majestueux pour niveaux 33-40', () => {
    expect(getTreeStage(33)).toBe('majestueux');
    expect(getTreeStage(40)).toBe('majestueux');
  });

  it('retourne legendaire pour niveaux 41-50', () => {
    expect(getTreeStage(41)).toBe('legendaire');
    expect(getTreeStage(50)).toBe('legendaire');
  });

  it('retourne graine pour niveau 0 ou négatif', () => {
    expect(getTreeStage(0)).toBe('graine');
    expect(getTreeStage(-1)).toBe('graine');
  });
});

describe('getStageIndex', () => {
  it('retourne 0 pour graine, 5 pour legendaire', () => {
    expect(getStageIndex(1)).toBe(0);
    expect(getStageIndex(41)).toBe(5);
  });
});

describe('getStageProgress', () => {
  it('retourne 0 au début d\'un stade', () => {
    expect(getStageProgress(1)).toBe(0);
    expect(getStageProgress(4)).toBe(0);
    expect(getStageProgress(8)).toBe(0);
  });

  it('retourne 1 à la fin d\'un stade', () => {
    expect(getStageProgress(3)).toBe(1);
    expect(getStageProgress(7)).toBe(1);
  });

  it('retourne une valeur intermédiaire', () => {
    // Stade pousse : 4-7, donc level 5 = 1/3 ≈ 0.333
    const progress = getStageProgress(5);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });
});

describe('detectEvolution', () => {
  it('détecte une évolution graine→pousse', () => {
    const result = detectEvolution(3, 4);
    expect(result.evolved).toBe(true);
    expect(result.fromStage).toBe('graine');
    expect(result.toStage).toBe('pousse');
  });

  it('détecte une évolution arbre→majestueux', () => {
    const result = detectEvolution(32, 33);
    expect(result.evolved).toBe(true);
    expect(result.fromStage).toBe('arbre');
    expect(result.toStage).toBe('majestueux');
  });

  it('pas d\'évolution si même stade', () => {
    const result = detectEvolution(5, 6);
    expect(result.evolved).toBe(false);
    expect(result.fromStage).toBeUndefined();
  });

  it('gère les sauts de stade (multi-level up)', () => {
    const result = detectEvolution(3, 19);
    expect(result.evolved).toBe(true);
    expect(result.fromStage).toBe('graine');
    expect(result.toStage).toBe('arbre');
  });
});

describe('getNextEvolutionLevel', () => {
  it('retourne 4 depuis graine (niv 1)', () => {
    expect(getNextEvolutionLevel(1)).toBe(4);
  });

  it('retourne 8 depuis pousse (niv 5)', () => {
    expect(getNextEvolutionLevel(5)).toBe(8);
  });

  it('retourne null depuis legendaire (niv 45)', () => {
    expect(getNextEvolutionLevel(45)).toBeNull();
  });
});

describe('levelsUntilEvolution', () => {
  it('retourne 3 depuis niv 1 (besoin d\'atteindre 4)', () => {
    expect(levelsUntilEvolution(1)).toBe(3);
  });

  it('retourne null depuis legendaire', () => {
    expect(levelsUntilEvolution(50)).toBeNull();
  });
});

describe('getTreeScale', () => {
  it('retourne 0 pour niv 1 (début absolu)', () => {
    expect(getTreeScale(1)).toBeCloseTo(0, 1);
  });

  it('augmente avec le niveau', () => {
    expect(getTreeScale(20)).toBeGreaterThan(getTreeScale(5));
    expect(getTreeScale(40)).toBeGreaterThan(getTreeScale(20));
  });

  it('approche 1 au max', () => {
    const scale = getTreeScale(50);
    expect(scale).toBeGreaterThan(0.8);
    expect(scale).toBeLessThanOrEqual(1);
  });
});

describe('getVisualComplexity', () => {
  it('graine n\'a ni branches ni feuilles', () => {
    const v = getVisualComplexity(1);
    expect(v.branches).toBe(0);
    expect(v.leafClusters).toBe(0);
    expect(v.hasFlowers).toBe(false);
    expect(v.hasParticles).toBe(false);
  });

  it('majestueux a des particules', () => {
    const v = getVisualComplexity(35);
    expect(v.hasParticles).toBe(true);
    expect(v.hasFlowers).toBe(true);
    expect(v.hasFruits).toBe(true);
  });

  it('legendaire a tout', () => {
    const v = getVisualComplexity(45);
    expect(v.hasParticles).toBe(true);
    expect(v.hasGlow).toBe(true);
    expect(v.hasAura).toBe(true);
    expect(v.branches).toBe(8);
    expect(v.leafClusters).toBe(12);
  });
});

describe('TREE_STAGES cohérence', () => {
  it('couvre tous les niveaux 1-50 sans trou', () => {
    for (let level = 1; level <= 50; level++) {
      const stage = getTreeStage(level);
      expect(stage).toBeDefined();
    }
  });

  it('les stades sont dans l\'ordre croissant', () => {
    for (let i = 1; i < TREE_STAGES.length; i++) {
      expect(TREE_STAGES[i].minLevel).toBeGreaterThan(TREE_STAGES[i - 1].minLevel);
    }
  });

  it('chaque stade max est suivi par le min du suivant', () => {
    for (let i = 0; i < TREE_STAGES.length - 1; i++) {
      expect(TREE_STAGES[i + 1].minLevel).toBe(TREE_STAGES[i].maxLevel + 1);
    }
  });
});

describe('parseFamille avec tree_species', () => {
  it('parse tree_species cerisier', () => {
    const content = `### lucas
name: Lucas
role: enfant
avatar: 👦
tree_species: cerisier`;
    const profiles = parseFamille(content);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].treeSpecies).toBe('cerisier');
  });

  it('parse tree_species chene', () => {
    const content = `### emma
name: Emma
role: adulte
avatar: 👩
tree_species: chene`;
    const profiles = parseFamille(content);
    expect(profiles[0].treeSpecies).toBe('chene');
  });

  it('ignore les espèces invalides', () => {
    const content = `### lucas
name: Lucas
role: enfant
avatar: 👦
tree_species: banane`;
    const profiles = parseFamille(content);
    expect(profiles[0].treeSpecies).toBeUndefined();
  });

  it('treeSpecies est undefined quand absent', () => {
    const content = `### lucas
name: Lucas
role: enfant
avatar: 👦`;
    const profiles = parseFamille(content);
    expect(profiles[0].treeSpecies).toBeUndefined();
  });

  it('parse toutes les 5 espèces valides', () => {
    const species = ['cerisier', 'chene', 'bambou', 'oranger', 'palmier'];
    for (const sp of species) {
      const content = `### test\nname: Test\nrole: adulte\navatar: 👤\ntree_species: ${sp}`;
      const profiles = parseFamille(content);
      expect(profiles[0].treeSpecies).toBe(sp);
    }
  });
});
