# Codebase Structure

**Analysis Date:** 2026-03-28

## Directory Layout

```
family-vault/
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx         # Root layout (provider hierarchy)
│   ├── setup.tsx           # Onboarding wizard (47KB)
│   ├── +native-intent.ts   # Deep link handler
│   └── (tabs)/             # Tab navigator
│       ├── _layout.tsx     # Tab bar config + profile picker
│       ├── index.tsx       # Dashboard (55KB)
│       ├── tasks.tsx       # Task management (45KB)
│       ├── journal.tsx     # Baby journal (47KB)
│       ├── calendar.tsx    # Calendar view
│       ├── more.tsx        # Feature menu hub
│       └── [19 hidden screens].tsx
├── components/             # Reusable UI components
│   ├── ui/                 # Design system primitives
│   ├── dashboard/          # Dashboard section cards (34 components)
│   ├── mascot/             # Tree mascot system (TreeView, shop, farm)
│   ├── calendar/           # Calendar sub-components
│   ├── charts/             # BarChart, DotChart
│   ├── growth/             # Growth chart + legend
│   ├── help/               # Coach marks + help modals
│   ├── settings/           # Settings sub-screens (17 components)
│   └── [48 standalone components]
├── contexts/               # React Context providers
│   ├── VaultContext.tsx     # Central data context (thin wrapper)
│   ├── ThemeContext.tsx     # Colors, dark mode, profile themes
│   ├── AuthContext.tsx      # Biometric + PIN authentication
│   ├── AIContext.tsx        # Claude API integration
│   ├── HelpContext.tsx      # Coach marks state
│   ├── ParentalControlsContext.tsx
│   └── ToastContext.tsx     # Toast notification system
├── hooks/                  # Custom React hooks
│   ├── useVault.ts         # Main state hook (140KB, ~80 actions)
│   ├── useGamification.ts  # XP/level/reward logic
│   ├── useFarm.ts          # Farm mini-game state
│   ├── useCalendarEvents.ts
│   ├── useStatsData.ts
│   ├── useAnimConfig.ts
│   ├── useResponsiveLayout.ts
│   └── useRefresh.ts
├── lib/                    # Core logic (no React)
│   ├── parser.ts           # Markdown parser/serializer (76KB)
│   ├── vault.ts            # VaultManager class (37KB)
│   ├── types.ts            # All TypeScript interfaces (19KB)
│   ├── ai-service.ts       # Claude API client (32KB)
│   ├── gamification/       # XP engine, rewards, skill tree, seasonal
│   ├── mascot/             # Tree mascot engine, sagas, farm, types
│   ├── cooklang.ts         # .cook recipe parser (30KB)
│   ├── search.ts           # Multi-type search (20KB)
│   ├── insights.ts         # Deterministic suggestions (24KB)
│   ├── notifications.ts    # Notification preferences
│   ├── scheduled-notifications.ts  # Notification scheduling
│   ├── calendar-aggregator.ts
│   ├── recipe-import.ts    # Recipe import logic
│   ├── telegram.ts         # Telegram bot integration
│   ├── i18n.ts             # Internationalization setup
│   ├── budget.ts           # Budget parsing
│   ├── growth-data.ts      # WHO growth curves
│   ├── __tests__/          # Unit tests (Jest)
│   └── [20+ utility modules]
├── constants/              # Static config and design tokens
│   ├── colors.ts           # LightColors, DarkColors (semantic)
│   ├── themes.ts           # 9 profile themes
│   ├── typography.ts       # FontSize, FontWeight, LineHeight
│   ├── spacing.ts          # Spacing (xxs-6xl), Radius (xs-full)
│   ├── shadows.ts          # Shadow tokens (xs/sm/md/lg/xl)
│   ├── stock.ts            # Stock categories/emplacements
│   ├── defiTemplates.ts    # Challenge templates
│   ├── secret-missions.ts  # Secret mission definitions
│   └── nightMode.ts        # Night mode config
├── modules/                # Native modules (Expo Modules)
│   └── vault-access/       # iOS NSFileCoordinator bridge
│       ├── ios/            # Swift implementation
│       ├── android/        # Kotlin stub
│       └── src/            # JS interface
├── locales/                # Translation files
│   ├── fr/                 # French (primary): common, gamification, help, insights, skills
│   └── en/                 # English: common, gamification, help, insights, skills
├── assets/                 # Static assets
│   ├── garden/             # Garden/farm sprites
│   ├── illustrations/      # App illustrations
│   ├── items/              # Mascot items
│   ├── trees/              # Tree species assets
│   └── [app icons, splash]
├── widgets/                # Home screen widgets
│   ├── android/            # Android widget implementation
│   └── MaJournee/          # iOS widget (Swift)
├── plugins/                # Expo config plugins
│   ├── remove-push-entitlement.js
│   └── with-widget.js      # Widget build config
├── scripts/                # Build/asset scripts
│   ├── slice-crops.mjs     # Sprite slicing
│   └── slice-sprites.mjs
├── patches/                # patch-package patches
├── ai/                     # AI research/prompts
├── docs/                   # HTML previews and promo assets
├── index.ts                # App entry (widget handler + expo-router)
├── app.json                # Expo config
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── babel.config.js         # Babel config
└── jest.config.js          # Jest config
```

