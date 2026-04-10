# Stack Research — v1.4 Jardin Familial (Place du Village)

**Domain:** React Native / Expo family app — cooperative second tilemap zone, shared vault state, weekly objectives, contribution tracking
**Researched:** 2026-04-10
**Confidence:** HIGH — based on direct codebase inspection. No external library research required (see conclusion).

---

## Executive Decision

**Zero new production dependencies required.**

Every capability needed for v1.4 is already present in the codebase. The six features break down as follows:

| Feature | Existing Building Block | New Code Needed |
|---------|------------------------|-----------------|
| Second tilemap zone (Place du Village) | `TileMapRenderer.tsx` + `farm-map.ts` pattern | `village-map.ts` constants + `VillageMapRenderer.tsx` wrapper |
| Portal transition (farm → village) | `useRouter` from expo-router + `useSharedValue`/`withTiming` Reanimated | `PortalTransition.tsx` component |
| Shared vault state (cross-profile) | `parseFamilyQuests`/`serializeFamilyQuests` + `FAMILY_QUESTS_FILE` in parser.ts | Extend `family-quests.md` with village state section |
| Weekly auto-generated objectives | `FamilyQuestTemplate[]` + `createQuestFromTemplate` in quest-engine.ts | `village-objectives.ts` generator function |
| Contribution tracking (harvest + tasks) | `FamilyQuest.contributions: Record<string, number>` + `questsHook` in useVault.ts | Hook in `applyTaskEffect` + harvest completion |
| Reward system + history panneau | `FamilyQuestBanner`, `FamilyQuestDetailSheet`, `applyQuestReward` | `VillagePanneau.tsx` history view + reward trigger |

---

## Feature 1 — Second Tilemap (Place du Village)

### Pattern to Follow: farm-map.ts → village-map.ts

`TileMapRenderer.tsx` already accepts its terrain data from `buildFarmMap()` via `FarmMapData`. It is fully generic — it takes `cols`, `rows`, and `layers: Record<TerrainType, boolean[][]>`. A second instance with a different map function is trivial.

**New file: `lib/mascot/village-map.ts`**

Same shape as `farm-map.ts`. Defines `VILLAGE_MAP_COLS = 12`, `VILLAGE_MAP_ROWS = 20` (or slightly different proportions), and a `buildVillageMap()` function that fills cobblestone for the town square, water for the fountain, dirt paths between stalls, and leaves the grass base.

The existing terrain types (`TerrainType = 'grass' | 'dirt' | 'farmland' | 'water' | 'cobblestone'`) cover all needed zones for a village square:
- `cobblestone` → place pavée centrale, fontaine
- `dirt` → chemins entre les étals
- `water` → fontaine / mare décorative
- `farmland` → jardin partagé (parcelles coopératives)
- `grass` → pelouse périphérique

No new tileset assets are required — the four existing Wang tilesets (`grass_to_cobblestone`, `grass_to_dirt`, `grass_to_water`, `grass_to_farmland`) cover all zones.

**New file: `components/mascot/VillageMapRenderer.tsx`**

A thin wrapper around `TileMapRenderer` with `buildVillageMap()` as its source. The world grid for interactive objects (étals, panneau historique, fontaine) follows `world-grid.ts` pattern as `village-grid.ts`.

### WorldGridView Pattern Reuse

`WorldGridView.tsx` is parameterized via `WorldCell[]` + callback props. A `VillageGridView.tsx` can reuse the same cell rendering logic with village-specific cell types (`etal | panneau | fontaine | jardin-plot`). The cell size constants (`CELL_SIZES`) are in `world-grid.ts` and can be imported directly.

---

## Feature 2 — Portal Transition (Farm → Village)

### Pattern to Follow: expo-router + Reanimated

The farm screen is `app/(tabs)/tree.tsx`. The village screen will be `app/(tabs)/village.tsx` (or a modal route `app/village.tsx` presented as `pageSheet`).

**Recommended approach: full-screen route, not a modal.**

A modal (`pageSheet`) would conflict with the tilemap rendering context and the existing gesture handler stack. A full tab route or a pushed stack route is cleaner.

The portal tap triggers a `withTiming` fade/scale animation (existing pattern in `EvolutionOverlay.tsx` and `HarvestEventOverlay.tsx`), then calls `router.push('/village')`. No shared element transition is needed — a simple cross-fade in 300ms followed by navigation is sufficient and matches the existing Reanimated patterns.

