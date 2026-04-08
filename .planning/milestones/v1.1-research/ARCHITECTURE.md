# Architecture Patterns

**Domain:** Family productivity + gamification mobile app (React Native / Expo)
**Researched:** 2026-03-28
**Confidence:** HIGH (analysis based on direct codebase inspection + verified patterns)

---

## Current Architecture Snapshot

The app uses a **Provider-over-God-Hook** pattern. A single `useVaultInternal()` (3431 lines, 140KB) holds all vault state and ~80+ actions. `VaultContext` simply wraps this hook in a React context and re-exports it. No state library (Redux, Zustand) is in use — everything lives in React state inside the god hook.

**What already exists as separate hooks:**
- `useGamification.ts` (8.1K) — task completion, loot box opening; receives `vault` as prop
- `useFarm.ts` (8.6K) — farm planting/harvesting
- `useCalendarEvents.ts` (3.9K) — calendar event queries
- `useStatsData.ts` (3.6K) — computed stats
- `useAnimConfig.ts`, `useResponsiveLayout.ts`, `useRefresh.ts` — utility hooks

The extraction pattern already exists: `useGamification` is a domain hook that takes `vault: VaultManager | null` as a prop and calls `onDataChange` to push state updates back up. This is the confirmed pattern to follow.

---

## Recommended Target Architecture

### Component Boundaries

```
┌─────────────────────────────────────────────────────┐
│  VaultProvider (contexts/VaultContext.tsx)           │
│  ─ assembles all domain hooks                       │
│  ─ exposes unified VaultState interface             │
│  ─ owns VaultManager instance                       │
│  ─ owns loadVaultData orchestration                 │
└──────────────┬──────────────────────────────────────┘
               │ passes (vault, onDataChange)
               ▼
┌──────────────────────────────────────────────────────┐
│  Domain Hooks (hooks/)                               │
│                                                      │
│  useTasks.ts        ← tasks, routines, recurring     │
│  useCalendar.ts     ← rdvs (rename useCalendarEvents)│
│  useMeals.ts        ← meals, courses (shopping list) │
│  useBudget.ts       ← budgetEntries, budgetConfig    │
│  useRecipes.ts      ← recipes (lazy-loadable)        │
│  useProfiles.ts     ← profiles, famille.md writes    │
│  useGamification.ts ← XP, loot, streaks (exists)    │
│  useFarm.ts         ← crops, animals (exists)        │
│  useJournal.ts      ← healthRecords, growthEntries   │
│  useDefis.ts        ← defis, gratitude, wishlist     │
│  useNotes.ts        ← notes, quotes, moods           │
│  useMemories.ts     ← photos, memories               │
│  useSkills.ts       ← skillTrees, secretMissions     │
│  useStock.ts        ← stock, stockSections           │
└──────────────┬───────────────────────────────────────┘
               │ call
               ▼
┌─────────────────────────────────────────────────────┐
│  Lib Layer (lib/)                                   │
│  ─ VaultManager (vault.ts)      — file I/O          │
│  ─ Parser system (parser.ts)    — MD serialization  │
│  ─ Gamification engine          — pure functions     │
│  ─ Mascot/farm engine           — pure functions     │
│  ─ Budget, skills, etc.         — pure functions     │
└─────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Communicates With |
|-----------|------|-------------------|
| `VaultProvider` | `VaultManager` instance, `loadVaultData()` orchestration, assembled `VaultState` | All domain hooks (provides vault + onDataChange) |
| `useTasks` | `tasks[]`, task CRUD, routines, recurring task logic | VaultManager (R/W), gamification via onDataChange callback |
| `useCalendar` | `rdvs[]`, RDV CRUD, notification scheduling | VaultManager (R/W), `lib/scheduled-notifications` |
| `useMeals` | `meals[]`, `courses[]`, course CRUD, shopping list merge | VaultManager (R/W) |
| `useBudget` | `budgetEntries[]`, `budgetConfig`, month navigation | VaultManager (R/W), `lib/budget` |
| `useRecipes` | `recipes[]` (lazy-loaded), CRUD, favorites, images | VaultManager (R/W), `lib/cooklang` |
| `useProfiles` | `profiles[]`, `activeProfile`, `famille.md` mutations | VaultManager (R/W), triggers gamiData reload |
| `useGamification` | XP logic, loot box, streaks, `gamiData` | VaultManager (R/W), `lib/gamification/engine` |
| `useFarm` | Crops, animals, grid state | VaultManager (R/W), `lib/mascot/farm-engine` |
| `useJournal` | `healthRecords[]`, growth, vaccines, journal stats | VaultManager (R/W), `lib/journal-stats` |
| `useDefis` | `defis[]`, `gratitudeDays[]`, `wishlistItems[]` | VaultManager (R/W) |
| `useNotes` | `notes[]`, `quotes[]`, `moods[]` | VaultManager (R/W) |
| `useMemories` | `memories[]`, `photoDates[]`, vacation config | VaultManager (R/W), `lib/thumbnails` |
| `useSkills` | `skillTrees[]`, `secretMissions[]`, `anniversaries[]` | VaultManager (R/W), `lib/gamification/skill-tree` |
| `useStock` | `stock[]`, `stockSections[]` | VaultManager (R/W), `constants/stock` |

---

## Data Flow

### Read Flow (startup / refresh)

```
App foreground / manual refresh
        │
        ▼
