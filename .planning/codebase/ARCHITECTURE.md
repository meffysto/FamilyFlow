# Architecture

**Analysis Date:** 2026-03-07

## Pattern Overview

**Overall:** Markdown-file-backed React Native app (Expo) with a vault abstraction layer

**Key Characteristics:**
- No database — all persistent data lives in plain `.md` files (Obsidian-compatible format)
- Single global state hook (`useVault`) owns and exposes all vault data
- Data flows uni-directionally: Markdown files → parser → typed state → UI
- All writes go through `VaultManager` → update local state → trigger UI re-render
- External notifications are push-only (Telegram outbound, no webhook listener)

## Layers

**Entry / Routing Layer:**
- Purpose: Bootstrap app, check vault config, route to setup or main tabs
- Location: `app/_layout.tsx`, `app/setup.tsx`
- Contains: Root layout, onboarding wizard, navigation guards
- Depends on: `hooks/useVault`, `lib/scheduled-notifications`, `expo-secure-store`
- Used by: Expo Router (file-system routing)

**Screen Layer:**
- Purpose: Render UI and handle user interactions per feature
- Location: `app/(tabs)/` — `index.tsx`, `tasks.tsx`, `journal.tsx`, `photos.tsx`, `more.tsx`, `meals.tsx`, `loot.tsx`, `rdv.tsx`, `settings.tsx`, `stock.tsx`
- Contains: Screen components, local UI state, calls to vault hooks
- Depends on: `hooks/useVault`, `hooks/useGamification`, `contexts/ThemeContext`, `components/`, `lib/`
- Used by: Expo Router tab navigation

**Component Layer:**
- Purpose: Reusable UI widgets and editors
- Location: `components/` — `DashboardCard.tsx`, `FamilyLeaderboard.tsx`, `LootBoxOpener.tsx`, `MemoryEditor.tsx`, `NotificationEditor.tsx`, `NotificationSettings.tsx`, `RDVEditor.tsx`, `StockEditor.tsx`, `TaskCard.tsx`, `VaultPicker.tsx`
- Contains: Presentational and editor components
- Depends on: `contexts/ThemeContext`, `lib/types`, `lib/gamification`
- Used by: Screen layer

**State / Hooks Layer:**
- Purpose: Mediate between UI and vault data; hold all shared application state
- Location: `hooks/useVault.ts`, `hooks/useGamification.ts`
- Contains: React hooks with `useState`/`useEffect`, read/write operations, AppState listener
- Depends on: `lib/vault`, `lib/parser`, `lib/gamification`, `lib/notifications`, `lib/types`, `expo-secure-store`
- Used by: Screen layer, tab layout

**Context Layer:**
- Purpose: Provide theme colors globally without prop drilling
- Location: `contexts/ThemeContext.tsx`
- Contains: `ThemeProvider`, `useThemeColors()` hook, `ThemeColors` interface
- Depends on: `constants/themes`
- Used by: All screens and components

**Core Library Layer:**
- Purpose: Domain logic, parsing, serialization, integrations
- Location: `lib/` — `vault.ts`, `parser.ts`, `types.ts`, `gamification.ts`, `notifications.ts`, `telegram.ts`, `scheduled-notifications.ts`, `recurrence.ts`, `journal-stats.ts`
- Contains: Pure functions, classes, type definitions
- Depends on: `expo-file-system`, `expo-notifications`, `expo-secure-store`, `gray-matter`, `date-fns`
- Used by: Hooks layer, screen layer

**Constants Layer:**
- Purpose: Static configuration, theming values, reward tables
- Location: `constants/themes.ts`, `constants/rewards.ts`
- Contains: Theme configs, reward drop tables, point values
- Depends on: Nothing
- Used by: Library layer, hooks layer, screen layer

## Data Flow

**Reading Vault Data (on mount / foreground):**

1. `app/_layout.tsx` checks `expo-secure-store` for saved vault path
2. `hooks/useVault.ts` creates a `VaultManager` instance with the stored path
3. `loadVaultData()` calls `VaultManager.readFile()` for each known `.md` file
4. Each file's content is passed to the relevant parser in `lib/parser.ts`
5. Parsed typed objects (e.g. `Task[]`, `RDV[]`, `Profile[]`) are stored in `useState`
6. Screens consume state via `useVault()` destructuring

**Writing Vault Data (mutation):**

1. Screen calls a mutation function from `useVault()` (e.g. `toggleTask`, `addRDV`)
2. `useVault` reads current file content via `VaultManager.readFile()`
3. Modifies the raw markdown string in-place using the stored `lineIndex`
4. Writes back via `VaultManager.writeFile()`
5. Re-parses the file and updates local state immediately (no full reload)

**Task Completion with Gamification:**

1. Screen calls `useGamification().completeTask(profile, taskText)`
2. `lib/gamification.ts` computes new points, streak, level, loot eligibility
3. Updated `GamificationData` is serialized by `lib/parser.ts` and written to `gamification.md`
4. `lib/notifications.ts` dispatches Telegram notification if enabled (reads token from `expo-secure-store`)
5. `hooks/useVault.ts` receives callback and updates profiles state

