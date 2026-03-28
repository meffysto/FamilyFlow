# External Integrations

**Analysis Date:** 2026-03-28

## APIs & External Services

**AI / LLM:**
- Anthropic Claude API - Conversational vault assistant, AI suggestions, receipt scanning (vision), recipe AI extraction
  - Client: Direct `fetch()` to `https://api.anthropic.com/v1/messages` (no SDK package)
  - Implementation: `lib/ai-service.ts` (all AI calls), `lib/recipe-import.ts` (recipe text extraction)
  - Models: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`, default), Claude Sonnet 4.6 (`claude-sonnet-4-6`)
  - Auth: API key stored in `expo-secure-store` (key: `ai_api_key`), model in key `ai_model`
  - Context provider: `contexts/AIContext.tsx` - manages config, model selection, rate limiting (2s debounce)
  - Privacy: All personal data anonymized before sending via `lib/anonymizer.ts`, deanonymized on response
  - Feature scope: Entirely optional - app works fully without API key configured
  - Use cases: vault Q&A, family insights, receipt OCR (vision), recipe URL/image parsing

**Recipe Import Services:**
- cook.md - Recipe URL-to-Cooklang conversion service
  - Client: Direct `fetch()` to `https://cook.md/{url}` and `https://cook.md/cookifies/{uuid}/download`
  - Implementation: `lib/recipe-import.ts`
  - Flow: Submit URL -> poll for UUID (90s timeout, 3s interval) -> download converted .cook file

- CookLang Community Recipes - Browse/import shared recipes
  - Client: Direct `fetch()` to `https://recipes.cooklang.org`
  - Implementation: `lib/recipe-import.ts`

**Messaging:**
- Telegram Bot API - Outbound notifications to family/grandparents
  - Client: Direct `fetch()` to `https://api.telegram.org/bot{token}/...`
  - Implementation: `lib/telegram.ts` (core send functions), `lib/sharing.ts` (multi-channel abstraction)
  - Endpoints used:
    - `POST /bot{token}/sendMessage` - Text messages (HTML parse mode)
    - `POST /bot{token}/sendPhoto` - Single photo upload via FormData
    - `POST /bot{token}/sendMediaGroup` - Album of up to 10 photos
  - Auth: Bot token in `expo-secure-store` (key: `telegram_token`), chat ID (key: `telegram_chat_id`)
  - Features: Task completed alerts, loot box results, daily summaries, weekly recaps, photo sharing
  - Direction: Outbound only (no incoming webhooks, no bot commands listener)

## Data Storage

**Primary Data:**
- Obsidian Vault (local filesystem) - All family data as Markdown with YAML frontmatter
  - Client: `expo-file-system` (legacy API) + custom `VaultAccess` native module
  - Read/Write: `lib/vault.ts` (VaultManager class)
  - Parse/Serialize: `lib/parser.ts` (76KB - handles all markdown formats)
  - Frontmatter: `gray-matter` for YAML parsing
  - Format constraints: UTF-8, LF line endings, Obsidian emoji markers (🔁 📅 ✅) preserved
  - Sync: iCloud (iOS) via security-scoped bookmarks in VaultAccess native module
  - No database - pure file-based storage

**Preferences & Secrets:**
- `expo-secure-store` - Encrypted key-value storage (iOS Keychain / Android Keystore backed)
  - Used by: `contexts/AIContext.tsx`, `contexts/AuthContext.tsx`, `lib/notifications.ts`, `lib/i18n.ts`, `lib/scheduled-notifications.ts`, `lib/sharing.ts`
  - Known keys: `ai_api_key`, `ai_model`, `telegram_token`, `telegram_chat_id`, `auth_enabled`, `auth_pin_hash`, `auth_lock_delay`, `app_language`, `vault_path`, `active_profile_id`, `notif_schedule_config`

**Widget Data:**
- iOS: App Group shared container (`group.com.familyvault.dev`) via VaultAccess native module
- Android: JSON cache file at `{documentDirectory}/widget-data.json`

**File Storage:**
- Local filesystem only (no cloud storage service)
- Photos stored within vault directory structure
- iCloud sync handled at OS level through vault location

