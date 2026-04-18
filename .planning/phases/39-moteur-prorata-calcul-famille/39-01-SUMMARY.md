---
phase: 39-moteur-prorata-calcul-famille
plan: 01
subsystem: parser/village
tags: [sporee, profile, snapshots, vault-parser, tdd]
requires:
  - Phase 38 fondation modifiers + économie Sporée
provides:
  - WagerAgeCategory type (5 valeurs : adulte/ado/enfant/jeune/bebe)
  - Profile.weight_override?: WagerAgeCategory (round-trip famille.md)
  - FamilySnapshot type (date, pending, activeProfileIds)
  - parseSnapshots / appendSnapshot / pruneSnapshots (fonctions pures)
affects: []
tech-added: []
patterns: [append-only-section, idempotent-replace, whitelist-validation, defensive-multi-section-merge]
key-files:
  created:
    - lib/__tests__/famille-weight-override.test.ts
    - lib/__tests__/snapshots-parser.test.ts
  modified:
    - lib/types.ts
    - lib/parser.ts
    - lib/village/parser.ts
decisions:
  - "Whitelist stricte WagerAgeCategory (5 valeurs) — rejet silencieux valeur invalide, backward-compat préservée"
  - "appendSnapshot REMPLACE la ligne du jour (distinct d'appendBuilding qui skip) — un snapshot matinal doit pouvoir se rafraîchir au recompute"
  - "parseSnapshots scanne TOUTES les sections ## Snapshots (defensive merge) pour survivre à un vault pollué"
  - "Format ligne `YYYY-MM-DD:pending:id1|id2` — séparateur `:` pour cohérence avec pattern CSV Phase 38, `|` pour ids car interdit dans snake_case profileId"
  - "pruneSnapshots retourne un nouvel objet (immutabilité) — consommateur Plan 02 peut comparer references"
metrics:
  duration: "~8min"
  completed: 2026-04-18
  tasks: 2
  files: 5
---

# Phase 39 Plan 01: Fondations data moteur Sporée Summary

Extension des fondations data pour Phase 39 : `Profile.weight_override` round-trip famille.md + trio de fonctions pures `parseSnapshots` / `appendSnapshot` / `pruneSnapshots` pour gérer la section `## Snapshots` append-only dans `jardin-familial.md`. Zéro UI, zéro hook, zéro moteur — les primitives data que le moteur pur du Plan 02 consommera.

## What Was Built

### Task 1 — Profile.weight_override bidirectionnel

**`lib/types.ts`** — nouveau type exporté :
```typescript
export type WagerAgeCategory = 'adulte' | 'ado' | 'enfant' | 'jeune' | 'bebe';

export interface Profile {
  // ... champs existants
  statut?: 'grossesse' | 'ne';
  weight_override?: WagerAgeCategory; // Phase 39 — override poids pondération Sporée
  dateTerme?: string;
}
```

**`lib/parser.ts`** — parseFamille ajoute une whitelist de validation :
```typescript
const validWeightOverrides = ['adulte', 'ado', 'enfant', 'jeune', 'bebe'] as const;
const weight_override = (validWeightOverrides as readonly string[]).includes(currentProps.weight_override)
  ? (currentProps.weight_override as Profile['weight_override'])
  : undefined;
```

**`lib/parser.ts`** — serializeFamille écriture conditionnelle (pattern cohérent) :
```typescript
if (profile.weight_override) lines.push(`weight_override: ${profile.weight_override}`);
```

**Round-trip example :**
```
### lucas_adulte
name: Lucas
role: adulte
avatar: 👨
weight_override: enfant
```
→ `parseFamille` → `{ weight_override: 'enfant', ... }` → `serializeFamille` → identique à l'input.

### Task 2 — Trio snapshots pur

**`lib/village/parser.ts`** — 3 fonctions exportées :

```typescript
export interface FamilySnapshot {
  date: string;              // YYYY-MM-DD local
  pending: number;           // tâches pending au matin
  activeProfileIds: string[]; // profils actifs 7j
}

export function parseSnapshots(content: string): Record<string, FamilySnapshot>;
export function appendSnapshot(content: string, snapshot: FamilySnapshot): string;
export function pruneSnapshots(
  snapshots: Record<string, FamilySnapshot>,
  today: string,
  maxDays?: number,
): Record<string, FamilySnapshot>;
```

**Format ligne** `## Snapshots` :
```
## Snapshots
2026-04-16:5:lucas_adulte|emma_adulte
2026-04-17:3:lucas_adulte
2026-04-18:7:lucas_adulte|emma_adulte|papa_adulte
```

