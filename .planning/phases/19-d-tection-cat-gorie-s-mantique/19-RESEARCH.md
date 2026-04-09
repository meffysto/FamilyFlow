# Phase 19: Détection catégorie sémantique - Research

**Researched:** 2026-04-09
**Domain:** Pure TypeScript module — semantic category detection from Obsidian task metadata
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: 10 catégories dans `lib/semantic/categories.ts`, type `readonly SemanticCategory[]`. Forme: `{ id: CategoryId, labelFr, labelEn, filepathPatterns: string[], sectionPatterns: string[], tagPatterns: string[] }`. Pas de JSON externe, pas de dépendance ajoutée.
- **D-02**: Priorité des signaux figée: **tag > section > filepath**. Premier match retourné, pas de scoring.
- **D-03a**: `normalize(str)` = lowercase + strip accents (NFD + `/[\u0300-\u036f]/g`) + trim.
- **D-03b**: Filepath: extraire premier segment, strip `/^\d+\s*-\s*/`, normalize, comparaison `===`.
- **D-03c**: Section: normalize `task.section`, vérifier `includes(pattern)` pour chaque `sectionPatterns[]`.
- **D-03d**: Tag: normalize chaque `task.tags[]`, comparaison `===` stricte.
- **D-04a**: `deriveTaskCategory(task: Task): CategoryMatch | null` — 100% pure, pas d'async, pas d'I/O.
- **D-04b**: `type CategoryMatch = { id: CategoryId; matchedBy: 'tag' | 'section' | 'filepath'; evidence: string }` — evidence = valeur brute non normalisée.
- **D-04c**: Retour `null` = aucun signal. Phase 20 traite null comme "standard XP, zéro effet".
- **D-05a**: Flag SecureStore key `semantic-coupling-enabled`, string `"true"`/`"false"`, default false.
- **D-05b**: Flag family-wide (pas par-profil).
- **D-05c**: Helpers dans `lib/semantic/flag.ts`: `isSemanticCouplingEnabled(): Promise<boolean>`, `setSemanticCouplingEnabled(enabled: boolean): Promise<void>`.
- **D-05d**: Flag vérifié par l'appelant (Phase 20), PAS dans `deriveTaskCategory`.
- **D-07**: Arborescence `lib/semantic/categories.ts | derive.ts | flag.ts | index.ts | __tests__/derive.test.ts | __tests__/flag.test.ts`.
- **D-08**: 10 `CategoryId` canoniques: `menage_quotidien`, `menage_hebdo`, `courses`, `enfants_routines`, `enfants_devoirs`, `rendez_vous`, `gratitude_famille`, `budget_admin`, `bebe_soins`, `cuisine_repas`.
- **ARCH-04**: Zéro nouvelle dépendance npm.

### Claude's Discretion

- Choix exact des `filepathPatterns / sectionPatterns / tagPatterns` — le planner décide en lisant la structure réelle du vault.
- Exhaustivité des cas de test — minimum: happy path par catégorie × 3 signaux, test de priorité, test fallback, test flag off.
- Nom exact du type exporté (`CategoryMatch` — ajustable si conflit).
- Format stockage SecureStore (string simple `"true"` vs JSON).

### Deferred Ideas (OUT OF SCOPE)

