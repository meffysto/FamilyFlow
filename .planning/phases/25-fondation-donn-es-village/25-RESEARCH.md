# Phase 25: Fondation données village - Research

**Researched:** 2026-04-10
**Domain:** Markdown vault data layer — parser module, grid constants, append-only log
**Confidence:** HIGH (all findings verified against existing codebase source code)

## Summary

Phase 25 is a pure data/infrastructure phase: no React, no hooks, no UI. It creates a new isolated module `lib/village/` that mirrors the established `lib/mascot/` and `lib/museum/` patterns. The module contains four files: `types.ts`, `grid.ts`, `templates.ts`, `parser.ts`, and a barrel `index.ts`. It also creates the vault file `04 - Gamification/jardin-familial.md` with a gray-matter frontmatter header and an append-only contributions section.

The entire codebase already solves all the sub-problems here — the village module is an instance of patterns already proven across 25 phases. The planner can directly reference `lib/museum/engine.ts` for the append-only section pattern, `lib/mascot/world-grid.ts` for the grid constants, and `lib/parser.ts::parseFarmProfile` for the frontmatter + key:value body pattern.

**Primary recommendation:** Mirror `lib/museum/` structure exactly. One pure-logic module, one async vault function isolated at the bottom of `parser.ts` (or in its own file). Zero new npm dependencies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Layout minimal MVP — fontaine (centre), panneau historique, 2 etals. Elements supplementaires en v1.5.
- **D-02:** Type `VillageCell` dedie avec `id`, `x`, `y`, `role` ('fountain'|'stall'|'board'|'portal') — pas de reutilisation de `WorldCell` (unlockOrder/cellType inutiles pour des elements fixes).
- **D-03:** Phase 25 definit uniquement les positions des elements interactifs. La carte terrain cobblestone sera ajoutee en Phase 27 pour TileMapRenderer.
- **D-04:** Cibles unifiees — 1 recolte = 1 point, 1 tache IRL = 1 point. Un seul compteur de contributions.
- **D-05:** Cible hebdomadaire = `BASE_TARGET * nb_profils_actifs` (ex: base=15, 3 profils = 45).
- **D-06:** Templates thematises avec nom, icone, description courte. Themes rotatifs hebdomadaires aleatoires.
- **D-07:** Module isole `lib/village/` — ne grossit pas parser.ts.
- **D-08:** Barrel `lib/village/index.ts` suivant le pattern lib/mascot/ et lib/gamification/.
- **D-09:** Fichier vault dans `04 - Gamification/jardin-familial.md`.
- **D-10 (herite):** Format append-only pour les contributions — total derive a la lecture, jamais de total mutable ecrit.
- **D-11 (herite):** IDs grille village prefixes `village_` pour eviter collisions avec la ferme perso.
- **D-12 (herite):** Fichier partage `jardin-familial.md` entre tous les profils.

### Claude's Discretion

- Structure exacte du frontmatter YAML de jardin-familial.md (champs, types)
- Format des lignes de contribution append-only (timestamp ISO vs epoch, separateur)
- Nombre exact de templates d'objectif a livrer en MVP (5-10 raisonnable)
- Constante BASE_TARGET valeur initiale (ajustable facilement)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Le système persiste l'état du village dans un fichier Markdown partagé (`jardin-familial.md`) compatible Obsidian, avec parser bidirectionnel | `parseGardenFile` / `serializeGardenFile` pair in `lib/village/parser.ts`, gray-matter for frontmatter |
| DATA-02 | Les contributions sont stockées en append-only log (timestamp, profileId, type, montant) pour éviter les corruptions iCloud | Append-only section pattern from `lib/museum/engine.ts::appendMuseumEntry` — read→modify→write via VaultManager queue |
| DATA-04 | Les IDs de la grille village sont namespacés (`village_c0`, `village_b0`) pour éviter les collisions avec la ferme perso | `VILLAGE_GRID` constant in `lib/village/grid.ts` with `village_` prefix on all cell IDs (D-11) |
| MAP-02 | Une grille village (`village-grid.ts`) définit les positions des éléments interactifs sur la place | `VillageCell` type + `VILLAGE_GRID` array in `lib/village/grid.ts`, 4 elements (fountain, 2 stalls, board) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | already installed | YAML frontmatter parse/serialize | Used for all vault files — zero new dep |
| date-fns | already installed | ISO timestamp formatting | Used throughout codebase for date ops |

