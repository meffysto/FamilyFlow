# Codebase Structure

**Analysis Date:** 2026-03-07

## Directory Layout

```
family-vault/
├── app/                     # Expo Router screens and layouts
│   ├── _layout.tsx          # Root layout — vault check + notification setup
│   ├── setup.tsx            # Onboarding wizard (5 steps)
│   └── (tabs)/              # Tab-navigated screens
│       ├── _layout.tsx      # Tab bar config + ThemeProvider + profile picker
│       ├── index.tsx        # Dashboard (visible tab)
│       ├── tasks.tsx        # Task management (visible tab)
│       ├── journal.tsx      # Baby journal (visible tab)
│       ├── photos.tsx       # Photo timeline (visible tab)
│       ├── more.tsx         # More menu (visible tab)
│       ├── meals.tsx        # Weekly meal planner (hidden tab)
│       ├── loot.tsx         # Loot box opener (hidden tab)
│       ├── rdv.tsx          # Appointments (hidden tab)
│       ├── settings.tsx     # App settings (hidden tab)
│       └── stock.tsx        # Baby stock levels (hidden tab)
├── components/              # Reusable UI components
│   ├── DashboardCard.tsx
│   ├── FamilyLeaderboard.tsx
│   ├── LootBoxOpener.tsx
│   ├── MemoryEditor.tsx
│   ├── NotificationEditor.tsx
│   ├── NotificationSettings.tsx
│   ├── RDVEditor.tsx
│   ├── StockEditor.tsx
│   ├── TaskCard.tsx
│   └── VaultPicker.tsx
├── contexts/                # React contexts
│   └── ThemeContext.tsx     # Global theme colors (primary, tint)
├── hooks/                   # React hooks (state + side effects)
│   ├── useVault.ts          # Master state hook — all vault data + mutations
│   └── useGamification.ts   # Points, loot boxes, streaks
├── lib/                     # Core domain logic (pure functions + classes)
│   ├── types.ts             # All TypeScript types/interfaces
│   ├── vault.ts             # VaultManager class (filesystem I/O)
│   ├── parser.ts            # Markdown parse + serialize functions
│   ├── gamification.ts      # Points engine, loot system
│   ├── notifications.ts     # Telegram notification dispatch + templates
│   ├── telegram.ts          # Raw Telegram API client
│   ├── scheduled-notifications.ts  # Local push notification scheduling
│   ├── recurrence.ts        # Task recurrence date calculation
│   └── journal-stats.ts     # Journal statistics helpers
├── constants/               # Static config and lookup tables
│   ├── themes.ts            # ProfileTheme definitions + getTheme()
│   └── rewards.ts           # Loot reward drop tables
├── assets/                  # Static assets bundled with the app
├── docs/                    # Project documentation
├── .planning/               # GSD planning files (not shipped)
│   └── codebase/            # Codebase analysis documents
├── index.ts                 # App entry point (re-exports expo-router/entry)
├── app.json                 # Expo app config
├── eas.json                 # EAS Build profiles
├── tsconfig.json            # TypeScript compiler options
├── babel.config.js          # Babel preset config
├── expo-env.d.ts            # Expo environment type declarations
├── serve-vault.py           # Dev utility: local HTTP server for vault sync
└── package.json             # Dependencies and scripts
```

## Directory Purposes

**`app/`:**
- Purpose: All routable screens, following Expo Router file-system convention
- Contains: Layout files (`_layout.tsx`), screen files, route groups
- Key files: `_layout.tsx` (root guard), `setup.tsx` (onboarding)

**`app/(tabs)/`:**
- Purpose: All tab-navigated screens; 5 visible + 5 hidden (navigated via `router.push`)
- Contains: One `.tsx` file per screen
- Key files: `_layout.tsx` (tab shell + ThemeProvider), `index.tsx` (dashboard), `settings.tsx` (all configuration)

**`components/`:**
- Purpose: Reusable UI components shared across multiple screens
- Contains: Editor modals, display cards, specialized pickers
- Key files: `VaultPicker.tsx` (folder selection UI), `LootBoxOpener.tsx` (animated reward reveal), `TaskCard.tsx` (task row with swipe actions)

**`contexts/`:**
- Purpose: React context providers for cross-cutting UI state
- Contains: `ThemeContext.tsx` only
- Key files: `ThemeContext.tsx` — exports `ThemeProvider` and `useThemeColors()`

**`hooks/`:**
- Purpose: Stateful React hooks; bridge between screens and the library layer
- Key files: `useVault.ts` — the single source of truth for all app data; exports `VaultState` interface and `VAULT_PATH_KEY` / `ACTIVE_PROFILE_KEY` constants

