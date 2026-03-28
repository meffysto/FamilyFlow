# Technology Stack

**Analysis Date:** 2026-03-28

## Languages

**Primary:**
- TypeScript ~5.9.2 - All application code (`lib/`, `contexts/`, `components/`, `hooks/`, `app/`)

**Secondary:**
- Swift - Native iOS module (`modules/vault-access/ios/`)
- Kotlin - Native Android module (`modules/vault-access/android/`)
- JavaScript - Babel config (`babel.config.js`), Expo plugins (`plugins/`)

## Runtime

**Environment:**
- React Native 0.81.5 via Expo managed workflow
- Expo SDK ~54.0.0
- Targets: iOS (primary), Android, Web (secondary)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (not committed)

## Frameworks

**Core:**
- Expo ~54.0.0 - Managed workflow with dev-client (`expo-dev-client ~6.0.20`)
- React 19.1.0 - UI rendering
- React Native 0.81.5 - Cross-platform native runtime
- Expo Router ~6.0.23 - File-based routing (typed routes enabled via `experiments.typedRoutes`)

**Animation / Gesture:**
- React Native Reanimated ~4.1.1 - Worklet-based animations (preferred over RN Animated for all new code)
- React Native Gesture Handler ~2.28.0 - Native gesture recognition (`ReanimatedSwipeable`, not `Swipeable`)
- React Native Worklets 0.5.1 - Reanimated worklet runtime
- React Native Confetti Cannon ^1.5.2 - Loot box celebration effect

**Testing:**
- Jest ^29.7.0 - Test runner (configured in `package.json`)
- ts-jest ^29.4.6 - TypeScript transform for Jest
- Note: No active test suite; `npx tsc --noEmit` is the primary validation method

**Build/Dev:**
- babel-preset-expo ~54.0.10 - Babel transpilation
- EAS CLI >= 14.0.0 - Cloud builds via `eas.json`
- patch-package - Post-install patching (`patches/expo-document-picker+14.0.8.patch`)
- sharp ^0.34.5 (devDependency) - Image processing tooling

## Key Dependencies

**Critical:**
- `expo-file-system` ~19.0.21 - All vault file I/O; uses legacy API import (`expo-file-system/legacy`)
- `expo-secure-store` ~15.0.8 - API keys, auth PIN, Telegram tokens, user preferences
- `gray-matter` ^4.0.3 - YAML frontmatter parsing for Obsidian markdown files (`lib/parser.ts`)
- `react-native-reanimated` ~4.1.1 - All animations (spring, timing, shared values)
- `react-native-gesture-handler` ~2.28.0 - Swipe/gesture interactions
- `date-fns` ^4.1.0 - Date formatting and manipulation throughout `lib/`

**Internationalization:**
- `i18next` ^25.10.2 + `react-i18next` ^16.6.0 - i18n framework (fr/en)
- `expo-localization` ~17.0.8 - Device locale detection
- Locale files: `locales/fr/*.json`, `locales/en/*.json`
- Namespaces: common, gamification, help, insights, skills

**UI & Interaction:**
- `react-native-svg` ^15.12.1 - SVG rendering (mascot, icons)
- `expo-linear-gradient` ~15.0.8 - Gradient backgrounds
- `expo-blur` ~15.0.8 - Blur effects
- `expo-haptics` ~15.0.8 - Tactile feedback on interactions

**Device Capabilities:**
- `expo-image-picker` ~17.0.10 - Photo capture/selection
- `expo-image-manipulator` ~14.0.8 - Image resize/compress
- `expo-document-picker` ~14.0.8 - Vault folder selection (patched)
- `expo-speech-recognition` ^3.1.1 - Voice-to-text transcription
- `expo-local-authentication` ~17.0.8 - Face ID / Touch ID / biometrics
- `expo-notifications` ^0.32.16 - Local scheduled notifications (no push server)
- `expo-calendar` ~15.0.8 - Calendar import
- `expo-contacts` ~15.0.11 - Contact/birthday import
- `expo-brightness` ~14.0.8 - Screen brightness control

**Sharing & Communication:**
- `react-native-share` ^12.2.6 - Native share sheet (WhatsApp, iMessage)
- `expo-linking` ~8.0.11 - Deep linking / URL scheme (`family-vault://`)

**Platform Extensions:**
- `react-native-android-widget` ^0.20.1 - Android home screen widgets

**Infrastructure:**
- `react-native-screens` ~4.16.0 - Native screen containers
- `react-native-safe-area-context` ~5.6.0 - Safe area insets
- `react-native-web` ^0.21.0 - Web platform support
- `expo-splash-screen` ~31.0.13 - Launch screen
- `expo-status-bar` ~3.0.9 - Status bar control
- `expo-constants` ~18.0.13 - App constants/config

## Custom Native Modules

**VaultAccess (`modules/vault-access/`):**
- Expo native module (iOS Swift + Android Kotlin)
- Config: `modules/vault-access/expo-module.config.json`
- TS bridge: `modules/vault-access/src/index.ts`
- Provides: coordinated file I/O, iCloud sync, security-scoped bookmarks, App Group data for widgets, Live Activities (baby feeding timer)
- Key functions: `startAccessing`, `restoreAccess`, `readFile`, `writeFile`, `ensureDir`, `deleteFile`, `copyFile`, `downloadICloudFiles`, `listDirectory`, `updateWidgetData`, `startFeedingActivity`, `stopFeedingActivity`

**Expo Config Plugins (`plugins/`):**
- `plugins/remove-push-entitlement.js` - Strips push notification entitlement from iOS build
- `plugins/with-widget.js` - Configures iOS WidgetKit extension + App Group

## Configuration

**TypeScript:**
- Config: `tsconfig.json` extends `expo/tsconfig.base`
- Strict mode enabled
- Path alias: `@/*` maps to `./*`

**Babel:**
- Config: `babel.config.js`
- Presets: `babel-preset-expo`
- Plugins: `react-native-reanimated/plugin` (must be last)

**EAS Build:**
- Config: `eas.json`
- Profiles: `development` (simulator), `preview` (internal distribution), `production` (auto-increment, remote credentials)
- iOS bundle: `com.familyvault.dev`
- Android package: `com.familyvault.app`

**App Config:**
- Config: `app.json` (static Expo config)
- App name: "FamilyFlow"
- Slug: "family-vault"
- Scheme: `family-vault://`
- Orientation: portrait only
- iOS build number: 17
- Android version code: 3

## Platform Requirements

**Development:**
- Node.js (compatible with Expo SDK 54)
- Xcode (iOS builds)
- Android Studio (Android builds)
- Expo Dev Client - custom native modules require dev build, not Expo Go
- Build command: `npx expo run:ios --device` (physical device)
- Type check: `npx tsc --noEmit`

**Production:**
- iOS: App Store (Apple Team ID: AKMNXGVVGX, ASC App ID: 6760829141)
- Android: Google Play (package: `com.familyvault.app`)
- Build service: EAS Build (Expo Application Services)
- No backend server - all data is local (Obsidian vault on device + iCloud sync)

## Widgets

**iOS:**
- WidgetKit extension via `plugins/with-widget.js`
- App Group: `group.com.familyvault.dev`
- Live Activities: Baby feeding timer (via VaultAccess native module)

**Android:**
- `react-native-android-widget` with task handler at `widgets/android/widget-task-handler`
- Widgets: "Ma Journee" (4x2 cells, 30min refresh), "Journal Bebe" (3x2 cells, 30min refresh)
- Entry point: `index.ts` registers widget task handler before expo-router

---

*Stack analysis: 2026-03-28*