- Catégories dynamiques / custom user
- Catégorie dérivée du frontmatter
- Score de confiance sur le match
- Mapping localisé par langue de vault
- Telemetry / metrics des matches

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEMANTIC-01 | User sees a category correctly detected from task filepath | D-03b + filepath taxonomy verified in vault.ts (00-07 dirs) |
| SEMANTIC-02 | User sees a category detected from H2/H3 section | D-03c + section names verified in vault.ts templates (Quotidien/Hebdomadaire/Mensuel/Ménage) |
| SEMANTIC-03 | User sees a category detected from task tags | D-03d + TAG_REGEX confirmed in parser.ts (extracts #tag without `#`) |
| SEMANTIC-04 | User's task with no matching category falls back to standard XP | D-04c null return; `awardTaskCompletion()` signature unchanged |
| SEMANTIC-05 | User can toggle the semantic coupling feature via feature flag | D-05 SecureStore helpers; expo-secure-store mock already in place |
| ARCH-01 | User's task files are never written to | `deriveTaskCategory` is pure read-only; no vault.ts imports |
| ARCH-02 | Feature flag allows instant disable of all semantic coupling | `isSemanticCouplingEnabled()` async + Phase 20 checks each call |
| ARCH-03 | Zero regression when category is unknown | null return preserves existing `awardTaskCompletion()` path |
| ARCH-04 | Zero new npm dependencies | All tools (SecureStore, ts-jest, jest) already installed |

</phase_requirements>

---

## Summary

Phase 19 delivers a pure TypeScript module at `lib/semantic/` that accepts an already-parsed `Task` object and returns which of 10 canonical categories it belongs to, or null. The module has no side effects, no I/O except the SecureStore flag helpers (isolated in flag.ts), and introduces no new dependencies.

The key discovery from codebase analysis: the test infrastructure is **already fully operational** — Jest 29 + ts-jest + expo-secure-store mock are all installed and the mock is wired into `jest.config.js`. No Wave 0 setup is required beyond creating the new test files. The `npm test` command runs all `lib/__tests__/**/*.test.ts` files and passes today.

The `Task` type in `lib/types.ts` already exposes exactly the three signals needed: `task.sourceFile` (vault-relative path), `task.section` (H2/H3 header text, may be undefined), and `task.tags[]` (strings without the `#` prefix, already extracted by `parseTask()`). No changes to parser.ts or types.ts are needed.

**Primary recommendation:** Plan 19-01 creates `lib/semantic/` with categories.ts + derive.ts + flag.ts + index.ts barrel. Plan 19-02 creates `__tests__/derive.test.ts` + `__tests__/flag.test.ts`. No other plans needed.

---

## Standard Stack

### Core (all already installed — ARCH-04 verified)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| TypeScript | 5.x (tsconfig.jest.json) | Module language | Already in project |
| expo-secure-store | (installed) | Flag persistence in flag.ts | Already mocked in `lib/__tests__/__mocks__/expo-secure-store.ts` |
| jest | 29.7.0 | Test runner | Already configured via jest.config.js |
| ts-jest | 29.4.6 | TypeScript transform for Jest | Already configured |

**No npm install needed.** Every dependency for Phase 19 exists.

### Test Run Commands (verified working)

```bash
npm test                                    # Full suite
npx jest lib/__tests__/derive.test.ts       # New derive tests only
npx jest lib/__tests__/flag.test.ts         # New flag tests only
npx jest --coverage                         # Coverage report
npx tsc --noEmit                            # Type check
```

---

## Architecture Patterns

### Recommended Module Structure

```
lib/semantic/
├── categories.ts         # 10 SemanticCategory entries + CategoryId type
├── derive.ts             # deriveTaskCategory() + normalize() + private matchers
├── flag.ts               # isSemanticCouplingEnabled() + setSemanticCouplingEnabled()
├── index.ts              # Barrel: export { deriveTaskCategory, isSemanticCouplingEnabled, setSemanticCouplingEnabled, CategoryMatch, CategoryId }
└── __tests__/
    ├── derive.test.ts    # Tests filepath/section/tag/priority/fallback
    └── flag.test.ts      # Tests SecureStore mock: default off, set true, set false
```

Note: `__tests__` lives inside `lib/semantic/` but jest.config.js roots includes `<rootDir>/lib` so all `**/__tests__/**/*.test.ts` will be discovered automatically. **No jest.config.js changes needed.**

### Pattern 1: Pure Function Module (existing pattern in lib/)

```typescript
// Source: lib/gamification/engine.ts — confirmed pure function pattern
export function deriveTaskCategory(task: Task): CategoryMatch | null {
  // 1. Try tags first (highest priority)
  for (const category of CATEGORIES) {
    for (const tag of task.tags) {
      const normalized = normalize(tag);
      if (category.tagPatterns.includes(normalized)) {
        return { id: category.id, matchedBy: 'tag', evidence: tag };
      }
    }
  }
  // 2. Try section
  if (task.section) {
    const normalizedSection = normalize(task.section);
    for (const category of CATEGORIES) {
      for (const pattern of category.sectionPatterns) {
        if (normalizedSection.includes(pattern)) {
          return { id: category.id, matchedBy: 'section', evidence: task.section };
        }
      }
    }
  }
  // 3. Try filepath
  // extract first path segment, strip "NN - " prefix, normalize
  const segment = task.sourceFile.split('/')[0];
  const stripped = segment.replace(/^\d+\s*-\s*/, '');
  const normalizedPath = normalize(stripped);
  for (const category of CATEGORIES) {
    if (category.filepathPatterns.includes(normalizedPath)) {
      return { id: category.id, matchedBy: 'filepath', evidence: segment };
    }
  }
  return null;
}
```

### Pattern 2: SecureStore Flag Helper (existing pattern in contexts/)

```typescript
// Source: contexts/ThemeContext.tsx + contexts/ParentalControlsContext.tsx
import * as SecureStore from 'expo-secure-store';

const FLAG_KEY = 'semantic-coupling-enabled';

export async function isSemanticCouplingEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(FLAG_KEY);
  return val === 'true'; // absent or 'false' = false (default off)
}

export async function setSemanticCouplingEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(FLAG_KEY, enabled ? 'true' : 'false');
}
```

### Pattern 3: Test File with SecureStore mock (existing pattern)

```typescript
// Source: jest.config.js moduleNameMapper + lib/__tests__/__mocks__/expo-secure-store.ts
// The mock is an in-memory store that resets nothing between tests.
// Tests MUST clear state manually with beforeEach or use deleteItemAsync.
import { isSemanticCouplingEnabled, setSemanticCouplingEnabled } from '../semantic/flag';
import * as SecureStore from 'expo-secure-store';

beforeEach(async () => {
  await SecureStore.deleteItemAsync('semantic-coupling-enabled');
});

describe('isSemanticCouplingEnabled', () => {
  it('retourne false par défaut (clé absente)', async () => {
    expect(await isSemanticCouplingEnabled()).toBe(false);
  });
  it('retourne true après setSemanticCouplingEnabled(true)', async () => {
    await setSemanticCouplingEnabled(true);
    expect(await isSemanticCouplingEnabled()).toBe(true);
  });
});
```

**Warning:** The existing `expo-secure-store` mock does NOT auto-reset between tests. `beforeEach` must call `SecureStore.deleteItemAsync(FLAG_KEY)` to isolate tests.

### Anti-Patterns to Avoid

- **Calling `deriveTaskCategory` async**: The function is sync-only. Any I/O belongs in flag.ts, not derive.ts.
- **Exporting `normalize()`** from barrel: It's an implementation detail — keep it unexported.
- **Importing vault.ts or any file I/O** in categories.ts or derive.ts: ARCH-01 violation.
- **Mutating the CATEGORIES array**: It must be `readonly` to prevent accidental runtime modification.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accent stripping | Custom Unicode table | NFD normalization + `/[\u0300-\u036f]/g` | Standard pattern already used in the project (D-03a) |
| SecureStore mock | Custom mock | `lib/__tests__/__mocks__/expo-secure-store.ts` | Already wired in jest.config.js moduleNameMapper |
| Test runner setup | New vitest/node:test config | `npm test` (Jest already configured) | Zero setup cost |
| Fuzzy text matching | Levenshtein / regex engine | `String.includes()` on normalized strings | Sufficient for known-finite pattern set, ARCH-04 |

---

## Vault Filepath Taxonomy (VERIFIED from vault.ts and hooks/)

This is the real directory structure created by `VaultManager.initVault()`:

| Directory prefix | Normalized (after strip `NN - `) | Maps to CategoryId |
|-----------------|----------------------------------|--------------------|
| `00 - Dashboard` | `dashboard` | (no task category) |
| `01 - Enfants` | `enfants` | `enfants_routines` or `enfants_devoirs` or `bebe_soins` (overlap — tag/section must disambiguate) |
| `02 - Maison` | `maison` | `menage_quotidien` or `menage_hebdo` or `courses` (overlap — section must disambiguate) |
| `03 - Cuisine` | `cuisine` | `cuisine_repas` |
| `03 - Journal` | `journal` | (no task category — diary entries) |
| `04 - Rendez-vous` | `rendez-vous` | `rendez_vous` |
| `05 - Budget` | `budget` | `budget_admin` |
| `06 - Mémoires` | `memoires` | `gratitude_famille` (via Gratitude subfolder) |
| `07 - Photos` | `photos` | (no task category) |

**Critical insight:** Several directories (`01 - Enfants`, `02 - Maison`) map to multiple categories. The **section** signal provides the disambiguation:

- `02 - Maison` + section `Quotidien` → `menage_quotidien`
- `02 - Maison` + section `Hebdomadaire`/`Ménage` → `menage_hebdo`
- `02 - Maison` (file `Liste de courses.md`) → `courses`
- `01 - Enfants` + section `Quotidien`/`Hebdomadaire` → `enfants_routines`
- `01 - Enfants` + section `Mensuel` or text "devoirs" → `enfants_devoirs`
- `01 - Enfants` (ageCategory=bebe) → `bebe_soins`

**Recommended approach:** filepathPatterns should use the most specific normalised string possible. For `02 - Maison/Liste de courses.md`, the first segment is still `02 - Maison` → normalized `maison`. The planner should choose whether `courses` category uses the **filename** approach (second segment = `liste de courses`) or relies on **tags** (`#courses`). Based on the vault template, courses items are checkboxes in `Liste de courses.md` under section headers like "Frais", "Fruits & légumes" — these do NOT have section-based task patterns. The `#courses` tag or filepath `maison` (with file pattern) is safer.

**Practical recommendation for the planner:** 
- `maison` filepath → `menage_hebdo` (broad fallback for 02 - Maison tasks)  
- `cuisine` filepath → `cuisine_repas`
- `rendez-vous` filepath → `rendez_vous`
- `budget` filepath → `budget_admin`
- Tags are the primary disambiguation tool for `enfants_routines` vs `enfants_devoirs` vs `bebe_soins`

---

## Real Section Names (VERIFIED from vault.ts templates)

From `_maisonTasksContent()` (02 - Maison/Tâches récurrentes.md):
- `## Tous les 3 jours`
- `## Hebdomadaire`
- `## Mensuel`
- `## Ménage` (containing weekly cleaning tasks — mapped to `menage_hebdo`)

From `_childTasksContent()` (01 - Enfants/{name}/Tâches récurrentes.md):
- `## Quotidien` → child daily routines → `enfants_routines`
- `## Hebdomadaire` → child weekly tasks → `enfants_routines`
- `## Mensuel` → monthly checks → could be either

From `useVaultTasks.ts` (addTask/editTask auto-section logic):
- `'Quotidien'` for `every day`
- `'Hebdomadaire'` for `every week` (non-Maison files)
- `'Mensuel'` for `every month`
- `'Ménage'` for `every week` in Maison file

**The planner should define sectionPatterns as normalized sub-strings:**
- `menage_quotidien` → sectionPatterns: `["quotidien"]` (when in maison context — but section alone is ambiguous cross-file)
- `menage_hebdo` → sectionPatterns: `["menage"]` (catches both "Ménage" and "Ménage hebdomadaire")
- `enfants_routines` → sectionPatterns: `["quotidien", "hebdomadaire"]`
- `enfants_devoirs` → sectionPatterns: `["devoirs", "scolaire"]`
- `bebe_soins` → sectionPatterns: `["bebe", "soins", "biberons", "couches"]`

---

## Tag Extraction — Verified Behavior

From `lib/parser.ts` line 69 and 99-101:
```typescript
const TAG_REGEX = /#([a-zA-ZÀ-ÿ0-9_-]+)/g;
// tags[] contains the matched group WITHOUT the '#' prefix
// Example: "- [ ] Tâche #urgent #budget" → tags: ['urgent', 'budget']
```

**Consequence for tagPatterns in categories.ts:** patterns must NOT include the `#` prefix. The stored values are already stripped. `normalize('urgent')` === `'urgent'`.

Tags in the vault are inline body text, not frontmatter arrays. The parser extracts them from the raw task line via regex.

---

## `awardTaskCompletion()` Integration Point (Phase 20 future hook)

Current signature (lib/gamification/engine.ts lines 105-128):
```typescript
export function awardTaskCompletion(
  profile: Profile,
  taskNote: string
): { profile: Profile; entry: GamificationEntry; lootAwarded: boolean }
```

Phase 19 does NOT touch this function. Phase 20 will inject a `deriveTaskCategory` call BEFORE `awardTaskCompletion()` in `useVaultTasks.ts:toggleTask`. Phase 19 only needs to ensure its exports are importable.

The `toggleTask` handler in `hooks/useVaultTasks.ts` is where Phase 20 will wire the call. This is important context: the `Task` object is available in scope there, making `deriveTaskCategory(task)` trivially callable.

---

## Common Pitfalls

### Pitfall 1: SecureStore mock state bleed between tests
**What goes wrong:** The in-memory mock store in `lib/__tests__/__mocks__/expo-secure-store.ts` is a module-level `Record<string, string>`. It persists across `it()` blocks within a test run.
**Why it happens:** Jest does not reset module state between tests unless you call `jest.resetModules()` or manually clean.
**How to avoid:** Add `beforeEach(async () => { await SecureStore.deleteItemAsync('semantic-coupling-enabled'); })` in `flag.test.ts`.
**Warning signs:** `flag.test.ts` passes individually but fails when run in combination with other tests.

### Pitfall 2: Filepath segment mismatch for nested paths
**What goes wrong:** Task from `02 - Maison/Tâches récurrentes.md` has `sourceFile = '02 - Maison/Tâches récurrentes.md'`. Splitting on `/` gives `['02 - Maison', 'Tâches récurrentes.md']`. The first segment `02 - Maison` after strip becomes `maison`. But a task from `01 - Enfants/Lucas/Tâches récurrentes.md` splits to `['01 - Enfants', 'Lucas', 'Tâches récurrentes.md']` — first segment `01 - Enfants` → `enfants`. This is correct.
**Risk:** If someone creates a task at the vault root (no subfolder), `sourceFile.split('/')[0]` returns the filename itself — no category match, falls back to null. Acceptable behavior.

### Pitfall 3: Section ambiguity across files
**What goes wrong:** `section = 'Quotidien'` exists in both `01 - Enfants/.../Tâches récurrentes.md` and `02 - Maison/Tâches récurrentes.md`. Pattern `"quotidien"` would match both.
**Why it happens:** Section matching is file-agnostic by design (D-03c only checks `task.section`, not `task.sourceFile`).
**How to avoid:** The tag signal dominates. If the user tags their task explicitly, that wins. For untagged tasks, the filepath+section combined in lookup order means that **whatever comes first in CATEGORIES array gets matched first**. The planner must order CATEGORIES carefully or add a fallback rule.
**Recommendation:** For `menage_quotidien`, do NOT rely solely on `sectionPatterns: ["quotidien"]` — add `filepathPatterns: ["maison"]` so the filepath signal provides needed context. Since tag > section > filepath, a task with section "Quotidien" and filepath "01 - Enfants/..." that has no tags would match the FIRST category whose section pattern matches. Document the expected priority in categories.ts.

### Pitfall 4: normalize() NFD accent stripping on uppercase
**What goes wrong:** `"Ménage"` → NFD → `"Me\u0301nage"` → strip combining chars → `"Menage"` → lowercase → `"menage"`. But `"MÉNAGE"` → same result. The normalize helper is case+accent insensitive. Verify: `"Ménage hebdomadaire"` → `"menage hebdomadaire"` — `.includes("menage")` returns true.
**How to avoid:** Test normalize() explicitly in derive.test.ts with accented inputs.

### Pitfall 5: Test file location and jest.config.js roots
**What goes wrong:** If tests are placed at `lib/semantic/__tests__/` rather than `lib/__tests__/`, the `roots: ['<rootDir>/lib']` config covers them (lib is the root, subdirectory is included). But the `moduleNameMapper` for `expo-secure-store` must resolve from the test file's location.
**How to avoid:** Verify mock path resolution. The mock at `<rootDir>/lib/__tests__/__mocks__/expo-secure-store.ts` is registered as an absolute path mapping, so it works regardless of where the test file is located.
**Alternative (safer):** Place `flag.test.ts` in `lib/__tests__/flag.test.ts` instead of `lib/semantic/__tests__/` — matches the established project pattern of centralizing all tests in `lib/__tests__/`.

---

## Code Examples

### Task object shape (verified from lib/types.ts)
```typescript
// Source: lib/types.ts lines 8-24
interface Task {
  id: string;              // "{sourceFile}:{lineIndex}"
  text: string;            // stripped of emoji modifiers
  completed: boolean;
  tags: string[];          // extracted by TAG_REGEX, NO '#' prefix
  mentions: string[];
  sourceFile: string;      // vault-relative: "02 - Maison/Tâches récurrentes.md"
  lineIndex: number;
  section?: string;        // H2/H3 header text (with emoji if any)
  // ... other optional fields
}
```

### normalize() implementation
```typescript
// Source: D-03a from CONTEXT.md — standard Unicode NFD approach
function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
```

### CategoryId type
```typescript
// Source: D-08 from CONTEXT.md
export type CategoryId =
  | 'menage_quotidien'
  | 'menage_hebdo'
  | 'courses'
  | 'enfants_routines'
  | 'enfants_devoirs'
  | 'rendez_vous'
  | 'gratitude_famille'
  | 'budget_admin'
  | 'bebe_soins'
  | 'cuisine_repas';
```

### Barrel index.ts
```typescript
// Source: lib/gamification/index.ts pattern
export { deriveTaskCategory } from './derive';
export type { CategoryMatch, CategoryId, SemanticCategory } from './categories';
export { isSemanticCouplingEnabled, setSemanticCouplingEnabled } from './flag';
// Note: normalize() is NOT exported — internal detail
```

---

## Environment Availability

Step 2.6: All dependencies are already present. No external tools required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| jest | derive.test.ts, flag.test.ts | YES | 29.7.0 | — |
| ts-jest | TypeScript test transform | YES | 29.4.6 | — |
| expo-secure-store | flag.ts + mock | YES | installed | — |
| expo-secure-store mock | flag.test.ts | YES | lib/__tests__/__mocks__/expo-secure-store.ts | — |

**No missing dependencies.**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.4.6 |
| Config file | `jest.config.js` (no changes needed) |
| Quick run command | `npx jest lib/__tests__/derive.test.ts lib/__tests__/flag.test.ts` |
| Full suite command | `npm test` |

Note: The CONTEXT.md suggests placing tests at `lib/semantic/__tests__/derive.test.ts`. Both locations work with the current jest.config.js. The project convention (from `.planning/codebase/TESTING.md`) uses `lib/__tests__/`. The planner should pick one location and be consistent — the centralized `lib/__tests__/` location is recommended for consistency.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEMANTIC-01 | filepath detection (e.g. `02 - Maison/...` → `menage_hebdo`) | unit | `npx jest --testPathPattern=derive` | NO — Wave 0 |
| SEMANTIC-02 | section detection (e.g. `section: 'Ménage'` → `menage_hebdo`) | unit | `npx jest --testPathPattern=derive` | NO — Wave 0 |
| SEMANTIC-03 | tag detection (`tags: ['budget']` → `budget_admin`) | unit | `npx jest --testPathPattern=derive` | NO — Wave 0 |
| SEMANTIC-04 | fallback null when no match | unit | `npx jest --testPathPattern=derive` | NO — Wave 0 |
| SEMANTIC-05 | toggle flag SecureStore round-trip | unit | `npx jest --testPathPattern=flag` | NO — Wave 0 |
| ARCH-01 | no vault.ts import in derive.ts | static (tsc) | `npx tsc --noEmit` | N/A |
| ARCH-02 | flag disables coupling instantly | unit | `npx jest --testPathPattern=flag` | NO — Wave 0 |
| ARCH-03 | null return preserves XP path | unit + review | `npx jest --testPathPattern=derive` | NO — Wave 0 |
| ARCH-04 | no new npm deps | manual check | `npm list` diff | N/A |

### Sampling Rate

- **Per task commit:** `npx jest lib/__tests__/derive.test.ts lib/__tests__/flag.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/__tests__/derive.test.ts` — covers SEMANTIC-01, SEMANTIC-02, SEMANTIC-03, SEMANTIC-04, ARCH-03
- [ ] `lib/__tests__/flag.test.ts` — covers SEMANTIC-05, ARCH-02

*(No framework install needed — Jest already operational.)*

---

## Phase 18 Dependency Assessment

Phase 19 depends on Phase 18 (Tutoriel ferme). Phase 18 is shipped (2026-04-08). Its planning files are cleaned up from `.planning/phases/` but the code it delivered (FarmTutorialOverlay, CoachMarkOverlay, HelpContext.markScreenSeen) is in the main branch. Phase 18 made no changes to `lib/parser.ts`, `lib/types.ts`, `lib/gamification/`, or `hooks/useVaultTasks.ts` — there is no coupling risk.

---

## Open Questions

1. **Filepath ambiguity for `courses` vs `menage_hebdo` in `02 - Maison/`**
   - What we know: Both live under `02 - Maison/`. `Liste de courses.md` tasks should map to `courses`, `Tâches récurrentes.md` tasks should map to `menage_hebdo` or `menage_quotidien`.
   - What's unclear: Should the filepath second segment (`liste de courses`) be used? Or rely on tags (#courses)?
   - Recommendation: Use `#courses` tag as primary signal (D-02: tag wins). For filepath fallback, map `maison` → `menage_hebdo` (most common task type). `courses` category should primarily be reached via tag `#courses` or `#liste`. Document this in categories.ts comments.

2. **`bebe_soins` vs `enfants_routines` disambiguation**
   - What we know: Both use `01 - Enfants/` filepath. Bebe tasks have sections "Quotidien"/"Hebdomadaire" too.
   - What's unclear: How to distinguish bébé tasks from child tasks by filepath alone.
   - Recommendation: The subfolder pattern `01 - Enfants/{name}/` doesn't expose the child's age category at task level. Use sectionPatterns like `["biberons", "couches", "langer", "tetine"]` for bebe_soins. Fail gracefully to `enfants_routines` if the bébé-specific sections aren't matched.

---

## Sources

### Primary (HIGH confidence)

- `lib/types.ts` — Task interface definition (verified fields: id, text, completed, tags[], mentions[], sourceFile, section?)
- `lib/parser.ts` lines 62-140 — parseTask(), parseTaskFile(), TAG_REGEX, section extraction logic
- `lib/vault.ts` — vault directory structure (00-07 dirs), template content with real section names
- `lib/gamification/engine.ts` lines 105-128 — awardTaskCompletion() signature, confirmed untouched by Phase 19
- `jest.config.js` — test runner config, moduleNameMapper for expo-secure-store
- `lib/__tests__/__mocks__/expo-secure-store.ts` — in-memory mock, confirmed available
- `hooks/useVaultTasks.ts` — task consumption and toggleTask() integration point for Phase 20
- `.planning/codebase/TESTING.md` — Jest 29 + ts-jest versions, test conventions
- `19-CONTEXT.md` — all locked decisions D-01 through D-08

### Secondary (MEDIUM confidence)

- `hooks/useVaultBudget.ts` — confirms `05 - Budget` directory constant
- `lib/parser.ts:1263` — GRATITUDE_FILE = `'06 - Mémoires/Gratitude familiale.md'`
- `contexts/ThemeContext.tsx`, `contexts/ParentalControlsContext.tsx` — SecureStore usage patterns for flag.ts
- `hooks/useVault.ts` — confirms `03 - Cuisine/Recettes` and `04 - Rendez-vous` paths

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified installed and operational
- Task type shape: HIGH — read directly from lib/types.ts and lib/parser.ts
- Vault filepath taxonomy: HIGH — read from VaultManager.initVault() in lib/vault.ts
- Section names: HIGH — read from _maisonTasksContent() and _childTasksContent() templates
- Test infrastructure: HIGH — npm test confirmed passing with farm-engine.test.ts
- SecureStore mock: HIGH — file read, pattern confirmed from existing tests
- Architecture patterns: HIGH — matches CONTEXT.md locked decisions exactly
- Category patterns (actual string values): MEDIUM — planner must choose based on research above

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable domain — no external dependencies)
