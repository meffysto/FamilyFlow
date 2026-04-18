---
phase: 40-ui-spor-e-seed-picker-badge-validation
plan: 01
subsystem: fondation-hook-sporee-ui
tags: [sporee, wager, useFarm, useVaultTasks, cache, parser, event-driven]
requires:
  - lib/mascot/wager-engine (Phase 39)
  - lib/mascot/sporee-economy (Phase 38)
  - WagerModifier Phase 39 shape
provides:
  - lib/mascot/wager-ui-helpers.ts (4 fonctions + 2 types)
  - rollWagerDropBack + DROP_BACK_CHANCE
  - WagerModifier étendu (tasksCompletedToday, lastDailyResetDate, totalDays)
  - FarmProfileData.wagerLastRecomputeDate
  - useFarm.startWager + useFarm.incrementWagerCumul
  - VaultState.subscribeTaskComplete (event-driven)
  - Bootstrap maybeRecompute au boot
affects:
  - hooks/useFarm.ts (imports + startWager/incrementWagerCumul + harvest branch wager + 2× useEffect)
  - hooks/useVaultTasks.ts (subscribeTaskComplete + fire listeners sur transition false→true)
  - hooks/useVault.ts (import type + expose subscribeTaskComplete)
  - lib/mascot/types.ts (WagerModifier +3 champs optionnels)
  - lib/types.ts (FarmProfileData.wagerLastRecomputeDate)
  - lib/parser.ts (parse/serialize wager_last_recompute_date)
  - lib/vault-cache.ts (CACHE_VERSION 4 → 5)
  - lib/mascot/index.ts (barrel exports)
tech-stack:
  added: []
  patterns:
    - "Event-driven cross-hook via ref-based subscription (Set<listener>)"
    - "Fire-and-forget async listeners avec guard __DEV__"
    - "Single writeFile mutation in-place farmData (startWager, incrementWagerCumul, bootstrap)"
key-files:
  created:
    - lib/mascot/wager-ui-helpers.ts
    - lib/__tests__/wager-ui-helpers.test.ts
  modified:
    - lib/mascot/sporee-economy.ts
    - lib/mascot/types.ts
    - lib/mascot/index.ts
    - lib/types.ts
    - lib/parser.ts
    - lib/vault-cache.ts
    - hooks/useFarm.ts
    - hooks/useVaultTasks.ts
    - hooks/useVault.ts
    - lib/__tests__/sporee-economy.test.ts
decisions:
  - "Option B retenue (subscribe via ref partagée dans VaultState) vs Option A : useFarm est instancié dans tree.tsx (pas useVaultInternal), injection directe impraticable sans déplacer useFarm"
  - "TaskCompleteListener reçoit Task brute (pas profileId+sourceFile) : consommateur fait son propre filtre domaine + attribution, cohérent avec filterTasksForWager + wager-engine.isProfileActive7d"
  - "computeWagerTotalDays source unique côté wager-ui-helpers (B2 — élimine magic number 7 côté UI, persisté via startWager)"
  - "Bootstrap maybeRecompute via useEffect [activeProfile.id] + ref anti-replay : 1 passage par profil/session, zéro boucle infinie"
  - "Multiplier wager appliqué APRÈS bloc golden (pitfall P3 : finalQty déjà multiplié par EFFECT_GOLDEN_MULTIPLIER)"
  - "rollWagerDropBack avec injection random (default Math.random) : testable via () => 0.1/0.15/0.5"
  - "Fire-and-forget dans subscribeTaskComplete listener loop : une erreur listener ne doit PAS bloquer toggleTask"
metrics:
  duration_min: ~25
  completed_date: 2026-04-18
  task_count: 2
  file_count: 11
  tests_added: 28
  total_tests_passing: "1642/1642"
---

# Phase 40 Plan 01 : Fondation data/hook Sporée UI Summary

Extension data complète de la Phase 40 — WagerModifier B1/B2, `useFarm.startWager`/`incrementWagerCumul`, helpers UI purs, câblage event-driven task→wager via subscription ref, bootstrap maybeRecompute au boot, cache v5, zéro régression.

## Exports finaux

### `lib/mascot/wager-ui-helpers.ts`

