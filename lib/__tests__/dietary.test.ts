/**
 * Tests unitaires — dietary.ts (Plan 15-03)
 *
 * Couvre la fonction pure checkAllergens (PREF-09 + ARCH-03).
 * Minimum 5 cas obligatoires selon ARCH-03 :
 *   1. allergie évidente
 *   2. intolérance évidente
 *   3. faux positif évité
 *   4. faux négatif détecté (via alias)
 *   5. recette saine
 *
 * Fixtures : noms génériques (Lucas, Emma) — pas de noms personnels réels.
 */

import { checkAllergens, normalizeText } from '../dietary';
import type { AppRecipe } from '../cooklang';
import type { Profile } from '../types';
import type { GuestProfile } from '../dietary/types';

// ─── Helpers fixtures ────────────────────────────────────────────────────────

function makeRecipe(ingredientNames: string[]): AppRecipe {
  return {
    id: 'test-recipe',
    title: 'Recette test',
    sourceFile: 'Recettes/Test/recette.cook',
    category: 'Test',
    tags: [],
    servings: 4,
    prepTime: '',
    cookTime: '',
    ingredients: ingredientNames.map(name => ({ name, quantity: null, unit: '' })),
    steps: [],
    cookware: [],
  };
}

function makeProfile(
  id: string,
  name: string,
  overrides: Partial<{
    foodAllergies: string[];
    foodIntolerances: string[];
    foodRegimes: string[];
    foodAversions: string[];
  }> = {},
): Profile {
  return {
    id,
    name,
    role: 'adulte',
    avatar: '🧑',
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
    mascotPlacements: {},
    foodAllergies: overrides.foodAllergies ?? [],
    foodIntolerances: overrides.foodIntolerances ?? [],
    foodRegimes: overrides.foodRegimes ?? [],
    foodAversions: overrides.foodAversions ?? [],
  } as unknown as Profile;
}

function makeGuest(
  id: string,
  name: string,
  overrides: Partial<GuestProfile> = {},
): GuestProfile {
  return {
    id,
    name,
    foodAllergies: overrides.foodAllergies ?? [],
    foodIntolerances: overrides.foodIntolerances ?? [],
    foodRegimes: overrides.foodRegimes ?? [],
    foodAversions: overrides.foodAversions ?? [],
  };
}

// ─── normalizeText ───────────────────────────────────────────────────────────

describe('normalizeText', () => {
  it('supprime les accents et met en minuscules', () => {
    expect(normalizeText('Crème Fraîche')).toBe('creme fraiche');
    expect(normalizeText('Cacahuètes')).toBe('cacahuetes');
    expect(normalizeText('Épeautre')).toBe('epeautre');
  });

  it('supprime les espaces en début/fin', () => {
    expect(normalizeText('  beurre  ')).toBe('beurre');
  });
});

// ─── checkAllergens — cas ARCH-03 ────────────────────────────────────────────

describe('checkAllergens', () => {
  const noGuests: GuestProfile[] = [];

  // Test 1 — allergie évidente : arachides → cacahuètes grillées
  it('allergie évidente : détecte arachides dans une recette avec cacahuètes grillées', () => {
    const recipe = makeRecipe(['cacahuètes grillées']);
    const lucas = makeProfile('lucas', 'Lucas', { foodAllergies: ['arachides'] });
    const conflicts = checkAllergens(recipe, ['lucas'], [lucas], noGuests);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('allergie');
    expect(conflicts[0].matchedAllergen).toBe('arachides');
    expect(conflicts[0].profileIds).toContain('lucas');
    expect(conflicts[0].ingredientName).toBe('cacahuètes grillées');
  });

  // Test 2 — intolérance évidente : lactose → crème fraîche
  it('intolérance évidente : détecte lactose dans une recette avec crème fraîche', () => {
    const recipe = makeRecipe(['crème fraîche']);
    const emma = makeProfile('emma', 'Emma', { foodIntolerances: ['lactose'] });
    const conflicts = checkAllergens(recipe, ['emma'], [emma], noGuests);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('intolerance');
    expect(conflicts[0].profileIds).toContain('emma');
  });

  // Test 3 — faux positif évité : profil sans contrainte, recette au beurre → aucun conflit
  it('faux positif évité : profil sans contrainte alimentaire → aucun conflit sur beurre', () => {
    const recipe = makeRecipe(['beurre demi-sel']);
    const lucas = makeProfile('lucas', 'Lucas'); // aucune contrainte
    const conflicts = checkAllergens(recipe, ['lucas'], [lucas], noGuests);

    expect(conflicts).toHaveLength(0);
  });

  // Test 4 — faux négatif détecté : lait → yaourt via alias
  it('faux négatif détecté : lait matché via alias yaourt nature', () => {
    const recipe = makeRecipe(['yaourt nature']);
    const emma = makeProfile('emma', 'Emma', { foodAllergies: ['lait'] });
    const conflicts = checkAllergens(recipe, ['emma'], [emma], noGuests);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].matchedAllergen).toBe('lait');
    expect(conflicts[0].severity).toBe('allergie');
  });

  // Test 5 — recette saine : gluten, mais uniquement riz et courgette → aucun conflit
  it('recette saine : allergie gluten, recette riz + courgette → aucun conflit', () => {
    const recipe = makeRecipe(['riz basmati', 'courgette']);
    const lucas = makeProfile('lucas', 'Lucas', { foodAllergies: ['gluten'] });
    const conflicts = checkAllergens(recipe, ['lucas'], [lucas], noGuests);

    expect(conflicts).toHaveLength(0);
  });

  // Test 6 bonus — même ingrédient, plusieurs profils → profileIds contient les deux
  it('plusieurs profils avec la même contrainte → profileIds fusion', () => {
    const recipe = makeRecipe(['cacahuètes']);
    const lucas = makeProfile('lucas', 'Lucas', { foodAllergies: ['arachides'] });
    const emma = makeProfile('emma', 'Emma', { foodAllergies: ['arachides'] });
    const conflicts = checkAllergens(recipe, ['lucas', 'emma'], [lucas, emma], noGuests);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].profileIds).toContain('lucas');
    expect(conflicts[0].profileIds).toContain('emma');
    expect(conflicts[0].profileIds).toHaveLength(2);
  });

  // Test 7 bonus — conservatisme : lait → mozzarella di bufala (substring match)
  it('conservatisme : lait matché via mozzarella di bufala (substring)', () => {
    const recipe = makeRecipe(['mozzarella di bufala']);
    const lucas = makeProfile('lucas', 'Lucas', { foodAllergies: ['lait'] });
    const conflicts = checkAllergens(recipe, ['lucas'], [lucas], noGuests);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].matchedAllergen).toBe('lait');
  });

  // Test invité — checkAllergens prend aussi en compte les invités GuestProfile
  it('fonctionne avec un invité (GuestProfile) à la place d\'un profil enregistré', () => {
    const recipe = makeRecipe(['pain complet']);
    const invité = makeGuest('invite_1', 'Invité', { foodAllergies: ['gluten'] });
    const conflicts = checkAllergens(recipe, ['invite_1'], [], [invité]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('allergie');
    expect(conflicts[0].profileIds).toContain('invite_1');
  });

  // Test sévérité — aversion texte libre matché par substring
  it('aversion texte libre matché par substring dans le nom de l\'ingrédient', () => {
    const recipe = makeRecipe(['coriandre fraîche']);
    const emma = makeProfile('emma', 'Emma', { foodAversions: ['coriandre'] });
    const conflicts = checkAllergens(recipe, ['emma'], [emma], noGuests);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('aversion');
  });
});