VaultProvider.loadVaultData(vault)
        │
        ├─ vault.readFile('famille.md')   ─→ parseFamille() ─→ setProfiles()
        ├─ vault.readFile('gamification.md') ─→ parseGamification() ─→ setGamiData()
        ├─ vault.readFile(taskFiles[])    ─→ parseTaskFile() ─→ setTasks()
        ├─ vault.readFile('meals/*.md')   ─→ parseMeals() ─→ setMeals()
        ├─ vault.readFile('budget/*.md')  ─→ parseBudget() ─→ setBudget()
        └─ ... (16+ concurrent reads via Promise.allSettled)
        │
        ▼
Domain hooks receive updated state (via setState callbacks)
        │
        ▼
VaultContext re-renders, screens consume new state
```

**After refactoring:** `loadVaultData` stays in VaultProvider but calls each domain hook's `reload()` method. Each domain hook owns its own `useState` and exposes a `reload(vault)` function.

### Write Flow (user action)

```
Screen calls action from useVault()
        │
        ▼
Domain hook action (e.g., useTasks.addTask)
        │
        ├─ serialize updated data (lib/parser.ts)
        ├─ vault.writeFile() — NSFileCoordinator on iOS
        ├─ setState optimistically (local state update)
        └─ optionally: trigger gamification via useGamification.completeTask()
        │
        ▼
VaultContext exposes new state, screen re-renders
        │
        ▼
Obsidian vault file → iCloud sync (automatic)
```

### Gamification Event Flow (current + target)

**Current (problematic):** Task completion in useVault toggles task + calls gamification inline, mixing concerns.

**Target (event-driven):**
```
useTasks.toggleTask(taskId)
        │
        ├─ write updated task file
        ├─ dispatch GamificationEvent { type: 'TASK_COMPLETED', profileId, taskText }
        │
        ▼
useGamification receives event (via callback prop from VaultProvider)
        │
        ├─ awardTaskCompletion() — pure function
        ├─ write gamification.md
        └─ onDataChange(updatedProfiles)  — bubbles back to VaultProvider
