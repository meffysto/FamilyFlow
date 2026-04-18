---
phase: 41-polish-onboarding-codex-non-r-gression
plan: 01
subsystem: ferme
tags: [sporée, wager, farm, jest, types, parser]

# Dependency graph
requires:
  - phase: 40-ui-spor-e-seed-picker-badge-validation
    provides: branche harvest wager avec validateWagerOnHarvest + rollWagerDropBack + fieldsToWrite pattern
  - phase: 38-fondation-modifiers-economie-spor-e
    provides: FarmProfileData shape, parseFarmProfile/serializeFarmProfile, sporee-economy
provides:
  - Champ wagerMarathonWins?: number dans FarmProfileData (lib/types.ts)
  - Parser wager_marathon_wins dans parseFarmProfile + setFarmField (lib/parser.ts, hooks/useFarm.ts)
  - Serializer wager_marathon_wins dans serializeFarmProfile (lib/parser.ts)
  - Incrément atomique wagerMarathonWins dans harvest wager.won (hooks/useFarm.ts)
  - Persistance via deux branches (golden spread + fieldsToWrite non-golden)
  - Suite Jest étendue: 9 nouveaux tests (4 parsing + 5 incrément), 35 total
affects: [41-03-FarmCodexModal, Plan03-codex-UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compteur vanité via champ optionnel never-reset dans FarmProfileData (jamais décrémenté)"
    - "Incrément atomique dans writeFile existant via marathonIncremented boolean flag"
    - "Double-branche persistance golden (spread) / non-golden (fieldsToWrite) identique au pattern sporeeCount"

key-files:
  created: []
  modified:
    - lib/types.ts
    - lib/parser.ts
    - hooks/useFarm.ts
    - lib/__tests__/useFarm-wager.test.ts

key-decisions:
  - "Serializer conditionnel wagerMarathonWins > 0 uniquement (comme sporeeCount) — évite bruit dans vault pour count = 0"
  - "marathonIncremented flag déclaré hors du bloc if(wager) — permet les deux branches golden/non-golden d'y accéder"
  - "Tests de l'incrément via logique pure (arithmetic + validateWagerOnHarvest) sans instancier le hook React"

patterns-established:
  - "Compteur vanité SPOR-10: wager_marathon_wins dans vault, wagerMarathonWins en mémoire — jamais reset, jamais pénalisé"

requirements-completed: [SPOR-10]

# Metrics
duration: 8min
completed: 2026-04-19
---

# Phase 41 Plan 01: wagerMarathonWins fondation data + parser + incrément harvest Summary

**Champ vanité wagerMarathonWins persisté dans le vault via incrément atomique dans la branche harvest wager.won de useFarm, avec parser/serializer round-trip et 9 nouveaux tests Jest verts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-19T00:00:00Z
- **Completed:** 2026-04-19T00:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Champ `wagerMarathonWins?: number` ajouté à `FarmProfileData` avec commentaire Phase 41 SPOR-10
- Parser `wager_marathon_wins` dans `parseFarmProfile` (lib/parser.ts) et `setFarmField` (hooks/useFarm.ts) — round-trip sans perte
- Serializer conditionnel dans `serializeFarmProfile` (n'écrit que si > 0, cohérent avec sporeeCount)
- Incrément `profile.wagerMarathonWins = (... ?? 0) + 1` dans la branche `if (validation.won)` — zéro touche sur défaite ou plant non scellé
- Persistance atomique dans le même writeFile via deux branches (golden spread + fieldsToWrite non-golden) via flag `marathonIncremented`
- 9 nouveaux tests Jest: 4 parsing (round-trip, NaN, 0, absent) + 5 incrément (won/lost/no-wager/initial-5/fieldsToWrite), 35 total, 0 failing

## Task Commits

1. **Task 1: Ajouter wagerMarathonWins à FarmProfileData + parser field** - `2d1d171` (feat)
2. **Task 2: Incrémenter wagerMarathonWins dans la branche harvest wager.won** - `72b6d40` (feat)

## Files Created/Modified

- `lib/types.ts` — Champ `wagerMarathonWins?: number` dans FarmProfileData après wagerLastRecomputeDate
- `lib/parser.ts` — Parse `wager_marathon_wins` dans parseFarmProfile + serialize conditionnel dans serializeFarmProfile
- `hooks/useFarm.ts` — Case `wager_marathon_wins` dans setFarmField + incrément + marathonIncremented + 2 branches persistance
- `lib/__tests__/useFarm-wager.test.ts` — Import parseFarmProfile, 9 nouveaux tests dans 2 describe blocks

## Decisions Made

- Serializer écrit `wager_marathon_wins` seulement si `> 0` (comme sporeeCount) — évite une ligne parasite dans le vault pour les profils à 0 victoire
- Flag `marathonIncremented` déclaré en dehors de `if (wager)` pour être accessible dans les deux branches de persistance golden/non-golden — même pattern que wagerDropBack
- Tests de l'incrément rédigés en logique pure sans instancier useFarm — cohérent avec l'approche de la suite Phase 40-04

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Fondation data SPOR-10 livrée (types + parser + incrément + persistance)
- Plan 03 (FarmCodexModal) peut consommer `profile.wagerMarathonWins` directement depuis parseFarmProfile
- Aucun stub — champ parsé correctement, incrément atomique, round-trip vérifié

---
*Phase: 41-polish-onboarding-codex-non-r-gression*
*Completed: 2026-04-19*
