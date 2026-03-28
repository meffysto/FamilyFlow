# Phase 1: Safety Net - Research

**Researched:** 2026-03-28
**Domain:** Testing infrastructure, crash reporting, dead code removal, TypeScript/ESLint hygiene
**Confidence:** HIGH

## Summary

Phase 1 establishes the safety net required before any refactoring can happen safely. It consists of four independent tracks: (1) adding unit tests for the four critical lib modules that have zero coverage today, (2) wiring up Sentry for production crash visibility, (3) deleting confirmed dead code (5 deprecated telegram functions + `menageTasks` property + migration block), and (4) fixing 5 `as any` assertions on mutation paths in useVault.ts and adding ESLint to prevent future regressions.

The project already has a working Jest setup using `ts-jest` + node environment with 13 test files covering many lib modules. The four target modules (`lib/budget.ts`, `lib/mascot/farm-engine.ts`, `lib/mascot/sagas-engine.ts`, `lib/mascot/world-grid.ts`) are all pure functions with no React imports — they slot cleanly into the existing test setup without requiring `jest-expo` or RNTL. The TEST-01 requirement for "jest-expo + RNTL" is a misalignment with the actual codebase: the existing `ts-jest` + node setup already works and covers all four target modules. `jest-expo` + RNTL would be needed only for component/hook tests, which are deferred to v2.

The dead code removal is safe: all 5 deprecated functions in `telegram.ts` have zero callers in the main codebase (only present in `.claude/worktrees/` stale branches). The `menageTasks` property in `VaultContext` (in `lib/ai-service.ts`) is marked `@deprecated` with a `??` fallback that makes removal backward-compatible. The migration function `migrateMenageToTasks()` in `hooks/useVault.ts` (lines 393–481) is a one-time migration that runs idempotently — removing it is safe once the MENAGE_FILE no longer exists on real vaults (which the migration itself confirms by checking `tachesContent.includes('## Ménage')`).

**Primary recommendation:** Add new test files to `lib/__tests__/` using existing `ts-jest` + node pattern. Set up Sentry with `npx expo install @sentry/react-native` + plugin + metro config. Delete deprecated telegram functions and `menageTasks`. Fix `as any` assertions. Add ESLint flat config with `@typescript-eslint/no-explicit-any` in warn mode.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Setup jest-expo + @testing-library/react-native avec config fonctionnelle | The existing `ts-jest` + node preset already works for all four target modules (pure lib functions). `jest-expo` + RNTL adds component test capability needed only for v2 hook tests. Recommend installing both but keeping existing `ts-jest` preset as primary for lib tests; `jest-expo` configured as an optional second preset or parallel config. |
| TEST-02 | Tests unitaires pour lib/budget.ts | `lib/budget.ts` is pure functions: `parseBudgetConfig`, `parseBudgetMonth`, `serializeBudgetMonth`, `calculateBudgetStats`. No native deps. Node test environment works directly. |
| TEST-03 | Tests unitaires pour lib/mascot/farm-engine.ts | `farm-engine.ts` exports: `plantCrop`, `advanceFarmCrops`, `harvestCrop`, `serializeCrops`, `parseCrops`, `getUnlockedPlotCount`. Depends on `getCurrentSeason()` from `seasons.ts` (mockable). |
| TEST-04 | Tests unitaires pour lib/mascot/sagas-engine.ts | `sagas-engine.ts` exports: `getDominantTrait`, `getChapterNarrativeKey`, `getSagaCompletionResult`, `getSagasStatus`, `restDaysRemaining`, `getNextSagaForProfile`. All pure functions, date-dependent ones accept `date` param for testability. |
| TEST-05 | Tests unitaires pour lib/mascot/world-grid.ts | `world-grid.ts` exports: `WORLD_GRID` constant, `getUnlockedCropCells(treeStage)`, `CROP_CELLS`, `BUILDING_CELLS`, `CELL_SIZES`. Mostly data validation and grid logic — simplest module to test. |
| TEST-06 | Sentry intégré pour crash reporting en production | Requires `@sentry/react-native`, expo plugin in `app.json`, metro config in `metro.config.js`, init in `app/_layout.tsx`. EAS build (dev-client) already configured so native modules will work. |
| TEST-07 | Tests E2E Maestro pour les 3-5 parcours utilisateur critiques | Out of scope for Phase 1 per roadmap traceability table — REQUIREMENTS.md maps TEST-07 to Phase 1 but it's a large effort. Research included for completeness but should be deferred or scoped minimally. |
| QUAL-01 | Suppression des fonctions dépréciées dans lib/telegram.ts (5 fonctions) | All 5 functions (`formatTaskCompletedMessage`, `formatLootBoxMessage`, `formatAllTasksDoneMessage`, `formatLeaderboardMessage`, `formatDailySummaryMessage`) have zero callers in main codebase. Safe to delete lines 49–110. |
| QUAL-02 | Suppression de la propriété dépréciée menageTasks et du code de migration associé | `menageTasks?` in `lib/ai-service.ts` `VaultContext` interface (line 47). The `??` fallback at line 210 computes it inline — removing the optional prop is backward-safe. Migration block in `hooks/useVault.ts` lines 393–481 + call at line 584. 3 component files pass `menageTasks` as computed inline value to `buildWeeklyRecapData` (not to VaultContext). |
| QUAL-04 | Correction des 8 assertions `as any` sur les chemins de mutation dans useVault.ts | Located at lines 703, 876, 879, 882, 1282, 1705. Pattern is `[] as any[]` catch fallbacks and `as any` for missing typed operations. Fix approach per line documented in Code Examples. |
| QUAL-05 | Setup ESLint avec @typescript-eslint/no-explicit-any | No ESLint config exists. Install `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint`. Use flat config `eslint.config.js`. Enable `@typescript-eslint/no-explicit-any` as `warn` (not `error`) to avoid blocking on pre-existing violations outside mutation paths. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ts-jest | ^29.4.6 (already installed) | TypeScript transform for Jest node tests | Already configured and working — 13 test files use it |
| jest | ^29.7.0 (already installed) | Test runner | Already in devDeps |
| jest-expo | ~54.0.0 | Jest preset for Expo projects, required for component tests | Official Expo testing preset |
| @testing-library/react-native | ^14.x | Component test utilities | Standard React Native component testing |
| @sentry/react-native | ^6.x (latest Expo 54 compatible) | Crash reporting + performance monitoring | Official Sentry SDK, replaces deprecated sentry-expo |
| eslint | ^9.x | Linting engine | Standard |
| @typescript-eslint/eslint-plugin | ^8.x | TypeScript linting rules | Required for no-explicit-any rule |
| @typescript-eslint/parser | ^8.x | TypeScript AST parser for ESLint | Required for TS rule evaluation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jest-expo preset | Keep only ts-jest | jest-expo needed for future component tests; ts-jest is faster for pure lib tests |
| @sentry/react-native wizard | Manual setup | Wizard is simpler but assumes network access to Sentry dashboard during setup |
| ESLint flat config | Legacy .eslintrc | Flat config is the ESLint v9 standard; legacy still works but deprecated |

