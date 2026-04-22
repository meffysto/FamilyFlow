---
phase: 42-nourrir-le-compagnon
plan: 03
subsystem: mascot-companion-engine
tags: [engine, pure-function, feed, buff, cooldown, tdd, jest]
requirements: [FEED-06, FEED-07]
dependency-graph:
  requires:
    - "Plan 42-01 (types + helpers purs)"
    - "Plan 42-02 (parser + cache bump)"
  provides:
    - "feedCompanion(companion, cropId, grade, nowMs?) — pure, respecte cooldown 3h + affinité"
    - "getActiveFeedBuff(companion, nowMs?) — lecture lazy expiration"
    - "FeedResult interface { updated, affinity, applied, newBuff, cooldownMs }"
  affects:
    - "lib/mascot/companion-engine.ts — +68 lignes, 2 fonctions pures + 1 interface"
    - "lib/__tests__/companion-feed.test.ts — nouveau, 20 tests"
tech-stack:
  added: []
  patterns:
    - "Fonctions pures (aucune mutation, retour spread)"
    - "TDD RED → GREEN (test file avant implémentation)"
    - "Expiration lazy (read-only, nettoyage différé à la prochaine écriture)"
    - "Injection nowMs pour testabilité déterministe"
key-files:
  created:
    - "lib/__tests__/companion-feed.test.ts"
  modified:
    - "lib/mascot/companion-engine.ts"
decisions:
  - "Immutabilité stricte via spread CompanionData (jamais Object.assign inline)"
  - "getActiveFeedBuff retourne le buff même expiré n'est PAS effacé — nettoyage différé"
  - "Cooldown actif → updated === companion (strict eq), applied=false, newBuff=null"
  - "Hated crop + cooldown expiré → applied=true mais feedBuff=null (D-06), lastFedAt rafraîchi"
metrics:
  duration: "4min"
  completed: "2026-04-22"
  tests: "20/20 pass"
  files_touched: 2
  commits: 2
---

# Phase 42 Plan 03 : Moteur feedCompanion pur + tests Jest Summary

Ajout au moteur compagnon de `feedCompanion()` et `getActiveFeedBuff()` — fonctions pures exportées qui appliquent un nourrissage (update `lastFedAt` + `feedBuff`) en respectant le cooldown 3h et l'affinité crop/espèce, sans mutation. Couverture Jest TDD 20 tests exhaustifs avant câblage hook (Plan 42-04).

## Objectif livré

D-06 (affinity null si hated), D-07 (empilage multiplicatif), D-09 (un seul buff actif), D-10 (cooldown 3h), D-12 (buff peut expirer avant cooldown). Moteur pur testable isolément avant tout câblage UI/hook.

## Signatures finales

```typescript
export interface FeedResult {
  updated: CompanionData;      // nouvel objet (spread)
  affinity: CropAffinity;      // 'preferred' | 'neutral' | 'hated'
  applied: boolean;            // false si cooldown actif
  newBuff: FeedBuff | null;    // null si hated ou cooldown actif
  cooldownMs: number;          // 0 si applied=true
}

export function feedCompanion(
  companion: CompanionData,
  cropId: string,
  grade: HarvestGrade,
  nowMs?: number,
): FeedResult;

export function getActiveFeedBuff(
  companion: CompanionData | null | undefined,
  nowMs?: number,
): FeedBuff | null;
```

## Décision immutabilité

**Retenu :** spread `{ ...companion, lastFedAt, feedBuff }` — garantit un nouvel objet à chaque `applied=true`. Test dédié `ne mute pas l'argument d'origine (strict equality)` vérifie que `comp.lastFedAt`, `comp.feedBuff`, `comp.activeSpecies` restent inchangés après l'appel. Cas cooldown : `updated === companion` (retour direct de la référence, aucune mutation non plus).

**Rejeté :** mutation inline `companion.lastFedAt = ...` — briserait la source unique d'état du VaultContext et rendrait les hooks React non prédictibles.

## Couverture Jest (20 tests)

| Bloc | Tests |
|------|-------|
| getAffinity | préféré / détesté / neutre (3) |
| getBuffForCrop | perfect+preferred 1.495 / ordinary neutre 1.05 / hated null (3) |
| isBuffActive | futur true / passé false / null-undefined false (3) |
| getCooldownRemainingMs | undefined / écoulé 4h / actif 1h (3) |
| feedCompanion | never-fed + perfect / cooldown actif / hated / remplace buff / immutabilité (5) |
| getActiveFeedBuff | futur retourné / expiré null / null-undefined (3) |

## Résultats `npx jest`

```
Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
Time:        2.018 s
```

## Deviations from Plan

None — plan exécuté exactement comme écrit. Les 20 tests dépassent le minimum ≥12 (RED phase initiale : 8 fail sur feedCompanion/getActiveFeedBuff, 12 pass sur helpers Plan 01 déjà implémentés).

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 4820c2b | test(42-03): suite Jest companion-feed (RED phase) |
| 2 | 452aa32 | feat(42-03): moteur feedCompanion pur + getActiveFeedBuff (GREEN) |

## Verification

- `grep -q "export function feedCompanion" lib/mascot/companion-engine.ts` — OK
- `grep -q "export function getActiveFeedBuff" lib/mascot/companion-engine.ts` — OK
- `grep -q "interface FeedResult" lib/mascot/companion-engine.ts` — OK
- `npx jest lib/__tests__/companion-feed.test.ts --no-coverage` — 20/20 passed
- `npx tsc --noEmit` — aucune nouvelle erreur dans companion-engine.ts

## Self-Check: PASSED

- FOUND: lib/mascot/companion-engine.ts (feedCompanion + getActiveFeedBuff + FeedResult)
- FOUND: lib/__tests__/companion-feed.test.ts (20 tests)
- FOUND: commit 4820c2b (RED)
- FOUND: commit 452aa32 (GREEN)
