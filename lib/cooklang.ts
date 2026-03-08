import { Recipe as CooklangRecipe } from '@cooklang/cooklang-ts';
import type { Ingredient as CooklangIngredient, Step as CooklangStep, Timer as CooklangTimer } from '@cooklang/cooklang-ts';

// Our app types
export interface AppRecipe {
  id: string;
  title: string;
  sourceFile: string;
  category: string;        // folder name (Plats, Desserts, etc.)
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

export interface AppStep {
  number: number;
  text: string;              // rendered text with ingredient names inline
  ingredients: AppIngredient[];
  timers: { name: string; duration: number; unit: string }[];
}

/** Parse a .cook file content into an AppRecipe */
export function parseRecipe(sourceFile: string, content: string): AppRecipe {
  const recipe = new CooklangRecipe(content);

  // Extract title from metadata or filename
  const pathParts = sourceFile.split('/');
  const fileName = pathParts[pathParts.length - 1].replace('.cook', '');
  const category = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';

  const title = recipe.metadata.title || fileName;
  const tags = recipe.metadata.tags
    ? recipe.metadata.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : [];
  const servings = parseInt(recipe.metadata.servings || recipe.metadata.portions || '4', 10) || 4;
  const prepTime = recipe.metadata['prep time'] || recipe.metadata.prepTime || recipe.metadata.préparation || '';
  const cookTime = recipe.metadata['cook time'] || recipe.metadata.cookTime || recipe.metadata.cuisson || '';

  // Map ingredients
  const ingredients: AppIngredient[] = recipe.ingredients.map((ing: CooklangIngredient) => ({
    name: ing.name,
    quantity: typeof ing.quantity === 'number' ? ing.quantity : parseFloat(String(ing.quantity)) || null,
    unit: ing.units || '',
  }));

  // Map cookware
  const cookware = [...new Set(recipe.cookwares.map((c) => c.name))];

  // Map steps
  const steps: AppStep[] = recipe.steps.map((step: CooklangStep, idx: number) => {
    const stepIngredients: AppIngredient[] = [];
    const stepTimers: { name: string; duration: number; unit: string }[] = [];

    const text = step.map((token) => {
      if (token.type === 'text') return token.value;
      if (token.type === 'ingredient') {
        stepIngredients.push({
          name: token.name,
          quantity: typeof token.quantity === 'number' ? token.quantity : parseFloat(String(token.quantity)) || null,
          unit: token.units || '',
        });
        const qty = token.quantity && token.quantity !== 'some' ? `${token.quantity}${token.units ? ' ' + token.units : ''} ` : '';
        return `${qty}${token.name}`;
      }
      if (token.type === 'cookware') return token.name;
      if (token.type === 'timer') {
        const t = token as CooklangTimer;
        stepTimers.push({
          name: t.name || '',
          duration: typeof t.quantity === 'number' ? t.quantity : parseFloat(String(t.quantity)) || 0,
          unit: t.units || 'minutes',
        });
        return `${t.quantity} ${t.units}`;
      }
      return '';
    }).join('');

    return { number: idx + 1, text, ingredients: stepIngredients, timers: stepTimers };
  });

  // Generate stable ID from sourceFile
  const id = sourceFile.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  return { id, title, sourceFile, category, tags, servings, prepTime, cookTime, ingredients, steps, cookware };
}

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
    const key = `${ing.name.toLowerCase().trim()}|${ing.unit.toLowerCase().trim()}`;
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

/** Format ingredient for display: "200 g pates" or "pates" */
export function formatIngredient(ing: AppIngredient): string {
  if (ing.quantity !== null && ing.unit) return `${ing.quantity} ${ing.unit} ${ing.name}`;
  if (ing.quantity !== null) return `${ing.quantity} ${ing.name}`;
  return ing.name;
}

/** Generate a basic .cook file content from user inputs */
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

  // Metadata
  const meta: string[] = [];
  if (data.title) meta.push(`title: ${data.title}`);
  if (data.tags && data.tags.length > 0) meta.push(`tags: ${data.tags.join(', ')}`);
  if (data.servings) meta.push(`servings: ${data.servings}`);
  if (data.prepTime) meta.push(`prep time: ${data.prepTime}`);
  if (data.cookTime) meta.push(`cook time: ${data.cookTime}`);

  if (meta.length > 0) {
    lines.push('---');
    lines.push(...meta);
    lines.push('---');
    lines.push('');
  }

  // Steps with inline ingredients
  for (const step of data.steps) {
    lines.push(step);
    lines.push('');
  }

  return lines.join('\n');
}
