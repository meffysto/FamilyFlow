/**
 * grade-inventory.test.ts — Phase B : inventaire par grade
 *
 * Couvre :
 *  - GRADE_ORDER / compareGrades / getWeakestGrade
 *  - gradeSellMultiplier (alias getGradeMultiplier)
 *  - addToGradedInventory / removeFromGradedInventory / countItemByGrade
 *  - parseHarvestInventory (legacy + v2 + mix + fusion + résilience)
 *  - serializeHarvestInventory (ordre déterministe, filtre qty=0)
 *  - Round-trip parse(serialize(inv)) === inv
 *  - CraftedItem.grade parse/serialize
 */

import {
  GRADE_ORDER,
  compareGrades,
  getWeakestGrade,
  gradeSellMultiplier,
  getGradeMultiplier,
  addToGradedInventory,
  removeFromGradedInventory,
  countItemByGrade,
} from '../mascot/grade-engine';
import {
  parseHarvestInventory,
  serializeHarvestInventory,
  parseCraftedItems,
  serializeCraftedItems,
} from '../mascot/craft-engine';
import type { HarvestInventory } from '../mascot/types';

describe('grade-engine — GRADE_ORDER / compareGrades / getWeakestGrade', () => {
  it('GRADE_ORDER est [ordinaire, beau, superbe, parfait]', () => {
    expect(GRADE_ORDER).toEqual(['ordinaire', 'beau', 'superbe', 'parfait']);
  });

  it('compareGrades retourne négatif si a < b', () => {
    expect(compareGrades('ordinaire', 'beau')).toBeLessThan(0);
    expect(compareGrades('beau', 'parfait')).toBeLessThan(0);
  });

  it('compareGrades retourne positif si a > b', () => {
    expect(compareGrades('parfait', 'superbe')).toBeGreaterThan(0);
    expect(compareGrades('beau', 'ordinaire')).toBeGreaterThan(0);
  });

  it('compareGrades retourne 0 si égaux', () => {
    expect(compareGrades('beau', 'beau')).toBe(0);
  });

  it('getWeakestGrade retourne le grade le plus faible', () => {
    expect(getWeakestGrade(['beau', 'superbe', 'parfait'])).toBe('beau');
    expect(getWeakestGrade(['parfait', 'ordinaire', 'superbe'])).toBe('ordinaire');
  });

  it('getWeakestGrade retourne le grade unique si un seul élément', () => {
    expect(getWeakestGrade(['superbe'])).toBe('superbe');
  });

  it('getWeakestGrade fallback ordinaire si liste vide', () => {
    expect(getWeakestGrade([])).toBe('ordinaire');
  });
});

describe('grade-engine — gradeSellMultiplier', () => {
  it('ordinaire × 1', () => {
    expect(gradeSellMultiplier('ordinaire')).toBe(1);
  });

  it('beau × 1.5', () => {
    expect(gradeSellMultiplier('beau')).toBe(1.5);
  });

  it('superbe × 2.5', () => {
    expect(gradeSellMultiplier('superbe')).toBe(2.5);
  });

  it('parfait × 4', () => {
    expect(gradeSellMultiplier('parfait')).toBe(4);
  });

  it('alias sémantique de getGradeMultiplier (mêmes valeurs)', () => {
    expect(gradeSellMultiplier('beau')).toBe(getGradeMultiplier('beau'));
    expect(gradeSellMultiplier('parfait')).toBe(getGradeMultiplier('parfait'));
  });
});

