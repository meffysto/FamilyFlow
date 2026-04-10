# Pitfalls Research — v1.4 Jardin Familial

**Domain:** React Native / Expo family app — adding cooperative multi-profile shared garden (Place du Village) with cross-profile contributions, weekly auto-generated objectives, and collective rewards to a file-based (Obsidian vault + iCloud) game without a backend
**Researched:** 2026-04-10
**Confidence:** HIGH (based on direct codebase audit of existing patterns + known multi-profile / file-sync failure modes)

---

## Critical Pitfalls

### Pitfall 1: Shared File Write-After-Stale-Read (Cross-Profile Corruption)

**What goes wrong:**
Profile A reads `jardin-familial.md` (contributions: 10). Profile B, switching to their session seconds later, also reads the same file (contributions: 10). Profile A writes their contribution (now: 12). Profile B writes their contribution from their stale read (still: 10 → 12). Profile A's contribution is silently lost. With iCloud Drive, the race window is wider: the file may not have propagated between writes, so two profiles operating in the same hour on the same device — or on two devices synced via iCloud — can clobber each other.

**Why it happens:**
The existing pattern in `hooks/useVault.ts` is: read file → mutate in memory → write back. This is safe for per-profile files (`farm-{id}.md`, `gami-{id}.md`) because only one profile writes each file. For a shared file (`jardin-familial.md`) written by any profile, every write operation must re-read the latest on-disk state immediately before mutating, not use the in-memory cached value from the last `loadVaultData()` call. The `busyRef` guard in the existing codebase only protects `loadVaultData`, not individual writes.

**How to avoid:**
Implement a read-before-write pattern specifically for all shared garden writes:

```typescript
// WRONG: Uses stale in-memory gardenState
async function addContribution(profileId: string, amount: number) {
  const updated = { ...gardenState, total: gardenState.total + amount };
  await vault.writeFile('jardin-familial.md', serialize(updated));
}

// CORRECT: Always read from disk immediately before write
async function addContribution(profileId: string, amount: number) {
  const raw = await vault.readFile('jardin-familial.md');
  const current = parseGarden(raw);
  const updated = { ...current, total: current.total + amount };
  await vault.writeFile('jardin-familial.md', serialize(updated));
}
```

Wrap every shared file write in a serialized queue (reuse the `famille-queue` pattern already in the codebase at `lib/famille-queue.ts`). Never use the React state snapshot of garden data as the basis for writes.

**Warning signs:**
- Contribution totals are mysteriously lower than expected after multiple profiles contribute in the same session
- "Un contribution disparaît quand deux membres contribuent en même temps"
- Obsidian shows file modification conflicts (two versions of `jardin-familial.md`)

**Phase to address:** Phase for shared garden data layer (first phase of v1.4 — data types + parser + storage foundation)

---

### Pitfall 2: iCloud Propagation Delay Causes Double-Contribution

**What goes wrong:**
Profile A on Device 1 contributes 5 harvests. The write succeeds locally. iCloud hasn't propagated yet. Profile A (or any profile) opens the app on Device 2. The garden shows the old total. The user contributes again. When iCloud eventually syncs, both writes land — the total doubles, or one gets lost depending on which write wins. The user has now "contributed twice" with items they harvested once, or contributed nothing from the second device while believing they did.

**Why it happens:**
iCloud Drive does not guarantee immediate file availability. `NSFileCoordinator` (used in the existing `VaultAccess` native module) coordinates concurrent access within a single device but cannot prevent stale reads when a remote change hasn't propagated yet. The existing codebase acknowledges this — the v1.1 migration to per-profile `gami-{id}.md` files was specifically designed to eliminate cross-device conflicts for gamification. A shared file reintroduces the same problem.

**How to avoid:**
Use an append-only contribution log instead of a mutable total counter:

```markdown
---
week: 2026-W15
goal_target: 100
---
## Contributions

| timestamp | profileId | type | amount |
|-----------|-----------|------|--------|
| 2026-04-10T14:32:00 | lucas | harvest | 3 |
| 2026-04-10T15:01:00 | emma | task | 2 |
```

When computing the total, aggregate the log rows for the current week. A duplicate row (same profileId + timestamp within a 5-minute window) is idempotent-safe — detect and deduplicate on read. This way a double-write creates a detectable duplicate rather than a corrupted total. The "source of truth" total is always derived, never stored mutably.