```typescript
// Constantes partagées (source unique)
export const DURATION_FACTORS: Record<WagerDuration, number>; // { chill: 1.0, engage: 0.7, sprint: 0.5 }
export const MULTIPLIERS: Record<WagerDuration, WagerMultiplier>; // { chill: 1.3, engage: 1.7, sprint: 2.5 }

// Types
export type PaceLevel = 'green' | 'yellow' | 'orange';
export interface WagerDurationOption {
  duration: WagerDuration;
  multiplier: WagerMultiplier;
  targetTasks: number;
  absoluteTasks: number;
  estimatedHours: number;
}

// Fonctions pures
export function computeWagerDurations<TCtx>(
  tasksPerStage: number,
  computeCumulTargetFn: (ctx: TCtx) => { cumulTarget: number },
  ctx: TCtx,
): WagerDurationOption[]; // toujours 3 options, ordre chill/engage/sprint

export function computePaceLevel(
  cumulCurrent: number,
  cumulTarget: number,
  daysElapsed: number,
  totalDays: number,
): PaceLevel;
// ratio ≥ 1.0 → green | ≥ 0.7 → yellow | < 0.7 → orange
// Fallbacks bienveillants : cumulTarget=0 → green, daysElapsed=0 → green

export function computeWagerTotalDays(
  duration: WagerDuration,
  tasksPerStage: number,
): number;
// B2 — source unique, persisté côté startWager, consommé côté UI

export function daysBetween(startISO: string, endISO: string): number;
// jamais négatif, pour PlantWagerBadge Plan 03
```

### `lib/mascot/sporee-economy.ts` (nouveau)

```typescript
export const DROP_BACK_CHANCE = 0.15;
export function rollWagerDropBack(random: () => number = Math.random): boolean;
// random() < 0.15 (strictement <)
```

### `WagerModifier` (shape final — `lib/mascot/types.ts`)

```typescript
export interface WagerModifier {
  // Phase 38
  sporeeId: string;
  duration: WagerDuration;
  multiplier: WagerMultiplier;
  appliedAt: string;
  sealerProfileId: string;
  // Phase 39
  cumulTarget?: number;
  cumulCurrent?: number;
  // Phase 40 — B1 badge 2-lignes
  tasksCompletedToday?: number;
  lastDailyResetDate?: string;
  // Phase 40 — B2 élimine magic number 7
  totalDays?: number;
}
```

Tous les nouveaux champs sont **optionnels** — rétro-compat Phase 38/39 préservée.

### `FarmProfileData` (lib/types.ts)

```typescript
wagerLastRecomputeDate?: string; // frontmatter: wager_last_recompute_date
```

### `useFarm` — nouveaux callbacks

```typescript
startWager: (
  profileId: string,
  plotIndex: number,
  cropId: string,
  duration: WagerDuration,
) => Promise<void>;
// Consomme 1 Sporée, plante, persiste WagerModifier complet (cumulTarget live
// + totalDays B2 + trackers B1), 1 unique writeFile.

incrementWagerCumul: (profileId: string) => Promise<void>;
// Reset quotidien B1 (lastDailyResetDate ≠ today → 1, sinon +1) + cumulCurrent +1
// sur TOUS les wagers actifs du profil. Early return si aucun wager actif.
```

### `VaultState.subscribeTaskComplete`

```typescript
subscribeTaskComplete: (listener: TaskCompleteListener) => () => void;
export type TaskCompleteListener = (task: Task) => void | Promise<void>;
```

## Stratégie câblage `onTaskComplete` — décision consignée

**Retenu : Option B (subscribe via ref partagée exposée par VaultState).**

