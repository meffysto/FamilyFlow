# Feature Research

**Domain:** Cooperative family garden (Place du Village) — v1.4 milestone
**Researched:** 2026-04-10
**Confidence:** MEDIUM (cooperative game design patterns from WebSearch + direct codebase analysis for integration points)

---

## Context: What Already Exists

This research targets only the NEW cooperative features. The single-player farm (tilemap, crops, buildings, craft, tech tree, Wang tileset renderer, world-grid, gamification engine, companion system, seasonal events, sagas, multi-profile system, vault Obsidian persistence, and semantic task coupling) are all already shipped.

Key existing infrastructure that v1.4 reuses:
- `lib/mascot/farm-map.ts` — Wang tileset + `buildFarmMap(treeStage)` pattern, directly reusable for a second map
- `lib/mascot/world-grid.ts` — `WorldCell[]` grid layout, reusable as a second grid instance
- `lib/mascot/farm-engine.ts` — crop planting / harvest logic
- `lib/mascot/types.ts` — `PlantedCrop`, `CropDefinition`, `CROP_CATALOG`
- `lib/parser.ts` — bidirectional Markdown/YAML (2875 lines, already handles gamification.md per-profile)
- `hooks/useVault.ts` + `useFarm.ts` — hooks that will need new shared-state equivalents
- Multi-profile system (`famille.md`) — each family member has a `Profile` with their own gamification state

The cooperative garden data model needs ONE new shared vault file (e.g. `04 - Village/village.md`) readable and writable from any active profile.

---

## Table Stakes (Users Expect These)

Features that must exist for the space to feel like a real "shared village" and not just a second solo farm.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Shared tilemap with distinct visual identity | Users expect the cooperative space to look different from the personal farm — same engine, different terrain (pavés, fontaine, étals) vs herbe/terre | MEDIUM | New `buildVillageMap()` function mirroring `buildFarmMap()`. New Wang tileset layer config (cobblestone dominant). Reuses `FarmMapData` type verbatim. |
| Portal / transition from personal farm | Users need a clear way to navigate between personal farm and shared village — without a portal the two spaces feel disconnected | LOW | Tap target on the farm screen triggers a navigation push to the village screen. Animated transition (slide or fade via Reanimated). No tilemap changes needed — just a HUD element. |
| Contribution feed — who did what | In cooperative mobile games, visibility of teammates' actions is table stakes (confirmed pattern in clan/guild systems). Without it, players don't feel the "co" in cooperative. | MEDIUM | Append-only log of contributions stored in `village.md`. Each entry: `{ profileId, type: 'harvest' | 'task', amount, timestamp }`. Rendered as a scrollable list on the village screen. |
| Weekly objective display with progress bar | Users must be able to see the current collective goal and how far along the family is — hidden progress = zero engagement | LOW | Read the current week's goal from `village.md` frontmatter. Render target + current total with a progress bar. Updates optimistically on each contribution. |
| Per-member contribution indicator | Users must see at a glance whether each family member has contributed this week — prevents the "invisible free rider" feeling that kills cooperative engagement | LOW | Avatar + contribution count per profile. Read from contribution log. Shown on the village screen or as a compact HUD row. |
| Collective reward claim on goal completion | Reaching the weekly goal must produce a concrete reward moment — without this the cooperative loop has no payoff | MEDIUM | Trigger: `weeklyTotal >= weeklyTarget`. Effect: shared in-game bonus (XP to all profiles + cosmetic drop) + IRL activity suggestion. Persisted in `village.md` as `completed: true` to prevent double-claim. Guard against race condition (multiple profiles opening app simultaneously after goal is met). |
| Weekly objective auto-generation | Users expect the system to present a new goal each Monday without manual setup — "set and forget" for the parent who configured it once | MEDIUM | Simple deterministic algo: base target scales with number of active profiles × rolling 4-week average contribution. No AI call needed. Falls back to a safe minimum (e.g. 50 points) if no history. |
| Historical log panel (Panneau historique) | Users expect to see past weeks — it's a memory object ("we did this together in week 3"). Referenced explicitly in PROJECT.md scope. | MEDIUM | Scrollable list of past `WeekRecord { weekStart, weekEnd, target, total, rewardClaimed, contributions[] }`. Stored in `village.md` as a list. Interactive: tap a week to see per-member breakdown. |

