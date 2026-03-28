# Phase 6: Ambiance + Retention — Research

**Researched:** 2026-03-28
**Domain:** React Native Reanimated particle effects, farm game mutation logic, streak visual feedback
**Confidence:** HIGH

## Summary

Phase 6 adds three visual/retention features to the tree/farm screen. All three are purely visual — they touch no data persistence schemas and require no new vault file formats. The codebase already has a fully-featured particle animation system (`SeasonParticle`, `FloatingParticles`, `Particle` in `TreeView.tsx`), a layered diorama rendering architecture in `tree.tsx`, and a well-defined `streak` field on the `Profile` type backed by `calculateStreak()` in `engine.ts`.

**Time-of-Day Ambiance** is a new overlay layer inserted into the existing diorama layer stack in `tree.tsx` (currently Couche 0–4). It needs a pure function that buckets `new Date().getHours()` into time slots and returns a color tint + a particle variant (dew drops for morning, fireflies for night). The particle implementation can copy the `SeasonParticle` pattern directly — `direction: 'up'` with a faint glow color for fireflies, tiny `direction: 'float'` blue dots for dew.

**Golden Crop Mutation** is a 3% roll at plant time in `farm-engine.ts`. The `PlantedCrop` interface needs an optional `isGolden?: boolean` field, and the CSV serializer/deserializer must encode it (add a 6th colon-separated field). On harvest, `harvestCrop()` multiplies reward ×5 when `isGolden`. Visual distinction: a `#FFD700` border glow on `FarmPlot` and a golden shimmer (scale pulse) reusing the existing mature-crop pulse pattern in `FarmPlots.tsx`.

**Streak Flames** is a new `StreakFlames` component rendered directly in `tree.tsx` below the diorama info card. It reads `profile.streak` and maps it to the four `STREAK_MILESTONES` tiers (`2+`, `7+`, `14+`, `30+`). Each tier renders 1–4 animated flame glyphs (🔥) with growing scale and faster pulse, all via `withRepeat` + `withSequence` + `withSpring` following the existing idle animation pattern.

**Primary recommendation:** Implement all three features as isolated, composable components/functions with no modifications to vault file formats except the PlantedCrop CSV (adding an optional 6th field with backward-compatible parsing).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-reanimated | ~4.1.1 | Worklet animations (particles, pulses, flames) | Project-mandated — all animations use this |
| expo-haptics | ~15.0.8 | Tactile feedback on golden crop reveal | Project convention for important interactions |
| react-native-svg | ^15.12.1 | Used in TreeView.tsx for fallback SVG tree — NOT used for new particle work | Already present |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-linear-gradient | ~15.0.8 | Color overlay for time-of-day tint | Already used in diorama layer stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reanimated particles (emoji/View) | @shopify/react-native-skia | Skia would give better glow effects but requires New Architecture — explicitly Out of Scope in REQUIREMENTS.md |
| Simple opacity overlay for time-of-day | Full sky gradient repaint | Overlay is cheaper, non-breaking, and consistent with existing layer architecture |

**Installation:**
No new packages needed. All dependencies already installed.

---

## Architecture Patterns

### Existing Diorama Layer Stack (tree.tsx)

```
treeBg TouchableOpacity (full-bleed, height = DIORAMA_HEIGHT_BY_STAGE[stageIdx])
├── Couche 0: View backgroundColor = PIXEL_GROUND[season]
├── Couche 1: LinearGradient grass texture
├── Couche 2: PixelDiorama (flowers, stones, decorations)
├── Couche 3: WorldGridView (crops + buildings)
├── HarvestBurst (conditional, zIndex 10)
├── CropWhisper (conditional, zIndex 20)
└── Couche 4: treeOverlay > TreeView + sagaSceneElement
```

**New ambiance overlay inserts between Couche 1 and Couche 2**, or as a top-of-stack `pointerEvents="none"` overlay above Couche 4. A top overlay is simpler and doesn't interfere with touch handling. The existing `HarvestBurst` uses `zIndex: 10` and `CropWhisper` uses `zIndex: 20`, so the ambiance overlay should use `zIndex: 5` to sit below those.

### Existing Particle Pattern (`SeasonParticle` in TreeView.tsx)

```typescript
// Source: components/mascot/TreeView.tsx:1488
function SeasonParticle({ particle, index, containerSize }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    const delay = index * 600;
    if (particle.direction === 'down') {
      translateY.value = withDelay(delay, withRepeat(
        withTiming(containerSize * 1.1, { duration, easing: Easing.linear }), -1, false,
      ));
      // wobble X with withSequence
    } else {
      // 'float': vertical oscillation + horizontal drift
    }
    opacity.value = withDelay(delay, withRepeat(withSequence(...), -1, true));
  }, [reducedMotion]);
}
```

