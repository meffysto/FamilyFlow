/**
 * Tests unitaires — cooklang.ts
 *
 * Couvre le parser de recettes au format .cook (Cooklang).
 */

import {
  parseRecipe,
  scaleIngredients,
  aggregateIngredients,
  formatIngredient,
  categorizeIngredient,
  renderStepText,
  convertCookToMetric,
  generateCookFile,
} from '../cooklang';

// ─── parseRecipe — Metadata ─────────────────────────────────────────────────

describe('parseRecipe — metadata', () => {
  it('parse les metadata >> key: value', () => {
    const content = `>> servings: 4
>> prep time: 15 min
>> cook time: 30 min
>> tags: rapide, famille

Mélanger les ingrédients.
`;
    const recipe = parseRecipe('Recettes/Plats/Pâtes.cook', content);
    expect(recipe.servings).toBe(4);
    expect(recipe.prepTime).toBe('15 min');
    expect(recipe.cookTime).toBe('30 min');
    expect(recipe.tags).toEqual(['rapide', 'famille']);
  });

  it('extrait le titre depuis le nom de fichier', () => {
    const recipe = parseRecipe('Recettes/Desserts/Gâteau chocolat.cook', '>> servings: 6\nFaire fondre le chocolat.');
    expect(recipe.title).toBe('Gâteau chocolat');
  });

  it('extrait la catégorie depuis le chemin', () => {
    const recipe = parseRecipe('Recettes/Desserts/Mousse.cook', '>> servings: 4\nÉtape 1.');
    expect(recipe.category).toBe('Desserts');
  });

  it('utilise le titre du metadata si présent', () => {
    const recipe = parseRecipe('Recettes/Plats/truc.cook', '>> title: Mon Super Plat\nÉtape.');
    expect(recipe.title).toBe('Mon Super Plat');
  });

  it('défaut à 4 portions si non spécifié', () => {
    const recipe = parseRecipe('test.cook', 'Faire cuire.');
    expect(recipe.servings).toBe(4);
  });

  it('génère un id slug depuis le sourceFile', () => {
    const recipe = parseRecipe('Recettes/Plats/Pâtes Carbonara.cook', 'Étape.');
    expect(recipe.id).toMatch(/^recettes-plats-p-tes-carbonara-cook$/);
    expect(recipe.sourceFile).toBe('Recettes/Plats/Pâtes Carbonara.cook');
  });
});

// ─── parseRecipe — Ingrédients ───────────────────────────────────────────────

describe('parseRecipe — ingrédients', () => {
  it('parse un ingrédient multiword avec quantité et unité @name{qty%unit}', () => {
    const recipe = parseRecipe('test.cook', 'Ajouter @beurre{100%g} dans le plat.');
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.ingredients[0].name).toBe('beurre');
    expect(recipe.ingredients[0].quantity).toBe(100);
    expect(recipe.ingredients[0].unit).toBe('g');
  });

  it('parse un ingrédient sans unité @name{qty}', () => {
    const recipe = parseRecipe('test.cook', 'Casser @oeufs{3} dans un bol.');
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.ingredients[0].name).toBe('oeufs');
    expect(recipe.ingredients[0].quantity).toBe(3);
    expect(recipe.ingredients[0].unit).toBe('');
  });

  it('parse un ingrédient single word sans accolades @word', () => {
    const recipe = parseRecipe('test.cook', 'Ajouter du @sel.');
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.ingredients[0].name).toBe('sel');
    expect(recipe.ingredients[0].quantity).toBeNull(); // "some" → NaN → null
  });

  it('traduit les ingrédients anglais en français', () => {
    const recipe = parseRecipe('test.cook', 'Add @butter{100%g} and @salt{2%g}.');
    expect(recipe.ingredients[0].name).toBe('beurre');
    expect(recipe.ingredients[1].name).toBe('sel');
  });

  it('normalise les unités anglaises en français', () => {
    const recipe = parseRecipe('test.cook', 'Add @sugar{2%tbsp}.');
    expect(recipe.ingredients[0].unit).toBe('c. à s.');
  });

  it('déduplique les ingrédients identiques', () => {
    const recipe = parseRecipe('test.cook', `Ajouter @sel{2%g} dans la sauce.
Ajouter @sel{1%g} sur la viande.`);
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.ingredients[0].name).toBe('sel');
  });

  it('parse les ingrédients avec virgule décimale', () => {
    const recipe = parseRecipe('test.cook', 'Ajouter @crème{2,5%dl}.');
    expect(recipe.ingredients[0].quantity).toBe(2.5);
  });
});

// ─── parseRecipe — Ustensiles (cookware) ─────────────────────────────────────