describe('grade-engine — addToGradedInventory', () => {
  it('ajoute dans un inventaire vide', () => {
    const inv: HarvestInventory = {};
    addToGradedInventory(inv, 'tomato', 'beau', 3);
    expect(inv.tomato).toEqual({ beau: 3 });
  });

  it('fusionne la qty pour même combinaison itemId+grade', () => {
    const inv: HarvestInventory = { tomato: { beau: 2 } };
    addToGradedInventory(inv, 'tomato', 'beau', 3);
    expect(inv.tomato).toEqual({ beau: 5 });
  });

  it('ajoute un second grade sans écraser', () => {
    const inv: HarvestInventory = { tomato: { beau: 2 } };
    addToGradedInventory(inv, 'tomato', 'ordinaire', 1);
    expect(inv.tomato).toEqual({ beau: 2, ordinaire: 1 });
  });

  it('ignore qty <= 0', () => {
    const inv: HarvestInventory = {};
    addToGradedInventory(inv, 'tomato', 'beau', 0);
    addToGradedInventory(inv, 'tomato', 'beau', -5);
    expect(inv.tomato).toBeUndefined();
  });
});

describe('grade-engine — removeFromGradedInventory', () => {
  it('retire la qty demandée', () => {
    const inv: HarvestInventory = { tomato: { beau: 5 } };
    removeFromGradedInventory(inv, 'tomato', 'beau', 3);
    expect(inv.tomato).toEqual({ beau: 2 });
  });

  it('floor à 0 si qty insuffisante (pas négatif)', () => {
    const inv: HarvestInventory = { tomato: { beau: 2 } };
    removeFromGradedInventory(inv, 'tomato', 'beau', 5);
    expect(inv.tomato).toEqual({ beau: 0 });
  });

  it('no-op si itemId absent', () => {
    const inv: HarvestInventory = {};
    removeFromGradedInventory(inv, 'tomato', 'beau', 3);
    expect(inv.tomato).toBeUndefined();
  });
});

describe('grade-engine — countItemByGrade', () => {
  it('retourne la qty pour itemId+grade existant', () => {
    const inv: HarvestInventory = { tomato: { beau: 4 } };
    expect(countItemByGrade(inv, 'tomato', 'beau')).toBe(4);
  });

  it('retourne 0 si absent', () => {
    const inv: HarvestInventory = {};
    expect(countItemByGrade(inv, 'tomato', 'beau')).toBe(0);
  });

  it('retourne 0 pour grade absent même si itemId présent', () => {
    const inv: HarvestInventory = { tomato: { beau: 4 } };
    expect(countItemByGrade(inv, 'tomato', 'parfait')).toBe(0);
  });
});

describe('craft-engine — parseHarvestInventory compat ascendante', () => {
  it('format legacy "cropId:qty" → grade ordinaire', () => {
    const inv = parseHarvestInventory('tomato:5');
    expect(inv).toEqual({ tomato: { ordinaire: 5 } });
  });

  it('format v2 "cropId:grade:qty"', () => {
    const inv = parseHarvestInventory('tomato:beau:3');
    expect(inv).toEqual({ tomato: { beau: 3 } });
  });

  it('mix legacy + v2 toléré', () => {
    const inv = parseHarvestInventory('tomato:5,wheat:beau:2');
    expect(inv).toEqual({
      tomato: { ordinaire: 5 },
      wheat: { beau: 2 },
    });
  });

  it('fusion entrées dupliquées même cropId+grade', () => {
    const inv = parseHarvestInventory('tomato:beau:3,tomato:beau:2');
    expect(inv).toEqual({ tomato: { beau: 5 } });
  });

  it('chaîne vide → inventaire vide', () => {
    expect(parseHarvestInventory('')).toEqual({});
  });

  it('undefined → inventaire vide', () => {
    expect(parseHarvestInventory(undefined)).toEqual({});
  });

  it('grade invalide → fallback ordinaire (résilience)', () => {
    const inv = parseHarvestInventory('tomato:unknown:3');
    expect(inv).toEqual({ tomato: { ordinaire: 3 } });
  });

  it('qty invalide → entrée ignorée', () => {
    const inv = parseHarvestInventory('tomato:beau:abc');
    expect(inv).toEqual({});
  });
});