```

This is the pattern `useGamification` already implements via its `onDataChange` callback. All domain hooks that trigger XP should follow the same pattern.

---

## Progressive Refactoring Strategy

The critical constraint: **no big bang**. The app is in TestFlight. Each step must leave the app functional.

### Phase 1: Extract Leaf Domains (safest, most independent)

Leaf domains = domains with no dependencies on other vault state. Start here.

**Order (safest first):**

1. **`useDefis`** — defis, gratitude, wishlist are isolated (own files, no cross-domain reads)
2. **`useBudget`** — budget reads/writes only budget files, lib/budget.ts is separate
3. **`useNotes`** — notes, quotes, moods are independent write domains
4. **`useStock`** — stock reads/writes, no cross-domain dependencies

**Extraction technique for each:**
```
Step A: Identify all state vars and actions in useVault.ts for the domain
Step B: Create hooks/useDomain.ts with same signature (takes vault prop, returns actions)
Step C: In useVaultInternal(), call useDomain({ vault }) and spread its return into the useMemo
Step D: Verify app still works (tsc + manual TestFlight)
Step E: Remove the extracted code from useVault.ts
```

The `useMemo` at line 3402 is the composition point — adding a domain hook means spreading its result into the existing return object with zero consumer-facing API change.

### Phase 2: Extract Mid-Tier Domains

Domains that depend on `profiles` or `gamiData` being loaded first.

**Order:**
1. **`useSkills`** — skill trees, secret missions, anniversaries
2. **`useMemories`** — photos, vacation config (reads profile for active profile ID)
3. **`useJournal`** — health records, growth (reads active profile ID)

### Phase 3: Extract Core Domains

Domains deeply intertwined with the god hook's load sequence.

**Order:**
1. **`useTasks`** — reads `enfantNames` from profiles (dependency), handles recurring; requires profiles to be loaded first
2. **`useMeals`** + **`useStock`** (if not done in Phase 1)
3. **`useCalendar`** (rename + merge with existing `useCalendarEvents`)
4. **`useRecipes`** — add lazy loading during this extraction

### Phase 4: Extract Profiles + Compose VaultProvider

After all domain hooks are extracted:
1. **`useProfiles`** — profiles, famille.md writes (depended on by all other hooks)
2. **`VaultProvider`** becomes a pure composer that:
   - Owns VaultManager instantiation
   - Calls all domain hooks with `vault` prop
   - Assembles the full `VaultState` from all domain hook returns
   - Manages `loadVaultData` orchestration

---

## VaultProvider Composition Pattern

The target VaultProvider (post-refactor) looks like:

```typescript
export function VaultProvider({ children }) {
  const [vault, setVault] = useState<VaultManager | null>(null);
  // ...vault setup...

  const profiles = useProfiles({ vault, onDataChange: handleProfileChange });
  const tasks = useTasks({ vault, profiles: profiles.profiles, onXP: gamification.onXP });
  const meals = useMeals({ vault });
  const budget = useBudget({ vault });
  const gamification = useGamification({ vault, notifPrefs, onDataChange: profiles.setProfiles });
  const farm = useFarm({ vault });
  // ...etc

  const value = useMemo(() => ({
    // infra
    vaultPath, isLoading, error, vault, refresh,
    // domain slices
    ...profiles,
    ...tasks,
    ...meals,
    ...budget,
    ...gamification,
    ...farm,
    // ...etc
  }), [profiles, tasks, meals, budget, gamification, farm, /* ... */]);

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
```

**Key benefit:** The public API (`useVault()`) stays identical for all consumers. Zero screen changes during refactoring.

**Performance benefit:** Each domain hook's `useMemo` dependency array shrinks from ~90 items to ~10-15 items. React's shallow comparison work drops proportionally.

---

## Gamification System Architecture

### Current Structure

The gamification system already has a clean layered design:

```
lib/gamification/
  engine.ts        — addPoints, openLootBox, streak logic, pity system
  rewards.ts       — DROP_RATES, reward pool definitions
  seasonal-rewards.ts — seasonal items
  seasonal.ts      — season detection, seasonal draws
  skill-tree.ts    — skill nodes, unlock logic, XP brackets

lib/mascot/
  engine.ts        — tree stages, decoration placement
  farm-engine.ts   — crop lifecycle (plant → grow → harvest)
  sagas-engine.ts  — narrative saga progression
  sagas-content.ts — saga text/choices
  world-grid.ts    — pixel grid rendering logic
  types.ts         — all mascot/tree/farm types
```

All these are **pure functions** operating on serializable data. This is the right architecture — no React coupling in the business logic.

### Target: Event-Driven Gamification

The weakness is in the hook layer: `useVault.ts` calls gamification inline (mixed concerns). The target is an event dispatcher pattern:

```typescript
// lib/gamification/events.ts (new)
export type GamificationEvent =
  | { type: 'TASK_COMPLETED'; profileId: string; taskText: string; taskType: 'recurring' | 'one-shot' }
  | { type: 'DEFI_COMPLETED'; profileId: string; defiId: string }
  | { type: 'STREAK_EXTENDED'; profileId: string; days: number }
  | { type: 'SECRET_MISSION_DONE'; profileId: string; missionId: string }
  | { type: 'SKILL_UNLOCKED'; profileId: string; skillId: string }
  | { type: 'PHOTO_ADDED'; profileId: string }
  | { type: 'GRATITUDE_ADDED'; profileId: string };

// Each domain hook emits events; useGamification consumes them
// useGamification receives: onEvent callback from VaultProvider
```

**Why not XState or a full state machine library?** The current gamification logic is point-accumulation with threshold checks (not complex concurrent states). XState adds significant bundle size and learning curve for what is essentially: `points += base * multiplier; if (points >= threshold) { emit loot }`. Reserve XState for saga narrative progression if sagas grow complex.

### Gamification State Machines (where they help)

The one area where state machines genuinely help is **saga progression**, which has explicit states (not-started → chapter1 → chapter2 → completed) with guarded transitions. A lightweight hand-rolled reducer is sufficient:

```typescript
// lib/mascot/sagas-engine.ts (existing) — already has chapter/state tracking
// Add explicit state enum instead of boolean flags:
type SagaState = 'locked' | 'available' | 'in_progress' | 'completed' | 'expired';
```

No external state machine library needed for the current scope.

---

## Testing Architecture

### Testing Pyramid for This App

```
         ┌─────────────────┐
         │   E2E (Maestro) │  ~10% effort
         │  3-5 core flows │
         └────────┬────────┘
         ┌────────┴────────────┐
         │  Component (RNTL)  │  ~20% effort
         │  critical screens  │
         └────────┬────────────┘
    ┌─────────────┴──────────────────┐
    │  Unit (Jest) — already good   │  ~70% effort
    │  lib/ + domain hooks          │
    └────────────────────────────────┘
```

**Current state:** 13 test files, all in `lib/__tests__/`, all unit tests. Good foundation. Gap is hooks and components.

### Layer 1: Unit Tests (extend what exists)

**Target files to add (in order of risk):**

| File | Test Type | Priority |
|------|-----------|----------|
| `lib/budget.ts` | Unit | HIGH — no tests, financial data |
| `lib/mascot/farm-engine.ts` | Unit | HIGH — complex crop lifecycle |
| `lib/mascot/sagas-engine.ts` | Unit | MEDIUM — narrative state transitions |
| `lib/mascot/world-grid.ts` | Unit | MEDIUM — grid rendering logic |
| `lib/gamification/skill-tree.ts` | Unit | MEDIUM — unlock logic |

Framework: Jest (pre-configured by Expo). These files have zero React dependency — plain TypeScript functions.

### Layer 2: Hook Tests (new territory)

Use `renderHook` from `@testing-library/react-native` (RNTL v12+ includes it natively — no separate `react-hooks-testing-library` needed).

**Pattern for domain hooks after extraction:**

```typescript
// hooks/__tests__/useBudget.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useBudget } from '../useBudget';

// Mock VaultManager
const mockVault = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
};

