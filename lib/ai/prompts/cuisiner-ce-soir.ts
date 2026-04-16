/**
 * cuisiner-ce-soir.ts — Prompt builder pour la suggestion "Que cuisiner ce soir ?"
 *
 * Toute itération sur le wording, les sections et la structure du prompt
 * se fait ICI. Le service réseau (lib/ai-service.ts) ne fait que livrer.
 *
 * Pipeline :
 *   1. Pré-filtrage des recettes selon le stock (rankRecipesByStock)
 *   2. Résolution des contraintes alimentaires de chaque profil
 *   3. Construction des messages system + user
 *   4. Support de "régénération" : exclusion explicite des suggestions précédentes
 *   5. Support d'un "refine" libre rédigé par l'utilisateur
 */

import type { StockItem, MealItem, HealthRecord, Profile } from '../../types';
import type { AppRecipe } from '../../cooklang';
import type { GuestProfile } from '../../dietary/types';
import { EU_ALLERGENS, COMMON_INTOLERANCES, COMMON_REGIMES } from '../../dietary/catalogs';

// ─── Types publics ──────────────────────────────────────────────────────────

export interface CookSuggestInput {
  stock: StockItem[];
  recipes: AppRecipe[];
  profiles: Profile[];
  guests?: GuestProfile[];
  meals?: MealItem[];
  healthRecords?: HealthRecord[];
  /** Texte libre supplémentaire saisi par l'utilisateur (ex: "rapide, sans riz") */
  refine?: string;
  /** Titres de recettes déjà proposées dans cette session (à éviter en régénération) */
  previousSuggestions?: string[];
  /** Combien de candidates passer à l'IA (par défaut 12) */
  maxCandidates?: number;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userContent: string;
  /** Recettes effectivement candidates envoyées (utile pour debug/log) */
  candidates: ScoredRecipe[];
}

export interface ScoredRecipe {
  recipe: AppRecipe;
  /** 0..1 — proportion d'ingrédients couverts par le stock */
  coverage: number;
  matched: string[];
  missing: string[];
}

// ─── Normalisation ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ─── Pré-filtrage par stock ────────────────────────────────────────────────

/**
 * Pour chaque recette, calcule la proportion d'ingrédients dispos dans le stock.
 * Matching par substring normalisé (conservateur, comme dietary.ts).
 * Les ingrédients sans `name` sont ignorés. Les recettes sans ingrédient → coverage 0.
 */
export function rankRecipesByStock(
  recipes: AppRecipe[],
  stock: StockItem[],
): ScoredRecipe[] {
  const stockNames = stock
    .filter(s => s.quantite > 0)
    .map(s => normalize(s.produit));

  const isInStock = (ingredient: string): boolean => {
    const ing = normalize(ingredient);
    if (!ing) return false;
    return stockNames.some(p => ing.includes(p) || p.includes(ing));
  };

  return recipes
    .map<ScoredRecipe>(recipe => {
      const ings = recipe.ingredients.map(i => i.name).filter(Boolean);
      if (ings.length === 0) {
        return { recipe, coverage: 0, matched: [], missing: [] };
      }
      const matched: string[] = [];
      const missing: string[] = [];
      for (const ing of ings) {
        (isInStock(ing) ? matched : missing).push(ing);
      }
      return {
        recipe,
        coverage: matched.length / ings.length,
        matched,
        missing,
      };
    })
    .sort((a, b) => b.coverage - a.coverage);
}

// ─── Résolution préférences alimentaires ───────────────────────────────────

interface ProfileConstraint {
  profileName: string;
  /** Termes formatés "label (alias1, alias2)" pour le système */
  allergies: string[];
  intolerances: string[];
  regimes: string[];
  aversions: string[];
}

function resolveCatalogLabel(
  id: string,
  catalog: typeof EU_ALLERGENS,
): string {
  const entry = catalog.find(e => e.id === id);
  if (!entry) return id;
  return entry.label;
}

function buildProfileConstraints(
  profiles: Profile[],
  guests: GuestProfile[],
): ProfileConstraint[] {
  const all: { name: string; profile: Profile | GuestProfile }[] = [
    ...profiles.map(p => ({ name: p.name, profile: p as Profile | GuestProfile })),
    ...guests.map(g => ({ name: `${g.name} (invité)`, profile: g as Profile | GuestProfile })),
  ];

  const result: ProfileConstraint[] = [];
  for (const { name, profile } of all) {
    const allergies = (profile.foodAllergies ?? []).map(id =>
      resolveCatalogLabel(id, EU_ALLERGENS),
    );
    const intolerances = (profile.foodIntolerances ?? []).map(id =>
      resolveCatalogLabel(id, COMMON_INTOLERANCES),
    );
    const regimes = (profile.foodRegimes ?? []).map(id =>
      resolveCatalogLabel(id, COMMON_REGIMES),
    );
    const aversions = profile.foodAversions ?? [];

    if (
      allergies.length === 0 &&
      intolerances.length === 0 &&
      regimes.length === 0 &&
      aversions.length === 0
    ) {
      continue;
    }
    result.push({ profileName: name, allergies, intolerances, regimes, aversions });
  }
  return result;
}

function formatConstraints(constraints: ProfileConstraint[]): string {
  if (constraints.length === 0) return '';
  const lines: string[] = [];
  for (const c of constraints) {
    const parts: string[] = [];
    if (c.allergies.length > 0) parts.push(`allergies: ${c.allergies.join(', ')}`);
    if (c.intolerances.length > 0) parts.push(`intolérances: ${c.intolerances.join(', ')}`);
    if (c.regimes.length > 0) parts.push(`régimes: ${c.regimes.join(', ')}`);
    if (c.aversions.length > 0) parts.push(`aversions: ${c.aversions.join(', ')}`);
    lines.push(`- ${c.profileName} → ${parts.join(' ; ')}`);
  }
  return lines.join('\n');
}

