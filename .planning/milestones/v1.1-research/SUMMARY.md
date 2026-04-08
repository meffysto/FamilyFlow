# Project Research Summary

**Project:** FamilyFlow (React Native / Expo)
**Domain:** Mobile family productivity app — stabilization + gamification enrichment
**Researched:** 2026-03-28
**Confidence:** HIGH (testing, architecture, pitfalls), MEDIUM (Skia gamification path)

## Executive Summary

FamilyFlow is a production TestFlight app with a solid feature surface but significant technical debt concentrated in three areas: a 3431-line god hook (`useVault.ts`), 228 hardcoded color values that break dark mode, and zero test coverage outside of `lib/`. The immediate milestone has two tracks — stabilization (hardening the codebase before it becomes unmaintainable) and gamification enrichment (deepening the pixel farm and mascot system). Research across all four domains converges on a clear recommendation: fix the foundation before adding features. Every planned gamification addition (idle progression, animal care, seasonal events) depends on a reliable file write path that currently does not exist.

The recommended architecture is the Provider-over-Domain-Hooks pattern already partially in place. `useGamification.ts` and `useFarm.ts` demonstrate the target pattern: domain hooks that receive `vault` as a prop and push state changes via callbacks. The path forward is to replicate this pattern for the remaining 12 domains — one at a time, behind the existing `VaultContext` facade — without touching any of the ~90 consumer components. The existing public API stays stable throughout the refactoring. Testing infrastructure (jest-expo + RNTL v13) installs cleanly against SDK 54 and should be set up in the first phase to create a safety net for all subsequent work.

The three critical risks to manage proactively are: (1) a silent write-concurrency bug where rapid task completions can lose XP due to race conditions on `gamification.md` — this must be fixed with a per-file async write queue before any new gamification features are added; (2) vault file format corruption from schema changes without migration guards — every new data field must be append-only with a safe default; and (3) big-bang hook extraction that breaks the app — each domain hook must be extracted, composed, and validated in isolation before moving to the next.

## Key Findings

### Recommended Stack

The baseline stack (RN 0.81.5, Expo SDK 54, Reanimated 4.1, Expo Router 6, TypeScript 5.9) is established and stable. Only two net-new libraries are required for this milestone: `jest-expo ~54.0.11` and `@testing-library/react-native ^13.3.3`. Both install via `npx expo install` to get the SDK-54-aligned versions. The domain hook split, TypeScript strictness improvements, and parser reorganization require no new dependencies — they are structural changes only.

**Core technologies for this milestone:**
- `jest-expo ~54.0.11`: Jest preset with automatic Expo native module mocks — install via `npx expo install`, not npm
- `@testing-library/react-native ^13.3.3`: Component + hook testing including `renderHook` — replaces the archived `@testing-library/react-hooks`
- `@shopify/react-native-skia` (conditional): GPU-accelerated rendering for sprite sheets and particle effects — only if new gamification features outgrow SVG + Reanimated
- `useFrameCallback` (already available in Reanimated 4.1): Game loop pattern for farm day/night cycle and animations — no new install needed

**Do not install:** `detox` (E2E overkill), `zustand`/`jotai` (state library rewrite not needed), `@testing-library/react-hooks` (archived), any new particle library (existing stack is sufficient).

The Skia path carries MEDIUM confidence — SDK 54 compatibility is confirmed in principle but requires New Architecture (`newArchEnabled: true` in `app.json`) which must be verified before adoption.

### Expected Features

Research identified two feature tracks with distinct dependencies. Stabilization features unblock gamification enrichment; they cannot be deferred.

**Must have — stabilization (table stakes before any new features):**
- Unit tests for uncovered lib modules (`budget.ts`, `farm-engine.ts`, `sagas-engine.ts`, `world-grid.ts`) — silent regression risk on production data
- Error boundary + Sentry integration — crashes are currently invisible in production
- Write concurrency fix (per-file async mutex on `gamification.md`, `farm.md`) — prerequisite for all farm features
- Semantic color token cleanup for structural colors (228 hardcoded values) — visual glitches in dark mode
- Dead code removal + duplicate Claude API client extraction — reduce cognitive load before refactoring
- TypeScript `as any` fixes on data mutation paths — 8 known locations in `useVault.ts`

