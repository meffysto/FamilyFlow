---
phase: quick-260427-izj
plan: 01
subsystem: recettes
tags: [recettes, categories, crud, meals, vault]
dependency_graph:
  requires: []
  provides: [createCategory, renameCategory, deleteCategory, categoryFilter]
  affects: [hooks/useVaultRecipes.ts, hooks/useVault.ts, app/(tabs)/meals.tsx]
tech_stack:
  added: []
  patterns: [useCallback avec deps recipes, Modal pageSheet, Haptics, Alert.alert FR]
key_files:
  created: []
  modified:
    - hooks/useVaultRecipes.ts
    - hooks/useVault.ts
    - app/(tabs)/meals.tsx
decisions:
  - "Dossiers vides laissés sur disque (pas de deleteDir natif dans VaultManager) — sans impact UX car recipeCategories est dérivé de `recipes`"
  - "reassignTo obligatoire si deleteCategory appelé sur catégorie non-vide — throw Error explicite sinon"
  - "FontSize.md absent des tokens → remplacé par FontSize.body (15px)"
  - "Suppression complète de detectMealType / MEAL_TYPE_FILTERS / recipeMealTypes : plus référencés nulle part"
metrics:
  duration: ~15min
  completed: "2026-04-27"
  tasks: 2
  files: 3
---

# Quick Task 260427-izj: Recettes — Gestion Catégories Personnalisées Summary

**One-liner:** CRUD complet des catégories recettes (hook + chips vault + modal pageSheet) en remplacement des meal-types heuristiques.

## Objectif

Aligner l'onglet Recettes avec la structure réelle du vault Obsidian : les chips de filtre affichent désormais les vrais sous-dossiers de `03 - Cuisine/Recettes/`, et l'utilisateur peut créer, renommer ou supprimer des catégories depuis l'app.

## Tâches exécutées

### Task 1 — Hook : createCategory / renameCategory / deleteCategory

**Fichiers :** `hooks/useVaultRecipes.ts`, `hooks/useVault.ts`
**Commit :** `3196669`

- Ajout de `createCategory(name)` : `sanitizeCategoryName` + `vault.ensureDir` + `loadRecipes(true)`
- Ajout de `renameCategory(oldName, newName)` : boucle sur recettes de l'ancienne catégorie via `moveRecipeCategory`, reload
- Ajout de `deleteCategory(name, reassignTo?)` : throw si non-vide et pas de cible ; sinon déplace via `moveRecipeCategory`, reload
- Interface `UseVaultRecipesResult` étendue + retour du hook mis à jour
- Câblage dans `hooks/useVault.ts` : interface `VaultState` + return value

### Task 2 — UI : chips catégories + tri alpha + modal CRUD

**Fichiers :** `app/(tabs)/meals.tsx`
**Commit :** `91c7bd7`

- `mealTypeFilter: MealType | null` → `categoryFilter: string | null`
- Suppression complète de `detectMealType`, `MEAL_TYPE_FILTERS`, `recipeMealTypes` (useMemo + type)
- `filteredRecipes` : filtre par `r.category === categoryFilter` + tri alpha défensif en fin de chaîne
- Chips : Toutes → Favoris → catégories vault (via `recipeCategories`) → bouton `📁 Gérer`
- Modal CRUD `pageSheet` : TextInput création + liste catégories avec compteur recettes + renommage inline (TextInput autoFocus + onSubmitEditing) + suppression (Alert confirmation si vide, Alert avec choix cible si non-vide)
- Import `ModalHeader` depuis `components/ui/ModalHeader` et `* as Haptics` depuis `expo-haptics`
- `Haptics.selectionAsync()` sur ouverture modal, `Haptics.impactAsync()` sur mutations

## Décisions clés

1. **Dossiers vides sur disque** : `VaultManager` n'expose pas de `deleteDir`. Les dossiers supprimés (catégories vides après réassignation) restent sur disque mais sont invisibles côté UI car `recipeCategories` dérive de `recipes` (pas d'un scan de dossiers). Documenté en commentaire.

2. **deleteCategory throws si non-vide sans reassignTo** : erreur explicite en français avec le compteur de recettes — l'UI gère ce cas via `Alert.alert` avec les boutons cibles.

3. **Tri alpha défensif** : `[...result].sort((a, b) => a.title.localeCompare(b.title, 'fr'))` ajouté en fin de `filteredRecipes` pour garantir l'ordre même si `loadRecipes` est altéré par des mutations concurrentes.

4. **`FontSize.md` absent** : le plan référençait `FontSize.md` qui n'existe pas dans `constants/typography.ts`. Remplacé par `FontSize.body` (15px, valeur sémantiquement équivalente).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FontSize.md remplacé par FontSize.body**
- **Found during:** Task 2 — vérification tsc
- **Issue:** `FontSize.md` n'existe pas dans les design tokens du projet
- **Fix:** Remplacement global par `FontSize.body` (15px)
- **Files modified:** `app/(tabs)/meals.tsx`
- **Commit:** `91c7bd7`

## Known Stubs

Aucun stub — les catégories affichées proviennent directement des recettes chargées depuis le vault.

## Self-Check: PASSED

- hooks/useVaultRecipes.ts : FOUND
- hooks/useVault.ts : FOUND
- app/(tabs)/meals.tsx : FOUND
- commit 3196669 (Task 1) : FOUND
- commit 91c7bd7 (Task 2) : FOUND
