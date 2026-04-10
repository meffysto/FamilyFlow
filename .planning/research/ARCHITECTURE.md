# Architecture Research — v1.4 Jardin Familial (Place du Village)

**Domain:** Cooperative family garden as second tilemap zone added to existing React Native / Expo pixel farm game
**Researched:** 2026-04-10
**Confidence:** HIGH — based on direct codebase inspection (lib/mascot/, hooks/, lib/parser.ts, lib/quest-engine.ts, components/mascot/)

---

## Existing Architecture Baseline

Before describing what changes, the current state is critical context.

### Current tilemap stack (per-profile farm)

```
lib/mascot/farm-map.ts          — buildFarmMap(treeStage) → FarmMapData
                                  FARM_MAP_COLS=12, FARM_MAP_ROWS=20
                                  5 terrain types: grass/dirt/farmland/water/cobblestone
                                  Wang tileset vertex-based rendering

lib/mascot/world-grid.ts        — WORLD_GRID: WorldCell[] (crops, buildings, decos)
                                  Unlock order, fractional x/y positions, small/large sizes
                                  Extension cells via EXPANSION_* exports

components/mascot/TileMapRenderer.tsx  — Renders FarmMapData via Wang tiles
                                         Seasonal sprite variants, animated decorations
                                         Accepts: treeStage, season, containerWidth

components/mascot/WorldGridView.tsx    — Renders WorldCell[] as absolute-positioned sprites
                                         Crop growth stages, building pending resources
                                         Onpress handlers for farming interactions
```

### Current cooperative data layer (already exists in v1.3)

```
lib/quest-engine.ts             — FamilyQuest, FamilyQuestTemplate types
                                  applyQuestReward() — file-first reward apply
                                  createQuestFromTemplate() — date-bounded quest creation

lib/parser.ts                   — parseFamilyQuests(), serializeFamilyQuests()
                                  parseFamilyQuestsMeta(), getActiveQuestEffect()
                                  FAMILY_QUESTS_FILE = 'family-quests.md'

hooks/useVaultFamilyQuests.ts   — startQuest, contribute, completeQuest, deleteQuest
                                  checkAndExpireQuests (called at loadVault)
                                  reads family-quests.md fresh to avoid stale state

hooks/useVault.ts               — wires questsHook into VaultContext
                                  exposes: familyQuests, startFamilyQuest, contributeFamilyQuest,
                                  completeFamilyQuest, deleteFamilyQuest

components/mascot/FamilyQuestBanner.tsx      — active quest progress display in tree.tsx
components/mascot/FamilyQuestDetailSheet.tsx — quest completion UI
components/mascot/FamilyQuestPickerSheet.tsx — template picker UI
```

### Current storage model

```
Per-profile:  farm-{profileId}.md      — farm_crops, farm_buildings, farm_inventory,
                                          farm_harvest_inventory, farm_crafted_items,
                                          farm_tech, farm_rare_seeds, wear_events, companion
Per-profile:  gami-{profileId}.md      — points, level, streak, loot boxes,
                                          active rewards, used loots, museum section

Shared:       family-quests.md         — FamilyQuest[] + meta (activeEffect, trophies,
                                          unlockedRecipes, unlockedDecorations)
Shared:       famille.md               — Profile[] identities
Shared:       gamification.md          — legacy (migrated to per-profile gami-*.md)
```

---

## v1.4 Integration Architecture

### What the milestone requires

1. Nouvelle carte "Place du Village" (pavés, fontaine, étals, ambiance communautaire)
2. Portail dans la ferme perso → transition vers le jardin
3. Contributions : récoltes de la ferme perso + tâches IRL complétées
4. Objectif hebdomadaire auto-généré (recette/projet collectif adapté au niveau)
5. Récompense collective (bonus in-game + suggestion activité IRL)
6. Panneau historique interactif (log des semaines accomplies)

### Core architectural principle