test('addExpense updates budgetEntries', async () => {
  mockVault.readFile.mockResolvedValue('... budget markdown ...');
  const { result } = renderHook(() => useBudget({ vault: mockVault as any }));

  await act(async () => {
    await result.current.addExpense({ amount: 50, category: 'courses', note: 'test' });
  });

  expect(mockVault.writeFile).toHaveBeenCalledWith(
    expect.stringContaining('budget'),
    expect.stringContaining('50')
  );
});
```

**Key constraint:** Mock `VaultManager` entirely. Domain hooks take `vault` as a prop specifically to enable this injection pattern.

**Priority order for hook tests:**
1. `useGamification` — already isolated, high business value
2. `useBudget` (after extraction)
3. `useTasks` (after extraction) — most complex, highest risk

### Layer 3: Component Tests (RNTL)

Use `@testing-library/react-native` with a `renderWithProviders` helper that wraps in minimal context:

```typescript
// test-utils.tsx
function renderWithProviders(ui: ReactElement, { vaultState = mockVaultState } = {}) {
  return render(
    <VaultContext.Provider value={vaultState}>
      <ThemeContext.Provider value={mockTheme}>
        {ui}
      </ThemeContext.Provider>
    </VaultContext.Provider>
  );
}
```

**Priority screens to test:**
1. Task completion flow (touches gamification)
2. Budget entry addition
3. Profile switching (PIN gate)

Do NOT attempt to test `TreeView.tsx` (82KB SVG component) or `LootBoxOpener.tsx` at this level — too costly, use E2E.

### Layer 4: E2E Tests (Maestro)

Maestro is the recommended choice over Detox for Expo/EAS apps in 2025-2026. YAML-based, stable, EAS-native integration exists.

**3 flows to cover:**
1. Task completion → XP earned → level visible
2. Meal plan navigation → meal added
3. Budget entry → monthly total updated

These cover the three highest-regression-risk user paths.

**Configuration for EAS:** `eas.json` can trigger Maestro flows via `eas build --profile testing`. Expo's official docs cover the `Run E2E tests on EAS Workflows` pattern.

---

## Parser Architecture (lib/parser.ts → lib/parsers/)

The 2398-line `lib/parser.ts` should be split in parallel with hook extraction (not before, not after — simultaneously). Each domain hook extraction is the right moment to split out its parser:

```
lib/parsers/
  index.ts          ← barrel re-export (backward compat, no consumer changes)
  tasks.ts          ← parseTaskFile, parseRoutines, serializeRoutines
  meals.ts          ← parseMeals, parseCourses, formatMealLine
  budget.ts         ← (already in lib/budget.ts — merge or leave)
  rdv.ts            ← parseRDV, serializeRDV, rdvFileName
  profiles.ts       ← parseFamille, mergeProfiles, serializeGamification
  gamification.ts   ← parseGamification, serializeGamification
  stock.ts          ← parseStock, serializeStockRow, parseStockSections
  defis.ts          ← parseDefis, serializeDefis
  gratitude.ts      ← parseGratitude, serializeGratitude
  wishlist.ts       ← parseWishlist, serializeWishlist
  notes.ts          ← parseNote, serializeNote, noteFileName
  skills.ts         ← parseSkillTree, serializeSkillTree
  journal.ts        ← parseHealthRecord, serializeHealthRecord, parseJalons
  memories.ts       ← parseMemory (if exists), related serializers
  anniversaries.ts  ← parseAnniversaries, serializeAnniversaries
  moods.ts          ← parseMoods, serializeMoods
  quotes.ts         ← parseQuotes, serializeQuotes
  secrets.ts        ← parseSecretMissions, serializeSecretMissions
