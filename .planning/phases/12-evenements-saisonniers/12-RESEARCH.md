# Phase 13: Événements Saisonniers - Research

**Researched:** 2026-04-03
**Domain:** Seasonal visitor events — calendar-triggered interactive visitors reusing the saga pattern
**Confidence:** HIGH

## Summary

Phase 13 adds calendar-triggered "visitor events" to the tree/farm scene. When a seasonal event is active (Easter, Halloween, Christmas, etc.), a themed pixel visitor appears in the diorama — the user taps it, gets a short dialogue with 2-3 choices, and receives a guaranteed loot reward from the seasonal pool. The architecture reuses Phase 11 saga infrastructure (VisitorSlot, SagaWorldEvent) almost entirely, adding a thin new engine layer for seasonal event state.

The key distinction from sagas: (1) triggering is calendar-based via existing `getActiveEvent()` — no rotation/rest-day logic needed; (2) completion is tracked per profile per event-year (not per saga cycle); (3) rewards are guaranteed draws from the `SeasonalEvent.rewards` pool rather than the 20% chance of `trySeasonalDraw()`.

The work splits cleanly into four areas: engine/types for the new event system, storage (SecureStore following the sagas-storage.ts pattern), UI adaptation (VisitorSlot + SagaWorldEvent already handle the visual flow — minimal changes needed), and i18n content for each of the 8 events.

**Primary recommendation:** Create `lib/mascot/seasonal-events-engine.ts`, `lib/mascot/seasonal-events-storage.ts`, `lib/mascot/seasonal-events-content.ts`, and `lib/mascot/seasonal-events-types.ts` following the exact structure of the sagas subsystem. Reuse `VisitorSlot` and `SagaWorldEvent` by passing an `eventId` as the `sagaId`-equivalent. Wire into `tree.tsx` as a second visitor layer with non-conflicting position.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pattern d'interaction**
- D-01: Réutiliser exactement le pattern saga immersive (Phase 11) — VisitorSlot pour l'animation d'arrivée, SagaWorldEvent pour le dialogue, même flow tap → dialogue → choix → récompense
- D-02: Pas de bandeau dashboard, pas d'indicateur texte — l'utilisateur découvre le visiteur en allant sur l'écran arbre/ferme naturellement
- D-03: Un seul chapitre par événement (pas multi-chapitres comme les sagas) — l'interaction est courte et directe

**Visiteur et sprites**
- D-04: Chaque événement a son propre personnage visiteur pixel (lapin de Pâques, fantôme Halloween, Père Noël, etc.)
- D-05: Les sprites seront faits APRÈS le code — utiliser des placeholders au début, les sprites réels seront générés via PixelLab plus tard
- D-06: Animations identiques aux sagas : arrivée, idle, réaction aux choix (joie/surprise), départ

**Déclenchement et cycle**
- D-07: Utiliser les dates déjà définies dans `SEASONAL_EVENTS` de `seasonal-rewards.ts` — les 8 événements existants
- D-08: Le visiteur apparaît UNE FOIS par événement par profil — une fois l'interaction faite, il disparaît jusqu'au prochain événement
- D-09: Le visiteur réapparaît chaque jour pendant la période de l'événement si l'utilisateur n'a pas encore interagi (pas de pression)
- D-10: Pas de conflit avec les sagas — si une saga ET un événement sont actifs, les deux visiteurs peuvent coexister (positions différentes)

**Récompenses**
- D-11: Compléter le dialogue donne une récompense GARANTIE du pool saisonnier (pas le 20% aléatoire de `trySeasonalDraw()`)
- D-12: Bonus XP thématique en plus de la récompense loot (comme les sagas donnent XP + item)
- D-13: Les choix dans le dialogue influencent la rareté/type de récompense

**Contenu narratif**
- D-14: Chaque événement a 2-3 choix dans son dialogue
- D-15: Le texte est thématique et court — ambiance festive, pas de récit épique
- D-16: Tout le contenu textuel passe par i18n (fr/en)

