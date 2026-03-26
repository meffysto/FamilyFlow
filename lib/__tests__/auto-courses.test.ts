/**
 * Tests unitaires — auto-courses.ts
 *
 * Couvre le flux recettes→courses→stock :
 * - computeFamilyServings (portions familiales)
 * - computeMissingIngredients (ingrédients manquants)
 * - computeStockDecrements (décrémentations stock après cuisson)
 * - resolveStockAction (action stock quand une course est cochée)
 */

import {
  computeFamilyServings,
  computeMissingIngredients,
  computeStockDecrements,
  resolveStockAction,
} from '../auto-courses';
import type { Profile, StockItem, CourseItem } from '../types';
import type { AppIngredient } from '../cooklang';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<Profile> & { name: string; role: Profile['role'] }): Profile {
  return {
    id: overrides.name.toLowerCase(),
    avatar: '👤',
    points: 0,
    coins: 0,
    level: 1,
    streak: 0,
    lootBoxesAvailable: 0,
    multiplier: 1,
    multiplierRemaining: 0,
    pityCounter: 0,
    mascotDecorations: [],
    mascotInhabitants: [],
    ...overrides,
  };
}

function makeStockItem(produit: string, quantite: number, overrides?: Partial<StockItem>): StockItem {
  return {
    produit,
    quantite,
    seuil: 1,
    emplacement: 'placards',
    lineIndex: Math.floor(Math.random() * 1000),
    ...overrides,
  };
}

function makeIngredient(name: string, quantity: number | null = null, unit = ''): AppIngredient {
  return { name, quantity, unit };
}

function makeCourseItem(text: string, overrides?: Partial<CourseItem>): CourseItem {
  return {
    id: `course-${Date.now()}`,
    text,
    completed: false,
    lineIndex: 0,
    ...overrides,
  };
}

// ─── computeFamilyServings ───────────────────────────────────────────────────

describe('computeFamilyServings', () => {
  it('retourne 1 portion pour une famille vide', () => {
    expect(computeFamilyServings([])).toBe(1);
  });

  it('retourne 1 portion pour un seul adulte', () => {
    const profiles = [makeProfile({ name: 'Papa', role: 'adulte' })];
    expect(computeFamilyServings(profiles)).toBe(1);
  });

  it('retourne 2 portions pour deux adultes', () => {
    const profiles = [
      makeProfile({ name: 'Papa', role: 'adulte' }),
      makeProfile({ name: 'Maman', role: 'adulte' }),
    ];
    expect(computeFamilyServings(profiles)).toBe(2);
  });

  it('compte un ado comme 0.75 portion', () => {
    const profiles = [
      makeProfile({ name: 'Papa', role: 'adulte' }),
      makeProfile({ name: 'Lucas', role: 'ado' }),
    ];
    expect(computeFamilyServings(profiles)).toBe(1.75);
  });

  it('compte un enfant standard comme 0.5 portion', () => {
    const profiles = [
      makeProfile({ name: 'Papa', role: 'adulte' }),
      makeProfile({ name: 'Emma', role: 'enfant' }),
    ];
    expect(computeFamilyServings(profiles)).toBe(1.5);
  });

  it('compte un bébé (ageCategory bebe) comme 0.25 portion', () => {
    const profiles = [
      makeProfile({ name: 'Papa', role: 'adulte' }),
      makeProfile({ name: 'Bébé', role: 'enfant', ageCategory: 'bebe' }),
    ];
    expect(computeFamilyServings(profiles)).toBe(1.25);
  });

  it('compte un petit (ageCategory petit) comme 0.35 portion', () => {
    const profiles = [
      makeProfile({ name: 'Papa', role: 'adulte' }),
      makeProfile({ name: 'Emma', role: 'enfant', ageCategory: 'petit' }),
    ];
    // 1 + 0.35 = 1.35 → arrondi au quart = 1.25
    expect(computeFamilyServings(profiles)).toBe(1.25);
  });

  it('ignore les profils en statut grossesse', () => {
    const profiles = [
      makeProfile({ name: 'Papa', role: 'adulte' }),
      makeProfile({ name: 'Maman', role: 'adulte' }),
      makeProfile({ name: 'Bébé', role: 'enfant', statut: 'grossesse' }),
    ];
    expect(computeFamilyServings(profiles)).toBe(2);
  });

  it('famille complète : 2 adultes + 1 ado + 1 enfant + 1 bébé', () => {
    const profiles = [
      makeProfile({ name: 'Papa', role: 'adulte' }),
      makeProfile({ name: 'Maman', role: 'adulte' }),
      makeProfile({ name: 'Lucas', role: 'ado' }),
      makeProfile({ name: 'Emma', role: 'enfant' }),
      makeProfile({ name: 'Bébé', role: 'enfant', ageCategory: 'bebe' }),
    ];
    // 1 + 1 + 0.75 + 0.5 + 0.25 = 3.5
    expect(computeFamilyServings(profiles)).toBe(3.5);
  });

  it('arrondit au quart le plus proche', () => {
    const profiles = [
      makeProfile({ name: 'Papa', role: 'adulte' }),
      makeProfile({ name: 'Emma', role: 'enfant', ageCategory: 'petit' }),
    ];
    // 1 + 0.35 = 1.35 → Math.round(1.35 * 4) / 4 = Math.round(5.4) / 4 = 5/4 = 1.25
    expect(computeFamilyServings(profiles)).toBe(1.25);
  });

  it('minimum 1 même si total arrondi serait < 1', () => {
    const profiles = [
      makeProfile({ name: 'Bébé', role: 'enfant', ageCategory: 'bebe' }),
    ];
    // 0.25 → max(1, 0.25) = 1
    expect(computeFamilyServings(profiles)).toBe(1);
  });
});

