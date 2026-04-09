---
phase: 19-d-tection-cat-gorie-s-mantique
plan: "02"
subsystem: semantic-tests
tags: [tests, jest, semantic, deriveTaskCategory, featureflag, tdd]
dependency_graph:
  requires: ["19-01"]
  provides: ["preuve-comportementale-SEMANTIC-01..05-ARCH-02-ARCH-03"]
  affects: []
tech_stack:
  added: []
  patterns: ["makeTask factory", "beforeEach deleteItemAsync isolation", "in-memory mock SecureStore"]
key_files:
  created:
    - lib/__tests__/derive.test.ts
    - lib/__tests__/flag.test.ts
  modified: []
decisions:
  - "Tests organisés en 6 describe blocks pour derive.test.ts (happy path, signaux explicites, normalisation, priorité, evidence brute, fallback null)"
  - "beforeEach deleteItemAsync garantit isolation du mock in-memory expo-secure-store entre tests (Pitfall 1)"
  - "makeTask factory helper minimaliste couvre tous les overrides Partial<Task> nécessaires"
  - "Pré-existing failure world-grid.test.ts (1 test) ignorée — hors scope plan 19-02"
metrics:
  duration: "2min"
  completed: "2026-04-09"
  tasks: 2
  files_created: 2
  files_modified: 0
  tests_added: 37
---

# Phase 19 Plan 02: Tests Jest derive + flag — Summary

**One-liner:** 37 tests unitaires Jest couvrant deriveTaskCategory (29 tests, 10 catégories × 5 signal-types) et le feature flag SecureStore (8 tests, round-trip + isolation mock).

## Objective

Livrer la couverture de tests unitaires complète pour le module `lib/semantic/` créé en plan 19-01, validant empiriquement les 9 requirements Phase 19 (SEMANTIC-01..05, ARCH-02, ARCH-03).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | derive.test.ts — 29 tests deriveTaskCategory | 34eedc6 | lib/__tests__/derive.test.ts |
| 2 | flag.test.ts — 8 tests feature flag SecureStore | 77cff1b | lib/__tests__/flag.test.ts |

## Results

### derive.test.ts (29 tests)

**6 describe blocks :**

1. **Happy path par catégorie (10 tests)** — 1 test par CategoryId via signal naturel :
   - `courses` via tag `courses`
   - `bebe_soins` via section `Biberons`
   - `enfants_devoirs` via tag `devoirs`
   - `menage_quotidien` via section `Quotidien`
   - `menage_hebdo` via section `Ménage hebdomadaire`
   - `enfants_routines` via filepath `01 - Enfants`
   - `cuisine_repas` via filepath `03 - Cuisine`
   - `rendez_vous` via filepath `04 - Rendez-vous`
   - `budget_admin` via filepath `05 - Budget`
   - `gratitude_famille` via filepath `06 - Mémoires`

2. **3 signaux explicites (3 tests)** — vérification `matchedBy` + `evidence` brute pour tag, section, filepath

3. **Normalisation accents + casse (4 tests)** — `Ménage` → `menage_hebdo`, `MÉNAGE HEBDOMADAIRE`, `06 - Mémoires`, tag `Courses` capitalisé

4. **Ordre de priorité tag > section > filepath (3 tests)** — D-02 : conflit 3 signaux → tag gagne ; conflit 2 → section gagne ; seul filepath → filepath

5. **Evidence brute non normalisée (4 tests)** — D-04b : `Ménage hebdomadaire`, `Courses`, `03 - Cuisine`, `06 - Mémoires`

6. **Fallback null (5 tests)** — SEMANTIC-04/ARCH-03 : `99 - Inconnu`, signaux inexistants, racine vault, sourceFile vide, aucune exception

### flag.test.ts (8 tests)

**3 describe blocks :**

1. **Default OFF (2 tests)** — SEMANTIC-05 : clé absente → `false` ; clé canonique `'semantic-coupling-enabled'`
2. **Set/get round-trip (4 tests)** — ARCH-02 : set true → true, set false → false, true→false instantané, false→true séquence
3. **Persistence SecureStore (2 tests)** — chaînes `'true'`/`'false'` vérifiées dans le mock

## Requirements Coverage

| Requirement | Couvert par | Test(s) |
|-------------|-------------|---------|
| SEMANTIC-01 (filepath) | derive.test.ts | 5 tests filepath (enfants_routines, cuisine_repas, rendez_vous, budget_admin, gratitude_famille) |
| SEMANTIC-02 (section) | derive.test.ts | 4 tests section + 4 tests normalisation |
| SEMANTIC-03 (tags) | derive.test.ts | 3 tests tag (courses, enfants_devoirs) + priorité |
| SEMANTIC-04 (fallback null) | derive.test.ts | 5 tests toBeNull() |
| SEMANTIC-05 (feature flag) | flag.test.ts | test default OFF |
| ARCH-02 (désactivation instantanée) | flag.test.ts | test round-trip true→false |
| ARCH-03 (zéro exception) | derive.test.ts | test "ne lance pas d'exception" |

## Verification

```
npx jest lib/__tests__/derive.test.ts --no-coverage  → PASS (29/29)
npx jest lib/__tests__/flag.test.ts --no-coverage    → PASS (8/8)
```

Note : `world-grid.test.ts` contient 1 failure pré-existante (`retourne 0 cellules pour le stade graine`) non liée à ce plan — elle existait avant plan 19-02 et est hors scope.

## Deviations from Plan

### Auto-fixed Issues

None — plan exécuté exactement tel qu'écrit.

### Notes d'adaptation

- Les templates du PLAN.md ont été adaptés pour correspondre exactement aux patterns définis dans `categories.ts` (ex : `menage_hebdo` via section `Ménage hebdomadaire` qui contient `menage` via normalisation).
- 29 tests créés au lieu du minimum de 20 (enrichissement selon indication PLAN.md : "le planner peut enrichir").
- 5 describe blocks au lieu du minimum de 5 (6 blocks, dont un supplémentaire pour les 3 signaux explicites).

## Known Stubs

Aucun stub — les tests valident des comportements réels du module `lib/semantic/`.

## Self-Check: PASSED

- lib/__tests__/derive.test.ts : FOUND
- lib/__tests__/flag.test.ts : FOUND
- Commit 34eedc6 : FOUND (derive.test.ts)
- Commit 77cff1b : FOUND (flag.test.ts)