### Claude's Discretion
- Structure des fichiers engine/types — le développeur choisit comment organiser le code (nouveau fichier vs extension de seasonal.ts)
- Position exacte du visiteur événementiel dans la scène (éviter collision avec visiteur saga)
- Mécanisme de fallback si aucun sprite n'est encore disponible pour un événement

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVT-01 | Quand un événement saisonnier est actif, un personnage visiteur thématique pixel apparaît dans la scène arbre avec animation d'arrivée | `getActiveEvent()` already works; `VisitorSlot` already handles the animation; need `seasonal-events-engine.ts` to detect active event + unmet completion |
| EVT-02 | Taper sur le visiteur ouvre un dialogue narratif thématique avec choix — même UX que les sagas (VisitorSlot, SagaWorldEvent) | `SagaWorldEvent` can be re-used as-is by adapting a `SagaProgress`-shaped object; one-chapter events need a simplified progress type |
| EVT-03 | Compléter l'interaction donne des récompenses loot box saisonnières garanties (même pool que `trySeasonalDraw()` mais garanti, pas 20% chance) | `SeasonalEvent.rewards` map has pools by rarity; need a `drawGuaranteedSeasonalReward()` function that picks deterministically from the pool weighted by rarity |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-secure-store` | ~15.0.8 | Persist event completion state per profile | Same pattern as `sagas-storage.ts` |
| `react-native-reanimated` | ~4.1.1 | VisitorSlot + SagaWorldEvent animations | Project convention — already used by saga visitor |
| `expo-haptics` | ~15.0.8 | Tactile feedback on visitor tap | Project convention — used in VisitorSlot |
| `i18next` + `react-i18next` | ^25/^16 | All narrative text | D-16 lock |

**No new packages required.** All infrastructure already exists.

---

## Architecture Patterns

### Recommended File Structure
```
lib/mascot/
├── seasonal-events-types.ts      # SeasonalEventProgress, SeasonalEventContent, SeasonalEventChoice
├── seasonal-events-engine.ts     # getActiveEventVisitor(), drawGuaranteedSeasonalReward(), shouldShowEventVisitor()
├── seasonal-events-storage.ts    # loadEventProgress(), saveEventProgress() via SecureStore
└── seasonal-events-content.ts    # SEASONAL_EVENT_DIALOGUES: Record<string, SeasonalEventContent>

components/mascot/
└── (no new component needed — VisitorSlot + SagaWorldEvent reused directly)

locales/fr/gamification.json      # Add mascot.event.* keys
locales/en/gamification.json      # Add mascot.event.* keys

app/(tabs)/tree.tsx               # Add second visitor layer (event visitor) below saga visitor
hooks/useVault.ts                 # Add completeSeasonalEvent() action
```

### Pattern 1: Seasonal Event Progress Type

The saga system uses `SagaProgress` for per-profile state. For events we need a simpler equivalent — one entry per event-year:

```typescript
// Source: modeled on lib/mascot/sagas-types.ts SagaProgress
export interface SeasonalEventProgress {
  eventId: string;       // e.g. 'paques', 'halloween'
  year: number;          // calendar year (avoids re-triggering same event next year's data)
  profileId: string;
  completed: boolean;
  completedAt?: string;  // YYYY-MM-DD
  choiceId?: string;     // which choice was made (for rarity selection)
}
```

**Storage key pattern** (following `sagas-storage.ts`):
```typescript
// Source: modeled on lib/mascot/sagas-storage.ts sagaKey()
function eventKey(profileId: string): string {
  return `seasonal_events_${profileId}`;  // JSON array of SeasonalEventProgress
}
```

### Pattern 2: Guaranteed Seasonal Draw

`trySeasonalDraw()` in `seasonal.ts` returns null 80% of the time. Phase 13 needs a guaranteed version. The choice influences rarity (D-13):

```typescript
// Source: lib/gamification/seasonal-rewards.ts SeasonalEvent.rewards structure
export function drawGuaranteedSeasonalReward(
  event: SeasonalEvent,
  choiceIndex: number, // 0 = commun/rare, 1 = rare/épique, 2 = épique/légendaire
): { reward: RewardDefinition; rarity: LootRarity } {
  // Choice 0 → commun pool, Choice 1 → rare pool, Choice 2 → épique pool
  // Fallback to commun if pool empty
  const rarityByChoice: LootRarity[] = ['commun', 'rare', 'épique'];
  const targetRarity = rarityByChoice[choiceIndex] ?? 'commun';
  const pool = event.rewards[targetRarity] ?? event.rewards['commun'] ?? [];
  const reward = pool[Math.floor(Math.random() * pool.length)];
  return { reward, rarity: targetRarity };
}
```

### Pattern 3: Coexistence With Saga Visitor (D-10)

The saga visitor is positioned at `TARGET_FX=0.72, TARGET_FY=0.62` in `VisitorSlot.tsx`. The event visitor must use a different position. Research of the diorama layout:

- **Saga visitor:** right side at 72% x, 62% y
- **Event visitor (recommended):** left side at ~28% x, 62% y (symmetric left — avoids CompanionSlot which patrols tree at center)

The `VisitorSlot` component accepts `containerWidth` and `containerHeight` — the `TARGET_FX/TARGET_FY` constants are internal to the component. **To place the event visitor at a different position, `VisitorSlot` needs a new optional prop `targetFX`/`targetFY` (or we create a thin wrapper `EventVisitorSlot` that overrides these constants).**

Recommended: add optional `targetFX?: number` and `targetFY?: number` props to `VisitorSlot` with defaults matching current saga behavior — zero behavior change for existing saga use, event visitor passes `targetFX={0.28}`.

### Pattern 4: SagaWorldEvent Adaptation

`SagaWorldEvent` currently reads from a `SagaProgress` object and calls `getSagaById(sagaProgress.sagaId)`. For seasonal events, we need to feed it a structure it can render. Two options:

**Option A (recommended):** Build a `SagaProgress`-shaped adapter object at call site in `tree.tsx`. Map the seasonal event's single chapter into a `Saga` object with one chapter. Keep `SagaWorldEvent` unmodified.

```typescript
// In tree.tsx, when showing event dialogue:
const eventAsSaga: Saga = buildSeasonalEventAsSaga(activeEventContent, eventId);
// Pass as sagaProgress with a fake SagaProgress pointing to chapter 1
```

**Option B:** Add an optional `eventMode` prop to `SagaWorldEvent` that bypasses saga lookup. More invasive.

Option A is preferred — avoids modifying a Phase 11 component already working in production.

### Pattern 5: `buildSeasonalEventAsSaga()` adapter

```typescript
// lib/mascot/seasonal-events-engine.ts
import type { Saga, SagaProgress } from './sagas-types';
import type { SeasonalEventContent } from './seasonal-events-types';
import { createEmptySagaProgress } from './sagas-types';

/** Wraps a seasonal event's single-chapter content as a Saga + SagaProgress
 *  so SagaWorldEvent can render it without modification. */
export function buildSeasonalEventAsSaga(
  content: SeasonalEventContent,
  eventId: string,
  profileId: string,
): { saga: Saga; progress: SagaProgress } {
  const saga: Saga = {
    id: eventId,
    emoji: content.emoji,
    titleKey: content.titleKey,
    descriptionKey: content.titleKey,
    sceneEmoji: content.emoji,
    chapters: [content.chapter],  // single chapter
    finale: {
      variants: {},  // unused for events
      defaultTrait: 'courage',
    },
  };
  const progress = createEmptySagaProgress(eventId, profileId, new Date().toISOString().slice(0, 10));
  return { saga, progress };
}
```

**Caveat:** `SagaWorldEvent` calls `getSagaById(sagaProgress.sagaId)` internally, which looks up `SAGAS` array. Since `eventId` won't be in `SAGAS`, we need to register the seasonal event temporarily — **or** pass `visitorIdleFrame` prop and override the saga lookup.

The cleanest solution: `SagaWorldEvent` should accept an optional `overrideSaga?: Saga` prop that bypasses `getSagaById()`. This is a single-line change:

```typescript
// SagaWorldEvent.tsx line ~106 (verified):
const activeSaga = overrideSaga ?? getSagaById(sagaProgress.sagaId);
```

This is minimal, non-breaking, and makes the component reusable for events.

### Pattern 6: completeSeasonalEvent() in useVault.ts

Modeled on `completeSagaChapter()` (lines 3435-3554 in `hooks/useVault.ts`):
- Add points via `addPoints()`
- Apply seasonal reward (points bonus or active reward) via existing machinery
- No `famille.md` write needed (no mascot item reward — seasonal rewards are experiential/points/badges, not `mascot_deco`/`mascot_hab`)
- Persist event completion in SecureStore via `seasonal-events-storage.ts`

### Anti-Patterns to Avoid

