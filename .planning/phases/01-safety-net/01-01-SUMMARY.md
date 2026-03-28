---
phase: 01-safety-net
plan: 01
subsystem: testing
tags: [jest, jest-expo, testing-library, budget, farm-engine, sagas-engine, world-grid, unit-tests]

# Dependency graph
requires: []
provides:
  - jest-expo et @testing-library/react-native installés comme devDependencies
  - Tests unitaires pour lib/budget.ts (19 tests)
  - Tests unitaires pour lib/mascot/world-grid.ts (21 tests)
  - Tests unitaires pour lib/mascot/farm-engine.ts (22 tests)
  - Tests unitaires pour lib/mascot/sagas-engine.ts (18 tests)
  - Mock PNG/images pour l'environnement Jest node
  - Mock react-native minimal (Platform) pour lib/mascot/utils.ts
affects: [02-sentry, 03-dead-code, 04-typescript, phases suivantes]

# Tech tracking
tech-stack:
  added:
    - jest-expo ~54.0.17 (devDependency — preset Expo pour futurs tests composants)
    - "@testing-library/react-native ^13.3.3 (devDependency — utilitaires tests composants)"
  patterns:
    - "Tests lib/* dans lib/__tests__/ avec ts-jest + node environment"
    - "Mocks d'assets (PNG, react-native) dans lib/__tests__/__mocks__/"
    - "jest.spyOn(Math, 'random') pour tester les mutations dorées (golden crops)"
    - "jest.mock('../mascot/seasons') pour contrôler les bonus saisonniers"
    - "Fixtures helpers : creerTraits(), creerProgress() en français"

key-files:
  created:
    - lib/__tests__/budget.test.ts
    - lib/__tests__/world-grid.test.ts
    - lib/__tests__/farm-engine.test.ts
    - lib/__tests__/sagas-engine.test.ts
    - lib/__tests__/__mocks__/file-asset.ts
    - lib/__tests__/__mocks__/react-native.ts
  modified:
    - package.json (jest-expo + @testing-library/react-native ajoutés)
    - jest.config.js (moduleNameMapper PNG + react-native ajoutés)

key-decisions:
  - "jest-expo installé en devDep sans changer le preset ts-jest existant — les 4 modules cibles sont du TS pur, pas de React"
  - "Mock PNG dans jest.config.js moduleNameMapper plutôt que __mocks__ global — plus ciblé"
  - "Mock react-native minimal (Platform uniquement) — lib/mascot/utils.ts l'utilise pour SecureStoreCompat"
  - "Tests écrits en français pour respecter la convention du projet"

patterns-established:
  - "Pattern mock assets : '\\.(png|jpg...)$' → file-asset.ts retournant 0"
  - "Pattern mock react-native : Platform.OS = 'ios' + Platform.select"

requirements-completed: [TEST-01, TEST-02, TEST-03, TEST-04, TEST-05]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 01 Plan 01: Safety Net — Setup Tests Summary

**jest-expo + RNTL installés, 80 nouveaux tests unitaires pour budget, world-grid, farm-engine et sagas-engine — filet de sécurité avant refactoring**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T18:47:08Z
- **Completed:** 2026-03-28T18:53:10Z
- **Tasks:** 3 (Task 0 + Task 1 + Task 2)
- **Files modified:** 8

## Accomplishments

- jest-expo ~54.0.17 et @testing-library/react-native ^13.3.3 installés (TEST-01)
- 4 fichiers de tests créés : budget.test.ts (19 tests), world-grid.test.ts (21 tests), farm-engine.test.ts (22 tests), sagas-engine.test.ts (18 tests)
- Mocks PNG et react-native ajoutés au jest.config.js pour résoudre les erreurs SyntaxError pré-existantes dans l'environnement node
- Nombre de suites de test passantes : 2 → 8 (correction bonus des suites seasons et adventures)

## Task Commits

1. **Task 0: Installer jest-expo + @testing-library/react-native** - `22cf1f7` (chore)
2. **Task 1: Tests budget.ts + world-grid.ts** - `6599384` (test)
3. **Task 2: Tests farm-engine.ts + sagas-engine.ts** - `bbf011d` (test)

## Files Created/Modified