**No new npm packages.** Per project-wide decision ARCH-05 (zero new deps on v1.2 milestone, extended to v1.4 by convention). The village module reuses the existing gray-matter + date-fns stack.

**Version verification:** Both packages already in node_modules — no install step needed.

## Architecture Patterns

### Recommended Module Structure
```
lib/village/
├── types.ts        # VillageData, VillageContribution, VillageWeekObjective, VillageCell
├── grid.ts         # VillageCell type + VILLAGE_GRID constant
├── templates.ts    # OBJECTIVE_TEMPLATES constant, BASE_TARGET, computeWeekTarget()
├── parser.ts       # parseGardenFile(), serializeGardenFile(), appendContribution()
└── index.ts        # barrel — export * from each file
```

### Pattern 1: Isolated Pure Module (lib/museum/ model)
**What:** All logic is pure TypeScript. Zero React, zero hooks, zero context imports. One async function at the bottom of parser.ts that takes `VaultManager` directly.
**When to use:** Any new domain module in this codebase — established pattern since Phase 23.
**Example (from lib/museum/engine.ts):**
```typescript
// Pure function — synchronous, testable
export function appendContribution(content: string, entry: VillageContribution): string {
  const newLine = `- ${entry.timestamp} | ${entry.profileId} | ${entry.type} | ${entry.amount}`;
  // ... section find/insert logic (same as appendMuseumEntry)
  return updatedContent;
}

// Single async function — VaultManager injected, NOT imported from context
export async function appendContributionToVault(
  vault: VaultManager,
  entry: VillageContribution,
): Promise<void> {
  const VILLAGE_FILE = '04 - Gamification/jardin-familial.md';
  const content = await vault.readFile(VILLAGE_FILE).catch(() => '');
  const updated = appendContribution(content, entry);
  await vault.writeFile(VILLAGE_FILE, updated);
}
```

### Pattern 2: VillageCell Grid (lib/mascot/world-grid.ts model)
**What:** Typed constant array with fractional x/y positions. IDs namespaced to avoid collision.
**When to use:** Any fixed grid of positioned elements.
**Example (based on WorldCell pattern, simplified per D-02):**
```typescript
// Source: lib/mascot/world-grid.ts
export type VillageRole = 'fountain' | 'stall' | 'board' | 'portal';

export interface VillageCell {
  id: string;      // MUST be prefixed "village_" (D-11) — ex: "village_fountain"
  x: number;       // fraction of container width (0-1)
  y: number;       // fraction of container height (0-1)
  role: VillageRole;
}

export const VILLAGE_GRID: VillageCell[] = [
  { id: 'village_fountain', x: 0.50, y: 0.50, role: 'fountain' },
  { id: 'village_stall_0',  x: 0.25, y: 0.65, role: 'stall'    },
  { id: 'village_stall_1',  x: 0.75, y: 0.65, role: 'stall'    },
  { id: 'village_board',    x: 0.15, y: 0.30, role: 'board'     },
];
```