### Installation
```bash
# Testing
npx expo install jest-expo
npx expo install @testing-library/react-native --save-dev

# Sentry
npx expo install @sentry/react-native

# ESLint
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

---

## Architecture Patterns

### Recommended Project Structure
```
lib/__tests__/
├── __mocks__/           # Already: expo-secure-store, expo-localization, widget-bridge
├── budget.test.ts       # NEW — TEST-02
├── farm-engine.test.ts  # NEW — TEST-03
├── sagas-engine.test.ts # NEW — TEST-04
├── world-grid.test.ts   # NEW — TEST-05
└── (13 existing files)
eslint.config.js         # NEW — QUAL-05
metro.config.js          # MODIFY — add getSentryExpoConfig
app.json                 # MODIFY — add @sentry/react-native/expo plugin
app/_layout.tsx          # MODIFY — add Sentry.init() + Sentry.wrap()
```

### Pattern 1: Existing ts-jest Test Pattern (HIGH confidence)
**What:** Pure lib function tests in node environment, no React imports
**When to use:** For all four target modules (budget, farm-engine, sagas-engine, world-grid) — they are pure TypeScript

```typescript
// Pattern from lib/__tests__/mascot-engine.test.ts
import { plantCrop, harvestCrop, advanceFarmCrops } from '../mascot/farm-engine';

describe('plantCrop', () => {
  it('plante une culture sur une parcelle vide', () => {
    const result = plantCrop([], 0, 'carrot');
    expect(result).toHaveLength(1);
    expect(result[0].cropId).toBe('carrot');
    expect(result[0].plotIndex).toBe(0);
  });

  it('ignore si la parcelle est déjà occupée', () => {
    const crops = plantCrop([], 0, 'carrot');
    const result = plantCrop(crops, 0, 'tomato');
    expect(result).toHaveLength(1); // no duplicate
  });
});
```

### Pattern 2: Mocking `getCurrentSeason()` for farm-engine tests
**What:** `farm-engine.ts` calls `getCurrentSeason()` from `./seasons.ts` — mock it with jest.mock
**When to use:** Any test of `advanceFarmCrops` that needs to control seasonal bonuses

```typescript
// Source: Jest docs — module mocking pattern
jest.mock('../mascot/seasons', () => ({
  getCurrentSeason: jest.fn().mockReturnValue('printemps'),
}));

