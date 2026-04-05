# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Family Vault — CLAUDE.md

## Stack
- React Native + Expo (~54) + expo-router v6
- react-native-reanimated ~4.1 (prefer over RN Animated for new animations)
- Données: Markdown files dans un vault Obsidian (gray-matter frontmatter)
- Persistance prefs: expo-secure-store

## Conventions
- Langue UI/commits/commentaires: français
- Couleurs: TOUJOURS utiliser `useThemeColors()` / `colors.*` — jamais de hardcoded (#FFFFFF, #111827, etc.)
- Swipe dans ScrollView = conflit de geste → utiliser bouton tap à la place
- `ReanimatedSwipeable` (PAS `Swipeable`) depuis `react-native-gesture-handler/ReanimatedSwipeable`
- Paths avec parenthèses (app/(tabs)/) doivent être quotés dans git/bash

## Architecture
- `contexts/VaultContext.tsx` — VaultProvider + useVault() via context (source unique d'état)
- `hooks/useVault.ts` — useVaultInternal() orchestrateur (1626 lignes) + 21 hooks domaine extraits
- `hooks/useVault*.ts` — hooks dédiés par domaine : Tasks, Recipes, Defis, Profiles, Stock, Courses, Health, SecretMissions, Meals, RDV, Photos, Memories, Vacation, Budget, Notes, Anniversaires, Wishlist, Gratitude, Quotes, Moods, Routines
- `lib/parser.ts` — parse/serialize markdown vault files
- `contexts/ThemeContext.tsx` — useThemeColors() → { primary, tint, colors }
- `contexts/AIContext.tsx` — AIProvider (clé API SecureStore, Claude haiku/sonnet)
- `contexts/HelpContext.tsx` — HelpProvider (coach marks, screen guides)
- `contexts/ToastContext.tsx` — ToastProvider (notifications spring animées)
- `constants/colors.ts` — LightColors & DarkColors (sémantique)
- `constants/themes.ts` — 9 thèmes profil (voitures, pokemon, etc.)
- `constants/rewards.ts` — pool rewards, drop rates, raretés
- `constants/spacing.ts` — Spacing (xxs→6xl), Radius (xs→full)
- `constants/typography.ts` — FontSize (micro→hero), FontWeight, LineHeight
- `constants/shadows.ts` — Shadow tokens (xs/sm/md/lg/xl/none)
- `components/ui/` — Chip, Badge, Button, DateInput, ModalHeader, MarkdownText, CollapsibleSection
- `lib/insights.ts` — suggestions déterministes (10 règles)
- `lib/search.ts` — recherche multi-type normalisée
- `lib/ai-service.ts` — fetch direct api.anthropic.com
- Vault recettes: `03 - Cuisine/Recettes/{Category}/{Name}.cook`

### Hiérarchie providers (app/_layout.tsx)
SafeAreaProvider > GestureHandler > VaultProvider > ThemeProvider > AIProvider > HelpProvider > ParentalControls > ToastProvider

## Animations
- Utiliser react-native-reanimated (useSharedValue, useAnimatedStyle, withSpring, etc.)
- Éviter `perspective` dans les transform arrays (cause clipping 3D) — préférer scaleX pour les flips
- expo-haptics pour le feedback tactile sur les interactions importantes

## Conventions supplémentaires
- Format date affiché : JJ/MM/AAAA (français)
- Modals : présentation `pageSheet` + drag-to-dismiss
- Cible : Dev build (expo-dev-client) — `npx expo run:ios --device` pour builder sur device physique
- Fichiers publics (docs/, commits) : jamais de noms personnels réels → utiliser des génériques (Lucas, Emma, Dupont)
- Pour livrer : utiliser `/ship` (tsc + privacy check + commit FR + push)

## Testing
- `npx tsc --noEmit` pour vérifier la compilation (pas de test suite)
- Erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts — les ignorer

<!-- GSD:project-start source:PROJECT.md -->
## Project

**FamilyFlow**

Application mobile familiale (React Native / Expo) qui centralise la vie quotidienne d'une famille : tâches, calendrier, repas, budget, recettes, journal bébé, photos/souvenirs, et un système de gamification avec mascotte/ferme pixel. Les données vivent dans un vault Obsidian (Markdown + frontmatter) synchronisé via iCloud — aucun backend.

**Core Value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.

### Constraints

- **Stack**: React Native + Expo SDK 54 — pas de migration majeure
- **Données**: Vault Obsidian Markdown — compatibilité bidirectionnelle obligatoire
- **Stabilité**: App sur TestFlight — chaque phase doit être non-cassante
- **Solo dev**: Un seul développeur — phases incrémentales, pas de big bang
- **Animations**: react-native-reanimated obligatoire (pas RN Animated)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~5.9.2 - All application code (`lib/`, `contexts/`, `components/`, `hooks/`, `app/`)
- Swift - Native iOS module (`modules/vault-access/ios/`)
- Kotlin - Native Android module (`modules/vault-access/android/`)
- JavaScript - Babel config (`babel.config.js`), Expo plugins (`plugins/`)
## Runtime
- React Native 0.81.5 via Expo managed workflow
- Expo SDK ~54.0.0
- Targets: iOS (primary), Android, Web (secondary)
- npm
- Lockfile: `package-lock.json` (not committed)
## Frameworks
- Expo ~54.0.0 - Managed workflow with dev-client (`expo-dev-client ~6.0.20`)
- React 19.1.0 - UI rendering
- React Native 0.81.5 - Cross-platform native runtime
- Expo Router ~6.0.23 - File-based routing (typed routes enabled via `experiments.typedRoutes`)
- React Native Reanimated ~4.1.1 - Worklet-based animations (preferred over RN Animated for all new code)
- React Native Gesture Handler ~2.28.0 - Native gesture recognition (`ReanimatedSwipeable`, not `Swipeable`)
- React Native Worklets 0.5.1 - Reanimated worklet runtime
- React Native Confetti Cannon ^1.5.2 - Loot box celebration effect
- Jest ^29.7.0 - Test runner (configured in `package.json`)
- ts-jest ^29.4.6 - TypeScript transform for Jest
- Note: No active test suite; `npx tsc --noEmit` is the primary validation method
- babel-preset-expo ~54.0.10 - Babel transpilation
- EAS CLI >= 14.0.0 - Cloud builds via `eas.json`
- patch-package - Post-install patching (`patches/expo-document-picker+14.0.8.patch`)
- sharp ^0.34.5 (devDependency) - Image processing tooling
## Key Dependencies
- `expo-file-system` ~19.0.21 - All vault file I/O; uses legacy API import (`expo-file-system/legacy`)
- `expo-secure-store` ~15.0.8 - API keys, auth PIN, Telegram tokens, user preferences
- `gray-matter` ^4.0.3 - YAML frontmatter parsing for Obsidian markdown files (`lib/parser.ts`)
- `react-native-reanimated` ~4.1.1 - All animations (spring, timing, shared values)
- `react-native-gesture-handler` ~2.28.0 - Swipe/gesture interactions
- `date-fns` ^4.1.0 - Date formatting and manipulation throughout `lib/`
- `i18next` ^25.10.2 + `react-i18next` ^16.6.0 - i18n framework (fr/en)
- `expo-localization` ~17.0.8 - Device locale detection
- Locale files: `locales/fr/*.json`, `locales/en/*.json`
- Namespaces: common, gamification, help, insights, skills
- `react-native-svg` ^15.12.1 - SVG rendering (mascot, icons)
- `expo-linear-gradient` ~15.0.8 - Gradient backgrounds
- `expo-blur` ~15.0.8 - Blur effects
- `expo-haptics` ~15.0.8 - Tactile feedback on interactions
- `expo-image-picker` ~17.0.10 - Photo capture/selection
- `expo-image-manipulator` ~14.0.8 - Image resize/compress
- `expo-document-picker` ~14.0.8 - Vault folder selection (patched)
- `expo-speech-recognition` ^3.1.1 - Voice-to-text transcription
- `expo-local-authentication` ~17.0.8 - Face ID / Touch ID / biometrics
- `expo-notifications` ^0.32.16 - Local scheduled notifications (no push server)
- `expo-calendar` ~15.0.8 - Calendar import
- `expo-contacts` ~15.0.11 - Contact/birthday import
- `expo-brightness` ~14.0.8 - Screen brightness control
- `react-native-share` ^12.2.6 - Native share sheet (WhatsApp, iMessage)
- `expo-linking` ~8.0.11 - Deep linking / URL scheme (`family-vault://`)
- `react-native-android-widget` ^0.20.1 - Android home screen widgets
- `react-native-screens` ~4.16.0 - Native screen containers
- `react-native-safe-area-context` ~5.6.0 - Safe area insets
- `react-native-web` ^0.21.0 - Web platform support
- `expo-splash-screen` ~31.0.13 - Launch screen
- `expo-status-bar` ~3.0.9 - Status bar control
- `expo-constants` ~18.0.13 - App constants/config
## Custom Native Modules
- Expo native module (iOS Swift + Android Kotlin)
- Config: `modules/vault-access/expo-module.config.json`
- TS bridge: `modules/vault-access/src/index.ts`
- Provides: coordinated file I/O, iCloud sync, security-scoped bookmarks, App Group data for widgets, Live Activities (baby feeding timer)
- Key functions: `startAccessing`, `restoreAccess`, `readFile`, `writeFile`, `ensureDir`, `deleteFile`, `copyFile`, `downloadICloudFiles`, `listDirectory`, `updateWidgetData`, `startFeedingActivity`, `stopFeedingActivity`
- `plugins/remove-push-entitlement.js` - Strips push notification entitlement from iOS build
- `plugins/with-widget.js` - Configures iOS WidgetKit extension + App Group
## Configuration
- Config: `tsconfig.json` extends `expo/tsconfig.base`
- Strict mode enabled
- Path alias: `@/*` maps to `./*`
- Config: `babel.config.js`
- Presets: `babel-preset-expo`
- Plugins: `react-native-reanimated/plugin` (must be last)
- Config: `eas.json`
- Profiles: `development` (simulator), `preview` (internal distribution), `production` (auto-increment, remote credentials)
- iOS bundle: `com.familyvault.dev`
- Android package: `com.familyvault.app`
- Config: `app.json` (static Expo config)
- App name: "FamilyFlow"
- Slug: "family-vault"
- Scheme: `family-vault://`
- Orientation: portrait only
- iOS build number: 17
- Android version code: 3
## Platform Requirements
- Node.js (compatible with Expo SDK 54)
- Xcode (iOS builds)
- Android Studio (Android builds)
- Expo Dev Client - custom native modules require dev build, not Expo Go
- Build command: `npx expo run:ios --device` (physical device)
- Type check: `npx tsc --noEmit`
- iOS: App Store (Apple Team ID: AKMNXGVVGX, ASC App ID: 6760829141)
- Android: Google Play (package: `com.familyvault.app`)
- Build service: EAS Build (Expo Application Services)
- No backend server - all data is local (Obsidian vault on device + iCloud sync)
## Widgets
- WidgetKit extension via `plugins/with-widget.js`
- App Group: `group.com.familyvault.dev`
- Live Activities: Baby feeding timer (via VaultAccess native module)
- `react-native-android-widget` with task handler at `widgets/android/widget-task-handler`
- Widgets: "Ma Journee" (4x2 cells, 30min refresh), "Journal Bebe" (3x2 cells, 30min refresh)
- Entry point: `index.ts` registers widget task handler before expo-router
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Language & Locale
## Naming Patterns
- Screen files: lowercase, `.tsx` extension (`index.tsx`, `tasks.tsx`, `rdv.tsx`, `meals.tsx`)
- Component files: PascalCase, `.tsx` (`DashboardCard.tsx`, `TaskCard.tsx`, `RDVEditor.tsx`)
- Hook files: camelCase with `use` prefix, `.ts` (`useVault.ts`, `useGamification.ts`)
- Library files: kebab-case or camelCase, `.ts` (`ai-service.ts`, `calendar-aggregator.ts`, `parser.ts`)
- Context files: PascalCase suffixed with `Context`, `.tsx` (`ThemeContext.tsx`, `VaultContext.tsx`)
- Constants: kebab-case or camelCase, `.ts` (`spacing.ts`, `secret-missions.ts`)
- Test files: `lib/__tests__/{module}.test.ts`
- Components: PascalCase (`DashboardCard`, `TaskCard`, `RDVEditor`)
- Hooks: camelCase prefixed `use` (`useVault`, `useThemeColors`, `useGamification`)
- Event handlers: prefixed `handle` or `on` (`handleTaskToggle`, `onRefresh`)
- Parse/serialize pairs: `parseTask` / `serializeRDV` / `serializeGamification`
- Builder functions: prefixed `build` (`buildWeeklyRecapText`, `buildLeaderboard`)
- French test helpers are acceptable: `creerProfil()`, `aujourdhui()`, `creerGamiData()`
- camelCase: `vaultPath`, `menageTasks`, `activeProfile`, `gamiData`
- Boolean states: `is`/`has` prefix (`isLoading`, `isSendingRecap`, `hasVault`)
- Module-level constants: UPPER_SNAKE_CASE (`TASK_REGEX`, `VAULT_PATH_KEY`, `SPRING_CONFIG`)
- Config constants: UPPER_SNAKE_CASE (`POINTS_PER_TASK`, `LOOT_THRESHOLD`, `DROP_RATES`)
- Interfaces: PascalCase (`Task`, `RDV`, `Profile`, `VaultState`)
- Props: suffixed `Props` (`TaskCardProps`, `ButtonProps`, `ChipProps`)
- Hook result/args: suffixed `Result`/`Args` (`UseGamificationResult`, `UseGamificationArgs`)
- Type unions: PascalCase (`LootRarity`, `RewardType`, `AgeCategory`, `Gender`)
- Shared section props: `DashboardSectionProps` in `components/dashboard/types.ts`
## Code Style
- No auto-formatter config (no `.prettierrc`, no `biome.json`, no `.eslintrc`)
- 2-space indentation throughout
- Single quotes for strings
- Trailing commas in multi-line structures
- Semicolons used consistently
- No ESLint config present
- TypeScript `strict: true` enforced via `tsconfig.json`
- Type checking: `npx tsc --noEmit`
- Known pre-existing errors in `MemoryEditor.tsx`, `cooklang.ts`, `useVault.ts` (ignore them)
## Import Organization
## Barrel Files
- `components/ui/index.ts` — named exports for all UI primitives
- `components/dashboard/index.ts` — named exports for all dashboard sections + types
- `lib/gamification/index.ts` — re-exports from `engine.ts`, `rewards.ts`, `seasonal.ts`, `seasonal-rewards.ts`
- `lib/mascot/index.ts` — wildcard re-exports (`export * from './engine'`, etc.)
## Design Tokens
## Component Patterns
- Dynamic/theme-dependent styles: computed inline using `useThemeColors()` values
- Static styles: `StyleSheet.create({...})` at bottom of file
- Design tokens always used for numeric values (never raw `16` — use `Spacing['2xl']`)
- Named exports for reusable components: `export function DashboardCard(...)`
- Memo-wrapped named exports for UI primitives: `export const Chip = React.memo(...)`
- Default exports only for some screen components
- `React.memo()` on list-item components: `TaskCard`, `Button`, `Chip`
- `useCallback()` on event handlers passed as props
- `useMemo()` in context providers for stable context values
## Context / State Pattern
## Error Handling
- `SectionErrorBoundary` wraps each dashboard section independently (`components/SectionErrorBoundary.tsx`)
- Root `AppErrorBoundary` in `app/_layout.tsx` catches unhandled errors
- `__DEV__` guard for console logging: `if (__DEV__) console.warn(...)`
- Try/catch with `Alert.alert()` for user-facing errors
- Non-critical side effects silently swallowed: `catch { /* Gamification — non-critical */ }`
- Network functions return `Promise<boolean>` for success/failure
- Hooks throw `new Error('...')` for invalid preconditions
- French error messages in user-facing contexts
## Logging
- No `console.log` in production paths
- `console.warn`/`console.error` guarded behind `if (__DEV__)`
- User-facing errors surfaced via `Alert.alert()`
## Animations
- `useSharedValue` + `useAnimatedStyle` + `withSpring`/`withTiming`
- Spring configs as module constants: `const SPRING_CONFIG = { damping: 10, stiffness: 180 }`
- Avoid `perspective` in transform arrays (causes 3D clipping) — use `scaleX` for flips
- `expo-haptics` for tactile feedback: `Haptics.selectionAsync()`, `Haptics.impactAsync()`
## Comments
## Function Design
- Hooks: single typed args object (`useGamification({ vault, notifPrefs, onDataChange? })`)
- Pure functions: positional parameters (`parseTask(line, lineIndex, sourceFile, section?)`)
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
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- No backend server -- all data lives as Markdown/YAML files in an Obsidian vault on-device or iCloud
- Single source of truth: `useVaultInternal()` orchestrateur + 21 hooks domaine extraits, exposant ~80+ actions via VaultContext
- File-based navigation via expo-router with tab layout and hidden screens
- Provider hierarchy wraps the entire app for cross-cutting concerns (theme, auth, AI, help, parental controls, toast)
- Native module (`vault-access`) handles iOS file coordination (NSFileCoordinator) for iCloud/Obsidian compatibility
## Layers
- Purpose: Screen routing and tab bar
- Location: `app/`
- Contains: `app/_layout.tsx` (root), `app/(tabs)/_layout.tsx` (tab config), `app/(tabs)/*.tsx` (screens), `app/setup.tsx` (onboarding)
- Depends on: Contexts (VaultContext, ThemeContext, AuthContext)
- Used by: User interaction (entry point)
- Purpose: Cross-cutting state shared across all screens
- Location: `contexts/`
- Contains: 7 context providers
- Depends on: Hooks, Lib layer
- Used by: All screens and components
- Purpose: Encapsulates stateful logic
- Location: `hooks/`
- Contains: `useVault.ts` (orchestrateur), `useVaultTasks.ts`, `useVaultRecipes.ts`, `useVaultDefis.ts`, `useVaultProfiles.ts`, `useVaultStock.ts`, `useVaultCourses.ts`, `useVaultHealth.ts`, `useVaultSecretMissions.ts`, `useVaultMeals.ts`, `useVaultRDV.ts`, `useVaultPhotos.ts`, `useVaultMemories.ts`, `useVaultVacation.ts`, `useVaultBudget.ts`, `useVaultNotes.ts`, `useVaultAnniversaires.ts`, `useVaultWishlist.ts`, `useVaultGratitude.ts`, `useVaultQuotes.ts`, `useVaultMoods.ts`, `useVaultRoutines.ts`, + `useGamification.ts`, `useFarm.ts`, `useCalendarEvents.ts`, `useStatsData.ts`, `useAnimConfig.ts`, `useResponsiveLayout.ts`, `useRefresh.ts`
- Depends on: Lib layer (parsers, VaultManager, gamification engine)
- Used by: Context layer, Screen layer
- Purpose: Reusable UI elements
- Location: `components/`
- Contains: UI primitives (`components/ui/`), dashboard sections (`components/dashboard/`), feature-specific components (mascot, calendar, charts, growth, help, settings)
- Depends on: Contexts (theme, vault), Constants
- Used by: Screen layer
- Purpose: Pure logic, parsing, serialization, external service integration
- Location: `lib/`
- Contains: Markdown parsers (`parser.ts`), file system abstraction (`vault.ts`), AI service (`ai-service.ts`), gamification engine (`lib/gamification/`), mascot system (`lib/mascot/`), notifications, search, i18n, and domain-specific utilities
- Depends on: `expo-file-system`, `gray-matter`, `date-fns`
- Used by: Hook layer
- Purpose: Static configuration, tokens, and theme definitions
- Location: `constants/`
- Contains: Colors, typography, spacing, shadows, themes, stock categories, defi templates, secret missions, night mode config
- Depends on: Nothing
- Used by: All layers
- Purpose: iOS file coordination for iCloud Drive compatibility
- Location: `modules/vault-access/`
- Contains: Swift/Kotlin native module with coordinated file operations
- Depends on: Platform APIs
- Used by: `lib/vault.ts` (VaultManager)
## Data Flow
- App coming to foreground (`AppState` change to 'active')
- Manual `refresh()` call after mutations
- Widget sync (`lib/widget-sync.ts`)
- Centralized in `useVaultInternal()` orchestrateur + 21 hooks domaine (chaque hook gère son state + CRUD)
- No Redux, no Zustand, no external state library
- Preferences stored in `expo-secure-store` (API keys, PIN hash, theme prefs, dark mode)
- Gamification state serialized to `gamification.md` in the vault
- Profile data serialized to `famille.md` in the vault
## Key Abstractions
- Purpose: File system abstraction over Obsidian vault
- Pattern: Class with async methods (readFile, writeFile, deleteFile, exists, listDir, ensureDir)
- Handles: URI encoding, path traversal prevention, iCloud file coordination, platform differences
- Used by: `useVaultInternal()` exclusively
- Purpose: Bidirectional Markdown/YAML <-> TypeScript object conversion
- Pattern: Paired `parse*` / `serialize*` functions for each data type
- Preserves: Obsidian compatibility (emoji markers, YAML frontmatter, checkbox format)
- Handles: Tasks, RDVs, courses, meals, stock, profiles, gamification, defis, gratitude, wishlist, anniversaries, notes, quotes, moods, skills, secret missions
- Purpose: XP, levels, rewards, skill trees, seasonal content
- Files: `engine.ts`, `rewards.ts`, `seasonal-rewards.ts`, `seasonal.ts`, `skill-tree.ts`, `adventures.ts`
- Pattern: Pure functions operating on `GamificationData` objects
- Purpose: Virtual tree mascot with decorations, inhabitants, farm, sagas
- Files: `engine.ts`, `types.ts`, `farm-engine.ts`, `sagas-engine.ts`, `seasons.ts`, `world-grid.ts`, and more
- Pattern: Pure functions + type definitions, rendered by `components/mascot/TreeView.tsx` (82KB)
## Entry Points
- Location: `index.ts`
- Triggers: App launch
- Responsibilities: Registers Android widget handler, imports `expo-router/entry`
- Location: `app/_layout.tsx`
- Triggers: expo-router initialization
- Responsibilities: Mounts provider hierarchy, configures notifications, loads language, handles vault redirect and auth lock overlay
- Location: `app/setup.tsx`
- Triggers: First launch (no vault path configured)
- Responsibilities: Onboarding wizard -- vault picker, profile creation, template installation
- Location: `app/(tabs)/_layout.tsx`
- Triggers: After vault is configured
- Responsibilities: Tab bar with 5 visible tabs + 19 hidden screens, profile picker modal, FAB, vacation banner, tablet sidebar
- URL scheme: `family-vault:///`
- Handled by: expo-router natively (no manual listener)
- Widget URLs: `family-vault:///meals`, etc.
## Navigation Structure
- `meals`, `loot`, `settings`, `rdv`, `stock`, `budget`, `routines`, `health`, `stats`, `defis`, `gratitude`, `wishlist`, `anniversaires`, `compare`, `notes`, `quotes`, `moods`, `photos`, `pregnancy`, `skills`, `tree`, `night-mode`
- Profile picker: Modal in tab layout (first launch)
- PIN prompt: Modal in tab layout (child-to-adult profile switch)
- Feature modals: `pageSheet` presentation with drag-to-dismiss (convention)
## Error Handling
- `AppErrorBoundary` in `app/_layout.tsx` catches unhandled React errors with retry button
- `SectionErrorBoundary` in `components/SectionErrorBoundary.tsx` wraps dashboard sections
- `isFileNotFound()` helper in `hooks/useVault.ts` distinguishes missing files (expected for new vaults) from real errors
- `warnUnexpected()` logs only genuine errors, suppresses file-not-found noise
- VaultManager path traversal prevention (rejects `..`, absolute paths, null bytes)
## Cross-Cutting Concerns
- Provider: `contexts/ThemeContext.tsx`
- Hook: `useThemeColors()` returns `{ primary, tint, colors, isDark, setThemeId, darkModePreference, setDarkModePreference }`
- 9 profile themes defined in `constants/themes.ts`
- Light/Dark mode with auto/manual toggle, persisted in SecureStore
- Colors: `constants/colors.ts` (LightColors, DarkColors semantic tokens)
- Library: i18next + react-i18next
- Languages: French (primary), English
- Locale files: `locales/fr/*.json`, `locales/en/*.json` (common, gamification, help, insights, skills)
- Config: `lib/i18n.ts`
- Provider: `contexts/AuthContext.tsx`
- Features: Face ID/Touch ID + 4-digit PIN fallback
- Storage: SecureStore (auth_enabled, auth_pin_hash, auth_lock_delay)
- Lock screen: `components/LockScreen.tsx` overlays entire app
- Profile switch: PIN required for child-to-adult transition
- Provider: `contexts/ParentalControlsContext.tsx`
- Categories: rdv, budget, stock, defis, wishlist, souvenirs, recherche, gratitude
- Default: All restricted (maximum safety)
- Storage: SecureStore
- Local notifications via `expo-notifications`
- Config: `lib/notifications.ts` (preferences), `lib/scheduled-notifications.ts` (scheduling)
- RDV alerts, task reminders, weekly recaps
- Library: `expo-haptics`
- Used on: Important interactions (PIN entry, profile switch, task completion)
- Library: `react-native-reanimated` ~4.1
- Pattern: `useSharedValue` + `useAnimatedStyle` + `withSpring`
- Convention: Avoid `perspective` in transforms (causes 3D clipping), prefer `scaleX` for flips
- `console.warn` / `console.error` in `__DEV__` mode only
- No external logging/monitoring service
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
