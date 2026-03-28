# Phase 02: Write Safety + Couleurs — Research

**Researched:** 2026-03-28
**Domain:** Concurrency / File I/O safety, Design token migration, XP economy modelling
**Confidence:** HIGH

---

## Summary

Phase 2 addresses three orthogonal problems: (1) concurrent writes to `gamification.md` that lose XP when 10 tasks are completed in rapid succession, (2) 228+ hardcoded hex colors scattered across 27 component files and 5 screen files that break dark-mode and theming, and (3) an XP economy that has no documented budget, making rewards arbitrary and hard to reason about.

The concurrent-write problem is a classic read-modify-write race: every call to `completeTask` in `useGamification.ts` independently does `readFile → parseGamification → mutate → writeFile`. Two simultaneous completions on the same `gamification.md` file will each read the same baseline, compute their own updated state, and the second write silently overwrites the first. The fix is a per-file in-memory promise queue (mutex) inside `VaultManager.writeFile` that serializes writes to the same relative path, without changing any call sites.

The color migration is purely mechanical: replace literal `'#XXXXXX'` strings in StyleSheets with semantic tokens from `useThemeColors()` / `colors.*` — except for a well-defined set of "cosmetic constants" (SVG art, seasonal palettes, rarity colors) that intentionally do not follow system theming.

The XP budget is about documenting the existing economy's math and calibrating constants so level progression is intentional and inflation-free for a child using the app over a typical school year.

**Primary recommendation:** Implement a per-file write-queue Map in VaultManager (no external library needed), then do a file-by-file color sweep starting with the highest-impact screens (`app/_layout.tsx`, `app/(tabs)/tasks.tsx`, `app/(tabs)/more.tsx`), and finally add JSDoc constants to `rewards.ts` documenting the XP budget math.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | Write queue per-file pour les opérations concurrentes sur le vault | Write queue implementation in VaultManager; race condition analysis in completeTask / toggleTask |
| QUAL-03 | Remplacement des 228 couleurs hardcodées par tokens sémantiques via useThemeColors() | Color inventory: 246 single-quote + 35 double-quote occurrences identified across 27 component files and 5 screen files; 3-tier classification of replaceable vs cosmetic vs SVG |
| GAME-01 | Modèle XP budget pour éviter l'inflation des niveaux | Existing XP formula `50n²+50n`, POINTS_PER_TASK=10, loot thresholds, streak bonuses all documented; budget model math laid out |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Native / Expo | SDK 54 | No new dependency | Write queue is pure JS, no lib needed |
| expo-file-system/legacy | ~19.0.21 | File I/O | Already in use; NSFileCoordinator handles iCloud |
| `constants/colors.ts` | project | Semantic tokens | Already the single source of truth for theme colors |
| `contexts/ThemeContext.tsx` | project | `useThemeColors()` | Already used in every screen |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lib/gamification/rewards.ts` | project | XP constants | The designated home for all reward calibration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-file Promise queue | `expo-sqlite` transaction lock | SQLite overkill; breaks Obsidian vault format |
| Per-file Promise queue | `async-mutex` npm package | Adds dependency; pure JS Map<string, Promise> is 15 lines |
| Per-file Promise queue | NSFileCoordinator exclusive write | Doesn't prevent JS-layer races; NSFileCoordinator solves iCloud contention, not in-process contention |
| `colors.*` semantic tokens | Tailwind / design token library | Project has no bundler support for Tailwind; `constants/colors.ts` already complete |

**Installation:** No new packages required.

---

## Architecture Patterns

### ARCH-01: Per-File Write Queue

#### How the race condition happens

Every gamification mutation in `useGamification.ts` follows this pattern:

```typescript
// hooks/useGamification.ts — completeTask (simplified)
const gamiContent = await vault.readFile(GAMI_FILE);   // READ
const gamiData = parseGamification(gamiContent);        // PARSE
const newData = updateProfileInData(gamiData, ...);     // MUTATE
await vault.writeFile(GAMI_FILE, serializeGamification(newData)); // WRITE
```

When two calls overlap:
```
Task A: READ → (gamiContent_A = base state)
Task B: READ → (gamiContent_B = base state)   ← reads SAME base
Task A: WRITE → (base + 10 XP)
Task B: WRITE → (base + 10 XP)   ← overwrites A; net: +10 instead of +20
```

This happens because `completeTask` is called on every task checkbox tap, and a family member can complete multiple tasks in rapid succession before the first write finishes (iCloud-coordinated writes take 50-200ms on device).

#### The same pattern exists in:
- `useGamification.ts` → `completeTask` (line 84): writes `gamification.md`
- `useGamification.ts` → `openLootBox` (line 176): writes `gamification.md`
- `useVault.ts` → `completeSagaChapter` (line 3148): writes `gamification.md`
- `useVault.ts` → `completeAdventure` (line 3173): writes `gamification.md`
- `useVault.ts` → `buyMascotItem` (line 1235): writes `gamification.md`
- `VaultManager.toggleTask` (line 305): writes task files (same race on bulk-toggle)

#### Write queue implementation

Add a per-file serialization queue to `VaultManager`:

```typescript
// lib/vault.ts — add to VaultManager class
private _writeQueues = new Map<string, Promise<void>>();