**Dew drop particles**: Use `direction: 'down'`, small radius (3–4px), low opacity (0.3–0.5), blue-white color (`#C8E6FF`), 6–8 count, slow fall (duration 6000–9000ms). Morning window only (05:00–09:00).

**Firefly particles**: Use `direction: 'float'`, slightly larger radius (5–7px), pulsing opacity (0→0.8→0), warm amber/yellow-green color (`#AAFF44` / `#FFE566`), 5–8 count. Night window only (20:00–05:00). Add a `shadowColor` glow effect via the particle `View` style (RN supports `shadowColor` + `shadowRadius` on iOS).

### Existing Farm/Crop Pattern

Current `PlantedCrop` CSV format: `plotIndex:cropId:currentStage:tasksCompleted:plantedAt`

**Extended format**: `plotIndex:cropId:currentStage:tasksCompleted:plantedAt:golden`

Where `golden` = `"1"` (golden) or `""` / absent (normal). Backward-compatible since `parseCrops()` already handles missing trailing fields via fallback.

```typescript
// Source: lib/mascot/farm-engine.ts:32 (plantCrop pattern)
export function plantCrop(
  crops: PlantedCrop[],
  plotIndex: number,
  cropId: string,
): PlantedCrop[] {
  // existing check...
  const isGolden = Math.random() < GOLDEN_CROP_CHANCE; // 0.03
  return [
    ...crops,
    {
      cropId,
      plotIndex,
      currentStage: 0,
      tasksCompleted: 0,
      plantedAt: new Date().toISOString().slice(0, 10),
      isGolden,
    },
  ];
}
```

### Existing Streak Data

`profile.streak: number` is already maintained by `calculateStreak()` in `lib/gamification/engine.ts`. This function recalculates from history on every task completion (no dedicated "daily login" tracking — streak counts consecutive task days).

`STREAK_MILESTONES` in `engine.ts` defines 4 tiers:
- `streak >= 2`: ✨ Série en cours
- `streak >= 7`: 🔥 Flamme Ardente
- `streak >= 14`: 🔥🔥 Flamme Intense
- `streak >= 30`: 🔥💎 Flamme Légendaire

**Streak Flames** maps directly onto these milestones: 0 streak = no flames rendered, 2+ = 1 small flame, 7+ = 2 medium flames, 14+ = 3 large flames, 30+ = 4 flames with diamond glow.

### Recommended Project Structure

No new directories needed. New files:

```
components/mascot/
├── AmbientParticles.tsx     # New — time-of-day dew/firefly overlay
├── StreakFlames.tsx          # New — streak flame display below diorama
lib/mascot/
├── ambiance.ts              # New — getTimeSlot(), getDewConfig(), getFireflyConfig()
lib/mascot/farm-engine.ts    # Modified — add golden mutation in plantCrop()
lib/mascot/types.ts          # Modified — PlantedCrop.isGolden?: boolean
components/mascot/FarmPlots.tsx  # Modified — golden visual treatment
app/(tabs)/tree.tsx          # Modified — wire AmbientParticles + StreakFlames
```

### Anti-Patterns to Avoid

- **Do not use `perspective` in transform arrays**: The project CLAUDE.md explicitly warns this causes 3D clipping. For flame size scaling use `scale` only.
- **Do not use RN Animated**: All animations must use `react-native-reanimated` shared values.
- **Do not add `shadowColor` in SVG context**: `shadowColor` works in native RN Views but not inside SVG `<G>` elements — firefly glow must be a native `View` not an SVG element.
- **Do not hardcode colors**: Streak flame colors must use theme-agnostic constants (amber/gold are content colors, not semantic theme colors — define them as module-level constants, not from `useThemeColors()`).
- **Do not read `profile.streak` in child particle components**: Pass streak as a prop to avoid re-rendering the whole diorama.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Particle animation engine | Custom animation scheduler | `withRepeat` + `withSequence` + `withDelay` in Reanimated | Already proven in `SeasonParticle` — identical requirements |
| Glow effect on golden crop | Custom shader / Skia paint | `borderWidth` + `shadowColor` + `shadowRadius` on a `View` | Skia is Out of Scope; native shadow works on iOS |
| Streak calculation | New login-tracking mechanism | `profile.streak` (already computed by `calculateStreak()`) | Streak already exists — just consume it |
| Time bucket lookup | Complex time-range library | Simple `getHours()` switch/if in a pure `getTimeSlot()` function | 5 lines of pure TypeScript |

