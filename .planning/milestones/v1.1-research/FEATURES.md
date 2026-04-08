# Feature Landscape

**Domain:** React Native family app — stabilization + gamification/farm enrichment
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH (official RN docs + multiple corroborating sources)

---

## Context

FamilyFlow is a production app on TestFlight with ~90 components, a 3431-line god hook,
and 13 existing lib-only tests. The immediate work is in two categories:

1. **Stabilization** — hardening what exists (tests, types, dead code, error reporting)
2. **Gamification enrichment** — deepening the pixel farm / mascot system

Features below are split by that lens.

---

## Table Stakes — Stabilization

Features the app must have before the codebase can be safely evolved. Missing these means
every future change is a roulette spin.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unit tests for business-logic modules | Parser, gamification engine, farm engine can silently regress. 0 tests on vault write path. | Low-Med | Already have parser + gamification tests. Gaps: budget.ts, farm-engine.ts, sagas-engine.ts, world-grid.ts |
| TypeScript strict types on critical paths | `as any` in gamification and health record writes bypasses safety on the most sensitive data paths | Low | 8 known `as any` locations in useVault.ts. Fix the ones in data mutation paths first. |
| Error boundary + production error reporting | Currently `console.warn` only in dev. Production crashes are invisible. For a family app where data loss is critical, this is non-negotiable. | Low | sentry.io has first-class Expo support. Wrap root with `Sentry.ErrorBoundary`. |
| Semantic color token coverage | 228 hardcoded hex values break dark mode and theming. Worst offender: LootBoxOpener.tsx (100 occurrences). Visual glitches visible to end users. | Med | Some SVG/confetti colors are legitimately hardcoded — audit per file, not blanket replace. |
| Dead code removal | Deprecated functions in telegram.ts, menageTasks property, obsolete migration code. Reduces cognitive load before refactoring. | Low | Verify no callers with grep before deleting. |
| Deprecation of duplicate API client | Two independent fetch() to api.anthropic.com with duplicated error handling. A bug fix applied to one won't reach the other. | Low | Extract shared `lib/claude-api.ts`. |
| God hook domain split (progressive) | useVault.ts at 3431 lines with 90-item useMemo dependency array. Every render recalculates all 90 values. Adding features to the farm/mascot system will require touching this file. | High | Start with most independent domains: budget, recipes, defis. Context facade keeps public API stable. |

## Table Stakes — Testing Pyramid

Based on React Native official docs and 2025 community consensus: 70% unit, 20% component,
10% E2E is the target ratio. For this app's current state:

| Test Layer | Current State | Target | Priority |
|------------|---------------|--------|----------|
| Unit (lib/) | 13 files, good parser + gamification coverage | Add budget.ts, farm-engine.ts, sagas-engine.ts, world-grid.ts | High |
| Unit (hooks/) | 0 files — hooks/ is completely untested | useFarm.ts and useGamification.ts first (most logic-heavy after useVault) | High |
| Integration (load-parse-serialize roundtrip) | None | At least one test covering vault file write/read cycle | High |
| Component | None | Focus on task completion flow and farm interactions | Medium |
| E2E (Maestro) | None | Core flows: task complete → XP award → farm action | Low |

**Confidence:** HIGH — sourced from reactnative.dev official docs + Jest docs.

---

## Table Stakes — Gamification

Features users of the existing gamification system expect to be stable and coherent.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Race-condition guard on gamification writes | Multiple rapid task completions can collide on gamification.md (read-mutate-write). busyRef only guards loadVaultData, not individual writes. | Med | Add write queue or per-file optimistic lock. |
| Consistent XP → level progression visible to users | Users completing tasks expect visible feedback. If points apply but level doesn't update immediately, trust breaks. | Low | Already exists. Ensure tests verify XP flow end-to-end. |
| Loot box opening animation stability | react-native-confetti-cannon is a small, potentially stale package. | Low | Vendor or replace with Reanimated implementation before it breaks on next Expo upgrade. |

---

## Table Stakes — Farm/Mascot System

Features users of the pixel farm expect. Farm already exists; these are what make it feel
complete rather than rough.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Crops grow and can be harvested without losing state | Core farm loop. Losing a harvest due to a save race condition destroys trust. | Med | Depends on write concurrency fix. |
| Animals visible and animated in the diorama | Already implemented in PixelDiorama.tsx. Must remain non-regressing. | Low | Cover with component smoke test. |
| Seasonal visual changes | Viladia, Harvest Town, and similar pixel farms all do this. Seasons already exist in lib/mascot/seasons.ts. | Low | Ensure seasons.ts covered by test (seasons.test.ts exists — verify it covers all 4 seasons). |
| Item shop purchases persist across restarts | Users buying from TreeShop expect items to survive app restart. | Low | Covered by vault write path — needs integration test. |

