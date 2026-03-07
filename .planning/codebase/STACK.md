# Technology Stack

**Analysis Date:** 2026-03-07

## Languages

**Primary:**
- TypeScript 5.9.x - All app source code (`app/`, `lib/`, `components/`, `hooks/`, `contexts/`)

**Secondary:**
- Python 3 (stdlib only) - Local dev vault sync server (`serve-vault.py`)

## Runtime

**Environment:**
- React Native 0.81.5 via Expo managed workflow
- Targets: iOS (primary), Android, Web (secondary)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

## Frameworks

**Core:**
- Expo ~54.0.0 - Managed workflow runtime and native module bridge
- React 19.1.0 - UI rendering
- React Native 0.81.5 - Cross-platform native UI
- Expo Router ~6.0.23 - File-based navigation (tabs layout at `app/(tabs)/`)

**Animation / Gesture:**
- React Native Reanimated ~4.1.1 - Worklet-based animations
- React Native Gesture Handler ~2.28.0 - Native gesture recognition
- React Native Worklets 0.5.1 - Reanimated worklet runtime
- React Native Confetti Cannon ^1.5.2 - Loot box celebration effect

**Build/Dev:**
- babel-preset-expo ~54.0.10 - Babel transpilation preset
- EAS CLI >= 14.0.0 - Cloud builds via `eas.json`

## Key Dependencies

**Critical:**
- `expo-file-system` ~19.0.21 - All vault file I/O (read/write/copy markdown files); uses legacy API (`expo-file-system/legacy`) for compatibility
- `expo-secure-store` ~15.0.8 - Persists `vault_path`, `active_profile_id`, `telegram_token`, `telegram_chat_id`, and notification schedule config
- `expo-router` ~6.0.23 - App navigation; tabs defined in `app/(tabs)/`
- `gray-matter` ^4.0.3 - YAML frontmatter parsing for RDV markdown files in `lib/parser.ts`
- `date-fns` ^4.1.0 - Date formatting and locale support (`fr` locale) throughout `lib/`

**UX Capabilities:**
- `expo-image-picker` ~17.0.10 - Daily photo capture (camera + photo library)
- `expo-document-picker` ~14.0.8 - Vault folder selection during setup
- `expo-notifications` ^0.32.16 - Local push notifications (daily reminders + RDV alerts)
- `expo-haptics` ~15.0.8 - Haptic feedback on interactions
- `expo-linking` ~8.0.11 - Deep link support (scheme: `family-vault://`)

**Layout:**
- `react-native-safe-area-context` ~5.6.0
- `react-native-screens` ~4.16.0

## Configuration

**Environment:**
- No `.env` files — all runtime secrets stored in `expo-secure-store` (Telegram token, chat ID, vault path)
- No external environment variables required to build or run

**Build:**
- `app.json` - Expo app config (bundle ID: `com.familyvault.app`, iCloud container: Production)
- `eas.json` - EAS Build profiles: `development` (simulator), `preview` (internal distribution), `production` (auto-increment)
- `tsconfig.json` - Extends `expo/tsconfig.base`, strict mode enabled, path alias `@/*` → `./`
- `babel.config.js` - `babel-preset-expo` + `react-native-reanimated/plugin`

## Platform Requirements

**Development:**
- Node.js (compatible with Expo SDK 54)
- npm
- Expo Go app OR EAS development build for physical device testing
- Python 3 (stdlib) for optional local vault sync via `serve-vault.py`

**Production:**
- iOS: bundle ID `com.familyvault.app`, iCloud entitlements required (document picker + file sync), camera + photo library permissions
- Android: package `com.familyvault.app`, external storage + camera permissions
- Deployment: EAS Build → App Store / internal distribution

---

*Stack analysis: 2026-03-07*
