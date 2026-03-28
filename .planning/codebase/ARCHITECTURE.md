# Architecture

**Analysis Date:** 2026-03-28

## Pattern Overview

**Overall:** Monolithic React Native app with file-based routing (expo-router), centralized state via a single mega-hook (`useVault`), and Markdown-file-backed persistence (Obsidian vault).

**Key Characteristics:**
- No backend server -- all data lives as Markdown/YAML files in an Obsidian vault on-device or iCloud
- Single source of truth: `useVaultInternal()` hook (140KB) holds ALL app state and exposes ~80+ actions
- File-based navigation via expo-router with tab layout and hidden screens
- Provider hierarchy wraps the entire app for cross-cutting concerns (theme, auth, AI, help, parental controls, toast)
- Native module (`vault-access`) handles iOS file coordination (NSFileCoordinator) for iCloud/Obsidian compatibility

## Layers

**Navigation Layer (expo-router):**
- Purpose: Screen routing and tab bar
- Location: `app/`
- Contains: `app/_layout.tsx` (root), `app/(tabs)/_layout.tsx` (tab config), `app/(tabs)/*.tsx` (screens), `app/setup.tsx` (onboarding)
- Depends on: Contexts (VaultContext, ThemeContext, AuthContext)
- Used by: User interaction (entry point)

**Context/Provider Layer:**
- Purpose: Cross-cutting state shared across all screens
- Location: `contexts/`
- Contains: 7 context providers
- Depends on: Hooks, Lib layer
- Used by: All screens and components

**Hook Layer:**
- Purpose: Encapsulates stateful logic
- Location: `hooks/`
- Contains: `useVault.ts` (main state), `useGamification.ts`, `useFarm.ts`, `useCalendarEvents.ts`, `useStatsData.ts`, `useAnimConfig.ts`, `useResponsiveLayout.ts`, `useRefresh.ts`
- Depends on: Lib layer (parsers, VaultManager, gamification engine)
- Used by: Context layer, Screen layer

**Component Layer:**
- Purpose: Reusable UI elements
- Location: `components/`
- Contains: UI primitives (`components/ui/`), dashboard sections (`components/dashboard/`), feature-specific components (mascot, calendar, charts, growth, help, settings)
- Depends on: Contexts (theme, vault), Constants
- Used by: Screen layer

**Lib Layer (Core Logic):**
- Purpose: Pure logic, parsing, serialization, external service integration
- Location: `lib/`
- Contains: Markdown parsers (`parser.ts`), file system abstraction (`vault.ts`), AI service (`ai-service.ts`), gamification engine (`lib/gamification/`), mascot system (`lib/mascot/`), notifications, search, i18n, and domain-specific utilities
- Depends on: `expo-file-system`, `gray-matter`, `date-fns`
- Used by: Hook layer

**Constants Layer:**
- Purpose: Static configuration, tokens, and theme definitions
- Location: `constants/`
- Contains: Colors, typography, spacing, shadows, themes, stock categories, defi templates, secret missions, night mode config
- Depends on: Nothing
- Used by: All layers

**Native Module Layer:**
- Purpose: iOS file coordination for iCloud Drive compatibility
- Location: `modules/vault-access/`
- Contains: Swift/Kotlin native module with coordinated file operations
- Depends on: Platform APIs
- Used by: `lib/vault.ts` (VaultManager)

## Data Flow

**Vault Read Flow (app startup / refresh):**

1. `useVaultInternal()` reads `vault_path` from `expo-secure-store`
2. Creates `VaultManager` instance with the vault path
3. Reads all Markdown files from the vault directory structure via `VaultManager.readFile()`
4. Parses each file through dedicated parsers in `lib/parser.ts` (tasks, RDVs, meals, stock, profiles, etc.)
5. Stores parsed data as React state within `useVaultInternal()`
6. Exposes state + actions via `VaultContext` to all screens

**Vault Write Flow (user action):**

1. Screen calls an action from `useVault()` (e.g., `toggleTask`, `addRDV`, `addExpense`)
2. Action in `useVaultInternal()` serializes data back to Markdown format via `lib/parser.ts`
3. Writes to vault file via `VaultManager.writeFile()` (uses NSFileCoordinator on iOS)
4. Updates local React state immediately (optimistic)
5. Obsidian sees the file change and syncs via iCloud

**Refresh Triggers:**
- App coming to foreground (`AppState` change to 'active')
- Manual `refresh()` call after mutations
- Widget sync (`lib/widget-sync.ts`)

**State Management:**
- Centralized in `useVaultInternal()` -- a single 140KB hook that manages ALL vault data
- No Redux, no Zustand, no external state library
- Preferences stored in `expo-secure-store` (API keys, PIN hash, theme prefs, dark mode)
- Gamification state serialized to `gamification.md` in the vault
- Profile data serialized to `famille.md` in the vault

## Key Abstractions

**VaultManager (`lib/vault.ts`):**
- Purpose: File system abstraction over Obsidian vault
- Pattern: Class with async methods (readFile, writeFile, deleteFile, exists, listDir, ensureDir)
- Handles: URI encoding, path traversal prevention, iCloud file coordination, platform differences
- Used by: `useVaultInternal()` exclusively

**Parser System (`lib/parser.ts`, 76KB):**
- Purpose: Bidirectional Markdown/YAML <-> TypeScript object conversion
- Pattern: Paired `parse*` / `serialize*` functions for each data type
- Preserves: Obsidian compatibility (emoji markers, YAML frontmatter, checkbox format)
- Handles: Tasks, RDVs, courses, meals, stock, profiles, gamification, defis, gratitude, wishlist, anniversaries, notes, quotes, moods, skills, secret missions

