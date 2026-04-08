# Technology Stack — Milestone Research

**Project:** FamilyFlow (React Native / Expo)
**Milestone scope:** Stabilization (testing, refactoring, cleanup) + gamification improvements
**Researched:** 2026-03-28
**Overall confidence:** HIGH (testing), MEDIUM (gamification Skia path)

---

## Context

This is a subsequent-milestone research document. The baseline stack (React Native 0.81.5, Expo SDK 54, Reanimated 4.1, Expo Router 6, TypeScript 5.9, jest 29, ts-jest 29) is already established and **not re-researched here**. This file covers only the additive tooling needed for the four target domains.

---

## Domain 1: Testing Infrastructure

### Recommended Stack

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `jest-expo` | `~54.0.11` | Jest preset for Expo | Mocks all Expo SDK native modules automatically; version-aligned to SDK 54 (use `npx expo install` to pin correct version) |
| `@testing-library/react-native` | `^13.3.3` | Component + hook testing | Standard community library for React Native; v13 is the current stable, supports React 19 + RN 0.78+; this project is on RN 0.81.5 |
| `@types/jest` | `^29.5.x` | Jest TypeScript types | Already needed; align with jest 29.7 already in the project |
| `expo-router/testing-library` (bundled) | ships with expo-router | Expo Router navigation testing | Built on top of RNTL; provides `renderRouter`, `toHavePathname`, `toHaveSegments` matchers — no extra install needed |

**NOT recommended:**
- `@testing-library/react-hooks` (standalone, archived) — its `renderHook` was merged into `@testing-library/react-native` v12+. Do not install separately.
- `Detox` (E2E) — overkill for a solo-dev family app. Manual TestFlight validation is sufficient for E2E.
- `react-test-renderer` directly — use `@testing-library/react-native` as the public API instead.

### Configuration

The project already has `jest ^29.7.0` and `ts-jest ^29.4.6`. The only required change is switching the Jest preset from the current generic setup to `jest-expo`:

```json
// package.json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
  ]
}
```

The `transformIgnorePatterns` above is the current Expo-recommended pattern (source: Expo unit testing docs). It tells Jest to transpile packages that ship as untranspiled ESM (most of the Expo ecosystem).

### What to Test — Priority Order

Based on CONCERNS.md and the existing 13 test files in `lib/__tests__/`:

1. **`lib/budget.ts`** — pure functions, no native deps, high business risk. Write with Jest directly.
2. **`lib/mascot/farm-engine.ts`, `lib/mascot/world-grid.ts`, `lib/mascot/sagas-engine.ts`** — pure game logic. Jest directly.
3. **`hooks/useVault.ts` slice (post-split)** — use `renderHook` from RNTL once the hook is split; testing a 3400-line hook monolithically is not feasible. Test each domain hook individually after extraction.
4. **Component smoke tests** — use `render` from RNTL for critical UI components (LootBoxOpener, TreeView) to catch hardcoded-color regressions after theme cleanup.

**Confidence:** HIGH — jest-expo + RNTL is the documented Expo recommendation. Version 13.3.3 is the current RNTL stable as of March 2026.

---

## Domain 2: Refactoring Large Hooks

No new libraries are required. This is a structural pattern, not a dependency problem.

### Recommended Pattern: Barrel Composition

The standard community pattern (2025) for splitting a "god hook" is:

1. **Extract domain slices bottom-up** — start with the most independent domains that have no cross-domain state reads. Based on CONCERNS.md: `budget`, `recipes`, `defis` are the lowest-coupling candidates.
2. **Each domain hook owns its state slice** — `useBudget` owns `budget*` state vars and their CRUD. `useRecipes` owns recipe state and CRUD. Etc.
3. **`VaultProvider` composes domain hooks** — `useVaultInternal()` calls each domain hook and re-exports a flat API from the combined return. No change to consumers until you're ready.
4. **Maintain the existing `useVault()` public API** — `VaultContext` continues to expose the same flat interface. Internal composition is invisible to the ~90 components already using `useVault()`.

This is the incremental (non-big-bang) approach. The migration surface at any point in time is one domain hook.

### Hook File Layout

```
hooks/
  useVault.ts          (existing — becomes a thin orchestrator)
  domain/
    useBudget.ts
    useRecipes.ts
    useTasks.ts
    useMeals.ts
    useGamificationState.ts   (distinct from existing hooks/useGamification.ts)
    useFarmState.ts
    useCalendar.ts
    useBabyLog.ts
    useMemories.ts
```

### Why NOT zustand / jotai / redux

The existing architecture uses React Context + a single custom hook. Introducing a state management library would:
- Require rewriting all 90+ consumer components
- Introduce a new dependency to learn and maintain
- Break the "incremental, non-cassant" constraint