```typescript
// PortalTransitionOverlay.tsx — using existing imports
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router'; // already installed
```

No new dependency. `expo-router` navigation + `react-native-reanimated` fade is the established pattern.

---

## Feature 3 — Shared Village State (Cross-Profile Vault File)

### Pattern to Follow: family-quests.md + parseFamilyQuests

The village needs one shared file writable by any profile. This exactly mirrors `family-quests.md` (path: `FAMILY_QUESTS_FILE = 'family-quests.md'` in `lib/parser.ts:1122`).

**New vault file: `jardin-familial.md`** (in vault root, same as `family-quests.md`)

```
export const VILLAGE_FILE = 'jardin-familial.md';
```

The file holds:
1. Village map state (which parcelles are planted, by whom)
2. Weekly objective (mirrors `FamilyQuest` — can reuse the exact same type)
3. History log (list of completed weeks, same H2-per-week pattern as `parseFamilyQuests`)

**Parser additions in `lib/parser.ts`:**
- `parseVillageState(content: string): VillageState` — same key: value flat format as `parseFarmProfile`
- `serializeVillageState(state: VillageState): string`

The `VillageState` type extends the existing `FamilyQuest` model minimally:

```typescript
export interface VillageState {
  weeklyObjectiveId: string;      // references a VillageObjectiveTemplate
  weeklyProgress: number;
  weeklyTarget: number;
  weeklyStartDate: string;        // YYYY-MM-DD
  weeklyEndDate: string;          // YYYY-MM-DD
  contributions: Record<string, number>; // profileId → count (same as FamilyQuest)
  jardinPlots: string;            // CSV: "plot0:profileId:cropId,..."
  historyLog: string;             // CSV summary: "2026-W14:done:42,..."
}
```

All field types are primitives (string, number) or serializable as CSV — the same strategy used throughout `parseFarmProfile` and `parseFamilyQuests`. No new parser pattern.

### Write Safety (Concurrency)

The vault has no locking mechanism — writes are sequential because the app is single-user-device (one active profile at a time). Cross-profile conflict only occurs if two devices sync simultaneously via iCloud, which is an existing limitation across all vault files. No additional handling is needed for MVP.

---

## Feature 4 — Weekly Auto-Generated Objectives

### Pattern to Follow: FamilyQuestTemplate + createQuestFromTemplate

`quest-engine.ts` already has `FamilyQuestTemplate[]` and `createQuestFromTemplate()`. The village weekly objective is structurally identical to a `FamilyQuest` with `type: 'harvest' | 'tasks' | 'composite'`.

**New file: `lib/mascot/village-objectives.ts`**

Contains `VILLAGE_OBJECTIVE_TEMPLATES: VillageObjectiveTemplate[]` (same shape as `FamilyQuestTemplate`). A `generateWeeklyObjective(familyLevel: number, season: Season): VillageObjectiveTemplate` function picks a template based on family XP level + current season, adjusting `target` by level tier.

The "auto-generated" requirement means: on Monday (detected in `questsHook.checkAndExpireQuests` pattern), if no active village objective exists, generate one. This is a pure TypeScript function, no external library.

`date-fns` (already installed `^4.1.0`) provides `startOfWeek`, `endOfWeek`, `isAfter` for the weekly boundary detection — same as used in `FamilyQuestBanner.tsx` via `differenceInDays`/`parseISO`.

---

## Feature 5 — Contribution Tracking

### Pattern to Follow: FamilyQuest.contributions + applyTaskEffect dispatcher

Contributions come from two sources:

**A. Task completion (IRL tasks)**
`applyTaskEffect()` in `lib/semantic/` already dispatches effects per task category. Adding a village contribution increment is a new case in the same dispatcher — `villageHook.addContribution(profileId, 1)`. Pattern mirrors the existing `questsHook.addContribution` call.

**B. Farm harvest (in-game)**
Harvest completion in `farm-engine.ts` / `useVault.ts` already calls `questsHook.addContribution` for `FamilyQuest`. Village contribution is a parallel call on the same hook.

**Anti-abuse:** The existing `anti-abuse` caps (daily/weekly caps in SecureStore, established in v1.3) apply. The village hook reuses the same `checkCap` utility from `lib/semantic/anti-abuse.ts`.

No new library. Contribution tracking is additive to the existing pattern.

---

## Feature 6 — Reward System + History Panneau

### Reward System: applyQuestReward Pattern