/** Serialize all writes to the same relative path */
private enqueueWrite(relativePath: string, fn: () => Promise<void>): Promise<void> {
  const prev = this._writeQueues.get(relativePath) ?? Promise.resolve();
  const next = prev.then(fn, fn); // always advance even on error
  this._writeQueues.set(relativePath, next);
  // Prevent memory leak: clean up after each chain resolves
  next.finally(() => {
    if (this._writeQueues.get(relativePath) === next) {
      this._writeQueues.delete(relativePath);
    }
  });
  return next;
}

/** Write a file — serialized per path */
async writeFile(relativePath: string, content: string): Promise<void> {
  return this.enqueueWrite(relativePath, () => this._writeFileDirect(relativePath, content));
}

private async _writeFileDirect(relativePath: string, content: string): Promise<void> {
  // ... existing writeFile body ...
}
```

**Critical:** `toggleTask` and `appendTask` also do `read → modify → write` internally. They must use `enqueueWrite` or be refactored to be atomic. The simplest approach: wrap their entire `read-modify-write` body inside `enqueueWrite`.

#### Queue guarantees
- All pending writes to `gamification.md` execute in arrival order
- Each write starts only after the previous write has fully resolved
- No lost updates: `Task B` will read the result of `Task A`'s write
- Queue is per VaultManager instance (single instance in the app via `vaultRef.current`)

### QUAL-03: Color Token Migration

#### Inventory

Total: ~281 hardcoded hex occurrences (246 single-quote + 35 double-quote).

**By file (top offenders):**
| File | Count | Category |
|------|-------|----------|
| `components/LootBoxOpener.tsx` | 99 | Cosmetic (loot box art, themed box skins) |
| `components/mascot/TreeView.tsx` | 49 | SVG art + cosmetic (seasonal colors) |
| `components/mascot/HarvestBurst.tsx` | 11 | Cosmetic (harvest particle colors) |
| `components/ui/LivingGradient.tsx` | 10 | Cosmetic (time-of-day gradient palette) |
| `app/(tabs)/more.tsx` | 13 | REPLACEABLE (menu item `color:` field + text) |
| `app/_layout.tsx` | 7 | REPLACEABLE (loading overlay bg, error text) |
| `components/VaultPicker.tsx` | 7 | REPLACEABLE (button colors, error states) |
| `app/(tabs)/tasks.tsx` | 6 | MIXED (WEATHER_COLORS cosmetic; text colors replaceable) |
| `components/TaskCard.tsx` | 6 | MIXED (category colors = cosmetic data, text replaceable) |
| `lib/gamification/engine.ts` | 9 | COSMETIC (LEVEL_TIERS colors — identity constants) |
| `lib/gamification/rewards.ts` | 5 | COSMETIC (RARITY_COLORS — identity constants) |

#### Three-tier classification

**Tier 1 — REPLACEABLE (must use `colors.*` tokens):**
- UI chrome: borders, backgrounds, text, inputs, error/success/warning states
- These break dark mode when hardcoded
- Examples: `'#EF4444'` → `colors.error`, `'#FFFFFF'` → `colors.onPrimary`, `'#1F2937'` → `colors.text`

**Tier 2 — COSMETIC CONSTANTS (exempt, define as named constants):**
- `RARITY_COLORS` in `rewards.ts` — data-driven colors tied to rarity identity, not theming
- `LEVEL_TIERS[*].color` in `engine.ts` — tier identity colors
- `TaskCard`'s per-category color map (`maxence`, `maison`, etc.)
- `LivingGradient` time-of-day palette
- `LootBoxOpener` themed loot box skins (Pokémon, Christmas, etc.)
- Golden crop `#FFD700` (cosmetic, already established in [Phase 06] decision)

