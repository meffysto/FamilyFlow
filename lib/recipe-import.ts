/**
 * recipe-import.ts — Import recipes from URLs
 *
 * Strategy:
 * 1. cook.md — sends URL, polls for .cook file (best quality, uses LLM)
 * 2. Direct HTML fetch + JSON-LD extraction (fast, for sites with schema.org)
 */

declare const __DEV__: boolean;

/** Result from cook.md: raw .cook file content */
export interface CookImportResult {
  /** Raw .cook file content (frontmatter + cooklang steps) */
  cookContent: string;
  /** Title extracted from metadata for preview */
  title: string;
  /** Category suggestion from metadata */
  category?: string;
}

/** Result from JSON-LD fallback: structured data needing conversion */
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

export type ImportResult =
  | { type: 'cook'; data: CookImportResult }
  | { type: 'parsed'; data: ImportedRecipe };

// ─── cook.md integration ──────────────────────────────────────────────────

const COOK_MD_TIMEOUT = 90_000; // 90s max
const COOK_MD_POLL_INTERVAL = 3_000; // poll every 3s

/** Submit URL to cook.md → get cookify UUID from redirect or final page */
async function submitToCookMd(url: string): Promise<string | null> {
  try {
    // RN follows redirects automatically, so we land on /cookifies/{uuid} page
    const res = await fetch(`https://cook.md/${url}`);
    // Try to get UUID from the response URL (works if RN exposes it)
    const resUrl = res.url || '';
    const urlMatch = resUrl.match(/cookifies\/([a-f0-9-]+)/i);
    if (urlMatch) return urlMatch[1];
    // Fallback: extract UUID from the HTML body
    if (res.ok) {
      const body = await res.text();
      const bodyMatch = body.match(/cookifies\/([a-f0-9-]+)/i);
      if (bodyMatch) return bodyMatch[1];
    }
    return null;
  } catch (e) {
    if (__DEV__) console.log('[recipe-import] cook.md submit error:', e);
    return null;
  }
}

/** Parse .cook file metadata (frontmatter between --- markers) */
function parseCookMetadata(content: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return meta;
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.substring(0, idx).trim().toLowerCase();
      const value = line.substring(idx + 1).trim();
      if (key && value) meta[key] = value;
    }
  }
  return meta;
}

/** Poll cook.md for the .cook file until ready */
async function pollCookMd(uuid: string): Promise<CookImportResult | null> {
  const downloadUrl = `https://cook.md/cookifies/${uuid}/download`;
  const start = Date.now();

  while (Date.now() - start < COOK_MD_TIMEOUT) {
    try {
      const res = await fetch(downloadUrl);
      if (__DEV__) console.log('[recipe-import] poll status:', res.status, 'elapsed:', Math.round((Date.now() - start) / 1000), 's');
      if (res.status === 404) {
        await new Promise(r => setTimeout(r, COOK_MD_POLL_INTERVAL));
        continue;
      }
      if (res.ok) {
        const body = await res.text();
        if (__DEV__) console.log('[recipe-import] poll body length:', body.length, 'first 100:', body.substring(0, 100));
        // HTML = not ready yet (error page served as 200)
        if (body.trimStart().startsWith('<!DOCTYPE') || body.trimStart().startsWith('<html')) {
          await new Promise(r => setTimeout(r, COOK_MD_POLL_INTERVAL));
          continue;
        }
        // Validate it looks like a .cook file (--- frontmatter or >> metadata)
        if ((body.includes('---') || body.includes('>>')) && body.length > 50) {
          const meta = parseCookMetadata(body);
          return {
            cookContent: body,
            title: meta.title || 'Recette importée',
            category: meta.course || meta.cuisine || undefined,
          };
        }
        if (__DEV__) console.log('[recipe-import] poll: body not recognized as .cook');
      }
      // Other error (5xx etc) — keep polling, don't give up immediately
      await new Promise(r => setTimeout(r, COOK_MD_POLL_INTERVAL));
    } catch (e) {
      if (__DEV__) console.log('[recipe-import] poll error:', e);
      await new Promise(r => setTimeout(r, COOK_MD_POLL_INTERVAL));
    }
  }

  if (__DEV__) console.log('[recipe-import] cook.md timeout after', COOK_MD_TIMEOUT / 1000, 's');
  return null;
}

/** Import via cook.md: submit URL → poll → download .cook */
async function importViaCookMd(url: string, onStatus?: (msg: string) => void): Promise<CookImportResult | null> {
  onStatus?.('Envoi à cook.md…');
  const uuid = await submitToCookMd(url);
  if (!uuid) {
    if (__DEV__) console.log('[recipe-import] cook.md: no UUID from redirect');
    return null;
  }
  if (__DEV__) console.log('[recipe-import] cook.md UUID:', uuid);

  onStatus?.('Conversion en cours…');
  return pollCookMd(uuid);
}

// ─── JSON-LD fallback ─────────────────────────────────────────────────────