```

**lib/parsers/index.ts** re-exports everything that was in `lib/parser.ts`. No consumer (hooks, tests) needs to change their import path until a future cleanup phase.

---

## Patterns to Follow

### Pattern 1: Domain Hook with Vault Injection

**What:** Hook receives `vault: VaultManager | null` and `onDataChange?: (profiles: Profile[]) => void`
**When:** Every domain hook
**Why:** Enables independent testing (mock vault), clear ownership of file paths, avoids circular dependencies

```typescript
interface UseDomainArgs {
  vault: VaultManager | null;
  onDataChange?: (updated: DomainType[]) => void;  // only if affects shared state
}

export function useDomain({ vault, onDataChange }: UseDomainArgs) {
  const [items, setItems] = useState<DomainType[]>([]);

  const reload = useCallback(async (v: VaultManager) => {
    const content = await v.readFile(DOMAIN_FILE);
    setItems(parseDomain(content));
  }, []);

  const addItem = useCallback(async (item: NewItemType) => {
    if (!vault) return;
    // read → mutate → serialize → write → setState
  }, [vault]);

  return { items, addItem, reload };
}
```

### Pattern 2: Barrel Re-export for Backward Compatibility

**What:** New split files re-exported from the original file path
**When:** Every parser split, every lib split
**Why:** Consumers (screens, tests) need zero import changes during refactoring

```typescript
// lib/parsers/index.ts
export * from './tasks';
export * from './meals';
export * from './budget';
// ...