### Pattern 3: Frontmatter + Body (gray-matter + key:value)
**What:** The `jardin-familial.md` file uses gray-matter for YAML frontmatter and a named Markdown section for the append-only log.
**When to use:** All vault files that need both metadata and a growing list.
**Recommended file format (Claude's discretion — see Open Questions for alternatives):**
```markdown
---
version: 1
created: 2026-04-10
current_week_start: 2026-04-07
current_theme_index: 0
reward_claimed: false
---

## Contributions

- 2026-04-10T14:32:00 | emma | harvest | 1
- 2026-04-10T16:05:30 | lucas | task | 1

## Historique

- 2026-04-07 | cible:45 | total:62 | claimed:true
```

**Parse pair:**
```typescript
// lib/village/parser.ts
import matter from 'gray-matter';

export interface VillageData {
  version: number;
  createdAt: string;
  currentWeekStart: string;   // ISO date YYYY-MM-DD
  currentThemeIndex: number;  // index into OBJECTIVE_TEMPLATES for this week
  rewardClaimed: boolean;
  contributions: VillageContribution[];
  pastWeeks: VillageWeekRecord[];
}

export interface VillageContribution {
  timestamp: string;          // ISO 8601 without Z (local time, same convention as museum)
  profileId: string;
  type: 'harvest' | 'task';
  amount: number;             // always 1 per D-04
}

export interface VillageWeekRecord {
  weekStart: string;          // YYYY-MM-DD
  target: number;
  total: number;
  claimed: boolean;
}

export function parseGardenFile(content: string): VillageData { ... }
export function serializeGardenFile(data: VillageData): string { ... }
```

### Pattern 4: Barrel Export (lib/mascot/index.ts model)
**What:** `export * from './types'` wildcard re-exports from all module files.
**When to use:** Every new domain module.
**Example (from lib/mascot/index.ts):**
```typescript
export * from './types';
export * from './grid';
export * from './templates';
export * from './parser';
```

### Pattern 5: Objective Templates (OBJECTIVE_TEMPLATES constant)
**What:** Array of themed weekly objectives, rotated randomly. Each template has name, icon, description.
**Recommended shape:**
```typescript
export const BASE_TARGET = 15; // per D-05 — easily adjustable

export interface ObjectiveTemplate {
  id: string;
  name: string;       // ex: "La Grande Récolte"
  icon: string;       // emoji
  description: string; // courte, motivante
}

export const OBJECTIVE_TEMPLATES: ObjectiveTemplate[] = [
  { id: 'grande-recolte',    name: 'La Grande Récolte',    icon: '🌾', description: 'Remplissez les étals du marché !' },
  { id: 'semaine-verte',     name: 'La Semaine Verte',     icon: '🌿', description: 'La nature reprend ses droits.' },
  { id: 'fete-du-village',   name: 'Fête du Village',      icon: '🎉', description: 'La place résonne de rires.' },
  { id: 'marche-automnal',   name: 'Marché Automnal',      icon: '🍂', description: 'Les couleurs de la saison.' },
  { id: 'lumiere-hivernale', name: 'Lumière Hivernale',    icon: '✨', description: 'La magie de l\'hiver.' },
  { id: 'printemps-actif',   name: 'Printemps Actif',      icon: '🌸', description: 'Tout s\'éveille, tout pousse !' },
  { id: 'grande-canicule',   name: 'Grande Canicule',      icon: '☀️', description: 'Tenez bon sous la chaleur !' },
];

export function computeWeekTarget(activeProfileCount: number): number {
  return BASE_TARGET * Math.max(1, activeProfileCount);
}
```

### Anti-Patterns to Avoid
- **Mutable total in frontmatter:** Never write a `total: N` field that gets incremented. Total is always derived at read-time by summing contributions (D-10). iCloud merge conflicts on a mutable counter cause data loss.
- **Reusing WorldCell:** Do not extend or reuse WorldCell from world-grid.ts. VillageCell is simpler — no unlockOrder, no cellType, no size (D-02).
- **Importing context in lib/village/:** Zero React/hook imports. The module is pure TypeScript for testability.
- **New npm dep:** No new packages. gray-matter and date-fns cover all needs.
- **Using parser.ts for village logic:** Per D-07, village parsing lives in lib/village/parser.ts, not the 2800-line parser.ts monolith.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter | Custom YAML parser | `gray-matter` (already installed) | Edge cases in multi-line strings, special chars, Obsidian compatibility |
| iCloud-safe file write | Manual atomic write | `VaultManager.writeFile()` | Uses NSFileCoordinator + enqueueWrite queue for race-free writes |
| Append-only section insert | Ad-hoc string concat | Mirror `appendMuseumEntry()` logic | Section boundary detection handles edge cases (section not last, trailing newlines) |
| ISO timestamp | Manual date format | `date-fns format()` | Consistency with museum entries, correct locale handling |

**Key insight:** Every data problem in this phase has an established solution already in the codebase. Research found zero gaps requiring custom solutions.

## Common Pitfalls

### Pitfall 1: Mutable Total Field in Frontmatter
**What goes wrong:** Adding a `total: 42` field that gets read-modify-written on each contribution causes iCloud merge conflicts that produce incorrect sums.
**Why it happens:** Temptation to cache derived values for performance.
**How to avoid:** Never write a total. Always derive `contributions.filter(isThisWeek).reduce(sum)` at read time.
**Warning signs:** Any `total:` or `progress:` field in the frontmatter.

### Pitfall 2: ID Collision with Farm Grid
**What goes wrong:** Village cell IDs like `c0`, `b0` (same as farm crop/building IDs) cause incorrect lookups when the portal transition code passes a cellId to either the farm or village renderer.
**Why it happens:** Copying the WorldCell pattern without adding the namespace prefix.
**How to avoid:** All VillageCell ids MUST start with `village_` (D-11). The planner should add a TSC-verifiable runtime assertion or comment.
**Warning signs:** Any id in VILLAGE_GRID that does not start with `village_`.

### Pitfall 3: Timestamp Format Inconsistency
**What goes wrong:** Using `.toISOString()` directly produces a UTC `Z`-suffixed timestamp. The museum module deliberately strips the `Z` to store local time. Mixing formats breaks week grouping.
**Why it happens:** `new Date().toISOString()` is the obvious default.
**How to avoid:** Use `.toISOString().slice(0, 19)` (no `Z`) — identical to the museum convention in `lib/museum/engine.ts line 164`.
**Warning signs:** Any timestamp string ending in `Z` in the contributions section.

### Pitfall 4: Section Insert Before Last Section (museum Pitfall 5)
**What goes wrong:** Appending a new contribution line at the raw end of the file inserts it after the `## Historique` section instead of inside `## Contributions`, corrupting the parse.
**Why it happens:** Naive `content + '\n' + newLine` append.
**How to avoid:** Mirror `appendMuseumEntry()` exactly — find section start, find next `##` marker, insert before it.
**Warning signs:** New contribution lines appearing after `## Historique` in the file.

### Pitfall 5: gray-matter stringify on Partial Data
**What goes wrong:** `matter.stringify(body, data)` drops fields with `undefined` values or coerces numbers to strings, causing parse-round-trip data loss.
**Why it happens:** gray-matter's stringify is lossy for certain types.
**How to avoid:** Build the output string manually (same as `serializeFarmProfile` / `serializeGamification` patterns in parser.ts) — header section + body string concatenation. Do not use `matter.stringify()` for serialization.
**Warning signs:** Any use of `matter.stringify()` in serializeGardenFile.

## Code Examples

Verified patterns from existing codebase source:

### Parse frontmatter + key:value body (from lib/parser.ts::parseFarmProfile)
```typescript
// Source: lib/parser.ts lines 571-629
import matter from 'gray-matter';

export function parseGardenFile(content: string): VillageData {
  const { data: fm, content: body } = matter(content);

  // Parse contributions from ## Contributions section
  const contributions: VillageContribution[] = [];
  const lines = body.split('\n');
  let inContributions = false;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      inContributions = line.trim() === '## Contributions';
      continue;
    }
    if (!inContributions || !line.startsWith('- ')) continue;

    // Format: - YYYY-MM-DDTHH:mm:ss | profileId | type | amount
    const parts = line.slice(2).split(' | ');
    if (parts.length < 4) continue;
    const amount = parseInt(parts[3].trim(), 10);
    if (isNaN(amount)) continue;
    contributions.push({
      timestamp: parts[0].trim(),
      profileId: parts[1].trim(),
      type: parts[2].trim() as 'harvest' | 'task',
      amount,
    });
  }

  return {
    version: Number(fm.version ?? 1),
    createdAt: String(fm.created ?? ''),
    currentWeekStart: String(fm.current_week_start ?? ''),
    currentThemeIndex: Number(fm.current_theme_index ?? 0),
    rewardClaimed: Boolean(fm.reward_claimed ?? false),
    contributions,
    pastWeeks: [], // parsed similarly from ## Historique section
  };
}
```

### Append-only section insert (from lib/museum/engine.ts::appendMuseumEntry)
```typescript
// Source: lib/museum/engine.ts lines 162-207
const CONTRIBUTIONS_HEADER = '## Contributions';

export function appendContribution(content: string, entry: VillageContribution): string {
  const newLine = `- ${entry.timestamp} | ${entry.profileId} | ${entry.type} | ${entry.amount}`;
  const lines = content.split('\n');
  let sectionStart = -1;
  let nextSectionIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === CONTRIBUTIONS_HEADER) {
      sectionStart = i;
      continue;
    }
    if (sectionStart !== -1 && lines[i].startsWith('## ')) {
      nextSectionIdx = i;
      break;
    }
  }

  if (sectionStart === -1) {
    // Section absente — créer
    return `${content.trimEnd()}\n\n${CONTRIBUTIONS_HEADER}\n${newLine}\n`;
  }

  if (nextSectionIdx !== -1) {
    // Insérer avant la section suivante (Pitfall 4)
    let insertAt = nextSectionIdx;
    while (insertAt > sectionStart + 1 && lines[insertAt - 1].trim() === '') insertAt--;
    return [...lines.slice(0, insertAt), newLine, ...lines.slice(insertAt)].join('\n');
  }

  return `${content.trimEnd()}\n${newLine}\n`;
}
```

### Barrel export (from lib/mascot/index.ts)
```typescript
// Source: lib/mascot/index.ts
export * from './types';
export * from './grid';
export * from './templates';
export * from './parser';
```

### VaultManager async wrapper pattern (from lib/museum/engine.ts::appendMuseumEntryToVault)
```typescript
// Source: lib/museum/engine.ts lines 290-299
export async function appendContributionToVault(
  vault: VaultManager,
  entry: VillageContribution,
): Promise<void> {
  const VILLAGE_FILE = '04 - Gamification/jardin-familial.md';
  const content = await vault.readFile(VILLAGE_FILE).catch(() => '');
  const updated = appendContribution(content, entry);
  await vault.writeFile(VILLAGE_FILE, updated);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Everything in parser.ts | Isolated modules in lib/{domain}/ | Phase 23 (museum) | Village follows museum pattern — new files in lib/village/, not parser.ts |
| Single gamification.md | Per-profil gami-{id}.md + shared files | Phase 8.1 | Village adds jardin-familial.md as a shared (non-per-profil) file — precedent exists |

## Open Questions

1. **Exact frontmatter fields for jardin-familial.md**
   - What we know: `version`, `created`, `current_week_start`, `current_theme_index`, `reward_claimed` are sufficient for Phase 25 needs
   - What's unclear: Phase 26 (useGarden hook) may need additional fields for OBJ-05 double-flag — add there, not here
   - Recommendation: Minimal frontmatter for Phase 25. Extend in Phase 26.

2. **Whether to create jardin-familial.md file or only parser**
   - What we know: Phase 25 is data/infrastructure — the file itself may not exist until Phase 26 writes it for the first time
   - What's unclear: Whether a seed/template file should be committed to the repo for dev testing
   - Recommendation: The parser should handle missing file gracefully (`.catch(() => '')`) and `parseGardenFile('')` returns a valid default VillageData. No need to commit a file.

3. **Number of objective templates (Claude's discretion)**
   - What we know: 5-10 is reasonable per CONTEXT.md
   - Recommendation: 7 templates covering all seasons + generic themes (see Pattern 5 example above). Even number ensures no obvious repetition in rotation.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure TypeScript module creation, no CLI tools, services, or runtimes beyond the project's existing stack).

## Sources

### Primary (HIGH confidence)
- `/Users/gabrielwaltio/Documents/family-vault/lib/museum/engine.ts` — append-only section insert pattern, async VaultManager wrapper pattern
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/world-grid.ts` — VillageCell grid structure pattern, UPPER_SNAKE_CASE constant array
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/index.ts` — barrel export pattern
- `/Users/gabrielwaltio/Documents/family-vault/lib/gamification/index.ts` — named barrel export pattern (alternative to wildcard)
- `/Users/gabrielwaltio/Documents/family-vault/lib/parser.ts lines 571-637` — parseFarmProfile / serializeFarmProfile parse+serialize pair convention
- `/Users/gabrielwaltio/Documents/family-vault/lib/vault.ts lines 95-136` — VaultManager.readFile / writeFile API
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/25-fondation-donn-es-village/25-CONTEXT.md` — locked decisions D-01 through D-12

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md` — layer structure, lib/ module rules
- `.planning/codebase/CONVENTIONS.md` — naming, barrel files, TypeScript style
- `.planning/STATE.md` — inherited decisions from Init v1.4

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — directly read from node_modules + package.json (gray-matter, date-fns confirmed installed)
- Architecture: HIGH — patterns directly extracted from lib/museum/engine.ts and lib/mascot/*.ts source files
- Pitfalls: HIGH — pitfalls 1-5 derived from existing RESEARCH.md comments (museum phase) and direct code reading

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable codebase — no fast-moving external deps)