**Tier 3 — SVG ART (exempt):**
- All colors in `TreeView.tsx` inside SVG/react-native-svg elements
- `HarvestBurst.tsx`, `FarmPlots.tsx`, `PixelDiorama.tsx` SVG pixel art
- Seasonal diorama colors (grass, water, stones) — intentional art direction

#### Migration pattern for Tier 1

```typescript
// AVANT
const styles = StyleSheet.create({
  errorText: { color: '#EF4444' },
  border: { borderColor: '#E5E7EB' },
});

// APRÈS
export function MyComponent() {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <Text style={{ color: colors.error }}>...</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { /* static props only */ },
});
```

**Rule:** `StyleSheet.create` cannot reference `colors.*` (evaluated once at module load, before theme is known). Dynamic theme-dependent values go inline or in computed style objects within the component body.

#### High-priority files for dark-mode fix

The `success: { color: '#16a34a' }` in `app/setup.tsx:1450` and the loading overlay colors in `app/_layout.tsx` are visible on every launch — fix first.

### GAME-01: XP Budget Model

#### Existing economy (verified from source)

| Parameter | Value | Source |
|-----------|-------|--------|
| Base XP per task | 10 pts | `POINTS_PER_TASK = 10` in `rewards.ts:153` |
| Streak bonus (2+ days) | +5 pts | `calculateStreakBonus` → milestone bonus |
| Streak bonus (7+ days) | +10 pts | `STREAK_MILESTONES[2].bonus` |
| Streak bonus (14+ days) | +15 pts | `STREAK_MILESTONES[1].bonus` |
| Streak bonus (30+ days) | +25 pts | `STREAK_MILESTONES[0].bonus` |
| Loot box threshold (enfant) | 50 pts | `LOOT_THRESHOLD.enfant` |
| Loot box threshold (ado) | 75 pts | `LOOT_THRESHOLD.ado` |
| Loot box threshold (adulte) | 100 pts | `LOOT_THRESHOLD.adulte` |
| Max level | 50 | `MAX_LEVEL = 50` |
| XP for level n (cumulative) | `50n² + 50n` | `xpForLevel(n)` in `engine.ts:614` |
| Pity threshold | 5 boxes | `PITY_THRESHOLD = 5` |

#### Level progression math

```
Level 1  : 0–100 XP     (100 XP gap)   = 10 tasks
Level 5  : 0–1500 XP    (400 XP gap)   = 40 tasks
Level 10 : 0–5500 XP    (950 XP gap)   = 95 tasks
Level 20 : 0–21000 XP   (1950 XP gap)  = 195 tasks
Level 50 : 0–127500 XP  (4950 XP gap)  = 495 tasks
```

#### XP budget model — school year scenario

