---
phase: quick-260404-xbu
plan: 01
subsystem: recettes
tags: [recettes, ux, vault-ops]
dependency_graph:
  requires: []
  provides: [moveRecipeCategory, category-picker-ui]
  affects: [hooks/useVault.ts, components/RecipeViewer.tsx, app/(tabs)/meals.tsx]
tech_stack:
  added: []
  patterns: [Alert.alert ActionSheet, useMemo categories, optimistic state update]
key_files:
  created: []
  modified:
    - hooks/useVault.ts
    - components/RecipeViewer.tsx
    - app/(tabs)/meals.tsx
decisions:
  - moveRecipeCategory utilise copyFileToVault(getRecipeImageUri(sourceFile), newImagePath) pour déplacer le .jpg — réutilise les méthodes publiques existantes du VaultManager sans exposer uri() privé
  - Catégorie affichée avec icône 📁 uniquement quand onChangeCategory est fourni — rétrocompatible (RecipeViewer affiché ailleurs sans cette prop reste intact)
  - Alert.alert avec boutons par catégorie — adapté pour < 8 catégories (usage typique), cohérent avec les autres ActionSheets de l'app
metrics:
  duration: 8min
  completed_date: "2026-04-04T22:06:47Z"
  tasks_completed: 2
  files_modified: 3
---

# Quick 260404-xbu: Changer la catégorie d'une recette — Summary

**One-liner:** Déplacement de recette entre catégories via Alert ActionSheet dans RecipeViewer — déplace .cook + .jpg et met à jour l'état local immédiatement.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Ajouter moveRecipeCategory dans useVault.ts | b9fd5ec | hooks/useVault.ts |
| 2 | Bouton catégorie cliquable + wiring meals.tsx | 3b314e0 | components/RecipeViewer.tsx, app/(tabs)/meals.tsx |

## What Was Built

**`moveRecipeCategory(sourceFile, newCategory)`** dans `hooks/useVault.ts` :
- Lit le contenu du `.cook`, l'écrit dans `03 - Cuisine/Recettes/{newCategory}/{fileName}`
- Supprime l'ancien `.cook`
- Tente de déplacer le `.jpg` associé via `copyFileToVault` + `deleteFile` (échec silencieux si absent)
- Mise à jour optimiste de `recipes[]` via `setRecipes` (pas de rechargement complet)

**`RecipeViewer.tsx`** :
- Nouvelles props `onChangeCategory` et `availableCategories`
- La ligne catégorie devient un `TouchableOpacity` quand `onChangeCategory` est fourni
- Affiche `{category} 📁` pour indiquer l'interaction disponible
- Ouvre un `Alert.alert` listant les autres catégories ; tap déclenche haptic + callback

**`app/(tabs)/meals.tsx`** :
- Importe `moveRecipeCategory` depuis `useVault`
- `recipeCategories` calculé en `useMemo` depuis `recipes.map(r => r.category)`
- Passe `onChangeCategory` et `availableCategories` au `RecipeViewer`
- Après déplacement : met à jour `selectedRecipe` localement (category + sourceFile)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- hooks/useVault.ts modifié — b9fd5ec confirmé
- components/RecipeViewer.tsx modifié — 3b314e0 confirmé
- app/(tabs)/meals.tsx modifié — 3b314e0 confirmé
- `npx tsc --noEmit` : 0 nouvelles erreurs (5 erreurs pré-existantes dans docs/family-flow-promo.tsx)
