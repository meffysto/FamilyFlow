# Project Research Summary

**Project:** FamilyFlow v1.4 — Jardin Familial (Place du Village)
**Domain:** Cooperative multi-profile shared garden zone added to a React Native / Expo pixel farm game with file-based (Obsidian vault + iCloud) persistence
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

FamilyFlow v1.4 adds a cooperative "Place du Village" — a second tilemap zone shared across all family profiles — to an already-shipped single-player pixel farm. The app has a mature, well-patterned codebase: the existing `TileMapRenderer`, `WorldGridView`, `FamilyQuest` contribution engine, `parseFamilyQuests` vault parser, and Reanimated transition patterns provide direct, tested building blocks for every feature in this milestone. Zero new npm dependencies are required. The architecture decision is clear: the Village is not a new system — it is a new visual consumer of existing cooperative infrastructure, backed by a single new shared vault file (`jardin-familial.md`).

The recommended approach is a strict bottom-up build order: data foundation first (parser, shared file schema), then domain hook (`useGarden.ts` as an isolated domain hook, never merged into the 3431-line god hook), then Village screen components, and finally the portal entry point in `tree.tsx` as the smallest possible change to the existing farm screen. Every feature maps cleanly to a proven existing pattern: `FamilyQuestTemplate` drives weekly objectives, `applyQuestReward` handles rewards, `onQuestProgress` callback handles harvest contributions (already wired), and `contributeFamilyQuest` handles task contributions (already wired from v1.3).

The dominant risk in this milestone is not technical novelty but data integrity: the shared `jardin-familial.md` file is written by any profile, creating stale-read corruption and iCloud double-contribution risks that do not exist for per-profile files. Three design decisions eliminate these risks before any UI is built: (1) append-only contribution log instead of mutable total, (2) read-before-write pattern for all shared file mutations, (3) once-flag in the shared file for weekly objective generation and per-profile flags in `gami-{id}.md` for reward claims. These must be encoded in the data layer phase — retrofitting them later is expensive.

---

## Key Findings

### Recommended Stack

Zero new production dependencies. Every capability needed for v1.4 is present in the locked stack (`react-native-reanimated ~4.1.1`, `expo-router ~6.0.23`, `date-fns ^4.1.0`, `react-native-confetti-cannon ^1.5.2`, `gray-matter ^4.0.3`). The existing `TileMapRenderer` is fully parameterized — it accepts `FarmMapData` via props, and `buildVillageMap()` returns the same type. No renderer changes needed. The existing `WorldCell` type covers all village grid cell needs. The existing `FamilyQuest` contribution engine handles harvest and task contributions with no changes required.

**Core technologies:**
- `TileMapRenderer.tsx` + `farm-map.ts` pattern: second tilemap instance via `village-map.ts` + `buildVillageMap()` — already parameterized, zero changes to renderer
- `FamilyQuest` + `parseFamilyQuests` + `useVaultFamilyQuests`: contribution backbone reused for village weekly objective — entire engine already handles harvest + task contributions
- `react-native-reanimated ~4.1.1` + `expo-router ~6.0.23`: portal transition (fade + `router.push`) — same pattern as `EvolutionOverlay.tsx`
- `date-fns ^4.1.0`: weekly boundary detection (`startOfWeek`, `isAfter`, `parseISO`) — already used in `FamilyQuestBanner.tsx`
- `react-native-confetti-cannon ^1.5.2`: reward celebration — already used in `LootBoxOpener.tsx`

### Expected Features

**Must have (table stakes) — v1.4:**
- `jardin-familial.md` shared data model + `parseGarden` / `serializeGarden` in `lib/parser.ts` — foundation for all other features
- `addContribution(profileId, type, amount)` with append-only log — core cooperative primitive
- Weekly objective: auto-generated target + progress bar — users expect a visible shared goal
- Contribution feed + per-member indicators — visibility of teammates' actions is required for cooperative engagement
- Collective reward on goal completion (XP to all profiles + IRL activity suggestion) — cooperative loop payoff
- Portal tap-target on farm screen navigating to Village screen — required for discoverability
- Village screen with distinct tilemap (cobblestone / pavés dominant) — cooperative space must feel different from personal farm
- Historical log panel (past weeks, interactive) — memory object, explicitly in PROJECT.md scope
- Task contributions hooked into `applyTaskEffect()` — already wired in v1.3, low-risk extension
- Harvest contributions hooked into farm harvest path — `onQuestProgress` callback already exists in `useFarm.ts`

**Should have (competitive) — v1.5:**
- Village ambiance variation by progress (3 visual states: empty / active / festive) — embeds reward signal in environment; HIGH complexity, defer
- Avatar placement in village space — presence signal; MEDIUM complexity
- Family vote on activity reward suggestion — agency; LOW value, HIGH complexity

**Defer (v2+):**
- Village tech tree / cosmetic upgrades via collective milestones
- Seasonal village events tied to existing seasonal engine
- Cross-season village history

### Architecture Approach