**Warning signs:**
- Total contribution count exceeds the sum of individual contributions (phantom increments)
- Goal completes spontaneously without any family member having contributed that day
- Contribution history shows duplicate entries with the same timestamp

**Phase to address:** Phase for shared garden data layer — the contribution format must be append-only from day one; retrofitting is expensive.

---

### Pitfall 3: World-Grid Second Instance ID Collision

**What goes wrong:**
The existing farm renders using `WORLD_GRID` cell IDs (`c0`, `c1`, `b0`, etc.) as React keys, animation target identifiers, and persistence keys in `farm-{id}.md`. A naive second tilemap for the Place du Village that reuses the same `WorldCell` id namespace (or even partially overlapping IDs like `v0`, `v1` using the same naming logic) will cause React reconciliation bugs where tapping a cell in the Village triggers the farm's cell handler, and SharedValue animations from one grid bleed into the other if both grids are mounted simultaneously during the portal transition.

**Why it happens:**
`WORLD_GRID` is a module-level constant array. Components that consume it key their animated values by cell ID. If the Village grid is designed as a second instance of the same rendering component (`WorldGridView` or equivalent) with its own cell array, the IDs must be globally unique across both grids — but this constraint is invisible at the type level, and nothing in the current code enforces uniqueness between instances.

**How to avoid:**
Prefix Village cell IDs with a namespace: `village_c0`, `village_b0`, `village_d0`. Define a `VILLAGE_GRID` constant as a separate module (`lib/mascot/village-grid.ts`) — never attempt to merge WORLD_GRID and VILLAGE_GRID into a single array. When reusing rendering components, pass the grid source as a prop with a required `gridNamespace` string that is prepended to all animation SharedValue keys.

Additionally, the two grids must never be mounted simultaneously in the React tree at full resolution. The portal transition should unmount the farm grid before mounting the village grid (or render both at reduced scale during transition, then swap).

**Warning signs:**
- Tapping a crop in the Village triggers farm harvest logic
- Animation SharedValues from the personal farm leak into the Village display
- React warning: "Two children with the same key" during portal transition

**Phase to address:** Phase for Village tilemap / rendering (the grid infrastructure phase)

---

### Pitfall 4: Weekly Objective Reset Crosses Profile Switch Boundary

**What goes wrong:**
The weekly objective auto-generation logic runs on Sunday. But "Sunday" depends on *which profile triggered the app open*. If the adult profile opens Sunday at 23:55 and the child profile opens Monday at 00:01, each profile independently triggers objective generation — resulting in two different objectives for the same week, stored at different keys in `jardin-familial.md`. Or worse: the objective for last week is re-generated on the new week for the profile that didn't trigger the reset, overwriting contributions already logged.