**Must have — gamification enrichment (table stakes for farm system):**
- Offline idle progression (farm advances while app closed, calculated on foreground) — signature feature, Terrarium/Little Farm Story pattern
- XP streak bonuses with week-based (not daily) framing — drives engagement without family anxiety
- Seasonal visual changes tied to real calendar — leverages existing `seasons.ts`

**Should have — differentiators:**
- Animal care loop (hunger/mood state, daily return mechanic — Tamagotchi pattern)
- Family quest / saga challenge system (shared progress bar over a multi-day goal)
- Tree visual milestone celebrations (special animation at XP thresholds)
- Saga reward rarity tiers (glow/animation on rare saga outcomes)
- Crop variety unlock progression (start with 3 crops, unlock more on level-up)

**Defer:**
- Family quest system (requires saga engine extension — non-trivial scope)
- Lazy recipe loading and mtime-based reload (performance optimization, not correctness)
- Component tests and E2E tests (add after unit test layer is solid)
- Crop variety unlocks (after idle progression is stable and tested)

**Anti-features (never build):** backend sync, public App Store distribution, social/multiplayer, in-app purchases, daily-streak punishment mechanics, AI-generated procedural farm content, 100% test coverage target.

### Architecture Approach

The target architecture is a single `VaultContext` backed by domain hooks composed inside `VaultProvider`. The god hook becomes a thin orchestrator that assembles domain hook returns into the existing flat `VaultState` interface via a single `useMemo`. Consumer components (`useVault()`) see no API change during the entire refactoring. The extraction order is dependency-driven: leaf domains first (no cross-domain reads), then mid-tier (needs profiles), then core domains (needs profiles + other domains), and finally `VaultProvider` becomes the pure composer.

**Major components:**
1. `VaultProvider` — owns `VaultManager` instance, `loadVaultData` orchestration, and assembled `VaultState`; calls all domain hooks; the only component that knows about all domains
2. Domain hooks (14 total) — each owns one domain's state, CRUD actions, and file I/O via injected `vault` prop; testable in isolation with a mocked `VaultManager`
3. `lib/parsers/` (split from `lib/parser.ts`) — one parser file per domain, barrel-exported from `lib/parsers/index.ts` for backward compatibility
4. `lib/gamification/events.ts` (new) — typed `GamificationEvent` discriminated union enabling event-driven XP dispatch from domain hooks to `useGamification`
5. Lib layer (`lib/gamification/`, `lib/mascot/`) — pure functions on serializable data; no React coupling; already well-structured

**Extraction tier order (build order constraint):**
- Tier 0: lib tests (no hook dependencies)
- Tier 1: `useDefis`, `useNotes`, `useStock` (leaf, no cross-domain reads)
- Tier 2: `useBudget`, `useRecipes`, `useMemories` (vault I/O only)
- Tier 3: `useTasks`, `useJournal`, `useCalendar` (needs profiles)
- Tier 4: `useGamification` event-dispatcher improvement (already exists; add typed events)
- Tier 5: `VaultProvider` refactor as composer (after all domain hooks exist)

### Critical Pitfalls

1. **Big-bang hook extraction** — Extracting multiple domains simultaneously causes cross-domain state ordering bugs and cascading re-renders. Prevention: one domain per PR, extract + compose + delete in the same commit, `tsc --noEmit` + TestFlight smoke test before the next extraction.

2. **iCloud write race conditions** — Rapid task completions can corrupt `gamification.md` and `farm.md` because `busyRef` guards only `loadVaultData`, not individual CRUD writes. Prevention: per-file async mutex (`Map<string, Promise>`) before adding any new gamification write paths.

