# Phase 5: Visuels Ferme - Research

**Researched:** 2026-03-28
**Domain:** React Native Reanimated sprite animation, day/night overlay, pixel asset pipeline
**Confidence:** HIGH

## Summary

Phase 5 is a pure visual enhancement phase: day/night color overlay on the farm diorama (VIS-01), 2-frame animated crops (VIS-02), and animated animal idle+walk (VIS-03). No new gameplay mechanics.

The critical discovery from auditing the codebase is that **all current sprites are placeholders** — tiny PNG files (300–950 bytes) that contain no real pixel art. The Mana Seed assets described as "already purchased" are not yet extracted into `assets/garden/`. The first task of the phase must be to locate, audit, and place the real Mana Seed sprites before any code work begins.

A second key discovery: **VIS-03's animation engine already exists in full** inside `TreeView.tsx` (`AnimatedAnimal` component with idle cycle + random walk + thought bubbles). The entire VIS-03 implementation reduces to (a) supplying real Mana Seed sprites and (b) ensuring the `AnimatedAnimal` system renders them at the right size on the farm diorama. Similarly, **VIS-01's overlay infrastructure already exists** — `AmbientParticles` applies `colorOverlay` via `absoluteFill` over the entire diorama including the farm; the task is simply to add animated transition when the time slot changes (currently the slot is read once at mount, never re-checked during the session).

**Primary recommendation:** Audit and place Mana Seed assets first (Wave 0), extend `CROP_SPRITES` for 2-frame animation (Wave 1), add time-slot transition to the overlay (Wave 1), verify `AnimatedAnimal` renders at correct size on the PixelDiorama (Wave 1).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Cycle jour/nuit (VIS-01)
- **D-01:** Etendre `ambiance.ts` existant — reutiliser `getTimeSlot()` + ajouter un overlay teinte semi-transparent sur le diorama ferme (comme le `colorOverlay` deja defini)
- **D-02:** Transition progressive entre les slots horaires — fondu anime (`withTiming` ~2s) quand le slot change, pas de changement brusque
- **D-03:** Pas de particules ambiantes sur la ferme — l'overlay couleur seul suffit (particules restent exclusives au diorama arbre)
- **D-04:** Intensite nuit legere (~10-15% opacite overlay bleu/violet) — tout reste visible, adapte aux enfants

#### Animation des cultures (VIS-02)
- **D-05:** Technique swap PNG — alterner entre 2 frames (stage_X_a.png / stage_X_b.png) avec un timer (~800ms). Pas de spritesheet.
- **D-06:** 2 frames par stade de croissance (minimum requis par VIS-02) — 10 cultures x 5 stades x 2 frames = 100 PNGs total
- **D-07:** Mouvement balancement doux — frame A = position neutre, frame B = legerement penchee/agrandie. Effet brise legere.
- **D-08:** Cultures dorees (mutation 3%) gardent la meme animation que les normales — le lisere dore existant suffit a les distinguer

#### Animation des animaux (VIS-03)
- **D-09:** Idle sur place + marche aleatoire — l'animal reste en idle, puis se deplace vers un point voisin toutes les 5-10 secondes (Stardew Valley style)
- **D-10:** Zone de deplacement = espace libre du diorama non-occupe par les parcelles de culture. Pas de collision complexe, juste eviter les plots.
- **D-11:** 2 frames idle + 8 frames marche par animal (garder la structure existante idle_1/2 + walk_1..8 mais avec de vrais sprites)
- **D-12:** 5 animaux existants : poussin, poulet, canard, cochon, vache

#### Sourcing des assets
- **D-13:** Assets Mana Seed (itch.io) exclusivement — style pixel 32x32 uniforme. Pas de mix avec d'autres styles.
- **D-14:** Les assets Mana Seed sont deja disponibles localement (achetes precedemment) — la premiere tache est de les localiser et auditer avant tout code
- **D-15:** Remplacer tous les placeholders actuels (~300 bytes) par les vrais sprites Mana Seed

