# Domain Pitfalls

**Domain:** React Native production app — hook refactoring + gamification enrichment
**Project:** FamilyFlow (Expo SDK 54, Obsidian vault, TestFlight)
**Researched:** 2026-03-28

---

## Critical Pitfalls

Mistakes that cause data loss, regressions across the whole app, or rewrites.

---

### Pitfall 1: Big-Bang Hook Split Breaks the Entire App

**What goes wrong:**
Attempting to extract all domain hooks from `useVault` (3431 lines) in one pass.
The monolith has ~90 items in its return `useMemo`. Each domain hook consumes state
that was previously resolved in a single render cycle. Splitting them introduces
inter-hook ordering requirements and reference inequality between previously
co-located values — causing cascading re-renders or stale reads.

**Why it happens:**
The VaultContext currently exposes one large stable object. When split into
`useRecipes` + `useTasks` + `useBudget`, each is its own Provider. A component
that used to read three fields from one context now subscribes to three contexts,
each with independent render cycles. Any cross-domain write (e.g., completing a
task triggers gamification XP) now needs two hooks to agree on the same
`gamification.md` file state — which they won't, because they loaded it at
different times.

**Consequences:**
- Race conditions on cross-domain writes (task XP, farm harvests)
- Stale closures in callbacks that capture hook state at instantiation time
- Silent data duplication or overwrites on rapid user actions
- App-wide regression visible to TestFlight users on first push

**Prevention:**
- Split one domain at a time, starting with the most isolated (budget, then recipes)
- Keep VaultContext as the single composer; domain hooks are internal only
- After each extraction, run `npx tsc --noEmit` + manual TestFlight smoke test before the next extraction
- Never extract two cross-referencing domains simultaneously
- Use functional state updates (passing updater functions) rather than reading then writing

**Warning signs:**
- A domain hook needs to import another domain hook to function
- The extraction requires adding a new top-level Provider to `app/_layout.tsx`
- `useMemo` dependency counts grow after a split instead of shrinking

**Phase mapping:** Hook refactoring phase — each PR should extract exactly one domain.

---

### Pitfall 2: iCloud + Rapid Writes = Silent Corruption

**What goes wrong:**
`gamification.md`, `farm.md`, and task files are read-mutate-write sequences.
iCloud's sync daemon propagates intermediate file states to other devices and can
rename files mid-write during conflict resolution. Combined with the app's
foreground-reload (every app return triggers full vault reload with 1 s debounce),
rapid actions (completing three tasks in 2 seconds) can produce:

1. Write A reads `gamification.md` → adds 10 XP → writes back
2. iCloud sync daemon propagates file before write A finishes
3. Write B reads the pre-write-A state → adds 10 XP → overwrites A
4. Net result: 10 XP added, not 20

**Why it happens:**
The existing `busyRef` guard only blocks `loadVaultData`, not individual CRUD
writes. Each write operation re-reads the file independently, but without file
locking, a concurrent write can win the race. iCloud Drive is not a POSIX
filesystem — `write()` is not atomic and the sync daemon can intervene.

**Consequences:**
- Lost XP, missing farm harvests, duplicated loot box rewards
- Corruption happens silently — no error surface, no crash
- Users lose trust in the gamification system ("my points disappeared")

**Prevention:**
- Implement a per-file write queue (serialize all writes to the same file path)
- Use a simple async mutex per file path (a `Map<string, Promise>` of pending writes)
- Always read the file inside the write callback, not before calling it
- Test with rapid multi-tap completion: 5 tasks in < 1 second

**Warning signs:**
- Any new feature that writes to a shared file (gamification, farm) from multiple
  user interaction paths
- Adding "award XP on event" logic to more than one place in the codebase
- XP totals that are occasionally wrong after heavy use sessions

**Phase mapping:** Before any gamification enrichment — the concurrency issue must
be resolved or new features will amplify it.

---

### Pitfall 3: Markdown Frontmatter Format Drift Corrupts the Vault

**What goes wrong:**
`lib/parser.ts` (2398 lines) relies on exact regex patterns and emoji markers for
20+ vault file formats. Any new field added to a domain object (e.g., adding
`animalHappiness` to farm animals) that is serialized back via an updated parser
can silently corrupt existing Obsidian-readable files if:
- A new regex partially overlaps with an existing one
- A new field is serialized in a position that Obsidian's reader also parses
- The frontmatter key order changes (some tools are order-sensitive)

**Why it happens:**
Parser and serializer live in the same 2398-line file. Tests cover parsing but not
the full roundtrip (load → parse → mutate → serialize → re-parse). The parser is
also the Obsidian compatibility contract: if a user opens their vault in Obsidian
after a bad write, they see corrupted notes.