- `lib/__tests__/budget.test.ts` — 19 tests pour parseBudgetConfig, parseBudgetMonth, serializeBudgetMonth, helpers
- `lib/__tests__/world-grid.test.ts` — 21 tests pour WORLD_GRID shape, CROP_CELLS, BUILDING_CELLS, getUnlockedCropCells, CELL_SIZES
- `lib/__tests__/farm-engine.test.ts` — 22 tests pour plantCrop, advanceFarmCrops, harvestCrop, golden mutation, CSV round-trip
- `lib/__tests__/sagas-engine.test.ts` — 18 tests pour getDominantTrait, getChapterNarrativeKey, getSagaCompletionResult, restDaysRemaining
- `lib/__tests__/__mocks__/file-asset.ts` — Mock retournant 0 pour les assets PNG/images
- `lib/__tests__/__mocks__/react-native.ts` — Mock minimal Platform pour lib/mascot/utils.ts
- `package.json` — jest-expo et @testing-library/react-native dans devDependencies
- `jest.config.js` — moduleNameMapper ajouté pour PNG et react-native

## Decisions Made

- jest-expo installé sans remplacer le preset ts-jest existant — les 4 modules cibles (budget, world-grid, farm-engine, sagas-engine) sont du TypeScript pur sans imports React, donc ts-jest + node suffit
- Mock PNG dans jest.config.js moduleNameMapper : résout SyntaxError "Invalid or unexpected token" causée par `require('*.png')` dans lib/mascot/types.ts
- Mock react-native minimal : Platform.OS = 'ios' uniquement, car lib/mascot/utils.ts utilise Platform pour SecureStoreCompat

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mock PNG pour lib/mascot/types.ts**
- **Found during:** Task 2 (tests sagas-engine et farm-engine)
- **Issue:** lib/mascot/types.ts a `require('../../assets/items/*.png')` qui cause SyntaxError dans l'environnement jest node. Bloquait les tests farm-engine, sagas-engine, world-grid et aussi seasons + adventures (pré-existant).
- **Fix:** Ajout de `'\\.(png|jpg|jpeg|gif|svg|webp)$': '<rootDir>/lib/__tests__/__mocks__/file-asset.ts'` dans jest.config.js moduleNameMapper. Création de file-asset.ts retournant 0.
- **Files modified:** jest.config.js, lib/__tests__/__mocks__/file-asset.ts
- **Verification:** npx jest seasons.test.ts et adventures.test.ts passent maintenant
- **Committed in:** 22cf1f7 (Task 0 commit)

**2. [Rule 3 - Blocking] Mock react-native pour lib/mascot/utils.ts**
- **Found during:** Task 2 (tests sagas-engine)
- **Issue:** lib/mascot/sagas-engine.ts importe de lib/mascot/utils.ts qui importe Platform depuis react-native — SyntaxError "Cannot use import statement outside a module" en node env.
- **Fix:** Création de lib/__tests__/__mocks__/react-native.ts avec Platform mock. Ajout dans jest.config.js moduleNameMapper.
- **Files modified:** jest.config.js, lib/__tests__/__mocks__/react-native.ts
- **Verification:** npx jest sagas-engine.test.ts passe (18/18 tests)
- **Committed in:** bbf011d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Les deux fixes étaient nécessaires pour exécuter les tests dans l'environnement node. Aucun scope creep. Bonus : corrige aussi les suites seasons.test.ts et adventures.test.ts qui échouaient pré-existants.

## Issues Encountered

- Le test "parse les limites avec virgule décimale" a nécessité ajustement : la regex CATEGORY_REGEX parse `1,500` comme `1.5` (virgule décimale, pas séparateur de milliers). Test corrigé pour tester le vrai comportement.
- Le test advanceFarmCrops avec bonus saisonnier : le bonus ajoute 2 à tasksCompleted mais l'avancement ne se fait qu'une fois par appel. Test révisé pour utiliser tomato (tasksPerStage=2) avec saison été.
- getSagaCompletionResult : `dominantTrait` dans le résultat est le trait calculé (malice), pas le defaultTrait, même quand on utilise la récompense du defaultTrait. Test corrigé pour refléter le comportement réel.

## Next Phase Readiness

- Filet de sécurité en place pour budget, farm-engine, sagas-engine, world-grid
- 80 nouveaux tests passants (217 au total)
- Plans 01-02 (nettoyage), 01-03 (TypeScript), 01-04 (ESLint) peuvent continuer sans risque de régression sur ces modules

## Self-Check: PASSED

- `lib/__tests__/budget.test.ts` — FOUND
- `lib/__tests__/world-grid.test.ts` — FOUND
- `lib/__tests__/farm-engine.test.ts` — FOUND
- `lib/__tests__/sagas-engine.test.ts` — FOUND
- Commit 22cf1f7 — FOUND
- Commit 6599384 — FOUND
- Commit bbf011d — FOUND

---
*Phase: 01-safety-net*
*Completed: 2026-03-28*