Assumptions: child does 3 tasks/day × 5 days/week × 36 weeks = 540 tasks/year.

| Scenario | XP/task | Total XP | Level reached |
|----------|---------|----------|---------------|
| No streak | 10 | 5400 | ~10 |
| 7-day streak maintained | 20 | 10800 | ~14 |
| 14-day streak maintained | 25 | 13500 | ~16 |
| 30-day streak maintained | 35 | 18900 | ~19 |

**Finding:** With current formula, a highly engaged child reaches ~level 16-19 over a school year. Max level 50 is nearly unreachable (~12-25 school years). This is acceptable but should be documented so future reward sources know the XP value of their contributions.

#### XP budget model — documentation target

`constants/rewards.ts` should gain a `XP_BUDGET` export documenting the economy:

```typescript
// constants/rewards.ts (new section)
/**
 * XP Budget Model
 *
 * Baseline: 3 tasks/day × 5 days/week × 36 weeks = 540 tasks/year
 * Base XP per task: 10 pts
 * Streak bonus range: +5 to +25 pts/task
 *
 * Yearly XP range:
 *   No streak:  ~5 400 XP → Level ~10
 *   Max streak: ~18 900 XP → Level ~19
 *
 * Rule: any new XP source should be expressed as "equivalent tasks":
 *   - Adventure daily completion = 1 task equivalent (10 pts)
 *   - Saga chapter = 3 task equivalents (30 pts)
 *   - Défi completion = configurable, default 50 pts (5 tasks)
 *
 * Loot box pacing:
 *   enfant threshold 50 pts = 5 tasks per box = ~108 boxes/year (no streak)
 *   This is intentionally generous for children.
 */
export const XP_BUDGET = {
  tasksPerDayBudget: 3,
  daysPerWeekBudget: 5,
  weeksPerYearBudget: 36,
  /** Approx yearly XP without streaks */
  baselineYearlyXP: 5400,
  /** Target level range after 1 school year */
  targetLevelRange: [10, 19],
} as const;
```

#### Rule for new reward sources

Any new feature that awards XP (GAME-02 seasonal events, GAME-03 cooperative quests) must express its rewards in terms of "task equivalents" relative to `POINTS_PER_TASK`. This prevents inflation creep.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Write serialization | Custom lock file / flag | Promise chain queue Map | Lock files fail on crash; Promise chains are GC'd automatically |
| Write serialization | SQLite transactions | Promise queue in VaultManager | Markdown vault format must stay intact for Obsidian compatibility |
| Color migration | Color utility lib | `colors.*` tokens from `constants/colors.ts` | Already complete, already typed, already covers dark/light |
| XP progression curve | New formula | Existing `50n²+50n` | Already shipped, changing breaks existing users' levels |

**Key insight:** The write-queue problem requires zero new dependencies. A `Map<string, Promise<void>>` chaining pattern is idiomatic TypeScript and integrates cleanly into the existing `VaultManager` class without changing any call site.

---

## Common Pitfalls

### Pitfall 1: Queue memory leak on hot path
**What goes wrong:** If `_writeQueues.delete` is never called, the Map grows indefinitely as new files are written.
**Why it happens:** Promise chains keep references alive.
**How to avoid:** Call `.finally(() => { if (this._writeQueues.get(key) === next) this._writeQueues.delete(key) })` — only delete if no newer write has been queued.
**Warning signs:** Memory warnings in Instruments during long sessions.

### Pitfall 2: Error swallowing in the queue
**What goes wrong:** `prev.then(fn, fn)` — using the same `fn` as the rejection handler causes the queue to continue even when a write fails, but the error is lost.
**Why it happens:** If `fn` is used as rejection handler, errors in `prev` are swallowed.
**How to avoid:** Use `prev.then(fn).catch(fn)` or `prev.finally(fn)` only when you genuinely want to continue on error. For gamification writes, the write must succeed — propagate the error to the caller: `const next = prev.then(() => fn());`