**Why it happens:**
The existing companion weekly_recap (Phase 24) runs per-profile via `SecureStore` keyed by profile. A shared garden objective must be generated once per week for the whole family, not once per profile. If the generation check is wired into the profile-specific startup flow (like companion events currently are), every profile that opens the app for the first time in a new week will attempt to generate — and the last one wins (or the first one wins if there's a guard, but the guard itself must be stored in the shared file, not per-profile SecureStore).

**How to avoid:**
Store the current week identifier and objective in `jardin-familial.md` (shared file), not in SecureStore. On load, check `current_week` in the shared file against the current ISO week number. If mismatch AND this profile has not already generated for this week (check `generated_by` field in the shared file), generate and write. The `generated_by` field acts as a distributed once-flag: any profile can trigger generation, but only the first one to write wins, and subsequent profiles detect `current_week` matches and skip.

```markdown
---
current_week: 2026-W15
objective_type: recette
objective_target: 80
objective_generated_by: lucas
objective_generated_at: 2026-04-10T09:00:00
---
```

**Warning signs:**
- Two different objectives visible depending on which profile is active
- Objective resets mid-week when a new profile opens the app
- Contribution counter resets unexpectedly on Sunday night

**Phase to address:** Phase for weekly objective engine (before any persistence is written)

---

### Pitfall 5: Contribution Credit Requires Active Profile — Silently Misattributed

**What goes wrong:**
A task is completed by "Lucas" (active profile). The contribution credit is written to `jardin-familial.md` with `profileId: lucas`. Later, the parent reviews the contribution history and sees that Emma (who also completed tasks that day) has zero contributions — because the parent was using the app under Emma's profile while manually entering tasks in Emma's name, but the active profile at write time was Lucas. The semantic coupling dispatcher (`applyTaskEffect`) uses `activeProfileId` from SecureStore to attribute the farm effect — the garden contribution inherits the same pattern, but the family's mental model is "who completed the task", not "who was logged in".

**Why it happens:**
`activeProfileId` in SecureStore is the currently-displayed profile, not the task owner. In the existing codebase, tasks are attributed to a profile via the `assigned` field on the task markdown. The contribution system, if it directly reads `activeProfileId` at contribution time, will misattribute group contributions made by a parent while managing children's tasks.

**How to avoid:**
Attribute contributions to `task.assigned` (the task's explicit owner), falling back to `activeProfileId` only when `task.assigned` is null. For harvest contributions (farm → garden), the contributor is always the active profile (since harvesting is a first-person action). For task contributions, read the task's `assigned` field first.

```typescript
function getContributorId(task: Task, activeProfileId: string): string {
  // Task explicitly assigned to a family member → credit them, not the currently-logged profile
  if (task.assigned && task.assigned !== activeProfileId) return task.assigned;
  return activeProfileId;
}
```

**Warning signs:**
- Child profiles show 0 contributions even when their tasks were completed
- The parent profile accumulates all contributions regardless of who the tasks were assigned to
- Family disagrees about who "did the most" — app attribution contradicts their memory

**Phase to address:** Phase for contribution system wiring (task → garden bridge)

---

### Pitfall 6: Reward Distribution Fires Multiple Times Across Profile Switches

**What goes wrong:**
The collective goal is reached (contributions ≥ target). Profile A opens the app and sees the reward animation + XP bonus applied. Profile B switches to their profile — the reward check runs again (because the goal is still `>= target` in the shared file, and the "reward claimed" flag hasn't been written for Profile B). Profile B gets the same XP bonus again. With 3 profiles, the reward fires 3 times, awarding 3× the intended XP.

**Why it happens:**
The reward completion check is stateless from the profile's perspective. It compares `contributions.total >= goal.target` and awards if true. Without a per-profile "I already claimed this week's reward" flag, every profile that opens the app after the goal is met will trigger the reward.

**How to avoid:**
Use two separate mechanisms: a shared completion flag (week-scoped, in `jardin-familial.md`) AND a per-profile reward-claimed flag (in `gami-{id}.md` or SecureStore, keyed by week).

```typescript
// Step 1: shared file records that week W15 goal was met
// jardin-familial.md: goal_completed_at: 2026-04-12T18:30:00

// Step 2: per-profile tracking of whether this profile claimed
// gami-lucas.md or SecureStore: garden_reward_claimed_W15: true

// On profile load: if goal_completed AND NOT profile_claimed → award + mark claimed
```

The shared flag prevents double-firing across app restarts (the goal remains >= target). The per-profile flag prevents double-firing across profile switches within the same session.

**Warning signs:**
- XP totals jump by multiples of the intended reward
- Each profile switch triggers a reward animation
- Profile with the most switches has disproportionately high XP

**Phase to address:** Phase for reward distribution (must be designed before the completion check is implemented)

---

### Pitfall 7: useVault God Hook — Garden State Becomes Another 300-line Blob

**What goes wrong:**
Following the existing pattern of "add new state to useVaultInternal()", the garden state (`gardenData`, `loadGardenData`, `addContribution`, `checkWeeklyObjective`, `claimReward`) gets added to the already 3431-line `useVault.ts`. The `useMemo` dependency array, currently at ~90 items, grows to ~100+. The `loadVaultData` `Promise.allSettled` block acquires a 17th file read. Every single re-render now compares one more value. The god hook gets 8% heavier.

**Why it happens:**
It's the path of least resistance. Every previous feature was added directly to `useVault.ts`. There's no enforced boundary preventing it. The garden data is needed across screens (farm portal, village screen, dashboard widget), so "I'll just put it in the shared context" is the natural reflex.

**How to avoid:**
Create `hooks/useGarden.ts` as an independent domain hook, following the precedent of `useFarm.ts` and `useGamification.ts`. Wire it into `VaultContext` via composition (the context exposes `garden: GardenHookReturn`), not by merging all garden state into `useVaultInternal`. This also enables isolated testing of garden logic without the full 3431-line vault context.

The garden hook should own: `gardenData`, `loadGardenData`, `addContribution`, `generateWeeklyObjective`, `checkRewardEligibility`, `claimReward`, `getContributionHistory`. The vault context plumbs it through — just like `farmData` is already plumbed through from `useFarm.ts`.

**Warning signs:**
- `hooks/useVault.ts` grows past 3700 lines during garden implementation
- A new `gardenData:` state variable appears inside `useVaultInternal` rather than in a separate file
- The `useMemo` dependencies array exceeds 100 items

**Phase to address:** First garden phase — establish `hooks/useGarden.ts` before any UI

---

### Pitfall 8: Parser Regex Collision — farm_crops vs village_crops in Same File

**What goes wrong:**
The existing farm parser reads `farm_crops:` from `farm-{id}.md` using regex patterns. If the village garden state is stored in a combined profile-level file (e.g., appended to `farm-{id}.md` as `village_contribution:`, `village_week:`), and the parser is extended with new regex patterns for these fields, a later Obsidian manual edit that uses `village_crops` in a different context (e.g., the user writes a note about the village) causes the parser to misread it as structured garden state.

More specifically: the pattern `key: value` without strict section scoping in `lib/parser.ts` means any frontmatter-like line in the document body can be accidentally parsed as structured data.

**Why it happens:**
`lib/parser.ts` uses pattern-matching that works well for isolated files but becomes fragile when a file serves dual purposes. The existing `farm-{id}.md` already has ~15 frontmatter keys (`farm_crops`, `farm_tech`, `farm_buildings`, `farm_harvest_inventory`, `farm_crafted_items`, etc.). Adding garden keys to the same file extends a pattern that was never designed for shared-state semantics.

**How to avoid:**
Store garden state in a dedicated separate file: `jardin-familial.md` (shared across profiles) rather than appending to any per-profile file. This gives the parser a clean scope and prevents field collision. The file is YAML-frontmatter + an append-only markdown table body. Define parsing as `parseGarden()` / `serializeGarden()` in its own parser module (or a new section at the bottom of `parser.ts` with a clear delimiter comment).

**Warning signs:**
- Garden contribution totals appear in the farm data or vice versa after an Obsidian manual edit
- `npx jest lib/__tests__/parser.test.ts` passes but the round-trip test for garden data silently returns wrong values
- `parseFarm()` picks up `village_*` keys and stores them in `FarmProfileData` with undefined types

**Phase to address:** Phase for shared garden data layer (parser design)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing garden total as mutable number instead of append-only log | Simpler to read/write | Irrecoverable on iCloud conflict — two writes produce wrong total with no way to detect | Never for shared multi-profile files |
| Keying contribution attribution to `activeProfileId` only | One source of truth already exists | Misattributes parent-managed child tasks; family disputes | Never — always check `task.assigned` first |
| Adding garden state directly to `useVaultInternal()` | No new file to create | God hook grows past 3700 lines; every render slower; harder to test garden in isolation | Never — use `hooks/useGarden.ts` |
| Reusing WORLD_GRID cell IDs for Village grid | Reuse existing rendering pipeline | React key collisions + animation SharedValue bleed during portal transition | Never — always namespace Village IDs |
| One shared `jardin_reward_claimed` flag in shared file instead of per-profile flags | Simpler | Reward fires once globally — whichever profile triggers it gets it, others miss out | Never for XP rewards distributed to all profiles |
| Generating weekly objective in the profile startup flow | Natural hookup point for existing companion event system | Any profile opening first in a new week generates differently from another — two objectives | Never — use shared-file once-flag pattern |
| Loading garden data inside `loadVaultData`'s `Promise.allSettled` block | Consistent with existing load pattern | Vault load time increases; garden errors fail silently alongside 16 other files | Acceptable only if garden file read is < 5ms — use separate lazy load otherwise |

---

## Integration Gotchas

Common mistakes when connecting to existing systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| farm-engine harvest → garden contribution | Calling `addContribution` directly inside `harvestCrop()` pure function | `harvestCrop()` is a pure function; the harvest→contribution bridge belongs in the useFarm hook's `handleHarvest` action, not in the pure engine |
| task completion → garden contribution | Wiring `addContribution` inside `completeTask`'s existing semantic coupling dispatcher | Add garden contribution as a separate step in `completeTask` after the semantic effect — don't bundle it into `applyTaskEffect()` which is per-profile and already complex |
| iCloud NSFileCoordinator | Assuming `coordinatedWriteFile` is atomic for sequential reads | `coordinatedWriteFile` prevents concurrent OS-level writes but doesn't prevent logical stale-read → write sequences; the read-before-write pattern is still required |
| weekly objective generation + companion weekly_recap | Coupling garden weekly recap to companion `weekly_recap` event (same Sunday trigger) | Garden objective reset and companion recap are independent. Companion recap is per-profile/per-session; garden reset is once-per-week for the whole family. Do not merge their trigger logic. |
| Village tilemap + portal animation | Mounting VillageGrid behind the portal door while FarmGrid is still mounted | During portal transition animation, both grids mounted simultaneously = doubled layout passes + potential SharedValue conflicts. Unmount farm before mounting village. |
| reward claim + XP system | Calling `addPoints()` directly from the garden reward handler | `addPoints()` reads the current `gami-{id}.md` file. The garden reward handler must use the read-before-write pattern for the gami file, just like any other XP grant. |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Contribution log grows unbounded (append-only, never pruned) | Vault load time increases; `jardin-familial.md` becomes multi-KB; weekly aggregation slows | Archive rows older than 4 weeks to a `jardin-historique.md` file; only keep current + last 3 weeks in the active file | After ~1 year of daily contributions (~365 rows/year × 4 family members = 1460 rows) |
| Aggregating all contributions on every render to compute total | Jank when scrolling the Village screen | Cache the aggregated total in a `useMemo` keyed on the raw log length; recompute only when log changes | With >50 contribution rows (after ~2 months of active use) |
| Village tilemap renders all cells unconditionally | FPS drop during portal transition | Lazy-render cells outside viewport; use `InteractionManager.runAfterInteractions` for Village mount | Visible at any screen size if all cells have animated sprites |
| Loading `jardin-familial.md` eagerly at app startup (inside `loadVaultData`) | Vault startup time increases even when user never visits the Village | Lazy-load garden data only when the Village screen is first opened (or when the portal portal button is tapped) | Immediately — startup already loads 16+ files |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing per-profile contribution amounts in the Village before explaining the cooperative mechanic | Confused children: "why is papa's number bigger than mine?" | Lead with the shared total and family goal; reveal individual breakdown only in the history panel |
| Resetting contributions display at midnight Sunday vs. ISO week boundary | Family confused about "did my task count this week?" | Use ISO week (Monday → Sunday) consistently; display the week label ("Semaine du 7 au 13 avril") explicitly in the UI |
| No visual feedback between contributing and seeing the shared total update | User taps "Contribute" → nothing visible changes → taps again → double-contribution | Optimistic UI: immediately update the displayed total locally, then sync to file; show "contribution enregistrée" toast |
| Reward notification fires silently in the background with no village pop-up | Family misses the celebration moment — the whole point of cooperative play | Reward completion should trigger a full-screen celebration (like the existing loot box animation) the first time any profile opens the app after goal completion, with a "gather the family" prompt |
| Showing an empty Village before the first weekly objective is generated | Cold-start confusion: "where is the village?", "what do I do here?" | Generate the first objective at Village first-open, not on Sunday; show a welcoming narrative from the companion explaining the mechanic |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Shared garden file parser:** Parser unit-tested in isolation is not enough — verify the full round-trip (write → iCloud-style re-read → parse) produces identical results
- [ ] **Contribution attribution:** Works for harvests contributed by the active profile — verify it also correctly attributes task completions where `task.assigned !== activeProfileId`
- [ ] **Reward distribution:** Reward fires correctly for the triggering profile — verify it also fires (with correct XP, not duplicated) for all other profiles on their next app open
- [ ] **Weekly reset:** Objective resets correctly when the active profile opens the app on Monday — verify no reset occurs if the same week ISO number is still active; verify reset does not fire twice when two profiles both open the app for the first time in a new week
- [ ] **Portal transition:** Portal visual transition appears smooth — verify both grids are not simultaneously mounted at full resolution; verify no React key warnings in Metro/Flipper during the transition
- [ ] **iCloud multi-device:** Contribution works on Device 1 — verify on Device 2 (same vault, iCloud synced) the total is correct after propagation; do not ship without manually testing this scenario on two physical devices
- [ ] **God hook boundary:** Garden feature "works" — verify `hooks/useVault.ts` line count did NOT increase by more than 20 lines; the bulk of garden logic lives in `hooks/useGarden.ts`

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shared file corruption (mutable total lost) | MEDIUM | If append-only log: recompute total from log rows and rewrite header. If mutable total was used: manual vault edit in Obsidian to restore known-good value. |
| Double-reward XP granted | LOW | Deduct XP via a manual `addPoints(profileId, -N)` call through a dev-only admin action in Settings (similar to existing gamification reset). |
| Weekly objective generated twice (two objectives in file) | LOW | The parser should prefer the first `objective_*` block encountered; second is ignored. Manual: delete duplicate block from `jardin-familial.md` in Obsidian. |
| React key collision between farm and village grids | HIGH | Requires renaming all Village cell IDs and updating every reference (parser, render, animation). Do not ship without namespace prefix from the start. |
| Contribution attributed to wrong profile | MEDIUM | No automated recovery — requires manual Obsidian vault edit to fix the `profileId` column in the contribution log. User impact: visible in history panel only; XP was already awarded to the wrong profile. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shared file stale-read corruption | Garden data layer phase (parser + storage) | Test: two rapid `addContribution` calls → check final total matches sum of both |
| iCloud double-contribution | Garden data layer phase — append-only format | Test: write same contribution row twice → verify aggregation deduplicates |
| World-grid ID collision | Village tilemap phase — `VILLAGE_GRID` definition | Test: mount FarmGrid and VillageGrid in same test render → verify no duplicate keys |
| Weekly objective cross-profile double-generation | Weekly objective engine phase | Test: call `generateObjectiveIfNeeded()` twice with different profileIds in same ISO week → verify only one objective written |
| Contribution misattribution | Contribution bridge phase (task→garden wiring) | Test: complete a task where `task.assigned !== activeProfileId` → verify contribution logged under `task.assigned` |
| Reward multi-fire across profile switches | Reward distribution phase | Test: trigger goal completion → switch profile → verify reward fires only once per profile per week |
| God hook boundary violation | First garden phase — `useGarden.ts` creation | Static check: `wc -l hooks/useVault.ts` before and after garden implementation; must not grow > 20 lines |
| Parser regex collision | Garden data layer phase — `jardin-familial.md` isolated file | Test: add `village_note: test` to body of `jardin-familial.md` → verify `parseGarden()` does not include it in structured output |

---

## Sources

- Direct codebase audit: `hooks/useVault.ts` (3431 lines), `lib/vault.ts`, `lib/mascot/world-grid.ts`, `lib/mascot/farm-engine.ts`, `lib/mascot/farm-grid.ts`
- Codebase concerns documented in `.planning/codebase/CONCERNS.md` (vault write concurrency, gamification points race, full-reload on foreground)
- Project retrospective `.planning/RETROSPECTIVE.md` (v1.1 lesson: gami-{id}.md per-profile migration rationale; v1.2 lessons: parser defensive patterns)
- Architecture documentation `.planning/codebase/ARCHITECTURE.md` (data flow, VaultManager NSFileCoordinator, optimistic writes pattern)
- Key decisions table in `.planning/PROJECT.md` (TUTO-02: SecureStore flag per-device not per-profile; ARCH-05: zero new npm dependencies; GuestProfile séparé)
- Known fragile area: "Vault File Write Concurrency" (`hooks/useVault.ts` busyRef guards only loadVaultData, not individual writes) — `.planning/codebase/CONCERNS.md`

---
*Pitfalls research for: v1.4 Jardin Familial — cooperative multi-profile shared garden on file-based persistence*
*Researched: 2026-04-10*