**Round-trip example :**
```typescript
const snap: FamilySnapshot = {
  date: '2026-04-18',
  pending: 5,
  activeProfileIds: ['lucas_adulte', 'emma_adulte'],
};
const updated = appendSnapshot('', snap);
// → "## Snapshots\n2026-04-18:5:lucas_adulte|emma_adulte\n"
const parsed = parseSnapshots(updated);
// → { '2026-04-18': { date: '2026-04-18', pending: 5, activeProfileIds: ['lucas_adulte', 'emma_adulte'] } }
```

## Tests

- **`lib/__tests__/famille-weight-override.test.ts`** : 6/6 tests (parse valide/absent/invalide + serialize conditionnel + round-trip 5 valeurs)
- **`lib/__tests__/snapshots-parser.test.ts`** : 13/13 tests (parse absence/malformé/ids-vides + append idempotent replace + Pitfall 4 + prune cutoff+immutabilité + round-trip)

**Total : 19/19 tests pass**, TypeScript clean hors pré-existant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Robustesse] parseSnapshots scan multi-sections**
- **Trouvé pendant :** Task 2 (Test 4 "ignore lignes malformées" avec 2 `## Snapshots` headers)
- **Problème :** Un fichier pollué peut contenir plusieurs sections `## Snapshots`. La regex `exec` single-shot capturait uniquement la première et ratait les lignes valides des suivantes.
- **Fix :** Passage à `while (regex.exec())` avec flag `g` pour merger TOUTES les sections — defensive merge contre vaults corrompus.
- **Fichier :** `lib/village/parser.ts` parseSnapshots
- **Commit :** e53ecc1

**2. [Rule 2 — Edge case] appendSnapshot sur contenu vide**
- **Trouvé pendant :** Task 2 Test 9 round-trip avec `content=''`
- **Problème :** Le chemin "section absente + pas d'Historique" concaténait `${trimmed}\n\n## Snapshots\n${newLine}\n` → produisait `\n\n## Snapshots\n...` avec newlines en tête si trimmed était vide.
- **Fix :** Ajout branche explicite `if (trimmed === '') return '## Snapshots\n${newLine}\n';`
- **Fichier :** `lib/village/parser.ts` appendSnapshot
- **Commit :** e53ecc1

### Bonus tests ajoutés (3)

Au-delà des 16 tests demandés par le PLAN :
- `Test 5bis` : création section sans ## Historique (fallback fin de fichier)
- `Test 8bis` : immutabilité pruneSnapshots
- `round-trip avec activeProfileIds vide` — garde-fou format trailing `:`

## Connection to Plan 02

Plan 02 (moteur prorata) consommera :
- `FamilySnapshot` comme type d'entrée pour `recordMorningSnapshot(snapshot)` et sortie de `getSnapshot(date)`
- `Profile.weight_override` pour lookup dans `getWeightForProfile(profile, defaultWeight)` — override prioritaire sur la dérivation age/role par défaut
- `parseSnapshots` / `appendSnapshot` / `pruneSnapshots` comme primitives data — le moteur pur orchestrera rétention 14j et rafraîchissement 23h30 sans re-implémenter la sérialisation

## Commits

- `0757afd` — test(39-01) RED weight_override (6 tests, 3 fail initial)
- `fda7ed7` — feat(39-01) GREEN weight_override (Profile + parser bidirectionnel)
- `eda4966` — test(39-01) RED snapshots (13 tests, 13 fail initial)
- `e53ecc1` — feat(39-01) GREEN snapshots (FamilySnapshot + trio pur)

## Self-Check: PASSED

- `lib/types.ts` weight_override line 80 — FOUND
- `lib/parser.ts` weight_override (4 matches) — FOUND
- `lib/village/parser.ts` FamilySnapshot/parseSnapshots/appendSnapshot/pruneSnapshots (18 matches) — FOUND
- `lib/__tests__/famille-weight-override.test.ts` — FOUND
- `lib/__tests__/snapshots-parser.test.ts` — FOUND
- Commit 0757afd — FOUND
- Commit fda7ed7 — FOUND
- Commit eda4966 — FOUND
- Commit e53ecc1 — FOUND
- 19/19 tests pass
- `npx tsc --noEmit` clean hors pré-existant (MemoryEditor/cooklang/useVault)
- Aucune nouvelle dépendance npm (package.json intact)