### Pitfall 3: Replacing cosmetic colors with wrong semantic tokens
**What goes wrong:** `RARITY_COLORS.commun` is `'#9CA3AF'` which looks like `colors.textFaint`. Replacing it with `colors.textFaint` means a dark-mode redesign breaks loot box rendering.
**Why it happens:** Coincidental color value match.
**How to avoid:** Never replace a named constant (defined at module level with semantic meaning) with a theme token. Only replace anonymous inline hex literals in StyleSheet props like `backgroundColor`, `color`, `borderColor`.

### Pitfall 4: StyleSheet.create with colors.*
**What goes wrong:** `StyleSheet.create({ text: { color: colors.text } })` — `colors` is undefined at module load time, returns `undefined`.
**Why it happens:** StyleSheet.create runs once at module evaluation, before any hook is called.
**How to avoid:** Dynamic (theme-dependent) styles always go inline or in a computed object inside the component function. Static (non-theme) styles only in StyleSheet.create.

### Pitfall 5: XP model change breaking existing saves
**What goes wrong:** Changing `POINTS_PER_TASK` or `xpForLevel` formula without migration means existing users' `points` in `gamification.md` no longer correspond to correct levels.
**Why it happens:** `calculateLevel(points)` is a pure formula applied to the raw int in the file.
**How to avoid:** Do NOT change `xpForLevel` formula or `POINTS_PER_TASK` in this phase. The XP budget model is documentation only — constants remain untouched unless a deliberate calibration decision is made with migration path.

### Pitfall 6: toggleTask not protected by write queue
**What goes wrong:** `VaultManager.toggleTask` does `readFile → modify → writeFile` internally. If two tasks in the same file are toggled simultaneously, the second overwrites the first.
**Why it happens:** `writeFile` gets queued, but `toggleTask` still does its own read before the first write completes.
**How to avoid:** `toggleTask` (and `appendTask`) must enqueue their entire `read-modify-write` body, not just the `writeFile` call.

---

## Code Examples

Verified patterns from codebase:

### Write queue — minimal correct implementation
```typescript
// lib/vault.ts — inside VaultManager class
private _writeQueues = new Map<string, Promise<void>>();

private enqueueWrite(relativePath: string, fn: () => Promise<void>): Promise<void> {
  const prev = this._writeQueues.get(relativePath) ?? Promise.resolve();
  const next = prev.then(() => fn());   // propagates errors to caller
  this._writeQueues.set(relativePath, next);
  next.finally(() => {
    if (this._writeQueues.get(relativePath) === next) {
      this._writeQueues.delete(relativePath);
    }
  });
  return next;
}
```

### toggleTask protected by queue
```typescript
// lib/vault.ts
async toggleTask(relativePath: string, lineIndex: number, completed: boolean): Promise<void> {
  return this.enqueueWrite(relativePath, async () => {
    const content = await this._readFileDirect(relativePath);
    // ... existing modification logic ...
    await this._writeFileDirect(relativePath, lines.join('\n'));
  });
}
```

### Color token migration — dynamic style pattern
```typescript
// PATTERN: theme-dependent props inline, static props in StyleSheet
function TaskCard({ task }: TaskCardProps) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{task.text}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 8, borderWidth: 1, padding: 12 },  // static only
  title: { fontSize: 16, fontWeight: '500' },               // static only
});
```

