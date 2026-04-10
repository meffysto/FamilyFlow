---
phase: 25-fondation-donn-es-village
plan: "02"
subsystem: village
tags: [tests, jest, parser, village, tdd]
dependency_graph:
  requires: ["25-01"]
  provides: ["26-01"]
  affects: []
tech_stack:
  added: []
  patterns: ["describe/it Jest", "round-trip fidelity test", "append-only insert verification"]
key_files:
  created:
    - lib/__tests__/village-parser.test.ts
  modified:
    - lib/village/parser.ts
decisions:
  - "gray-matter retourne les dates YAML comme objets Date (pas string) — parseGardenFile normalise via instanceof Date check + toISOString().slice(0,10)"
metrics:
  duration: "2min"
  completed: "2026-04-10"
  tasks_completed: 1
  files_changed: 2
---

# Phase 25 Plan 02: Tests unitaires module village Summary

Tests unitaires Jest pour le module `lib/village/` — 24 tests couvrant le parseur bidirectionnel, l'insert append-only, la grille village namespaceée, et les templates d'objectif, avec correction d'un bug gray-matter dates.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tests unitaires module village | acc5012 | lib/__tests__/village-parser.test.ts, lib/village/parser.ts |

## Verification

- `npx jest lib/__tests__/village-parser.test.ts --no-coverage` — 24/24 tests passent, 0 failures
- `npx tsc --noEmit` — aucune nouvelle erreur de type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fix gray-matter dates YAML parsees comme objets Date**

- **Found during:** Task 1 — round-trip test failing
- **Issue:** `parseGardenFile` testait `typeof fm.created === 'string'` mais gray-matter parse les valeurs YAML du type `2026-04-01` (date ISO sans heure) comme des objets `Date` JavaScript, pas des strings. Résultat : `createdAt` et `currentWeekStart` tombaient sur `''` dans le fallback, cassant le round-trip et le test "fichier complet".
- **Fix:** Ajout de `instanceof Date` check avant le `typeof string` check, normalisation via `.toISOString().slice(0, 10)` pour obtenir `YYYY-MM-DD`.
- **Files modified:** `lib/village/parser.ts` (lignes 54-60)
- **Commit:** acc5012

## Known Stubs

None — tous les tests valident le comportement réel sans stub ni mock gray-matter.

## Self-Check: PASSED

- `lib/__tests__/village-parser.test.ts` — FOUND
- `lib/village/parser.ts` — FOUND (modifié)
- Commit acc5012 — FOUND