3. **Vault schema corruption on TestFlight push** — Adding new fields without migration guards causes old-format files to lose data when re-serialized by new client code. Prevention: all new fields must be append-only with a safe default; write a migration guard that only adds the field when it is absent.

4. **False-green tests from jest-expo auto-mocks** — Auto-mocks for `expo-file-system`, `expo-secure-store`, and `expo-haptics` return `undefined` silently, making tests pass without exercising real code paths. Prevention: use an in-memory virtual filesystem mock; never mock `lib/parser.ts` or engine modules.

5. **Gamification reward inflation** — Adding new XP sources (farm, sagas, crafting) independently causes early levels to be trivially achievable. Prevention: all XP values must route through `constants/rewards.ts`; verify daily XP budget against level curve before any new reward source ships.

## Implications for Roadmap

Based on research, the dependency graph is clear and non-negotiable. Gamification enrichment features share a hard dependency on the write concurrency fix and on the lib test layer providing a regression safety net. The god hook split is a parallel ongoing effort that must not block stabilization work but should start in Phase 1 with the safest leaf domains.

### Phase 1: Safety Net

**Rationale:** Zero tests on the farm engine, budget module, and sagas engine means every subsequent change is a blind bet. Sentry integration means production bugs are invisible. These two things must exist before any other work — they make all future work safer and faster.
**Delivers:** Test coverage on the four highest-risk lib modules; production error visibility; dead code removed; duplicate API client consolidated; TypeScript `as any` eliminated on mutation paths.
**Addresses:** Unit test gaps (budget.ts, farm-engine.ts, sagas-engine.ts, world-grid.ts), error boundary, dead code, type safety.
**Avoids:** False-green tests from auto-mocks (establish mock strategy upfront); TypeScript regressions on data writes.
**Uses:** `jest-expo ~54.0.11`, `@testing-library/react-native ^13.3.3`.

### Phase 2: Code Quality + First Domain Extraction

**Rationale:** Semantic color tokens unblock all future UI work and fix visible dark mode glitches for users currently on TestFlight. The first god hook domain extraction (budget — the most isolated) establishes the extraction pattern before tackling higher-risk domains. Starting with budget makes sense because `lib/budget.ts` will have unit tests from Phase 1, making the extraction verifiable.
**Delivers:** 228 hardcoded color values resolved (structural colors only; pixel art palettes preserved); `useBudget` extracted with hook tests; VaultContext API unchanged.
**Addresses:** Semantic color coverage, god hook first domain split.
**Avoids:** Pixel art color breakage (classify colors before bulk replacement); context re-render avalanche (measure with React DevTools Profiler after extraction).
**Implements:** Domain Hook with Vault Injection pattern; Barrel Re-export for backward compatibility.

### Phase 3: Write Concurrency Fix + Core Gamification Hardening

**Rationale:** The write concurrency bug is the gate for all gamification enrichment. Nothing built in Phase 4 or beyond can be trusted without it. This phase also adds missing gamification tests (including XP end-to-end flow), establishes the XP budget model in `constants/rewards.ts`, and addresses the streak mechanic framing before any new streaks are built.
**Delivers:** Per-file async write mutex on shared vault files; `useGamification` hook tests; XP budget model documented and enforced; streak mechanic implemented with week-based framing and grace periods.
**Addresses:** Race condition guard on gamification writes, XP streak bonuses, consistent XP/level feedback.
**Avoids:** Silent data loss on rapid task completion; reward inflation (XP budget model first); streak anxiety for family users (week-based, never punishing).

### Phase 4: Gamification Enrichment — Farm Features

**Rationale:** With the write path reliable and the safety net in place, farm features can be built with confidence. Offline idle progression is the signature differentiator feature and should be prioritized. Seasonal events and the animal care loop extend the farm's daily return mechanic. Schema changes in this phase require migration guards per Pitfall 6.
**Delivers:** Offline idle progression (elapsed time → production formula on foreground); seasonal limited events tied to real calendar (extends `seasons.ts`); animal care loop (hunger/mood state); tree visual milestone celebrations.
**Addresses:** Offline-first idle progression, seasonal limited events, animal care loop, tree milestone celebrations.
**Avoids:** Vault schema corruption (append-only fields, migration guards on all new farm data fields); XP inflation (all farm rewards through `constants/rewards.ts`).