## Directory Purposes

**`app/`:**
- Purpose: All screens via expo-router file-based routing
- Contains: `.tsx` files where each file = one route
- Key files: `_layout.tsx` (root providers), `(tabs)/_layout.tsx` (tab bar), `(tabs)/index.tsx` (dashboard)
- Pattern: Screens are large self-contained files (20-55KB each) with inline styles

**`components/`:**
- Purpose: Shared UI components used across screens
- Contains: 48 standalone components + 8 subdirectories with grouped components
- Key subdirs: `ui/` (design system), `dashboard/` (34 dashboard cards), `mascot/` (tree system), `settings/` (17 setting panels)
- Barrel exports: `components/ui/index.ts`, `components/dashboard/index.ts`

**`contexts/`:**
- Purpose: React Context providers for cross-cutting state
- Contains: 7 providers, each managing one concern
- Key file: `VaultContext.tsx` (thin wrapper around `useVaultInternal()`)

**`hooks/`:**
- Purpose: Stateful logic encapsulated as custom hooks
- Contains: 8 hooks
- Key file: `useVault.ts` (140KB) -- the single source of truth for all vault data

**`lib/`:**
- Purpose: Pure logic with no React dependencies (parsers, engines, services)
- Contains: 36 modules + 3 subdirectories
- Key files: `parser.ts` (76KB, all Markdown parsing), `vault.ts` (37KB, file operations), `types.ts` (19KB, all interfaces)

**`constants/`:**
- Purpose: Static configuration, design tokens, template data
- Contains: 9 files of constants
- Key files: `colors.ts` (semantic color tokens), `themes.ts` (profile themes), `spacing.ts` + `typography.ts` + `shadows.ts` (design tokens)

**`modules/vault-access/`:**
- Purpose: Native bridge for iOS NSFileCoordinator (iCloud file locking)
- Contains: Swift iOS implementation, Kotlin Android stub, JS interface
- Pattern: Expo Module API

## Key File Locations

**Entry Points:**
- `index.ts`: App entry -- registers Android widget, imports expo-router
- `app/_layout.tsx`: Root layout -- provider hierarchy, error boundary, auth lock
- `app/(tabs)/_layout.tsx`: Tab navigator with 5 visible + 19 hidden screens
- `app/setup.tsx`: Onboarding wizard (vault picker, profile creation)

**Configuration:**
- `app.json`: Expo config (plugins, permissions, scheme, icons)
- `tsconfig.json`: TypeScript config
- `babel.config.js`: Babel with expo preset
- `jest.config.js`: Jest config with ts-jest
- `eas.json`: EAS Build config

**Core Logic:**
- `hooks/useVault.ts`: ALL app state + 80+ mutation actions (140KB)
- `lib/parser.ts`: Markdown/YAML bidirectional parsing (76KB)
- `lib/vault.ts`: VaultManager file system abstraction (37KB)
- `lib/types.ts`: All TypeScript type definitions (19KB)
- `lib/gamification/engine.ts`: XP, levels, rewards engine
- `lib/mascot/engine.ts`: Tree mascot logic
- `lib/ai-service.ts`: Claude API direct fetch client

