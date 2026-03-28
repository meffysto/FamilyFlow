# Coding Conventions

**Analysis Date:** 2026-03-28

## Language & Locale

**Human language:** French is the primary language for UI text, commit messages, code comments, and domain variable names. English is used for technical identifiers (function names, type names, file headers).

**i18n:** All user-facing strings go through `react-i18next`. Use `const { t } = useTranslation()` in components. Translation files in `locales/fr/*.json` and `locales/en/*.json` across 5 namespaces: `common`, `gamification`, `help`, `insights`, `skills`. Default namespace: `common`. Fallback language: French. Config in `lib/i18n.ts`.

**Date display format:** DD/MM/YYYY (French convention). Use `formatDateLocalized()` from `lib/date-locale.ts`.

## Naming Patterns

**Files:**
- Screen files: lowercase, `.tsx` extension (`index.tsx`, `tasks.tsx`, `rdv.tsx`, `meals.tsx`)
- Component files: PascalCase, `.tsx` (`DashboardCard.tsx`, `TaskCard.tsx`, `RDVEditor.tsx`)
- Hook files: camelCase with `use` prefix, `.ts` (`useVault.ts`, `useGamification.ts`)
- Library files: kebab-case or camelCase, `.ts` (`ai-service.ts`, `calendar-aggregator.ts`, `parser.ts`)
- Context files: PascalCase suffixed with `Context`, `.tsx` (`ThemeContext.tsx`, `VaultContext.tsx`)
- Constants: kebab-case or camelCase, `.ts` (`spacing.ts`, `secret-missions.ts`)
- Test files: `lib/__tests__/{module}.test.ts`

**Functions:**
- Components: PascalCase (`DashboardCard`, `TaskCard`, `RDVEditor`)
- Hooks: camelCase prefixed `use` (`useVault`, `useThemeColors`, `useGamification`)
- Event handlers: prefixed `handle` or `on` (`handleTaskToggle`, `onRefresh`)
- Parse/serialize pairs: `parseTask` / `serializeRDV` / `serializeGamification`
- Builder functions: prefixed `build` (`buildWeeklyRecapText`, `buildLeaderboard`)
- French test helpers are acceptable: `creerProfil()`, `aujourdhui()`, `creerGamiData()`

**Variables:**
- camelCase: `vaultPath`, `menageTasks`, `activeProfile`, `gamiData`
- Boolean states: `is`/`has` prefix (`isLoading`, `isSendingRecap`, `hasVault`)
- Module-level constants: UPPER_SNAKE_CASE (`TASK_REGEX`, `VAULT_PATH_KEY`, `SPRING_CONFIG`)
- Config constants: UPPER_SNAKE_CASE (`POINTS_PER_TASK`, `LOOT_THRESHOLD`, `DROP_RATES`)

**Types:**
- Interfaces: PascalCase (`Task`, `RDV`, `Profile`, `VaultState`)
- Props: suffixed `Props` (`TaskCardProps`, `ButtonProps`, `ChipProps`)
- Hook result/args: suffixed `Result`/`Args` (`UseGamificationResult`, `UseGamificationArgs`)
- Type unions: PascalCase (`LootRarity`, `RewardType`, `AgeCategory`, `Gender`)
- Shared section props: `DashboardSectionProps` in `components/dashboard/types.ts`

## Code Style

**Formatting:**
- No auto-formatter config (no `.prettierrc`, no `biome.json`, no `.eslintrc`)
- 2-space indentation throughout
- Single quotes for strings
- Trailing commas in multi-line structures
- Semicolons used consistently

**Linting:**
- No ESLint config present
- TypeScript `strict: true` enforced via `tsconfig.json`
- Type checking: `npx tsc --noEmit`
- Known pre-existing errors in `MemoryEditor.tsx`, `cooklang.ts`, `useVault.ts` (ignore them)

## Import Organization

**Order:**
1. React / React Native core (`react`, `react-native`)
2. Expo SDK (`expo-router`, `expo-secure-store`, `expo-haptics`)
3. Third-party (`date-fns`, `gray-matter`, `react-i18next`)
4. Internal contexts (`../../contexts/VaultContext`, `../../contexts/ThemeContext`)
5. Internal components (`../../components/DashboardCard`, `../ui/GlassView`)
6. Internal lib/types (`../../lib/parser`, `../../lib/types`, `../../constants/spacing`)

**Path style:** Relative paths only. The `@/*` alias is configured in `tsconfig.json` but NOT used in source files.

**Path aliases:** None used in practice. Always use relative imports.

## Barrel Files

Barrel `index.ts` files exist for domain modules:
- `components/ui/index.ts` — named exports for all UI primitives
- `components/dashboard/index.ts` — named exports for all dashboard sections + types
- `lib/gamification/index.ts` — re-exports from `engine.ts`, `rewards.ts`, `seasonal.ts`, `seasonal-rewards.ts`
- `lib/mascot/index.ts` — wildcard re-exports (`export * from './engine'`, etc.)

## Design Tokens

**Always use design tokens.** Never hardcode colors, spacing, font sizes, or shadows.

**Colors:** Use `useThemeColors()` from `contexts/ThemeContext.tsx`. Returns `{ primary, tint, colors }`. Access semantic tokens: `colors.text`, `colors.bg`, `colors.card`, `colors.error`, `colors.success`, etc. Defined in `constants/colors.ts` with `LightColors` and `DarkColors` palettes.

