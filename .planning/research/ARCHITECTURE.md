# Architecture Research — v1.2 Confort & Découverte

**Domain:** Integration of 3 features into existing React Native / Expo family app
**Researched:** 2026-04-07
**Confidence:** HIGH — based on direct codebase inspection

---

## 1. Dietary Preferences Storage

### Decision: Option (b) — Shared file `05 - Famille/Préférences alimentaires.md` with H2 per person

**Rationale:**

Option (a) — extending `famille.md` — is rejected. `famille.md` is parsed by `parseFamille()` using a simple `key: value` line format under `### profileId` H3 sections. Adding a multi-value structured block (allergies, intolerances, diets) would require either restructuring the parser significantly or embedding a CSV string. The file also has no frontmatter and is already the source of truth for identity; coupling preference data to it increases blast radius on a critical parse path.

Option (c) — one file per person — creates N files where N = family size + guests. The vault already has patterns for both single-file-per-domain (Souhaits.md, Humeurs.md) and single-file-per-profile (gami-{id}.md for gamification, farm-{id}.md for farm state). The per-profile pattern is reserved for large, profile-specific engine state. Preferences are lightweight structured data shared across a meal-planning context — the shared file model fits better.

Option (b) mirrors exactly how `05 - Famille/Souhaits.md` works: YAML frontmatter header, H2 section per person name, items underneath. The wishlist parser (`parseWishlist` in `lib/parser.ts:1467`) is the proven template.

**Vault path:**
```
05 - Famille/Préférences alimentaires.md
```
Export constant in `lib/parser.ts`:
```typescript
export const PREFERENCES_FILE = '05 - Famille/Préférences alimentaires.md';
```

### File Format

```markdown
---
tags:
  - préférences
---

# Préférences alimentaires

## Papa
- allergie: arachides
- allergie: fruits de mer
- intolérance: lactose
- régime: sans gluten
- aversion: champignons

## Maman
- régime: végétarienne
- aversion: olives

## Invités
- invité: Grand-mère | allergie: noix
- invité: Oncle Julien | aversion: poissons
```

**Categories:** `allergie` (severity: anaphylactic risk), `intolérance` (digestive), `régime` (vegetarian, vegan, etc.), `aversion` (preference, not medical).

### Guest Profiles

Guests do NOT have a section named after a profile in `famille.md`. They are handled with a dedicated `## Invités` section at the bottom of the file. Each line uses `invité: Name | constraint: value` format. The parser distinguishes guests by:
1. Parsing all `## X` H2 headings first
2. When heading is `Invités`, switching to guest parsing mode where each line is `invité: Name | type: value`
3. Assembling guests as `{ profileName: string, isGuest: true, constraints: DietaryConstraint[] }`

This means guests do not need a profile in `famille.md` and can be created ad-hoc at meal-planning time. The same file holds both family members and guests; no `Préférences invités.md` split needed.

### TypeScript Types (add to `lib/types.ts`)

```typescript
export type DietaryConstraintType = 'allergie' | 'intolérance' | 'régime' | 'aversion';

export interface DietaryConstraint {
  type: DietaryConstraintType;
  value: string;          // e.g., "arachides", "végétarienne"
}

export interface DietaryProfile {
  profileName: string;    // matches Profile.name (family) or guest display name
  isGuest: boolean;
  constraints: DietaryConstraint[];
}
```

---

## 2. The `usePreferences` Hook Contract

### Location and Integration Pattern

Following the established split-hook pattern (`useVaultWishlist.ts`, `useVaultFamilyQuests.ts`, `useVaultProfiles.ts`):

**New file:** `hooks/useVaultPreferences.ts`

This hook is called by `useVaultInternal()` inside `hooks/useVault.ts`, receiving `vaultRef` as its only dependency (same as `useVaultWishlist`).

It is exposed via `VaultState` in `useVault.ts`, then accessed by screens via `useVault()`.

### State Shape

```typescript
export interface UseVaultPreferencesResult {
  // State
  dietaryProfiles: DietaryProfile[];
  setDietaryProfiles: (profiles: DietaryProfile[]) => void;

  // Read actions
  getPreferencesForProfile: (profileName: string) => DietaryProfile | undefined;
  getCombinedConstraints: (profileNames: string[]) => DietaryConstraint[];

  // Write actions
  addConstraint: (profileName: string, isGuest: boolean, constraint: DietaryConstraint) => Promise<void>;
  updateConstraint: (profileName: string, oldConstraint: DietaryConstraint, newConstraint: DietaryConstraint) => Promise<void>;
  removeConstraint: (profileName: string, constraint: DietaryConstraint) => Promise<void>;
  upsertGuestProfile: (guestName: string) => Promise<void>;
  removeGuestProfile: (guestName: string) => Promise<void>;

  // Housekeeping
  resetPreferences: () => void;
}
```