### XP budget constants — documentation form
```typescript
// constants/rewards.ts (addend)
export const XP_BUDGET = {
  tasksPerDayBudget: 3,
  daysPerWeekBudget: 5,
  weeksPerYearBudget: 36,
  baselineYearlyXP: 5400,   // 3 * 5 * 36 * POINTS_PER_TASK
  targetLevelRange: [10, 19] as [number, number],
} as const;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No write serialization | Promise queue per file | Phase 2 | Prevents XP loss on rapid completions |
| Hardcoded hex in StyleSheet.create | `colors.*` tokens + inline dynamic styles | Phase 2 | Dark mode fully consistent |
| Undocumented XP constants | `XP_BUDGET` documented model | Phase 2 | Future reward sources have calibration reference |

**Deprecated/outdated:**
- Anonymous `'#EF4444'` in UI StyleSheets: replaced with `colors.error`
- Anonymous `'#FFFFFF'` in button text: replaced with `colors.onPrimary`
- Anonymous `'#F9FAFB'` in loading screens: replaced with `colors.bg`

---

## Open Questions

1. **toggleTask race on same task file across multiple profiles**
   - What we know: Each task file (e.g. `01 - Enfants/Lucas/Tâches récurrentes.md`) is a single markdown file. Multiple profiles don't share the same task file. Race is low-probability in practice but theoretically possible if two people tap simultaneously.
   - What's unclear: Whether NSFileCoordinator's exclusive write lock on iOS handles this at the OS level (making the JS queue belt-and-suspenders) or whether JS-level coordination is the only protection.
   - Recommendation: Implement JS queue regardless — it is the correct layer for in-process serialization. NSFileCoordinator handles cross-process iCloud conflicts; they are complementary, not redundant.

2. **Color count discrepancy (requirement says 228, grep shows ~281)**
   - What we know: The grep includes colors in SVG art components (TreeView, FarmPlots, etc.) and cosmetic constants (RARITY_COLORS, LEVEL_TIERS) that were counted differently in the requirements definition.
   - What's unclear: Whether QUAL-03 "228 couleurs hardcodées" counts only Tier 1 (truly replaceable) or all literal hex strings.
   - Recommendation: Tier 1 (replaceable UI colors) is the real target. SVG art and cosmetic constants are exempt. Planner should scope tasks to Tier 1 files only, but test dark mode in all screens.

3. **GamificationConfig in SecureStore vs rewards.ts constants**
   - What we know: `DEFAULT_GAMI_CONFIG` in `rewards.ts` holds `pointsPerTask: 10` and `lootThreshold`, but the user-facing settings can override these via `saveGamiConfig`. The `XP_BUDGET` model must be based on the defaults, not the user-overridden values.
   - What's unclear: Whether the XP budget model should account for user-customized thresholds.
   - Recommendation: Document against defaults only; note that user customization exists.

---

## Sources

### Primary (HIGH confidence)
- `/hooks/useGamification.ts` — race condition pattern confirmed in `completeTask` (line 70-84) and `openLootBox` (line 176)
- `/lib/vault.ts` — VaultManager.writeFile, toggleTask, appendTask — no write serialization present
- `/lib/gamification/engine.ts` — XP formula `50n²+50n`, `MAX_LEVEL=50`, `LEVEL_TIERS` with hex colors
- `/lib/gamification/rewards.ts` — `POINTS_PER_TASK=10`, `LOOT_THRESHOLD`, `RARITY_COLORS`, `DROP_RATES`
- `/constants/colors.ts` — Full `LightColors`/`DarkColors` semantic token inventory (complete)
- `/contexts/ThemeContext.tsx` — `useThemeColors()` API confirmed: returns `{ primary, tint, colors, isDark, ... }`
- Grep analysis of `components/` and `app/` — 281 hardcoded hex occurrences across 31 files

### Secondary (MEDIUM confidence)
- STATE.md blocker note: "Le pattern async mutex pour expo-file-system sur iOS avec NSFileCoordinator n'est pas spécifié. Besoin d'un spike 2-4h." — confirms write queue is the identified solution

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Write queue architecture: HIGH — race condition directly visible in source; pattern is idiomatic JS
- Color inventory: HIGH — grepped from source; counts verified
- Color tier classification: HIGH — based on semantic analysis of each file's purpose
- XP budget math: HIGH — pure arithmetic from verified constants
- StyleSheet.create limitation: HIGH — React Native documented behavior

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (stable domain; no external library dependencies)