Raison concrète : `useFarm` est instancié dans l'écran `app/(tabs)/tree.tsx` (ligne 422), pas dans `useVaultInternal`. L'Option A (callback injecté à l'assemblage du contexte, pattern `contribute` passé à `useVaultDefis`) nécessiterait de déplacer `useFarm` dans `useVault.ts` — refacto structurel hors scope Phase 40. L'Option B est pattern cohérent avec `AppState.addEventListener` natif, zéro cycle de dépendance :

1. `useVaultTasks` expose `subscribeTaskComplete(listener)` → `() => void`.
2. `useVault.VaultState` forward l'API (sans transformation).
3. `useFarm` consomme via `useEffect` + subscription, fait son propre filtre domaine (`filterTasksForWager`) et attribution (triple check mentions/sourceFile cohérent `wager-engine.isProfileActive7d`).
4. Fire-and-forget : erreur listener ne bloque pas `toggleTask` ; logs `__DEV__` guard.

Transition `false → true` uniquement — un-check d'une tâche ne ré-incrémente pas.

## Bump cache version confirmé

`CACHE_VERSION`: **4 → 5**
`CACHE_FILE_URI`: `vault-cache-v4.json` → `vault-cache-v5.json`

Invalidation propre au premier boot post-migration. Shape changements :
- `WagerModifier` : +3 champs optionnels
- `FarmProfileData` : `wagerLastRecomputeDate` nouveau champ

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1 : Helpers UI + rollWagerDropBack + tests | `551b906` | wager-ui-helpers.ts, sporee-economy.ts, index.ts, 2 suites Jest |
| Task 2 : Types + parser + cache + useFarm + câblage | `d0704f4` | types.ts (×2), parser.ts, vault-cache.ts, useFarm.ts, useVaultTasks.ts, useVault.ts |

## Metrics

- **Tests added :** 28 (23 wager-ui-helpers + 5 rollWagerDropBack)
- **Total tests passing :** 1642/1642 sur 62 suites
- **Wager-related tests :** 142/142 verts (wager-engine + sporee-economy + wager-ui-helpers)
- **Farm-parser round-trip :** 10/10 verts (invariant Sporée préservé)
- **TypeScript :** `npx tsc --noEmit` clean (hors pré-existants MemoryEditor/cooklang)
- **Zéro nouvelle dépendance npm** (6e milestone consécutif, ARCH-05 reconduit)

## Deviations from Plan

**1. [Rule 2 — Critical functionality] `wager_last_recompute_date` ajouté au mapper `applyFarmField` côté useFarm.ts**

- **Found during:** Task 2, extension useFarm
- **Issue:** Le mapper `applyFarmField` de `useFarm.ts` ne connaît pas le nouveau champ parser — toute écriture via `writeProfileField(profileId, 'wager_last_recompute_date', …)` serait silencieusement ignorée.
- **Fix:** Ajouté `case 'wager_last_recompute_date'` au switch du mapper, cohérent avec `case 'sporee_count'`.
- **Files modified:** hooks/useFarm.ts
- **Commit:** d0704f4

**2. [Rule 3 — Blocking] Signature `TaskCompleteListener` corrigée : `Task` brute au lieu de `(profileId, sourceFile)`**

- **Found during:** Task 2, premier draft wiring
- **Issue:** Le plan listait `onTaskComplete?.(profileId, taskSourceFile)` — mais `Task` n'a pas de champ `profileId` direct (seulement `mentions: string[]`). L'attribution profil doit se faire **par le consommateur** (wager-engine.isProfileActive7d pattern).
- **Fix:** Signature changée à `(task: Task) => void | Promise<void>`. `useFarm` fait ensuite son propre triple check mentions/sourceFile.
- **Files modified:** hooks/useVaultTasks.ts, hooks/useFarm.ts
- **Commit:** d0704f4

**3. [Adaptation plan/réalité] Hook `useVaultTasks` au lieu de `useTasks`**

- **Found during:** Task 2, investigation obligatoire §0
- **Issue:** Plan référence `hooks/useTasks.ts` — fichier inexistant. Hook réel est `hooks/useVaultTasks.ts`.
- **Fix:** Modifications appliquées sur `useVaultTasks.ts` (conventions Phase 40 : décomposition god hook vers hooks domaine).
- **Commit:** d0704f4

## Auth gates

Aucun — plan data/hook pur, zéro API externe.

## Known Stubs

Aucun stub livré. Les callbacks `startWager` / `incrementWagerCumul` sont fonctionnels end-to-end. Le bootstrap `maybeRecompute` se déclenche automatiquement au boot du profil actif.

## Self-Check

Verification (files & commits exist) :
- FOUND: lib/mascot/wager-ui-helpers.ts
- FOUND: lib/__tests__/wager-ui-helpers.test.ts
- FOUND: Commit 551b906
- FOUND: Commit d0704f4
- FOUND: CACHE_VERSION = 5 in lib/vault-cache.ts
- FOUND: 1642/1642 tests passing
- FOUND: npx tsc --noEmit clean

## Self-Check: PASSED