- **Don't modify `seasonal.ts` or `seasonal-rewards.ts`:** These are used by the loot box system. Adding event dialogue content there would mix concerns.
- **Don't create a new UI component:** `VisitorSlot` + `SagaWorldEvent` already handle the full interaction flow. A new component duplicates ~300 lines of animation code.
- **Don't use `completeSagas` in `GamificationData`:** That field tracks saga IDs. Event completions are per-year, so SecureStore per profile is the right store (same as saga progress).
- **Don't put sprite `require()` for event visitors inside `VisitorSlot`:** That component already has a `SAGA_SPRITES` map keyed by saga ID. Add an `EVENT_SPRITES` map following the same shape, OR pass sprite arrays via props. Prefer props to avoid modifying VisitorSlot's internal sprite map with seasonal event IDs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar-based event detection | Custom date comparison | `getActiveEvent()` in `lib/gamification/seasonal.ts` | Already handles Easter dynamic dates, year rollover, 8 events |
| Visitor pixel animation (arrive/idle/react/depart) | New animated component | `VisitorSlot` with `targetFX` override | 500 lines of battle-tested Reanimated code |
| Interactive dialogue with typewriter + choices | New modal/component | `SagaWorldEvent` with `overrideSaga` prop | Already handles all 5 phases (entering/narrative/choices/chosen/cliffhanger) |
| Per-profile persistence | Custom storage | SecureStore via `SecureStoreCompat` | Same as `sagas-storage.ts` |
| Loot reward rendering | Custom reward display | `SagaWorldEvent`'s finale phase | Already has reward card animation |

**Key insight:** Phase 11 built the entire interaction framework. Phase 13 is content + a thin wiring layer.

---

## Common Pitfalls

### Pitfall 1: Year Boundary for "Once Per Event"
**What goes wrong:** User completes Halloween 2026. App stores `{ eventId: 'halloween', completed: true }` without year. Next year (Halloween 2027), event is still marked complete — visitor never appears again.
**Why it happens:** Completion tracking doesn't include year.
**How to avoid:** Store `year: number` in `SeasonalEventProgress` — completion is `eventId + year` composite key.
**Warning signs:** Visitor never reappears after first year.

### Pitfall 2: Two Visitors Same Position
**What goes wrong:** Saga visitor and event visitor render at same `TARGET_FX=0.72, TARGET_FY=0.62` — sprites overlap, both respond to taps.
**Why it happens:** `VisitorSlot` has hardcoded position constants.
**How to avoid:** Add `targetFX`/`targetFY` props (defaulting to saga position); event visitor uses 0.28/0.62 (symmetric left).
**Warning signs:** Only one visitor responds to taps, or dialogue opens for wrong visitor.

### Pitfall 3: `getSagaById()` Returns Undefined for Event IDs
**What goes wrong:** `SagaWorldEvent` calls `getSagaById(sagaProgress.sagaId)` → returns `undefined` for `'paques'` → component returns `null` immediately (line 476).
**Why it happens:** Event IDs are not in the `SAGAS` array.
**How to avoid:** Add `overrideSaga?: Saga` prop to `SagaWorldEvent`. This is a 2-line change (prop declaration + `activeSaga` assignment).
**Warning signs:** Tapping event visitor opens nothing; no error in non-dev builds.

### Pitfall 4: Reward Pool Is Empty for a Rarity
**What goes wrong:** `poisson-avril` has no `légendaire` pool. If choice 2 maps to `légendaire`, `pool` is undefined → crash or undefined reward.
**Why it happens:** Not all 8 events have all 5 rarity tiers.
**How to avoid:** In `drawGuaranteedSeasonalReward()`, always fall back to `commun` if target pool is empty/undefined.
**Warning signs:** TypeScript error or runtime crash when choice 2 is selected during April Fool's.

### Pitfall 5: zIndex Conflict Between Event Visitor and Saga Dialogue
**What goes wrong:** Event visitor (zIndex 3) renders on top of saga dialogue overlay (zIndex 15+). Or event visitor intercepts taps during saga dialogue.
**Why it happens:** Both layers use `pointerEvents="box-none"` with varying zIndex.
**How to avoid:** Follow same pattern as saga visitor: `zIndex: showEventDialogue ? 20 : 3`. Set `pointerEvents="none"` on event visitor layer when saga event is showing, and vice versa.
**Warning signs:** Tapping saga dialogue closes it and opens event dialogue instead.

### Pitfall 6: Event Visible While Loading Profile
**What goes wrong:** `tree.tsx` shows event visitor before SecureStore has loaded the completion status — visitor flashes visible then disappears.
**Why it happens:** `loadEventProgress()` is async; before it resolves, state defaults to "not completed".
**How to avoid:** Add a `eventProgressLoaded` boolean state (same as saga pattern already handles: `setSagaProgress(null)` initially). Don't render event visitor until load is complete.

---

## Code Examples

### Loading Event Progress (SecureStore pattern)