`applyQuestReward()` in `quest-engine.ts` already handles all `FamilyFarmReward` types. The village reward is a `FamilyFarmReward` — the completion path calls the same function. Additionally, the village reward includes an "IRL activity suggestion" (e.g., "Faire une sortie vélo en famille") — this is a static string from a `VILLAGE_IRL_REWARDS: string[]` constant, no dynamic generation.

### History Panneau: parseFamilyQuests Pattern

The panneau interactif displays completed-week entries. These are stored in `jardin-familial.md` as completed quest sections (same H2-per-quest pattern as `serializeFamilyQuests`). The `VillagePanneau.tsx` component renders a `ScrollView` of week cards — same pattern as `FamilyQuestDetailSheet.tsx`.

**`react-native-confetti-cannon` (already installed `^1.5.2`)** is used for the reward celebration — same as the existing `LootBoxOpener.tsx` usage.

---

## Final Dependency Summary

| Capability | New Dependency | Rationale |
|------------|---------------|-----------|
| Second tilemap zone | None | `TileMapRenderer` + new `village-map.ts` constants |
| Village world grid | None | `world-grid.ts` pattern → `village-grid.ts` |
| Portal transition animation | None | `react-native-reanimated` already installed `~4.1.1` |
| Portal navigation | None | `expo-router` already installed `~6.0.23` |
| Shared vault state | None | `parseFamilyQuests` pattern → new `parseVillageState` in `lib/parser.ts` |
| Weekly objective generation | None | `FamilyQuestTemplate` pattern + `date-fns ^4.1.0` (already installed) |
| Contribution tracking (tasks) | None | Extends `applyTaskEffect` dispatcher + existing `questsHook` |
| Contribution tracking (harvest) | None | Parallel call to existing harvest completion path |
| Anti-abuse caps | None | `lib/semantic/anti-abuse.ts` already provides `checkCap` |
| Reward system | None | `applyQuestReward` + `VILLAGE_IRL_REWARDS` static constant |
| Reward confetti | None | `react-native-confetti-cannon ^1.5.2` already installed |
| History panneau | None | `FamilyQuestDetailSheet` pattern → `VillagePanneau.tsx` |

**npm install command: none required.**

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any multiplayer / real-time sync library (e.g., Liveblocks, Supabase Realtime) | App is 100% local + iCloud — no backend. Adding a real-time layer contradicts the core constraint and requires auth infrastructure. | `jardin-familial.md` vault file, same iCloud sync as all other shared files |
| `react-native-maps` or any map SDK | The village is a pixel tilemap, not a geographic map. These libraries are massive (native modules, Maps SDK API key) and completely wrong for the use case. | `TileMapRenderer.tsx` + `village-map.ts` |
| Redux / Zustand / Jotai state library | The app has a mature `VaultContext` + `useVault` hook architecture. Introducing a second state paradigm for village state creates two competing patterns. | Extend `useVault.ts` with `useVillageVault` domain section (same as `useQuestsVault`) |
| `react-native-game-engine` or any game loop library | The farm already proves pixel game UIs work with Reanimated + `React.memo` + `useSharedValue`. A game engine lib adds ~500 KB and requires a rendering paradigm incompatible with the existing component tree. | Existing `WorldGridView` / `TileMapRenderer` pattern |
| `socket.io` or WebSocket for cross-device sync | Out of scope. App is single-vault iCloud. No server. | iCloud Drive file sync (existing) |
| Any animation library beyond Reanimated | Project constraint: `react-native-reanimated` is mandatory for all animations. All existing overlays, sheets, transitions use it. | `react-native-reanimated ~4.1.1` |

---

## Integration Points

| New Code | Integrates With | File/Pattern Reference |
|----------|----------------|----------------------|
| `lib/mascot/village-map.ts` | `components/mascot/VillageMapRenderer.tsx` | Mirrors `farm-map.ts` → `TileMapRenderer.tsx` |
| `lib/mascot/village-grid.ts` | `components/mascot/VillageGridView.tsx` | Mirrors `world-grid.ts` → `WorldGridView.tsx` |
| `lib/mascot/village-objectives.ts` | `hooks/useVault.ts` `useVillageVault` section | Mirrors `quest-engine.ts` → `questsHook` |
| `lib/parser.ts` — `parseVillageState` / `serializeVillageState` | `hooks/useVault.ts` `loadVaultData` | Mirrors `parseFamilyQuests` (parser.ts:1168) |
| `VILLAGE_FILE = 'jardin-familial.md'` constant | `lib/parser.ts` export | Mirrors `FAMILY_QUESTS_FILE` (parser.ts:1122) |
| Village contribution in `applyTaskEffect` | `lib/semantic/` dispatcher | Parallel to existing `questsHook.addContribution` call |
| `app/(tabs)/village.tsx` | expo-router tab or stack push from `tree.tsx` | Same pattern as `app/(tabs)/tree.tsx` |
| `components/mascot/VillagePanneau.tsx` | `VillageGridView` cell press handler | Mirrors `FamilyQuestDetailSheet.tsx` |
| `components/mascot/PortalTransitionOverlay.tsx` | `tree.tsx` portail item onPress | Mirrors `EvolutionOverlay.tsx` + `router.push` |