/** Strip HTML tags from a string */
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

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
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const recipe = findRecipeInLd(data);
      if (recipe) return recipe;
    } catch { /* skip malformed JSON */ }
  }
  return null;
}

/** Recursively find a Recipe object in JSON-LD */
function findRecipeInLd(data: any): ImportedRecipe | null {
  if (!data) return null;
  if (data['@type'] === 'Recipe' || (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
    return mapLdToRecipe(data);
  }
  if (data['@graph'] && Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const found = findRecipeInLd(item);
      if (found) return found;
    }
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInLd(item);
      if (found) return found;
    }
  }
  return null;
}

/** Map JSON-LD Recipe to ImportedRecipe */
function mapLdToRecipe(ld: any): ImportedRecipe {
  const title = ld.name || 'Recette importée';

  let servings: number | undefined;
  if (ld.recipeYield) {
    const yieldStr = Array.isArray(ld.recipeYield) ? ld.recipeYield[0] : ld.recipeYield;
    const num = parseInt(String(yieldStr), 10);
    if (!isNaN(num) && num > 0) servings = num;
  }

  const ingredients: string[] = [];
  if (Array.isArray(ld.recipeIngredient)) {
    for (const ing of ld.recipeIngredient) {
      const text = stripHtml(String(ing));
      if (text) ingredients.push(text);
    }
  }

  const steps: string[] = [];
  if (Array.isArray(ld.recipeInstructions)) {
    for (const step of ld.recipeInstructions) {
      if (typeof step === 'string') {
        const clean = stripHtml(step);
        if (clean) steps.push(clean);
      } else if (step && (step.text || step.description)) {
        const clean = stripHtml(String(step.text || step.description));
        if (clean) steps.push(clean);
      } else if (step && step['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
        for (const sub of step.itemListElement) {
          const raw = sub.text || sub.description || (typeof sub === 'string' ? sub : '');
          const text = stripHtml(String(raw));
          if (text) steps.push(text);
        }
      }
    }
  } else if (typeof ld.recipeInstructions === 'string') {
    const parts = ld.recipeInstructions.split(/\n+/).map((s: string) => s.trim()).filter(Boolean);
    steps.push(...parts);
  }

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
    title, servings,
    prepTime: parseDuration(ld.prepTime),
    cookTime: parseDuration(ld.cookTime),
    ingredients, steps,
    tags: tags.length > 0 ? tags : undefined,
    sourceUrl: '',
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Import a recipe from a URL.
 * 1. cook.md (best quality — LLM-powered cooklang conversion)
 * 2. Fallback: direct HTML fetch + JSON-LD
 */
export async function importRecipeFromUrl(
  url: string,
  onStatus?: (msg: string) => void,
): Promise<ImportResult> {
  // 1. Try cook.md (async, may take up to 90s)
  onStatus?.('Envoi à cook.md…');
  const cookResult = await importViaCookMd(url, onStatus);
  if (cookResult) {
    if (__DEV__) console.log('[recipe-import] cook.md success:', cookResult.title);
    return { type: 'cook', data: cookResult };
  }

  // 2. Fallback: direct HTML fetch + JSON-LD
  onStatus?.('Extraction JSON-LD…');
  try {
    if (__DEV__) console.log('[recipe-import] Fetching URL directly:', url);
    const res = await fetch(url);
    if (__DEV__) console.log('[recipe-import] Direct fetch status:', res.status);
    if (res.ok) {
      const html = await res.text();
      if (__DEV__) console.log('[recipe-import] HTML length:', html.length);
      const recipe = extractJsonLd(html);
      if (recipe) {
        recipe.sourceUrl = url;
        if (__DEV__) console.log('[recipe-import] JSON-LD success:', recipe.title);
        return { type: 'parsed', data: recipe };
      }
      if (__DEV__) console.log('[recipe-import] No JSON-LD found in page');
    }
  } catch (e) {
    if (__DEV__) console.log('[recipe-import] Direct fetch error:', e);
  }

  throw new Error('Impossible d\'extraire la recette. Le site ne contient pas de données structurées (JSON-LD).');
}

// ─── Text-to-recipe converter ────────────────────────────────────────────

/**
 * Parse raw text (pasted from email, book, WhatsApp, etc.) into a recipe.
 *
 * Heuristics:
 * - Title: first non-empty line (or shortest line in the first 3)
 * - Ingredients: lines matching qty+unit patterns, or bullet lists
 * - Steps: numbered paragraphs or remaining long lines
 * - Metadata: detects "portions/personnes" and "préparation/cuisson" mentions
 */
export function parseTextToRecipe(rawText: string): ImportResult {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('Le texte est vide.');

  // ── Extract title ──
  // First line, or shortest of first 3 lines if it looks like a title (< 60 chars)
  let titleIndex = 0;
  const firstThree = lines.slice(0, 3);
  const shortest = firstThree.reduce((best, line, i) =>
    line.length < firstThree[best].length ? i : best, 0);
  if (firstThree[shortest].length < 60) titleIndex = shortest;
  const title = lines[titleIndex]
    .replace(/^#+\s*/, '')  // strip markdown headers
    .replace(/^recette\s*:\s*/i, '')
    .trim();

  const remaining = lines.filter((_, i) => i !== titleIndex);

  // ── Detect ingredients vs steps ──
  const RE_INGREDIENT = /^[-•*·]\s+.+|^\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|dl|l|cs|cc|c\.\s*à\s*[sc]\.?|càs|càc|tbsp|tsp|tasse|pincée|sachet|tranche|gousse|botte|paquet|boîte|feuille|brin)\s+/i;
  const RE_NUMBERED_STEP = /^(?:\d+[\.\)]\s*|étape\s+\d+\s*[:\-]\s*)/i;
  const RE_SECTION_HEADER = /^(?:ingrédients?|étapes?|préparation|instructions?|pour\s+\d+|matériel)\s*:?\s*$/i;
  const RE_SERVINGS = /(?:pour\s+)?(\d+)\s*(?:personnes?|portions?|parts?|pers\.?)/i;
  const RE_PREP_TIME = /(?:préparation|prep)\s*:?\s*(\d+\s*(?:min|minutes?|h|heures?))/i;
  const RE_COOK_TIME = /(?:cuisson|cook)\s*:?\s*(\d+\s*(?:min|minutes?|h|heures?))/i;

  const ingredients: string[] = [];
  const steps: string[] = [];
  let servings: number | undefined;
  let prepTime = '';
  let cookTime = '';

  // First pass: extract metadata from any line
  for (const line of remaining) {
    const sm = line.match(RE_SERVINGS);
    if (sm && !servings) servings = parseInt(sm[1], 10);
    const pm = line.match(RE_PREP_TIME);
    if (pm && !prepTime) prepTime = pm[1];
    const cm = line.match(RE_COOK_TIME);
    if (cm && !cookTime) cookTime = cm[1];
  }

  // Detect if there are section headers to guide parsing
  let mode: 'auto' | 'ingredients' | 'steps' = 'auto';

  for (const line of remaining) {
    // Skip section headers themselves
    if (RE_SECTION_HEADER.test(line)) {
      if (/ingrédients?/i.test(line)) mode = 'ingredients';
      else if (/étapes?|préparation|instructions?/i.test(line)) mode = 'steps';
      continue;
    }

    // Skip pure metadata lines (already extracted)
    if (RE_SERVINGS.test(line) && !RE_INGREDIENT.test(line) && line.length < 40) continue;
    if (RE_PREP_TIME.test(line) && line.length < 40) continue;
    if (RE_COOK_TIME.test(line) && line.length < 40) continue;

    if (mode === 'ingredients') {
      // In explicit ingredients section: everything is an ingredient until next section
      const cleaned = line.replace(/^[-•*·]\s+/, '').trim();
      if (cleaned) ingredients.push(cleaned);
    } else if (mode === 'steps') {
      // In explicit steps section
      const cleaned = line.replace(RE_NUMBERED_STEP, '').trim();
      if (cleaned) steps.push(cleaned);
    } else {
      // Auto mode: heuristic detection
      if (RE_INGREDIENT.test(line)) {
        const cleaned = line.replace(/^[-•*·]\s+/, '').trim();
        ingredients.push(cleaned);
      } else if (RE_NUMBERED_STEP.test(line)) {
        const cleaned = line.replace(RE_NUMBERED_STEP, '').trim();
        if (cleaned) steps.push(cleaned);
      } else if (line.length > 80) {
        // Long lines are likely steps
        steps.push(line);
      } else if (line.length < 50 && /\d/.test(line)) {
        // Short lines with numbers → probably ingredient
        ingredients.push(line.replace(/^[-•*·]\s+/, '').trim());
      } else {
        // Default: treat as step if we already have ingredients, otherwise ingredient
        if (ingredients.length > 0 && steps.length > 0) {
          steps.push(line);
        } else if (ingredients.length > 0) {
          steps.push(line);
        } else {
          ingredients.push(line.replace(/^[-•*·]\s+/, '').trim());
        }
      }
    }
  }

  // If no steps detected, move long "ingredients" to steps
  if (steps.length === 0 && ingredients.length > 2) {
    const threshold = ingredients.length > 5 ? Math.floor(ingredients.length * 0.6) : 2;
    const longOnes = ingredients.filter(l => l.length > 60);
    if (longOnes.length > 0) {
      const kept: string[] = [];
      for (const ing of ingredients) {
        if (ing.length > 60) steps.push(ing);
        else kept.push(ing);
      }
      ingredients.length = 0;
      ingredients.push(...kept);
    }
  }

  if (ingredients.length === 0 && steps.length === 0) {
    throw new Error('Impossible de détecter les ingrédients ou les étapes dans ce texte.');
  }

  return {
    type: 'parsed',
    data: {
      title,
      servings,
      prepTime,
      cookTime,
      ingredients,
      steps,
      sourceUrl: '',
    },
  };
}