---

## Differentiators

Features that would set FamilyFlow apart from other family apps and make the gamification
system meaningfully engaging rather than a thin XP layer.

### Gamification / Farm Enrichment

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Offline-first idle progression | Farm advances while app is closed, calculated on re-open. Terrarium/Little Farm Story pattern. Families check in at breakfast, see what grew. | Med | Calculate elapsed time on foreground event, apply production formula. No backend needed — timestamp in vault file. |
| Seasonal limited events tied to real calendar | Halloween pumpkins, Christmas decorations, summer fruits. Viladia and Harvest Town both do this. Seasonal events create natural re-engagement peaks. | Med | seasons.ts already exists with seasonal data. Extend to unlockable seasonal crops/decorations. |
| Family quest/challenge system | Multi-day family goals (e.g., "Complete 20 tasks this week as a family → earn rare seed"). Drives adult + child engagement together. Research shows family co-op mechanics outperform individual reward for household engagement. | Med | Sagas engine partially covers narrative arcs. A "family quest" is a saga with a shared progress bar. |
| Animal care loop | Feeding, collecting eggs/milk, animals expressing mood. Tamagotchi pattern adapted to farm context. Research shows care mechanics create daily return habit without being punishing. | Med | animals already in PixelDiorama. Add care state (hungry/happy) with daily timer. |
| Crop variety and unlock progression | Start with 3 crops, unlock more as family levels up. Sense of discovery and long-term goal. Stardew/Viladia pattern. | Low-Med | farm-engine.ts has crop system. Extend crop definitions in crop-sprites.ts. |
| Tree visual milestone celebrations | Tree evolution at key XP thresholds triggers a special animation + family toast notification. | Low | Tree evolution already exists in TreeView. Add milestone celebration layer (confetti + sound). |
| XP streak bonuses | Completing tasks on consecutive days awards multiplied XP. Duolingo/Habitica pattern. Research confirms streak mechanics drive daily habit formation for both children and adults. | Low | Add streak counter to gamification state and multiplier in engine.ts. |
| Saga reward rarity tiers | Sagas currently reward items. Differentiate common/rare/legendary saga rewards shown with visual rarity cues (glow, animation). Creates excitement and desire to replay sagas. | Low | Rarity constants already exist in constants/rewards.ts. Apply to saga outcomes. |

### App Stabilization Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Incremental vault loading (lazy recipes) | With 100+ recipes, boot time is noticeable. Lazy-load recipes by metadata first, full parse on demand. | Med | Implement metadata cache in vault.ts. |
| File modification time check before re-parse | Currently re-parses all 16+ files on every foreground event. Using stat() to skip unchanged files would cut reload time significantly. | Med | Use expo-file-system stat(). Compare mtime against last-load timestamps in memory. |

---

## Anti-Features

Features to deliberately NOT build during this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Backend / server sync | Out of scope per PROJECT.md. iCloud Obsidian vault is the sync mechanism. Adding a backend would require auth, privacy model, and maintenance. | Stay 100% local. If sync gaps emerge, improve iCloud handling. |
| Full WCAG accessibility | PROJECT.md explicitly defers this. Family app with known users. Implementing it now would delay farm/stabilization work. | Add basic accessibilityLabel to interactive elements opportunistically during other passes. |
| Public App Store distribution | Changes privacy model, requires legal review, App Store review process, support infrastructure. | Keep on TestFlight for family use. |
| Social/multiplayer features | Sharing across families, leaderboards with strangers. Adds privacy complexity and moderation burden. | Family leaderboard (existing household members only) is acceptable. |
| In-app purchases / monetization | Not in scope for a private family app. Introducing IAP would require App Store review, legal terms, parental controls rework. | Never. |
| Streak punishment mechanics | Research shows punishment-based streaks (lose progress if you miss a day) harm intrinsic motivation, particularly in children. Duolingo streak-loss anxiety is documented. | Award bonuses for streaks, never penalize for breaks. |
| AI-generated farm content / procedural narrative | Costs API credits per family member action. For a local-first app this is a bad fit. Existing saga narratives are pre-written and work well. | Use deterministic content pools (already done in sagas-content.ts). |
| 100% test coverage target | Chasing line coverage percentage leads to testing implementation details rather than behavior. Creates fragile tests that break during refactors. | Target critical paths and mutation paths. Accept low coverage on pure UI glue code. |
| Big-bang hook rewrite | Rewriting useVault.ts all at once risks regression across the entire app. Solo dev cannot validate all 80+ operations simultaneously. | Progressive domain extraction behind context facade. One domain per phase. |

