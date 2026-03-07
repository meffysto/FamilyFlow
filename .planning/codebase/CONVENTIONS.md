# Coding Conventions

**Analysis Date:** 2026-03-07

## Naming Patterns

**Files:**
- Screen files: lowercase with hyphens, `.tsx` extension: `index.tsx`, `tasks.tsx`, `rdv.tsx`
- Component files: PascalCase, `.tsx` extension: `DashboardCard.tsx`, `TaskCard.tsx`, `RDVEditor.tsx`
- Hook files: camelCase prefixed with `use`, `.ts` extension: `useVault.ts`, `useGamification.ts`
- Library files: camelCase, `.ts` extension: `gamification.ts`, `parser.ts`, `telegram.ts`
- Context files: PascalCase suffixed with `Context`, `.tsx` extension: `ThemeContext.tsx`

**Functions:**
- Components: PascalCase — `DashboardCard`, `TaskCard`, `RDVEditor`
- Hooks: camelCase prefixed with `use` — `useVault`, `useThemeColors`, `useGamification`
- Event handlers: camelCase prefixed with `handle` or `on` — `handleTaskToggle`, `handleSendRecap`, `onRefresh`
- Pure utility functions: camelCase — `addPoints`, `parseTask`, `buildLeaderboard`, `formatDateForDisplay`
- Builder functions: camelCase prefixed with `build` — `buildWeeklyRecapText`, `buildManualContext`
- Sender/dispatcher functions: camelCase prefixed with `send` or `dispatch` — `sendTelegram`, `dispatchNotification`

**Variables:**
- camelCase throughout: `vaultPath`, `menageTasks`, `activeProfile`, `gamiData`
- Boolean states: `is` or `has` prefix — `isLoading`, `isSendingRecap`, `hasVault`, `hasPhoto`
- Module-level constants: UPPER_SNAKE_CASE — `TASK_REGEX`, `TELEGRAM_API`, `VAULT_PATH_KEY`, `TAG_COLORS`
- Config constants: UPPER_SNAKE_CASE — `POINTS_PER_TASK`, `LOOT_THRESHOLD`, `DROP_RATES`, `PITY_THRESHOLD`

**Types:**
- Interfaces: PascalCase — `Task`, `RDV`, `Profile`, `VaultState`, `CourseItem`
- Props interfaces: PascalCase suffixed with `Props` — `TaskCardProps`, `RDVEditorProps`
- Hook result interfaces: PascalCase suffixed with `Result` — `UseGamificationResult`
- Hook args interfaces: PascalCase suffixed with `Args` — `UseGamificationArgs`
- Type unions: PascalCase — `LootRarity`, `RewardType`, `NotifEvent`, `MemoryType`

## Code Style

**Formatting:**
- No auto-formatter config detected (no `.prettierrc`, no `biome.json`)
- 2-space indentation throughout all source files
- Single quotes for strings
- Trailing commas in multi-line object/array literals
- Closing braces on own line

**Linting:**
- No ESLint config detected
- TypeScript `strict: true` enforced via `tsconfig.json`
- Path alias `@/*` maps to project root (configured in `tsconfig.json` but not actively used in source files)

## Import Organization

**Order (observed pattern):**
1. React and React Native core (`react`, `react-native`)
2. Expo SDK (`expo-router`, `expo-image-picker`, `expo-secure-store`, `expo-haptics`)
3. Third-party libraries (`date-fns`, `gray-matter`)
4. Internal hooks (`../../hooks/useVault`)
5. Internal contexts (`../../contexts/ThemeContext`)
6. Internal components (`../../components/DashboardCard`)
7. Internal lib functions and types (`../../lib/gamification`, `../../lib/types`)

**Path Style:**
- Relative paths only — the `@/` alias is not used despite being configured
- Depth-correct relative paths: `../lib/types` from hooks, `../../lib/types` from screens

## Error Handling

**Patterns:**
- Try/catch with `Alert.alert()` for all user-facing errors in screen/hook code
- Non-critical side effects (gamification) silently swallowed with explanatory comment:
  ```typescript
  } catch {
    // Gamification error — non-critical
  }
  ```