**Consequences:**
- Vault files unreadable by Obsidian (breaks the "source of truth" contract)
- Data visible in app but invisible to the user's backup/sync tool
- Potential data loss if re-parse of corrupted file drops records

**Prevention:**
- Every new parser must have a roundtrip test: `parse(serialize(original)) === original`
- Add regression fixtures: take a real vault file, commit it as a test fixture,
  assert the parser output is byte-stable after a roundtrip
- When splitting `lib/parser.ts` into `lib/parsers/`, keep a barrel `index.ts` so
  no import paths change in `useVault`
- Run the full parser test suite (`parser.test.ts` + `parser-extended.test.ts`)
  before every TestFlight push

**Warning signs:**
- A new field needs to be stored "somewhere" in an existing markdown file
- A regex change passes unit tests but the test fixture file was not updated
- Any serialization function that builds a string with template literals instead
  of using the existing `serialize*` pattern

**Phase mapping:** Parser split phase and any gamification-data schema extension.

---

## Moderate Pitfalls

---

### Pitfall 4: Context Re-Render Avalanche After Domain Hook Split

**What goes wrong:**
When VaultContext is split into sub-contexts (e.g., `TasksContext`, `BudgetContext`),
components that previously subscribed to one large context now trigger re-renders
from multiple contexts. A component reading tasks + budget data re-renders when
either context changes — which is more frequent than before because updates are
now granular and frequent.

**Why it happens:**
React Context triggers every consumer on every value change, regardless of which
field changed. A 90-field context object that changes infrequently is often more
performant than 10 small contexts that each change independently. This is the
opposite of the expected intuition.

**Prevention:**
- After each domain hook extraction, use React DevTools Profiler to measure
  render counts on the main screens (dashboard, tasks, calendar)
- Keep the existing VaultContext shape stable externally; use domain hooks as
  internal implementation only
- Memoize selector results in consuming components with `useMemo` where needed
- Do NOT add new Providers to the layout hierarchy without benchmarking

**Warning signs:**
- Dashboard feels slower after a hook extraction
- React DevTools shows a component rendering more than once per user action
- Profiler shows 3+ components rendering when only one changed

**Phase mapping:** Hook refactoring phase — measure before and after each extraction.

---

### Pitfall 5: Jest/Expo Mocking Gaps Produce False-Green Tests

**What goes wrong:**
New tests for vault hooks or gamification logic pass locally but cover the wrong
code path because native modules are silently auto-mocked. Key offenders:
`expo-secure-store`, `expo-file-system`, `expo-haptics`. The auto-mock returns
`undefined` or empty strings where the real module returns structured data —
making tests pass without actually testing the real behavior.

**Why it happens:**
`jest-expo` provides auto-generated mocks, but they do not replicate return value
shapes. A test that asserts `saveFile()` was called cannot verify the content
written if `expo-file-system.writeAsStringAsync` is mocked to return `undefined`
silently.

**Consequences:**
- Tests pass in CI but bugs ship to TestFlight
- Parser roundtrip tests that mock filesystem ops test nothing useful
- Gamification tests that mock the engine return pass even with broken engine code

**Prevention:**
- Mock at the filesystem boundary only; let parser and engine logic run as real code
- For `expo-file-system`, use an in-memory mock that records writes and can replay
  them as reads — a minimal virtual filesystem for tests
- Validate mock shapes match actual module return types using TypeScript
- Never mock `lib/parser.ts` or `lib/gamification/engine.ts` — those must run real

**Warning signs:**
- A test passes after commenting out the function under test
- Test coverage shows a branch as covered but no assertion checks its output
- `jest-expo` upgrade causes previously passing tests to fail (mock shape changed)

**Phase mapping:** Test suite build phase — establish mock strategy before writing
any hook tests.

---

### Pitfall 6: TestFlight Push With Schema-Breaking Changes

**What goes wrong:**
A TestFlight push that changes how a vault file is serialized will be loaded by
family members who have the old file format. If the new code expects a field that
doesn't exist in the old format, it will silently default to `undefined` or `0`,
corrupting derived state (e.g., XP history, farm crop timers).

**Why it happens:**
There is no migration versioning on vault files. The app just reads whatever is
on disk. Old clients write old format; new clients read and re-serialize with new
format. If a family member opens the app, triggers a write with the new client,
then reverts to an old build, the old client now reads new-format data it doesn't
understand.

