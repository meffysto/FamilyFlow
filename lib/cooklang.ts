/**
 * cooklang.ts — Lightweight cooklang parser compatible with Hermes (React Native).
 *
 * Replaces @cooklang/cooklang-ts which uses Unicode regex properties (\p{P}, \p{Zs})
 * not supported by Hermes, causing silent parsing failures at runtime.
 */

declare const __DEV__: boolean;

// ─── App types ──────────────────────────────────────────────────────────────

export interface AppRecipe {
  id: string;
  title: string;
  sourceFile: string;
  category: string;
  tags: string[];
  servings: number;
  prepTime: string;
  cookTime: string;
  ingredients: AppIngredient[];
  steps: AppStep[];
  cookware: string[];
}

export interface AppIngredient {
  name: string;
  quantity: number | null;
  unit: string;
}

export interface StepToken {
  type: 'text' | 'ingredient' | 'cookware' | 'timer';
  value?: string;
  name?: string;
  quantity?: number | null;
  unit?: string;
}

export interface AppStep {
  number: number;
  text: string;
  tokens: StepToken[];
  ingredients: AppIngredient[];
  timers: { name: string; duration: number; unit: string }[];
}

// ─── Lightweight Cooklang Parser (Hermes-safe) ──────────────────────────────

interface ParsedToken {
  type: 'text' | 'ingredient' | 'cookware' | 'timer';
  value?: string;      // for text
  name?: string;       // for ingredient/cookware/timer
  quantity?: string | number;
  units?: string;
}

interface ParseResult {
  metadata: Record<string, string>;
  ingredients: { name: string; quantity: string | number; units: string }[];
  cookwares: { name: string }[];
  steps: ParsedToken[][];
}

/** Metadata line: >> key: value */
const RE_METADATA = /^>>\s*(.+?):\s*(.+)/;

/** Comment: -- ... */
const RE_COMMENT = /--.*/g;

/** Block comment: [- ... -] */
const RE_BLOCK_COMMENT = /\[-[\s\S]*?-\]/g;

/**
 * Tokens in a step line. Hermes-safe (no \p{} Unicode properties).
 * Matches:
 *   @multi word name{qty%unit}   — multiword ingredient
 *   @singleword                  — single word ingredient
 *   #multi word name{qty}        — multiword cookware
 *   #singleword                  — single word cookware
 *   ~name{qty%unit}              — timer
 *
 * Also handles () as alternative to {} (cook.md format).
 */