---

## Differentiators (Competitive Advantage)

Features that make this feel like a meaningful family ritual rather than just another game loop.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-life task contributions feed the village (semantic coupling) | The semantic task coupling from v1.3 already maps IRL tasks to farm effects. Extending it to also feed the village objective makes real family productivity tangibly visible in the shared space — no other family app does this. | LOW | Reuse `applyTaskEffect()` dispatcher. Add a new side-effect path: when a task triggers a farm effect, also call `addVillageContribution(profileId, 'task', points)`. Points mapped per task category (already defined). |
| Harvest contributions cross the portal | When a player harvests from their personal farm, a portion of the yield automatically "travels" to the village goal — creates a natural organic link between solo and co-op spaces without forcing explicit actions | MEDIUM | In `harvestCrop()` result handling, compute contribution points (e.g. XP value / 10). Call `addVillageContribution`. Players see a small visual cue ("your harvest helped the village"). |
| IRL activity suggestion as collective reward | At goal completion, the reward includes a suggested real-world family activity (picnic, movie night, board game) — grounds the digital achievement in physical family time. Directly aligned with the app's Core Value. | LOW | Static curated list of 20–30 suggestions, weighted by season. Picked randomly at reward time. No API call. Stored in `constants/village-activities.ts`. |
| Avatar display in village space | Seeing the other family members' avatars present in the village reinforces the "we were here together" feeling — pattern confirmed by Animal Crossing's shared town model | MEDIUM | Read all profiles, render their avatar sprite at named fixed positions on the village map (not animated movement, just placement). Updates when village screen mounts. |
| Village ambiance variation by progress | Village appearance changes slightly as the weekly goal advances (fountain on, market stalls open, seasonal decorations) — reward signal embedded in the environment | HIGH | Encode 3 states: empty (0–33%), active (34–66%), festive (67–100%). Pass state to `buildVillageMap()`. Small tile-layer changes. Defer to v1.5 if time-constrained. |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time sync / push notifications for contributions | "See when Lucas just harvested!" — feels live and exciting | The app is 100% local + iCloud. There is no backend, no WebSocket, no push payload. Building real-time presence requires a server. Out of scope per PROJECT.md constraints. | Refresh on app foreground (already implemented via `AppState` listener). Show "last synced" timestamp. The family shares one household — near-real-time is fine. |
| Competitive leaderboard between family members | Parents sometimes ask for it to motivate kids | Research shows competitive mechanics within families increase conflict and reduce intrinsic motivation — the opposite of the app's Core Value. Confirmed pattern: cooperative > competitive for family retention. | Show contributions as "what I contributed" not "rank". Use positive framing: "Emma helped a lot this week!" not "Emma is #1, you are #3". |
| Per-member sub-goals or individual targets inside the collective goal | Sounds fair: "each person must contribute X" | Fractured accountability — if one person misses their sub-goal, the family fails even if total is met. Creates resentment, especially with young children or busy weeks. | Single shared pool. The family chooses how to distribute effort organically. Visibility of individual contributions (see table stakes) provides social accountability without punitive structure. |
| Asynchronous voting / polls for next week's goal | "Let the family decide together" | Adds UI complexity (poll creation, result display, edge cases: ties, no votes, expired polls) with marginal value for a 2–4 person household. Parents in small families don't want to manage a voting system. | Auto-generation with a manual override: parent can edit the target in the settings screen. Simple, no voting infrastructure needed. |
| Village buildings that require sustained maintenance (decay / wither) | Adds urgency and daily return loop | Anxiety-inducing for families — if you miss a day due to illness or holidays, you return to a withered village. Punitive mechanics conflict with the cozy, stress-free design ethos. Confirmed anti-pattern in cozy game design (see Garden Life discourse). | No decay. Village persists as-is. Weekly reset of the goal pool only, never removing earned cosmetics or placed items. |
| Cross-family (external) cooperative features | "Play with grandparents' family" | Requires user accounts, server infrastructure, privacy/GDPR compliance, moderation. Completely out of scope. iCloud sync is the only "network". | Shareable achievement screenshots (already possible via iOS share sheet). Grandparents can see progress via shared screenshots. |
| Complex crafting or tech tree for the village space | Natural extension of the personal farm's craft system | Doubles the cognitive load. The village should be a destination for seeing collective progress, not a second full management game. MVP scope must be tight. | Cosmetic unlocks only for the village (tileset variations, decorations), earned via collective milestones — not crafted. |