The god hook problem is an organization problem, not a state management library problem. Context + domain hooks is the correct solution here.

**Confidence:** HIGH — this is a well-established React pattern with no tooling dependencies.

---

## Domain 3: TypeScript Strictness

### Current State

From CONCERNS.md: TypeScript strict mode is already enabled in `tsconfig.json`. The issues are:
- `as any` / `[] as any[]` assertions in `hooks/useVault.ts` (8 occurrences)
- 3 pre-existing compiler errors in `MemoryEditor.tsx`, `cooklang.ts`, `useVault.ts`
- `@ts-ignore` in `VaultPicker.tsx` (Android SAF — legitimate)

### No New Libraries Required

The fix is purely additive TypeScript discipline, not new deps. Recommended approach:

**Step 1 — Replace `as any[]` with typed fallbacks**

Replace patterns like `data.tasks as any[]` with explicit typed empty arrays:
```typescript
// Before
const tasks = (parsed.tasks as any[]) ?? []
// After
const tasks: Task[] = Array.isArray(parsed.tasks) ? parsed.tasks : []
```

**Step 2 — Enable `noUncheckedIndexedAccess` incrementally (optional, after cleanup)**

This flag adds `| undefined` to array element access and object indexing. It is NOT in the default `strict` bundle, but catches the class of bug common in vault parsing (reading `arr[0]` without checking length). It can be enabled per-file using `// @ts-nocheck` escape hatches during migration.

Source: TypeScript TSConfig Reference confirms this flag is separate from `strict`. One developer report (via WebSearch) found 10 real bugs by enabling it in a React Native codebase.

**Step 3 — Do NOT enable `exactOptionalPropertyTypes` yet**

This flag changes how optional properties work and is a breaking change for Expo and React Native's own types. It requires patching third-party type definitions. Not worth the overhead for this project.

**Recommended ESLint addition — `@typescript-eslint/no-explicit-any`**

The project likely has no ESLint config or a basic one. Adding this rule to whatever lint config exists will prevent regressions:

```json
"@typescript-eslint/no-explicit-any": "warn"
```

Use `warn` not `error` to avoid blocking existing code while cleaning up incrementally.

**Confidence:** HIGH for the strategy; MEDIUM for `noUncheckedIndexedAccess` (may surface unexpected TS errors in Expo SDK types themselves — verify on one file before enabling globally).

---

## Domain 4: Gamification / Pixel Art / Farm Mechanics

### What Already Exists (Do Not Replace)

The project already has:
- `lib/mascot/farm-engine.ts` — planting/harvesting/animal logic
- `lib/mascot/world-grid.ts` — tile-based grid
- `lib/mascot/engine.ts` — mascot state machine
- `lib/mascot/sagas-engine.ts` — narrative sagas
- `react-native-svg` ^15.12.1 — current SVG rendering for the tree/mascot
- `react-native-reanimated` ~4.1.1 — animation runtime
- `react-native-confetti-cannon` — loot box particle effect

### Skia for Future Pixel Art Enrichment (Optional, Not Required)

**`@shopify/react-native-skia`** enables GPU-accelerated rendering via Skia canvas. It is the 2025 standard for complex graphics in React Native (confirmed by Expo docs, multiple 2025 sources).

Relevant capabilities for this project:
- **Atlas component** — render a sprite sheet with many tiles in one GPU draw call. Ideal for the farm grid (all tiles share one texture atlas).
- **`useFrameCallback` (Reanimated)** + Skia canvas = game loop running at 60fps on the UI thread, no JS thread overhead.
- **Shader-based effects** — seasonal weather effects (rain, snow, falling leaves) on the farm/tree.

**BUT:** Skia is a significant addition. Key considerations before adopting:

1. **Architecture requirement:** Expo SDK 54 is described as "the last SDK to support the Old Architecture." Skia requires New Architecture (JSI). Verify the project uses New Architecture before adding Skia. Check `app.json` for `newArchEnabled: true`.

2. **SVG vs Skia tradeoff:** The existing tree/mascot is built in `react-native-svg`. Migrating to Skia canvas means rewriting ~47-100 SVG shapes as Skia paths/images. This is substantial work.