**Key insight:** All three features are presentations of already-existing data. Nothing requires new state, new vault files, or new hook logic.

---

## Common Pitfalls

### Pitfall 1: Golden crop CSV backward-compatibility
**What goes wrong:** Adding `isGolden` as a 6th CSV field breaks parsing of existing crops saved without it.
**Why it happens:** `parseCrops()` does a positional split on `:` — a missing 6th field returns `undefined`.
**How to avoid:** In `parseCrops()`, read the 6th field as `entry.split(':')[5] === '1'`. `undefined === '1'` is `false`, so existing data parses as non-golden without any migration.
**Warning signs:** TypeScript will flag `undefined` comparison — use optional chaining or default to `''`.

### Pitfall 2: Performance — too many animated Views in diorama
**What goes wrong:** Adding 8 dew particles + 8 fireflies + 4 flame Views to an already-complex diorama causes jank on older devices.
**Why it happens:** Each `Animated.View` with `withRepeat` spawns a worklet thread loop. The diorama already has `FarmPlots` with per-plot pulse animations.
**How to avoid:** Keep total ambient particles to ≤ 8 for dew (morning only) and ≤ 8 for fireflies (night only) — never both simultaneously. Flames component is 1–4 `Animated.View` elements outside the diorama (below it, not inside), so no overlap.
**Warning signs:** If the `ScrollView` on the tree screen stutters when particles are active, reduce count.

### Pitfall 3: Scroll conflict with particle pointerEvents
**What goes wrong:** A full-screen particle overlay captures touch events, blocking scroll and tap interactions on the diorama.
**Why it happens:** `View` without `pointerEvents="none"` captures all touches.
**How to avoid:** The ambient particle overlay must always use `pointerEvents="none"` (same as `PixelDiorama` and `HarvestBurst`).

### Pitfall 4: `useReducedMotion` not respected
**What goes wrong:** New animations run even when the user has enabled Reduce Motion in iOS accessibility settings.
**Why it happens:** New components don't inherit the `reducedMotion` check.
**How to avoid:** Every new animation component must call `const reducedMotion = useReducedMotion()` from Reanimated and guard all `withRepeat` calls with `if (reducedMotion) return;`.

### Pitfall 5: Time-of-day check not reactive
**What goes wrong:** The ambiance overlay computes the time slot once at mount and never updates — user opens app at 8:59am, stays on screen, clock ticks to 9:00am, no transition.
**Why it happens:** `getHours()` is called inside `useMemo` with no deps.
**How to avoid:** For this app (used briefly per session), a mount-time check is acceptable. Document this in the component. If a timer is needed, use a 1-minute `setInterval` with cleanup in `useEffect`. Given the low usage pattern (family app, opened for seconds), the simple mount-time approach is recommended.

---

## Code Examples

Verified patterns from existing codebase:

### Time-of-Day Bucket (new lib/mascot/ambiance.ts)
```typescript
// Pattern: pure function, no React imports
export type TimeSlot = 'matin' | 'jour' | 'soir' | 'nuit';

export function getTimeSlot(date: Date = new Date()): TimeSlot {
  const h = date.getHours();
  if (h >= 5 && h < 9) return 'matin';    // 05:00–08:59 — rosée matinale
  if (h >= 9 && h < 19) return 'jour';    // 09:00–18:59 — pas d'effet ambient
  if (h >= 19 && h < 21) return 'soir';   // 19:00–20:59 — transition douce
  return 'nuit';                           // 21:00–04:59 — lucioles
}

export interface AmbiantConfig {
  particleColor: string;
  particleCount: number;
  particleSize: number;    // px radius
  direction: 'down' | 'float';
  opacity: number;
  duration: number;        // ms par cycle
  colorOverlay?: string;   // rgba pour tint léger du diorama
}

export const AMBIENT_CONFIGS: Record<TimeSlot, AmbiantConfig | null> = {
  matin: { particleColor: '#C8E6FF', particleCount: 7, particleSize: 3, direction: 'down', opacity: 0.45, duration: 7000, colorOverlay: 'rgba(180, 220, 255, 0.06)' },
  jour:  null, // pas d'effet
  soir:  { particleColor: '#FFD59E', particleCount: 4, particleSize: 4, direction: 'float', opacity: 0.35, duration: 5000, colorOverlay: 'rgba(255, 170, 80, 0.07)' },
  nuit:  { particleColor: '#AAFF66', particleCount: 6, particleSize: 5, direction: 'float', opacity: 0.70, duration: 4500, colorOverlay: 'rgba(20, 10, 60, 0.12)' },
};
```