---

## Feature Dependencies

```
Write concurrency fix
  → Farm idle progression (requires reliable writes on foreground)
  → Race-condition guard
    → Gamification XP streak bonuses (streak state must write safely)

God hook domain split (budget domain)
  → Budget unit tests (easier to test isolated hook than god hook)
  → Incremental vault loading (load strategy belongs in domain hook)

Semantic color token coverage
  → No direct feature dependency, but unblocks future UI work on farm/mascot

Error boundary + Sentry
  → No direct feature dependency, but surfaces bugs in all other features

Seasonal events
  → Seasonal limited events tied to calendar (extends existing seasons.ts)
  → Crop variety + unlock progression (seasonal crops are a subset)

Animal care loop
  → Requires farm write path to be reliable (write concurrency fix)
  → Feeds into idle progression (animals produce while away)
```

---

## MVP Recommendation for This Milestone

### Phase 1 — Safety Net (Stabilization)
Prioritize in order:
1. Unit tests for uncovered lib modules (farm-engine, sagas-engine, world-grid, budget)
2. Error boundary + Sentry integration (production visibility)
3. Dead code removal + duplicate API client extraction (low-effort, high clarity)
4. TypeScript `as any` fixes on mutation paths

### Phase 2 — Code Quality
5. Semantic color tokens (228 occurrences — LootBoxOpener.tsx first, then TreeView.tsx)
6. God hook first domain split (budget or recipes — most independent)

### Phase 3 — Farm/Gamification Enrichment
7. Write concurrency fix (prerequisite for all farm features)
8. XP streak bonuses (low complexity, high engagement payoff)
9. Offline idle progression (medium complexity, signature feature)
10. Seasonal limited events (leverages existing seasons.ts)
11. Animal care loop (daily return mechanic)

### Defer for Later
- Crop variety unlocks (after idle progression is stable)
- Family quest system (requires saga engine extension — non-trivial)
- Lazy recipe loading / mtime-based reload (performance, not correctness)
- Component tests and E2E tests (add after unit test layer is solid)

---

## Sources

- [React Native Testing Overview](https://reactnative.dev/docs/testing-overview) — HIGH confidence, official docs
- [Jest React Native Testing Guide](https://jestjs.io/docs/tutorial-react-native) — HIGH confidence, official docs
- [Expo Unit Testing Guide](https://docs.expo.dev/develop/unit-testing/) — HIGH confidence, official docs
- [Sentry for React Native](https://docs.sentry.io/platforms/react-native/) — HIGH confidence, official docs
- [Sentry Expo Integration](https://docs.expo.dev/guides/using-sentry/) — HIGH confidence, official docs
- [React Patterns — Hooks Pattern](https://www.patterns.dev/react/hooks-pattern/) — MEDIUM confidence
- [Facade Pattern with React Hooks](https://wanago.io/2019/12/09/javascript-design-patterns-facade-react-hooks/) — MEDIUM confidence
- [Gamification for Family Engagement — PMC systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8460596/) — HIGH confidence (peer-reviewed)
- [Viladia: Cozy Pixel Farm — Google Play](https://play.google.com/store/apps/details?id=com.selvasai.ttrebirth) — MEDIUM confidence (product observation)
- [Harvest Town App Store](https://apps.apple.com/us/app/harvest-town-pixel-sim-rpg/id1465581028) — MEDIUM confidence (product observation)
- [KiddiKash Best Chore Apps 2025](https://www.kiddikash.com/blog/best-chore-apps-2025) — LOW-MEDIUM confidence (editorial)
- [Gamification dark psychology / streak mechanics](https://www.thebrink.me/gamified-life-dark-psychology-app-addiction/) — MEDIUM confidence
- [Habitica — Google Play](https://play.google.com/store/apps/details?id=com.habitrpg.android.habitica) — MEDIUM confidence (product observation)
- [React Native Testing Strategies — Viewlytics](https://viewlytics.ai/blog/react-native-testing-strategies-guide) — LOW-MEDIUM confidence (editorial)