// lib/parser.ts (becomes a thin re-export)
export * from './parsers/index';
```

### Pattern 3: Optimistic State Update

**What:** setState immediately, then writeFile async
**When:** All CRUD actions
**Why:** No loading spinner for simple writes; consistent with current pattern; iCloud sync is eventually consistent anyway

### Pattern 4: Staggered Load for Non-Critical Data

**What:** Load current-week meals/tasks at boot; defer recipes, budget history, archived RDVs
**When:** `loadVaultData` refactor
**Why:** Reduces boot time; recipes (N×.cook files) are the biggest bottleneck

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Split Context Instead of Split Hook

**What:** Creating `TasksContext`, `BudgetContext`, etc. as separate contexts
**Why bad:** Breaks all consumers immediately (they use `useVault()`), causes "provider hell" in `_layout.tsx`, makes cross-domain actions (task completion → XP) complicated to coordinate
**Instead:** Keep ONE `VaultContext`, split only the hook implementation into domain hooks composed inside `VaultProvider`

### Anti-Pattern 2: Big Bang Extraction

**What:** Extracting all domains at once or doing it in a long-lived branch
**Why bad:** Integration conflicts, app breaks mid-refactor, hard to debug regressions
**Instead:** One domain per PR, extract + compose + delete in the same commit, verify TestFlight build after each

### Anti-Pattern 3: Global Event Bus for Gamification

**What:** A singleton EventEmitter or mitt instance for cross-hook communication
**Why bad:** Creates hidden coupling, impossible to test, ordering bugs (event fires before listener registered)
**Instead:** Explicit callback props — `useGamification({ ..., onDataChange })` — making dependencies visible and testable

### Anti-Pattern 4: Deeply Nested useMemo in Domain Hooks

**What:** Each domain hook building a deeply memoized object with 20+ dependencies
**Why bad:** Defeats the purpose of splitting the god hook
**Instead:** Each domain hook's useMemo covers only its own 5-15 state vars. VaultProvider's composition useMemo is the only place that assembles the full object.

### Anti-Pattern 5: Testing Through VaultContext

**What:** Writing hook tests that mount a full `VaultProvider`
**Why bad:** Requires mocking all 16+ file reads, slow, brittle
**Instead:** Test domain hooks in isolation with a mocked `VaultManager`

---

## Scalability Considerations

| Concern | Now (family of 4) | At 10K entries/profile | Mitigation |
|---------|-------------------|----------------------|-----------|
| Boot time | ~1-2s (16+ file reads) | 5-10s (large markdown) | Lazy load recipes + archived data; stat-before-read |
| Re-render cost | High (`useMemo` ~90 deps) | Worse | Domain hooks reduce to ~10-15 deps each |
| Gamification write race | busyRef guards loadVaultData only | Race risk on rapid tasks | Per-file write queue after domain extraction |
| Recipe storage | All .cook loaded at boot | Slow with 100+ recipes | Metadata cache (title+category); full parse on demand |
| gamification.md size | Grows with history | Large file slow to parse | Archive entries older than 90 days to separate file |

---

## Build Order Implications

The domain split dependencies create a natural build order:

```
Tier 0 (no deps):     lib tests (budget, farm-engine, sagas-engine, world-grid)
Tier 1 (independent): useDefis, useNotes, useStock  — no cross-domain reads
Tier 2 (needs vault): useBudget, useRecipes, useMemories  — vault I/O only
Tier 3 (needs profiles): useTasks, useJournal, useCalendar  — reads enfantNames
Tier 4 (needs tasks): useGamification (already exists; improve XP event pattern)
Tier 5 (assembler):   VaultProvider refactor to compose all domain hooks
Tier 6 (validation):  Gamification event dispatcher, ECS-lite for farm
```

**Phase implications:**
- **Stabilization phase** (nettoyage + tests) maps to Tier 0 — adding lib tests before touching hooks
- **Refactoring phase** (god hook split) maps to Tiers 1-5 — one tier per sprint
- **Gamification enrichment phase** maps to Tier 6 — only starts after Tier 4 is stable

Never start Tier N+1 until Tier N's domain hooks have TestFlight validation.

---

## Sources

- Direct codebase analysis: `hooks/useVault.ts`, `hooks/useGamification.ts`, `contexts/VaultContext.tsx`, `lib/gamification/engine.ts`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`
- [Separation of concerns with React hooks — Felix Gerschau](https://felixgerschau.com/react-hooks-separation-of-concerns/)
- [Modularizing React Applications — Martin Fowler](https://martinfowler.com/articles/modularizing-react-apps.html)
- [How to write performant React apps with Context — Developer Way](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context)
- [React Native Testing Guide 2026 — React Native Relay](https://reactnativerelay.com/article/complete-guide-testing-react-native-apps-2026-unit-tests-e2e-maestro)
- [The 3 Best React Native Testing Frameworks — Maestro](https://maestro.dev/insights/best-react-native-testing-frameworks)
- [renderHook — React Native Testing Library](https://oss.callstack.com/react-native-testing-library/docs/api/misc/render-hook)
- [Run E2E tests on EAS Workflows — Expo Docs](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [Event-Driven Architecture in JavaScript 2025 — DEV Community](https://dev.to/hamzakhan/event-driven-architecture-in-javascript-applications-a-2025-deep-dive-4b8g)
- [Building Gamified Mobile Experiences with React Native — Medium](https://medium.com/@TheblogStacker/building-gamified-mobile-experiences-with-react-native-in-2025-a1f5371685f4)

---

*Architecture research: 2026-03-28*