**`getCombinedConstraints`** is the key utility for the meal planner. It takes `string[]` of profile names (family + guests present at a meal) and returns the merged deduplicated list of constraints. Allergies always surface first, sorted by severity (`allergie > intolérance > régime > aversion`).

### Integration into `useVaultInternal()`

In `hooks/useVault.ts`, at the domain hook declarations section (around line 95–101 where other domain hooks are imported):

```typescript
import { useVaultPreferences } from './useVaultPreferences';
// ...
const preferencesHook = useVaultPreferences(vaultRef);
```

Then spread into the return object of `useVaultInternal()` and into the `VaultState` interface.

### Load Pattern

During `loadVault()` inside `useVaultInternal()`, read and parse the preferences file (same pattern as wishlist):

```typescript
try {
  const prefsContent = await vaultRef.current.readFile(PREFERENCES_FILE);
  preferencesHook.setDietaryProfiles(parsePreferences(prefsContent));
} catch (e) {
  if (!isFileNotFound(e)) warnUnexpected('loadVault/preferences', e);
  preferencesHook.resetPreferences();
}
```

---

## 3. Recipe/Meal Flagging Integration

### Where the Check Happens

**At display time, computed in a `useMemo` inside the component.** Not pre-computed in the hook.

Rationale: Pre-computing conflicts in the hook would require the preferences hook to know about recipes (a different domain). That cross-domain dependency creates tight coupling. The hook exposes `getCombinedConstraints(profileNames)` as a pure computation function; the UI layer calls it and does the intersection with recipe ingredients. This is the pattern used for other derived UI state in this codebase (no selector layer, derived state lives close to the component that needs it).

### Integration Points

**Recipe display (meal planner — `app/(tabs)/meals.tsx`):**

The current `MealItem` type has no `convives` field. The meal planning screen (`meals.tsx`, 112KB) currently does not track who is eating a specific meal. To surface conflicts, a light extension is needed:

1. Add `convives?: string[]` to `MealItem` in `lib/types.ts` — the list of profile names (family + guests) attending this meal. Empty means "whole family".
2. The meals parser (`parseMeals` / `serializeMeals` in `lib/parser.ts`) gets a `convives:` inline marker, or the existing pipe-delimited format gets a new field.
3. In the meal card UI (inside `meals.tsx`), when a recipe is linked (`recipeRef` is set), run:

```typescript
const constraints = getCombinedConstraints(meal.convives ?? allFamilyNames);
const conflicts = computeRecipeConflicts(recipe.ingredients, constraints);
// show badge if conflicts.length > 0
```

**Recipe detail modal:**

When the user opens a recipe (pageSheet modal in `meals.tsx:1537` area), show a "Conflits pour ce repas" section listing constraints triggered by the ingredients. This is display-only — no data is written.

**Where to implement `computeRecipeConflicts`:**

Create `lib/dietary-utils.ts` — pure function, no React. Signature:
```typescript
export function computeRecipeConflicts(
  ingredients: string[],  // from cooklang parsed recipe
  constraints: DietaryConstraint[]
): Array<{ constraint: DietaryConstraint; matchedIngredient: string }>
```

Matching is fuzzy text search (normalize to lowercase, check if ingredient contains constraint value). This is intentionally naive for v1 — no allergen database. Flag severity by constraint type.

**Meal planning picker (when adding convives to a meal):**

The picker UI (new, does not exist yet) lets the user select who is attending dinner. As profile checkboxes are toggled, `getCombinedConstraints` updates a live warning banner showing active restrictions. This is computed entirely in the component with `useMemo`.

---

## 4. Codex Content Extraction

### Decision: Option (a) — Hard-coded in `lib/codex/content.ts`

**Rejected: Option (b) — dynamic extraction at runtime.**

The farm engines (`lib/mascot/types.ts`, `lib/mascot/tech-engine.ts`, `lib/mascot/craft-engine.ts`, `lib/mascot/farm-engine.ts`) hold the source of truth as TypeScript constants (`CROP_CATALOG`, `BUILDING_CATALOG`, `TECH_TREE`, `CRAFT_RECIPES`). These are already importable. However, the codex needs human-readable prose: tips, unlock conditions explained in plain language, mechanic explanations. The engine constants are machine-readable data with `labelKey` i18n references — they are not self-documenting for an end-user wiki.