**Consequences:**
- Farm crops "disappear" if their timer field changes format
- Gamification level resets if the XP field name changes
- Calendar events duplicated if RDV parsing regex no longer matches old entries

**Prevention:**
- Treat every vault file format field as append-only — never rename or remove fields
- New fields must have a default value that produces correct behavior on first read
- Write a "migration guard": read the file first, detect the version (or absence
  of the new field), and only write the new field if it's missing
- Test the migration path explicitly: create an old-format fixture, run the new
  reader against it, assert the output is correct
- Never push a TestFlight build that changes a serialization format without a
  corresponding read-with-default migration

**Warning signs:**
- A field in a data object is renamed "for clarity" in a PR
- A new required field is added to an interface without a default in the parser
- The farm or gamification schema changes and existing vault files have not been
  migrated in a one-time migration script

**Phase mapping:** Any gamification enrichment phase that adds new data fields.

---

### Pitfall 7: Gamification Reward Inflation and XP Devaluation

**What goes wrong:**
Adding more XP sources (new farm events, saga completions, item crafting) without
recalibrating the XP curve causes early levels to become trivially achievable.
Users level up in the first week of using new features, then the system feels
meaningless. Conversely, adding content that gives large lump-sum XP rewards makes
existing grind-based progression feel pointless.

**Why it happens:**
Each feature team (farm, sagas, boutique) independently adds XP rewards that seem
reasonable in isolation. The cumulative effect is tested only by manual play, which
misses the long-term inflation trajectory.

**Consequences:**
- Level 10 reached in one day instead of one month
- Users stop caring about XP because it no longer signals progress
- Existing TestFlight users who have high levels feel their progress was devalued

**Prevention:**
- Maintain a single `constants/rewards.ts` as the canonical XP budget table
- Any new XP source must go through `rewards.ts` — no hardcoded XP values elsewhere
- Before adding new XP sources, compute the expected XP/day for an average active
  family and compare against the level curve
- Add a test: given a simulated "average active day" (N tasks, M farm harvests),
  assert that daily XP falls within a defined band

**Warning signs:**
- XP rewards are defined inline in a component or engine rather than imported from
  `constants/rewards.ts`
- A new feature PR adds both new gameplay and new XP rewards without updating the
  level curve analysis
- QA playtesting reaches level 5 in under 2 hours

**Phase mapping:** Gamification enrichment phase — establish XP budget model before
adding any new reward sources.

---

### Pitfall 8: Streak Mechanics Create Anxiety for Family Users

**What goes wrong:**
Daily streaks designed to reward consistency become punishing when applied to a
family context. A family member misses one day (sick child, travel) and loses a
30-day streak. The emotional response is guilt or abandonment of the app entirely —
the opposite of the intended motivation.

**Why it happens:**
Streak design from consumer habit apps (Duolingo, fitness trackers) is copied
without adaptation. These apps target individual users with daily commitment intent.
A family app is used situationally — it's a tool, not a daily ritual for everyone.

**Consequences:**
- Family members disengage after breaking a streak
- Children experience anxiety about "failing" the family
- Adults resent the app for creating obligation instead of reducing it

**Prevention:**
- Use week-based or month-based streaks instead of daily ones
- Provide "streak shields" or grace periods (already partially present in saga system)
- Frame progress as "family momentum" not "personal streak" — a collective metric
  is more forgiving
- Never show a streak loss as a red/negative indicator — frame as "start a new run"

**Warning signs:**
- Any streak UI shows a flame or counter that resets to 0 on miss
- A notification fires to "save your streak" (manipulative engagement pattern)
- Children are observed checking the app anxiously before bed

**Phase mapping:** Gamification enrichment phase — apply to any new streak or
daily challenge mechanic.

---

## Minor Pitfalls

---

### Pitfall 9: Hardcoded Colors in SVG/Canvas Components Survive Cleanup

**What goes wrong:**
The 228 hardcoded hex colors (CONCERNS.md) are concentrated in SVG-heavy
components (`TreeView.tsx`: 47, `LootBoxOpener.tsx`: 100, `PixelDiorama.tsx`).
A bulk find-and-replace for `#` hex values will incorrectly replace legitimate
fixed art colors (pixel art palette, chart reference bands) that should not be
theme-aware.

**Prevention:**
- Separate structural colors (backgrounds, borders, text) from art palette colors
  (pixel tree sprites, loot box animation colors)
- Only replace colors that respond to dark/light mode switching
- Comment intentional art-palette colors with `// pixel art — intentional`

**Warning signs:**
- A theme change turns pixel art sprites gray or washes them out
- `LootBoxOpener.tsx` colors are replaced and the animation looks broken in dark mode

