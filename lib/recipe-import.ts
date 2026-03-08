/**
 * recipe-import.ts — Import recipes from URLs
 *
 * Strategy:
 * 1. Fetch HTML from URL
 * 2. Try JSON-LD (schema.org/Recipe) — structured, reliable
 * 3. Fallback: fetch via defuddle.md API → parse markdown heuristically
 */

export interface ImportedRecipe {
  title: string;
  servings?: number;
  prepTime?: string;
  cookTime?: string;
  ingredients: string[];
  steps: string[];
  tags?: string[];
  sourceUrl: string;
}

// ─── JSON-LD extraction ────────────────────────────────────────────────────

/** Parse ISO 8601 duration (PT15M, PT1H30M) to human-readable French */
function parseDuration(iso?: string): string {
  if (!iso || typeof iso !== 'string') return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return '';
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const mins = match[2] ? parseInt(match[2], 10) : 0;
  if (hours > 0 && mins > 0) return `${hours}h${mins}min`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins} min`;
  return '';
}

/** Extract Recipe from JSON-LD blocks in HTML */
function extractJsonLd(html: string): ImportedRecipe | null {
  // Find all <script type="application/ld+json"> blocks
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const recipe = findRecipeInLd(data);
      if (recipe) return recipe;
    } catch {
      // malformed JSON, skip
    }
  }
  return null;
}

/** Recursively find a Recipe object in JSON-LD (can be nested in @graph) */
function findRecipeInLd(data: any): ImportedRecipe | null {
  if (!data) return null;

  // Direct Recipe object
  if (data['@type'] === 'Recipe' || (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
    return mapLdToRecipe(data);
  }

  // @graph array
  if (data['@graph'] && Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const found = findRecipeInLd(item);
      if (found) return found;
    }
  }

  // Array of objects
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInLd(item);
      if (found) return found;
    }
  }

  return null;
}

/** Map JSON-LD Recipe to our ImportedRecipe */
function mapLdToRecipe(ld: any): ImportedRecipe {
  const title = ld.name || 'Recette importée';

  // Servings
  let servings: number | undefined;
  if (ld.recipeYield) {
    const yieldStr = Array.isArray(ld.recipeYield) ? ld.recipeYield[0] : ld.recipeYield;
    const num = parseInt(String(yieldStr), 10);
    if (!isNaN(num) && num > 0) servings = num;
  }

  // Ingredients
  const ingredients: string[] = [];
  if (Array.isArray(ld.recipeIngredient)) {
    for (const ing of ld.recipeIngredient) {
      const text = String(ing).trim();
      if (text) ingredients.push(text);
    }
  }

  // Steps
  const steps: string[] = [];
  if (Array.isArray(ld.recipeInstructions)) {
    for (const step of ld.recipeInstructions) {
      if (typeof step === 'string') {
        const clean = step.trim();
        if (clean) steps.push(clean);
      } else if (step && step.text) {
        const clean = String(step.text).trim();
        if (clean) steps.push(clean);
      } else if (step && step['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
        for (const sub of step.itemListElement) {
          const text = sub.text || (typeof sub === 'string' ? sub : '');
          if (text.trim()) steps.push(text.trim());
        }
      }
    }
  } else if (typeof ld.recipeInstructions === 'string') {
    // Some sites put all instructions as a single string
    const parts = ld.recipeInstructions.split(/\n+/).map((s: string) => s.trim()).filter(Boolean);
    steps.push(...parts);
  }

  // Tags / category
  const tags: string[] = [];
  if (ld.recipeCategory) {
    const cats = Array.isArray(ld.recipeCategory) ? ld.recipeCategory : [ld.recipeCategory];
    tags.push(...cats.map((c: string) => String(c).trim()).filter(Boolean));
  }
  if (ld.recipeCuisine) {
    const cuisines = Array.isArray(ld.recipeCuisine) ? ld.recipeCuisine : [ld.recipeCuisine];
    tags.push(...cuisines.map((c: string) => String(c).trim()).filter(Boolean));
  }

  return {
    title,
    servings,
    prepTime: parseDuration(ld.prepTime),
    cookTime: parseDuration(ld.cookTime),
    ingredients,
    steps,
    tags: tags.length > 0 ? tags : undefined,
    sourceUrl: '',
  };
}

// ─── Defuddle fallback ─────────────────────────────────────────────────────

/** Fetch markdown via defuddle.md API and parse heuristically */
async function fetchViaDefuddle(url: string): Promise<ImportedRecipe | null> {
  try {
    const apiUrl = `https://md.defuddle.com?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const md = await res.text();
    return parseMarkdownRecipe(md, url);
  } catch {
    return null;
  }
}

/** Heuristic parser for recipe markdown */
function parseMarkdownRecipe(md: string, sourceUrl: string): ImportedRecipe | null {
  const lines = md.split('\n');
  if (lines.length < 5) return null;

  // Title = first H1 or H2
  let title = 'Recette importée';
  for (const line of lines) {
    const hMatch = line.match(/^#{1,2}\s+(.+)/);
    if (hMatch) {
      title = hMatch[1].trim();
      break;
    }
  }

  // Find ingredients section (look for header containing "ingrédient" or list after it)
  const ingredients: string[] = [];
  const steps: string[] = [];
  let section: 'unknown' | 'ingredients' | 'steps' = 'unknown';

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect section headers
    if (/^#{1,4}\s+/.test(line)) {
      if (/ingr[eé]dient|ingredients/i.test(lower)) {
        section = 'ingredients';
        continue;
      }
      if (/[eé]tape|instruction|pr[eé]paration|preparation|recette/i.test(lower)) {
        section = 'steps';
        continue;
      }
      // Other header = reset
      if (section !== 'unknown') section = 'unknown';
    }

    // Parse list items
    const listMatch = line.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      const text = listMatch[1].trim();
      if (section === 'ingredients') {
        ingredients.push(text);
      } else if (section === 'steps') {
        steps.push(text);
      }
    }

    // Numbered steps
    const numMatch = line.match(/^\d+[.)]\s+(.+)/);
    if (numMatch && section === 'steps') {
      steps.push(numMatch[1].trim());
    }
  }

  if (ingredients.length === 0 && steps.length === 0) return null;

  return {
    title,
    ingredients,
    steps,
    sourceUrl,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Import a recipe from a URL. Tries JSON-LD first, then defuddle fallback. */
export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  // 1. Fetch HTML directly
  let recipe: ImportedRecipe | null = null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FamilyVault/1.0)',
        'Accept': 'text/html',
      },
    });
    if (res.ok) {
      const html = await res.text();
      recipe = extractJsonLd(html);
    }
  } catch {
    // fetch failed, try defuddle
  }

  if (recipe) {
    recipe.sourceUrl = url;
    return recipe;
  }

  // 2. Fallback: defuddle
  recipe = await fetchViaDefuddle(url);
  if (recipe) {
    recipe.sourceUrl = url;
    return recipe;
  }

  throw new Error('Impossible d\'extraire une recette depuis cette URL. Vérifiez le lien.');
}