**Rejected: Option (c) — build-time generation script.**

Adds build complexity (another script to maintain), and the output is equivalent to option (a) but with an indirection layer. The content is small (< 5KB) and static.

**Chosen: Option (a) — static `lib/codex/content.ts`.**

The codex file imports engine constants to derive numeric facts (costs, rewards, cycle counts) and adds explanatory text around them. This is a thin authoring layer on top of the engines, not a duplication.

### Content Structure

**New file:** `lib/codex/content.ts`

```typescript
import { CROP_CATALOG } from '../mascot/types';
import { BUILDING_CATALOG } from '../mascot/types';
import { TECH_TREE } from '../mascot/tech-engine';
import { CRAFT_RECIPES } from '../mascot/types';

export interface CodexEntry {
  id: string;
  category: 'cultures' | 'bâtiments' | 'artisanat' | 'technologies' | 'sagas' | 'mécanique';
  title: string;
  emoji: string;
  summary: string;        // 1-2 sentence plain-language description
  details: string[];      // bullet-style facts (derived from engine constants)
  unlockCondition?: string;
}

export const CODEX_ENTRIES: CodexEntry[] = [
  // Generated from CROP_CATALOG with added prose
  ...CROP_CATALOG.map(crop => ({
    id: `crop_${crop.id}`,
    category: 'cultures' as const,
    title: crop.emoji + ' ' + crop.id, // i18n lookup happens at display time
    emoji: crop.emoji,
    summary: '...',
    details: [
      `${crop.tasksPerStage} tâche(s) par stade — ${crop.tasksPerStage * 4} tâches pour récolter`,
      `Récompense : ${crop.harvestReward} 🍃`,
      crop.dropOnly ? 'Obtenue uniquement par drop rare à la récolte' : `Coût : ${crop.cost} 🍃`,
    ],
    unlockCondition: crop.minTreeStage,
  })),
  // Buildings, tech nodes, craft recipes follow the same pattern
];
```

### Source of Truth per Content Category

| Codex Category | Source File | Key Export |
|----------------|-------------|------------|
| Cultures | `lib/mascot/types.ts` | `CROP_CATALOG: CropDefinition[]` |
| Bâtiments | `lib/mascot/types.ts` | `BUILDING_CATALOG: BuildingDefinition[]` |
| Technologies | `lib/mascot/tech-engine.ts` | `TECH_TREE: TechNode[]` |
| Artisanat | `lib/mascot/types.ts` (CraftRecipe array, exported from craft-engine) | `CRAFT_RECIPES` |
| Sagas | `lib/mascot/sagas-content.ts` | prose, no structured constant — hand-written codex entry |
| Mécaniques générales | No engine constant — fully hand-written prose in `lib/codex/content.ts` |

---

## 5. Codex UI Placement

### The "?" Button on `app/(tabs)/tree.tsx`

**Button placement:** Add a `TouchableOpacity` in the farm screen header area (top-right corner, near the existing action buttons). Icon: `?` or `📖`. This follows the pattern of `showBuildingDetail`, `showCraftSheet`, etc. — a boolean state flag triggers a modal.

```typescript
// In tree.tsx state declarations (around line 353)
const [showCodex, setShowCodex] = useState(false);
```

### Modal Presentation Pattern

Based on `BuildingDetailSheet.tsx` (line 92–104) and the farm seed picker modal (`tree.tsx:1430`), the established pattern is:

```tsx
<Modal
  visible={showCodex}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setShowCodex(false)}
>
  <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
    <ModalHeader title="Codex de la ferme" onClose={() => setShowCodex(false)} />
    <CodexScreen />
  </SafeAreaView>
</Modal>
```

**New component:** `components/mascot/FarmCodexModal.tsx`

This is a self-contained ScrollView with:
- Tab bar at top: Cultures / Bâtiments / Tech / Artisanat / Mécaniques
- Entry list with search
- Tap on entry → drill-down detail view (inline, not a nested modal)
- "Rejouer le tutoriel" button at the bottom of the Mécaniques tab

The `ModalHeader` component from `components/ui/` already exists and is the standard header for all pageSheet modals.

---

## 6. Tutorial Integration

### When Does It Fire?

**Trigger on first farm screen visit, not in setup.tsx.**

The setup onboarding (`app/setup.tsx`) is a 4-step wizard that creates the vault and profiles. Injecting a farm tutorial there would be premature — the user has no farm state yet and no context for the tutorial to be meaningful. The tutorial must fire when the user first enters `tree.tsx` and the farm tab is actually visible.