### Phase 5: Continued God Hook Extraction (Mid-Tier + Core Domains)

**Rationale:** After Phase 2 establishes the pattern and validates it in TestFlight, continue extracting domain hooks in tier order. Each extraction reduces the `useMemo` dependency count and makes the codebase incrementally more maintainable. The parser split (`lib/parser.ts` → `lib/parsers/`) happens in parallel with each domain extraction using the barrel re-export pattern.
**Delivers:** `useRecipes` (with lazy loading), `useTasks`, `useCalendar`, `useMeals`, `useProfiles` extracted; `VaultProvider` becomes a pure composer; `lib/parsers/` split complete.
**Addresses:** God hook domain split (full completion), incremental vault loading for recipes.
**Avoids:** Big-bang extraction (one domain per PR, tsc + TestFlight before next); context re-render avalanche (profile each extraction).

### Phase 6: Gamification Enrichment — Saga and Quest System

**Rationale:** The family quest system requires saga engine extension (`sagas-engine.ts` with explicit `SagaState` enum) and a shared progress bar abstraction. This is deferred until the hook architecture is clean enough to add new cross-domain features safely.
**Delivers:** Saga reward rarity tiers (glow, animation on rare outcomes); family quest/challenge system with shared progress bar; crop variety unlock progression.
**Addresses:** Family quest system, saga reward rarity, crop unlocks.
**Avoids:** Inline XP values (route all through `constants/rewards.ts`); global event bus anti-pattern (explicit callback props).

### Phase Ordering Rationale

The ordering is dictated by three dependency chains identified in research:
- The write concurrency fix (Phase 3) must precede all farm feature work (Phase 4) because every farm feature adds more write paths to the same shared files.
- The test safety net (Phase 1) must precede refactoring (Phase 2+) because the god hook split without tests is a roulette spin across 90+ components.
- The first domain extraction (Phase 2) must precede later extractions (Phase 5) to validate the pattern in production before committing to all 14 domain hooks.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (write queue):** The specific async mutex pattern for `expo-file-system` on iOS with NSFileCoordinator is not fully specified. Needs a prototype before committing to API shape.
- **Phase 4 (idle progression formula):** The production formula (crops grow offline, animals produce while away) needs calibration against the XP budget model. Easy to build, tricky to balance.
- **Phase 4 (Skia adoption decision):** If animal animations or farm tile rendering requires Skia, the New Architecture requirement must be verified before the phase begins. Cannot be determined from research alone.

Phases with standard patterns (skip research-phase):
- **Phase 1 (testing setup):** jest-expo + RNTL is fully documented. Configuration is well-known. No research needed.
- **Phase 2 (color tokens):** Mechanical find-and-replace guided by the classify-first rule. Standard React Native theming work.
- **Phase 5 (domain extraction):** The extraction pattern is fully specified in ARCHITECTURE.md with code examples. One domain at a time, no surprises.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (testing), MEDIUM (Skia) | jest-expo + RNTL from official Expo docs. Skia SDK 54 compatibility confirmed in principle but specific version unverified. |
| Features | MEDIUM-HIGH | Stabilization features from direct codebase audit (HIGH). Gamification differentiators from product analysis + peer-reviewed engagement research (MEDIUM). |
| Architecture | HIGH | Based on direct codebase inspection + established React patterns. Domain hook extraction pattern already demonstrated by `useGamification.ts` and `useFarm.ts`. |
| Pitfalls | HIGH (data/write pitfalls), MEDIUM (engagement pitfalls) | iCloud write race conditions from peer-reviewed arXiv source. Streak anxiety from peer-reviewed PMC source. |