**`lib/`:**
- Purpose: Framework-independent domain logic, usable outside React
- Contains: Classes, pure functions, type definitions
- Key files: `types.ts` (all interfaces — read first), `vault.ts` (VaultManager), `parser.ts` (all MD parsing/serialization)

**`constants/`:**
- Purpose: Static data that never changes at runtime
- Key files: `themes.ts` — exports `THEMES`, `THEME_LIST`, `VALID_THEMES`, `getTheme()`; `rewards.ts` — loot drop rate tables

## Key File Locations

**Entry Points:**
- `index.ts`: App entry, re-exports `expo-router/entry`
- `app/_layout.tsx`: Root navigation guard and notification bootstrap
- `app/setup.tsx`: First-run onboarding wizard

**Configuration:**
- `app.json`: Expo app metadata, bundle ID, permissions declarations
- `eas.json`: EAS Build profiles (development, preview, production)
- `tsconfig.json`: TypeScript compiler options
- `babel.config.js`: Babel preset (`babel-preset-expo`)

**Core Logic:**
- `lib/types.ts`: All domain types — start here when adding new data structures
- `lib/vault.ts`: `VaultManager` class — all filesystem reads/writes go through here
- `lib/parser.ts`: All Markdown parse and serialize functions
- `lib/gamification.ts`: Points, loot, streaks logic

**State:**
- `hooks/useVault.ts`: Master hook — exposes `VaultState` interface with all data and mutation methods
- `hooks/useGamification.ts`: Gamification actions (`completeTask`, `openLootBox`)

**Theming:**
- `constants/themes.ts`: Theme definitions and `getTheme()` helper
- `contexts/ThemeContext.tsx`: `useThemeColors()` — use this in every screen and component

## Naming Conventions

**Files:**
- Screen files: `camelCase.tsx` (e.g. `tasks.tsx`, `journal.tsx`)
- Component files: `PascalCase.tsx` (e.g. `TaskCard.tsx`, `RDVEditor.tsx`)
- Hook files: `useCamelCase.ts` (e.g. `useVault.ts`, `useGamification.ts`)
- Library files: `camelCase.ts` or `kebab-case.ts` (e.g. `vault.ts`, `scheduled-notifications.ts`)
- Context files: `PascalCaseContext.tsx` (e.g. `ThemeContext.tsx`)

**Exports:**
- Screens: default export only (required by Expo Router)
- Components: named exports (e.g. `export function TaskCard(...)`)
- Hooks: named exports (e.g. `export function useVault()`)
- Library functions: named exports
- Types/interfaces: named exports from `lib/types.ts`

## Where to Add New Code

**New screen:**
- Add `.tsx` file to `app/(tabs)/`
- Register in `app/(tabs)/_layout.tsx` — use `options={{ href: null }}` for hidden screens
- Consume data via `useVault()` and colors via `useThemeColors()`

**New reusable UI component:**
- Add `PascalCase.tsx` to `components/`
- Always use `useThemeColors()` for accent colors — never hardcode hex values

**New domain type:**
- Add interface or type to `lib/types.ts` and export from the same file

**New vault data source (new `.md` file):**
1. Add file path constant near top of `hooks/useVault.ts`
2. Add parse call inside `loadVaultData()` in `hooks/useVault.ts`
3. Add parser function in `lib/parser.ts`
4. Add serializer function in `lib/parser.ts` if writes are needed
5. Expose via `VaultState` interface in `hooks/useVault.ts`

**New gamification logic:**
- Add pure function to `lib/gamification.ts`
- Wire into `hooks/useGamification.ts` if it requires async operations or state

**New Telegram notification type:**
- Add `NotifEvent` variant to `lib/types.ts`
- Add variable constants and context builder in `lib/notifications.ts`
- Add default config entry in `getDefaultNotificationPrefs()` in `lib/notifications.ts`

**New profile theme:**
- Add entry to `THEMES` record in `constants/themes.ts`
- Add variant to `ProfileTheme` union type in `constants/themes.ts`

**Shared date/string utilities:**
- Date helpers: add to `lib/parser.ts` (already contains `formatDateForDisplay`)
- Recurrence logic: add to `lib/recurrence.ts`

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents (phases, codebase analysis)
- Generated: No
- Committed: Yes

**`.expo/`:**
- Purpose: Expo build cache and generated type files (`expo-env.d.ts` template)
- Generated: Yes
- Committed: No (in `.gitignore`)

**`dist/`:**
- Purpose: Production web/native build output
- Generated: Yes
- Committed: No

**`assets/`:**
- Purpose: Static assets bundled with the app (icons, splash screens, images)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-07*
