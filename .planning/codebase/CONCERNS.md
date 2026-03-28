# Codebase Concerns

**Analysis Date:** 2026-03-28

## Tech Debt

**God Hook: `hooks/useVault.ts` (3431 lines)**
- Issue: Single hook manages ALL vault state, data loading, and 80+ CRUD operations. The `useMemo` dependency array at the end (lines 3402-3430) lists ~90 items. Every re-render risks massive object recreation.
- Files: `hooks/useVault.ts`, `contexts/VaultContext.tsx`
- Impact: Any change to vault logic risks regressions across the entire app. Adding new features requires modifying this single file. The `loadVaultData` function (lines 578-960+) loads 16+ data sources in a single `Promise.allSettled` call.
- Fix approach: Split into domain-specific hooks (useRecipes, useBudget, useTasks, useMeals, etc.) each managing their own state slice. VaultContext can compose these hooks. Start with the most independent domains (budget, recipes, defis).

**Monolithic Parser: `lib/parser.ts` (2398 lines)**
- Issue: Single file handles parsing/serialization for 20+ vault file formats (tasks, RDVs, courses, meals, stock, profiles, gamification, defis, gratitude, wishlist, anniversaries, notes, quotes, moods, secrets, skills, pregnancy, memories). Adding new formats keeps inflating this file.
- Files: `lib/parser.ts`
- Impact: Hard to test individual parsers in isolation. High risk of regex collisions between formats.
- Fix approach: Split into `lib/parsers/tasks.ts`, `lib/parsers/meals.ts`, etc. with a barrel re-export from `lib/parsers/index.ts` for backward compatibility.

**Duplicate API Call Infrastructure**
- Issue: `lib/ai-service.ts` and `lib/recipe-import.ts` both implement independent `fetch()` calls to `https://api.anthropic.com/v1/messages` with duplicated header construction, error handling, and retry logic. The `anthropic-dangerous-direct-browser-access` header appears in both files.
- Files: `lib/ai-service.ts` (lines 370-430), `lib/recipe-import.ts` (lines 132-200, 550-560, 628-635)
- Impact: Bug fixes or API version updates must be applied in multiple places. Different error handling behavior across API callers.
- Fix approach: Extract a shared `lib/claude-api.ts` client that both modules import. Centralize the `callClaude()` function from `lib/ai-service.ts`.

**Hardcoded Hex Colors (228 occurrences across 21 component files)**
- Issue: Despite CLAUDE.md explicitly requiring `useThemeColors()` / `colors.*`, many components use hardcoded hex colors. Worst offenders: `components/LootBoxOpener.tsx` (100 occurrences), `components/mascot/TreeView.tsx` (47), `components/VaultPicker.tsx` (8), `components/growth/GrowthChart.tsx` (8).
- Files: `components/LootBoxOpener.tsx`, `components/mascot/TreeView.tsx`, `components/VaultPicker.tsx`, `components/SkillNode.tsx`, `components/growth/GrowthChart.tsx`, `components/growth/GrowthLegend.tsx`, `components/mascot/TreeShop.tsx`, `components/mascot/PixelDiorama.tsx`, `components/ui/LivingGradient.tsx`, `components/TaskCard.tsx`
- Impact: Dark mode and theme switching render inconsistent colors in these components. Visual glitches for users who change themes.
- Fix approach: Audit each file, replace hardcoded hex values with semantic color tokens from `constants/colors.ts` accessed via `useThemeColors()`. Some decorative/SVG colors (confetti, growth chart reference bands) may legitimately be hardcoded.

**Deprecated Functions Still Present in `lib/telegram.ts`**
- Issue: Five functions are marked `@deprecated` (lines 49-99): `formatTaskCompletedMessage`, `formatLootBoxMessage`, `formatAllTasksDoneMessage`, `formatLeaderboardMessage`, `formatDailySummaryMessage`. They were replaced by `dispatchNotification` but remain in the codebase.
- Files: `lib/telegram.ts`
- Impact: Dead code increases bundle size and confusion.
- Fix approach: Verify no callers remain, then delete the deprecated functions.