The existing pattern in `tree.tsx` already handles this:
```typescript
const showFarmHint = helpLoaded && !hasSeenScreen('farm');  // line 293
```
This one-shot banner is dismissed by calling `markScreenSeen('farm')`. The tutorial is the expanded version of this mechanism.

**Screen ID for the tutorial:** `'farm_tutorial'` — a new key in the `HelpContext` `seenScreens` map.

### Persistence

**Use the existing `HelpContext` / `HelpProvider` — do NOT create a new context.**

`HelpContext` already provides exactly the right API:
- `hasSeenScreen(screenId: string): boolean` — synchronous check
- `markScreenSeen(screenId: string): Promise<void>` — persists to SecureStore JSON blob at `help_screens_v1`
- `resetScreen(screenId: string): Promise<void>` — allows "replay" from settings

The tutorial is simply a new screen ID in the existing system. No new SecureStore key, no profile flag in `famille.md`.

```typescript
// In tree.tsx
const { hasSeenScreen, markScreenSeen, isLoaded: helpLoaded } = useHelp();
const showFarmTutorial = helpLoaded && !hasSeenScreen('farm_tutorial');

// After tutorial completes or is dismissed:
await markScreenSeen('farm_tutorial');
```

**Replay trigger:** Add a "Rejouer le tutoriel" button in the Codex modal's Mécaniques section, which calls `resetScreen('farm_tutorial')`. On next tree screen focus, the tutorial fires again.

### Tutorial Architecture

**New component:** `components/mascot/FarmTutorialOverlay.tsx`

Renders as an absolute-position overlay on top of the farm view (not a Modal, to allow the farm to be visible in the background during the tutorial steps). Uses `react-native-reanimated` for step transitions (`FadeInDown`, `withSpring`).

Steps are an array of `TutorialStep` objects:
```typescript
interface TutorialStep {
  id: string;
  targetArea?: 'crops' | 'buildings' | 'tech' | 'craft' | 'quests';
  title: string;
  description: string;
  ctaLabel: string;
}
```

The tutorial reuses content from `lib/codex/content.ts` entries (category: `'mécanique'`) to avoid duplicating explanatory text. This is the dependency that makes tutorial depend on codex content extraction.

**HelpContext does NOT need to be modified.** It already supports arbitrary string screen IDs.

---

## 7. Component and File Map

### New Files

| File | Purpose |
|------|---------|
| `lib/types.ts` | Add `DietaryConstraint`, `DietaryProfile` types |
| `lib/parser.ts` | Add `PREFERENCES_FILE`, `parsePreferences`, `serializePreferences` |
| `lib/dietary-utils.ts` | Pure `computeRecipeConflicts()` function |
| `lib/codex/content.ts` | `CODEX_ENTRIES: CodexEntry[]` — static content with engine-derived facts |
| `lib/codex/index.ts` | Barrel export |
| `hooks/useVaultPreferences.ts` | Domain hook — preferences CRUD |
| `components/mascot/FarmCodexModal.tsx` | Codex modal UI (tabs + search + drill-down) |
| `components/mascot/FarmTutorialOverlay.tsx` | Tutorial overlay component |

### Modified Files

| File | Change |
|------|--------|
| `hooks/useVault.ts` | Import and wire `useVaultPreferences`; expose in `VaultState` |
| `lib/types.ts` | Add `DietaryConstraint`, `DietaryProfile`; add `convives?: string[]` to `MealItem` |
| `lib/parser.ts` | Add `parsePreferences` / `serializePreferences` pair; add `convives` parsing to `parseMeals` |
| `app/(tabs)/tree.tsx` | Add `showCodex` state; add `?` button; render `FarmCodexModal`; render `FarmTutorialOverlay` |
| `app/(tabs)/meals.tsx` | Add conflict badge to meal cards; add convives picker; show conflicts in recipe detail |

---

## 8. Build Order and Dependency Chain

```
Phase 1 — Dietary Preferences (self-contained, no deps on other v1.2 features)
  ├── lib/types.ts → add DietaryConstraint, DietaryProfile
  ├── lib/parser.ts → parsePreferences, serializePreferences, PREFERENCES_FILE
  ├── lib/dietary-utils.ts → computeRecipeConflicts()
  ├── hooks/useVaultPreferences.ts → domain hook
  ├── hooks/useVault.ts → wire hook into VaultState
  └── app/(tabs)/meals.tsx → preferences management UI + conflict display

Phase 2 — Codex Content Extraction (prerequisite for tutorial)
  ├── lib/codex/content.ts → CODEX_ENTRIES (imports from existing engine constants)
  └── lib/codex/index.ts → barrel

Phase 3 — Codex UI (depends on Phase 2 content)
  ├── components/mascot/FarmCodexModal.tsx → UI component
  └── app/(tabs)/tree.tsx → add ? button, render modal

Phase 4 — Tutorial (depends on Phase 2 content for text reuse; depends on Phase 3 for replay button)
  ├── components/mascot/FarmTutorialOverlay.tsx → overlay component
  └── app/(tabs)/tree.tsx → add tutorial trigger using existing HelpContext
```

