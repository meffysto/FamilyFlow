# Pitfalls Research — v1.2 Confort & Découverte

**Domain:** React Native / Expo family app — adding dietary preferences, farm codex, and farm tutorial to a mature, complex codebase
**Researched:** 2026-04-07
**Confidence:** HIGH (based on direct codebase audit + known RN/Expo patterns)

---

## Critical Pitfalls

### Pitfall 1: Allergen Silencing — The Fatal-Severity Bug Class

**What goes wrong:**
A vegetarian preference is a lifestyle choice. A peanut allergy is a medical constraint that can cause anaphylaxis. If the allergen flagging system is built as a soft filter (user dismisses it once, never shows again), or if it silently fails to flag a recipe because the ingredient name doesn't exactly match the stored string, someone could unknowingly serve a dangerous meal. There is currently no allergen-aware code anywhere in the codebase — `HealthRecord.allergies` exists as `string[]` but is used only in the health journal, never cross-referenced against recipes.

**Why it happens:**
The same UI pattern that works for preferences ("mute this hint") is applied to safety warnings. The developer treats all dietary data uniformly (it all came from the same Settings screen) without distinguishing severity levels.

**How to avoid:**
Define an explicit severity taxonomy at the type level from day one:

```typescript
export type DietaryConstraintSeverity = 'allergie' | 'intolerance' | 'regime' | 'aversion';
// allergie → safety-critical, NEVER dismissible
// intolerance → medical but not fatal
// regime → lifestyle (végétarien, halal, kasher)
// aversion → preference only ("n'aime pas les olives")
```

For `allergie`-severity items, the UI must use a non-dismissible warning component — a persistent banner that cannot be swiped away or hidden. Use `Alert.alert()` with a single "J'ai compris" button (not "Ne plus afficher") for the first encounter, then a persistent icon badge on the recipe card itself. The badge must be rendered unconditionally, not behind a `!dismissed` flag.

Add a mandatory field: `severity: DietaryConstraintSeverity` to every constraint object. If severity is missing during parse (backward compatibility), default to `aversion` — never to `allergie`.

Cross-reference logic: when loading a recipe for meal planning, scan `ingredients` from the Cooklang parse result against the active profile's constraints. This must run inside `lib/parser.ts` or a dedicated `lib/dietary.ts` module, not in the UI component (so it's testable).

**Warning signs:**
- Any UI code that stores a `dismissed: boolean` for an allergen warning
- A constraint object without a `severity` field
- Allergen check logic inside a React component instead of a pure lib function
- A single `string[]` of all dietary needs with no type distinction

**Phase to address:**
Phase 1 (dietary preferences foundation) — severity taxonomy must be in the data model from the first commit. Cannot be retrofitted after data is in the vault.

---

### Pitfall 2: Stale Profile Data in Allergen Checks

**What goes wrong:**
FamilyFlow uses optimistic local state. When a parent updates a child's allergy in Settings, the `profiles` array in `useVaultInternal` is updated optimistically. However, the meal planning view may be holding a stale reference to the old profile data captured in a `useMemo` or `useCallback` at render time. The app shows "no allergen warnings" for a recipe because the stale profile doesn't have the newly added allergy yet.

The existing concurrency problem is documented in `CONCERNS.md`: "Multiple rapid actions can cause race conditions if the file hasn't been re-read between writes." The `busyRef` guard only covers `loadVaultData`, not individual writes.

**Why it happens:**
The allergen check function takes a `Profile` as argument. In React, stale closures are the default. `useCallback` with an empty or wrong dependency array will capture the profile at mount time.

**How to avoid:**
The allergen check function must always receive fresh data from `useVault()` at call site — never cache it in a `ref` or `useCallback` that doesn't list `profiles` as a dependency. Prefer reading directly from the context value in the check function signature:

```typescript
// BAD: stale reference captured at component mount
const check = useCallback((recipe) => checkAllergens(recipe, cachedProfile), []);

// GOOD: profiles from live context, never stale
const { profiles, activeProfile } = useVault();
const warnings = useMemo(
  () => checkAllergens(recipe, profiles, activeProfile),
  [recipe, profiles, activeProfile]
);
```

Also, after a user saves dietary preferences, call `refresh()` explicitly to reload `famille.md` from disk — don't rely solely on optimistic state for safety-critical data.

