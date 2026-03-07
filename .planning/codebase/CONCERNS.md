# Codebase Concerns

**Analysis Date:** 2026-03-07

## Tech Debt

**Hardcoded placeholder credentials in VaultPicker:**
- Issue: `COFFRE_DEFAULT = '/Users/USER/Documents/coffre'` and `MAC_SERVER = 'http://YOUR_MAC_IP:8765'` are literal placeholder strings that ship in production UI — clicking the quick-fill button pre-fills a broken path for any real user.
- Files: `components/VaultPicker.tsx` (lines 38–39)
- Impact: Misleading UX for new users; pressing "Utiliser le vault coffre" sets a path that will never validate.
- Fix approach: Remove the quick-fill button entirely or gate it behind a dev-only flag (`__DEV__`).

**Legacy expo-file-system API pinned by comment:**
- Issue: `import * as FileSystem from 'expo-file-system/legacy'` in both `lib/vault.ts` and `components/VaultPicker.tsx`. Comment acknowledges this is a compatibility workaround.
- Files: `lib/vault.ts` (line 24), `components/VaultPicker.tsx` (line 20)
- Impact: Will break when `expo-file-system` v56+ drops the `/legacy` export. Already causing `@ts-ignore` usage on the Android SAF path.
- Fix approach: Migrate to the new `File`/`Directory` API introduced in expo-file-system v55.

**Android SAF access uses `@ts-ignore` + unsafe cast:**
- Issue: `// @ts-ignore — SAF is available in legacy API on Android` followed by `(FileSystem as any).StorageAccessFramework` — no type safety, will silently fail if API changes.
- Files: `components/VaultPicker.tsx` (lines 163–164)
- Impact: Android vault selection has no type guard; runtime crash possible if API shape changes.
- Fix approach: Type the SAF API properly or use expo-file-system's typed StorageAccessFramework export.

**Deprecated Telegram helper functions still in codebase:**
- Issue: `formatTaskCompletedMessage`, `formatLootBoxMessage`, `formatAllTasksDoneMessage`, `formatLeaderboardMessage`, `formatDailySummaryMessage` are all marked `@deprecated` but remain in `lib/telegram.ts`. They duplicate the functionality in `lib/notifications.ts`.
- Files: `lib/telegram.ts` (lines 49–110)
- Impact: Dead code increases bundle size; new contributors may use deprecated functions instead of the dispatcher.
- Fix approach: Remove all `@deprecated` functions and verify no remaining call sites.

**MEALS_TEMPLATE duplicated in useVault and vault.ts:**
- Issue: The meals template string is defined as a constant in `hooks/useVault.ts` (lines 109–140) AND generated via `_mealsContent()` in `lib/vault.ts` (lines 414–447). They are not identical — the template in `vault.ts` includes no blank lines between days.
- Files: `hooks/useVault.ts` (line 109), `lib/vault.ts` (line 414)
- Impact: Auto-created `Repas de la semaine.md` differs depending on whether it was created via `scaffoldVault` or via the auto-creation path in `loadVaultData`.
- Fix approach: Extract a single `MEALS_TEMPLATE` constant to `lib/vault.ts` and import it in `hooks/useVault.ts`.

**Profile ID generation duplicated in 4 places:**
- Issue: The slug pattern `name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')` appears in `lib/vault.ts`, `hooks/useVault.ts`, `app/(tabs)/index.tsx`, and `lib/parser.ts`. Any change to the ID algorithm requires changes in all 4 places.
- Files: `lib/vault.ts` (lines 305, 317, 394), `hooks/useVault.ts` (lines 349, 365, 470, 868), `app/(tabs)/index.tsx` (line 117)
- Impact: Risk of ID mismatch if one copy diverges; photo lookup uses a different code path than profile resolution.
- Fix approach: Extract a `toProfileId(name: string): string` utility to `lib/parser.ts` or a new `lib/utils.ts`, use it everywhere.

