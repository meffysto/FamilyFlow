---
phase: 17-codex-ui
plan: 01
subsystem: codex
tags: [codex, search, discovery, helpers]
requires: [lib/codex/types.ts, lib/codex/content.ts]
provides: [normalize, searchCodex, filterByKind, computeDiscoveredCodexIds, DiscoverySource]
affects: []
tech_stack:
  added: []
  patterns: [pure-functions, NFD-normalization, lazy-derivation]
key_files:
  created:
    - lib/codex/search.ts
    - lib/codex/discovery.ts
  modified: []
decisions:
  - "D-09 respecté : normalize() dupliqué de lib/search.ts plutôt qu'exporté"
  - "D-06 respecté : discovery calculée lazy à l'ouverture du modal, aucun champ persisté"
  - "D-10 respecté : la fonction t() est injectée par l'appelant pour éviter le couplage React"
metrics:
  duration: 3min
  tasks: 2
  files: 2
  completed: 2026-04-08
---

# Phase 17 Plan 01: Search & Discovery Helpers Summary

Création des helpers purs `searchCodex` (recherche normalisée NFD cross-catégories) et `computeDiscoveredCodexIds` (dérivation lazy des entrées découvertes), prêts à être consommés par FarmCodexModal en 17-03.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Créer lib/codex/search.ts | 0c6282f | lib/codex/search.ts |
| 2 | Créer lib/codex/discovery.ts | 9a7cd74 | lib/codex/discovery.ts |

## Exported Functions

### lib/codex/search.ts

```typescript
export function normalize(input: string): string
export function searchCodex(query: string, t: (key: string) => string, entries: CodexEntry[]): CodexEntry[]
export function filterByKind(entries: CodexEntry[], kind: CodexEntry['kind']): CodexEntry[]
```

`normalize()` applique NFD + suppression des diacritiques + lowercase + trim. La duplication de `lib/search.ts:52` est volontaire (D-09) — l'objectif est de garder `lib/codex/` autonome sans étendre la surface publique de `lib/search.ts`.

`searchCodex()` accepte la fonction `t()` injectée par l'appelant (D-10) pour rester découplée de React/i18next. Une recherche sur "épinard" matche bien "Épinards" et "epinards" via la normalisation NFD.

### lib/codex/discovery.ts

```typescript
export interface DiscoverySource {
  farmInventory?: Record<string, number> | null;
  harvestInventory?: Record<string, number> | null;
  farmCrops?: Array<{ cropId?: string } | string> | null;
  farmAnimals?: Array<{ animalId?: string } | string> | null;
  farmBuildings?: Array<{ buildingId?: string } | string> | null;
  completedSagas?: string[] | null;
}

export function computeDiscoveredCodexIds(source: DiscoverySource | null | undefined): Set<string>
```

L'interface `DiscoverySource` est une shape minimale locale (pas d'import du type `Profile`) pour garder la fonction pure et testable. Six sources sont consultées : farmInventory, harvestInventory, farmCrops, farmAnimals, farmBuildings, completedSagas. Tolère `null`/`undefined` pour gérer le premier render avant chargement du profil.

## How 17-03 Will Consume These Helpers

Dans FarmCodexModal (à livrer en 17-03) :

```typescript
import { searchCodex } from '@/lib/codex/search';
import { computeDiscoveredCodexIds } from '@/lib/codex/discovery';
import { CODEX_CONTENT } from '@/lib/codex/content';

// 1. Calcul lazy à l'ouverture du modal
const discoveredIds = useMemo(() => computeDiscoveredCodexIds(profile), [profile]);

// 2. Filtre query → entries visibles
const filtered = useMemo(
  () => searchCodex(query, t, CODEX_CONTENT),
  [query, t]
);

// 3. Détermination silhouette
const isDiscovered = !entry.dropOnly || discoveredIds.has(entry.sourceId);
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` : zéro erreur dans `lib/codex/search.ts` et `lib/codex/discovery.ts`
- Aucun import depuis `lib/search.ts` (D-09 respecté)
- Aucun import depuis `react` ou `contexts/` (séparation UI/logique respectée)
- Les deux fichiers sont des modules ES purs

## Self-Check: PASSED

- lib/codex/search.ts : FOUND
- lib/codex/discovery.ts : FOUND
- Commit 0c6282f : FOUND
- Commit 9a7cd74 : FOUND
