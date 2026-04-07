---
phase: 15-pr-f-rences-alimentaires
plan: "03"
subsystem: dietary
tags: [tdd, allergie, matching, pref-09, arch-03, arch-05]
dependency_graph:
  requires: [15-01]
  provides: [checkAllergens, normalizeText]
  affects: [lib/dietary.ts]
tech_stack:
  added: []
  patterns: [pure-function, substring-matching, tdd-red-green]
key_files:
  created:
    - lib/dietary.ts
    - lib/__tests__/dietary.test.ts
  modified: []
decisions:
  - Matching substring conservateur — un match ambigu déclenche toujours le conflit (PREF-11)
  - resolveConstraintAliases retourne [] pour aversion (texte libre seulement, matchAll direct)
  - profileToConvive utilise asAny cast pour les champs foodAllergies non encore dans le type Profile — évite de modifier lib/types.ts dans ce plan
  - Fusion par clé ingredient|constraintId|severity — évite les doublons quand plusieurs convives partagent la même contrainte
metrics:
  duration: "10min"
  completed_date: "2026-04-07"
  tasks: 1
  files: 2
---

# Phase 15 Plan 03: checkAllergens TDD Summary

**One-liner:** Fonction pure checkAllergens avec matching substring conservateur (NFD) via EU_ALLERGENS/COMMON_INTOLERANCES — 11 tests couvrant ARCH-03 (allergie, intolérance, faux positif évité, faux négatif par alias, recette saine).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Tests failing checkAllergens | ae8d3f2 | lib/__tests__/dietary.test.ts |
| GREEN | Implémente checkAllergens | 6733d96 | lib/dietary.ts |

## Decisions Made

1. **Matching substring conservateur** — `matchTerms()` fait un `includes()` sur le nom normalisé (NFD). Conservatisme PREF-11 : un match ambigu vaut mieux qu'un faux négatif sur allergie vitale.

2. **resolveConstraintAliases pour aversion** — Les aversions sont du texte libre (D-05). Pas de catalogue, donc on normalise directement l'ID et on fait le substring match.

3. **profileToConvive cast asAny** — Les champs `foodAllergies`, `foodIntolerances`, etc. ne sont pas encore dans le type `Profile` de `lib/types.ts` (plan 15-02 les ajoute côté parser). On utilise un cast défensif plutôt que de modifier le type dans ce plan — aucun impact comportement runtime.

4. **Fusion de conflits** — Clé `ingredientName|constraintId|severity` dans une Map. Quand deux convives ont la même contrainte sur le même ingrédient, on fusionne leurs IDs dans un seul DietaryConflict.

## Verification

- `npx jest lib/__tests__/dietary.test.ts` — 11/11 PASS
- ARCH-03 satisfait : 11 cas (≥ 5 requis) — allergie, intolérance, faux positif évité, faux négatif via alias, recette saine, multi-profil, conservatisme (mozzarella di bufala), invité GuestProfile, aversion texte libre
- ARCH-05 satisfait : zéro nouvelle dépendance npm
- `npx tsc --noEmit` — erreurs uniquement dans parser-extended.test.ts (plan 15-02, pré-existantes hors scope)

## Deviations from Plan

None — plan exécuté exactement comme écrit. Les 7 tests du plan ont été implémentés plus 4 tests bonus (normalizeText x2, invité, aversion texte libre).

## Known Stubs

None — fonction pure sans données hardcodées, aucun placeholder UI.

## Self-Check: PASSED

- `lib/dietary.ts` — FOUND
- `lib/__tests__/dietary.test.ts` — FOUND
- Commit `ae8d3f2` (RED) — FOUND
- Commit `6733d96` (GREEN) — FOUND
