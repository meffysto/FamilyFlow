---
phase: quick
plan: 260402-vpb
subsystem: mascot/craft
tags: [craft, ui, catalogue, grille, stades, i18n]
dependency_graph:
  requires: []
  provides: [catalogue-craft-grille-par-stade, craft-recipe-min-tree-stage]
  affects: [app/(tabs)/tree.tsx, components/mascot/CraftSheet.tsx, lib/mascot/types.ts, lib/mascot/craft-engine.ts]
tech_stack:
  added: []
  patterns: [grille-2-colonnes, mini-modal-transparent, groupement-par-stade, chips-filtre]
key_files:
  created: []
  modified:
    - lib/mascot/types.ts
    - lib/mascot/craft-engine.ts
    - components/mascot/CraftSheet.tsx
    - app/(tabs)/tree.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - "TREE_STAGE_ORDER exporte depuis types.ts pour centraliser l'ordre canonique des stades"
  - "hydromel/nougat/pain_epices/parfum_orchidee groupes en 'arbuste' (requierent ruche, disponible des arbuste)"
  - "confiture_royale groupe en 'arbre' (requiert rose_doree, graine rare arbre)"
  - "Mini-modal interne utilise Modal transparent separé du Modal pageSheet principal"
  - "renderCatalogue retourne un View (flex:1) plutot qu'un ScrollView direct pour abriter le Modal interne"
metrics:
  duration: "~15min"
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_modified: 6
---

# Phase quick Plan 260402-vpb: Refonte Catalogue Recettes CraftSheet Summary

**One-liner:** Catalogue CraftSheet refait en grille 2 colonnes groupée par stade d'arbre avec chips filtre Tout/Disponibles, sections verrouillées grisées, et mini-modal détail au tap avec `minTreeStage` sur chaque recette.

## What Was Built

### Task 1 — minTreeStage sur CraftRecipe + TREE_STAGE_ORDER

Commit: `d84bae4`

- `lib/mascot/types.ts` : ajout de `minTreeStage: TreeStage` sur l'interface `CraftRecipe` + export de `TREE_STAGE_ORDER: TreeStage[]` (tableau ordonné canonique des 6 stades)
- `lib/mascot/craft-engine.ts` : `minTreeStage` renseigné sur les 18 recettes selon le mapping prévu :
  - pousse : soupe, bouquet, crepe
  - arbuste : fromage, gratin, omelette, hydromel, nougat, pain_epices, parfum_orchidee
  - arbre : pain, confiture, popcorn, gateau, confiture_royale
  - majestueux : soupe_citrouille, tarte_citrouille, risotto_truffe

### Task 2 — Catalogue grille par stade + mini-modal + i18n

Commit: `a802822`

- **Locales FR/EN** : ajout de 7 nouvelles clés i18n dans l'objet `craft` :
  `filtreToutes`, `filtreDisponibles`, `sectionLocked`, `detailTitle`, `hintPlant`, `hintBuilding`, `niveauRequis`
- **CraftSheetProps** : nouvelle prop `treeStage: TreeStage`
- **tree.tsx** : passage de `treeStage={stageInfo.stage}` au composant `CraftSheet`
- **renderCatalogue() refait** :
  - Chips filtre Tout / Disponibles(N) en haut, style dynamique primaire/tint
  - Groupement `useMemo` par `TREE_STAGE_ORDER` → sections avec header stade (emoji + label + niv.X+ + badge count)
  - Sections au-delà du stade actuel : `locked=true` → opacity 0.5 + badge 🔒
  - Grille 2 colonnes flexWrap avec cartes compactes (emoji 32px, badge ✓ craftable, dots ingrédients colorés)
  - Tap sur carte non-verrouillée → `setSelectedRecipe(recipe)` → Modal transparent avec détail complet + bouton Crafter
  - Onglets Inventaire et Mes créations inchangés

## Decisions Made

1. `TREE_STAGE_ORDER` exporté depuis `types.ts` pour centraliser l'ordre canonique (évite duplication dans farm-engine.ts et CraftSheet)
2. hydromel/nougat/pain_epices/parfum_orchidee classés en `arbuste` : ils requièrent la ruche (disponible dès arbuste selon `BUILDING_CATALOG`)
3. `confiture_royale` en `arbre` : requiert rose_doree (graine rare arbre) + strawberry (arbre)
4. Le mini-modal est un `Modal` React Native séparé (transparent/fade) imbriqué dans la vue du catalogue — permet overlay propre sans interférer avec le Modal pageSheet principal
5. `renderCatalogue()` retourne un `View flex:1` plutôt qu'un `ScrollView` direct pour pouvoir y abriter le Modal interne comme enfant JSX

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Verification

- `npx tsc --noEmit` : seules les erreurs pré-existantes dans `docs/family-flow-promo.tsx` (remotion, types), aucune erreur dans les fichiers modifiés
- `CraftRecipe.minTreeStage` : présent sur les 18 recettes de `CRAFT_RECIPES`
- `TREE_STAGE_ORDER` : exporté depuis `types.ts`
- `CraftSheet` : 1057 lignes (min_lines 200 satisfait)
- `treeStage` prop présente dans `CraftSheetProps` et passée depuis `tree.tsx`
- Clés i18n FR + EN ajoutées
- Onglets Inventaire et Mes créations : code inchangé

## Known Stubs

None.

## Self-Check: PASSED

- `lib/mascot/types.ts` : FOUND (minTreeStage sur CraftRecipe, TREE_STAGE_ORDER exporté)
- `lib/mascot/craft-engine.ts` : FOUND (18 recettes avec minTreeStage)
- `components/mascot/CraftSheet.tsx` : FOUND (1057 lignes, grille par stade, mini-modal, chips filtre)
- Commits d84bae4, a802822 : FOUND dans git log