---

## Version Compatibility

All work stays within the existing locked stack:

| Package | Version | Role in v1.4 |
|---------|---------|--------------|
| `react-native-reanimated` | ~4.1.1 | Portal transition animation, tilemap animations |
| `expo-router` | ~6.0.23 | Village screen navigation (`router.push('/village')`) |
| `expo-secure-store` | ~15.0.8 | Anti-abuse caps for contribution tracking |
| `date-fns` | ^4.1.0 | Weekly boundary detection (`startOfWeek`, `isAfter`, `parseISO`) |
| `react-native-confetti-cannon` | ^1.5.2 | Reward celebration on weekly objective completion |
| `react-native-svg` | ^15.12.1 | Portal glow / cutout effect if needed (optional) |
| `gray-matter` | ^4.0.3 | `jardin-familial.md` frontmatter (existing vault parse path) |
| `i18next` | ^25.10.2 | All new UI strings in `locales/fr/common.json` |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Tilemap second instance | HIGH | `TileMapRenderer.tsx` + `farm-map.ts` read directly — fully parameterized, no hardcoded assumptions |
| Shared vault file pattern | HIGH | `parseFamilyQuests` / `FAMILY_QUESTS_FILE` read directly, cross-profile write pattern established |
| Weekly objective generation | HIGH | `FamilyQuestTemplate` + `createQuestFromTemplate` read directly in `quest-engine.ts` |
| Contribution tracking | HIGH | `FamilyQuest.contributions` + `applyTaskEffect` dispatcher and `questsHook.addContribution` confirmed in `hooks/useVault.ts` |
| Portal transition (Reanimated + router) | HIGH | `useRouter` confirmed in `tree.tsx:27`, `withTiming`/`withSequence` patterns confirmed throughout mascot components |
| Anti-abuse reuse | HIGH | `lib/semantic/anti-abuse.ts` confirmed in v1.3 (68 tests) |
| Zero new deps conclusion | HIGH | All six capabilities map to existing production code with no capability gap |

---

## Sources

- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/farm-map.ts` — `FarmMapData`, `buildFarmMap`, `TerrainType`, `findWangTile` confirmed
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/world-grid.ts` — `WorldCell`, `WORLD_GRID`, `CELL_SIZES` confirmed
- `/Users/gabrielwaltio/Documents/family-vault/components/mascot/TileMapRenderer.tsx` — parameterized via `buildFarmMap()`, no farm-specific hardcoding at renderer level
- `/Users/gabrielwaltio/Documents/family-vault/components/mascot/WorldGridView.tsx` — `WorldCell[]` + callback props, fully reusable
- `/Users/gabrielwaltio/Documents/family-vault/lib/quest-engine.ts` — `FamilyQuest`, `FamilyQuestTemplate`, `createQuestFromTemplate`, `applyQuestReward` confirmed
- `/Users/gabrielwaltio/Documents/family-vault/lib/parser.ts:1122` — `FAMILY_QUESTS_FILE`, `parseFamilyQuests`, `serializeFamilyQuests`, `parseFarmProfile` patterns confirmed
- `/Users/gabrielwaltio/Documents/family-vault/hooks/useVault.ts:1125` — quest loading + `questsHook` integration confirmed
- `/Users/gabrielwaltio/Documents/family-vault/components/mascot/FamilyQuestBanner.tsx` — `FamilyQuest` rendering pattern, `date-fns` usage confirmed
- `/Users/gabrielwaltio/Documents/family-vault/components/mascot/WeeklyGoal.tsx` — weekly boundary logic via `date-fns` confirmed
- `/Users/gabrielwaltio/Documents/family-vault/package.json` — all dependency versions verified directly

---
*Stack research for: FamilyFlow v1.4 Jardin Familial (Place du Village)*
*Researched: 2026-04-10*