**Warning signs:**
- `useCallback(() => checkAllergens(recipe, profile), [])` with empty deps
- `const profileRef = useRef(profile)` used in allergen checks
- Allergen check that doesn't list `profiles` in its `useMemo` deps

**Phase to address:**
Phase 1 (dietary preferences) — enforced in code review before any allergen UI is shipped.

---

### Pitfall 3: i18n Allergen Name Mismatch

**What goes wrong:**
The app already supports French/English (i18n via `lib/i18n.ts`). Allergen names differ: "peanut" vs "arachide", "nuts" vs "fruits à coque", "gluten" vs "gluten" (same), "shellfish" vs "crustacés". If allergen identifiers are stored as free-text display strings (e.g., the user typed "cacahuète"), the cross-reference against a recipe ingredient named "arachide" or "peanut butter" will silently miss.

The Cooklang parser (`lib/cooklang.ts`) returns ingredient names exactly as typed in the `.cook` file — these could be in any language depending on who wrote the recipe.

**Why it happens:**
Developer tests only with their own language. The data model stores the display label instead of a canonical identifier.

**How to avoid:**
Use canonical IDs for all allergens, not display strings. Define a taxonomy in `constants/dietary.ts`:

```typescript
export const ALLERGEN_CATALOG = [
  { id: 'gluten',      labelFr: 'Gluten',          labelEn: 'Gluten',      keywords: ['gluten', 'blé', 'orge', 'seigle', 'wheat', 'barley'] },
  { id: 'arachides',   labelFr: 'Arachides',        labelEn: 'Peanuts',     keywords: ['arachide', 'cacahuète', 'peanut'] },
  { id: 'fruits_coq',  labelFr: 'Fruits à coque',   labelEn: 'Tree nuts',   keywords: ['noix', 'noisette', 'amande', 'cajou', 'walnut', 'almond'] },
  // ... 14 EU major allergens
] as const;
```

The profile stores `allergenId[]` (canonical IDs), not display strings. The cross-reference function matches against the `keywords` array for each allergen. This also makes it resilient to recipe imports in English when the family uses French UI.

Free-text aversions (e.g., "n'aime pas les épinards") remain as raw strings because they don't need cross-referencing, just display.

**Warning signs:**
- `DietaryConstraint.label: string` used as the match key in recipe checking
- Allergen stored directly as user-typed text without normalization
- Matching logic using `ingredient.name.includes(allergen)` with raw strings

**Phase to address:**
Phase 1 — must be in the initial `constants/dietary.ts` design. Adding canonical IDs after data is in the vault requires a migration.

---

### Pitfall 4: Vault Parsing — Profile Names With Special Characters

**What goes wrong:**
`famille.md` uses a custom format parsed in `lib/parser.ts` (lines 662+). Profile IDs are derived from names (e.g., "emma" → `emma`, "Jean-Marie" → `jean-marie`). If a profile is named "Léa" or "用户", the ID generation hits encoding issues. More critically, if two family members share a first name (e.g., two "Alex"), the parser creates duplicate IDs, and `farm-{profileId}.md` will collide — both profiles write to the same file, corrupting data.

The `serializeFarmProfile` function writes to `farm-{profileId}.md` — a collision there destroys farm data silently (no error is thrown, the later write simply overwrites).

**Why it happens:**
The assumption is that family first names are unique. This is usually true but not guaranteed. The codebase already uses `profileId` as the stable key (not name), but if ID generation isn't collision-resistant, the guarantee breaks.

**How to avoid:**
Dietary preferences will be stored in the profile's data (in `famille.md` or a sidecar). Verify that the ID generation function in the profile parser produces stable, unique IDs even when names collide. If it doesn't, add a numeric suffix for duplicates (`alex_1`, `alex_2`). Add a deduplication guard in `parseProfiles()` that detects and logs duplicate IDs.

For vault storage of dietary constraints, prefer storing them in the profile's existing section in `famille.md` (alongside `role`, `avatar`, etc.) rather than a new sidecar file — it avoids the n-files-per-profile proliferation problem that `farm-{id}.md` already introduced.

**Warning signs:**
- Profile ID derived directly from `name.toLowerCase()` without collision detection
- Any new vault file named `{something}-{profileId}.md` without checking for duplicate IDs
- Parser silently succeeding when two profiles map to the same ID