```typescript
// Source: modeled on lib/mascot/sagas-storage.ts (verified)
import { SecureStoreCompat as SecureStore } from './utils';
import type { SeasonalEventProgress } from './seasonal-events-types';

function eventKey(profileId: string): string {
  return `seasonal_events_${profileId}`;
}

export async function loadEventProgressList(profileId: string): Promise<SeasonalEventProgress[]> {
  try {
    const raw = await SecureStore.getItemAsync(eventKey(profileId));
    if (!raw) return [];
    return JSON.parse(raw) as SeasonalEventProgress[];
  } catch {
    return [];
  }
}

export async function saveEventProgress(progress: SeasonalEventProgress): Promise<void> {
  try {
    const current = await loadEventProgressList(progress.profileId);
    const updated = [
      ...current.filter(p => !(p.eventId === progress.eventId && p.year === progress.year)),
      progress,
    ];
    await SecureStore.setItemAsync(eventKey(progress.profileId), JSON.stringify(updated));
  } catch {
    // Silently fail — non-critical
  }
}
```

### Detecting Whether to Show Visitor

```typescript
// lib/mascot/seasonal-events-engine.ts
import { getActiveEvent } from '../gamification/seasonal';
import type { SeasonalEventProgress } from './seasonal-events-types';

export function shouldShowEventVisitor(
  progressList: SeasonalEventProgress[],
  now: Date = new Date(),
): boolean {
  const active = getActiveEvent(now);
  if (!active) return false;
  const year = now.getFullYear();
  const completed = progressList.find(p => p.eventId === active.id && p.year === year);
  return !completed;
}

export function getVisibleEventId(
  progressList: SeasonalEventProgress[],
  now: Date = new Date(),
): string | null {
  const active = getActiveEvent(now);
  if (!active) return null;
  const year = now.getFullYear();
  const completed = progressList.find(p => p.eventId === active.id && p.year === year);
  return completed ? null : active.id;
}
```

### Wiring Into tree.tsx (minimal diff)

```typescript
// In tree.tsx — parallel to saga visitor state (lines ~274-291, verified)
const [eventProgressList, setEventProgressList] = useState<SeasonalEventProgress[]>([]);
const [eventProgressLoaded, setEventProgressLoaded] = useState(false);
const [showEventDialogue, setShowEventDialogue] = useState(false);
const [eventVisitorShouldDepart, setEventVisitorShouldDepart] = useState(false);
const [eventVisitorReaction, setEventVisitorReaction] = useState<ReactionType | undefined>(undefined);

useEffect(() => {
  if (!profile?.id) return;
  loadEventProgressList(profile.id).then(list => {
    setEventProgressList(list);
    setEventProgressLoaded(true);
  });
  setEventVisitorShouldDepart(false);
  setEventVisitorReaction(undefined);
}, [profile?.id]);

const activeEventId = eventProgressLoaded
  ? getVisibleEventId(eventProgressList)
  : null;
```

### SeasonalEventContent type

```typescript
// lib/mascot/seasonal-events-types.ts
import type { SagaChapter } from './sagas-types';

export interface SeasonalEventContent {
  eventId: string;           // matches SEASONAL_EVENTS[].id
  emoji: string;
  titleKey: string;          // i18n key
  visitorNameKey: string;    // e.g. 'mascot.event.paques.visitor_name'
  chapter: SagaChapter;      // single chapter (reuses SagaChapter type exactly)
  bonusXP: number;           // D-12: bonus XP on completion
}
```

### i18n key structure