**Phase mapping:** Color token cleanup phase.

---

### Pitfall 10: expo-document-picker Patch Breaks on Dependency Upgrade

**What goes wrong:**
`patches/expo-document-picker+14.0.8.patch` exists but is version-pinned.
Any `npx expo upgrade` or manual `expo-document-picker` bump will silently
invalidate the patch, breaking vault folder selection on both platforms with
no build-time error — only a runtime failure when users try to change their vault.

**Prevention:**
- Before any Expo upgrade, check if the patch fix was upstreamed
- Pin `expo-document-picker` in `package.json` with an exact version (`=14.0.8`)
  until the patch is confirmed unnecessary
- Add a post-install CI check that verifies the patch applied cleanly

**Warning signs:**
- `npx patch-package` output shows "patch failed to apply" during install
- Vault picker silently does nothing when tapped

**Phase mapping:** Any dependency upgrade phase; also relevant pre-TestFlight push.

---

### Pitfall 11: Custom SHA-256 PIN Hash Has a Fixed Salt

**What goes wrong:**
`contexts/AuthContext.tsx` uses a custom SHA-256 implementation with a fixed salt
(`family-vault-pin:`). Two family members with the same PIN get the same hash.
If a hash is ever logged or accidentally exposed, all same-PIN users are affected.

**Prevention:**
- Replace with `expo-crypto`'s `digestStringAsync` using a per-device random salt
  stored alongside the hash in `expo-secure-store`
- This is a low-urgency fix (family-only app, never transmitted) but should be
  done before any scope expansion

**Warning signs:**
- The app acquires new user distribution beyond the immediate family
- Any code path logs or transmits the PIN hash

**Phase mapping:** Security hardening phase or pre-App Store distribution.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| useVault hook split | Stale closures, cross-domain race conditions | Extract one domain at a time; VaultContext stays as composer |
| Parser splitting | Regex collision, roundtrip corruption | Barrel re-export; roundtrip test per new parser file |
| Test suite setup | Auto-mock false positives | In-memory filesystem mock; never mock parser or engine |
| Color token cleanup | Breaking pixel-art SVG colors | Classify each color before replacing |
| Gamification enrichment (new XP sources) | Reward inflation | Enforce XP budget through `constants/rewards.ts` |
| Gamification enrichment (new streaks/challenges) | Family anxiety, disengagement | Week-based streaks; grace periods; collective framing |
| New vault schema fields | TestFlight migration corruption | Append-only fields; default values; migration guard |
| iCloud concurrent writes | Silent data loss | Per-file async write queue before adding new write paths |
| expo-document-picker upgrade | Vault picker breaks | Pin version; verify patch before any Expo bump |

---

## Sources

- [Hooks, Dependencies and Stale Closures — TkDodo](https://tkdodo.eu/blog/hooks-dependencies-and-stale-closures) — MEDIUM confidence (well-regarded author, pre-2026)
- [Race Conditions in React Native — DEV Community](https://dev.to/paulocappa/race-conditions-in-react-native-5bjb) — MEDIUM confidence
- [Race Conditions in React Native (2026) — Medium](https://medium.com/@pelumiogundipe905/race-conditions-in-react-native-the-silent-bug-in-your-mobile-app-0c9e1049e6df) — MEDIUM confidence
- [Context API Performance Pitfalls — Steve Kinney](https://stevekinney.com/courses/react-performance/context-api-performance-pitfalls) — MEDIUM confidence
- [Why iCloud Fails: OAE Transactional Semantics — arXiv 2602.19433](https://arxiv.org/html/2602.19433) — HIGH confidence (peer-reviewed)
- [Gamification Anti-Patterns: Dark Patterns in Mobile Games — arXiv 2412.05039](https://arxiv.org/html/2412.05039v1) — HIGH confidence (peer-reviewed, 2024)
- [Productivity App Gamification That Doesn't Backfire — Trophy](https://trophy.so/blog/productivity-app-gamification-doesnt-backfire) — LOW confidence (vendor blog, directionally correct)
- [Mocking Native Calls in Expo Modules — Expo Docs](https://docs.expo.dev/modules/mocking/) — HIGH confidence (official)
- [jest-expo not mocking all native modules — GitHub Issue #26893](https://github.com/expo/expo/issues/26893) — HIGH confidence (official repo)
- [Promoting Health via Gamification (Children) — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10886329/) — HIGH confidence (peer-reviewed)
- Project-internal: `.planning/codebase/CONCERNS.md` — HIGH confidence (direct codebase audit)