### Golden Crop Visual (FarmPlots.tsx modification)
```typescript
// Source: components/mascot/FarmPlots.tsx:80 (existing matureGlow pattern)
// New: golden glow INSTEAD of green glow when isGolden is true
{crop?.isGolden && (
  <View style={[styles.goldenGlow]} />
)}
// In StyleSheet:
goldenGlow: {
  position: 'absolute',
  width: '100%',
  height: '100%',
  borderRadius: 8,
  borderWidth: 2,
  borderColor: '#FFD700',
  backgroundColor: 'rgba(255, 215, 0, 0.15)',
  // iOS shadow for glow effect:
  shadowColor: '#FFD700',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.6,
  shadowRadius: 6,
},
```

### Streak Flames Component (new components/mascot/StreakFlames.tsx)
```typescript
// Pattern: mirrors FarmPlot's pulse animation
// Source: components/mascot/FarmPlots.tsx:47 (pulse useSharedValue pattern)
function FlameItem({ index, tier }: { index: number; tier: number }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    if (reducedMotion) return;
    const delay = index * 200;
    const speed = 400 + tier * 100; // faster at higher tiers
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.0 + tier * 0.08, { duration: speed, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.9, { duration: speed, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    ));
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.0, { duration: speed }),
        withTiming(0.6, { duration: speed }),
      ), -1, true,
    ));
  }, [reducedMotion, tier]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const size = 18 + tier * 4; // bigger at higher tiers
  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: size }}>🔥</Text>
    </Animated.View>
  );
}
```

### PlantedCrop Extended Serialization (farm-engine.ts)
```typescript
// Extended serialize — adds isGolden as 6th field
export function serializeCrops(crops: PlantedCrop[]): string {
  return crops
    .map(c => `${c.plotIndex}:${c.cropId}:${c.currentStage}:${c.tasksCompleted}:${c.plantedAt}:${c.isGolden ? '1' : ''}`)
    .join(',');
}

// Extended parse — 6th field backward-compatible
export function parseCrops(csv: string): PlantedCrop[] {
  if (!csv || csv.trim() === '') return [];
  return csv.split(',').map(entry => {
    const [plotIndex, cropId, currentStage, tasksCompleted, plantedAt, goldenFlag] = entry.split(':');
    return {
      plotIndex: parseInt(plotIndex, 10),
      cropId,
      currentStage: parseInt(currentStage, 10),
      tasksCompleted: parseInt(tasksCompleted, 10),
      plantedAt: plantedAt || new Date().toISOString().slice(0, 10),
      isGolden: goldenFlag === '1',
    };
  }).filter(c => !isNaN(c.plotIndex) && c.cropId);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG-based tree rendering (fallback) | Pixel art sprites (Mana Seed, PNG) | Already done in codebase | New features use View/Image layers, not SVG |
| RN Animated | react-native-reanimated ~4.1 | Project convention from start | All new animations must use Reanimated worklets |
| Skia for glow effects | Shadow/border-based glow (native RN) | Decided at project inception — Skia deferred until New Architecture | Use `shadowColor`/`shadowRadius` on native Views |

**Out of Scope (per REQUIREMENTS.md):**
- `@shopify/react-native-skia`: Explicitly deferred — requires New Architecture evaluation
- "Streaks punitives": The flames are purely decorative/positive — no streak loss penalties, no guilt mechanics

---

## Open Questions

1. **Streak definition: tasks vs. app open**
   - What we know: `calculateStreak()` counts consecutive days with completed tasks (not mere app opens). `profile.streak` is recalculated from history on every `completeTask()`.
   - What's unclear: Should Streak Flames appear even if the user hasn't completed a task today (i.e., if yesterday's streak was high but today nothing done yet)? The current `calculateStreak()` does include today if a task was completed today.
   - Recommendation: Show flames based on `profile.streak` as stored — if they completed tasks yesterday, streak is still high. If they break the streak today, it resets to 0 on next task completion. Flames disappear naturally. This is the correct, non-punitive behavior.

2. **Golden crop: reveal moment vs. end-state visibility**
   - What we know: The golden `isGolden` flag is set at plant time. FarmPlot already shows a green border for mature crops.
   - What's unclear: Should the golden status be visible immediately after planting (spoils the surprise) or only revealed when mature?
   - Recommendation: Show a subtle `borderColor: 'rgba(255,215,0,0.3)'` shimmer during growth (hinting), and full golden glow `#FFD700` only when mature (`currentStage >= 4`). This preserves excitement without full opacity throughout.