**Design System:**
- `constants/colors.ts`: `LightColors` and `DarkColors` objects
- `constants/themes.ts`: 9 profile themes with primary/tint colors
- `constants/typography.ts`: `FontSize`, `FontWeight`, `LineHeight`
- `constants/spacing.ts`: `Spacing` (xxs through 6xl), `Radius` (xs through full)
- `constants/shadows.ts`: `Shadow` tokens
- `components/ui/index.ts`: Barrel export for UI primitives

**Testing:**
- `lib/__tests__/`: Unit tests
- `jest.config.js`: Jest config

## Naming Conventions

**Files:**
- Screens: `kebab-case.tsx` (e.g., `night-mode.tsx`)
- Components: `PascalCase.tsx` (e.g., `TaskCard.tsx`, `DashboardMeals.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useVault.ts`, `useFarm.ts`)
- Lib modules: `kebab-case.ts` (e.g., `ai-service.ts`, `calendar-aggregator.ts`)
- Constants: `kebab-case.ts` (e.g., `secret-missions.ts`)
- Context providers: `PascalCase.tsx` with `Context` suffix (e.g., `ThemeContext.tsx`)

**Directories:**
- Lowercase with hyphens: `vault-access/`, `__tests__/`
- Expo router groups: Parenthesized `(tabs)/`

**Dashboard components:** Always prefixed `Dashboard` + feature name (e.g., `DashboardMeals.tsx`, `DashboardBudget.tsx`)

**Settings components:** Always prefixed `Settings` + feature name (e.g., `SettingsAuth.tsx`, `SettingsProfiles.tsx`)

## Where to Add New Code

**New Screen:**
- Create `app/(tabs)/my-screen.tsx`
- Add `<Tabs.Screen name="my-screen" options={{ href: null }} />` in `app/(tabs)/_layout.tsx` (hidden screen) or with tab icon (visible tab)
- Access via `router.push('/my-screen')` from the `more.tsx` menu or other screens

**New Vault Data Type:**
1. Add TypeScript interface in `lib/types.ts`
2. Add `parse*` and `serialize*` functions in `lib/parser.ts`
3. Add state + actions in `hooks/useVault.ts` (inside `useVaultInternal()`)
4. The `VaultState` interface in `hooks/useVault.ts` exposes it to all screens

**New Dashboard Section:**
- Create `components/dashboard/DashboardMyFeature.tsx`
- Export from `components/dashboard/index.ts`
- Add to dashboard render in `app/(tabs)/index.tsx`
- Follow pattern: receive `DashboardSectionProps` (or `DashboardSectionWithTaskToggleProps`)

**New UI Component:**
- Create `components/ui/MyComponent.tsx`
- Export from `components/ui/index.ts`
- Use `useThemeColors()` for all colors, `Spacing`/`FontSize` tokens for layout

**New Settings Panel:**
- Create `components/settings/SettingsMyFeature.tsx`
- Import in `app/(tabs)/settings.tsx`

**New Constant/Config:**
- Add file to `constants/` following `kebab-case.ts` convention

**New Hook:**
- Add to `hooks/` with `use` prefix
- If it manages vault data, integrate into `useVaultInternal()` instead of creating a standalone hook

**New Translation:**
- Add keys to `locales/fr/common.json` and `locales/en/common.json`
- Or to domain-specific files (gamification, help, insights, skills)

**New Gamification Feature:**
- Logic in `lib/gamification/`
- Mascot/tree features in `lib/mascot/`
- UI in `components/mascot/`

## Special Directories

**`modules/vault-access/`:**
- Purpose: Native Expo module for iOS NSFileCoordinator
- Generated: Partially (native build artifacts)
- Committed: Yes (source code)

**`patches/`:**
- Purpose: patch-package patches for dependencies
- Generated: No (manually created)
- Committed: Yes
- Applied: Automatically via `postinstall` script

**`docs/`:**
- Purpose: HTML previews and promo assets (not shipped in app)
- Generated: No
- Committed: Yes (but not in production builds)

**`widgets/`:**
- Purpose: iOS (SwiftUI) and Android home screen widgets
- Contains: `MaJournee/` (iOS widget), `android/` (Android widget)
- Committed: Yes

**`dist/`:**
- Purpose: Build output
- Generated: Yes
- Committed: No (should be in .gitignore)

**`ai/`:**
- Purpose: AI research notes and prompts
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning documents
- Generated: By planning tools
- Committed: Yes

---

*Structure analysis: 2026-03-28*