// ─── Health records (legacy) ────────────────────────────────────────────────

function formatHealthAllergies(healthRecords: HealthRecord[] | undefined): string {
  if (!healthRecords || healthRecords.length === 0) return '';
  return healthRecords
    .filter(h => h.allergies.length > 0)
    .map(h => `- ${h.enfant}: ${h.allergies.join(', ')}`)
    .join('\n');
}

// ─── Construction du prompt ────────────────────────────────────────────────

const DEFAULT_MAX_CANDIDATES = 12;
/** Seuil de coverage minimum pour qu'une recette soit candidate. */
const MIN_COVERAGE = 0.3;

export function buildCookSuggestPrompt(input: CookSuggestInput): BuiltPrompt {
  const {
    stock,
    recipes,
    profiles,
    guests = [],
    meals = [],
    healthRecords,
    refine,
    previousSuggestions = [],
    maxCandidates = DEFAULT_MAX_CANDIDATES,
  } = input;

  // 1. Pré-filtrage stock
  const ranked = rankRecipesByStock(recipes, stock);
  const candidates = ranked
    .filter(r => r.coverage >= MIN_COVERAGE || ranked.length <= maxCandidates)
    .slice(0, maxCandidates);

  // 2. Préférences alimentaires (nouvelles + legacy healthRecords)
  const dietaryConstraints = buildProfileConstraints(profiles, guests);
  const dietaryBlock = formatConstraints(dietaryConstraints);
  const healthBlock = formatHealthAllergies(healthRecords);

  // 3. Famille (pour le ton)
  const family = profiles
    .map(p => `${p.name} (${p.role})`)
    .join(', ');

  // 4. Stock disponible
  const stockBlock = stock
    .filter(s => s.quantite > 0)
    .map(s => `- ${s.produit}: ${s.quantite}${s.detail ? ` (${s.detail})` : ''}`)
    .join('\n');

  // 5. Recettes candidates avec couverture
  const recipeBlock = candidates
    .map(c => {
      const cov = Math.round(c.coverage * 100);
      const matched = c.matched.length > 0 ? `dispo: ${c.matched.join(', ')}` : 'dispo: —';
      const missing = c.missing.length > 0 ? `manque: ${c.missing.join(', ')}` : 'manque: rien';
      return `- "${c.recipe.title}" [${cov}% en stock] · ${matched} · ${missing}`;
    })
    .join('\n');

  // 6. Repas planifiés (anti-doublon)
  const recentMealsBlock = meals
    .filter(m => m.text.trim().length > 0)
    .map(m => `- ${m.day} ${m.mealType}: ${m.text}`)
    .join('\n');

  // 7. Suggestions précédentes (pour régénération)
  const previousBlock = previousSuggestions.length > 0
    ? previousSuggestions.map(t => `- ${t}`).join('\n')
    : '';

  // ── Assemblage ───────────────────────────────────────────────────────────

  const systemLines: string[] = [
    'Tu es un assistant cuisine familial. Sois concis, factuel et utile.',
    `Famille : ${family || 'non renseignée'}.`,
  ];
  if (dietaryBlock) {
    systemLines.push(
      '⚠️ Préférences alimentaires (RESPECTER STRICTEMENT) :',
      dietaryBlock,
      'Ne suggère JAMAIS de recette contenant un allergène, un aliment du régime ou une aversion listés ci-dessus.',
    );
  }
  if (healthBlock) {
    systemLines.push(
      '⚠️ Allergies dossiers santé (RESPECTER STRICTEMENT) :',
      healthBlock,
    );
  }
  systemLines.push(
    'Réponds en français, format court Markdown, une recette par paragraphe, emoji en début de ligne.',
    'N\'INVENTE PAS d\'ingrédient absent du stock — base-toi sur les recettes proposées et leur couverture.',
  );

  const userLines: string[] = [
    'Stock actuel :',
    stockBlock || '(stock vide)',
    '',
    candidates.length > 0
      ? 'Recettes candidates classées par couverture stock :'
      : 'Aucune recette candidate avec ce stock — propose une recette simple à partir du stock.',
  ];
  if (candidates.length > 0) {
    userLines.push(recipeBlock);
  }
  if (recentMealsBlock) {
    userLines.push('', 'Repas déjà planifiés cette semaine (évite les doublons) :', recentMealsBlock);
  }
  if (previousBlock) {
    userLines.push(
      '',
      'Suggestions déjà données dans cette session (PROPOSE AUTRE CHOSE) :',
      previousBlock,
    );
  }
  if (refine && refine.trim()) {
    userLines.push('', `Contrainte supplémentaire de l'utilisateur : ${refine.trim()}`);
  }
  userLines.push(
    '',
    'Suggère 2 ou 3 recettes adaptées. Pour chaque recette :',
    '- 🍴 **Titre exact** (reprends le titre tel qu\'écrit dans la liste candidate)',
    '- ✅ Ce que j\'ai en stock',
    '- 🛒 Ce qui manque (max 2 ingrédients) — sinon écris "rien à acheter"',
    '- 💡 Une raison courte du choix',
  );

  return {
    systemPrompt: systemLines.join('\n'),
    userContent: userLines.join('\n'),
    candidates,
  };
}