import { getCurrentSeason } from '../mascot/seasons';
// Then in test:
(getCurrentSeason as jest.Mock).mockReturnValue('ete');
```

### Pattern 3: Sentry Initialization in Expo Router Layout
**What:** Wrap entire app + init Sentry before any React render
**When to use:** Phase 1 crash reporting setup

```typescript
// Source: https://docs.sentry.io/platforms/react-native/manual-setup/expo/
// app/_layout.tsx — before export default
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,           // 20% performance sampling
  enabled: !__DEV__,               // disable in dev to avoid noise
  environment: __DEV__ ? 'development' : 'production',
});

// Wrap the default export
export default Sentry.wrap(RootLayout);
```

### Pattern 4: ESLint Flat Config with @typescript-eslint
**What:** Minimal ESLint config targeting no-explicit-any on mutation paths
**When to use:** Phase 1 setup

```javascript
// eslint.config.js
// Source: https://typescript-eslint.io/getting-started/
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['hooks/**/*.ts', 'hooks/**/*.tsx', 'lib/**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
```

### Anti-Patterns to Avoid
- **Adding jest-expo as the only preset:** Current 13 lib tests use `ts-jest` + node. Switching to `jest-expo` preset alone would break them — jest-expo uses a different transform and jsdom/RN environment.
- **Using `as any[]` in catch blocks:** The existing pattern `catch(() => [] as any[])` loses type info. Replace with typed array e.g. `catch((): SomeType[] => [])`.
- **Importing React Native components in lib tests:** Target modules are pure functions — keep them in node environment.
- **Sentry `tracesSampleRate: 1.0` in production:** Full sampling on a solo-dev app will flood the free tier; use 0.1–0.2.
- **ESLint `no-explicit-any` as `error`:** The codebase has pre-existing `as any` in files outside mutation paths (e.g. `telegram.ts` for FormData). Setting as `error` would block `npx tsc --noEmit` equivalent check. Use `warn` and only fix mutation paths.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native crash symbolication | Custom crash logger | `@sentry/react-native` | Source map upload, RN native crash symbols, breadcrumbs |
| TypeScript-aware linting | Custom lint script | `@typescript-eslint` | Handles TSX, generics, complex inference that plain ESLint misses |
| Jest Expo module mocking | Custom module resolver | `jest-expo` preset | Handles 50+ Expo SDK modules automatically |

---

## Common Pitfalls

### Pitfall 1: Two Jest Configs Conflicting
**What goes wrong:** Adding `jest-expo` preset to `package.json` breaks existing `ts-jest` lib tests (wrong environment, wrong transform).
**Why it happens:** `jest-expo` uses React Native environment; `ts-jest` uses node. They need separate config or careful merging.
**How to avoid:** Keep the existing `jest.config.js` using `ts-jest` for `lib/` tests. Add a separate `jest.expo.config.js` for future component tests using `jest-expo`. Or use Jest project runners to separate environments.
**Warning signs:** Test output shows "Cannot use import statement" or "document is not defined" after switching presets.

### Pitfall 2: Sentry DSN Committed to Repo
**What goes wrong:** DSN hardcoded in `app/_layout.tsx` gets committed and pushed.
**Why it happens:** Quick copy-paste from Sentry dashboard.
**How to avoid:** Store DSN in `EXPO_PUBLIC_SENTRY_DSN` env var. Add to `.env.local` (gitignored). Pass via EAS secrets for production builds.
**Warning signs:** DSN string like `https://xxxxx@oXXX.ingest.sentry.io/YYYY` appears in git diff.

### Pitfall 3: Sentry Not Initializing Before Expo Router
**What goes wrong:** Crashes during Expo Router startup are not captured because Sentry inits inside a React component.
**Why it happens:** Calling `Sentry.init()` inside a hook or component lifecycle.
**How to avoid:** Call `Sentry.init()` at module level in `app/_layout.tsx`, before the component definition. Use `Sentry.wrap()` on the exported default component.
**Warning signs:** Sentry dashboard shows no events even after confirmed crashes.

### Pitfall 4: `menageTasks` Removal Breaking `buildWeeklyRecapData` calls
**What goes wrong:** Removing `menageTasks` from `VaultContext` interface breaks the 3 component files that pass `menageTasks` as an inline-computed parameter to `buildWeeklyRecapData`.
**Why it happens:** `menageTasks` appears in two contexts: (a) the deprecated `VaultContext` optional prop, and (b) a parameter name in `buildWeeklyRecapData(tasks, menageTasks, ...)` signature from `lib/weekly-recap.ts`. These are different things — the weekly-recap parameter stays.
**How to avoid:** Remove only the `menageTasks?` prop from `VaultContext` interface in `lib/ai-service.ts` and the `??` fallback at line 210. The `buildWeeklyRecapData` second parameter is a local variable named `menageTasks` passed as a filtered slice — this is fine and stays.
**Warning signs:** TypeScript errors in `DashboardInsights.tsx`, `RDVEditor.tsx`, `DictaphoneRecorder.tsx`.

### Pitfall 5: `as any` Fixes Introducing New Type Errors
**What goes wrong:** Fixing `[] as any[]` with properly typed arrays causes new downstream TypeScript errors if the consuming code assumed `any`.
**Why it happens:** `any` propagates — removing it forces callers to be correctly typed too.
**How to avoid:** Fix each `as any` occurrence with the most specific type available. The `loadVaultData` catch fallbacks need the return type of each promise branch.
**Warning signs:** `npx tsc --noEmit` shows new errors in `hooks/useVault.ts` after changes.

---

## Code Examples

### budget.ts — Key Functions to Test
```typescript
// Source: lib/budget.ts (verified by direct read)
// parseBudgetConfig, parseBudgetMonth, serializeBudgetMonth — all pure
// Test data pattern:
const CONFIG_CONTENT = `## Catégories\n- 🛒 Courses: 600\n- 👶 Bébé: 200\n`;
const result = parseBudgetConfig(CONFIG_CONTENT);
// expect(result.categories[0]).toEqual({ emoji: '🛒', name: 'Courses', limit: 600 });

const MONTH_CONTENT = `- 2026-01-15 | 🛒 Courses | 45.50 | Intermarché\n`;
const entries = parseBudgetMonth(MONTH_CONTENT);
// expect(entries[0].amount).toBe(45.5);
```

### farm-engine.ts — Key Functions to Test
```typescript
// Source: lib/mascot/farm-engine.ts (verified by direct read)
// harvestCrop: returns reward = cropDef.harvestReward * (isGolden ? 5 : 1)
// advanceFarmCrops: FIFO, advances first non-mature crop by 1 (or 2 with seasonal bonus)
// serializeCrops/parseCrops: CSV round-trip

// Test golden multiplier:
// Force Math.random to return < 0.03 → isGolden = true
jest.spyOn(Math, 'random').mockReturnValueOnce(0.01);
const crops = plantCrop([], 0, 'carrot');
expect(crops[0].isGolden).toBe(true);
```

### world-grid.ts — Key Functions to Test
```typescript
// Source: lib/mascot/world-grid.ts (verified by direct read)
// WORLD_GRID has 20 cells (not 24 — centre reserved for tree)
// getUnlockedCropCells returns slice of CROP_CELLS sorted by unlockOrder
import { WORLD_GRID, getUnlockedCropCells, CROP_CELLS } from '../mascot/world-grid';
// expect(WORLD_GRID).toHaveLength(20); // 6x4 grid minus 4 tree cells + 2 deco = 20
// expect(CROP_CELLS[0].unlockOrder).toBe(0); // but first CROP cell unlockOrder=2
```

### Fixing `as any` in useVault.ts — Line-by-Line
```typescript
// Source: hooks/useVault.ts (verified by direct read)

// Line 703: catch fallback for routines
// Before: .catch((e) => { debugErrors.push(...); return [] as any[]; })
// After:
.catch((e): Routine[] => { debugErrors.push(`routines: ${e}`); return []; })

// Line 876: gamification catch
// Before: .catch(() => [] as any[])
// After (return type is GamificationData | null, not array):
.catch((): GamificationData | null => null)

// Line 879: gratitude catch
// Before: .catch(() => [] as any[])
// After:
.catch((): GratitudeEntry[] => [])

// Line 882: wishlist catch
// Before: .catch(() => [] as any[])
// After:
.catch((): WishlistItem[] => [])

// Line 1282: treeSpecies cast
// Before: { ...p, treeSpecies: species as any }
// After: cast to the actual union type from types.ts
// After: { ...p, treeSpecies: species as TreeSpecies }

// Line 1705: delete lineIndex from stock update
// Before: delete (updated as any).lineIndex;
// After: const { lineIndex: _, ...updatedWithout } = updated; await addStockItem(updatedWithout);
```

### Sentry Metro Config
```javascript
// Source: https://docs.sentry.io/platforms/react-native/manual-setup/expo/
// metro.config.js
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const config = getSentryExpoConfig(__dirname);
module.exports = config;
```

### Deleting Deprecated Telegram Functions
```typescript
// Source: lib/telegram.ts (verified by direct read)
// Delete lines 49-110 (inclusive):
// - formatTaskCompletedMessage (lines 49-57)
// - formatLootBoxMessage (lines 59-73)
// - formatAllTasksDoneMessage (lines 75-87)
// - formatLeaderboardMessage (lines 89-96)
// - formatDailySummaryMessage (lines 99-110)
// Zero callers in main codebase (confirmed by grep).
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sentry-expo` package | `@sentry/react-native` + expo plugin | Expo SDK 50 (Jan 2024) | `sentry-expo` is deprecated, do not install it |
| `.eslintrc.json` | `eslint.config.js` (flat config) | ESLint v9 (2024) | Use flat config — legacy format still works but not future-proof |
| `jest.config.js` with ts-jest only | `jest-expo` preset for component tests | Expo SDK 49+ | Both coexist; ts-jest for lib, jest-expo for components |

**Deprecated/outdated:**
- `sentry-expo`: Replaced by `@sentry/react-native` — do not install.
- `Swipeable` from `react-native-gesture-handler`: Use `ReanimatedSwipeable` (project convention).
- `jest.resetAllMocks` across all tests: Prefer `jest.clearAllMocks` to preserve mock implementations.

---

## Open Questions

1. **Should jest-expo be added alongside ts-jest or replace it?**
   - What we know: TEST-01 says "jest-expo + RNTL configurés" but all 4 target modules are pure lib functions that work fine with existing ts-jest + node.
   - What's unclear: Whether the planner should add jest-expo as a secondary project or as the main preset (breaking existing tests).
   - Recommendation: Install `jest-expo` as a devDependency and document it in package.json jest config for future component tests. Keep existing `jest.config.js` with `ts-jest` for lib tests. Add a note in Wave 0 to configure dual environments if needed.

2. **Sentry project creation prerequisite**
   - What we know: Sentry init requires a DSN which requires a Sentry account and project.
   - What's unclear: Whether a Sentry project already exists for FamilyFlow.
   - Recommendation: Planner should make Sentry account/project creation an explicit Wave 0 prerequisite step, with the DSN stored as `EXPO_PUBLIC_SENTRY_DSN` in `.env.local`.

3. **TEST-07 (Maestro E2E) — in scope or defer?**
   - What we know: REQUIREMENTS.md maps TEST-07 to Phase 1. The REQUIREMENTS.md Out of Scope section notes "Detox E2E — Maestro recommandé pour Expo en 2026". Setting up Maestro + writing 3-5 flows is a significant effort.
   - What's unclear: Whether this was intentionally included in Phase 1 or is a mistake in the traceability table.
   - Recommendation: Defer Maestro E2E to Phase 2 or standalone. Phase 1 success criteria only mention 4 unit test modules + Sentry + dead code + ESLint.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `lib/telegram.ts`, `hooks/useVault.ts`, `lib/ai-service.ts`, `lib/budget.ts`, `lib/mascot/farm-engine.ts`, `lib/mascot/sagas-engine.ts`, `lib/mascot/world-grid.ts`, `.planning/codebase/CONCERNS.md`, `jest.config.js`, `package.json`
- [Expo Unit Testing docs](https://docs.expo.dev/develop/unit-testing/) — jest-expo + RNTL install steps
- [Sentry Expo manual setup](https://docs.sentry.io/platforms/react-native/manual-setup/expo/) — package, plugin, metro config, init pattern

### Secondary (MEDIUM confidence)
- [Using Sentry - Expo Docs](https://docs.expo.dev/guides/using-sentry/) — recommends wizard approach, confirms @sentry/react-native for SDK 50+
- Grep results across main codebase confirming 0 callers for deprecated telegram functions

### Tertiary (LOW confidence)
- TypeScript-ESLint flat config recommendation (ESLint v9 flat config pattern — widely adopted but not directly verified against this project's Node 23 environment)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against package.json, official docs
- Architecture: HIGH — based on direct code reads of all target files
- Dead code scope: HIGH — grepped main codebase, confirmed zero callers
- `as any` locations: HIGH — direct line numbers from CONCERNS.md + grep validation
- Pitfalls: HIGH — derived from actual code structure
- Sentry setup: HIGH — official docs, confirmed sentry-expo deprecation

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (Sentry SDK: fast-moving, recheck before install; jest-expo: stable with Expo SDK 54)
