/**
 * automation-config.ts — Configuration des automatisations recettes→courses→stock
 *
 * Cache en mémoire pour éviter les lectures SecureStore à chaque action.
 * Initialisé au premier accès, mis à jour quand l'utilisateur toggle.
 */

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  autoCoursesFromRecipes: 'auto_courses_from_recipes',
  autoStockFromCourses: 'auto_stock_from_courses',
  autoStockDecrementCook: 'auto_stock_decrement_cook',
} as const;

export interface AutomationConfig {
  autoCoursesFromRecipes: boolean;
  autoStockFromCourses: boolean;
  autoStockDecrementCook: boolean;
}

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  autoCoursesFromRecipes: true,
  autoStockFromCourses: true,
  autoStockDecrementCook: true,
};

let cache: AutomationConfig | null = null;

/** Charge la config depuis SecureStore (appelé une seule fois) */
async function ensureLoaded(): Promise<AutomationConfig> {
  if (cache) return cache;
  const [v1, v2, v3] = await Promise.all([
    SecureStore.getItemAsync(KEYS.autoCoursesFromRecipes),
    SecureStore.getItemAsync(KEYS.autoStockFromCourses),
    SecureStore.getItemAsync(KEYS.autoStockDecrementCook),
  ]);
  cache = {
    autoCoursesFromRecipes: v1 !== 'false',
    autoStockFromCourses: v2 !== 'false',
    autoStockDecrementCook: v3 !== 'false',
  };
  return cache;
}

/** Lit un flag (synchrone si déjà chargé, async sinon) */
export async function getAutomationFlag(key: keyof AutomationConfig): Promise<boolean> {
  const config = await ensureLoaded();
  return config[key];
}

/** Met à jour un flag (cache + SecureStore) */
export async function setAutomationFlag(key: keyof AutomationConfig, value: boolean): Promise<void> {
  const config = await ensureLoaded();
  config[key] = value;
  await SecureStore.setItemAsync(KEYS[key], String(value));
}

/** Charge la config complète (pour l'écran settings) */
export async function loadAutomationConfig(): Promise<AutomationConfig> {
  return { ...(await ensureLoaded()) };
}