describe('craft-engine — serializeHarvestInventory', () => {
  it('émet format v2 avec ordre GRADE_ORDER déterministe', () => {
    const inv: HarvestInventory = { tomato: { parfait: 1, ordinaire: 8, beau: 3 } };
    const csv = serializeHarvestInventory(inv);
    // ordre : ordinaire, beau, superbe, parfait
    expect(csv).toBe('tomato:ordinaire:8,tomato:beau:3,tomato:parfait:1');
  });

  it('filtre qty = 0', () => {
    const inv: HarvestInventory = { tomato: { beau: 0, parfait: 2 } };
    expect(serializeHarvestInventory(inv)).toBe('tomato:parfait:2');
  });

  it('inventaire vide → chaîne vide', () => {
    expect(serializeHarvestInventory({})).toBe('');
  });

  it('ordre alphabétique sur cropId', () => {
    const inv: HarvestInventory = {
      wheat: { ordinaire: 2 },
      tomato: { ordinaire: 3 },
    };
    expect(serializeHarvestInventory(inv)).toBe('tomato:ordinaire:3,wheat:ordinaire:2');
  });
});

describe('craft-engine — round-trip parse/serialize HarvestInventory', () => {
  it('préserve les grades multiples', () => {
    const inv: HarvestInventory = { tomato: { ordinaire: 8, beau: 3, parfait: 1 } };
    expect(parseHarvestInventory(serializeHarvestInventory(inv))).toEqual(inv);
  });

  it('round-trip legacy → v2 (upgrade silencieux vers ordinaire)', () => {
    const v1 = 'tomato:5';
    const parsed = parseHarvestInventory(v1);
    const serialized = serializeHarvestInventory(parsed);
    expect(serialized).toBe('tomato:ordinaire:5');
    expect(parseHarvestInventory(serialized)).toEqual(parsed);
  });
});

describe('craft-engine — parseCraftedItems + grade', () => {
  it('parse format legacy "recipeId:craftedAt"', () => {
    const items = parseCraftedItems('confiture:2024-01-01');
    expect(items).toEqual([{ recipeId: 'confiture', craftedAt: '2024-01-01' }]);
  });

  it('parse format v2 "recipeId:craftedAt:grade"', () => {
    const items = parseCraftedItems('confiture:2024-01-01:beau');
    expect(items).toEqual([{ recipeId: 'confiture', craftedAt: '2024-01-01', grade: 'beau' }]);
  });

  it('parse mix legacy + v2', () => {
    const items = parseCraftedItems('confiture:2024-01-01:beau,gateau:2024-02-01');
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ recipeId: 'confiture', craftedAt: '2024-01-01', grade: 'beau' });
    expect(items[1]).toEqual({ recipeId: 'gateau', craftedAt: '2024-02-01' });
  });

  it('ignore grade invalide (fallback ordinaire ajouté)', () => {
    const items = parseCraftedItems('confiture:2024-01-01:unknown');
    expect(items).toHaveLength(1);
    // grade invalide : fallback ordinaire (résilience)
    expect(items[0].grade).toBe('ordinaire');
  });
});

describe('craft-engine — serializeCraftedItems + grade', () => {
  it('inclut grade quand présent', () => {
    const csv = serializeCraftedItems([
      { recipeId: 'confiture', craftedAt: '2024-01-01', grade: 'beau' },
    ]);
    expect(csv).toBe('confiture:2024-01-01:beau');
  });

  it('format legacy quand grade absent', () => {
    const csv = serializeCraftedItems([
      { recipeId: 'gateau', craftedAt: '2024-02-01' },
    ]);
    expect(csv).toBe('gateau:2024-02-01');
  });

  it('round-trip preserve grade', () => {
    const items = [
      { recipeId: 'confiture', craftedAt: '2024-01-01', grade: 'beau' as const },
      { recipeId: 'gateau', craftedAt: '2024-02-01' },
    ];
    expect(parseCraftedItems(serializeCraftedItems(items))).toEqual(items);
  });
});