### Claude's Discretion
- Vitesse exacte d'animation des cultures (intervalle entre frames)
- Algorithme de pathfinding simple pour le deplacement animal
- Organisation exacte des fichiers dans `assets/garden/`
- Gestion de `useReducedMotion` pour les nouvelles animations

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIS-01 | La ferme affiche un cycle jour/nuit avec luminosite et teinte adaptees a l'heure reelle | `getTimeSlot()` + `AMBIENT_CONFIGS[slot].colorOverlay` already exist; add animated transition via `withTiming` + slot re-check interval |
| VIS-02 | Les cultures ont des sprites pixel ameliores avec au moins 2 frames d'animation par stade de croissance | Extend `CROP_SPRITES` to `Record<string, Record<number, [any, any]>>`; add frame-swap timer in `CropCell` (WorldGridView); requires 100 new PNGs from Mana Seed |
| VIS-03 | Les animaux ont des sprites pixel ameliores avec animations idle et marche plus fluides | `AnimatedAnimal` component (TreeView.tsx:2009) already implements idle+walk+thought bubbles; requires real Mana Seed sprites + size normalization |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1.1 | Animated overlays, frame transitions | Project mandate — all animations |
| React Native `Image` | built-in | PNG sprite rendering | Required for pixel art frames |
| React Native `View` | built-in | absoluteFill color overlay | Zero-dep, proven pattern in `AmbientParticles` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-haptics | ~15.0.8 | Tactile feedback | Not needed for this phase (visual only) |
| useReducedMotion | reanimated built-in | Accessibility gate | Wrap ALL new animation loops |

### No New Dependencies
This phase requires zero new npm packages. Everything needed is already installed.

**Installation:**
```bash
# No new dependencies required
```

---

## Architecture Patterns

### Asset Structure (post-phase)
```
assets/garden/
├── crops/
│   ├── carrot/
│   │   ├── icon.png          # boutique (unchanged)
│   │   ├── stage_0_a.png     # frame A (replaces stage_0.png)
│   │   ├── stage_0_b.png     # frame B (NEW)
│   │   ├── stage_1_a.png
│   │   ├── stage_1_b.png
│   │   ...
│   │   ├── stage_4_a.png
│   │   └── stage_4_b.png
│   └── [wheat, tomato, strawberry, potato, corn, pumpkin, cabbage, beetroot, cucumber]/
│       └── [same structure]
└── animals/
    └── [poussin, poulet, canard, cochon, vache]/
        ├── idle_1.png        # real Mana Seed sprite (replaces placeholder)
        ├── idle_2.png
        ├── walk_down_1.png   # through walk_down_8.png
        └── walk_left_1.png   # through walk_left_8.png (canard: 6 frames)
```

**Note on naming:** D-05 specifies `stage_X_a.png / stage_X_b.png`. The current `stage_X.png` files must be renamed to `stage_X_a.png` OR `stage_X_b.png` depending on content. The `icon.png` files remain unchanged.

### Pattern 1: Color Overlay with Animated Transition (VIS-01)

**What:** A semi-transparent `View absoluteFill` over the farm diorama changes its `backgroundColor` opacity using `withTiming` when the time slot changes. The slot is re-checked periodically (every minute) rather than only at mount.

**When to use:** Whenever the real-time hour crosses a slot boundary during an active session.

**Key insight:** `AmbientParticles` currently reads `getTimeSlot()` once at mount via `useMemo(() => getTimeSlot(), [])`. This means the overlay never updates during a session. VIS-01 requires polling — a `setInterval` or `AppState` listener to re-evaluate the slot and animate to the new color.

**Example:**
```typescript
// Source: existing AmbientParticles.tsx pattern + reanimated withTiming
const overlayOpacity = useSharedValue(0);
const [timeSlot, setTimeSlot] = useState(() => getTimeSlot());

useEffect(() => {
  const interval = setInterval(() => {
    const newSlot = getTimeSlot();
    if (newSlot !== timeSlot) setTimeSlot(newSlot);
  }, 60_000); // re-check every minute
  return () => clearInterval(interval);
}, [timeSlot]);

useEffect(() => {
  const config = AMBIENT_CONFIGS[timeSlot];
  const targetOpacity = config?.colorOverlay ? parseFloat(/* extract opacity */) : 0;
  overlayOpacity.value = withTiming(targetOpacity, { duration: 2000 });
}, [timeSlot]);

const overlayStyle = useAnimatedStyle(() => ({
  opacity: overlayOpacity.value,
}));
```