The Village is a **second, shared tilemap zone** rendered by the same `TileMapRenderer` + `WorldGridView` stack, backed by a **new shared vault file** (`village.md`). It does not touch per-profile farm files. The existing `FamilyQuest` system is the contribution backbone — the Village is its visual representation.

---

## Component System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  app/(tabs)/tree.tsx — Personal Farm screen                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  TileMapRenderer (farm-map.ts data, per-profile)            │  │
│  │  WorldGridView (WORLD_GRID, per-profile crops/buildings)    │  │
│  │  FamilyQuestBanner (active quest progress)                  │  │
│  │  [NEW] VillagePortalButton → navigates to village screen    │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
        │ router.push('/village')
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  app/(tabs)/village.tsx [NEW] — Place du Village screen           │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  TileMapRenderer (village-map.ts data, SHARED state)        │  │
│  │  VillageGridView [NEW] (stalls, fountain, notice board)     │  │
│  │  VillageQuestPanel [NEW] (weekly objective + contributions) │  │
│  │  VillageHistoryBoard [NEW] (historical log panel)           │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                       │
│  lib/mascot/village-map.ts [NEW]                                  │
│    buildVillageMap() → FarmMapData (same type as farm-map.ts)     │
│    VILLAGE_MAP_COLS, VILLAGE_MAP_ROWS (can differ from farm)      │
│    Terrain: grass + cobblestone (village square) + water (fountain│
│                                                                   │
│  lib/mascot/village-grid.ts [NEW]                                 │
│    VILLAGE_GRID: WorldCell[] (stalls, fountain, notice board)     │
│    Same WorldCell type — shared across farm and village           │
│    Unlock order driven by weekly quest completion count           │
│                                                                   │
│  lib/parser.ts [MODIFY]                                           │
│    parseVillage() / serializeVillage() — village.md format        │
│    VILLAGE_FILE = 'village.md'                                    │
│                                                                   │
│  hooks/useVaultVillage.ts [NEW]                                   │
│    Reads/writes village.md (shared state)                         │
│    Wraps questsHook.contribute() for village-specific triggers    │
│                                                                   │
│  hooks/useVault.ts [MODIFY]                                       │
│    Wire useVaultVillage into VaultContext                          │
│    Add village state + actions to context interface               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Reuse vs New | Communicates With |
|-----------|---------------|--------------|-------------------|
| `app/(tabs)/village.tsx` | Village screen shell, navigation target | NEW screen | VaultContext, ThemeContext |
| `lib/mascot/village-map.ts` | `buildVillageMap()` → `FarmMapData` for the village terrain | NEW (pattern from farm-map.ts) | Imported by TileMapRenderer (no changes to renderer) |
| `lib/mascot/village-grid.ts` | `VILLAGE_GRID: WorldCell[]` for stalls/fountain/board | NEW (same WorldCell type) | Imported by VillageGridView |
| `TileMapRenderer` | Renders Wang tilemap terrain | REUSE as-is | village-map.ts data passed via props |
| `VillageGridView` | Renders village-specific cells (stalls, board) | NEW (pattern from WorldGridView) | village-grid.ts, VaultContext |
| `VillageQuestPanel` | Weekly objective: target, progress bar, contributions by profile | NEW (replace FamilyQuestBanner) | VaultContext (familyQuests, profiles) |
| `VillageHistoryBoard` | Scrollable log of completed weekly quests | NEW | VaultContext (villageHistory) |
| `VillagePortalButton` | Portal tile on the personal farm → navigate to village | NEW small component | router.push in tree.tsx |
| `hooks/useVaultVillage.ts` | Load/save village.md, expose villageState + actions | NEW domain hook | VaultManager, parser, questsHook |
| `lib/parser.ts` | `parseVillage()` / `serializeVillage()` functions | MODIFY (add to existing file) | useVaultVillage |
| `constants/questTemplates.ts` | Add weekly-autogenerated templates | MODIFY | useVaultFamilyQuests |

---

## Data Flow

### Profile switches to Village screen

```
User taps portal button in tree.tsx
    ↓
router.push('/village')
    ↓
village.tsx mounts
    ↓
useVault() — reads already-loaded state:
    - familyQuests (from useVaultFamilyQuests, loaded at startup)
    - villageState (from useVaultVillage, loaded at startup)
    - profiles (from useVaultProfiles, loaded at startup)
    ↓
TileMapRenderer receives buildVillageMap() output (pure fn, no I/O)
VillageGridView receives VILLAGE_GRID cells + villageState.unlockedDecos
VillageQuestPanel receives familyQuests[active] + profiles
VillageHistoryBoard receives villageState.history
```

### Harvest contribution flow (when profile harvests a crop)

```
tree.tsx: user harvests crop
    ↓
useFarm.harvest() called
    ↓
onQuestProgress('profileId', 'harvest', 1) callback
    ↓
questsHook.contribute('profileId', 'harvest', 1)
    ↓
reads family-quests.md fresh (file-first pattern)
    ↓
increments quest.contributions[profileId] + quest.current
    ↓
writes family-quests.md back
    ↓
setFamilyQuests(updated) → React state update
    ↓
VillageQuestPanel re-renders with new progress
```

The `onQuestProgress` callback already exists in `useFarm.ts` — the harvest contribution path requires ZERO new wiring at the farm level. Only the `VillageQuestPanel` consuming the already-updated `familyQuests` state is new.

### Task completion contribution flow

```
tasks.tsx: user completes a task
    ↓
awardTaskCompletion() in useVault.ts
    ↓
contributeFamilyQuest(profileId, 'tasks', 1) — already wired in v1.3
    ↓
family-quests.md updated (same flow as harvest above)
```

This path is **already wired** in v1.3 — no changes needed.

### Weekly objective auto-generation flow

```
[Each Sunday OR when no active quest exists AND user opens village.tsx]
    ↓
useVaultVillage.checkAndGenerateWeeklyObjective()
    ↓
reads villageState.level (derived from completed quest count)
    ↓
selectTemplate(level) from WEEKLY_QUEST_TEMPLATES
    ↓
questsHook.startQuest(templateId, activeProfileId, profiles)
    ↓
family-quests.md written with new quest
    ↓
village.tsx VillageQuestPanel shows new objective
```

### Quest completion + reward flow

```
VillageQuestPanel: user taps "Réclamer la récompense"
    ↓
completeFamilyQuest(questId) — already in useVaultFamilyQuests
    ↓
applyQuestReward(vault, profileIds, quest.farmReward, FAMILY_QUESTS_FILE)
    — writes to each farm-{id}.md or gami-{id}.md per reward type
    ↓
appendVillageHistory(questId, completedDate) — new action in useVaultVillage
    ↓
writes village.md with new history entry
    ↓
VillageHistoryBoard re-renders with new entry
```

---

## New Files (explicit list)

| File | Type | Pattern From |
|------|------|-------------|
| `app/(tabs)/village.tsx` | New screen | `app/(tabs)/tree.tsx` (structure) |
| `lib/mascot/village-map.ts` | New engine module | `lib/mascot/farm-map.ts` |
| `lib/mascot/village-grid.ts` | New engine module | `lib/mascot/world-grid.ts` |
| `hooks/useVaultVillage.ts` | New domain hook | `hooks/useVaultFamilyQuests.ts` |
| `components/mascot/VillageGridView.tsx` | New component | `components/mascot/WorldGridView.tsx` |
| `components/mascot/VillageQuestPanel.tsx` | New component | `components/mascot/FamilyQuestBanner.tsx` |
| `components/mascot/VillageHistoryBoard.tsx` | New component | `components/mascot/MuseumModal.tsx` (scroll list pattern) |
| `components/mascot/VillagePortalButton.tsx` | New small component | inline tile in `TileMapRenderer` |
| `constants/weeklyQuestTemplates.ts` | New constants file | `constants/questTemplates.ts` |
| `assets/terrain/tilesets/village_*` | New sprite assets | existing tileset format (grass_to_cobblestone) |
| `assets/garden/village/` | New sprite assets | `assets/garden/` structure |

---

## Modified Files (explicit list)

| File | Modification | Risk |
|------|-------------|------|
| `lib/parser.ts` | Add `parseVillage()`, `serializeVillage()`, `VILLAGE_FILE` constant | LOW — additive only |
| `hooks/useVault.ts` | Wire `useVaultVillage` hook + expose village state/actions in VaultContext interface | LOW — additive wiring |
| `contexts/VaultContext.tsx` | Add village fields to VaultContextValue type | LOW — type extension |
| `app/(tabs)/tree.tsx` | Add `VillagePortalButton` overlay at bottom of TileMapRenderer | LOW — UI addition |
| `app/(tabs)/_layout.tsx` | Register `village` as hidden screen in tab navigator | LOW — 1 line |
| `constants/questTemplates.ts` | Add weekly auto-generated templates (or move to weeklyQuestTemplates.ts) | LOW — additive |

---

## Village Vault File: `village.md`

Shared across all profiles. Parsed/serialized by `lib/parser.ts`.

```markdown
---
tags:
  - village
---
# Place du Village

level: 3
totalQuestsCompleted: 12

## Historique

- 2026-04-07 | Recette collective : Tarte aux pommes | loot_legendary:2 | tasks:15/15
- 2026-03-31 | Projet jardinage | rain_bonus:24 | harvest:10/10

## Décorations débloquées

fontaine, etal_legumes, panneau_victoire
```

Key design choices:
- `level` is derived from `totalQuestsCompleted` at read time — no separate level field needed (deterministic)
- `## Historique` is a plain text log (one line per completed week), not a structured parse — append-only
- `## Décorations débloquées` CSV drives which VillageGridView cells are visible
- The file is created on first quest completion if it does not exist (graceful empty state)

---

## Village Map Design

`buildVillageMap()` in `lib/mascot/village-map.ts` returns a `FarmMapData` (same type as farm-map.ts). `TileMapRenderer` accepts it unchanged.

Terrain composition:
- `cobblestone` — central square / pavés (village identity)
- `grass` — surroundings
- `water` — small fountain area (top-center)
- No `farmland` or `dirt` — village is not a farm

Recommended dimensions: 10×14 (narrower and shorter than the 12×20 farm, fits well on phone in portrait mode without vertical scroll of the tree.tsx diorama).

---

## Village Grid Design

`VILLAGE_GRID: WorldCell[]` in `lib/mascot/village-grid.ts` uses the same `WorldCell` type.

Suggested cells (all `cellType: 'deco'` initially — village has no crop/building mechanics in MVP):

| id | Purpose | UnlockOrder | Unlocked by |
|----|---------|------------|-------------|
| `v_fountain` | Central fountain (always visible) | 0 | Always |
| `v_stall_1` | Vegetable stall | 1 | Quest 1 complete |
| `v_stall_2` | Crafted goods stall | 2 | Quest 3 complete |
| `v_stall_3` | Seasonal market stall | 3 | Quest 5 complete |
| `v_board` | Notice board / history panel | 4 | Quest 2 complete |
| `v_bench` | Decorative bench | 5 | Quest 4 complete |
| `v_tree` | Village tree (shared mascot, v1.5 scope) | 99 | Reserved |

Unlock order is driven by `villageState.totalQuestsCompleted` — same pattern as farm crop unlock by `treeStage`.

---

## Reuse Strategy

### TileMapRenderer: zero changes required

`TileMapRenderer` receives `FarmMapData` via props. `buildVillageMap()` returns the same type. No component changes — just pass different data.

### WorldCell type: zero changes required

`village-grid.ts` exports `VILLAGE_GRID: WorldCell[]` using the existing type. `VillageGridView` is a new component but borrows the same rendering patterns from `WorldGridView` (absolute positioning via fractional x/y, size tokens).

### FamilyQuest system: zero changes required for MVP

The contribution system (`contribute()`, `completeFamilyQuest()`) is already in `useVaultFamilyQuests.ts` and already wired. The Village screen is a new visual consumer of already-flowing data. No engine changes.

### useFarm.ts: zero changes required

`onQuestProgress` callback for harvest events already exists. The `VillageQuestPanel` showing harvest progress is just a new consumer of `familyQuests` state.

---

## Architectural Patterns to Follow

### Pattern 1: File-first reads in hooks (mandatory)

The existing `contribute()` in `useVaultFamilyQuests.ts` reads `family-quests.md` fresh before updating (not from stale React state). Apply the same pattern in `useVaultVillage.ts` for any write to `village.md`.

```typescript
// In useVaultVillage: appendVillageHistory
const content = await vaultRef.current.readFile(VILLAGE_FILE).catch(() => '');
const state = parseVillage(content);
// mutate state...
await vaultRef.current.writeFile(VILLAGE_FILE, serializeVillage(state));
setVillageState(state); // update React state after write
```

### Pattern 2: Reward-first on quest completion (mandatory)

`applyQuestReward()` writes to farm/gami files first, marks quest completed after. This is the existing pattern in `completeQuest()`. Do not change this ordering for any new reward dispatch.

### Pattern 3: Domain hook extracted from useVault (established since v1.3)

`hooks/useVaultFamilyQuests.ts` is the model: domain hook receives `vaultRef`, `gamiDataRef`, and setter callbacks. Returns a typed result interface. Wired into `useVaultInternal()` via a single call. `useVaultVillage.ts` follows this exact shape.

### Pattern 4: Portal as overlay in existing screen (not modal)

The village portal in `tree.tsx` should be a positioned `TouchableOpacity` over the `TileMapRenderer` — not a new sheet/modal. This keeps the navigation pattern clean (router.push to a real screen) while being visually integrated into the farm.

### Pattern 5: Empty state tolerance at parse (mandatory)

All new parser functions must handle missing/empty files gracefully and return empty default state. `village.md` will not exist on first launch. Pattern from existing parsers:

```typescript
export function parseVillage(content: string): VillageState {
  if (!content || content.trim() === '') return defaultVillageState();
  // ... parse
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing village state in per-profile farm files

**What people do:** Add village unlock data to `farm-{profileId}.md` because it's convenient.
**Why it's wrong:** Village state is shared — it must be the same regardless of which profile is active. Per-profile files diverge when different profiles write different values.
**Do this instead:** All village state lives in the single shared `village.md` file.

### Anti-Pattern 2: New tilemap renderer

**What people do:** Create `VillageTileMapRenderer.tsx` with copy-pasted logic.
**Why it's wrong:** `TileMapRenderer` already accepts `FarmMapData` as props. `buildVillageMap()` returns `FarmMapData`. No duplication needed.
**Do this instead:** Pass village map data directly to the existing `TileMapRenderer`.

### Anti-Pattern 3: Adding village navigation to the tab bar

**What people do:** Add a new tab for the village.
**Why it's wrong:** Tab bar is full (5 visible tabs). Adds navigation debt, breaks existing muscle memory.
**Do this instead:** Village is a hidden screen accessed via portal in `tree.tsx` — same pattern as `loot`, `skills`, `tree` themselves (hidden screens pushed via `router.push`).

### Anti-Pattern 4: Weekly objective logic inside the component

**What people do:** Detect "no active quest → auto-generate" inside `village.tsx` useEffect.
**Why it's wrong:** Business logic in screens is hard to test and can fire multiple times on re-mount.
**Do this instead:** `checkAndGenerateWeeklyObjective()` in `useVaultVillage.ts`, called once from `loadVault` (same as `checkAndExpireQuests`).

### Anti-Pattern 5: Sharing TileMapRenderer state between farm and village

**What people do:** Try to animate a portal transition by sharing the same renderer instance.
**Why it's wrong:** The two maps have different data, sizes, and seasonal contexts. They should be independent renders.
**Do this instead:** Each screen (tree.tsx, village.tsx) renders its own `TileMapRenderer` with its own data. Transition is a standard `router.push` — no shared renderer state.

---

## Suggested Build Order

Dependencies flow bottom-up: data → logic → UI.

```
Phase A: Data foundation (no UI, no risk)
├── lib/mascot/village-map.ts — buildVillageMap() + terrain layout
├── lib/mascot/village-grid.ts — VILLAGE_GRID cells + unlock function
├── lib/parser.ts — parseVillage() + serializeVillage() + VILLAGE_FILE
└── constants/weeklyQuestTemplates.ts — 5–8 weekly templates

Phase B: Domain hook (logic only, no UI)
└── hooks/useVaultVillage.ts — load, checkAndGenerateWeeklyObjective, appendVillageHistory
    └── Wire into hooks/useVault.ts + contexts/VaultContext.tsx

Phase C: Village screen (visual, depends on Phase B)
├── components/mascot/VillageQuestPanel.tsx
├── components/mascot/VillageHistoryBoard.tsx
├── components/mascot/VillageGridView.tsx
├── app/(tabs)/village.tsx (assembles all above)
└── app/(tabs)/_layout.tsx — register hidden screen

Phase D: Portal entry point (minimal tree.tsx change, depends on Phase C screen existing)
└── components/mascot/VillagePortalButton.tsx
    └── Placed in app/(tabs)/tree.tsx above TileMapRenderer
```

Rationale:
- Phases A and B can be built and tested before any screen exists
- Phase B wiring into VaultContext is the highest-risk change (modifies the central context) — it should be isolated in its own plan with a TypeScript check
- Phase C is entirely additive (new files only)
- Phase D is the smallest possible change to the existing farm screen

---

## Integration Points Summary

| Integration Point | Direction | Risk | Notes |
|------------------|-----------|------|-------|
| `TileMapRenderer` ← `buildVillageMap()` | Data in | ZERO | Same FarmMapData type |
| `WorldCell` type reuse in `village-grid.ts` | Type import | ZERO | No changes to type |
| `useVaultFamilyQuests` ← village auto-generate | Hook call | LOW | `startQuest()` already exists |
| `useFarm.onQuestProgress` ← harvest contribution | Callback | ZERO | Already wired |
| `awardTaskCompletion` ← task contribution | Existing call | ZERO | Already wired in v1.3 |
| `useVault.ts` ← `useVaultVillage` wiring | Hook composition | LOW | Same pattern as all other domain hooks |
| `VaultContext` ← village fields | Type extension | LOW | Additive fields |
| `tree.tsx` ← `VillagePortalButton` | UI overlay | LOW | Small addition to large file |
| `_layout.tsx` ← village screen | Navigation | LOW | One line |
| `lib/parser.ts` ← parseVillage | File addition | LOW | 50–80 lines, additive |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| TileMapRenderer reuse | HIGH | buildFarmMap returns FarmMapData; village-map.ts returns same type |
| WorldCell reuse | HIGH | Type already has all needed fields |
| FamilyQuest as contribution backbone | HIGH | Code inspected — already handles harvest + task contributions |
| Village screen as hidden screen | HIGH | Established pattern in _layout.tsx |
| village.md shared file approach | HIGH | Same model as family-quests.md which is already shared |
| Weekly auto-generation logic | MEDIUM | Template system exists but generation trigger needs careful timing (not during profile switch) |
| Portal transition animation | MEDIUM | Router.push is smooth but no custom transition exists yet; Reanimated SharedElement not used in codebase |
| Village terrain sprites | LOW | Requires new art assets (cobblestone variants may partially reuse existing tileset) |

---

*Architecture research for: v1.4 Jardin Familial — Place du Village cooperative zone*
*Researched: 2026-04-10*