The Village is a second, shared tilemap zone rendered by the unchanged `TileMapRenderer` + `WorldGridView` stack, backed by a new shared `jardin-familial.md` vault file. The cooperative data layer reuses the `FamilyQuest` engine entirely — the Village screen is a new visual consumer of already-flowing contribution data. A new domain hook `hooks/useGarden.ts` (modeled on `hooks/useVaultFamilyQuests.ts`) owns all garden state and actions, wired into `VaultContext` via composition. The Village screen is a hidden screen accessed via portal in `tree.tsx`, not a new tab.

**Major components:**
1. `lib/mascot/village-map.ts` + `lib/mascot/village-grid.ts` — terrain data and grid cells (new files, mirror farm-map.ts / world-grid.ts patterns)
2. `lib/parser.ts` (additive) + `hooks/useGarden.ts` (new domain hook) — shared state persistence and business logic
3. `app/(tabs)/village.tsx` — Village screen shell assembling `TileMapRenderer`, `VillageGridView`, `VillageQuestPanel`, `VillageHistoryBoard`
4. `components/mascot/VillagePortalButton.tsx` — minimal portal overlay in `tree.tsx`
5. `constants/weeklyQuestTemplates.ts` — auto-generation template library

### Critical Pitfalls

1. **Shared file stale-read corruption** — always read `jardin-familial.md` fresh from disk immediately before any write; never mutate from React state snapshot for shared file writes

2. **iCloud double-contribution via mutable total** — use an append-only contribution log (table rows: `timestamp | profileId | type | amount`); derive total from log rows on read; deduplicate rows with same profileId + timestamp within 5-minute window

3. **Weekly objective generated twice across profiles** — store week identifier and `generated_by` flag in shared file; any profile can trigger generation, only the first write wins

4. **Reward fires multiple times across profile switches** — two-flag pattern: shared completion flag in `jardin-familial.md` + per-profile claimed flag in `gami-{id}.md` keyed by ISO week

5. **World-grid ID collision during portal transition** — prefix all Village cell IDs with `village_` namespace; never mount FarmGrid and VillageGrid at full resolution simultaneously

6. **God hook boundary violation** — `hooks/useGarden.ts` as independent domain hook; verify `useVault.ts` grows by no more than 20 lines

---

## Implications for Roadmap

Based on research, the build order is dictated by data dependencies: shared file schema must exist before any hook, hook must exist before any UI, and the portal can only be added once the Village screen exists to navigate to.

### Phase 1: Garden Data Foundation
**Rationale:** Every other feature depends on the shared vault file and its parser. The contribution format (append-only vs mutable) is an irreversible architectural decision that must be made and tested before any UI is written. Pitfalls 1, 2, and 8 are addressed here.
**Delivers:** `jardin-familial.md` schema, `parseGarden()` / `serializeGarden()` in `lib/parser.ts`, `lib/mascot/village-map.ts` (buildVillageMap), `lib/mascot/village-grid.ts` (VILLAGE_GRID), `constants/weeklyQuestTemplates.ts`
**Addresses:** Shared data model (table-stakes foundation)
**Avoids:** Stale-read corruption (Pitfall 1), iCloud double-contribution (Pitfall 2), parser regex collision (Pitfall 8)

### Phase 2: Garden Domain Hook
**Rationale:** Business logic before UI. Must be isolated as `hooks/useGarden.ts` to prevent god hook growth. VaultContext wiring is the highest-risk change in the milestone and must be verified with a TypeScript check before any screen code is added.
**Delivers:** `hooks/useGarden.ts` with `loadGardenData`, `addContribution`, `generateWeeklyObjectiveIfNeeded`, `checkRewardEligibility`, `claimReward`; `hooks/useVault.ts` + `contexts/VaultContext.tsx` wiring (additive, ~20 lines)
**Addresses:** Contribution tracking (task + harvest bridges), weekly auto-generation, reward distribution
**Avoids:** Cross-profile objective double-generation (Pitfall 4), reward multi-fire (Pitfall 6), contribution misattribution (Pitfall 5), god hook growth (Pitfall 7)

### Phase 3: Village Screen + Components
**Rationale:** All new UI files — fully additive, no existing files touched except `app/(tabs)/_layout.tsx` (one line). Depends on Phase 2 hook existing. `TileMapRenderer` and `WorldCell` type reused unchanged.
**Delivers:** `app/(tabs)/village.tsx`, `components/mascot/VillageGridView.tsx`, `components/mascot/VillageQuestPanel.tsx`, `components/mascot/VillageHistoryBoard.tsx`
**Addresses:** Distinct village visual identity, weekly objective display, contribution feed, per-member indicators, historical log panel, collective reward moment
**Avoids:** World-grid ID collision (Pitfall 3) by namespacing Village cell IDs from the start