**State Management:**
- All application state lives inside `hooks/useVault.ts` (single source of truth)
- Theme state is managed separately in `contexts/ThemeContext.tsx` for instant switching without vault reload
- No Redux, Zustand, or external state management library
- AppState listener in `useVault` triggers re-read on app foreground (`active` state)
- A `busyRef` guard prevents concurrent reads during ongoing write operations

## Key Abstractions

**VaultManager (`lib/vault.ts`):**
- Purpose: Abstracts all filesystem operations against a configured root vault path
- Pattern: Class with instance bound to vault path, stored in `useRef` inside `useVault`
- Key methods: `readFile()`, `writeFile()`, `deleteFile()`, `ensureDir()`, `listDir()`, `listMarkdownFiles()`, `copyFileToVault()`, `listPhotoDates()`, `getPhotoUri()`
- Uses `expo-file-system/legacy` API for broad compatibility

**Parser (`lib/parser.ts`):**
- Purpose: Bidirectional conversion between raw Markdown and typed domain objects
- Pattern: Exported pure functions grouped by data type; regex-based for task/course lines, `gray-matter` for YAML frontmatter in RDV files
- Key parse functions: `parseTaskFile()`, `parseMénage()`, `parseCourses()`, `parseMeals()`, `parseRDV()`, `parseStock()`, `parseGamification()`, `parseFamille()`
- Key serialize functions: `serializeGamification()`, `serializeRDV()`, `serializeStockRow()`
- Emoji markers used as inline metadata: `🔁` (recurrence), `📅` (due date), `✅` (completed date)

**Types (`lib/types.ts`):**
- Purpose: Single source of truth for all domain types
- Key types: `Task`, `RDV`, `JournalEntry`, `Profile`, `LootBox`, `GamificationData`, `StockItem`, `MealItem`, `PhotoEntry`, `Memory`, `NotificationConfig`, `ActiveReward`

**Gamification Engine (`lib/gamification.ts`):**
- Purpose: Points, levels, loot boxes, streaks, pity system, active rewards
- Pattern: Pure functions operating on `Profile` and `GamificationData`
- Key functions: `awardTaskCompletion()`, `openLootBox()`, `buildLeaderboard()`, `calculateStreak()`, `processActiveRewards()`, `applyFamilyBonus()`

**Notification System (`lib/notifications.ts`):**
- Purpose: Templated Telegram notifications dispatched on domain events
- Pattern: Template strings with `{{variable}}` placeholders; context builders per event type; single `dispatchNotificationAsync()` entry point
- Events: `task_completed`, `loot_box_opened`, `all_tasks_done`, `leaderboard`, `daily_summary`, `manual`

## Entry Points

**App Entry:**
- Location: `index.ts`
- Triggers: Expo Router initializes from `expo-router/entry`
- Responsibilities: Register root component

**Root Layout:**
- Location: `app/_layout.tsx`
- Triggers: First render after app launch
- Responsibilities: Check vault path in SecureStore → redirect to `/setup` if missing; configure local notification handler via `configureNotifications()`

**Setup Wizard:**
- Location: `app/setup.tsx`
- Triggers: No vault path stored in SecureStore
- Responsibilities: 5-step onboarding — welcome, parent config, child config, vault path selection (`VaultPicker`), recap + vault scaffold creation

**Tab Navigator:**
- Location: `app/(tabs)/_layout.tsx`
- Triggers: Successful vault configuration
- Responsibilities: Render tab bar (5 visible tabs: Dashboard, Tâches, Journal, Photos, Plus); wrap in `ThemeProvider` keyed to active profile; show profile-picker modal when no active profile is selected

## Error Handling

**Strategy:** Local state error with string message; no global error boundary

**Patterns:**
- `useVault` catches all async errors and stores them in `error: string | null` state
- `VaultManager` methods throw descriptive `Error` objects on filesystem failure
- Screen-level handlers use `Alert.alert()` for user-facing errors
- Telegram send failures are silent (returns `false`, never thrown)
- Missing vault files return empty arrays or empty strings (graceful degradation), not thrown errors

## Cross-Cutting Concerns

**Theming:** `contexts/ThemeContext.tsx` via `useThemeColors()` — `primary` and `tint` colors derived from the active profile's `ProfileTheme`. Defined in `constants/themes.ts`. Never hardcode `#7C3AED`; always use `useThemeColors()`.

**Validation:** Inline in `lib/parser.ts` (regex matching) and `VaultManager.exists()` checks; no schema validation library.

**Authentication:** No app-level auth. Vault access requires device filesystem permission. Telegram credentials stored in `expo-secure-store` under keys `telegram_token` and `telegram_chat_id`.

**Persistence:** Two stores — `expo-secure-store` for sensitive/small config (vault path, Telegram credentials, active profile ID, notification schedule config); `.md` files in the vault for all domain data.

**Locale:** French (`fr` locale from `date-fns`) used throughout for date formatting. All UI text is in French.

---

*Architecture analysis: 2026-03-07*