**Implementation path:** Create `FarmDayNightOverlay.tsx` (or inline in `tree.tsx` Couche ambiance) — a new component that reads `getTimeSlot()` + `AMBIENT_CONFIGS` and renders a color-tinted `absoluteFill` View. Does NOT render particles (per D-03). The existing `AmbientParticles` at zIndex 5 already covers the whole diorama; if its `colorOverlay` is sufficient, VIS-01 may only require adding transition animation to the existing component.

**Decision point for planner:** Either (a) extend `AmbientParticles` to re-poll and animate transitions, OR (b) create `FarmDayNightOverlay` as a separate component below zIndex 5. Option (a) is simpler — one component change, no new file. Option (b) is cleaner but adds a file. Given the farm needs the overlay even during 'jour' (when `AMBIENT_CONFIGS.jour === null`), option (b) with a dedicated farm overlay component is safer.

### Pattern 2: Frame Swap for Crop Animation (VIS-02)

**What:** Extend `CROP_SPRITES` to hold 2 frames per stage, add a frame index state with a `setInterval` (~800ms) in `CropCell`, and alternate between frame A and frame B.

**When to use:** All planted crops at all growth stages.

**Key integration point:** `WorldGridView.tsx` (not `FarmPlots.tsx`) is the active component rendering crop cells. `FarmPlots.tsx` exists but the tree screen uses `WorldGridView`. The frame swap must be added to `CropCell` inside `WorldGridView.tsx`.

**Current `CROP_SPRITES` signature:**
```typescript
// lib/mascot/crop-sprites.ts
export const CROP_SPRITES: Record<string, Record<number, any>> = {
  carrot: { 0: require(...), 1: require(...), ... }
};
```

**Required new signature:**
```typescript
export const CROP_SPRITES: Record<string, Record<number, [any, any]>> = {
  carrot: {
    0: [require('.../stage_0_a.png'), require('.../stage_0_b.png')],
    1: [require('.../stage_1_a.png'), require('.../stage_1_b.png')],
    // ...
  }
};
```

**CropCell frame swap:**
```typescript
// Source: FarmPlots.tsx idle pulse pattern + AmbientParticles useReducedMotion pattern
const reducedMotion = useReducedMotion();
const [frameIdx, setFrameIdx] = useState(0);

useEffect(() => {
  if (reducedMotion) return;
  const timer = setInterval(() => setFrameIdx(i => 1 - i), 800);
  return () => clearInterval(timer);
}, [reducedMotion]);

const frames = CROP_SPRITES[crop.cropId]?.[crop.currentStage];
const source = Array.isArray(frames) ? frames[frameIdx] : frames;
```

### Pattern 3: Animal Walk Direction (VIS-03)

**What:** The existing `AnimatedAnimal` uses only `walk_down_*` frames. Since walk_left frames also exist for all animals, the direction of movement should select the appropriate frame set. Use `scaleX: -1` to mirror walk_left frames for right-direction movement (per project convention of using scaleX for flips).

**Current walk frame code (TreeView.tsx:1970-2002):** Uses only `walk_down_*` for all directions. Movement is ±dx/±dy offsets.

**Enhancement:** When `dx > 0`, use walk_left frames with `transform: [{ scaleX: -1 }]` (flip for right). When `dy !== 0`, use walk_down frames. This gives 4 directions from 2 frame sets.

```typescript
// Source: CLAUDE.md convention "scaleX pour les flips"
// When moving right: mirror walk_left
const walkLeft = ANIMAL_WALK_LEFT_FRAMES[animalId];
const useHorizontal = Math.abs(dx) > Math.abs(dy);
const frames = useHorizontal ? walkLeft : walkFrames;
const flipX = useHorizontal && dx > 0; // mirror for right direction

// In render:
<Image
  source={currentFrame}
  style={[
    { width: size, height: size },
    flipX ? { transform: [{ scaleX: -1 }] } : {}
  ] as any}
/>
```

**Note on canard:** Canard has only 6 walk_left frames (vs 8 for others). Adjust `walkFrameIdx % walkFrames.length` — already handled by the existing modulo logic.

### Anti-Patterns to Avoid