**Spacing:** Import `Spacing` and `Radius` from `constants/spacing.ts`. Base-4 scale: `Spacing.xxs` (2) through `Spacing['6xl']` (48). Radius: `Radius.xs` (4) through `Radius.full` (9999).

**Typography:** Import `FontSize`, `FontWeight`, `LineHeight` from `constants/typography.ts`. Example: `FontSize.body` (15), `FontWeight.semibold` ('600'), `LineHeight.body` (22).

**Shadows:** Import `Shadows` from `constants/shadows.ts`. Apply as spread: `style={[styles.card, Shadows.md]}`. Levels: `xs`, `sm`, `md`, `lg`, `xl`, `none`.

**iPad layout:** Use `Layout.contentContainer` from `constants/spacing.ts` for max-width (700px) centering.

## Component Patterns

**Functional components only.** Class components used only for ErrorBoundary (React limitation): `app/_layout.tsx`, `components/SectionErrorBoundary.tsx`.

**React.memo wrapping for UI primitives:**
```typescript
export const Button = React.memo(function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  const { primary, tint, colors } = useThemeColors();
  // ...
});
```

**Inline styles vs StyleSheet:**
- Dynamic/theme-dependent styles: computed inline using `useThemeColors()` values
- Static styles: `StyleSheet.create({...})` at bottom of file
- Design tokens always used for numeric values (never raw `16` — use `Spacing['2xl']`)

**Export pattern:**
- Named exports for reusable components: `export function DashboardCard(...)`
- Memo-wrapped named exports for UI primitives: `export const Chip = React.memo(...)`
- Default exports only for some screen components

**Memoization:**
- `React.memo()` on list-item components: `TaskCard`, `Button`, `Chip`
- `useCallback()` on event handlers passed as props
- `useMemo()` in context providers for stable context values

## Context / State Pattern

**Single source of truth:** All vault data flows through `contexts/VaultContext.tsx` wrapping `hooks/useVault.ts`.

**Context pattern:**
```typescript
const VaultContext = createContext<VaultState | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const vault = useVaultInternal();
  return <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultState {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault doit etre utilise dans un VaultProvider');
  return ctx;
}
```

**Provider hierarchy** (defined in `app/_layout.tsx`):
SafeAreaProvider > GestureHandler > VaultProvider > ThemeProvider > AIProvider > HelpProvider > AuthProvider > ParentalControls > ToastProvider

## Error Handling

**Patterns:**
- `SectionErrorBoundary` wraps each dashboard section independently (`components/SectionErrorBoundary.tsx`)
- Root `AppErrorBoundary` in `app/_layout.tsx` catches unhandled errors
- `__DEV__` guard for console logging: `if (__DEV__) console.warn(...)`
- Try/catch with `Alert.alert()` for user-facing errors
- Non-critical side effects silently swallowed: `catch { /* Gamification — non-critical */ }`
- Network functions return `Promise<boolean>` for success/failure
- Hooks throw `new Error('...')` for invalid preconditions
- French error messages in user-facing contexts

## Logging

**Framework:** None. No logging library installed.
- No `console.log` in production paths
- `console.warn`/`console.error` guarded behind `if (__DEV__)`
- User-facing errors surfaced via `Alert.alert()`

## Animations

**Framework:** `react-native-reanimated` ~4.1 (always prefer over RN Animated)

**Patterns:**
- `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming`
- Spring configs as module constants: `const SPRING_CONFIG = { damping: 10, stiffness: 180 }`
- Avoid `perspective` in transform arrays (causes 3D clipping) — use `scaleX` for flips
- `expo-haptics` for tactile feedback: `Haptics.selectionAsync()`, `Haptics.impactAsync()`

## Comments

**File headers:** Every file starts with a JSDoc block:
```typescript
/**
 * parser.ts — Markdown & YAML frontmatter parsers
 *
 * Handles all coffre vault formats: [...]
 */
```

**Section dividers:** ASCII line dividers within files:
```typescript
// --- Task parsing -------------------------------------------
```

**Inline comments:** French for domain logic, English for technical notes.

**Interface field comments:** Inline `//` on properties:
```typescript
export interface Task {
  lineIndex: number;      // line index in file (0-based, for writes)
  section?: string;       // H2/H3 section header above this task
}
```

## Function Design

**Parameters:**
- Hooks: single typed args object (`useGamification({ vault, notifPrefs, onDataChange? })`)
- Pure functions: positional parameters (`parseTask(line, lineIndex, sourceFile, section?)`)

**Return values:**
- Parse functions: typed entity or `null` (`Task | null`)
- Async service functions: `Promise<boolean>`
- Mutation functions: enriched result objects (`{ profile, entry, lootAwarded }`)

## Module Separation

- `lib/` — Pure logic, no React imports (parsers, engines, algorithms)
- `lib/gamification/` — Gamification engine (barrel via `index.ts`)
- `lib/mascot/` — Mascot tree engine (barrel via `index.ts`)
- `hooks/` — React hooks wrapping lib logic with state management
- `contexts/` — React Context providers (7 contexts)
- `components/` — Reusable UI components
- `components/ui/` — Design system primitives (Button, Chip, Badge, etc.)
- `components/dashboard/` — Dashboard section components
- `constants/` — Design tokens and static config
- `app/` — Screen components (expo-router file-based routing)
- `locales/` — i18n translation JSON files

---

*Convention analysis: 2026-03-28*