- Network/API functions return `boolean` for success/failure — no thrown errors:
  ```typescript
  export async function sendTelegram(...): Promise<boolean> {
    try { ... return res.ok; } catch { return false; }
  }
  ```
- Optimistic updates reverted on error by calling `refresh()` in catch:
  ```typescript
  } catch (e) {
    Alert.alert('Erreur', `Impossible de modifier la tâche : ${e}`);
    await refresh();
  }
  ```
- Error type annotation: `catch (e)` with `String(e)` for display; `catch (e: any)` with `e?.message || String(e)` for richer messages
- Hooks throw `new Error('...')` for invalid preconditions: `if (!vault) throw new Error('Vault non initialisé')`

## Logging

**Framework:** None — no logging library

**Patterns:**
- No `console.log` calls in production paths
- All errors surfaced to user via `Alert.alert()`
- Deprecated functions tagged with `@deprecated` JSDoc and replacement guidance

## Comments

**When to Comment:**
- Every file has a JSDoc block at the top describing purpose, data sources, and key behaviors
- Section dividers use Unicode box-drawing characters: `// ─── Section Name ──────────`
- Inline comments explain non-obvious behavior: optimistic updates, race conditions, non-critical paths
- Deprecated functions annotated with `@deprecated` tag and migration path

**File header pattern:**
```typescript
/**
 * parser.ts — Markdown & YAML frontmatter parsers
 *
 * Handles all coffre vault formats:
 * - Obsidian Tasks plugin format: - [ ] Text 🔁 every day 📅 YYYY-MM-DD
 * - RDV frontmatter (gray-matter)
 */
```

**Interface field comments:** Inline `//` comments on interface properties to document semantics:
```typescript
export interface Task {
  id: string;
  lineIndex: number;      // line index in file (0-based, for writes)
  section?: string;       // H2/H3 section header above this task
}
```

## Function Design

**Size:** Pure lib functions are small and focused. Screen render functions are larger (100–250 lines for complex screens like `app/(tabs)/index.tsx`).

**Parameters:**
- Hooks accept a single typed args object: `useGamification({ vault, notifPrefs, onDataChange? })`
- Pure functions use positional parameters: `parseTask(line, lineIndex, sourceFile, section?)`
- Optional parameters use `?` suffix

**Return Values:**
- Parse functions return typed entity or `null` on failure: `Task | null`
- Async service functions return `Promise<boolean>` for success/failure
- Mutation functions return enriched result objects: `{ profile: Profile; entry: GamificationEntry; lootAwarded: boolean }`

## Component Design

**Exports:**
- Named exports for all reusable components: `export function DashboardCard(...)`, `export const TaskCard = React.memo(...)`
- Default exports for screen/layout files only: `export default function DashboardScreen()`
- Named exports for all hooks and lib functions

**Memoization:**
- `React.memo()` on list-item components receiving stable callbacks: `TaskCard` in `components/TaskCard.tsx`
- `useCallback()` on all event handlers passed as props or referenced in `useEffect` deps
- `useMemo()` in context providers for stable context value objects: `contexts/ThemeContext.tsx`

**Styling:**
- All styles defined via `StyleSheet.create()` at the bottom of each file
- No inline style objects except for dynamic theme-color overrides: `[styles.base, { backgroundColor: primary }]`
- Consistent Tailwind-inspired hex color palette: `#111827` (gray-900), `#6B7280` (gray-500), `#EF4444` (red-500), `#10B981` (emerald-500), `#7C3AED` (violet-600) as default primary
- Theme colors injected via `useThemeColors()` from `contexts/ThemeContext.tsx` — never hardcode `#7C3AED` in components

## Module Design

**Barrel files:** Not used — each module imported directly by path

**Layer separation:**
- `lib/` — pure functions, parsers, serializers, API clients (no React imports)
- `hooks/` — React state management, side effects, vault I/O orchestration
- `contexts/` — React Context providers (theme only)
- `components/` — reusable UI widgets
- `app/` — screen-level components (Expo Router file-based routing)
- `constants/` — static configuration tables (`themes.ts`, `rewards.ts`)

---

*Convention analysis: 2026-03-07*