- **Hardcoding color values:** Never use `'rgba(20, 10, 60, 0.12)'` inline — define overlay colors in `AMBIENT_CONFIGS` or a named constant. AMBIENT_CONFIGS already has these values — read from there.
- **perspective in transform arrays:** Per CLAUDE.md — causes 3D clipping. Use `scaleX` for flips (walk direction).
- **Reading timeSlot once at mount:** VIS-01 requires slot polling — `useMemo(() => getTimeSlot(), [])` misses slot changes during a session.
- **Modifying FarmPlots.tsx instead of WorldGridView.tsx:** The tree screen renders `WorldGridView`, not `FarmPlots`. Crop frame swap must go in `WorldGridView.tsx`'s `CropCell`.
- **Mixing animal rendering layers:** Animals render in `TreeView.tsx` overlay (zIndex 3, inside the tree component), not in the PixelDiorama layer. The `AnimatedAnimal` renders relative to the tree SVG container. This is already correct — don't move animals to `WorldGridView`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time slot detection | Custom hour-range parser | `getTimeSlot()` from `ambiance.ts` | Already defines matin/jour/soir/nuit boundaries; single source of truth |
| Overlay color values | New color constants | `AMBIENT_CONFIGS[slot].colorOverlay` | Already defined for all slots; DRY |
| Frame cycling timer | Custom animation engine | `setInterval` + `useState(frameIdx)` | Simple, correct, matches existing `AnimatedAnimal` pattern |
| Walk direction flip | Per-direction sprite sets | `scaleX: -1` transform | Project convention; half the asset count |
| Reduced motion check | Custom accessibility flag | `useReducedMotion()` from reanimated | Built-in, already used in `AmbientParticles` |

**Key insight:** The biggest risk of custom solutions is duplicating logic that already exists — `getTimeSlot()`, `AMBIENT_CONFIGS`, `AnimatedAnimal`. Extend and reuse; don't replace.

---

## Common Pitfalls

### Pitfall 1: Animating While Hidden / Background

**What goes wrong:** Timers and intervals keep running when the screen is backgrounded or the tab is not active. 100+ `setInterval` calls (10 crops × possible multiple renders) accumulate.

**Why it happens:** React Native intervals survive backgrounding; no built-in pause on `AppState` change.

**How to avoid:** The existing `AnimatedAnimal` does not handle `AppState` either, and it works acceptably. For crop frame swap, `setInterval` cleanup in `useEffect` return is sufficient. If performance is a concern, stagger intervals with `Math.random() * 200` offset per crop to avoid all crops flipping simultaneously.

**Warning signs:** Profiler shows many simultaneous timer callbacks; UI thread jank on low-end devices.

### Pitfall 2: Placeholder Detection — "Assets Already Available"

**What goes wrong:** CONTEXT.md D-14 states "les assets Mana Seed sont deja disponibles localement." The audit reveals ALL current files in `assets/garden/crops/` and `assets/garden/animals/` are placeholder PNGs (300–950 bytes for images that should be 2–20KB).

**Why it happens:** The file structure was scaffolded with placeholder content during a prior phase. The real Mana Seed ZIP/folder is likely in `~/Downloads`, `~/Desktop`, or a named folder in `~/Documents`.

**How to avoid:** Wave 0 MUST be an asset audit task: locate the Mana Seed source folder (developer must point to it manually), extract the correct sprites, and place them in `assets/garden/`. All subsequent waves depend on this.

**Warning signs:** If an asset file is < 1KB for a dimension > 32×32, it is a placeholder. Real Mana Seed 32×32 sprites are typically 500B–3KB; 64×64 upscaled versions are 2–8KB.

### Pitfall 3: CROP_SPRITES Type Change Breaks Existing Code

**What goes wrong:** Changing `CROP_SPRITES` from `Record<number, any>` to `Record<number, [any, any]>` breaks the existing `WorldGridView.tsx` line `CROP_SPRITES[crop.cropId]?.[crop.currentStage]` if not updated atomically.

**Why it happens:** TypeScript will catch it at compile time, but the runtime behavior could fail silently if the check is only for truthiness.

**How to avoid:** Update `crop-sprites.ts` and ALL consumers (`WorldGridView.tsx`, `FarmPlots.tsx`) in the same task. Run `npx tsc --noEmit` before committing. The `FarmPlots.tsx` component is no longer the primary renderer (WorldGridView replaced it) but still references `CROP_SPRITES` — keep it consistent.

### Pitfall 4: Animal Size Inconsistency

**What goes wrong:** Current placeholder sprites have inconsistent dimensions: poussin is 64×64, canard is 128×128, poulet/cochon/vache are 256×256. The `AnimatedAnimal` renders at `size: 28` (from HAB_SLOTS) which is correct for display but the source images vary 4× in resolution.