**`ado` role type defined but never used:**
- Issue: `Profile.role` accepts `'enfant' | 'ado' | 'adulte'` but `'ado'` is never produced by `parseFamille`, never handled in any UI branch, and has no special behavior in gamification (`LOOT_THRESHOLD`, `DROP_RATES` only have `enfant`/`adulte` keys).
- Files: `lib/types.ts` (line 55), `lib/gamification.ts` (constants reference only `enfant`/`adulte`)
- Impact: Any profile with `role: ado` silently falls through to `adulte` thresholds in gamification; gamification writes would produce a profile with `role: adulte` on the next `parseGamification` call.
- Fix approach: Either implement `ado` support fully or remove it from the union type.

---

## Known Bugs

**Photo retake uses `setTimeout` to defer picker after modal close:**
- Symptoms: When tapping "Reprendre" in the fullscreen photo modal in `photos.tsx`, the modal closes and then the photo picker opens after a 600ms delay. If the user navigates away within that window, the picker still opens.
- Files: `app/(tabs)/photos.tsx` (line 426)
- Trigger: Tap any calendar photo → tap "Reprendre"
- Workaround: None; the 600ms delay is the only guard.

**RDV rename creates duplicate file before deleting old one:**
- Symptoms: In `updateRDV`, if the filename changes (new date/type/enfant), the code writes to the old path first (line 760), then writes to the new path (line 763), then deletes the old path. Two writes happen; if the delete fails, both files exist with the same content.
- Files: `hooks/useVault.ts` (lines 759–766)
- Trigger: Edit a RDV and change date, type, or enfant name.
- Workaround: Manual deletion in the vault.

**`busyRef` guard only prevents AppState reload, not concurrent writes:**
- Symptoms: `busyRef.current = true` in `addPhoto` blocks the 1-second-delayed AppState reload, but multiple calls to `addPhoto` simultaneously are not blocked from each other, and other mutations (`toggleTask`, `updateStockQuantity`) never check `busyRef`. A race condition is possible when adding a photo while other writes are in flight.
- Files: `hooks/useVault.ts` (line 464), `lib/vault.ts` (lines 59–70)
- Trigger: Rapid interactions while a photo is being saved.
- Workaround: None.

**`clearCompletedCourses` removes manually-typed `[X]` items:**
- Symptoms: `lines.filter((l) => !l.match(/^-\s+\[x\]/i))` correctly handles case-insensitive matching. However, any `- [X]` items hand-typed in Obsidian will be removed on next clear — even if the user did not intend them as "checked" items in the app context.
- Files: `hooks/useVault.ts` (line 828)
- Impact: Low; behaves as expected for app-managed items but may surprise users who edit the vault directly.

---

## Security Considerations

**Telegram Bot Token transmitted as URL path segment:**
- Risk: The token is passed in plaintext as part of the URL (`/bot${token}/sendMessage`), meaning any network proxy or log will capture it. There is no rate limiting or token rotation strategy.
- Files: `lib/telegram.ts` (line 26)
- Current mitigation: Token stored in SecureStore (iOS Keychain / Android Keystore); HTTPS to Telegram API.
- Recommendations: Accept current risk as it matches Telegram's own bot model; document that the token should be treated as a secret and rotated if compromised.

**Vault path stored in SecureStore (wrong tool for non-secret data):**
- Risk: `expo-secure-store` has a 2048-byte value size limit. Long paths near the limit may silently truncate on some platforms, resulting in a broken vault path that fails silently on startup.
- Files: `hooks/useVault.ts` (line 414), `app/_layout.tsx` (line 27)
- Current mitigation: None.
- Recommendations: Use `AsyncStorage` for non-secret data like vault path; reserve `SecureStore` for the Telegram token and chat IDs.

**Mac sync server downloads files over plain HTTP without integrity check:**
- Risk: `VaultPicker.syncFromMac()` downloads the entire vault over `http://YOUR_MAC_IP:8765` with no TLS and no file hash verification. A MITM on the local network could inject arbitrary markdown content into the vault.
- Files: `components/VaultPicker.tsx` (lines 41–85)
- Current mitigation: Only used on local network (Wi-Fi) with a hardcoded IP.
- Recommendations: Add a simple manifest hash check, or document the network trust assumption explicitly.

