/**
 * useVaultRecipes.ts — Hook dédié au domaine Recettes & favoris
 *
 * Extrait de useVault.ts pour alléger le monolithe.
 * Appelé uniquement par useVaultInternal() via useVaultRecipes(vaultRef, profiles).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type React from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Recipe, Profile } from '../lib/types';
import type { VaultManager } from '../lib/vault';
import { parseRecipe, generateCookFile } from '../lib/cooklang';

// ─── Constantes ──────────────────────────────────────────────────────────────

const RECIPES_DIR = '03 - Cuisine/Recettes';
const FAVORITES_KEY_PREFIX = 'recipe_favorites_';

function warnUnexpected(context: string, e: unknown) {
  const msg = String(e);
  const isNotFound = msg.includes('cannot read') || msg.includes('not exist') || msg.includes('no such') || msg.includes('ENOENT');
  if (!isNotFound && __DEV__) console.warn(`[useVaultRecipes] ${context}:`, e);
}

// ─── Interface de retour ─────────────────────────────────────────────────────

export interface UseVaultRecipesResult {
  recipes: Recipe[];
  setRecipes: (recipes: Recipe[]) => void;
  loadRecipes: (force?: boolean) => Promise<void>;
  addRecipe: (category: string, data: { title: string; tags?: string[]; servings?: number; prepTime?: string; cookTime?: string; ingredients: { name: string; quantity?: string; unit?: string }[]; steps: string[] }) => Promise<void>;
  deleteRecipe: (sourceFile: string) => Promise<void>;
  renameRecipe: (sourceFile: string, newTitle: string) => Promise<void>;
  saveRecipeImage: (sourceFile: string, imageUri: string) => Promise<void>;
  getRecipeImageUri: (sourceFile: string) => string | null;
  scanAllCookFiles: () => Promise<{ path: string; title: string }[]>;
  moveCookToRecipes: (sourcePath: string, category: string) => Promise<void>;
  moveRecipeCategory: (sourceFile: string, newCategory: string) => Promise<void>;
  toggleFavorite: (profileId: string, recipePath: string) => Promise<void>;
  isFavorite: (profileId: string, recipePath: string) => boolean;
  getFavorites: (profileId: string) => string[];
  resetRecipes: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVaultRecipes(
  vaultRef: React.MutableRefObject<VaultManager | null>,
  profiles: Profile[],
): UseVaultRecipesResult {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeFavorites, setRecipeFavorites] = useState<Record<string, string[]>>({});
  const recipesLoadedRef = useRef(false);

  // ─── Chargement recettes ────────────────────────────────────────────────────

  const loadRecipes = useCallback(async (force?: boolean) => {
    if (!vaultRef.current || (!force && recipesLoadedRef.current)) return;
    recipesLoadedRef.current = true;
    try {
      const cookFiles = await vaultRef.current.listFilesRecursive(RECIPES_DIR, '.cook');
      const results = await Promise.all(cookFiles.map(async (relPath) => {
        try {
          const content = await vaultRef.current!.readFile(relPath);
          return parseRecipe(relPath, content);
        } catch (e) { warnUnexpected('recipe-read', e); return null; }
      }));
      const loaded = results.filter((r): r is Recipe => r !== null);
      loaded.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
      setRecipes(loaded);
    } catch (e) {
      warnUnexpected('loadRecipes', e);
      setRecipes([]);
    }
  }, []);

  // ─── CRUD recettes ─────────────────────────────────────────────────────────

  const addRecipe = useCallback(async (category: string, data: { title: string; tags?: string[]; servings?: number; prepTime?: string; cookTime?: string; ingredients: { name: string; quantity?: string; unit?: string }[]; steps: string[] }) => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const fileName = data.title.replace(/[/\\:*?"<>|]/g, '').trim();
    const relPath = `${RECIPES_DIR}/${category}/${fileName}.cook`;
    await vault.ensureDir(`${RECIPES_DIR}/${category}`);
    const content = generateCookFile(data);
    await vault.writeFile(relPath, content);
    recipesLoadedRef.current = false;
    await loadRecipes(true);
  }, [loadRecipes]);

  const deleteRecipe = useCallback(async (sourceFile: string) => {
    if (!vaultRef.current) return;
    await vaultRef.current.deleteFile(sourceFile);
    setRecipes(prev => prev.filter(r => r.sourceFile !== sourceFile));
  }, []);

  const renameRecipe = useCallback(async (sourceFile: string, newTitle: string) => {
    if (!vaultRef.current) return;
    const content = await vaultRef.current.readFile(sourceFile);
    let updated: string;
    if (/^>> title:.*$/m.test(content)) {
      updated = content.replace(/^>> title:.*$/m, `>> title: ${newTitle}`);
    } else if (/^---/.test(content)) {
      updated = content.replace(/^---\n/, `---\ntitle: "${newTitle}"\n`);
    } else {
      updated = `>> title: ${newTitle}\n\n${content}`;
    }
    await vaultRef.current.writeFile(sourceFile, updated);
    const { parseRecipe } = require('../lib/cooklang');
    setRecipes(prev => prev.map(r =>
      r.sourceFile === sourceFile ? parseRecipe(sourceFile, updated) : r
    ));
  }, []);

  const saveRecipeImage = useCallback(async (sourceFile: string, imageUri: string) => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const imagePath = sourceFile.replace(/\.cook$/, '.jpg');
    await vault.copyFileToVault(imageUri, imagePath);
    const content = await vault.readFile(sourceFile);
    let updated: string;
    if (/^>> image:.*$/m.test(content)) {
      updated = content.replace(/^>> image:.*$/m, `>> image: ${imagePath}`);
    } else if (/^>> title:.*$/m.test(content)) {
      updated = content.replace(/^>> title:(.*)$/m, `>> title:$1\n>> image: ${imagePath}`);
    } else {
      updated = `>> image: ${imagePath}\n\n${content}`;
    }
    await vault.writeFile(sourceFile, updated);
    setRecipes(prev => prev.map(r =>
      r.sourceFile === sourceFile ? { ...r, image: imagePath } : r
    ));
  }, []);

  const getRecipeImageUri = useCallback((sourceFile: string): string | null => {
    if (!vaultRef.current) return null;
    return vaultRef.current.getRecipeImageUri(sourceFile);
  }, []);

  // ─── Scan & déplacement fichiers .cook ──────────────────────────────────────

  const scanAllCookFiles = useCallback(async (): Promise<{ path: string; title: string }[]> => {
    if (!vaultRef.current) return [];
    const vault = vaultRef.current;
    const topDirs = await vault.listDir('');
    const results: { path: string; title: string }[] = [];
    for (const dir of topDirs) {
      if (dir.startsWith('.') || dir === '03 - Cuisine') continue;
      try {
        const cookFiles = await vault.listFilesRecursive(dir, '.cook');
        for (const filePath of cookFiles) {
          const parts = filePath.split('/');
          const fileName = parts[parts.length - 1].replace('.cook', '');
          results.push({ path: filePath, title: fileName });
        }
      } catch (e) {
        warnUnexpected(`findOrphanCook(${dir})`, e);
      }
    }
    const rootEntries = await vault.listDir('');
    for (const entry of rootEntries) {
      if (entry.endsWith('.cook')) {
        results.push({ path: entry, title: entry.replace('.cook', '') });
      }
    }
    return results;
  }, []);

  const moveCookToRecipes = useCallback(async (sourcePath: string, category: string) => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const content = await vault.readFile(sourcePath);
    const parts = sourcePath.split('/');
    const fileName = parts[parts.length - 1];
    const destPath = `${RECIPES_DIR}/${category}/${fileName}`;
    await vault.ensureDir(`${RECIPES_DIR}/${category}`);
    await vault.writeFile(destPath, content);
    await vault.deleteFile(sourcePath);
    try {
      const recipe = parseRecipe(destPath, content);
      if (recipe) {
        setRecipes(prev => [...prev, recipe].sort((a, b) => a.title.localeCompare(b.title, 'fr')));
      }
    } catch (e) {
      warnUnexpected('moveCookToRecipes-optimistic', e);
      recipesLoadedRef.current = false;
      await loadRecipes(true);
    }
  }, [loadRecipes]);

  const moveRecipeCategory = useCallback(async (sourceFile: string, newCategory: string) => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const content = await vault.readFile(sourceFile);
    const parts = sourceFile.split('/');
    const fileName = parts[parts.length - 1];
    const destPath = `${RECIPES_DIR}/${newCategory}/${fileName}`;
    if (sourceFile === destPath) return;
    await vault.ensureDir(`${RECIPES_DIR}/${newCategory}`);
    await vault.writeFile(destPath, content);
    await vault.deleteFile(sourceFile);
    try {
      const oldImagePath = sourceFile.replace(/\.cook$/, '.jpg');
      const newImagePath = destPath.replace(/\.cook$/, '.jpg');
      const oldImageUri = vault.getRecipeImageUri(sourceFile);
      await vault.ensureDir(`${RECIPES_DIR}/${newCategory}`);
      await vault.copyFileToVault(oldImageUri, newImagePath);
      await vault.deleteFile(oldImagePath);
    } catch {
      // Pas d'image ou déplacement échoué — ignorer silencieusement
    }
    try {
      const recipe = parseRecipe(destPath, content);
      if (recipe) {
        setRecipes(prev => prev.map(r =>
          r.sourceFile === sourceFile ? recipe : r,
        ).sort((a, b) => a.title.localeCompare(b.title, 'fr')));
      }
    } catch (e) {
      warnUnexpected('moveRecipeCategory-optimistic', e);
      recipesLoadedRef.current = false;
      await loadRecipes(true);
    }
  }, [loadRecipes]);

  // ─── Favoris ───────────────────────────────────────────────────────────────

  const loadFavorites = useCallback(async (profileId: string): Promise<string[]> => {
    try {
      const raw = await SecureStore.getItemAsync(`${FAVORITES_KEY_PREFIX}${profileId}`);
      if (raw) return JSON.parse(raw) as string[];
    } catch (e) { warnUnexpected('loadFavorites', e); }
    return [];
  }, []);

  useEffect(() => {
    (async () => {
      const all: Record<string, string[]> = {};
      for (const p of profiles) {
        all[p.id] = await loadFavorites(p.id);
      }
      setRecipeFavorites(all);
    })();
  }, [profiles, loadFavorites]);

  const toggleFavorite = useCallback(async (profileId: string, recipePath: string) => {
    setRecipeFavorites(prev => {
      const current = prev[profileId] ?? [];
      const exists = current.includes(recipePath);
      const updated = exists ? current.filter(p => p !== recipePath) : [...current, recipePath];
      SecureStore.setItemAsync(`${FAVORITES_KEY_PREFIX}${profileId}`, JSON.stringify(updated)).catch(() => {});
      return { ...prev, [profileId]: updated };
    });
  }, []);

  const isFavorite = useCallback((profileId: string, recipePath: string): boolean => {
    return (recipeFavorites[profileId] ?? []).includes(recipePath);
  }, [recipeFavorites]);

  const getFavorites = useCallback((profileId: string): string[] => {
    return recipeFavorites[profileId] ?? [];
  }, [recipeFavorites]);

  // ─── Reset ─────────────────────────────────────────────────────────────────

  const resetRecipes = useCallback(() => {
    setRecipes([]);
    recipesLoadedRef.current = false;
  }, []);

  return {
    recipes,
    setRecipes,
    loadRecipes,
    addRecipe,
    deleteRecipe,
    renameRecipe,
    saveRecipeImage,
    getRecipeImageUri,
    scanAllCookFiles,
    moveCookToRecipes,
    moveRecipeCategory,
    toggleFavorite,
    isFavorite,
    getFavorites,
    resetRecipes,
  };
}