```json
// locales/fr/gamification.json — add under "mascot"
{
  "mascot": {
    "event": {
      "paques": {
        "title": "Visite du Lapin de Pâques",
        "visitor_name": "Lapin de Pâques",
        "narrative": "Un lapin coloré bondit vers toi, les oreilles dressées...",
        "choiceA": "🥚 Chercher les œufs cachés",
        "choiceB": "🌸 Décorer l'arbre de fleurs",
        "choiceC": "🍫 Partager le chocolat",
        "cliffhanger": "Le lapin disparaît en riant, laissant quelques pépites dorées...",
        "reward_label": "Cadeau de Pâques"
      }
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Swipeable (RNGH) | ReanimatedSwipeable | Phase 11 | All swipes now use Reanimated-backed gesture |
| Single gamification.md | Per-profile gami-{id}.md | Phase 8.1 | Event completion stored in SecureStore (not vault) to avoid multi-device write conflicts |
| RN Animated | react-native-reanimated ~4.1 | Project mandate | All new animations use Reanimated worklets |

**Deprecated/outdated:**
- `trySeasonalDraw()`: Not deprecated, but for event visitors use the new guaranteed draw instead of this function.

---

## Open Questions

1. **What XP bonus per event? (D-12)**
   - What we know: Sagas give 20-50 XP bonus. Seasonal events are described as "court et direct" (D-03/D-15).
   - What's unclear: Specific XP value per event — same for all 8, or varies?
   - Recommendation: Use a flat `SEASONAL_EVENT_BONUS_XP = 15` constant (half of the minimum saga bonus). Planner should confirm or adjust.

2. **Which rarity maps to which choice?**
   - What we know: D-13 says choices influence rarity/type of reward.
   - What's unclear: Exact mapping (e.g., choice A = commun, B = rare, C = épique).
   - Recommendation: Choice index 0 → commun, 1 → rare, 2 → épique. Events without a rare/épique pool fall back to commun. Document as code constant `CHOICE_RARITY_MAP`.

3. **What sprite file to use as placeholder for Easter (priority event)?**
   - What we know: `assets/garden/animals/lapin/` exists but is the companion lapin (subdirs: bebe/jeune/adulte) with different sprite structure than visitor sprites. `assets/garden/animals/voyageur/idle_1.png` is the established placeholder pattern.
   - What's unclear: Should we copy the lapin sprites (wrong structure) or just use the voyageur placeholder until PixelLab sprites are ready?
   - Recommendation: Use `voyageur` sprites as universal placeholder for ALL event visitors (D-05 explicitly says placeholders are OK). Add `TODO: replace with seasonal sprites` comment in the sprite map.

4. **Does `SagaWorldEvent` finale phase apply to events?**
   - What we know: The saga finale shows two reward cards (mascot item + bonus crop). Events give seasonal rewards (badges, points, activities) — not mascot items.
   - What's unclear: Should we suppress the finale reveal phase or show a simpler "reward" screen?
   - Recommendation: Events use `cliffhanger` phase only (no `finale_reveal`). Complete event, show reward description in the cliffhanger text, then dismiss. This avoids the complex reward card UI which assumes mascot item + crop structure.

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code changes. No new external dependencies. All required tools (`expo-secure-store`, `react-native-reanimated`, `expo-haptics`, `i18next`) are already installed and verified working in Phase 11.

---

## Validation Architecture

nyquist_validation is explicitly `false` in `.planning/config.json`. Section skipped.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `lib/mascot/sagas-types.ts` — `SagaProgress`, `SagaChapter`, `SagaChoice`, `createEmptySagaProgress()` — complete type definitions
- Direct code reading: `lib/mascot/sagas-engine.ts` — engine functions for progression
- Direct code reading: `lib/mascot/sagas-storage.ts` — SecureStore persistence pattern (verified line-by-line)
- Direct code reading: `components/mascot/VisitorSlot.tsx` — `TARGET_FX=0.72, TARGET_FY=0.62`, sprite map structure, all animation states
- Direct code reading: `components/mascot/SagaWorldEvent.tsx` — `getSagaById()` call at line 106, `overrideSaga` extension point identified, phase flow
- Direct code reading: `lib/gamification/seasonal.ts` — `getActiveEvent()`, `trySeasonalDraw()`, `getEasterDate()` verified
- Direct code reading: `lib/gamification/seasonal-rewards.ts` — all 8 `SEASONAL_EVENTS` with reward pools per rarity verified
- Direct code reading: `app/(tabs)/tree.tsx` — saga visitor wiring at lines 274-297, 1450-1531 verified
- Direct code reading: `hooks/useVault.ts` — `completeSagaChapter()` at lines 3435-3554 verified
- Direct code reading: `lib/types.ts` — `Profile.completedSagas`, `GamificationData` structure, `SagaItem` pattern verified

### Secondary (MEDIUM confidence)
- `assets/garden/animals/voyageur/` directory structure — confirmed 8 files (idle_1/2 + walk_left_1-6) as the established placeholder pattern
- `assets/garden/animals/lapin/` directory structure — confirmed subdirectory format (bebe/jeune/adulte) is companion format, NOT visitor format

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed, verified working in Phase 11
- Architecture: HIGH — direct code reading of all canonical references; patterns verified
- Pitfalls: HIGH — identified from actual code constraints (hardcoded positions, getSagaById lookup, reward pool gaps)
- Content (XP values, exact choice→rarity mapping): MEDIUM — reasonable defaults proposed, planner should confirm

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable codebase, no fast-moving external dependencies)
