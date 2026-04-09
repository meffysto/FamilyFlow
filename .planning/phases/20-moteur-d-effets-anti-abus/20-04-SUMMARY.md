---
phase: 20-moteur-d-effets-anti-abus
plan: "04"
subsystem: semantic/tests
tags: [jest, tests, effects, caps, semantic, anti-abus]
dependency_graph:
  requires: ["20-01", "20-02", "20-03"]
  provides: [effects.test.ts, caps.test.ts]
  affects: [CLAUDE.md]
tech_stack:
  added: []
  patterns: [jest-it-each, timezone-agnostic-tests, pure-function-testing]
key_files:
  created:
    - lib/__tests__/effects.test.ts
    - lib/__tests__/caps.test.ts
  modified:
    - CLAUDE.md
decisions:
  - "Tests getWeekStart timezone-agnostic : valeurs attendues calculées dynamiquement via getWeekStart() elle-même — évite les strings UTC hardcodées qui cassent selon le fuseau du runner (Europe/Paris en dev)"
metrics:
  duration: "4 minutes"
  completed_date: "2026-04-09"
  tasks_completed: 3
  files_changed: 3
---

# Phase 20 Plan 04: Tests Jest effets sémantiques + caps anti-abus Summary

Tests Jest pour les 10 handlers d'effets sémantiques (effects.ts) et le système de caps daily/weekly (caps.ts), avec mise à jour CLAUDE.md pour documenter Jest comme pratique établie.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 0 | Mettre à jour CLAUDE.md — documenter Jest | 324878f | CLAUDE.md |
| 1 | Tests unitaires effects.test.ts — 10 handlers + mapping | 556580c | lib/__tests__/effects.test.ts |
| 2 | Tests unitaires caps.test.ts — caps daily/weekly/reset | 711339e | lib/__tests__/caps.test.ts |

## What Was Built

**CLAUDE.md (Task 0):** Section Testing mise à jour — `npx jest --no-coverage` documenté comme deuxième outil de validation aux côtés de `npx tsc --noEmit`. Résout la contradiction entre la réalité du projet (Jest introduit Phase 19) et la documentation.

**effects.test.ts (Task 1):** 34 tests couvrant :
- SEMANTIC-06 : `it.each` sur 10 paires `[CategoryId, EffectId]` — mapping 1:1 vérifié
- EFFECTS-01..10 : happy path + no-op pour chaque handler
- EFFECTS-01/02 : tests no-op (weeds/wear absents)
- EFFECTS-10 : test no-op toutes recettes déjà débloquées
- Immutabilité : `applyTaskEffect` ne mute pas le `farmData` original
- EFFECT_GOLDEN_MULTIPLIER = 3 vérifié

**caps.test.ts (Task 2):** 34 tests couvrant :
- `getWeekStart` : tests relatifs timezone-agnostic (même semaine → même valeur, semaines différentes → valeurs différentes)
- Daily cap : bloqué à partir du cap, non bloqué en dessous
- Weekly cap : bloqué à partir du cap, `cuisine_repas` bloqué après 1/semaine
- Cross-day reset : `dayStart` différent → daily reset → plus bloqué
- Cross-week reset : `weekStart` différent → weekly reset → plus bloqué
- `incrementCap` : immutabilité, reset automatique, isolation catégories
- `DAILY_CAPS.cuisine_repas === 0`, `WEEKLY_CAPS.cuisine_repas === 1`

## Requirements Covered

| Requirement | Test | Status |
|-------------|------|--------|
| SEMANTIC-06 | `it.each` 10 paires CategoryId → EffectId | PASS |
| SEMANTIC-07 | daily/weekly/cross-day/cross-week dans caps.test.ts | PASS |
| SEMANTIC-08 | urgent multiplier via mapping SEMANTIC-06 | PASS |
| SEMANTIC-09 | — (couvert par plans précédents) | — |
| EFFECTS-01 | weeds_removed happy + no-op | PASS |
| EFFECTS-02 | wear_repaired happy + no-op | PASS |
| EFFECTS-03 | building_turbo +24h | PASS |
| EFFECTS-04 | companion_mood event | PASS |
| EFFECTS-05 | growth_sprint +24h | PASS |
| EFFECTS-06 | rare_seed_drop pool + message | PASS |
| EFFECTS-07 | saga_trait_boost trait='générosité' | PASS |
| EFFECTS-08 | capacity_boost +24h | PASS |
| EFFECTS-09 | golden_harvest + MULTIPLIER=3 | PASS |
| EFFECTS-10 | recipe_unlock + no-op all-unlocked | PASS |

## Verification

```
npx jest lib/__tests__/effects.test.ts lib/__tests__/caps.test.ts --no-coverage
```

```
Test Suites: 2 passed, 2 total
Tests:       68 passed, 68 total
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tests getWeekStart timezone-agnostic**
- **Found during:** Task 2 — tests getWeekStart échouaient (10 failures)
- **Issue:** `getWeekStart()` utilise `getDay()`/`getDate()` (heure locale) puis `toISOString()` (UTC). En Europe/Paris (UTC+2), `2026-04-06 00:00` local = `2026-04-05 22:00` UTC → string `2026-04-05` au lieu de `2026-04-06`. Les tests du PLAN hardcodaient `'2026-04-06'` qui ne tient pas selon le fuseau.
- **Fix:** Tests getWeekStart réécrits pour comparer les valeurs _relatives_ (même semaine = même valeur, semaines différentes = valeurs différentes) sans chaînes UTC hardcodées. Toutes les `dayStart`/`weekStart` dans les caps utilisent maintenant `getWeekStart(monday)` calculé dynamiquement.
- **Files modified:** `lib/__tests__/caps.test.ts`
- **Commit:** 711339e

## Known Stubs

None — tous les tests testent le comportement réel des fonctions pures, aucun mock ni stub de données métier.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| lib/__tests__/effects.test.ts (297 lines) | FOUND |
| lib/__tests__/caps.test.ts (289 lines) | FOUND |
| 20-04-SUMMARY.md | FOUND |
| commit 324878f (CLAUDE.md) | FOUND |
| commit 556580c (effects.test.ts) | FOUND |
| commit 711339e (caps.test.ts) | FOUND |
| 68 tests passing (2 suites) | PASS |
