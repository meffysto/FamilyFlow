---
phase: 15-pr-f-rences-alimentaires
plan: "06"
subsystem: dietary-integration
tags: [dietary, recipe-viewer, meal-planning, allergen-safety, pref-11]
dependency_graph:
  requires:
    - 15-03 (lib/dietary.ts checkAllergens)
    - 15-04 (AllergenBanner composant PREF-11)
    - 15-05 (hook useVaultDietary + écran dietary)
  provides:
    - RecipeViewer avec bandeau allergie + badges inline + sélecteur convives
    - ConvivesPickerModal multiselect famille+invités
    - MealConflictRecap pour planificateur de repas
  affects:
    - components/RecipeViewer.tsx (ajout détection conflits)
    - app/(tabs)/meals.tsx (ajout récap PREF-12)
tech_stack:
  added: []
  patterns:
    - useMemo pour checkAllergens (performance, dépendances stables)
    - React.memo sur MealConflictRecap et MealConflictWrapper (list item)
    - Sous-composant MealConflictWrapper pour encapsuler hook dans .map()
key_files:
  created:
    - components/dietary/ConvivesPickerModal.tsx
    - components/dietary/MealConflictRecap.tsx
  modified:
    - components/RecipeViewer.tsx
    - components/dietary/index.ts
    - app/(tabs)/meals.tsx
decisions:
  - "MealConflictWrapper sous-composant créé pour encapsuler useMemo dans le map() de meals.tsx (hooks interdits dans callbacks)"
  - "Badge inline utilise conflict.ingredientName pour matcher — même clé que checkAllergens retourne"
  - "ConvivesPickerModal réinitialise l'état via useEffect[visible] pour garantir la fraîcheur à chaque ouverture"
metrics:
  duration: "4 min"
  completed: "2026-04-07"
  tasks: 3
  files: 5
requirements: [PREF-08, PREF-10, PREF-11, PREF-12]
---

# Phase 15 Plan 06: Intégration Recettes et Repas — Summary

Intégration des conflits alimentaires dans les écrans consommateurs : RecipeViewer (bandeau AllergenBanner + badges inline + bouton ConvivesPicker) et planificateur de repas meals.tsx (récap compact par MealItem).

## What Was Built

**1. ConvivesPickerModal** (`components/dietary/ConvivesPickerModal.tsx`)
Modal `pageSheet` avec drag-to-dismiss natif iOS. Deux sections: Famille et Invités. Chips multiselect (`Chip` existant). Footer sticky avec bouton "Vérifier les convives". Volatile — aucune persistance (PREF-FUT-01 respecté). Réinitialise la sélection à chaque ouverture via `useEffect[visible]`.

**2. RecipeViewer intégré** (`components/RecipeViewer.tsx`)
- `AllergenBanner` rendu en tête du body (avant hero image) — PREF-11 P0 SAFETY
- Bouton "Vérifier les conflits pour…" (variant outline) sous le bandeau — ouvre `ConvivesPickerModal`
- D-08 : `selectedProfileIds` initialisé à `profiles.map(p => p.id)` (union famille par défaut)
- Badges inline `Badge` à côté de chaque ingrédient conflictuel (variant error/warning/default selon sévérité)
- `conflicts` calculé via `useMemo` avec dépendances stables

**3. MealConflictRecap** (`components/dietary/MealConflictRecap.tsx`)
Bandeau compact "X allergie(s), Y intolérance(s) pour les convives sélectionnés" per UI-SPEC ligne 191. Couleur sémantique selon sévérité maximale. `React.memo` pour performances dans la liste. Retourne `null` si 0 conflit.

**4. meals.tsx intégré** (`app/(tabs)/meals.tsx`)
- `MealConflictWrapper` sous-composant créé (pour encapsuler `useMemo` dans un `.map()` callback)
- `dietary` extrait depuis `useVault()` pour accéder aux guests
- `MealConflictWrapper` rendu au-dessus de la `TouchableOpacity` principale de chaque MealItem avec recette liée

## PREF-11 P0 SAFETY Verification

- `AllergenBanner` n'expose aucune prop dismiss (`onDismiss`, `onClose`, `dismissible`) — vérifié
- `pointerEvents="none"` sur le container du bandeau — vérifié (AllergenBanner.tsx ligne 42)
- Bandeau rendu AVANT la liste des ingrédients dans RecipeViewer
- Aucun bouton X ni action de fermeture dans le composant bandeau
- Test TypeScript statique inchangé (allergen-banner.test.ts)

## Checkpoint Audit Trail

**Tâche 3 — checkpoint:human-verify PREF-11 P0 SAFETY**
Statut: Auto-approuvé (mode --auto actif)
Raison: Toutes les garanties P0 sont vérifiables statiquement dans le code :
- `pointerEvents="none"` présent dans AllergenBanner.tsx
- Aucune prop dismiss dans l'interface AllergenBannerProps
- Bandeau rendu en premier dans le body RecipeViewer
- `npx tsc --noEmit` passe sans erreur

## Deviations from Plan

None — plan exécuté exactement comme prévu.

## Known Stubs

None — tous les composants sont câblés sur des données réelles via `useVault()`.

## Self-Check: PASSED

- ConvivesPickerModal.tsx: FOUND
- MealConflictRecap.tsx: FOUND
- Commit fe4b768 (tâche 1): FOUND
- Commit 8898d43 (tâche 2): FOUND
- npx tsc --noEmit: PASSED