**RDV filenames not sanitized against path traversal:**
- Risk: `rdvFileName()` builds a filename from `rdv.type_rdv` and `rdv.enfant` without sanitizing slashes, dots, or other filesystem-unsafe characters. A `type_rdv` value of `../../etc/passwd` would produce a path traversal in `writeFile`.
- Files: `lib/parser.ts` (lines 337–340), `hooks/useVault.ts` (lines 731–737)
- Current mitigation: None; `RDVEditor.tsx` uses free-text input for `type_rdv`.
- Recommendations: Sanitize filename components — strip `/`, `..`, and other special characters before constructing the write path.

---

## Performance Bottlenecks

**`loadVaultData` reads all files sequentially on every refresh:**
- Problem: The entire vault is reloaded from disk on every `refresh()` call, every `AppState` foreground event, and after most mutation operations. All file reads are sequential (`await` in loops), not parallelized.
- Files: `hooks/useVault.ts` (lines 203–404)
- Cause: `for...of` loops with `await` inside for tasks, RDVs, photos, and memories.
- Improvement path: Parallelize independent reads with `Promise.all`. Consider caching parsed state and only re-reading files that have changed by tracking modification timestamps via `FileSystem.getInfoAsync`.

**`listMarkdownFiles` makes individual `getInfoAsync` calls per directory entry:**
- Problem: For each non-dotfile entry in a directory, `listMarkdownFiles` calls `getInfoAsync` to check if it is a directory. For a vault with many files this becomes O(n) separate filesystem calls.
- Files: `lib/vault.ts` (lines 110–126)
- Cause: No batch stat API available in expo-file-system legacy API.
- Improvement path: Migrate to the new `Directory` API which provides `isDirectory` on entries, or limit recursion depth to a known maximum.

**Photo URI lookup recreates the URI string on every render:**
- Problem: `getPhotoUri` is called per calendar cell during render of the photos screen (31+ cells per month). Each call encodes spaces. No memoization is applied at the call site.
- Files: `app/(tabs)/photos.tsx` (line 295), `lib/vault.ts` (lines 158–162)
- Cause: `getPhotoUri` is a method call inside the render loop without caching.
- Improvement path: Pre-compute URIs in a `useMemo` keyed on `photoDates` and `selectedEnfantIdx`.

---

## Fragile Areas

**Line-index-based file mutation strategy:**
- Files: `lib/vault.ts` (`toggleTask`, `appendTask`), `hooks/useVault.ts` (`updateStockQuantity`, `deleteTask`, `removeCourseItem`, `deleteStockItem`)
- Why fragile: All write operations use a `lineIndex` captured at parse time. If the file is modified externally (by Obsidian on the desktop) between a parse and a write, the lineIndex is stale and the wrong line gets modified or deleted. There is no optimistic lock or re-read-before-write.
- Safe modification: Always call `refresh()` before performing edits initiated from long-lived state (e.g., after returning from background). The `busyRef` guard helps only for the `addPhoto` path.
- Test coverage: None.

**`parseGamification` profile ID derivation differs from `parseFamille`:**
- Files: `lib/parser.ts` (lines 539–553 for gamification, lines 472–508 for famille)
- Why fragile: `parseGamification` creates IDs via `currentName.toLowerCase().replace(/\s+/g, '')` (no accent removal), while `parseFamille` uses the `### id` header directly. `mergeProfiles` reconciles with `g.name.toLowerCase().replace(/\s+/g, '') === base.id.toLowerCase()`. If a profile name has accents (e.g., "Léa"), the gamification ID would be `léa` but the famille ID would be `lea` — the merge fails silently, producing default points/level values.
- Safe modification: Add a test case for accented profile names before relying on gamification data for them.
- Test coverage: None.

**Notification template serialization breaks on templates containing `: ` (colon-space):**
- Files: `lib/notifications.ts` (lines 418–432, 458–485)
- Why fragile: Templates are stored in `notifications.md` as `template: <value>`. The parser splits on the first `: ` occurrence via `line.indexOf(': ')`. A custom template containing HTML like `Total : <b>{{profile.points}}</b>` with a literal ` : ` in the value would have the value truncated at the first colon-space on re-parse.
- Safe modification: Do not include literal ` : ` in custom notification templates. Existing defaults happen to be safe.
- Test coverage: None.