**Phase to address:**
Phase 1 — add a duplicate-ID assertion in `parseProfiles()` before adding new vault fields.

---

### Pitfall 5: Codex Content Drift from Engine Constants

**What goes wrong:**
The farm codex will document facts like "la carotte nécessite 4 tâches pour pousser" or "le poullailler produit 1 œuf toutes les 2 heures". These facts live as constants in `lib/mascot/types.ts` (`CROP_CATALOG`, `tasksPerStage: 1` means 4 stages × 1 task = 4 tasks total) and `lib/mascot/building-engine.ts`. If the codex content is hardcoded as strings in a separate component, the next time someone tweaks `tasksPerStage: 1` to `tasksPerStage: 2` (balance pass), the codex will lie — silently, permanently, until a user notices.

This codebase has already had balance passes: `.planning/STATE.md` shows "Rééquilibrer recettes ferme — 2 ingrédients + 17 prix de vente". Each such pass is a potential codex drift event.

**Why it happens:**
Writing "carrot takes 4 tasks" as a hardcoded string in a codex screen is faster than wiring it to the engine. It works correctly at the moment of writing.

**How to avoid:**
The codex must render from the same constants that the engine uses — never from hardcoded copies. The codex screen imports `CROP_CATALOG`, `BUILDING_CATALOG`, `PLOTS_BY_TREE_STAGE`, etc. directly and renders them:

```typescript
// WRONG
const CODEX_ENTRIES = [{ title: 'Carotte', desc: 'Prend 4 tâches pour pousser' }];

// RIGHT
import { CROP_CATALOG } from '../../lib/mascot/types';
// render: `${crop.tasksPerStage * 4} tâches pour pousser` (4 stages × tasksPerStage)
```

For stats that require computation (e.g., "temps moyen de croissance"), create a pure function in `lib/mascot/farm-engine.ts` that derives the display value from the constants. The codex component calls the function, never the hardcoded string.

The only acceptable hardcoded text in the codex is narrative/explanatory prose ("La ferme vous récompense quand vous accomplissez vos tâches quotidiennes"). Numbers and stats must be derived.

**Warning signs:**
- Any `const CODEX_DATA = [...]` array with hardcoded numeric stats
- Codex screen that doesn't import from `lib/mascot/`
- A PR that changes `tasksPerStage` but doesn't touch the codex component

**Phase to address:**
Phase 2 (codex) — architectural constraint enforced on the first codex PR.

---

### Pitfall 6: Codex Performance — Unvirtualized Long List

**What goes wrong:**
The farm has 31 files in `lib/mascot/` and already shows content breadth: 14 crop types, 4 building types, 5 tree stages, seasonal events, companions, sagas, tech tree nodes, craft recipes, rare seeds. A codex with 60–100 entries rendered in a `ScrollView` with full card content will be slow on the tree screen, which already had an OOM crash fixed (commit `260404-qvz` — "Fix OOM crash TreeScreen — timer global, lazy-load images saison, reduire particules").

In React Native, `ScrollView` renders all children immediately. With complex cards (emoji, descriptions, stat rows), 80+ cards in a `ScrollView` is a measurable frame-rate problem.

**Why it happens:**
The codex is a detail view (not the main farm screen), so performance isn't considered during development. It only shows up as jank when opened.

**How to avoid:**
Use `FlatList` with `windowSize={5}` and `maxToRenderPerBatch={10}` for any codex list longer than 20 items. For category-grouped content, use `SectionList`. Define `keyExtractor` explicitly (use `item.id`, not `index`). Wrap each codex entry card with `React.memo()`.

If the codex is presented as a `pageSheet` modal (per conventions), set `initialNumToRender={8}` to avoid blocking the modal open animation.

Do not preload codex content at app startup — the codex is cold path. Load on modal open only.

**Warning signs:**
- `<ScrollView>{entries.map(e => <CodexCard key={e.id} />)}</ScrollView>` for >20 entries
- Codex component imported in `app/(tabs)/tree.tsx` with heavy data at module level
- Missing `React.memo` on codex list item components

**Phase to address:**
Phase 2 (codex) — architecture decision at component scaffolding time.

---

### Pitfall 7: Tutorial "Seen" Flag — Device/Profile Conflicts