**Caching:**
- None (no Redis, AsyncStorage cache, or similar)

## Authentication & Identity

**App Lock:**
- `expo-local-authentication` - Biometric auth (Face ID / Touch ID)
  - Implementation: `contexts/AuthContext.tsx`
  - Fallback: Custom 4-digit PIN (SHA-256 hashed in pure JS, stored in SecureStore)
  - Configurable lock delay
  - No external auth provider - purely local device authentication

**Parental Controls:**
- Custom implementation in `contexts/ParentalControlsContext.tsx`
- Profile-based access filtering: adulte (sees all), enfant/ado (sees own data + shared)
- Profile filtering logic also in `lib/ai-service.ts` (`filterByProfile`)

## Sharing Channels

**Multi-channel abstraction (`lib/sharing.ts`):**
- Telegram: Auto-send via Bot API (text, photos, albums, weekly recaps)
- WhatsApp: Native share sheet via `react-native-share` (groups supported)
- iMessage: Native share sheet via `react-native-share`
- URL queries configured in `app.json`: `whatsapp`, `sms`, `tel`

## Device Capabilities

**Camera & Photos:**
- `expo-image-picker` - Photo capture and gallery selection
- `expo-image-manipulator` - Image resize/compress (receipt scanning, recipe photos)
- Implementation: `lib/receipt-scanner.ts`, `lib/recipe-import.ts`

**Voice:**
- `expo-speech-recognition` - Voice-to-text transcription (medical consultation notes)

**Calendar & Contacts:**
- `expo-calendar` - Import calendar events / birthdays
- `expo-contacts` - Import contact birthdays
- Implementation: `lib/calendar-aggregator.ts`

**Local Notifications:**
- `expo-notifications` - Local scheduled notifications only (no remote push)
- Implementation: `lib/scheduled-notifications.ts`
- Categories: RDV reminders (veille 20h + jour J 7h30 + 1h avant), task deadlines, cleaning schedule, low stock alerts, daily app reminder, pregnancy weekly updates
- Config persisted in `expo-secure-store` (key: `notif_schedule_config`)
- Push entitlement explicitly removed via `plugins/remove-push-entitlement.js`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Crashlytics, Bugsnag)

**Analytics:**
- None (no Amplitude, Mixpanel, Firebase Analytics)

**Logs:**
- `console.log` gated behind `__DEV__` flag (development only)
- Errors collected in local `debugErrors` array inside `hooks/useVault.ts`
- No production logging service

## CI/CD & Deployment

**Build Service:**
- EAS Build (Expo Application Services) - Cloud builds
  - Config: `eas.json`
  - Profiles: development (simulator), preview (internal), production (auto-increment + remote credentials)

**App Distribution:**
- iOS: Apple App Store (ASC App ID: 6760829141)
- Android: Google Play Store
- Internal testing: EAS internal distribution (`preview` profile)

**CI Pipeline:**
- None detected (no GitHub Actions, CircleCI, or other CI config files)

## Environment Configuration

**Required for core functionality:**
- Obsidian vault path (user selects via document picker, stored in SecureStore as `vault_path`)

**Optional (all stored in SecureStore, user-configured in Settings):**
- `ai_api_key` - Anthropic Claude API key (enables AI features)
- `ai_model` - Selected Claude model
- `telegram_token` - Telegram bot token (enables Telegram notifications)
- `telegram_chat_id` - Telegram chat/group ID

**Secrets location:**
- All secrets in `expo-secure-store` (device-encrypted keychain)
- No `.env` files detected or required
- No server-side secrets (no backend)
- No build-time secrets needed

## Webhooks & Callbacks

**Incoming:**
- None (no backend server, no webhook endpoints)

**Outgoing:**
- Anthropic Messages API - `lib/ai-service.ts`, `lib/recipe-import.ts`
- Telegram Bot API (sendMessage, sendPhoto, sendMediaGroup) - `lib/telegram.ts`
- cook.md conversion API - `lib/recipe-import.ts`
- CookLang community recipes API - `lib/recipe-import.ts`

---

*Integration audit: 2026-03-28*