---

## Feature Dependencies

```
[Portal (farm → village)]
    └──requires──> [VillageScreen component]
                       └──requires──> [village-map.ts (buildVillageMap)]
                                          └──reuses──> [farm-map.ts infrastructure (FarmMapData, Wang tiling)]

[Collective Reward Claim]
    └──requires──> [Weekly Objective Progress]
                       └──requires──> [Contribution Feed]
                                          └──requires──> [village.md shared data model]
                                          └──requires──> [addVillageContribution() write path]

[Weekly Objective Auto-Generation]
    └──requires──> [Historical Log (past weeks)]
                       └──requires──> [WeekRecord persistence in village.md]

[Task Contributions → Village]
    └──requires──> [Semantic coupling dispatcher (applyTaskEffect) — already shipped v1.3]
    └──requires──> [addVillageContribution() write path]

[Harvest Contributions → Village]
    └──requires──> [harvestCrop() in farm-engine.ts — already shipped]
    └──requires──> [addVillageContribution() write path]

[Per-Member Contribution Indicator]
    └──requires──> [Contribution Feed]
    └──requires──> [Multi-profile read (famille.md) — already shipped]

[Village Ambiance by Progress]
    └──enhances──> [Shared tilemap]
    └──requires──> [Weekly Objective Progress]
    NOTE: defer to v1.5 — HIGH complexity, LOW MVP criticality
```

### Dependency Notes

- **`addVillageContribution()` is the core primitive**: every feature above depends on writing to the shared contribution log. This function must be built in the first phase, before any UI.
- **`village.md` data model must be designed before any feature implementation**: the schema drives both the parser extension and the hook.
- **Semantic task coupling and harvest are v1.3 output hooks** — they are mature, tested, and safe to extend with a side-effect call. Low regression risk.
- **Portal is cosmetically dependent on VillageScreen but logically independent** — can be a stub tap-target initially, upgraded later.

---

## MVP Definition

### Launch With (v1.4)

Minimum viable cooperative space — validates the "family contributing together" loop.

- [ ] `village.md` shared data model + parser (parse / serialize) — foundation for everything
- [ ] `addVillageContribution(profileId, type, amount)` write function — core primitive
- [ ] Weekly objective: auto-generated target + progress display
- [ ] Contribution feed: who contributed what and when
- [ ] Per-member contribution indicators (avatar + count)
- [ ] Collective reward moment on goal completion (XP to all + IRL activity suggestion)
- [ ] Portal tap-target on farm screen → VillageScreen
- [ ] VillageScreen with distinct tilemap (pavés / cobblestone dominant visual)
- [ ] Historical log panel (past weeks, interactive)
- [ ] Task contributions hooked into `applyTaskEffect()` dispatcher
- [ ] Harvest contributions hooked into farm harvest path

### Add After Validation (v1.5)

- [ ] Village ambiance variation by progress (3 visual states) — trigger: users engage weekly and want visual progression feedback
- [ ] Common family tree on the village map — trigger: users ask for a shared mascot
- [ ] Livre de Famille enrichi (narrative moments from the village log) — trigger: families want to revisit milestones
- [ ] Avatar placement in village space — trigger: users want more presence signal
- [ ] Family vote on next week's activity reward suggestion — trigger: families explicitly ask for agency

### Future Consideration (v2+)