// ─── computeMissingIngredients ──────────────────────────────────────────────

describe('computeMissingIngredients', () => {
  it('retourne tous les ingrédients quand le stock est vide', () => {
    const ingredients = [
      makeIngredient('tomates', 3),
      makeIngredient('oignon', 1),
    ];
    const result = computeMissingIngredients(ingredients, []);
    expect(result).toHaveLength(2);
  });

  it('ignore les ingrédients de base (sel, poivre, huile, eau)', () => {
    const ingredients = [
      makeIngredient('sel'),
      makeIngredient('poivre'),
      makeIngredient("huile d'olive"),
      makeIngredient('eau'),
      makeIngredient('tomates', 2),
    ];
    const result = computeMissingIngredients(ingredients, []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('tomates');
  });

  it('skip un ingrédient sans quantité quand il est en stock', () => {
    const ingredients = [makeIngredient('persil')];
    const stock = [makeStockItem('persil', 1)];
    const result = computeMissingIngredients(ingredients, stock);
    expect(result).toHaveLength(0);
  });

  it('ajoute un ingrédient sans quantité quand il est absent du stock', () => {
    const ingredients = [makeIngredient('coriandre')];
    const result = computeMissingIngredients(ingredients, []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('coriandre');
  });

  it('calcule le delta pour les ingrédients comptés (3 œufs - 1 en stock = 2)', () => {
    const ingredients = [makeIngredient('œufs', 3)];
    const stock = [makeStockItem('œufs', 1)];
    const result = computeMissingIngredients(ingredients, stock);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
    expect(result[0].text).toBe('2 œufs');
  });

  it('retourne vide quand le stock couvre la quantité nécessaire', () => {
    const ingredients = [makeIngredient('œufs', 3)];
    const stock = [makeStockItem('œufs', 5)];
    const result = computeMissingIngredients(ingredients, stock);
    expect(result).toHaveLength(0);
  });

  it('retourne vide quand le stock est exactement égal au besoin', () => {
    const ingredients = [makeIngredient('tomates', 4)];
    const stock = [makeStockItem('tomates', 4)];
    const result = computeMissingIngredients(ingredients, stock);
    expect(result).toHaveLength(0);
  });

  it('ajoute toujours les ingrédients en poids (g, kg, ml, cl)', () => {
    const ingredients = [makeIngredient('pecorino', 120, 'g')];
    const stock = [makeStockItem('pecorino', 2)];
    const result = computeMissingIngredients(ingredients, stock);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('pecorino');
  });

  it('ajoute les ingrédients en poids même sans stock', () => {
    const ingredients = [makeIngredient('farine', 500, 'g')];
    const result = computeMissingIngredients(ingredients, []);
    expect(result).toHaveLength(1);
  });

  it('matche le stock de manière fuzzy (sous-chaîne)', () => {
    const ingredients = [makeIngredient('tomates cerises', 10)];
    const stock = [makeStockItem('tomates', 5)];
    // "tomates cerises" contient "tomates" (length >= 3) → match
    const result = computeMissingIngredients(ingredients, stock);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5); // delta: 10 - 5
  });

  it('chaque résultat a une section (catégorie courses)', () => {
    const ingredients = [
      makeIngredient('poulet', 1),
      makeIngredient('brocoli', 2),
    ];
    const result = computeMissingIngredients(ingredients, []);
    for (const item of result) {
      expect(item.section).toBeTruthy();
    }
  });

  it('retourne un tableau vide quand il n\'y a pas d\'ingrédients', () => {
    const result = computeMissingIngredients([], []);
    expect(result).toEqual([]);
  });

  it('traite les unités de cuillère (cs, cc, càs, càc) comme du poids', () => {
    const ingredients = [makeIngredient('cumin', 2, 'càs')];
    const stock = [makeStockItem('cumin', 1)];
    // Les unités càs sont des unités de poids → toujours ajouté
    const result = computeMissingIngredients(ingredients, stock);
    expect(result).toHaveLength(1);
  });
});

// ─── computeStockDecrements ─────────────────────────────────────────────────

describe('computeStockDecrements', () => {
  it('retourne vide quand le stock est vide', () => {
    const ingredients = [makeIngredient('tomates', 3)];
    const result = computeStockDecrements(ingredients, []);
    expect(result).toHaveLength(0);
  });

  it('décrémente par la quantité pour les ingrédients comptés', () => {
    const ingredients = [makeIngredient('œufs', 3)];
    const stock = [makeStockItem('œufs', 6, { lineIndex: 10 })];
    const result = computeStockDecrements(ingredients, stock);
    expect(result).toHaveLength(1);
    expect(result[0].newQuantity).toBe(3); // 6 - 3
    expect(result[0].stockItem.produit).toBe('œufs');
  });

  it('décrémente de 1 pour les ingrédients en poids (g, ml, etc.)', () => {
    const ingredients = [makeIngredient('pecorino', 120, 'g')];
    const stock = [makeStockItem('pecorino', 3, { lineIndex: 20 })];
    const result = computeStockDecrements(ingredients, stock);
    expect(result).toHaveLength(1);
    expect(result[0].newQuantity).toBe(2); // 3 - 1
  });

  it('décrémente de 1 pour les ingrédients sans quantité', () => {
    const ingredients = [makeIngredient('persil')];
    const stock = [makeStockItem('persil', 2, { lineIndex: 30 })];
    const result = computeStockDecrements(ingredients, stock);
    expect(result).toHaveLength(1);
    expect(result[0].newQuantity).toBe(1); // 2 - 1
  });

  it('ne descend jamais en dessous de 0', () => {
    const ingredients = [makeIngredient('œufs', 10)];
    const stock = [makeStockItem('œufs', 3, { lineIndex: 10 })];
    const result = computeStockDecrements(ingredients, stock);
    expect(result).toHaveLength(1);
    expect(result[0].newQuantity).toBe(0); // max(0, 3 - 10)
  });

  it('ignore les ingrédients de base (sel, poivre, huile, eau)', () => {
    const ingredients = [
      makeIngredient('sel'),
      makeIngredient('poivre'),
      makeIngredient('eau'),
    ];
    const stock = [
      makeStockItem('sel', 1, { lineIndex: 1 }),
      makeStockItem('poivre', 1, { lineIndex: 2 }),
    ];
    const result = computeStockDecrements(ingredients, stock);
    expect(result).toHaveLength(0);
  });

  it('ignore les produits avec quantité stock à 0', () => {
    const ingredients = [makeIngredient('tomates', 2)];
    const stock = [makeStockItem('tomates', 0, { lineIndex: 10 })];
    const result = computeStockDecrements(ingredients, stock);
    expect(result).toHaveLength(0);
  });

  it('ne décrémente pas deux fois le même produit stock', () => {
    // Deux ingrédients qui matchent le même produit stock
    const ingredients = [
      makeIngredient('tomates', 2),
      makeIngredient('tomates cerises', 3),
    ];
    const stock = [makeStockItem('tomates', 10, { lineIndex: 10 })];
    const result = computeStockDecrements(ingredients, stock);
    // Un seul match car le lineIndex est déjà utilisé
    expect(result).toHaveLength(1);
  });

  it('arrondit au supérieur (Math.ceil) la quantité fractionnaire', () => {
    const ingredients = [makeIngredient('citrons', 1.5)];
    const stock = [makeStockItem('citrons', 5, { lineIndex: 10 })];
    const result = computeStockDecrements(ingredients, stock);
    expect(result).toHaveLength(1);
    expect(result[0].newQuantity).toBe(3); // 5 - ceil(1.5) = 5 - 2
  });

  it('retourne vide quand il n\'y a pas d\'ingrédients', () => {
    const result = computeStockDecrements([], [makeStockItem('œufs', 6)]);
    expect(result).toEqual([]);
  });
});

// ─── resolveStockAction ─────────────────────────────────────────────────────

describe('resolveStockAction', () => {
  it('incrémente un produit existant dans le stock', () => {
    const course = makeCourseItem('œufs');
    const stock = [makeStockItem('œufs', 3, { lineIndex: 10 })];
    const result = resolveStockAction(course, stock);
    expect(result.incremented).not.toBeNull();
    expect(result.incremented!.produit).toBe('œufs');
    expect(result.newItem).toBeNull();
  });

  it('crée un nouveau produit pour une catégorie stockable', () => {
    const course = makeCourseItem('3 tomates', { section: '🥬 Légumes' });
    const result = resolveStockAction(course, []);
    expect(result.incremented).toBeNull();
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.produit).toBe('tomates');
    expect(result.newItem!.quantite).toBe(3);
  });

  it('ne fait rien pour une catégorie non stockable', () => {
    const course = makeCourseItem('éponges', { section: '🧹 Entretien' });
    const result = resolveStockAction(course, []);
    expect(result.incremented).toBeNull();
    expect(result.newItem).toBeNull();
  });

  it('déduit l\'emplacement frigo pour la crèmerie', () => {
    const course = makeCourseItem('lait', { section: '🧀 Crèmerie' });
    const result = resolveStockAction(course, []);
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.emplacement).toBe('frigo');
  });

  it('déduit l\'emplacement congélateur pour les surgelés', () => {
    const course = makeCourseItem('petits pois', { section: '🧊 Surgelés' });
    const result = resolveStockAction(course, []);
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.emplacement).toBe('congelateur');
  });

  it('déduit l\'emplacement bébé pour les produits bébé', () => {
    const course = makeCourseItem('couches', { section: '👶 Bébé' });
    const result = resolveStockAction(course, []);
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.emplacement).toBe('bebe');
  });

  it('déduit l\'emplacement placards par défaut', () => {
    const course = makeCourseItem('pâtes', { section: '🍝 Féculents' });
    const result = resolveStockAction(course, []);
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.emplacement).toBe('placards');
  });

  it('parse "120 g de pecorino" en quantité 1 (poids)', () => {
    const course = makeCourseItem('120 g de pecorino', { section: '🧀 Crèmerie' });
    const result = resolveStockAction(course, []);
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.produit).toBe('pecorino');
    expect(result.newItem!.quantite).toBe(1);
  });

  it('parse "2 sachet de levure" en quantité 2', () => {
    const course = makeCourseItem('2 sachet de levure', { section: '🧁 Pâtisserie' });
    const result = resolveStockAction(course, []);
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.produit).toBe('levure');
    expect(result.newItem!.quantite).toBe(2);
  });

  it('parse "6 œufs" en quantité 6', () => {
    const course = makeCourseItem('6 œufs', { section: '🥚 Œufs' });
    const result = resolveStockAction(course, []);
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.produit).toBe('œufs');
    expect(result.newItem!.quantite).toBe(6);
  });

  it('seuil par défaut à 1 pour les nouveaux produits', () => {
    const course = makeCourseItem('beurre', { section: '🧀 Crèmerie' });
    const result = resolveStockAction(course, []);
    expect(result.newItem).not.toBeNull();
    expect(result.newItem!.seuil).toBe(1);
  });

  it('match fuzzy : "tomates" dans le stock matche "3 tomates cerises"', () => {
    const course = makeCourseItem('3 tomates cerises');
    const stock = [makeStockItem('tomates', 2, { lineIndex: 5 })];
    const result = resolveStockAction(course, stock);
    expect(result.incremented).not.toBeNull();
    expect(result.incremented!.produit).toBe('tomates');
  });
});