3. **Recommendation:** Keep `react-native-svg` for existing tree/mascot SVGs. Add Skia **only** if new gamification features require it (sprite-sheet animation, tile-based farm rendering at scale, particle systems beyond confetti-cannon's capability).

**Install command (if/when needed):**
```bash
npx expo install @shopify/react-native-skia
```
Use `npx expo install` (not `npm install`) to get the Expo-compatible version for SDK 54.

**Confidence for Skia:** MEDIUM — compatibility with Expo SDK 54 is confirmed in principle (Expo docs page exists for it), but the specific compatible version and New Architecture requirement need verification before adoption.

### Reanimated `useFrameCallback` for Game Loops (No New Dep)

Reanimated 4.1 (already installed) includes `useFrameCallback`. This is the correct tool for any continuous animation loop (farm day/night cycle, character walking, growing crops):

```typescript
import { useFrameCallback } from 'react-native-reanimated'

// Runs at 60fps on UI thread
useFrameCallback(({ timeSincePreviousFrame }) => {
  // update shared values that drive animated styles
})
```

Confirmed working pattern: a Doodle Jump clone was built using Reanimated `useFrameCallback` + Skia (Twitter/X source from Marc Rousavy, 2025).

**Confidence:** HIGH — `useFrameCallback` is documented and already available in the installed version.

### Particle Effects

- **Current:** `react-native-confetti-cannon` for loot box opening — keep as-is.
- **For richer particles (harvest celebration, XP burst, seasonal effects):** Implement with Reanimated `useFrameCallback` + SVG or Skia path rendering. Do not add another particle library; the existing stack is sufficient.

---

## Summary Table

| Library | Version | Status | Action |
|---------|---------|--------|--------|
| `jest-expo` | `~54.0.11` | Add | `npx expo install jest-expo --dev` |
| `@testing-library/react-native` | `^13.3.3` | Add | `npx expo install @testing-library/react-native --dev` |
| `@types/jest` | `^29.5.x` | Likely exists | Verify in devDependencies |
| Domain hook split | — | Refactor | No new deps; structural only |
| TypeScript `no-explicit-any` ESLint rule | — | Config change | Add to lint config |
| `@shopify/react-native-skia` | latest via `expo install` | Conditional | Only if new gamification features require it |
| `useFrameCallback` | bundled in reanimated 4.1 | Already available | Use from existing dep |

---

## What NOT to Install

| Package | Reason to Avoid |
|---------|----------------|
| `@testing-library/react-hooks` | Archived; `renderHook` now in RNTL directly |
| `detox` | E2E overkill for solo-dev family TestFlight app |
| `zustand` / `jotai` | State library rewrite not needed; domain hooks solve the problem |
| `exactOptionalPropertyTypes` flag | Breaking change against Expo/RN types; not worth the friction |
| Any new particle library | Reanimated + existing SVG/Skia is sufficient |
| `react-native-game-engine` | Too heavyweight; the farm is already implemented as pure logic + Reanimated |

---

## Sources

- [Expo Unit Testing docs](https://docs.expo.dev/develop/unit-testing/) — jest-expo setup, transformIgnorePatterns (HIGH confidence)
- [Expo Router Testing docs](https://docs.expo.dev/router/reference/testing/) — renderRouter, nav matchers (HIGH confidence)
- [@testing-library/react-native npm](https://www.npmjs.com/package/@testing-library/react-native) — v13.3.3, React 19 + RN 0.78+ support (HIGH confidence)
- [jest-expo 54.0.11 on Libraries.io](https://libraries.io/npm/jest-expo) — version confirmation (HIGH confidence)
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/) — noUncheckedIndexedAccess, exactOptionalPropertyTypes (HIGH confidence)
- [React Native 0.81 release notes](https://reactnative.dev/blog/2025/08/12/react-native-0.81) — RN 0.81 + React 19.1 (HIGH confidence)
- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54) — SDK 54 = RN 0.81 + React 19.1, last SDK supporting Old Architecture (HIGH confidence)
- [@shopify/react-native-skia Expo docs](https://docs.expo.dev/versions/latest/sdk/skia/) — Skia available in Expo ecosystem (MEDIUM confidence — specific SDK 54 version unconfirmed)
- [React Native Skia Atlas docs](https://shopify.github.io/react-native-skia/docs/shapes/atlas/) — sprite/tile batch rendering (MEDIUM confidence)
- [Reanimated useFrameCallback docs](https://docs.swmansion.com/react-native-reanimated/docs/2.x/api/hooks/useFrameCallback/) — game loop pattern (HIGH confidence)
- [Marc Rousavy tweet — Doodle Jump with useFrameCallback + Skia](https://x.com/mrousavy/status/1961077962200977821) — real-world validation (MEDIUM confidence)
- [TypeScript Best Practices 2025 — Perficient](https://blogs.perficient.com/2025/03/05/using-typescript-with-react-best-practices/) — no-explicit-any, unknown over any (MEDIUM confidence)
- [Codescene — Refactoring with custom hooks](https://codescene.com/blog/refactoring-components-in-react-with-custom-hooks) — domain hook decomposition pattern (MEDIUM confidence)

---

*Research date: 2026-03-28 | Confidence: HIGH (testing + TS), MEDIUM (Skia gamification path)*