**Overall confidence:** HIGH for the stabilization track, MEDIUM-HIGH for gamification enrichment ordering.

### Gaps to Address

- **Skia adoption gate:** Before any Skia-dependent feature is planned, verify `newArchEnabled: true` in `app.json`. If New Architecture is not enabled, Skia is blocked entirely. Resolve in Phase 4 planning.
- **Write queue API shape:** The per-file async mutex approach is specified at the concept level but not implemented. The exact API needs a spike (2-4 hours) before Phase 3 planning locks the implementation details.
- **XP budget calibration:** No existing data on average daily XP earned by current TestFlight users. Before Phase 3, run the existing gamification engine against a simulated "average family day" to establish the baseline. This informs both streak bonuses and all Phase 4 reward values.
- **`expo-document-picker` patch viability:** The `patches/expo-document-picker+14.0.8.patch` is version-pinned. Any Expo upgrade path in Phase 5 must check whether the patch was upstreamed before bumping the dependency.
- **SHA-256 PIN salt:** `contexts/AuthContext.tsx` uses a fixed salt. Low urgency for current family-only distribution, but must be resolved before any scope expansion. Flag for Phase 5 or a dedicated security pass.

## Sources

### Primary (HIGH confidence)
- [Expo Unit Testing docs](https://docs.expo.dev/develop/unit-testing/) — jest-expo setup, transformIgnorePatterns
- [Expo Router Testing docs](https://docs.expo.dev/router/reference/testing/) — renderRouter, nav matchers
- [@testing-library/react-native npm](https://www.npmjs.com/package/@testing-library/react-native) — v13.3.3, React 19 + RN 0.78+ support
- [React Native Testing Overview](https://reactnative.dev/docs/testing-overview) — testing pyramid rationale
- [Sentry Expo Integration](https://docs.expo.dev/guides/using-sentry/) — error boundary setup
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/) — noUncheckedIndexedAccess, exactOptionalPropertyTypes
- [iCloud OAE Transactional Semantics — arXiv 2602.19433](https://arxiv.org/html/2602.19433) — write race condition root cause
- [Gamification Anti-Patterns — arXiv 2412.05039](https://arxiv.org/html/2412.05039v1) — streak anxiety, dark patterns
- [Promoting Health via Gamification (Children) — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10886329/) — family engagement mechanics
- [Gamification for Family Engagement — PMC systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8460596/) — co-op mechanics outperform individual reward
- [Mocking Native Calls in Expo Modules — Expo Docs](https://docs.expo.dev/modules/mocking/) — auto-mock behavior
- Project-internal: `.planning/codebase/CONCERNS.md` — direct codebase audit

### Secondary (MEDIUM confidence)
- [Reanimated useFrameCallback docs](https://docs.swmansion.com/react-native-reanimated/docs/2.x/api/hooks/useFrameCallback/) — game loop pattern
- [React Native Skia Atlas docs](https://shopify.github.io/react-native-skia/docs/shapes/atlas/) — sprite/tile batch rendering
- [Context API Performance Pitfalls — Steve Kinney](https://stevekinney.com/courses/react-performance/context-api-performance-pitfalls) — re-render avalanche risk
- [Modularizing React Applications — Martin Fowler](https://martinfowler.com/articles/modularizing-react-apps.html) — domain hook decomposition
- [Run E2E tests on EAS Workflows — Expo Docs](https://docs.expo.dev/eas/workflows/examples/e2e-tests/) — Maestro integration
- [Viladia: Cozy Pixel Farm — Google Play](https://play.google.com/store/apps/details?id=com.selvasai.ttrebirth) — idle farm pattern observation
- [Habitica — Google Play](https://play.google.com/store/apps/details?id=com.habitrpg.android.habitica) — streak mechanic observation

### Tertiary (LOW confidence)
- [KiddiKash Best Chore Apps 2025](https://www.kiddikash.com/blog/best-chore-apps-2025) — feature landscape editorial

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
