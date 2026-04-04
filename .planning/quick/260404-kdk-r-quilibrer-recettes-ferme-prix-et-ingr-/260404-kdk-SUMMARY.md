---
phase: quick
plan: 260404-kdk
subsystem: mascot/craft
tags: [craft, ferme, equilibrage, recettes]
dependency_graph:
  requires: []
  provides: [CRAFT_RECIPES reequilibre]
  affects: [lib/mascot/craft-engine.ts]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - lib/mascot/craft-engine.ts
decisions:
  - "fromage: lait x3 (au lieu de x2) — coût de production rééquilibré avec sellValue 480"
  - "nougat: miel x2 (au lieu de x1) — rend la recette plus exigeante, sellValue 760 justifié"
  - "17 sellValue ajustés — multiplication variable (1.6x à 2.5x) selon la difficulté de la recette"
metrics:
  duration: "3min"
  completed_date: "2026-04-04"
  tasks: 1
  files: 1
---

# Quick Task 260404-kdk: Rééquilibrer recettes ferme — prix et ingrédients

Rééquilibrage économique du catalogue CRAFT_RECIPES : 2 changements d'ingrédients et 17 ajustements de sellValue pour équilibrer la progression ferme/craft.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Rééquilibrer ingrédients et prix des recettes ferme | 6dad909 | lib/mascot/craft-engine.ts |

## Changes Applied

### Changements d'ingrédients

| Recette | Ingrédient | Avant | Après |
|---------|-----------|-------|-------|
| fromage | lait quantity | 2 | 3 |
| nougat | miel quantity | 1 | 2 |

### Changements de sellValue

| Recette | Avant | Après |
|---------|-------|-------|
| soupe | 120 | 150 |
| bouquet | 190 | 200 |
| crepe | 240 | 220 |
| fromage | 400 | 480 |
| gratin | 430 | 440 |
| omelette | 520 | 440 |
| hydromel | 720 | 660 |
| nougat | 580 | 760 |
| pain_epices | 600 | 560 |
| pain | 440 | 480 |
| confiture | 480 | 460 |
| popcorn | 600 | 540 |
| huile_tournesol | 400 | 500 |
| brioche_tournesol | 380 | 440 |
| gateau | 580 | 540 |
| soupe_citrouille | 600 | 560 |
| tarte_citrouille | 740 | 700 |

### Recettes protégées (inchangées)

- parfum_orchidee: sellValue 1200
- confiture_royale: sellValue 1500
- risotto_truffe: sellValue 2000

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Self-Check: PASSED

- [x] lib/mascot/craft-engine.ts modifié avec 19 changements
- [x] Commit 6dad909 vérifié
- [x] tsc --noEmit: aucune nouvelle erreur (erreurs pre-existantes docs/family-flow-promo.tsx ignorées)
- [x] 3 recettes protégées: valeurs 1200/1500/2000 confirmées inchangées
- [x] 2 changements d'ingrédients confirmés (lait x3, miel x2)
- [x] 17 sellValue mis à jour confirmés