**Rationale for this order:**

- Preferences is independent — it can ship and be used daily before codex or tutorial exist.
- Codex content (Phase 2) is a pure data file — it can be written once and iterated on without touching UI. Separating it from the UI (Phase 3) means the content can be reviewed and corrected without re-testing the modal.
- Tutorial must come after codex content (reuses the `mécanique` entries for step descriptions) and after the codex modal (needs the replay button in the Mécaniques tab). Doing tutorial last avoids the overlay being tested before the content it explains exists.

---

## Data Flow Diagrams

### Dietary Preferences Read Flow

```
app startup
  → loadVault() in useVaultInternal()
  → vaultRef.readFile('05 - Famille/Préférences alimentaires.md')
  → parsePreferences(content) → DietaryProfile[]
  → preferencesHook.setDietaryProfiles(profiles)
  → VaultContext exposes dietaryProfiles

meals.tsx render
  → useVault() → { dietaryProfiles, getCombinedConstraints }
  → for each MealItem with convives:
      constraints = getCombinedConstraints(meal.convives)
      conflicts = computeRecipeConflicts(recipe.ingredients, constraints)
      → render conflict badge if conflicts.length > 0
```

### Codex Open Flow

```
user taps ? button on tree.tsx
  → setShowCodex(true)
  → FarmCodexModal renders (pageSheet)
  → reads CODEX_ENTRIES (static import, no vault I/O)
  → renders tabs + entries (no network, no async)
```

### Tutorial First-Launch Flow

```
user navigates to tree.tsx for the first time
  → useHelp().isLoaded === true
  → hasSeenScreen('farm_tutorial') === false
  → FarmTutorialOverlay renders (absolute overlay, not Modal)
  → user completes steps OR taps skip
  → markScreenSeen('farm_tutorial')
  → overlay unmounts

user taps "Rejouer le tutoriel" in FarmCodexModal
  → resetScreen('farm_tutorial')
  → user navigates back to tree.tsx
  → hasSeenScreen('farm_tutorial') === false again
  → tutorial fires
```

---

## Pitfalls to Avoid at Execution Time

1. **`famille.md` profile names vs preference file names:** `parsePreferences` must match by `Profile.name` (display name, e.g., "Papa"), not by `Profile.id` (snake_case, e.g., "papa"). The wishlist parser uses `profileName` the same way — this is consistent but fragile if names are changed. Document this coupling explicitly in the parser comment.

2. **`MealItem.convives` migration:** Adding a new optional field to `MealItem` and `parseMeals` is additive (existing meals parse without `convives`, defaulting to `undefined`). The serialize side must only write the `convives` field if it is non-empty to preserve Obsidian readability.

3. **Tutorial overlay z-index on tree.tsx:** `tree.tsx` uses `zIndex: 25` for the existing `FarmHintBanner` (line 257). The tutorial overlay must use `zIndex: 30` or higher to render above all farm elements.

4. **HelpContext `SCREEN_IDS` const:** The `SCREEN_IDS` array in `HelpContext.tsx` (line 21–24) is typed with `as const` and used only for legacy migration cleanup. Adding `'farm_tutorial'` to it is optional (it is not iterated for the main functionality), but should be added for completeness and future migration safety.

5. **Codex `labelKey` resolution:** `CROP_CATALOG` entries use `labelKey: 'farm.crop.carrot'` for i18n. The codex display must call `t(entry.labelKey)` at render time, not at `lib/codex/content.ts` build time (no React in lib layer).

---

*Architecture analysis: 2026-04-07*
*Based on direct inspection of: hooks/useVault.ts, hooks/useVaultWishlist.ts, hooks/useVaultFamilyQuests.ts, hooks/useVaultProfiles.ts, lib/parser.ts, lib/types.ts, lib/mascot/types.ts, lib/mascot/tech-engine.ts, lib/mascot/farm-engine.ts, contexts/HelpContext.tsx, app/(tabs)/tree.tsx, components/mascot/BuildingDetailSheet.tsx*