**Why it happens:** Placeholder generation used different sizes. Mana Seed sprites are typically 32×32 or 48×48 per frame. When real assets arrive they should all be the same size.

**How to avoid:** Standardize all animal sprites to 32×32 (or 48×48 for larger animals) when extracting from Mana Seed. The display size is controlled by the `size` prop in `AnimatedAnimal`, not the source image dimensions — React Native will scale automatically. But keeping source sizes consistent avoids memory overhead.

**Warning signs:** Memory warnings on older devices if source images are 256×256 but displayed at 28×28.

### Pitfall 5: Day/Night Overlay Double-Application

**What goes wrong:** `AmbientParticles` already applies a `colorOverlay` via `absoluteFill` at zIndex 5. If `FarmDayNightOverlay` also applies its own `colorOverlay`, the farm will get the effect twice (darker than intended at night).

**Why it happens:** Two separate overlay systems with overlapping intent.

**How to avoid:** Option A — extend `AmbientParticles` to add transition animation and re-polling (single overlay, single responsibility). Option B — create `FarmDayNightOverlay` but disable or remove the `colorOverlay` from `AmbientParticles`. The planner must choose one approach and document it clearly. The research recommendation is **Option A**: extend `AmbientParticles` with a `useEffect` interval to re-check the slot and animate `backgroundColor` with `withTiming`. This avoids double-overlay and keeps overlay logic in one place.

---

## Code Examples

Verified patterns from existing codebase:

### Frame Swap Timer (based on AnimatedAnimal idle pattern)
```typescript
// Source: components/mascot/TreeView.tsx:2024-2027 + AmbientParticles useReducedMotion
const reducedMotion = useReducedMotion();
const [frameIdx, setFrameIdx] = useState(0);

useEffect(() => {
  if (reducedMotion) return;
  const INTERVAL = 800; // ms — Claude's discretion
  const timer = setInterval(() => setFrameIdx(i => 1 - i), INTERVAL);
  return () => clearInterval(timer);
}, [reducedMotion]);
```

### Animated Overlay Transition (based on withTiming pattern)
```typescript
// Source: components/mascot/FarmPlots.tsx:46-60 pattern + ambiance.ts colorOverlay values
import { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { getTimeSlot, AMBIENT_CONFIGS } from '../../lib/mascot/ambiance';

const opacity = useSharedValue(0);

useEffect(() => {
  const config = AMBIENT_CONFIGS[currentSlot];
  // Parse opacity from colorOverlay string like 'rgba(20, 10, 60, 0.12)'
  const target = config?.colorOverlay ? getOverlayOpacity(config.colorOverlay) : 0;
  opacity.value = withTiming(target, { duration: 2000 });
}, [currentSlot]);
```

### CROP_SPRITES Extension
```typescript
// lib/mascot/crop-sprites.ts — new structure
export const CROP_SPRITES: Record<string, Record<number, [any, any]>> = {
  carrot: {
    0: [require('../../assets/garden/crops/carrot/stage_0_a.png'),
        require('../../assets/garden/crops/carrot/stage_0_b.png')],
    // ... stages 1-4
  },
  // ... 9 other crops
};
```