describe('parseRecipe — ustensiles', () => {
  it('parse un ustensile multiword #name{}', () => {
    const recipe = parseRecipe('test.cook', 'Préchauffer le #four{} à 180°C.');
    expect(recipe.cookware).toContain('four');
  });

  it('parse un ustensile single word #word', () => {
    const recipe = parseRecipe('test.cook', 'Utiliser un #fouet pour mélanger.');
    expect(recipe.cookware).toContain('fouet');
  });

  it('déduplique les ustensiles', () => {
    const recipe = parseRecipe('test.cook', `Mettre au #four{}.
Sortir du #four{}.`);
    expect(recipe.cookware.filter(c => c === 'four')).toHaveLength(1);
  });
});

// ─── parseRecipe — Timers ────────────────────────────────────────────────────

describe('parseRecipe — timers', () => {
  it('parse un timer ~name{qty%unit}', () => {
    const recipe = parseRecipe('test.cook', 'Laisser cuire ~cuisson{30%minutes}.');
    expect(recipe.steps).toHaveLength(1);
    expect(recipe.steps[0].timers).toHaveLength(1);
    expect(recipe.steps[0].timers[0].duration).toBe(30);
    expect(recipe.steps[0].timers[0].unit).toBe('minutes');
  });
});

// ─── parseRecipe — Étapes (steps) ────────────────────────────────────────────

describe('parseRecipe — étapes', () => {
  it('crée une étape par ligne non vide', () => {
    const recipe = parseRecipe('test.cook', `>> servings: 4

Couper les légumes.

Faire revenir dans la poêle.

Servir chaud.`);
    // La ligne metadata est exclue, les lignes vides aussi
    expect(recipe.steps).toHaveLength(3);
    expect(recipe.steps[0].number).toBe(1);
    expect(recipe.steps[1].number).toBe(2);
    expect(recipe.steps[2].number).toBe(3);
  });

  it('les tokens mixtes contiennent texte + ingrédient + ustensile', () => {
    const recipe = parseRecipe('test.cook', 'Faire fondre @beurre{50%g} dans une #casserole{}.');
    const step = recipe.steps[0];
    expect(step.tokens.length).toBeGreaterThanOrEqual(3); // text + ingredient + text + cookware + text
    const ingredientToken = step.tokens.find(t => t.type === 'ingredient');
    expect(ingredientToken).toBeDefined();
    expect(ingredientToken!.name).toBe('beurre');
    const cookwareToken = step.tokens.find(t => t.type === 'cookware');
    expect(cookwareToken).toBeDefined();
    expect(cookwareToken!.name).toBe('casserole');
  });

  it('les ingrédients de l\'étape sont listés séparément', () => {
    const recipe = parseRecipe('test.cook', 'Mélanger @farine{200%g} et @sucre{100%g}.');
    expect(recipe.steps[0].ingredients).toHaveLength(2);
  });
});

// ─── parseRecipe — Commentaires ──────────────────────────────────────────────

describe('parseRecipe — commentaires', () => {
  it('ignore les commentaires inline -- ...', () => {
    const recipe = parseRecipe('test.cook', `Ajouter @sel{2%g}. -- un peu plus si nécessaire
Mélanger.`);
    expect(recipe.steps).toHaveLength(2);
    // Le commentaire ne doit pas apparaître comme texte significatif
    expect(recipe.steps[0].text).not.toContain('un peu plus');
  });

  it('ignore les commentaires bloc [- ... -]', () => {
    const recipe = parseRecipe('test.cook', `[- Ceci est un commentaire
sur plusieurs lignes -]
Couper les légumes.`);
    expect(recipe.steps).toHaveLength(1);
    expect(recipe.steps[0].text).toContain('Couper les légumes');
  });
});

// ─── parseRecipe — Frontmatter YAML ──────────────────────────────────────────

describe('parseRecipe — frontmatter', () => {
  it('le frontmatter YAML surcharge les metadata cooklang', () => {
    const content = `---
servings: 6
tags: dessert, chocolat
---
>> servings: 4

Faire fondre le chocolat.`;
    const recipe = parseRecipe('test.cook', content);
    expect(recipe.servings).toBe(6);
    expect(recipe.tags).toEqual(['dessert', 'chocolat']);
  });
});

// ─── scaleIngredients ────────────────────────────────────────────────────────

