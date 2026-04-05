/**
 * useVaultMeals.ts — Hook dédié au domaine Repas
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultMeals(vaultRef, triggerWidgetRefresh).
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import { format } from 'date-fns';
import type { MealItem } from '../lib/types';
import { parseMeals, formatMealLine } from '../lib/parser';
import type { VaultManager } from '../lib/vault';

// ─── Constantes ──────────────────────────────────────────────────────────────

const MEALS_DIR = '02 - Maison';

const MEALS_TEMPLATE = `# Repas de la semaine

## Lundi
- Petit-déj:
- Déjeuner:
- Dîner:

## Mardi
- Petit-déj:
- Déjeuner:
- Dîner:

## Mercredi
- Petit-déj:
- Déjeuner:
- Dîner:

## Jeudi
- Petit-déj:
- Déjeuner:
- Dîner:

## Vendredi
- Petit-déj:
- Déjeuner:
- Dîner:

## Samedi
- Petit-déj:
- Déjeuner:
- Dîner:

## Dimanche
- Petit-déj:
- Déjeuner:
- Dîner:
`;

/** Retourne le chemin du fichier repas pour la semaine contenant `date` (lundi = début de semaine) */
export function mealsFileForWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=dimanche
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi
  const monday = new Date(d);
  monday.setDate(diff);
  const iso = format(monday, 'yyyy-MM-dd');
  return `${MEALS_DIR}/Repas semaine du ${iso}.md`;
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultMealsResult {
  meals: MealItem[];
  setMeals: (meals: MealItem[]) => void;
  updateMeal: (day: string, mealType: string, text: string, recipeRef?: string, weekDate?: Date) => Promise<void>;
  loadMealsForWeek: (date: Date) => Promise<MealItem[]>;
  resetMeals: () => void;
  mealsFileForWeek: (date?: Date) => string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultMeals(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  triggerWidgetRefresh: () => void,
): UseVaultMealsResult {
  const [meals, setMeals] = useState<MealItem[]>([]);

  const resetMeals = useCallback(() => {
    setMeals([]);
  }, []);

  const updateMeal = useCallback(async (day: string, mealType: string, text: string, recipeRef?: string, weekDate?: Date) => {
    if (!vaultRef.current) return;
    try {
      const file = mealsFileForWeek(weekDate);
      if (!(await vaultRef.current.exists(file))) {
        await vaultRef.current.writeFile(file, MEALS_TEMPLATE);
      }
      const content = await vaultRef.current.readFile(file);
      const lines = content.split('\n');
      let currentDay: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) {
          currentDay = lines[i].replace('## ', '').trim();
        }
        if (currentDay === day) {
          const match = lines[i].match(/^-\s+(.+?):\s*(.*)$/);
          if (match && match[1].trim() === mealType) {
            lines[i] = formatMealLine(mealType, text, recipeRef);
            break;
          }
        }
      }

      await vaultRef.current.writeFile(file, lines.join('\n'));
      if (!weekDate || mealsFileForWeek() === file) {
        setMeals(parseMeals(lines.join('\n'), file));
        setTimeout(triggerWidgetRefresh, 0);
      }
    } catch (e) {
      throw new Error(`updateMeal: ${e}`);
    }
  }, [vaultRef, triggerWidgetRefresh]);

  const loadMealsForWeek = useCallback(async (date: Date): Promise<MealItem[]> => {
    if (!vaultRef.current) return [];
    const file = mealsFileForWeek(date);
    try {
      const isFuture = date > new Date();
      if (!(await vaultRef.current.exists(file))) {
        if (isFuture) {
          await vaultRef.current.writeFile(file, MEALS_TEMPLATE);
        } else {
          return [];
        }
      }
      const c = await vaultRef.current.readFile(file);
      return parseMeals(c, file);
    } catch {
      return [];
    }
  }, [vaultRef]);

  return {
    meals,
    setMeals,
    updateMeal,
    loadMealsForWeek,
    resetMeals,
    mealsFileForWeek,
  };
}