**Gamification Engine (`lib/gamification/`):**
- Purpose: XP, levels, rewards, skill trees, seasonal content
- Files: `engine.ts`, `rewards.ts`, `seasonal-rewards.ts`, `seasonal.ts`, `skill-tree.ts`, `adventures.ts`
- Pattern: Pure functions operating on `GamificationData` objects

**Mascot System (`lib/mascot/`):**
- Purpose: Virtual tree mascot with decorations, inhabitants, farm, sagas
- Files: `engine.ts`, `types.ts`, `farm-engine.ts`, `sagas-engine.ts`, `seasons.ts`, `world-grid.ts`, and more
- Pattern: Pure functions + type definitions, rendered by `components/mascot/TreeView.tsx` (82KB)

## Entry Points

**App Entry (`index.ts`):**
- Location: `index.ts`
- Triggers: App launch
- Responsibilities: Registers Android widget handler, imports `expo-router/entry`

**Root Layout (`app/_layout.tsx`):**
- Location: `app/_layout.tsx`
- Triggers: expo-router initialization
- Responsibilities: Mounts provider hierarchy, configures notifications, loads language, handles vault redirect and auth lock overlay

**Setup Screen (`app/setup.tsx`):**
- Location: `app/setup.tsx`
- Triggers: First launch (no vault path configured)
- Responsibilities: Onboarding wizard -- vault picker, profile creation, template installation

**Tab Layout (`app/(tabs)/_layout.tsx`):**
- Location: `app/(tabs)/_layout.tsx`
- Triggers: After vault is configured
- Responsibilities: Tab bar with 5 visible tabs + 19 hidden screens, profile picker modal, FAB, vacation banner, tablet sidebar

**Deep Links:**
- URL scheme: `family-vault:///`
- Handled by: expo-router natively (no manual listener)
- Widget URLs: `family-vault:///meals`, etc.

## Navigation Structure

**5 Visible Tabs:**
1. `index` -- Dashboard (today view)
2. `tasks` -- Task management
3. `journal` -- Baby journal
4. `calendar` -- Calendar view
5. `more` -- Menu/hub for all other features

**19 Hidden Screens (accessible via `router.push`):**
- `meals`, `loot`, `settings`, `rdv`, `stock`, `budget`, `routines`, `health`, `stats`, `defis`, `gratitude`, `wishlist`, `anniversaires`, `compare`, `notes`, `quotes`, `moods`, `photos`, `pregnancy`, `skills`, `tree`, `night-mode`

**Modal Patterns:**
- Profile picker: Modal in tab layout (first launch)
- PIN prompt: Modal in tab layout (child-to-adult profile switch)
- Feature modals: `pageSheet` presentation with drag-to-dismiss (convention)

## Error Handling

**Strategy:** Error boundary at root + per-section error boundaries + file-not-found tolerance

**Patterns:**
- `AppErrorBoundary` in `app/_layout.tsx` catches unhandled React errors with retry button
- `SectionErrorBoundary` in `components/SectionErrorBoundary.tsx` wraps dashboard sections
- `isFileNotFound()` helper in `hooks/useVault.ts` distinguishes missing files (expected for new vaults) from real errors
- `warnUnexpected()` logs only genuine errors, suppresses file-not-found noise
- VaultManager path traversal prevention (rejects `..`, absolute paths, null bytes)

## Cross-Cutting Concerns

**Theming:**
- Provider: `contexts/ThemeContext.tsx`
- Hook: `useThemeColors()` returns `{ primary, tint, colors, isDark, setThemeId, darkModePreference, setDarkModePreference }`
- 9 profile themes defined in `constants/themes.ts`
- Light/Dark mode with auto/manual toggle, persisted in SecureStore
- Colors: `constants/colors.ts` (LightColors, DarkColors semantic tokens)

**Internationalization:**
- Library: i18next + react-i18next
- Languages: French (primary), English
- Locale files: `locales/fr/*.json`, `locales/en/*.json` (common, gamification, help, insights, skills)
- Config: `lib/i18n.ts`

**Authentication:**
- Provider: `contexts/AuthContext.tsx`
- Features: Face ID/Touch ID + 4-digit PIN fallback
- Storage: SecureStore (auth_enabled, auth_pin_hash, auth_lock_delay)
- Lock screen: `components/LockScreen.tsx` overlays entire app
- Profile switch: PIN required for child-to-adult transition

**Parental Controls:**
- Provider: `contexts/ParentalControlsContext.tsx`
- Categories: rdv, budget, stock, defis, wishlist, souvenirs, recherche, gratitude
- Default: All restricted (maximum safety)
- Storage: SecureStore

**Notifications:**
- Local notifications via `expo-notifications`
- Config: `lib/notifications.ts` (preferences), `lib/scheduled-notifications.ts` (scheduling)
- RDV alerts, task reminders, weekly recaps

**Haptic Feedback:**
- Library: `expo-haptics`
- Used on: Important interactions (PIN entry, profile switch, task completion)

**Animations:**
- Library: `react-native-reanimated` ~4.1
- Pattern: `useSharedValue` + `useAnimatedStyle` + `withSpring`
- Convention: Avoid `perspective` in transforms (causes 3D clipping), prefer `scaleX` for flips

**Logging:**
- `console.warn` / `console.error` in `__DEV__` mode only
- No external logging/monitoring service

---

*Architecture analysis: 2026-03-28*