- [ ] Village-level tech tree / cosmetic upgrades (earn through collective milestones, not crafting)
- [ ] Seasonal village events (harvest festival, winter fair) tied to existing seasonal engine
- [ ] Cross-season village history ("this time last year, the family did X")

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `village.md` data model + parser | HIGH | LOW | P1 |
| `addVillageContribution()` write path | HIGH | LOW | P1 |
| Weekly objective display + progress | HIGH | LOW | P1 |
| Contribution feed + per-member indicators | HIGH | LOW | P1 |
| Collective reward claim | HIGH | MEDIUM | P1 |
| Weekly auto-generation | HIGH | MEDIUM | P1 |
| Portal farm → village | HIGH | LOW | P1 |
| VillageScreen + distinct tilemap | HIGH | MEDIUM | P1 |
| Historical log panel | MEDIUM | MEDIUM | P1 |
| Task contributions → village | HIGH | LOW | P1 (reuses v1.3) |
| Harvest contributions → village | HIGH | LOW | P1 (reuses v1.3) |
| Village ambiance by progress | MEDIUM | HIGH | P2 |
| Avatar placement in village | MEDIUM | MEDIUM | P2 |
| Family vote on activity suggestion | LOW | HIGH | P3 |
| Village tech tree / cosmetic upgrades | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.4 launch
- P2: Should have, add when possible (v1.5)
- P3: Nice to have, future consideration

---

## Existing Codebase Integration Points

These are the exact files that need to be touched or extended for v1.4 (based on codebase analysis):

| Touch Point | Change Required | Risk |
|-------------|-----------------|------|
| `lib/mascot/farm-map.ts` | Add `buildVillageMap()` alongside `buildFarmMap()` — new export, no change to existing | LOW |
| `lib/mascot/world-grid.ts` | Add `VILLAGE_GRID: WorldCell[]` — new constant, no change to existing | LOW |
| `lib/parser.ts` | Add `parseVillage()` / `serializeVillage()` pair — follow established pattern | MEDIUM (2875-line file, parser surgery) |
| `hooks/useVault.ts` or new `useVillage.ts` | Add village state + actions — prefer new domain hook to avoid growing the 3400-line god hook | MEDIUM |
| `lib/mascot/farm-engine.ts` | Add side-effect call in harvest path to `addVillageContribution()` — small, tested area | LOW |
| `lib/mascot/engine.ts` (semantic coupling dispatcher) | Add side-effect call in `applyTaskEffect()` to `addVillageContribution()` — already designed for extensibility | LOW |
| `app/(tabs)/tree.tsx` (farm screen) | Add portal tap-target UI element | LOW |
| New: `app/(tabs)/village.tsx` | New screen — VillageScreen with map, progress, feed, history | MEDIUM |
| New: `lib/mascot/village-map.ts` | New file — village terrain definition | LOW |
| New: `lib/mascot/village-engine.ts` | New file — village state logic (contributions, weekly cycle, rewards) | MEDIUM |
| New: `constants/village-activities.ts` | New file — IRL activity suggestions list | LOW |

---

## Sources

- [Social Interaction Features in Cooperative Mobile Games — Adrian Crook](https://adriancrook.com/social-interaction-features-in-cooperative-mobile-games/) — cooperative mobile game retention patterns (40% higher with social features), guild/clan design
- [A Living Framework for Understanding Cooperative Games — CHI 2024](https://dl.acm.org/doi/10.1145/3613904.3641953) — cooperative game design taxonomy (shared goals, intertwined goals, forms of cooperation)
- [Cooperative Board Game Design Shaping Digital Platforms — 2026](https://coopboardgames.com/blog/how-cooperative-board-game-design-is-quietly-shaping-the-best-digital-entertainment-platforms-in-2026/) — team-based objectives, hybrid individual+collective reward systems
- [Solving the Free Rider Problem in Public Goods Games — Scientific Reports](https://www.nature.com/articles/srep38349) — free rider dynamics, accountability mechanisms
- Codebase direct analysis: `lib/mascot/farm-map.ts`, `world-grid.ts`, `farm-engine.ts`, `types.ts`, `lib/parser.ts`, `.planning/codebase/ARCHITECTURE.md`, `.planning/PROJECT.md`

---

*Feature research for: cooperative family garden / Place du Village (v1.4)*
*Researched: 2026-04-10*