**Memory (Jalons) entries inserted at section top regardless of date order:**
- Files: `lib/parser.ts` (`insertJalonInContent`, lines 908–940)
- Why fragile: New memories are inserted immediately after the section header, not sorted by date. If a user adds an older memory after a newer one, the timeline in the `.md` file will be unsorted. The display in `photos.tsx` sorts by date in memory, but the underlying file will be disordered, breaking Obsidian-side chronological reading.
- Safe modification: Insert at the chronologically correct position, or document that file ordering may not match display order.
- Test coverage: None.

---

## Scaling Limits

**Gamification history capped at 100 entries, breaking long-streak calculation:**
- Current capacity: Last 100 gamification history entries are kept (`data.history.slice(-100)` in `serializeGamification`).
- Limit: `calculateStreak` iterates history entries to count consecutive days. The 100-entry cap means streaks beyond approximately 3 months of daily activity may be miscalculated as older entries are pruned.
- Files: `lib/parser.ts` (line 630), `lib/gamification.ts` (lines 369–391)
- Scaling path: Persist the current streak value directly on the profile section in `gamification.md` and only recalculate from history on an explicit reset, rather than deriving it from the rolling log.

**Weekly recap silently ignores photo batch failures beyond the first:**
- Current capacity: `sendWeeklyRecap` batches photos in groups of 10 via `sendTelegramMediaGroup`. The return value of `sendTelegramMediaGroup` for batches 2+ is not checked.
- Limit: If any photo batch beyond the first fails, the caller receives `true` and the error is invisible to the user.
- Files: `lib/telegram.ts` (lines 273–277)
- Scaling path: Collect results from all batch calls and report partial failures to the user in the Alert.

---

## Dependencies at Risk

**`gray-matter` partially broken with manual fallback already in place:**
- Risk: `parseFrontmatter` in `lib/parser.ts` (lines 180–195) explicitly catches errors from `gray-matter` and falls back to a manual parser. This means gray-matter is partially broken in the React Native environment yet still ships in the bundle.
- Impact: Any gray-matter regression or update could silently change which code path handles parsing. Both parsers producing different results for the same input is possible.
- Migration plan: Remove `gray-matter` entirely and use only the manual parser, which is already proven in production. This reduces bundle size and eliminates the dual-path ambiguity.

**`@types/react` pinned to `~18.3.0` while `react` is `19.1.0`:**
- Risk: React 19 ships its own types inside the `react` package. Having a separate `@types/react` at 18.x may conflict or produce incorrect type errors for React 19 APIs.
- Files: `package.json` (devDependencies)
- Impact: TypeScript false positives or missed type errors for React 19-specific patterns.
- Migration plan: Remove `@types/react` from devDependencies (React 19 ships its own types) or update to `@types/react@^19`.

---

## Test Coverage Gaps

**No tests exist in the project:**
- What's not tested: All parsing logic (`lib/parser.ts`), all gamification logic (`lib/gamification.ts`), recurrence calculation (`lib/recurrence.ts`), Telegram message builders (`lib/telegram.ts`), notification template rendering (`lib/notifications.ts`), all vault mutation operations (`hooks/useVault.ts`).
- Files: Entire `lib/` and `hooks/` directories — zero test files outside `node_modules/`.
- Risk: Regressions in any parser, mutation, or gamification function go undetected until they break the UI. The `manualParseFrontmatter` fallback, the `mergeProfiles` accent-handling logic, and the line-index-based write operations are particularly high-risk without tests.
- Priority: High for `lib/parser.ts` (parseTask, parseGamification, mergeProfiles), `lib/recurrence.ts` (nextOccurrence edge cases for far-past dates), and mutation operations in `hooks/useVault.ts` (toggleTask, updateStockQuantity, deleteTask).

---

*Concerns audit: 2026-03-07*
