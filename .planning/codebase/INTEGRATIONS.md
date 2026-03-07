# External Integrations

**Analysis Date:** 2026-03-07

## APIs & External Services

**Messaging / Notifications:**
- Telegram Bot API - Outbound-only notifications to family/grandparents
  - SDK/Client: Native `fetch` calls in `lib/telegram.ts`
  - Base URL: `https://api.telegram.org`
  - Endpoints used:
    - `POST /bot{token}/sendMessage` — text messages with HTML parse mode
    - `POST /bot{token}/sendPhoto` — single photo upload via FormData
    - `POST /bot{token}/sendMediaGroup` — album of up to 10 photos
  - Auth: Bot token stored in `expo-secure-store` under key `telegram_token`
  - Chat ID stored under key `telegram_chat_id`
  - No webhooks or inbound messages — app only sends

## Data Storage

**Databases:**
- None — no remote database. All data is stored as plain Markdown files in an Obsidian vault on the device filesystem.

**File Storage:**
- Local filesystem (device) via `expo-file-system` (legacy API)
  - Vault root path persisted in `expo-secure-store` under key `vault_path`
  - All read/write via `VaultManager` class in `lib/vault.ts`
  - UTF-8, LF line endings, YAML frontmatter preserved for Obsidian compatibility
- iCloud (iOS only) - File synchronization via iCloud container
  - Configured in `app.json` plugin: `"iCloudContainerEnvironment": "Production"`
  - iCloud enables automatic vault sync across devices when vault is inside an iCloud-managed folder
  - Entitlements: `UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`

**Caching:**
- None — no caching layer. Vault data is read from disk on each load and on app foreground.

## Authentication & Identity

**Auth Provider:**
- None — no user authentication or accounts
- Identity is a simple profile selection stored locally (`active_profile_id` in `expo-secure-store`)
- Telegram credentials are user-supplied and stored in `expo-secure-store`

## Local Notifications

**Push Notifications:**
- `expo-notifications` (local scheduling only — no remote push server)
- Daily recurring reminders scheduled via `lib/scheduled-notifications.ts`:
  - Morning reminder (default 07:30)
  - Midday check (default 12:00)
  - Evening summary (default 20:00)
- RDV (appointment) alerts: scheduled N minutes before appointment datetime
- Config persisted in `expo-secure-store` under key `notif_schedule_config`
- Permissions requested at runtime via `requestNotificationPermissions()`

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Crashlytics, or similar

**Logs:**
- Errors collected in a local `debugErrors` array inside `hooks/useVault.ts` and surfaced as a string on the `error` field of vault state. No external logging.

## CI/CD & Deployment

**Hosting:**
- Expo Application Services (EAS) for cloud builds
- App Store (iOS) / Google Play (Android) for distribution
- EAS config: `eas.json`

**CI Pipeline:**
- None detected — no GitHub Actions, CircleCI, or other CI config files present

## Local Dev Utility

**Vault Sync Server:**
- `serve-vault.py` — Python 3 HTTP server (stdlib only, no dependencies)
- Serves `.md` files from a local Obsidian vault over HTTP on port `8765`
- Endpoints:
  - `GET /manifest.json` — lists all `.md` files in vault
  - `GET /file/{path}` — serves a single markdown file
- Vault path configured via `VAULT_PATH` environment variable (default: `~/Documents/coffre`)
- Used during development to sync vault from Mac to device; not part of production build

## Webhooks & Callbacks

**Incoming:**
- None — app does not expose any webhook endpoints

**Outgoing:**
- Telegram Bot API calls (fire-and-forget, see above)

## Environment Configuration

**Required secrets (runtime, not build-time):**
- `telegram_token` — Telegram bot token (stored in expo-secure-store, user-supplied via Settings screen)
- `telegram_chat_id` — Telegram chat/group ID (stored in expo-secure-store, user-supplied via Settings screen)
- `vault_path` — Absolute filesystem path to the Obsidian vault folder (stored in expo-secure-store, set during onboarding)

**Secrets location:**
- All secrets stored in `expo-secure-store` (iOS Keychain / Android Keystore backed)
- No `.env` files present or required
- No build-time secrets

---

*Integration audit: 2026-03-07*
