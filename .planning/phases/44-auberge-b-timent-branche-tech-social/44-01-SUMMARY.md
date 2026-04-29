---
phase: 44-auberge-b-timent-branche-tech-social
plan: 01
subsystem: mascot/farm
tags: [refacto, building-engine, types, tests, retrocompat]
requires: []
provides:
  - "BuildingDefinition.producesResource?: boolean"
  - "Court-circuit dans 3 fonctions productrices building-engine"
affects:
  - lib/mascot/types.ts
  - lib/mascot/building-engine.ts
  - lib/__tests__/building-engine-non-productive.test.ts
tech-stack:
  added: []
  patterns:
    - "Garde optionnelle default-treat undefined === true (rétrocompat stricte)"
    - "push/splice BUILDING_CATALOG en beforeAll/afterAll Jest pour fake fixture"
key-files:
  created:
    - lib/__tests__/building-engine-non-productive.test.ts
  modified:
    - lib/mascot/types.ts
    - lib/mascot/building-engine.ts
decisions:
  - "Garde producesResource === false placée APRÈS le check !def, AVANT tout calcul tier/wear/multiplicateurs"
  - "getUpgradeCost et canUpgrade volontairement non touchés — l'auberge sera upgradable même non-productive"
  - "BUILDING_CATALOG existant non modifié — les 4 bâtiments (poulailler/grange/moulin/ruche) gardent leur comportement par absence du champ (undefined === true)"
  - "Test fixture FAKE_DEF push/splice in-test plutôt que dépendre de Plan 02 (l'auberge sera ajoutée plus tard)"
metrics:
  duration: "~10min"
  completed: 2026-04-29
---

# Phase 44 Plan 01: Refacto producesResource + court-circuit building-engine Summary

Refacto rétrocompatible de `BuildingDefinition` exposant un nouveau champ optionnel `producesResource?: boolean` (default-treat `undefined === true`), avec garde inline dans les 3 fonctions productrices de `building-engine.ts`. Plan « interface-first » qui débloque les Plans 02 (ajout entrée auberge) et 04 (UI gracieuse).

## What Was Built

### 1. Champ `producesResource?: boolean` dans `BuildingDefinition`
Ajouté en fin d'interface (`lib/mascot/types.ts:431-433`) avec JSDoc FR. Optionnel, default-treat `undefined === true` — les 4 entrées existantes du `BUILDING_CATALOG` (poulailler, grange, moulin, ruche) restent inchangées et continuent de produire normalement.

### 2. Court-circuit dans 3 fonctions de `building-engine.ts`
Une garde unique `if (def.producesResource === false) return 0;` (ou no-op équivalent) ajoutée juste après le check `if (!def)` :
- **`getPendingResources`** ligne 150 — retourne `0`
- **`getMinutesUntilNext`** ligne 177 — retourne `0`
- **`collectBuilding`** ligne 211 — retourne `{ buildings, inventory, collected: 0 }` sans mutation

`getUpgradeCost` et `canUpgrade` volontairement non modifiés — l'Auberge restera upgradable même si non-productive.

### 3. Tests Jest non-régression
Nouveau fichier `lib/__tests__/building-engine-non-productive.test.ts` avec 4 tests verts :
1. `getPendingResources` → 0 pour fake non-productif (48h écoulées)
2. `getMinutesUntilNext` → 0 pour fake non-productif
3. `collectBuilding` → no-op (`collected: 0`, inventory et buildings inchangés)
4. **Rétrocompat** : poulailler (sans flag) produit toujours > 0 après 24h

Le fake `FAKE_DEF` est push/splice en `beforeAll`/`afterAll` pour ne pas polluer `BUILDING_CATALOG` entre suites.

## Verification

| Check | Result |
|-------|--------|
| `grep "producesResource?: boolean" lib/mascot/types.ts` | 1 occurrence (interface) |
| `grep -c "def.producesResource === false" lib/mascot/building-engine.ts` | 3 (une par fonction productrice) |
| `npx tsc --noEmit` (mes changements isolés) | clean (pas de nouvelle erreur) |
| `npx jest building-engine-non-productive` | 4/4 passed |
| BUILDING_CATALOG existant non modifié | confirmé (rétrocompat stricte) |

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | 9334fb7 | `feat(44-01): flag producesResource + court-circuit dans building-engine` |
| 2 | d44ddc0 | `test(44-01): non-régression court-circuit producesResource` |

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Notes

- **Wave parallèle** : Plan 44-03 (parallel wave) modifie `lib/mascot/tech-engine.ts` simultanément ; mes commits ne touchent strictement que `types.ts`, `building-engine.ts`, et le nouveau fichier de tests.
- **CACHE_VERSION untouched** comme requis (le cache exclut déjà jardin/ferme/mascotte).
- **Pas d'ajout de l'auberge à BUILDING_CATALOG** — c'est explicitement le périmètre du Plan 02.
- **TS baseline préservé** : la validation `npx tsc --noEmit` faite avec mes changements isolés (sans les changements en cours du Plan 44-03) passe sans erreur.

## Self-Check: PASSED

- lib/mascot/types.ts → producesResource?: boolean présent
- lib/mascot/building-engine.ts → 3 occurrences `def.producesResource === false`
- lib/__tests__/building-engine-non-productive.test.ts → 4 tests verts
- Commit 9334fb7 → présent dans `git log`
- Commit d44ddc0 → présent dans `git log`
