---
phase: 20-moteur-d-effets-anti-abus
plan: "01"
subsystem: semantic-effects
tags: [effects, semantic-coupling, farm, dispatcher, types, parser]
dependency_graph:
  requires: [19-01, 19-02]
  provides: [applyTaskEffect, EffectId, EffectResult, EFFECT_GOLDEN_MULTIPLIER, FarmProfileData-extended]
  affects: [lib/semantic/index.ts, lib/types.ts, lib/parser.ts]
tech_stack:
  added: []
  patterns: [pure-sync-dispatcher, exhaustive-switch, immutable-farmdata-mutation]
key_files:
  created:
    - lib/semantic/effects.ts
  modified:
    - lib/types.ts
    - lib/parser.ts
    - lib/semantic/index.ts
decisions:
  - "Dispatcher applyTaskEffect() synchrone (deviation délibérée RESEARCH.md) — handlers purs sans I/O, async réservé aux caps (Plan 02)"
  - "handleSagaTraitBoost retourne trait 'générosité' (SagaTrait valide) et non 'joy' inexistant"
  - "EFFECT_GOLDEN_MULTIPLIER = 3 (constante runtime non persistée, distincte de GOLDEN_HARVEST_MULTIPLIER = 5)"
  - "repairWearEvent appelé avec Infinity comme currentCoins — contourne la garde coins pour les effets gratuits"
metrics:
  duration: 3min
  completed: "2026-04-09"
  tasks_completed: 2
  files_changed: 4
---

# Phase 20 Plan 01: Moteur d'effets — dispatcher + types + parser — Summary

Dispatcher pur `applyTaskEffect()` avec 10 handlers d'effets wow, `FarmProfileData` étendu avec 5 champs temporels persistables, parser mis à jour pour lire/écrire ces champs.

## What Was Built

### lib/semantic/effects.ts (nouveau)

Module 100% pur (zéro I/O, zéro vault, zéro hooks) contenant :

- Type `EffectId` — 10 valeurs alignées sur EFFECTS-01..10
- Interface `EffectResult` — `effectApplied`, `farmData`, `sagaTraitDelta?`, `companionEvent?`, `message?`
- Constante `EFFECT_GOLDEN_MULTIPLIER = 3` (×3 harvest golden, distincte du GOLDEN_HARVEST_MULTIPLIER = 5)
- `CATEGORY_EFFECT_MAP` — mapping Record<CategoryId, EffectId> (SEMANTIC-06 : 10 paires 1:1)
- 10 fonctions handler locales pures
- `applyTaskEffect(match, farmData, now?)` — dispatcher synchrone avec switch exhaustif

### lib/types.ts (étendu)

`FarmProfileData` étendu avec 6 nouveaux champs :
- `buildingTurboUntil?: string` — EFFECTS-03
- `growthSprintUntil?: string` — EFFECTS-05
- `capacityBoostUntil?: string` — EFFECTS-08
- `nextHarvestGolden?: boolean` — EFFECTS-09
- `unlockedEffectRecipes?: string[]` — EFFECTS-10
- `effectGoldenMultiplier?: number` — constante runtime, non persistée

### lib/parser.ts (étendu)

`parseFarmProfile()` : lit les 5 champs persistables depuis farm-{profileId}.md.
`serializeFarmProfile()` : écrit les 5 champs si non-vides.

### lib/semantic/index.ts (mis à jour)

Re-exports publics ajoutés : `applyTaskEffect`, `EFFECT_GOLDEN_MULTIPLIER`, `EffectId`, `EffectResult`.

## Decisions Made

| Decision | Raison |
|----------|--------|
| Dispatcher synchrone (deviation RESEARCH.md) | Tous les handlers sont des mutations de données pures sans I/O — l'async n'est nécessaire que pour les caps (Plan 02) et le feature flag (Plan 03) |
| `repairWearEvent` avec `Infinity` comme currentCoins | Contourne la garde coins — les effets ferme sont gratuits (les coins normaux ne sont pas consommés) |
| `'générosité'` dans sagaTraitBoost | Seul trait SagaTrait valide aligné avec la thématique gratitude/famille |
| `effectGoldenMultiplier` non persisté | C'est une constante runtime (3), pas une valeur variable |

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1 — FarmProfileData + parser | e4d0f2f | lib/types.ts, lib/parser.ts |
| Task 2 — effects.ts + index.ts | d5458ad | lib/semantic/effects.ts, lib/semantic/index.ts |

## Deviations from Plan

None — plan exécuté exactement comme écrit. La note architecturale sur le dispatch synchrone était déjà documentée dans le plan (deviation délibérée de RESEARCH.md).

## Known Stubs

None — tous les handlers produisent des mutations FarmProfileData réelles. Les handlers EFFECTS-04 (companion_mood) et EFFECTS-07 (saga_trait_boost) retournent des champs `companionEvent`/`sagaTraitDelta` qui seront consommés par Plan 03 (wiring) et Phase 21 (UI), ce qui est intentionnel et documenté dans le plan.

## Self-Check: PASSED

- lib/semantic/effects.ts: FOUND
- lib/types.ts contains buildingTurboUntil: FOUND
- lib/parser.ts contains building_turbo_until (×2): FOUND
- Commits e4d0f2f, d5458ad: FOUND
- `npx tsc --noEmit` : zéro nouvelle erreur dans les fichiers modifiés