### Phase 4: Portal Integration
**Rationale:** Smallest possible change to the existing farm screen — deferred until the Village screen exists to navigate to. Minimizes regression risk to `tree.tsx`, the most battle-tested screen in the codebase.
**Delivers:** `components/mascot/VillagePortalButton.tsx` overlay in `app/(tabs)/tree.tsx`; fade animation via Reanimated; `router.push('/village')` navigation
**Addresses:** Portal transition (farm to village), discoverability
**Avoids:** Dual-mount grid collision during transition (Pitfall 3); portal as full-screen route, not modal (avoids gesture handler stack conflicts)

### Phase Ordering Rationale

- Data before hook before UI is the only dependency-safe order — UI cannot be built without a working hook, hook cannot be built without a schema
- Garden hook isolated in its own phase because VaultContext wiring is the single highest-risk change; isolating it enables a focused TypeScript check
- Portal is last because `tree.tsx` is the most battle-tested screen in the codebase; touching it last minimizes regression exposure
- Append-only contribution log format (Phase 1 decision) must not be changed after Phase 2 hook is built — retrofitting requires rewriting both parser and hook

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (Data Foundation):** `parseFamilyQuests` is a direct template; Wang tileset rendering confirmed reusable; no unknowns
- **Phase 2 (Domain Hook):** `useVaultFamilyQuests.ts` is a direct template; VaultContext wiring is well-established
- **Phase 3 (Village Screen):** All components mirror existing counterparts; `TileMapRenderer` reuse confirmed
- **Phase 4 (Portal):** `router.push` + Reanimated fade is established; no custom transition required

No phase requires a `/gsd:research-phase` call — the existing codebase provides sufficient pattern documentation for all four phases.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection — all capabilities map to existing production code; zero dependency gap confirmed |
| Features | MEDIUM | Cooperative game design patterns from WebSearch + direct codebase integration points confirmed; v1.5+ features are informed estimates |
| Architecture | HIGH | All data flows traced through actual source files; TileMapRenderer parameterization confirmed; FamilyQuest contribution backbone confirmed |
| Pitfalls | HIGH | Derived from direct codebase audit of write paths, iCloud coordination, and documented CONCERNS.md fragile areas |

**Overall confidence:** HIGH

### Gaps to Address

- **Village terrain sprites:** New art assets (cobblestone Wang tileset variants) required. Existing `grass_to_cobblestone` tileset may partially cover needs. Scope of new sprite work is LOW confidence — needs art asset audit before Phase 1 is marked complete.
- **Portal transition fidelity:** Standard `router.push` produces iOS stack animation. A cross-fade overlay is achievable with Reanimated but no existing codebase example does full-screen fade + navigate. Treat as MEDIUM risk; validate in Phase 4 spike before committing to specific animation style.
- **Contribution log pruning:** Append-only log with 4-week rolling window avoids unbounded growth. Archive cutoff logic (move rows older than 4 weeks to `jardin-historique.md`) should be added as a parser utility in Phase 1 even if not yet called, to avoid retrofitting later.
- **First-open cold-start UX:** An empty Village before the first objective is generated causes confusion. Phase 2 hook should generate the first objective on Village first-open (not on Sunday). The UX flow (companion explanation) is not yet designed.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `lib/mascot/farm-map.ts` — `FarmMapData`, `buildFarmMap`, `TerrainType`, Wang tileset rendering confirmed
- `lib/mascot/world-grid.ts` — `WorldCell`, `WORLD_GRID`, `CELL_SIZES` confirmed
- `components/mascot/TileMapRenderer.tsx` — parameterized via `buildFarmMap()`, fully reusable
- `lib/quest-engine.ts` — `FamilyQuest`, `FamilyQuestTemplate`, `createQuestFromTemplate`, `applyQuestReward` confirmed
- `lib/parser.ts:1122` — `FAMILY_QUESTS_FILE`, `parseFamilyQuests`, `serializeFamilyQuests` patterns confirmed
- `hooks/useVault.ts:1125` + `hooks/useVaultFamilyQuests.ts` — domain hook composition pattern confirmed
- `.planning/codebase/CONCERNS.md` — vault write concurrency fragile area documented
- `.planning/RETROSPECTIVE.md` — v1.1 per-profile file migration rationale (directly informs shared file design)
- `.planning/PROJECT.md` — key decisions (ARCH-05: zero new npm deps; TUTO-02: SecureStore flags)
- `package.json` — all dependency versions verified

### Secondary (MEDIUM confidence — WebSearch)
- [Adrian Crook — Social Interaction Features in Cooperative Mobile Games](https://adriancrook.com/social-interaction-features-in-cooperative-mobile-games/) — cooperative retention patterns (40% higher with social features)
- [CHI 2024 — Living Framework for Cooperative Games](https://dl.acm.org/doi/10.1145/3613904.3641953) — shared goals, intertwined goals taxonomy
- [Scientific Reports — Free Rider Problem in Public Goods Games](https://www.nature.com/articles/srep38349) — accountability mechanism design
- [Cooperative Board Game Design Shaping Digital Platforms 2026](https://coopboardgames.com/blog/how-cooperative-board-game-design-is-quietly-shaping-the-best-digital-entertainment-platforms-in-2026/) — hybrid individual + collective reward systems

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
