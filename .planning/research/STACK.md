# Stack Research — v1.2 Confort & Découverte

**Domain:** React Native family app, 3 additive features on existing Expo SDK 54 codebase
**Researched:** 2026-04-07
**Confidence:** HIGH (existing codebase fully read; external libraries verified via npm registry and GitHub issues)

---

## Executive Decision

**Zero new production dependencies required.**

All three features can and should be built using patterns already present in the codebase:
- Preferences alimentaires → existing `famille.md` flat-key-per-profile pattern + new domain hook
- Codex ferme → static TypeScript constants + existing `MarkdownText`, `CollapsibleSection`, `ScrollView`
- Tutoriel ferme → existing `CoachMark` + `ScreenGuide` + `HelpContext` system extended with a sequential modal flow

Adding `react-native-copilot` is explicitly rejected (see below).

---

## Feature 1 — Préférences alimentaires

### Storage Pattern Decision: Per-Profile Flat File (NOT shared H2 file)

The app has two storage patterns for profile data:

1. **Shared H2-per-profile file** — used by Gratitude (`Gratitude familiale.md`), Wishlist (`Souhaits.md`). H2 = date/context, H3 = profile. Good for time-ordered or cross-profile content.
2. **Per-profile flat-key file** — used by Farm (`farm-{profileId}.md`). One file per profile, key: value lines. Good for structured profile-specific state.

**Recommendation: flat-key lines in `famille.md` profile block**, same format as `farm-{profileId}.md`.

Rationale:
- Dietary preferences are per-person, not cross-profile or time-ordered — the wishlist/gratitude H2 pattern adds parsing complexity without benefit
- The `famille.md` parser already reads per-profile blocks (the `Profile` type in `lib/types.ts` already carries per-profile data)
- Adding 5–7 flat keys per profile (`food_allergies`, `food_intolerances`, `food_regime`, `food_aversions`, `food_preferences`, `food_guest_note`) mirrors exactly how `farm_crops`, `farm_tech`, etc. are stored
- Parser changes are minimal: extend `parseProfile` and `serializeProfile` in `lib/parser.ts` to handle the new keys
- Bidirectional Obsidian compatibility is preserved (key: value lines are human-readable in the vault)

The `Profile` interface in `lib/types.ts` gets a new `foodPreferences?: FoodPreferences` field. A new `FoodPreferences` type covers all cases:

```typescript
export interface FoodPreferences {
  allergies: string[];          // EU 14 allergens by ID + free-form
  intolerances: string[];       // lactose, gluten léger, etc.
  regimes: string[];            // vegan, halal, casher, végétarien, sans-gluten
  aversions: string[];          // aliments non appréciés
  preferences: string[];        // aliments aimés
  guestNote?: string;           // note libre pour invités
}
```

### Allergen Tagging — No External Library

The EU 14 mandatory allergens are a fixed list defined in EU Regulation No 1169/2011. This is static reference data that belongs in `constants/allergens.ts` — not a library.

```typescript
// constants/allergens.ts
export const EU_ALLERGENS = [
  { id: 'gluten',       labelFr: 'Gluten (blé, seigle, orge, avoine…)',  emoji: '🌾' },
  { id: 'crustaces',    labelFr: 'Crustacés',                             emoji: '🦐' },
  { id: 'oeufs',        labelFr: 'Œufs',                                  emoji: '🥚' },
  { id: 'poissons',     labelFr: 'Poissons',                              emoji: '🐟' },
  { id: 'arachides',    labelFr: 'Arachides',                             emoji: '🥜' },
  { id: 'soja',         labelFr: 'Soja',                                  emoji: '🫘' },
  { id: 'lait',         labelFr: 'Lait',                                  emoji: '🥛' },
  { id: 'fruits_a_coque', labelFr: 'Fruits à coque',                      emoji: '🌰' },
  { id: 'celeri',       labelFr: 'Céleri',                                emoji: '🥬' },
  { id: 'moutarde',     labelFr: 'Moutarde',                              emoji: '🟡' },
  { id: 'sesame',       labelFr: 'Sésame',                                emoji: '🌱' },
  { id: 'so2',          labelFr: 'Dioxyde de soufre / Sulfites',          emoji: '🍷' },
  { id: 'lupin',        labelFr: 'Lupin',                                 emoji: '🌼' },
  { id: 'mollusques',   labelFr: 'Mollusques',                            emoji: '🦑' },
] as const;
```