**Deprecated `menageTasks` Property in AI Context**
- Issue: `lib/ai-service.ts` line 46 marks `menageTasks` as deprecated in the `VaultContext` interface. The menage migration happened long ago (migration code still in `hooks/useVault.ts` lines 411-480).
- Files: `lib/ai-service.ts`, `hooks/useVault.ts`
- Impact: Confusing API surface for the AI context builder.
- Fix approach: Remove `menageTasks` from the interface and clean up migration code if confirmed all vaults have migrated.

**`any` Type Usage in `hooks/useVault.ts`**
- Issue: Several places use `as any` type assertions or `[] as any[]` fallbacks instead of proper types (lines 702, 875, 878, 881, 1281, 1293, 1704, 2609).
- Files: `hooks/useVault.ts`
- Impact: Bypasses TypeScript safety, can hide bugs. Especially risky in the gamification and health record update paths.
- Fix approach: Replace `as any[]` catch fallbacks with properly typed empty arrays. Fix the type assertions where possible.

## Known Bugs

**Pre-existing TypeScript Errors**
- Symptoms: `npx tsc --noEmit` reports errors in three files. These are documented in CLAUDE.md as intentionally ignored.
- Files: `components/MemoryEditor.tsx`, `lib/cooklang.ts`, `hooks/useVault.ts`
- Trigger: Running TypeScript compiler check
- Workaround: Errors are ignored per project convention. The app compiles and runs correctly via Expo/Metro bundler.

**`@ts-ignore` Usage for SAF API**
- Symptoms: Two `@ts-ignore` suppressions for Android SAF (Storage Access Framework) API calls that TypeScript cannot type-check.
- Files: `components/VaultPicker.tsx` (lines 127, 186)
- Trigger: Android vault folder picker flow
- Workaround: Suppressions are appropriate here since SAF is a platform-specific legacy API.

## Security Considerations

**API Key Stored in SecureStore (Acceptable Risk)**
- Risk: Claude API key is stored in `expo-secure-store` on-device. If device is compromised, key is extractable.
- Files: `contexts/AIContext.tsx` (line 16: `API_KEY_STORAGE = 'ai_api_key'`), `lib/telegram.ts` (line 120)
- Current mitigation: SecureStore uses iOS Keychain / Android EncryptedSharedPreferences. Key is user-provided and optional.
- Recommendations: This is the standard approach for React Native. No action needed.

**Direct API Calls with `anthropic-dangerous-direct-browser-access` Header**
- Risk: The app calls Claude's API directly from the client with the `anthropic-dangerous-direct-browser-access` header. This bypasses the recommended server-side proxy pattern. The API key is exposed in HTTP requests.
- Files: `lib/ai-service.ts` (line 414), `lib/recipe-import.ts` (lines 193, 556, 632)
- Current mitigation: Data anonymization before sending (see `lib/anonymizer.ts`). API key stored in SecureStore.
- Recommendations: For a personal/family app this is acceptable. If distribution widens, consider a proxy backend to avoid exposing user API keys in network traffic.

**Custom SHA-256 Implementation for PIN Hashing**
- Risk: `contexts/AuthContext.tsx` implements SHA-256 from scratch in pure JavaScript (lines 20-84) instead of using a crypto library. While functionally correct for local PIN hashing, custom crypto implementations are generally discouraged.
- Files: `contexts/AuthContext.tsx`
- Current mitigation: Used only for local PIN verification (never transmitted). Salt is a fixed string `family-vault-pin:`.
- Recommendations: The fixed salt means all users with the same PIN get the same hash. Consider using `expo-crypto` for SHA-256 if available, or at minimum use a per-device random salt stored alongside the hash.

**Path Traversal Protection**
- Risk: `lib/vault.ts` validates relative paths (lines 51-57) to prevent directory traversal attacks.
- Files: `lib/vault.ts`
- Current mitigation: Rejects paths containing `..`, starting with `/`, or containing null bytes.
- Recommendations: Protection is adequate.

