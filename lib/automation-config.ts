/**
 * automation-config.ts — Configuration des automatisations recettes→courses→stock
 *
 * Cache en mémoire pour éviter les lectures SecureStore à chaque action.
 * Initialisé au premier accès, mis à jour quand l'utilisateur toggle.
 *
 * Phase D (260428-huh) : ajout `defaultRecipeList` (id de la liste cible
 * pour auto-courses depuis recettes — null = liste active du moment).
 */

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  autoCoursesFromRecipes: 'auto_courses_from_recipes',
  autoStockFromCourses: 'auto_stock_from_courses',
  autoStockDecrementCook: 'auto_stock_decrement_cook',
  defaultRecipeList: 'auto_default_recipe_list',
} as const;

export interface AutomationConfig {
  autoCoursesFromRecipes: boolean;
  autoStockFromCourses: boolean;
  autoStockDecrementCook: boolean;
  /** ID liste de courses cible pour auto-courses recettes — null = active du moment */
  defaultRecipeList: string | null;
}

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  autoCoursesFromRecipes: true,
  autoStockFromCourses: true,
  autoStockDecrementCook: true,
  defaultRecipeList: null,
};

let cache: AutomationConfig | null = null;

/** Charge la config depuis SecureStore (appelé une seule fois) */
async function ensureLoaded(): Promise<AutomationConfig> {
  if (cache) return cache;
  const [v1, v2, v3, v4] = await Promise.all([
    SecureStore.getItemAsync(KEYS.autoCoursesFromRecipes),
    SecureStore.getItemAsync(KEYS.autoStockFromCourses),
    SecureStore.getItemAsync(KEYS.autoStockDecrementCook),
    SecureStore.getItemAsync(KEYS.defaultRecipeList),
  ]);
  cache = {
    autoCoursesFromRecipes: v1 !== 'false',
    autoStockFromCourses: v2 !== 'false',
    autoStockDecrementCook: v3 !== 'false',
    defaultRecipeList: v4 && v4.length > 0 ? v4 : null,
  };
  return cache;
}

/** Lit un flag (synchrone si déjà chargé, async sinon) — flags booléens uniquement */
export async function getAutomationFlag(
  key: 'autoCoursesFromRecipes' | 'autoStockFromCourses' | 'autoStockDecrementCook',
): Promise<boolean> {
  const config = await ensureLoaded();
  return config[key];
}

/** Met à jour un flag booléen (cache + SecureStore) */
export async function setAutomationFlag(
  key: 'autoCoursesFromRecipes' | 'autoStockFromCourses' | 'autoStockDecrementCook',
  value: boolean,
): Promise<void> {
  const config = await ensureLoaded();
  config[key] = value;
  await SecureStore.setItemAsync(KEYS[key], String(value));
}

/** Lit l'id de la liste cible recettes (null = active du moment) */
export async function getDefaultRecipeList(): Promise<string | null> {
  const config = await ensureLoaded();
  return config.defaultRecipeList;
}

/** Définit la liste cible pour auto-courses recettes (null = active du moment) */
export async function setDefaultRecipeList(id: string | null): Promise<void> {
  const config = await ensureLoaded();
  config.defaultRecipeList = id;
  await SecureStore.setItemAsync(KEYS.defaultRecipeList, id ?? '');
}

/** Charge la config complète (pour l'écran settings) */
export async function loadAutomationConfig(): Promise<AutomationConfig> {
  return { ...(await ensureLoaded()) };
}