### Walk Direction with Flip
```typescript
// Source: CLAUDE.md "scaleX pour les flips" convention
const isMovingRight = lastDx > 0;
const isHorizontal = Math.abs(lastDx) > Math.abs(lastDy);

<Image
  source={currentFrame}
  style={[
    { width: size, height: size },
    isHorizontal && isMovingRight
      ? { transform: [{ scaleX: -1 }] }
      : {},
  ] as any}
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Emoji-based inhabitants | `AnimatedAnimal` pixel sprites in TreeView overlay | Phase 4 | Animals already animate; just need real sprites |
| `FarmPlots.tsx` (original) | `WorldGridView.tsx` (unified grid) | Phase 4 | Crop frame swap goes in WorldGridView, not FarmPlots |
| Static colorOverlay at mount | Needs animated re-polling | Phase 5 (this phase) | Core VIS-01 work |
| Single frame per crop stage | 2-frame swap (stage_X_a/b) | Phase 5 (this phase) | Core VIS-02 work |
| Placeholder PNGs (~300B) | Real Mana Seed sprites (2-10KB expected) | Phase 5 Wave 0 | Prerequisite for all visual work |

**Deprecated/outdated:**
- `FarmPlots.tsx`: Still exists but `WorldGridView.tsx` is the active renderer. Crop frame swap should be implemented in `WorldGridView.CropCell`. `FarmPlots.tsx` must be kept in sync (same CROP_SPRITES interface) to avoid TypeScript errors.

---

## Open Questions

1. **Location of the Mana Seed source assets**
   - What we know: D-14 states they are "available locally." The `assets/garden/` tree is fully scaffolded with placeholder PNGs. The `assets/garden/spritesheets/` directory is empty. Real Mana Seed content was not found in `~/Documents/family-vault/`.
   - What's unclear: Where is the Mana Seed ZIP/folder on the developer's machine? Is it in `~/Downloads`, `~/Desktop`, or a subfolder of `~/Documents`?
   - Recommendation: The Wave 0 task must be a manual step — developer locates the Mana Seed folder and the agent audits + copies. The plan should include explicit instructions for the developer to provide the path.

2. **canard walk frame count: 6 vs 8**
   - What we know: `canard` has 6 `walk_left_*` frames and 6 `walk_down_*` frames. All other animals have 8 walk frames. D-11 specifies "8 frames marche par animal."
   - What's unclear: Does Mana Seed's canard asset actually have 8 frames, or only 6? Were 2 frames missing from the placeholder generation?
   - Recommendation: Accept 6 frames for canard if the Mana Seed source only has 6. The modulo wrap in `AnimatedAnimal` handles arbitrary frame counts already. Update D-11 if confirmed.

3. **VIS-01 scope overlap with existing AmbientParticles**
   - What we know: `AmbientParticles` already renders `colorOverlay` as an `absoluteFill` View over the entire diorama (including farm area). This means a day/night tint is already applied — but only at mount time, with no transition animation, and with `jour` returning `null` (no overlay during the day).
   - What's unclear: Is the existing `AmbientParticles.colorOverlay` sufficient for VIS-01, or does the user expect a dedicated farm-specific overlay?
   - Recommendation: Extend `AmbientParticles` to (a) poll every minute for slot changes and (b) animate `backgroundColor` with `withTiming(2000)` on slot change. This satisfies VIS-01 with minimal new code and avoids double-overlay.

---

## Sources

### Primary (HIGH confidence)
- `components/mascot/AmbientParticles.tsx` — full source read; colorOverlay + useReducedMotion pattern confirmed
- `components/mascot/TreeView.tsx:1959-2107` — `AnimatedAnimal` full implementation confirmed; idle+walk+thought bubbles already working
- `lib/mascot/crop-sprites.ts` — current CROP_SPRITES structure confirmed
- `components/mascot/WorldGridView.tsx` — confirmed as the active crop renderer (not FarmPlots)
- `lib/mascot/ambiance.ts` — `getTimeSlot()`, `AMBIENT_CONFIGS`, `colorOverlay` values confirmed
- `lib/mascot/farm-grid.ts` — `FARM_GRID`, `PLOT_SIZE` confirmed
- `lib/mascot/world-grid.ts` — `WORLD_GRID`, `CELL_SIZES`, `getUnlockedCropCells` confirmed
- `app/(tabs)/tree.tsx:540-630` — diorama layer stack confirmed (layers 0-5 + TreeView overlay)

### Secondary (MEDIUM confidence)
- Asset size analysis (Python struct/os): All 50 crop stage PNGs + 90 animal PNGs confirmed as placeholders (<950B each). Real Mana Seed sprites expected 2-20KB.
- `assets/garden/ground/tileset_spring.png` — confirmed as real Mana Seed tileset (64KB, 256×256). Confirms Mana Seed assets ARE present somewhere, just not extracted to crops/animals.

### Tertiary (LOW confidence)
- CONTEXT.md D-14: "Mana Seed assets are already purchased" — assumed accurate, exact location on developer filesystem not verified.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all libraries already installed and used
- Architecture: HIGH — existing code read directly; patterns confirmed in source
- Asset situation: HIGH — direct file size measurement; all placeholders confirmed
- AnimatedAnimal already working: HIGH — full implementation read at TreeView.tsx:2008-2107
- Pitfalls: HIGH — derived directly from code audit, not speculation

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable codebase, no fast-moving dependencies)