## Performance Bottlenecks

**Full Vault Reload on Every Foreground Event**
- Problem: `hooks/useVault.ts` (lines 564-576) reloads ALL vault data every time the app returns to foreground, with only a 1-second delay as debounce.
- Files: `hooks/useVault.ts`
- Cause: No file-level change detection. Every foreground event triggers 16+ file reads and parsing operations.
- Improvement path: Implement file modification time checking (stat before read). Only re-parse files that changed. For iCloud Drive vaults, this could also reduce network reads.

**Massive `useMemo` in useVaultInternal**
- Problem: The return value `useMemo` at lines 3260-3430 has ~90 dependencies. React must shallow-compare all 90 values on every render to determine if the memo is stale.
- Files: `hooks/useVault.ts`
- Cause: All vault state lives in one hook.
- Improvement path: Splitting into domain hooks would naturally reduce dependency array sizes.

**Synchronous Parsing in loadVaultData**
- Problem: `loadVaultData` reads and parses all vault files synchronously within `Promise.allSettled`. For large vaults with many recipes, RDVs, or journal entries, this blocks the JS thread.
- Files: `hooks/useVault.ts` (lines 578-960+)
- Cause: Markdown parsing (especially regex-heavy `lib/parser.ts`) is CPU-bound.
- Improvement path: Consider lazy loading for less critical data (recipes, archived RDVs, historical journal entries). Load only current week's data at boot.

## Fragile Areas

**Markdown Parser Regex Dependencies**
- Files: `lib/parser.ts` (lines 52-59)
- Why fragile: The parser relies on specific emoji markers (due date, recurrence, completed date, reminder time) and precise markdown formatting. If Obsidian changes its task format or users manually edit files with slight variations, parsing silently fails.
- Safe modification: Always add new regex patterns alongside existing ones, never replace. Test with `lib/__tests__/parser.test.ts` and `lib/__tests__/parser-extended.test.ts`.
- Test coverage: Good coverage for parsing (parser.test.ts: 18.9K, parser-extended.test.ts: 35K). But no integration tests for the full load-parse-serialize roundtrip.

**Cooklang Parser (Hermes-safe Reimplementation)**
- Files: `lib/cooklang.ts` (672 lines)
- Why fragile: Custom reimplementation of the Cooklang parser because the official `@cooklang/cooklang-ts` uses Unicode regex properties unsupported by Hermes. Any Cooklang spec changes require manual updates.
- Safe modification: Test with `lib/__tests__/cooklang.test.ts` (13.9K).
- Test coverage: Adequate for the parser itself.

**Gamification Points Flow**
- Files: `hooks/useVault.ts`, `lib/gamification/engine.ts`, `lib/parser.ts`
- Why fragile: Points are added by reading `gamification.md`, mutating in memory, then serializing back. Multiple rapid actions (completing tasks quickly) could cause race conditions if the file hasn't been re-read between writes.
- Safe modification: Always use the `busyRef` guard. Test gamification changes with `lib/__tests__/gamification.test.ts`.
- Test coverage: Engine logic well tested (27.9K test file). Integration with vault file I/O is not tested.

**Vault File Write Concurrency**
- Files: `hooks/useVault.ts`, `lib/vault.ts`
- Why fragile: Multiple CRUD operations can fire in rapid succession (e.g., completing several tasks). Each reads the current file, mutates, and writes back. No file-level locking beyond the `busyRef` boolean (which only guards `loadVaultData`, not individual writes).
- Safe modification: Ensure all write operations read the latest file state before modifying. Avoid caching file contents across operations.
- Test coverage: None for concurrent write scenarios.

## Scaling Limits

**Single-File State Storage**
- Current capacity: All gamification data, family profiles, and configs live in individual markdown files.
- Limit: As history grows (gamification entries, completed defis, journal stats), files become large and parsing slows.
- Scaling path: Implement archival for old gamification history. Consider date-based file splitting for journal entries (already done) and budget entries (already done by month).