**What goes wrong:**
The existing `HelpContext` stores seen-state in `expo-secure-store` with key `help_screens_v1` (a flat JSON object, global per device, not per profile). If the tutorial "farm_tutorial_seen" is stored the same way, reinstalling the app clears it (SecureStore is not backed up by iCloud). More subtly: if there are 4 family profiles on the same device, should the farm tutorial show once per device (the adult has seen it, the child hasn't) or once per profile?

The existing `hasSeenScreen('farm')` mechanism is already global — not per-profile. If the tutorial should be per-profile (child gets their own first-farm experience), the HelpContext must be extended with profile-scoped keys. If the tutorial is per-device, reinstalling will show it again, which is probably acceptable.

**Why it happens:**
Developer adds `markScreenSeen('farm_tutorial')` to the HelpContext without considering the profile dimension.

**How to avoid:**
Decide the scope explicitly before coding:
- **Per-device global:** use existing `HelpContext.markScreenSeen('farm_tutorial')` — simplest, correct for most cases
- **Per-profile:** store key `farm_tutorial_seen_{profileId}` instead — necessary if child profiles each deserve their own tutorial

Given that the "first farm experience" is tied to the active profile, per-profile scope is correct. Implement this as an extension to `HelpContext` that supports profile-scoped keys: `markProfileScreenSeen(profileId, screenId)` and `hasProfileSeenScreen(profileId, screenId)`. This avoids a second storage mechanism.

For replayability (tutorial accessible from codex), use `resetScreen('farm_tutorial')` on the active profile — this must use the profile-scoped version, not the global one, or it would reset the tutorial for all profiles on the device.

**Warning signs:**
- `markScreenSeen('farm_tutorial')` used without profile context
- Tutorial seen-state stored as a single boolean key (not profileId-keyed)
- "Rewatch tutorial" button calling `resetAllHints()` (would reset ALL coach marks)

**Phase to address:**
Phase 3 (tutorial) — scope decision must be in the phase spec before implementation.

---

### Pitfall 8: Tutorial Animation Jank — Reanimated + Spotlight + Farm Scene

**What goes wrong:**
The tree screen (`tree.tsx`, 82KB) already had an OOM crash from too many simultaneous animations (commit `260404-qvz`). Adding a tutorial overlay with spotlight animations (typically a dark overlay + transparent hole + animated arrow + text bubble) on top of the farm diorama will compete for the JS thread with: WorldGridView timer, AnimatedAnimal frames, crop animations, building overlays, and ambient particles.

A spotlight overlay implemented with two large Views and a `mask` or `clip` approach in Reanimated 4 can cause 3-4 extra renders per frame when the spotlight position animates.

**Why it happens:**
Tutorial overlays are often prototyped in isolation where the underlying screen is static. The perf issue only surfaces when the overlay is placed above the live farm.

**How to avoid:**
- Use `runOnUI` + `useAnimatedStyle` for spotlight position — keep the animation entirely on the UI thread, never on the JS thread.
- Pause or reduce the farm's background timers during the tutorial: set a `isTutorialActive` ref in WorldGridView to skip frame updates.
- The spotlight "hole" should be a static position for each tutorial step (not continuously animated). Only animate between steps (slide to next target).
- Prefer `withTiming` (linear, predictable) over `withSpring` for spotlight moves — springs can overshoot and cause jank when the underlying scene is already animated.
- Keep the total number of `useSharedValue` instances added by the tutorial under 5. A tutorial with 8 shared values on a screen that already has dozens will degrade perf.

Validate frame rate on device during tutorial before shipping. Acceptable threshold: 58+ fps (2 dropped frames per second acceptable, 10+ dropped = rework).

**Warning signs:**
- Tutorial overlay uses `useState` for position instead of `useSharedValue`
- Spotlight animation running `withRepeat` + `withSpring` simultaneously with the farm
- No mechanism to pause WorldGridView during tutorial
- Frame rate not tested on TestFlight build (only simulator)

**Phase to address:**
Phase 3 (tutorial) — farm pause mechanism should be in Phase 3 spec as an explicit task.

---

### Pitfall 9: Tutorial Content Breaks When Farm Content Changes

**What goes wrong:**
The tutorial script says "Plante une carotte dans ta parcelle" and points to the carrot cell. If a future balance pass renames `carrot` to `radis` or removes it as the default starter crop, the tutorial points to a non-existent element. Similarly, if the tutorial says "ouvre le moulin" but a future phase removes the moulin, the tutorial is broken.

Saga scripts in `lib/mascot/sagas-content.ts` already have this fragility (noted in CONCERNS.md: "Saga progression could break silently"). The tutorial would have the same failure mode.

**Why it happens:**
Tutorial scripts are written against the current state of the codebase. Content and code are versioned together but their semantic relationship isn't enforced.

**How to avoid:**
Tutorial steps should reference farm entities by ID, not by name, and validate the reference at render time:

```typescript
interface TutorialStep {
  target: 'plot' | 'crop' | 'building' | 'ui_element';
  targetId?: string;  // crop ID or building ID — validated against catalog
  fallback?: string;  // what to do if targetId doesn't exist
}
```

At tutorial load time, validate all `targetId` references against `CROP_CATALOG` and `BUILDING_CATALOG`. If a reference is invalid, skip that step gracefully rather than crashing. Log a dev-mode warning.

For the tutorial "first crop" step, do not hardcode "carrot" — use `CROP_CATALOG.find(c => !c.dropOnly && !c.techRequired)[0]` to always pick the first available crop dynamically.

**Warning signs:**
- Tutorial steps with hardcoded crop names as strings ("carotte", "carrot")
- Tutorial step that references a UI element by hardcoded position (absolute coordinates)
- No validation of tutorial step targets at load time
- Tutorial content in a `.ts` constants file that doesn't import from `lib/mascot/types.ts`

**Phase to address:**
Phase 3 (tutorial) — enforced in tutorial data model design.

---

### Pitfall 10: useVault.ts God Hook — Adding Dietary Preferences Grows the 3431-Line Monster

**What goes wrong:**
Every new vault data type must be added to `useVaultInternal()` in `hooks/useVault.ts` (per `STRUCTURE.md`: "If it manages vault data, integrate into useVaultInternal() instead of creating a standalone hook"). Dietary preferences are per-profile vault data. Adding a new state variable, a new `loadVaultData` branch, a new `savePreferences` action, and updating the `useMemo` dependency array (already 90 items) will make the hook grow further. The `useMemo` at line 3402-3430 with 90 dependencies already risks massive object recreation on every state change.

If dietary preferences cause a re-render on every profile switch (the active profile changes, preferences re-derive), the entire `VaultContext` value object re-creates, triggering re-renders in all 80+ subscribers.

**Why it happens:**
The architecture mandates all vault state live in one hook. The tech debt is acknowledged in the codebase but hasn't been addressed. New features have no choice but to use the existing pattern.

**How to avoid:**
For dietary preferences specifically, avoid adding a new top-level state slice. Instead, augment the existing `Profile` type with a `dietaryConstraints` field — the data travels with the profile, which is already loaded, parsed, and present in the `profiles` state array. This means:
- No new `useState` for dietary data
- No new `loadVaultData` branch
- No new `useMemo` dependency
- The save action reuses `updateProfile()` or similar existing profile mutation

The `famille.md` parser already handles the profile section. Adding a `dietary_constraints: gluten,allergie|noix,allergie|végétarien,regime` field to each profile block in `famille.md` keeps it in the existing file, avoids a new file per profile, and reuses the existing parse/serialize cycle.

**Warning signs:**
- `const [dietaryPrefs, setDietaryPrefs] = useState<DietaryConstraint[]>([])` at the top level of `useVaultInternal`
- New entry in `loadVaultData`'s `Promise.allSettled` array for dietary prefs
- `dietaryPrefs` added to the 90-dependency `useMemo` at the bottom of `useVault.ts`
- A new file `dietary-{profileId}.md` in the vault (proliferates the farm-{id}.md pattern)

**Phase to address:**
Phase 1 — data model design decision must be made before writing any code.

---

### Pitfall 11: Codex "?" Button — Crowded tree.tsx UI

**What goes wrong:**
`app/(tabs)/tree.tsx` already renders: sagas indicator, event sagas, quest banner, quest picker, companion slot, harvest indicators, ambient particles, seasonal overlay, farm hint banner, and a HUD with multiple action buttons. Adding a "?" codex button is the last straw that makes the UI feel cluttered.

More concretely: `tree.tsx` is 82KB. Every new component added to this screen increases the risk of triggering the OOM issue that was already fixed (commit `260404-qvz`). Each new component that uses `useVault()` adds to the rerender surface.

**Why it happens:**
Each feature is added in isolation and seems reasonable. The accumulation effect is only visible when looking at the full screen.

**How to avoid:**
The "?" button should be integrated into the existing HUD rather than added as a standalone floating button. The existing HUD panel (bottom panel with "Actions" and "Progression" cards from commit `260402-wbr`) should gain a tertiary action — a small "?" icon in the corner of the panel, not a new floating button. This costs zero new layout space.

The codex component itself must not be imported at the tree screen module level — use dynamic `React.lazy` or load it only when the modal is opened. This prevents the codex catalog data (CROP_CATALOG, BUILDING_CATALOG, etc.) from being in the initial bundle of an already heavy screen.

Do not call `useVault()` inside the codex component unless it needs dynamic farm state. Static codex content (crop definitions, building costs) comes from constants, not vault state.

**Warning signs:**
- A new `<FloatingButton position="top-right" icon="?" />` added to tree.tsx
- Codex component imported at the top of tree.tsx
- Codex component calling `useVault()` for static content

**Phase to address:**
Phase 2 (codex) — placement decision before implementation.

---

### Pitfall 12: HelpProvider vs Tutorial Duplication of Concern

**What goes wrong:**
`HelpContext` already manages "has the user seen X screen/feature" via `hasSeenScreen` and `markScreenSeen`. A new "TutorialContext" or "TutorialProvider" would duplicate this concern and add another level to the already deep provider hierarchy: `SafeAreaProvider > GestureHandler > VaultProvider > ThemeProvider > AIProvider > HelpProvider > ParentalControls > ToastProvider`. A TutorialProvider after ToastProvider would be the 9th level.

More dangerously: if the tutorial uses its own state separate from HelpContext, they can conflict — HelpContext thinks the farm screen has been seen (its coach mark was shown), but TutorialProvider thinks the tutorial hasn't been seen yet, so both fire on the same visit.

**Why it happens:**
The tutorial feels like a distinct, self-contained feature and gets its own provider.

**How to avoid:**
Extend `HelpContext` — do not create a new provider. The tutorial "seen" state is semantically identical to `hasSeenScreen`. What differs is the granularity (per-profile) and the replayability UI. These can be added to `HelpContext` via:
- Profile-scoped key support: `hasSeenScreen(profileId, screenId)` overload
- A `replayScreen(profileId, screenId)` convenience method

The tutorial component itself is a UI-only component that reads from `HelpContext`, renders a multi-step overlay, and calls `markScreenSeen` on completion. No new provider needed.

The codex "replay tutorial" button calls `resetScreen` on the profile-scoped key, then navigates to the farm screen. This is 3 lines of code, not a new provider.

**Warning signs:**
- `TutorialProvider` or `TutorialContext` created as a new file
- Tutorial state stored in a new `expo-secure-store` key outside of HelpContext
- Provider hierarchy growing beyond 8 levels

**Phase to address:**
Phase 3 (tutorial) — explicit architectural constraint in the phase spec.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store dietary constraints as free-text `string[]` | No new type definitions needed | Allergen cross-reference breaks on language variations; typos create false negatives | Never — severity taxonomy is load-bearing |
| Copy farm stat numbers into codex strings | Faster to write | Codex lies after every balance pass; users lose trust | Never for numeric stats; acceptable for narrative prose |
| Use global `hasSeenScreen` for tutorial (no profile scope) | Reuses existing HelpContext as-is | Child profile on same device never gets own tutorial experience | Acceptable if family has only one child or tutorial is truly device-global |
| Add dietary state as new top-level slice in useVault.ts | Clean separation, follows precedent | Further inflates 3431-line hook; adds to 90-dep useMemo | Never — embed in Profile type instead |
| Render codex in a ScrollView | 10 minutes vs 1 hour for FlatList | Frame drops on 60+ entries; already had OOM on tree screen | Acceptable only if codex stays under 20 entries (unlikely) |
| Add "?" button as new FloatingButton on tree.tsx | No changes to existing HUD | N+1 floating element on already crowded screen; adds to memory pressure | Never — integrate into existing HUD |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cooklang ingredient names → allergen matching | `ingredient.name.includes(allergenLabel)` case-sensitive string match | Match against canonical `keywords[]` array from `ALLERGEN_CATALOG`; normalize to lowercase before matching |
| `farm-{profileId}.md` + dietary in `famille.md` | Creating `dietary-{profileId}.md` (proliferates profile-sidecar files) | Add `dietary_constraints` field to existing profile section in `famille.md` |
| Tutorial step "point at element" on farm screen | Hardcoded pixel coordinates that break on different screen sizes | Use logical farm coordinates (plot index, building slot) that the farm renderer translates to screen coordinates |
| Codex rendering engine constants | Import `CROP_CATALOG` in codex screen module scope | Use `useMemo(() => CROP_CATALOG, [])` inside component to avoid module-level constant capturing a stale snapshot |
| HelpContext profile-scoped keys | Store `farm_tutorial_lucas` flat key in SecureStore | Extend `help_screens_v1` JSON structure with `{ global: {...}, profiles: { lucas: {...} } }` — keeps it one store key |
| expo-secure-store + reinstall | Tutorial seen-flag lost after reinstall | Document this as expected behavior; do not attempt iCloud backup of SecureStore (not possible without entitlement changes) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Codex ScrollView with 60+ entries | Stutter on modal open; 500ms+ to interactive | FlatList with `windowSize={5}`, `maxToRenderPerBatch={10}` | >25 entries in a single list |
| Allergen check in render path (no memo) | Meal planner re-renders slowly when any vault state changes | `useMemo` with explicit `[recipe, profiles, activeProfile]` deps | Every vault state change (full vault reload on foreground) |
| Tutorial animation + farm timers competing | Frame drops on farm screen during tutorial | Pause WorldGridView global timer via ref during tutorial steps | From the moment spotlight overlay appears |
| Farm codex accessing `useVault()` for static data | Unnecessary re-renders when unrelated vault data changes | Read static data from constants imports, not from vault state | Every time any family member completes a task |
| Dietary constraint list re-creating on profile switch | UI flickers when switching active profile | `useMemo` on `activeProfile.dietaryConstraints` with stable profile ID dep | Multiple profiles present on device |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Unskippable tutorial | User who knows the farm (returning from break) is trapped; frustration | Show a "Passer" button from step 1; auto-advance after 30s idle; NEVER block interaction |
| Tutorial that auto-replays every session | Returns users annoyed by replay; feel app is broken | Check HelpContext once at mount; dismiss forever on first completion or first explicit skip |
| Allergen warning dismissed with "Ne plus afficher" | Parent who dismissed the warning serves allergen food | Allergies severity level: no dismiss option; show persistent badge on recipe card |
| Codex shows unreleased or spoiler content | Child sees "Dragon Fruit" drop-only crop before they know it exists | Add `isSecret: boolean` to `CropDefinition`; codex only shows entries that have been unlocked by the profile |
| Dietary preferences buried in Settings | Parents don't know the feature exists; never set preferences | Add one-time coach mark on meal planner screen pointing to "Préférences alimentaires" in Settings |
| Codex search "tomato" returns nothing (French content) | User thinks codex is broken | Use `labelKey` i18n translation for matching; also match against the canonical `id` (e.g., "tomato") even in French UI |

---

## "Looks Done But Isn't" Checklist

- [ ] **Dietary preferences UI:** Constraints are saved to vault — but verify `parseProfiles()` round-trips them correctly (serialize then re-parse returns identical data, including special characters in constraint notes)
- [ ] **Allergen cross-reference:** Warning shows on recipe card — but verify it also shows when a recipe is added to a meal plan (two separate display paths)
- [ ] **Codex content accuracy:** Crop cards show correct task counts — but verify stats are read from `CROP_CATALOG.tasksPerStage` not hardcoded; run a balance-pass simulation (change `tasksPerStage` in the constant, confirm codex display updates without code change)
- [ ] **Tutorial "first launch":** Tutorial shows on fresh install — but verify it does NOT show when the profile already has crops planted (user has clearly used the farm before even if seen-flag is missing due to reinstall)
- [ ] **Tutorial skip/replay:** Skip button works from step 1 — but verify "Revoir le tutoriel" from codex correctly resets only the farm tutorial, not all HelpContext coach marks
- [ ] **Theme compliance:** All new components use `useThemeColors()` — run in all 9 profile themes and dark mode; look especially at tutorial spotlight overlay (dark background may be invisible in dark mode if color is hardcoded)
- [ ] **Privacy compliance:** Dietary preferences visible in commit diffs / log files — ensure no real family member names appear in fixture data, migration scripts, or debug logs added during development

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Allergen silencing shipped to TestFlight | HIGH — user safety | Emergency update: force-show allergen warning unconditionally; remove dismiss logic; republish to TestFlight same day |
| Codex content drifted from engine | LOW — content bug | One-pass audit: grep for hardcoded numbers in codex component, replace with engine constant references; test all screens |
| Tutorial seen-flag stored globally (not per-profile) | MEDIUM — requires migration | Add `profiles` sub-key to `help_screens_v1` JSON; migrate existing global keys to a virtual "device" profile; write migration in HelpContext init (same pattern as existing `migrateHelpScreens()`) |
| Dietary data stored as free-text (no canonical IDs) | HIGH — requires vault migration | Must write a one-time migration that maps known string values to canonical allergen IDs; vault files must be updated; risk of data loss for unknown strings |
| Codex data hardcoded (not from engine) | LOW | Refactor codex data source to import from constants; no vault changes needed |
| Tutorial breaks after farm content change | LOW | Validate tutorial step targets at load time; skip broken steps; add dev-mode assertion |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Allergen silencing | Phase 1 — dietary data model | `DietaryConstraintSeverity` type in types.ts; no dismiss logic for `allergie` severity |
| Stale profile in allergen check | Phase 1 — allergen check function | `checkAllergens()` pure function in `lib/dietary.ts` with tests; `useMemo` deps validated |
| i18n allergen mismatch | Phase 1 — `constants/dietary.ts` | `ALLERGEN_CATALOG` with `keywords[]` array; cross-reference test covers FR+EN ingredient names |
| Vault parsing — duplicate profile IDs | Phase 1 — parser extension | Add assertion in `parseProfiles()` that emits `console.warn` on duplicate IDs |
| Codex content drift | Phase 2 — codex architecture | Code review: reject any PR where codex component contains hardcoded numeric stats |
| Codex performance | Phase 2 — codex component | `FlatList` with `windowSize={5}`; measure frame rate with 60+ entries on device |
| Tutorial seen-flag scope | Phase 3 — tutorial design spec | Explicit per-profile vs global decision in phase spec; HelpContext extended before tutorial component |
| Tutorial animation jank | Phase 3 — tutorial overlay | farm pause mechanism in spec; frame rate measured on TestFlight build |
| Tutorial content breaks | Phase 3 — tutorial data model | `TutorialStep.targetId` validated against catalogs at load time; dynamic first crop selection |
| useVault.ts further inflation | Phase 1 — dietary data model | Dietary constraints embedded in Profile type; zero new useState in useVaultInternal |
| Crowded tree.tsx UI | Phase 2 — codex button placement | "?" integrated into existing HUD; no new floating button; no new `useVault()` call |
| HelpProvider vs TutorialProvider | Phase 3 — tutorial architecture | No new Context/Provider created; HelpContext extended only |

---

## Sources

- Direct codebase audit: `hooks/useVault.ts`, `lib/parser.ts`, `lib/mascot/types.ts`, `lib/mascot/farm-engine.ts`, `contexts/HelpContext.tsx`, `lib/types.ts` (2026-04-07)
- `.planning/codebase/CONCERNS.md` — documented tech debt, known fragile areas, performance bottlenecks
- `.planning/codebase/ARCHITECTURE.md` — provider hierarchy, data flow, error handling patterns
- `.planning/STATE.md` — accumulated decisions, quick task history (balance pass evidence)
- Known RN/Expo pitfalls: Reanimated 4 worklet thread model, FlatList vs ScrollView perf, SecureStore reinstall behavior, expo-router modal presentation
- EU allergen regulation context: 14 major allergens defined by EU Regulation 1169/2011 (gluten, crustacés, œufs, poissons, arachides, soja, lait, fruits à coque, céleri, moutarde, graines sésame, anhydride sulfureux, lupin, mollusques)

---

*Pitfalls research for: FamilyFlow v1.2 — dietary preferences, farm codex, farm tutorial*
*Researched: 2026-04-07*