const RE_TOKEN = /@([^@#~{\n]+?)\{([^}]*)\}|@([^@#~{\s,;.!?()[\]]+)|#([^@#~{\n]+?)\{([^}]*)\}|#([^@#~{\s,;.!?()[\]]+)|~([^{]*?)\{([^}]*)\}/g;

function parseCooklangSource(source: string): ParseResult {
  const metadata: Record<string, string> = {};
  const ingredients: ParseResult['ingredients'] = [];
  const cookwares: ParseResult['cookwares'] = [];
  const steps: ParsedToken[][] = [];

  // Strip comments
  let cleaned = source.replace(RE_BLOCK_COMMENT, ' ').replace(RE_COMMENT, '');

  // Normalize () → {} for @ingredients (cook.md format)
  cleaned = cleaned.replace(/@([^\s@#~({\n][^@#~({\n]*?)\(([^)]*)\)/g, '@$1{$2}');

  // Remove orphan {notes} after ingredient/cookware tokens (cook.md inline notes)
  cleaned = cleaned.replace(/\}\{[^}]+\}/g, '}');

  const lines = cleaned.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Metadata
    const metaMatch = trimmed.match(RE_METADATA);
    if (metaMatch) {
      metadata[metaMatch[1].trim()] = metaMatch[2].trim();
      continue;
    }

    // Step line — tokenize
    const step: ParsedToken[] = [];
    let lastIndex = 0;
    const tokenRe = new RegExp(RE_TOKEN.source, 'g');
    let m: RegExpExecArray | null;

    while ((m = tokenRe.exec(trimmed)) !== null) {
      // Push preceding text
      if (m.index > lastIndex) {
        step.push({ type: 'text', value: trimmed.substring(lastIndex, m.index) });
      }

      if (m[1] !== undefined) {
        // Multiword ingredient: @name{qty%unit}
        const { qty, units } = parseQtyUnits(m[2]);
        const ing = { name: m[1].trim(), quantity: qty, units };
        ingredients.push(ing);
        step.push({ type: 'ingredient', name: ing.name, quantity: ing.quantity, units: ing.units });
      } else if (m[3] !== undefined) {
        // Single word ingredient: @word
        const ing = { name: m[3], quantity: 'some' as string | number, units: '' };
        ingredients.push(ing);
        step.push({ type: 'ingredient', name: ing.name, quantity: ing.quantity, units: '' });
      } else if (m[4] !== undefined) {
        // Multiword cookware: #name{qty}
        cookwares.push({ name: m[4].trim() });
        step.push({ type: 'cookware', name: m[4].trim() });
      } else if (m[6] !== undefined) {
        // Single word cookware: #word
        cookwares.push({ name: m[6] });
        step.push({ type: 'cookware', name: m[6] });
      } else if (m[7] !== undefined) {
        // Timer: ~name{qty%unit}
        const { qty, units } = parseQtyUnits(m[8]);
        step.push({ type: 'timer', name: m[7].trim(), quantity: qty, units });
      }

      lastIndex = m.index + m[0].length;
    }

    // Trailing text
    if (lastIndex < trimmed.length) {
      step.push({ type: 'text', value: trimmed.substring(lastIndex) });
    }

    if (step.length > 0) {
      steps.push(step);
    }
  }

  return { metadata, ingredients, cookwares, steps };
}

function parseQtyUnits(raw: string): { qty: string | number; units: string } {
  if (!raw || !raw.trim()) return { qty: 'some', units: '' };
  const parts = raw.split('%');
  const qtyStr = parts[0].trim();
  const units = parts[1]?.trim() || '';
  // Try numeric
  const num = parseFloat(qtyStr.replace(',', '.'));
  const qty = !isNaN(num) ? num : qtyStr || 'some';
  return { qty, units };
}

// ─── Strip YAML frontmatter ────────────────────────────────────────────────

function extractFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, body: content };
  const metadata: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      metadata[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { metadata, body: match[2] };
}

// ─── Public: parseRecipe ────────────────────────────────────────────────────

/** Parse a .cook file content into an AppRecipe */
export function parseRecipe(sourceFile: string, content: string): AppRecipe {
  const { metadata: frontmatter, body } = extractFrontmatter(content);
  const parsed = parseCooklangSource(body);

  // Merge: frontmatter overrides cooklang >> metadata
  const meta = { ...parsed.metadata, ...frontmatter };

  if (__DEV__) {
    console.log('[cooklang] parseRecipe:', sourceFile);
    console.log('[cooklang] ingredients count:', parsed.ingredients.length);
    console.log('[cooklang] steps count:', parsed.steps.length);
  }

  // Extract title from metadata or filename
  const pathParts = sourceFile.split('/');
  const fileName = pathParts[pathParts.length - 1].replace('.cook', '');
  const category = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';

  const title = meta.title || fileName;
  const tags = meta.tags
    ? meta.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : [];
  const servings = parseInt(meta.servings || meta.portions || '4', 10) || 4;
  const prepTime = meta['prep time'] || meta.prepTime || meta['time required'] || '';
  const cookTime = meta['cook time'] || meta.cookTime || meta.cuisson || '';

  // Map ingredients — from cooklang inline syntax, or from metadata fallback
  let ingredients: AppIngredient[] = parsed.ingredients.map((ing) => ({
    name: translateIngredient(ing.name),
    quantity: typeof ing.quantity === 'number' ? ing.quantity : parseFloat(String(ing.quantity)) || null,
    unit: normalizeUnit(ing.units || ''),
  }));
  // Deduplicate by name (same ingredient in multiple steps)
  const seen = new Map<string, AppIngredient>();
  for (const ing of ingredients) {
    const key = ing.name.toLowerCase().trim();
    if (!seen.has(key)) seen.set(key, ing);
  }
  ingredients = [...seen.values()];

  if (ingredients.length === 0 && meta.ingredients) {
    ingredients = meta.ingredients
      .split('|')
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((s: string) => parseIngredientText(s));
  }

  // Map cookware
  const cookware = [...new Set(parsed.cookwares.map((c) => c.name))];

  // Map steps — store tokens for dynamic re-rendering on scale
  const steps: AppStep[] = parsed.steps.map((step, idx) => {
    const stepIngredients: AppIngredient[] = [];
    const stepTimers: { name: string; duration: number; unit: string }[] = [];
    const tokens: StepToken[] = [];

    const text = step.map((token) => {
      if (token.type === 'text') {
        tokens.push({ type: 'text', value: token.value || '' });
        return token.value || '';
      }
      if (token.type === 'ingredient') {
        const qty = typeof token.quantity === 'number' ? token.quantity : parseFloat(String(token.quantity)) || null;
        const unit = normalizeUnit(token.units || '');
        const name = translateIngredient(token.name || '');
        stepIngredients.push({ name, quantity: qty, unit });
        tokens.push({ type: 'ingredient', name, quantity: qty, unit });
        return renderIngredientToken(token.name || '', qty, unit);
      }
      if (token.type === 'cookware') {
        tokens.push({ type: 'cookware', name: token.name || '' });
        return token.name || '';
      }
      if (token.type === 'timer') {
        const dur = typeof token.quantity === 'number' ? token.quantity : parseFloat(String(token.quantity)) || 0;
        const unit = token.units || 'minutes';
        stepTimers.push({ name: token.name || '', duration: dur, unit });
        tokens.push({ type: 'timer', name: token.name || '', quantity: dur, unit });
        return `${token.quantity} ${token.units}`;
      }
      return '';
    }).join('');

    return { number: idx + 1, text, tokens, ingredients: stepIngredients, timers: stepTimers };
  });

  const id = sourceFile.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  return { id, title, sourceFile, category, tags, servings, prepTime, cookTime, ingredients, steps, cookware };
}

// ─── Unit normalization (EN → FR) ───────────────────────────────────────────

const UNIT_FR: Record<string, string> = {
  tbsp: 'c. à s.', tbs: 'c. à s.', tablespoon: 'c. à s.', tablespoons: 'c. à s.',
  tsp: 'c. à c.', teaspoon: 'c. à c.', teaspoons: 'c. à c.',
  cup: 'tasse', cups: 'tasses',
  oz: 'g', ounce: 'g', ounces: 'g',
  lb: 'g', pound: 'g', pounds: 'g',
  pinch: 'pincée', clove: 'gousse', cloves: 'gousses',
  slice: 'tranche', slices: 'tranches',
  bunch: 'botte', packet: 'paquet', can: 'boîte',
  piece: 'pièce', pieces: 'pièces',
  handful: 'poignée', sprig: 'brin', sprigs: 'brins',
  leaf: 'feuille', leaves: 'feuilles',
};

/** Common EN → FR ingredient name translations */
const INGREDIENT_FR: Record<string, string> = {
  // Dairy
  butter: 'beurre', 'melted butter': 'beurre fondu', 'unsalted butter': 'beurre doux', 'salted butter': 'beurre salé',
  milk: 'lait', 'whole milk': 'lait entier', 'skimmed milk': 'lait écrémé', cream: 'crème', 'heavy cream': 'crème épaisse',
  'whipping cream': 'crème liquide', 'sour cream': 'crème aigre', cheese: 'fromage', 'cream cheese': 'fromage frais',
  yogurt: 'yaourt', yoghurt: 'yaourt',
  // Eggs
  egg: 'oeuf', eggs: 'oeufs', 'egg yolk': 'jaune d\'oeuf', 'egg yolks': 'jaunes d\'oeuf',
  'egg white': 'blanc d\'oeuf', 'egg whites': 'blancs d\'oeuf', 'whole eggs': 'oeufs entiers',
  // Flour & baking
  flour: 'farine', 'all-purpose flour': 'farine', 'bread flour': 'farine de blé', 'cake flour': 'farine pâtissière',
  sugar: 'sucre', 'white sugar': 'sucre', 'brown sugar': 'sucre roux', 'powdered sugar': 'sucre glace',
  'icing sugar': 'sucre glace', 'granulated sugar': 'sucre en poudre', 'caster sugar': 'sucre fin',
  'baking powder': 'levure chimique', 'baking soda': 'bicarbonate', yeast: 'levure',
  'vanilla extract': 'extrait de vanille', vanilla: 'vanille', 'vanilla sugar': 'sucre vanillé',
  cocoa: 'cacao', 'cocoa powder': 'cacao en poudre', chocolate: 'chocolat', 'dark chocolate': 'chocolat noir',
  cornstarch: 'maïzena', 'corn starch': 'maïzena',
  // Oils & fats
  oil: 'huile', 'olive oil': 'huile d\'olive', 'vegetable oil': 'huile végétale',
  'sunflower oil': 'huile de tournesol', 'coconut oil': 'huile de coco',
  // Salt, pepper, spices
  salt: 'sel', pepper: 'poivre', 'black pepper': 'poivre noir', 'ground pepper': 'poivre moulu',
  cinnamon: 'cannelle', nutmeg: 'muscade', cumin: 'cumin', paprika: 'paprika', curry: 'curry',
  turmeric: 'curcuma', ginger: 'gingembre', thyme: 'thym', rosemary: 'romarin', basil: 'basilic',
  parsley: 'persil', cilantro: 'coriandre', coriander: 'coriandre', oregano: 'origan',
  'bay leaf': 'feuille de laurier', 'bay leaves': 'feuilles de laurier', chives: 'ciboulette',
  // Produce
  garlic: 'ail', 'garlic clove': 'gousse d\'ail', 'garlic cloves': 'gousses d\'ail',
  onion: 'oignon', onions: 'oignons', shallot: 'échalote', shallots: 'échalotes',
  tomato: 'tomate', tomatoes: 'tomates', potato: 'pomme de terre', potatoes: 'pommes de terre',
  carrot: 'carotte', carrots: 'carottes', celery: 'céleri', leek: 'poireau', leeks: 'poireaux',
  mushroom: 'champignon', mushrooms: 'champignons', zucchini: 'courgette', eggplant: 'aubergine',
  spinach: 'épinards', lettuce: 'laitue', cucumber: 'concombre', 'bell pepper': 'poivron',
  avocado: 'avocat', broccoli: 'brocoli', cabbage: 'chou', 'green beans': 'haricots verts',
  peas: 'petits pois', corn: 'maïs', turnip: 'navet', radish: 'radis', beet: 'betterave',
  // Fruit
  lemon: 'citron', 'lemon juice': 'jus de citron', 'lemon zest': 'zeste de citron',
  orange: 'orange', 'orange juice': 'jus d\'orange', 'orange zest': 'zeste d\'orange',
  apple: 'pomme', apples: 'pommes', banana: 'banane', strawberry: 'fraise', strawberries: 'fraises',
  raspberry: 'framboise', raspberries: 'framboises', blueberry: 'myrtille', blueberries: 'myrtilles',
  // Protein
  chicken: 'poulet', 'chicken breast': 'blanc de poulet', beef: 'boeuf', pork: 'porc',
  lamb: 'agneau', veal: 'veau', turkey: 'dinde', duck: 'canard', bacon: 'lardons',
  ham: 'jambon', sausage: 'saucisse', 'ground beef': 'boeuf haché', 'ground meat': 'viande hachée',
  salmon: 'saumon', tuna: 'thon', shrimp: 'crevettes', cod: 'cabillaud', fish: 'poisson',
  // Pantry
  rice: 'riz', pasta: 'pâtes', noodles: 'nouilles', bread: 'pain', 'bread crumbs': 'chapelure',
  honey: 'miel', 'maple syrup': 'sirop d\'érable', jam: 'confiture',
  'soy sauce': 'sauce soja', vinegar: 'vinaigre', mustard: 'moutarde', ketchup: 'ketchup',
  'tomato paste': 'concentré de tomate', 'tomato sauce': 'sauce tomate',
  broth: 'bouillon', stock: 'bouillon', 'chicken broth': 'bouillon de poulet',
  'coconut milk': 'lait de coco', water: 'eau', wine: 'vin', 'white wine': 'vin blanc', 'red wine': 'vin rouge',
  rum: 'rhum', beer: 'bière',
  // Nuts
  almond: 'amande', almonds: 'amandes', walnut: 'noix', walnuts: 'noix',
  hazelnut: 'noisette', hazelnuts: 'noisettes', peanut: 'cacahuète', peanuts: 'cacahuètes',
  // Adjective forms
  'grated nutmeg': 'muscade râpée', 'ground nutmeg': 'muscade moulue',
  'grated cheese': 'fromage râpé',
  'fresh cream': 'crème fraîche', 'whipped cream': 'crème fouettée',
  'chopped parsley': 'persil haché', 'fresh basil': 'basilic frais',
  'minced garlic': 'ail émincé', 'diced onion': 'oignon coupé',
};

/** Normalize unit to French */
function normalizeUnit(unit: string): string {
  if (!unit) return '';
  return UNIT_FR[unit.toLowerCase()] || unit;
}

/** Translate ingredient name to French if known */
function translateIngredient(name: string): string {
  const lower = name.toLowerCase().trim();
  // Exact match first
  if (INGREDIENT_FR[lower]) return INGREDIENT_FR[lower];
  // Try without common EN adjectives (grated, fresh, melted, etc.)
  const stripped = lower.replace(/^(grated|ground|fresh|melted|chopped|minced|diced|sliced|dried|whole|raw|cooked|frozen|crushed|toasted)\s+/, '');
  if (stripped !== lower && INGREDIENT_FR[stripped]) return INGREDIENT_FR[stripped];
  return name;
}

/** Normalize ingredient name: lowercase, trim, remove accents for comparison */
function normalizeIngredientName(name: string): string {
  return translateIngredient(name).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── Rendering helpers ──────────────────────────────────────────────────────

/** Render a single ingredient token as French text */
function renderIngredientToken(name: string, qty: number | null, unit: string): string {
  if (qty !== null && unit) {
    const startsWithVowel = /^[aeiouyéèêëàâùûîïôh]/i.test(name);
    const de = startsWithVowel ? "d'" : 'de ';
    return `${qty} ${unit} ${de}${name}`;
  }
  if (qty !== null) return `${qty} ${name}`;
  return name;
}

/** Re-render step text with scaled quantities */
export function renderStepText(tokens: StepToken[], factor: number): string {
  return tokens.map((t) => {
    if (t.type === 'text') return t.value || '';
    if (t.type === 'ingredient') {
      const scaled = t.quantity != null ? Math.round(t.quantity * factor * 100) / 100 : null;
      return renderIngredientToken(t.name || '', scaled, t.unit || '');
    }
    if (t.type === 'cookware') return t.name || '';
    if (t.type === 'timer') return `${t.quantity} ${t.unit}`;
    return '';
  }).join('');
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Scale ingredient quantities by a factor */
export function scaleIngredients(ingredients: AppIngredient[], targetServings: number, baseServings: number): AppIngredient[] {
  if (baseServings <= 0 || targetServings === baseServings) return ingredients;
  const factor = targetServings / baseServings;
  return ingredients.map((ing) => ({
    ...ing,
    quantity: ing.quantity !== null ? Math.round(ing.quantity * factor * 100) / 100 : null,
  }));
}

/** Aggregate ingredients from multiple recipes, merging same name+unit */
export function aggregateIngredients(allIngredients: AppIngredient[]): AppIngredient[] {
  const map = new Map<string, AppIngredient>();
  for (const ing of allIngredients) {
    const key = `${normalizeIngredientName(ing.name)}|${normalizeUnit(ing.unit).toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        quantity: existing.quantity !== null && ing.quantity !== null
          ? existing.quantity + ing.quantity
          : existing.quantity ?? ing.quantity,
      });
    } else {
      map.set(key, { ...ing });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Map ingredient name to shopping category */
const CATEGORY_MAP: [RegExp, string][] = [
  [/poulet|bœuf|boeuf|porc|veau|agneau|steak|saucisse|jambon|lardons|bacon|viande|dinde|canard|merguez|guanciale/i, '🥩 Viandes'],
  [/saumon|thon|crevette|poisson|cabillaud|moule|calamar|sardine/i, '🐟 Poissons'],
  [/lait|crème|beurre|fromage|yaourt|yogourt|mascarpone|ricotta|mozzarella|gruyère|parmesan|pecorino|emmental|comté/i, '🧀 Crèmerie'],
  [/œuf|oeuf/i, '🥚 Œufs'],
  [/tomate|oignon|ail|carotte|courgette|poivron|salade|épinard|champignon|pomme de terre|patate|haricot|petit pois|brocoli|chou|céleri|poireau|navet|radis|concombre|aubergine|avocat|artichaut|betterave|fenouil|endive/i, '🥬 Légumes'],
  [/pomme|poire|banane|orange|citron|fraise|framboise|myrtille|mangue|ananas|kiwi|pêche|abricot|raisin|melon|pastèque|cerise|clémentine/i, '🍎 Fruits'],
  [/pâtes|riz|spaghetti|penne|fusilli|tagliatelle|nouille|couscous|semoule|quinoa|boulgour/i, '🍝 Féculents'],
  [/farine|sucre|levure|maïzena|chapelure|cacao|chocolat|vanille|bicarbonate/i, '🧁 Pâtisserie'],
  [/huile|vinaigre|sauce soja|moutarde|ketchup|mayonnaise|sauce/i, '🫙 Condiments'],
  [/sel|poivre|cumin|paprika|curry|thym|romarin|basilic|persil|coriandre|origan|cannelle|muscade|curcuma|herbes|épice/i, '🌿 Épices'],
  [/pain|baguette|brioche|croissant|toast/i, '🥖 Boulangerie'],
  [/eau|jus|vin|bière|bouillon|lait de coco/i, '🥤 Boissons'],
];

export function categorizeIngredient(name: string): string {
  for (const [re, cat] of CATEGORY_MAP) {
    if (re.test(name)) return cat;
  }
  return '🛒 Autres';
}

/** Group ingredients by shopping category */
export function groupByCategory(ingredients: AppIngredient[]): Record<string, AppIngredient[]> {
  const groups: Record<string, AppIngredient[]> = {};
  for (const ing of ingredients) {
    const cat = categorizeIngredient(ing.name);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(ing);
  }
  return groups;
}

/** Format ingredient for display: "200 g de pâtes" or "3 oeufs" */
export function formatIngredient(ing: AppIngredient): string {
  if (ing.quantity !== null && ing.unit) {
    const startsWithVowel = /^[aeiouyéèêëàâùûîïôh]/i.test(ing.name);
    const de = startsWithVowel ? "d'" : 'de ';
    return `${ing.quantity} ${ing.unit} ${de}${ing.name}`;
  }
  if (ing.quantity !== null) return `${ing.quantity} ${ing.name}`;
  return ing.name;
}

/** Parse a French ingredient string "400 g de pâtes" into { name, quantity, unit } */
function parseIngredientText(text: string): AppIngredient {
  const m = text.match(
    /^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|cl|dl|l|cs|cc|CS|CC|càs|càc|c\.?\s*à\s*s\.?|c\.?\s*à\s*c\.?|tasse|pincée|sachet|tranche|feuille|brin|gousse|botte|paquet|boîte|pot|verre|tbsp|tsp)?\s*(?:de\s+|d')?(.+)/i,
  );
  if (m) {
    return {
      name: m[3].trim(),
      quantity: parseFloat(m[1].replace(',', '.')) || null,
      unit: (m[2] || '').trim(),
    };
  }
  const m2 = text.match(/^(\d+(?:[.,]\d+)?)\s+(.+)/);
  if (m2) {
    return {
      name: m2[2].trim(),
      quantity: parseFloat(m2[1].replace(',', '.')) || null,
      unit: '',
    };
  }
  return { name: text.trim(), quantity: null, unit: '' };
}

// ─── Imperial → Metric conversion ────────────────────────────────────────

interface UnitConversion {
  factor: number;
  toUnit: string;
  /** If result > threshold, use altUnit instead (e.g. g → kg) */
  alt?: { threshold: number; factor: number; unit: string };
}

const IMPERIAL_TO_METRIC: Record<string, UnitConversion> = {
  // Weight
  lb: { factor: 453.6, toUnit: 'g', alt: { threshold: 1000, factor: 0.001, unit: 'kg' } },
  lbs: { factor: 453.6, toUnit: 'g', alt: { threshold: 1000, factor: 0.001, unit: 'kg' } },
  pound: { factor: 453.6, toUnit: 'g', alt: { threshold: 1000, factor: 0.001, unit: 'kg' } },
  pounds: { factor: 453.6, toUnit: 'g', alt: { threshold: 1000, factor: 0.001, unit: 'kg' } },
  oz: { factor: 28.35, toUnit: 'g' },
  ounce: { factor: 28.35, toUnit: 'g' },
  ounces: { factor: 28.35, toUnit: 'g' },
  // Volume
  cup: { factor: 240, toUnit: 'ml' },
  cups: { factor: 240, toUnit: 'ml' },
  'fl oz': { factor: 30, toUnit: 'ml' },
  'fluid ounce': { factor: 30, toUnit: 'ml' },
  'fluid ounces': { factor: 30, toUnit: 'ml' },
  quart: { factor: 946, toUnit: 'ml' },
  quarts: { factor: 946, toUnit: 'ml' },
  gallon: { factor: 3785, toUnit: 'ml' },
  gallons: { factor: 3785, toUnit: 'ml' },
  pint: { factor: 473, toUnit: 'ml' },
  pints: { factor: 473, toUnit: 'ml' },
  // Temperature (handled separately in text)
};

/** Round to nice values for cooking */
function roundMetric(value: number): number {
  if (value >= 100) return Math.round(value / 5) * 5; // 455 → 455, 453.6 → 455
  if (value >= 10) return Math.round(value);
  return Math.round(value * 10) / 10; // 1 decimal for small values
}

/**
 * Convert a .cook file from imperial units to metric.
 * Handles inline cooklang syntax @ingredient{qty%unit} and ~timer{qty%unit},
 * and also converts °F to °C in plain text.
 */
export function convertCookToMetric(content: string): string {
  // Convert inline cooklang tokens: @name{qty%unit} and ~timer{qty%unit}
  let result = content.replace(
    /([@~#](?:[^{]*?))\{(\d+(?:[.,]\d+)?)%([^}]+)\}/g,
    (_match, prefix: string, qtyStr: string, unit: string) => {
      const qty = parseFloat(qtyStr.replace(',', '.'));
      const conv = IMPERIAL_TO_METRIC[unit.toLowerCase().trim()];
      if (!conv || isNaN(qty)) return _match;
      let converted = qty * conv.factor;
      let newUnit = conv.toUnit;
      if (conv.alt && converted >= conv.alt.threshold) {
        converted = converted * conv.alt.factor;
        newUnit = conv.alt.unit;
      }
      return `${prefix}{${roundMetric(converted)}%${newUnit}}`;
    },
  );

  // Convert standalone quantities in text: "1 lb", "4 oz" (not inside {})
  result = result.replace(
    /(\d+(?:[.,]\d+)?)\s*(lb|lbs|pounds?|oz|ounces?|cups?|pints?|quarts?|gallons?)\b/gi,
    (_match, qtyStr: string, unit: string) => {
      const qty = parseFloat(qtyStr.replace(',', '.'));
      const conv = IMPERIAL_TO_METRIC[unit.toLowerCase()];
      if (!conv || isNaN(qty)) return _match;
      let converted = qty * conv.factor;
      let newUnit = conv.toUnit;
      if (conv.alt && converted >= conv.alt.threshold) {
        converted = converted * conv.alt.factor;
        newUnit = conv.alt.unit;
      }
      return `${roundMetric(converted)} ${newUnit}`;
    },
  );

  // Convert Fahrenheit to Celsius in text: "425°F" or "425 °F" or "425 degrees F"
  result = result.replace(
    /(\d+)\s*°?\s*(?:°F|degrees?\s*F(?:ahrenheit)?)\b/gi,
    (_match, tempStr: string) => {
      const f = parseInt(tempStr, 10);
      const c = Math.round((f - 32) * 5 / 9 / 5) * 5; // round to nearest 5°C
      return `${c}°C`;
    },
  );
  // Also handle "425°F" where ° is directly attached
  result = result.replace(
    /(\d+)°F\b/g,
    (_match, tempStr: string) => {
      const f = parseInt(tempStr, 10);
      const c = Math.round((f - 32) * 5 / 9 / 5) * 5;
      return `${c}°C`;
    },
  );

  return result;
}

/** Generate a .cook file content from imported recipe data */
export function generateCookFile(data: {
  title: string;
  tags?: string[];
  servings?: number;
  prepTime?: string;
  cookTime?: string;
  ingredients: { name: string; quantity?: string; unit?: string }[];
  steps: string[];
}): string {
  const lines: string[] = [];

  // Metadata — cooklang format: >> key: value
  if (data.title) lines.push(`>> title: ${data.title}`);
  if (data.tags && data.tags.length > 0) lines.push(`>> tags: ${data.tags.join(', ')}`);
  if (data.servings) lines.push(`>> servings: ${data.servings}`);
  if (data.prepTime) lines.push(`>> prep time: ${data.prepTime}`);
  if (data.cookTime) lines.push(`>> cook time: ${data.cookTime}`);
  if (data.ingredients.length > 0) {
    lines.push(`>> ingredients: ${data.ingredients.map(i => i.name).join(' | ')}`);
  }
  if (lines.length > 0) lines.push('');

  // Steps as plain text
  for (const step of data.steps) {
    lines.push(step);
    lines.push('');
  }

  return lines.join('\n');
}