**Recipe Loading**
- Current capacity: All `.cook` files are loaded and parsed on `loadRecipes()`.
- Limit: With 100+ recipes, initial load time becomes noticeable.
- Scaling path: Implement lazy loading with metadata cache (title + category only), full parse on demand.

## Dependencies at Risk

**`expo-document-picker` Patched**
- Risk: A patch exists at `patches/expo-document-picker+14.0.8.patch`. Patches can break on dependency upgrades.
- Impact: Vault folder selection on both platforms depends on this patch.
- Migration plan: Check if the patch fix has been upstreamed in newer expo-document-picker versions before upgrading.

**`react-native-confetti-cannon` (v1.5.2)**
- Risk: Small community package, last npm publish may be stale. Used for loot box animations.
- Impact: If it breaks with a React Native upgrade, loot box opening animation fails.
- Migration plan: The package is simple enough to vendor or replace with a Reanimated-based implementation.

## Missing Critical Features

**No Test Suite for Components**
- Problem: All 13 test files live in `lib/__tests__/` and test only library/utility logic. Zero component tests exist. No React Native Testing Library or Detox setup.
- Blocks: Cannot verify UI behavior changes automatically. Every UI change requires manual testing.

**No Error Reporting in Production**
- Problem: Errors are caught with `console.warn` in dev mode only (`if (__DEV__)`). No crash reporting service (Sentry, Bugsnag) is integrated.
- Blocks: Cannot detect or diagnose production crashes.

**`eslint-disable` Without Explanation**
- Problem: `hooks/useCalendarEvents.ts` line 65 disables `react-hooks/exhaustive-deps` without documenting why the dependency was intentionally excluded.
- Files: `hooks/useCalendarEvents.ts`

## Test Coverage Gaps

**No Tests for hooks/**
- What's not tested: `hooks/useVault.ts` (3431 lines), `hooks/useGamification.ts`, `hooks/useFarm.ts`, `hooks/useCalendarEvents.ts`, `hooks/useResponsiveLayout.ts`
- Files: All files in `hooks/`
- Risk: The most critical piece of the app (vault state management) has zero automated tests. Regressions in data loading, saving, or migration code go undetected.
- Priority: High

**No Tests for Mascot/Farm System**
- What's not tested: `lib/mascot/farm-engine.ts`, `lib/mascot/world-grid.ts`, `lib/mascot/sagas-engine.ts` (only `lib/__tests__/mascot-engine.test.ts` covers `lib/mascot/engine.ts`)
- Files: `lib/mascot/farm-engine.ts`, `lib/mascot/world-grid.ts`, `lib/mascot/sagas-engine.ts`, `lib/mascot/sagas-content.ts`
- Risk: Farm planting/harvesting logic, world grid rendering logic, and saga progression could break silently.
- Priority: Medium

**No Tests for Budget System**
- What's not tested: `lib/budget.ts` (parsing/serialization of budget config and monthly entries)
- Files: `lib/budget.ts`
- Risk: Budget calculation errors could go unnoticed.
- Priority: Medium

**No Tests for Recipe Import Pipeline**
- What's not tested: `lib/recipe-import.ts` (URL fetching, HTML-to-text conversion, cook.md integration, AI conversion)
- Files: `lib/recipe-import.ts`
- Risk: Recipe import from URLs could silently fail with format changes.
- Priority: Low

## Accessibility Gaps

**Limited Accessibility Coverage**
- Problem: Only 51 component files contain any accessibility props (`accessibilityLabel`, `accessibilityRole`, etc.) out of 90+ total components. Many interactive elements (especially in mascot/tree views, loot box opener, settings screens) lack screen reader support.
- Files: Most files in `components/mascot/`, `components/dashboard/`, `components/charts/`
- Impact: App is not usable with VoiceOver/TalkBack for visually impaired users.
- Priority: Low (family app with known users), but would block any public distribution.

---

*Concerns audit: 2026-03-28*