describe('scaleIngredients', () => {
  const base = [
    { name: 'farine', quantity: 200, unit: 'g' },
    { name: 'oeufs', quantity: 3, unit: '' },
    { name: 'sel', quantity: null, unit: '' },
  ];

  it('multiplie les quantités par le facteur', () => {
    const scaled = scaleIngredients(base, 8, 4);
    expect(scaled[0].quantity).toBe(400);
    expect(scaled[1].quantity).toBe(6);
  });

  it('ne modifie pas les quantités null', () => {
    const scaled = scaleIngredients(base, 8, 4);
    expect(scaled[2].quantity).toBeNull();
  });

  it('retourne les mêmes ingrédients si même nombre de portions', () => {
    const scaled = scaleIngredients(base, 4, 4);
    expect(scaled).toBe(base); // même référence
  });
});

// ─── aggregateIngredients ────────────────────────────────────────────────────

describe('aggregateIngredients', () => {
  it('fusionne les ingrédients avec même nom et unité', () => {
    const result = aggregateIngredients([
      { name: 'beurre', quantity: 50, unit: 'g' },
      { name: 'beurre', quantity: 30, unit: 'g' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(80);
  });

  it('ne fusionne pas si unité différente', () => {
    const result = aggregateIngredients([
      { name: 'lait', quantity: 200, unit: 'ml' },
      { name: 'lait', quantity: 1, unit: 'l' },
    ]);
    expect(result).toHaveLength(2);
  });
});

// ─── formatIngredient ────────────────────────────────────────────────────────

describe('formatIngredient', () => {
  it('formate "200 g de pâtes"', () => {
    expect(formatIngredient({ name: 'pâtes', quantity: 200, unit: 'g' })).toBe("200 g de pâtes");
  });

  it('formate "3 oeufs" (sans unité)', () => {
    expect(formatIngredient({ name: 'oeufs', quantity: 3, unit: '' })).toBe('3 oeufs');
  });

  it('formate "sel" (sans quantité)', () => {
    expect(formatIngredient({ name: 'sel', quantity: null, unit: '' })).toBe('sel');
  });

  it('utilise d\' devant voyelle', () => {
    expect(formatIngredient({ name: 'eau', quantity: 200, unit: 'ml' })).toBe("200 ml d'eau");
  });
});

// ─── categorizeIngredient ────────────────────────────────────────────────────

describe('categorizeIngredient', () => {
  it('classe le poulet dans Viandes', () => {
    expect(categorizeIngredient('poulet')).toBe('🥩 Viandes');
  });

  it('classe le saumon dans Poissons', () => {
    expect(categorizeIngredient('saumon')).toBe('🐟 Poissons');
  });

  it('classe le lait dans Crèmerie', () => {
    expect(categorizeIngredient('lait')).toBe('🧀 Crèmerie');
  });

  it('classe un produit inconnu dans Autres', () => {
    expect(categorizeIngredient('truc bizarre')).toBe('🛒 Autres');
  });
});

// ─── renderStepText ──────────────────────────────────────────────────────────

describe('renderStepText', () => {
  it('rend le texte avec quantités scalées', () => {
    const tokens = [
      { type: 'text' as const, value: 'Ajouter ' },
      { type: 'ingredient' as const, name: 'beurre', quantity: 100, unit: 'g' },
      { type: 'text' as const, value: ' fondu.' },
    ];
    const result = renderStepText(tokens, 2);
    expect(result).toContain('200');
    expect(result).toContain('beurre');
  });
});

// ─── convertCookToMetric ─────────────────────────────────────────────────────

describe('convertCookToMetric', () => {
  it('convertit les °F en °C', () => {
    const result = convertCookToMetric('Préchauffer à 425°F.');
    expect(result).toContain('220°C');
  });

  it('convertit les oz en g dans les tokens cooklang', () => {
    const result = convertCookToMetric('@beurre{4%oz}');
    expect(result).toContain('g');
    expect(result).not.toContain('oz');
  });

  it('convertit les cups en ml', () => {
    const result = convertCookToMetric('Add 2 cups of water.');
    expect(result).toContain('480 ml');
  });
});

// ─── generateCookFile ────────────────────────────────────────────────────────

describe('generateCookFile', () => {
  it('génère un fichier .cook avec metadata et étapes', () => {
    const result = generateCookFile({
      title: 'Pâtes Carbonara',
      servings: 4,
      tags: ['rapide', 'italien'],
      prepTime: '10 min',
      cookTime: '15 min',
      ingredients: [{ name: 'pâtes' }, { name: 'lardons' }],
      steps: ['Faire cuire les pâtes.', 'Faire revenir les lardons.'],
    });
    expect(result).toContain('>> title: Pâtes Carbonara');
    expect(result).toContain('>> servings: 4');
    expect(result).toContain('>> tags: rapide, italien');
    expect(result).toContain('Faire cuire les pâtes.');
    expect(result).toContain('Faire revenir les lardons.');
  });
});