3. **AmbientParticles in diorama vs. outside diorama**
   - What we know: The diorama `treeBg` View uses `marginHorizontal: -Spacing['2xl']` for full-bleed. All layers are `StyleSheet.absoluteFill` children of this View.
   - What's unclear: Placing AmbientParticles inside the diorama (as a new Couche) or outside (as an overlay on the whole screen including header).
   - Recommendation: Inside the diorama as a new Couche above Couche 1 (sky tint) but below Couche 2 (PixelDiorama decorations). This keeps ambient particles grounded in the garden space rather than floating over the UI.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (primary), Jest ^29.7.0 (exists but no active test suite) |
| Config file | `tsconfig.json` (strict mode enabled) |
| Quick run command | `npx tsc --noEmit` |
| Full suite command | `npx tsc --noEmit` (no Jest suite to run) |

### Phase Requirements → Test Map

No formal REQ-XX IDs mapped to this phase yet. Based on described behavior:

| Behavior | Test Type | Automated Command | Status |
|----------|-----------|-------------------|--------|
| `getTimeSlot()` returns correct slot for hours 0–23 | unit | `npx tsc --noEmit` (type coverage); could add Jest test | No Jest test exists |
| `plantCrop()` with golden mutation rolls ≈3% | unit | Manual spot check / Jest if added | No Jest test |
| `parseCrops()` backward-compatible with 5-field CSV | unit | `npx tsc --noEmit` + manual test | No Jest test |
| `serializeCrops()` → `parseCrops()` roundtrip preserves `isGolden` | unit | Could add to `lib/__tests__/` | No test file |
| `AMBIENT_CONFIGS` typed correctly (no TS errors) | compile | `npx tsc --noEmit` | Will run at implementation |
| `StreakFlames` renders 0 elements for streak 0–1 | manual | App on device | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit`
- **Phase gate:** `npx tsc --noEmit` green before verify

### Wave 0 Gaps
- No new test infrastructure required — TypeScript strict mode provides compile-time coverage for the new pure functions.
- Optionally add `lib/__tests__/farm-engine.test.ts` for `parseCrops`/`serializeCrops` roundtrip (TEST-03 in REQUIREMENTS.md is already planned for Phase 1 — reuse that if Phase 1 has been completed before Phase 6 executes).

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `components/mascot/TreeView.tsx` — `SeasonParticle`, `FloatingParticles`, `Particle` implementations (lines 1488–1673)
- Direct codebase read: `app/(tabs)/tree.tsx` — diorama layer stack with `zIndex` allocation (lines 537–616)
- Direct codebase read: `lib/mascot/farm-engine.ts` — `plantCrop()`, `harvestCrop()`, `serializeCrops()`, `parseCrops()` functions
- Direct codebase read: `lib/gamification/engine.ts` — `STREAK_MILESTONES`, `calculateStreak()`, `getStreakMilestone()`
- Direct codebase read: `lib/mascot/types.ts` — `PlantedCrop`, `CropDefinition`, `Profile.streak` field
- Direct codebase read: `components/mascot/FarmPlots.tsx` — pulse animation pattern for mature crops
- Direct codebase read: `components/mascot/HarvestBurst.tsx` — particle burst animation pattern
- Direct codebase read: `lib/mascot/seasons.ts` — `SeasonalParticle` type, `SEASONAL_PARTICLES` config

### Secondary (MEDIUM confidence)
- Project CLAUDE.md constraints: `perspective` warning, `useThemeColors()` requirement, `react-native-reanimated` mandate
- REQUIREMENTS.md Out of Scope: `@shopify/react-native-skia` and "Streaks punitives" explicitly excluded

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing infrastructure
- Architecture: HIGH — layer positions and component boundaries verified from source
- Pitfalls: HIGH — `parseCrops` backward-compat and `pointerEvents` confirmed from existing code
- Golden mutation implementation: HIGH — `plantCrop()` signature and CSV format verified
- Streak data availability: HIGH — `profile.streak` field confirmed in `Profile` type and computed by `calculateStreak()`

**Research date:** 2026-03-28
**Valid until:** 2026-05-28 (stable codebase — all deps frozen, no framework migration planned)