Autocomplete/chip selection for these 14 items uses existing `Chip` component from `components/ui/`. No new dep.

For free-form aversions and preferences (open-ended text), use a simple TextInput with comma-separated entry or a `+` button to add tag chips — same pattern as existing tag entry in tasks.

### Recipe Conflict Detection

The conflict flagging logic lives in a new pure function in `lib/food-preferences.ts`:

```typescript
export function checkRecipeConflicts(
  recipe: AppRecipe,
  profiles: Profile[]
): ConflictReport[]
```

It cross-references ingredient text against the profile's allergens/intolerances using `Array.includes` on normalized strings — no fuzzy match needed at this stage (exact allergen IDs). This keeps it zero-dep and deterministic.

**Integration point:** `useRecipesVault` domain hook (already in `useVault.ts`). Add a `getRecipeConflicts(recipeId, profileIds)` selector.

---

## Feature 2 — Codex Ferme

### No New Library Needed

The codex is a **read-only, static, in-app wiki**. Content is extracted from existing engine constants — no CMS, no remote fetch, no markdown file in the vault.

Existing components already cover 100% of the UI needs:

| Need | Existing Solution |
|------|-------------------|
| Sectioned scrollable list | `ScrollView` + `SectionList` or mapped arrays |
| Collapsible categories | `CollapsibleSection` (persists state in SecureStore) |
| Rich text with headers/lists/callouts | `MarkdownText` (full Obsidian markdown, no dep) |
| Searchable list filtering | `Array.filter` on normalized strings (see below) |
| Chip/badge tags for categories | `Chip`, `Badge` from `components/ui/` |
| Modal navigation | expo-router `pageSheet` modal (existing convention) |

The codex content source is a new `constants/farm-codex.ts` file (or `lib/mascot/codex.ts`) that imports directly from the engine files (`CROP_CATALOG`, `CROP_SPRITES`, `SEASONAL_CROP_BONUS`, building configs, tech tree, etc.) and organizes them into a `CodexEntry[]` structure for display. Zero runtime cost since it's fully static.

### Search in Codex — Array.filter, Not Fuse.js

The codex will have ~50–100 entries max (crops, buildings, animals, craft recipes, tech nodes, events). At this scale, `Array.filter` on pre-normalized strings outperforms Fuse.js by having zero initialization cost and no bundle overhead.

Fuse.js (311 KB unpacked, ~8 KB gzip) adds fuzzy matching that is inappropriate here — users search for "tomate" not "tmate". Exact prefix/substring match on normalized French strings is correct and fast.

```typescript
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const filtered = entries.filter(e =>
  normalize(e.name).includes(normalize(query)) ||
  normalize(e.category).includes(normalize(query))
);
```

Note: `lib/search.ts` already implements this exact `normalize` pattern for the global vault search — reuse it.

**Verdict: No new dependency.**

---

## Feature 3 — Tutoriel Ferme

### Existing System vs New Library

The app already has a complete, production-hardened coach mark system:

| Component | Location | Capability |
|-----------|----------|------------|
| `CoachMark` | `components/help/CoachMark.tsx` | Animated bubble (spring Reanimated), arrow above/below, step counter, skip/next |
| `CoachMarkOverlay` | `components/help/CoachMarkOverlay.tsx` | Dark semi-transparent overlay with tap-to-dismiss |
| `ScreenGuide` | `components/help/ScreenGuide.tsx` | Sequential multi-step orchestrator using `ref.measureInWindow()` |
| `HelpContext` | `contexts/HelpContext.tsx` | `hasSeenScreen`/`markScreenSeen`/`resetScreen` persisted in SecureStore |

`ScreenGuide` already supports: auto-start on first view, skip-all, step progression, replay via `resetScreen(screenId)`.

### Gap Analysis — What the Existing System Cannot Do

The farm tutorial has requirements beyond what `ScreenGuide` currently handles:

1. **Immersive modal wrapper** — The tutorial should feel like a dedicated experience with a farm background visual, not just floating bubbles over a live screen. This requires a full-screen modal step (first step = intro slide, then coach marks).
2. **Replay from Codex** — The codex "?" button must trigger the tutorial. This is just `resetScreen('farm-tutorial')` + `router.navigate('/tree')` — no new API needed.
3. **Farm-specific highlight shapes** — The existing `CoachMarkOverlay` uses a simple full-screen dim. For the farm, highlighting a specific crop plot or building slot requires a "cutout" overlay. This is buildable with pure Reanimated using a View with a transparent hole (achieved via `react-native-svg` path — already installed — or via nested Views with absolute positioning).

### Why react-native-copilot is Rejected

**MEDIUM confidence — verified via GitHub issues tracker (Feb 2026 issue #351):**

- Issue #332 (Nov 2024): "Not support New Arch on RN 0.76" — FamilyFlow uses new architecture (RN 0.81)
- Issue #351 (Feb 2026): "Scrolling broken on iOS/Android, positioning off on Android" — specifically in Expo 54
- Issue #350 (Jan 2026): "Start function fails to activate walkthrough steps"
- 101 open issues total; positioning and scroll bugs are the dominant theme

The app already has a working, in-production coach mark system. Introducing a problematic dependency to replace it is unjustifiable.

**react-native-walkthrough-tooltip** (v1.6.0, last published Jan 2024): abandoned, no maintenance, not worth evaluating.

### Recommended Approach: Extend Existing System

Build `FarmTutorial` as a new component in `components/help/` that:

1. Uses `HelpContext.resetScreen` + a `'farm-tutorial'` screen ID for replay state
2. Renders a full-screen intro modal (step 0: animated slide with farm illustration + "Commencer" button) using existing `pageSheet` or a `Modal` with `transparent` background
3. Steps 1–N: reuse `CoachMark` + `CoachMarkOverlay`, pointing at farm UI elements via `ref.measureInWindow()` — identical to `ScreenGuide`
4. For plot/building spotlight cutouts: use `react-native-svg` (already installed, `^15.12.1`) to draw a masked overlay with a rectangular or circular hole over the target area

The SVG cutout is the only new pattern — but `react-native-svg` is already a dependency. A `<Mask>` + `<Rect>` with a hole is ~20 lines of SVG code.

**Integration with Codex:** The "?" button on the farm screen calls:
```typescript
helpContext.resetScreen('farm-tutorial');
router.push('/tree'); // farm is on the tree screen
```

No new hook, no new context.

---

## Final Dependency Summary

| Feature | New Dependency | Rationale |
|---------|---------------|-----------|
| Préférences alimentaires | None | Extends existing profile parser + vault pattern |
| EU 14 allergens | None | Static constant in `constants/allergens.ts` |
| Codex ferme | None | Static TS constants + existing UI components |
| Codex search | None | `Array.filter` — dataset too small for Fuse.js |
| Tutoriel ferme | None | Extends existing `CoachMark`/`ScreenGuide`/`HelpContext` |
| SVG spotlight cutout | None (already installed) | `react-native-svg ^15.12.1` already a dep |

**npm install command: none required.**

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-native-copilot` | New arch broken (RN 0.81), Expo 54 scroll/position bugs confirmed Feb 2026, 101 open issues | Existing `ScreenGuide` + `CoachMark` |
| `react-native-walkthrough-tooltip` | Abandoned Jan 2024, no maintenance | Existing `CoachMark` |
| `fuse.js` | 311 KB unpacked, fuzzy search wrong for exact allergen/codex lookup, codex has <100 entries | `Array.filter` with accent normalization |
| Any allergen npm package | All are web-focused, overkill for a 14-item static list | `constants/allergens.ts` |
| `react-native-markdown-display` | Already have custom `MarkdownText` with Obsidian callouts | `MarkdownText` from `components/ui/` |

---

## Integration Points with Existing Architecture

| New Code | Integration Point | Pattern to Follow |
|----------|-----------------|-------------------|
| `FoodPreferences` type | `lib/types.ts` → extend `Profile` | Same as `farmCrops`, `farmTech` |
| `parseProfile` / `serializeProfile` | `lib/parser.ts` → extend existing | Same as `parseFarmProfile` key: value lines |
| `useFoodPreferences` actions | `hooks/useVault.ts` → new domain section | Same as `useWishlistVault`, `useMealsVault` |
| `constants/allergens.ts` | New file, imported by UI components | Same as `constants/stock.ts` |
| `lib/food-preferences.ts` | Pure function, imported by domain hook | Same as `lib/insights.ts` |
| `FarmTutorial` component | `components/help/FarmTutorial.tsx` | Extends `ScreenGuide` pattern |
| Farm codex screen | `app/(tabs)/farm-codex.tsx` (hidden screen) | Same as `app/(tabs)/notes.tsx` |
| `constants/farm-codex.ts` | Imports from `lib/mascot/*.ts` to build `CodexEntry[]` | Same as `constants/defiTemplates.ts` |

---

## Version Compatibility

All proposed work uses existing stack only:

| Package | Current Version | Role in New Features |
|---------|----------------|---------------------|
| `react-native-reanimated` | ~4.1.1 | Animations in `FarmTutorial` intro slide |
| `react-native-svg` | ^15.12.1 | SVG spotlight cutout overlay (already installed) |
| `expo-secure-store` | ~15.0.8 | Tutorial seen/unseen state via `HelpContext` |
| `gray-matter` | ^4.0.3 | `famille.md` frontmatter already parsed |
| `i18next` | ^25.10.2 | All new UI strings in `locales/fr/common.json` |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Storage pattern (preferences) | HIGH | `lib/parser.ts` and `lib/types.ts` read directly |
| EU 14 allergens as static constant | HIGH | EU Regulation 1169/2011 is a fixed list |
| Codex as static TS constants | HIGH | Farm engine source read, catalog structure confirmed |
| Array.filter for codex search | HIGH | Dataset size confirmed (<100 entries), `lib/search.ts` pattern confirmed |
| Existing coach mark system sufficiency | HIGH | All 4 components read in full; `HelpContext` API confirmed |
| react-native-copilot rejection | MEDIUM-HIGH | GitHub issues verified (issue #351 Expo 54, issue #332 new arch) |
| SVG spotlight via existing react-native-svg | MEDIUM | Pattern is documented but not yet present in codebase — implementable but requires care with Reanimated 4 worklet thread |

---

## Sources

- `/Users/gabrielwaltio/Documents/family-vault/components/help/CoachMark.tsx` — existing coach mark implementation confirmed
- `/Users/gabrielwaltio/Documents/family-vault/components/help/ScreenGuide.tsx` — multi-step orchestrator confirmed
- `/Users/gabrielwaltio/Documents/family-vault/contexts/HelpContext.tsx` — SecureStore persistence and replay API confirmed
- `/Users/gabrielwaltio/Documents/family-vault/lib/parser.ts` — gratitude/wishlist H2 pattern vs farm flat-key pattern both read
- `/Users/gabrielwaltio/Documents/family-vault/lib/types.ts` — `Profile` interface read, farm fields pattern confirmed
- `/Users/gabrielwaltio/Documents/family-vault/lib/search.ts` — accent normalization pattern confirmed (`normalize()`)
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/farm-engine.ts` — CROP_CATALOG, golden crop, seasonal bonus constants confirmed
- npm registry — `react-native-copilot@3.3.3` peer deps: `react-native >=0.60.0`, `react-native-svg >=9.0.0`
- npm registry — `react-native-walkthrough-tooltip@1.6.0` last published 2024-01-09 (abandoned)
- npm registry — `fuse.js@7.3.0` unpacked size 311,620 bytes, last updated 2026-04-04
- GitHub Issues (verified via WebFetch) — `mohebifar/react-native-copilot` issue #332 new arch broken, issue #351 Expo 54 scroll/position broken Feb 2026, 101 open issues total
- [EU 14 allergens — EUFIC](https://www.eufic.org/en/healthy-living/article/list-of-the-14-most-common-food-allergens) — fixed regulatory list, HIGH confidence

---
*Stack research for: FamilyFlow v1.2 Confort & Découverte*
*Researched: 2026-04-07*
