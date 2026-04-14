---
phase: 33-exp-ditions
plan: 01
subsystem: mascot
tags: [expedition, csv, parser, timer, pity, loot, deterministic-pool]

# Dependency graph
requires: []
provides:
  - "ExpeditionDifficulty, ExpeditionOutcome, ActiveExpedition types dans lib/types.ts"
  - "FarmProfileData etendu: activeExpeditions + expeditionPity"
  - "parseActiveExpeditions + serializeActiveExpeditions (round-trip CSV)"
  - "parseFarmProfile / serializeFarmProfile integres pour les expeditions"
  - "lib/mascot/expedition-engine.ts: EXPEDITION_CATALOG (9 missions), EXPEDITION_DROP_RATES, timer, roll probabiliste, pity, pool quotidien"
affects:
  - 33-02 (hook useExpeditions)
  - 33-03 (UI modal expeditions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSV expedition: missionId:difficulty:ISO_startedAt:durationHours:result|... — pattern slice(2, length-2).join(':') pour ISO date avec ':'"
    - "LCG pseudo-random seed date-based pour pool quotidien deterministe"
    - "Pity system pityCount >= 5 garantit success (identique rewards.ts PITY_THRESHOLD)"
    - "Timer pattern isExpeditionComplete / getExpeditionRemainingMinutes (building-engine.ts)"

key-files:
  created:
    - lib/mascot/expedition-engine.ts
    - lib/__tests__/expedition-engine.test.ts
    - lib/__tests__/expedition-parser.test.ts
  modified:
    - lib/types.ts
    - lib/parser.ts

key-decisions:
  - "CSV expedition separe par '|' entre missions, ':' entre champs — ISO date reconstruite via slice(2, length-2).join(':') identiquement au pattern building-engine.ts"
  - "EXPEDITION_DROP_RATES easy: 60/25/12/3, medium: 40/30/20/10, hard: 25/25/30/20 — plus de variance sur hard"
  - "Pool LCG avec seed=parseInt(YYYYMMDD) sans tirets + offset par difficulte — garanti deterministe et varie par jour"
  - "failure et partial retournent undefined pour rollExpeditionLoot — perte totale pattern OGame"

patterns-established:
  - "Pity expedition: pityCount >= 5 dans rollExpeditionResult, identique PITY_THRESHOLD rewards.ts"
  - "Timer expedition: isExpeditionComplete(exp, now) + getExpeditionRemainingMinutes — pattern building-engine.ts lastCollectAt"

requirements-completed: [VILL-16, VILL-18, VILL-19, VILL-20]

# Metrics
duration: 10min
completed: 2026-04-14
---

# Phase 33 Plan 01: Types + Parser CSV + Expedition Engine Summary

**Couche data expeditions complete : types ActiveExpedition, serialisation CSV round-trip dans farm-{id}.md, moteur algorithmique pur avec catalogue 9 missions, roll probabiliste par difficulte, pity system 5-echecs, pool quotidien deterministe LCG, 29 tests unitaires passent**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-14T21:16:43Z
- **Completed:** 2026-04-14T21:26:54Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Types `ExpeditionDifficulty`, `ExpeditionOutcome`, `ActiveExpedition` exportes dans lib/types.ts + `FarmProfileData` etendu avec `activeExpeditions` et `expeditionPity`
- `parseActiveExpeditions` / `serializeActiveExpeditions` en CSV round-trip, integres dans `parseFarmProfile` et `serializeFarmProfile` — les expeditions actives survivent un restart via farm-{id}.md
- `expedition-engine.ts` complet avec catalogue 9 missions thematiques, taux de drop calibres par difficulte, pity system, pool deterministe LCG, helpers cout

## Task Commits

1. **Task 1: Types ActiveExpedition + extensions FarmProfileData + parser CSV** - `c7037e8` (feat)
2. **Task 2: Expedition Engine — catalogue, roll, timer, pity, pool quotidien** - `a2d277d` (feat)

## Files Created/Modified
- `lib/types.ts` — ExpeditionDifficulty, ExpeditionOutcome, ActiveExpedition + champs FarmProfileData
- `lib/parser.ts` — parseActiveExpeditions, serializeActiveExpeditions, integration parseFarmProfile/serializeFarmProfile
- `lib/mascot/expedition-engine.ts` — moteur pur complet (catalogue, drop rates, loot table, timer, roll, pity, pool LCG)
- `lib/__tests__/expedition-engine.test.ts` — 22 tests unitaires (timer, roll, pity, pool, canAfford)
- `lib/__tests__/expedition-parser.test.ts` — 7 tests CSV (parse, serialize, round-trip)

## Decisions Made
- Pattern `slice(2, parts.length - 2).join(':')` pour reconstruire le ISO date contenant des ':' — identique building-engine.ts ligne 68
- Pool LCG avec offset par difficulte (i+1) pour eviter collisions entre easy/medium/hard ayant le meme seed
- `failure` et `partial` retournent `undefined` dans `rollExpeditionLoot` — perte totale OGame-style
- Catalogue 9 missions avec destinations thematiques : Foret Ancienne, Riviere Cristalline, Prairie Fleurie (easy) / Sommets Brumeux, Profondeurs Marines, Cavernes Cristallines (medium) / Cratere Ardent, Toundra Glaciaire, Archipel des Nuages (hard)

## Deviations from Plan

None - plan execute exactement comme ecrit.

## Issues Encountered

None.

## User Setup Required

None - aucune configuration externe requise.

## Next Phase Readiness

- Plan 02 peut implementer `useExpeditions` hook en important directement depuis `expedition-engine.ts` et `parser.ts`
- Plan 03 (UI) peut consommer `EXPEDITION_CATALOG`, `getDailyExpeditionPool`, `isExpeditionComplete`, `getExpeditionRemainingMinutes` sans reimplementer la logique
- Types complets exportes depuis `lib/types.ts` — aucune inference de type manquante

---
*Phase: 33-exp-ditions*
*Completed: 2026-04-14*

## Self-Check: PASSED

All created files found on disk. All commits (c7037e8, a2d277d) verified in git log.
