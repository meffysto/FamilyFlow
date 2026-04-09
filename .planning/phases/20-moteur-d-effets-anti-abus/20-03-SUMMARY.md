---
phase: 20-moteur-d-effets-anti-abus
plan: 03
subsystem: gamification
tags: [semantic-coupling, effects, caps, gamification, farm, saga, companion]

requires:
  - phase: 20-01
    provides: applyTaskEffect dispatcher + EffectResult type + 10 handlers synchrones
  - phase: 20-02
    provides: loadCaps/saveCaps/isCapExceeded/incrementCap + CouplingCaps SecureStore
  - phase: 19
    provides: deriveTaskCategory + isSemanticCouplingEnabled + feature flag

provides:
  - completeTask câblé avec dispatcher d'effets sémantiques, caps anti-abus, multiplier urgent, Double Loot Cascade
  - EFFECTS-07: sagaTraitDelta appliqué à la SagaProgress active via SecureStore
  - EFFECTS-04: companionEvent propagé dans CompanionData.lastEventType/lastEventAt
  - EFFECTS-03: Building Turbo consommé dans collectBuildingResources + collectPassiveIncome
  - EFFECTS-08: Capacity Boost consommé dans checkWear (effectiveCapacityMultiplier)
  - EFFECTS-09: Golden Harvest consommé dans harvest (finalQty x3, reset flag)
  - SEMANTIC-08: tag #urgent active multiplier x2 pour 5 taches
  - SEMANTIC-09: streak >7j déclenche Double Loot Cascade
  - Un seul write farm-{id}.md par completeTask (Pitfall 2 respecté)
  - Signature completeTask backward-compatible (taskMeta? optionnel)

affects: [phase-21, phase-22, phase-23, phase-24, useGamification, useFarm]

tech-stack:
  added: []
  patterns:
    - "taskMeta? optionnel pour enrichir sans casser les appelants existants"
    - "Bloc semantic try/catch non-critical — zéro impact si feature flag off"
    - "Un seul write farm-{id}.md par completeTask (crops + effets combinés)"
    - "Bonus temporels conditionnés par comparaison de date ISO — zéro impact si champ absent"
    - "Double Loot Cascade: updateProfileInData + cascade sur newData (pas newData de openLootBox qui n'existe pas)"

key-files:
  created: []
  modified:
    - hooks/useGamification.ts
    - hooks/useFarm.ts
    - lib/mascot/companion-types.ts

key-decisions:
  - "completeTask signature: taskMeta? optionnel (backward-compatible) — garder taskText pour ne casser aucun appelant"
  - "Double Loot Cascade utilise updateProfileInData(newData, cascadeResult.profile, cascadeResult.entries) car openLootBox ne retourne pas newData"
  - "Golden Harvest branch séparée dans harvest: early return avec vault.writeFile direct pour persister nextHarvestGolden=false proprement"
  - "Building Turbo multiplié sur productionBoost (variable locale) — appliqué dans les deux sites collectBuildingResources ET collectPassiveIncome"
  - "lastEventType/lastEventAt ajoutés optionnellement sur CompanionData — rendu Phase 21, storage Phase 20"

patterns-established:
  - "Semantic coupling try/catch non-critical: erreurs silencieuses sauf __DEV__ console.warn"
  - "Saga trait delta: loadSagaProgress -> check status === active -> traitKey in traits -> increment -> saveSagaProgress"
  - "Companion event propagation: effectResult.companionEvent && farmData.companion -> spread avec lastEventType/lastEventAt"

requirements-completed: [SEMANTIC-08, SEMANTIC-09, EFFECTS-04, EFFECTS-07]

duration: 15min
completed: 2026-04-09
---

# Phase 20 Plan 03: Wiring completeTask + bonus temporels useFarm Summary

**completeTask câblé avec dispatcher sémantique (flag check -> derive -> cap check -> apply -> save), multiplier urgent x2/5 taches (SEMANTIC-08), Double Loot Cascade streak >7j (SEMANTIC-09), saga trait et companion event propagés (EFFECTS-04/07), et 3 bonus temporels consommés dans useFarm (EFFECTS-03/08/09)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-09T09:12:14Z
- **Completed:** 2026-04-09T09:21:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `completeTask` dans `useGamification.ts` intègre le pipeline complet : feature flag → derive category → cap check → applyTaskEffect → saveCaps → saga trait delta → companion event propagation — tout en gardant un seul `vault.writeFile(fp,` pour farm
- Multiplier urgent x2 pour 5 tâches activé automatiquement quand `taskMeta?.tags?.includes('urgent')` et aucun multiplier actif (SEMANTIC-08)
- Double Loot Cascade déclenché quand streak >7j et loot accordé — second `doOpenLootBox` fusionné dans `newData` (SEMANTIC-09)
- Bonus temporels EFFECTS-03/08/09 consommés dans `useFarm.ts` aux bons points d'injection, sans restructuration du hook

## Task Commits

1. **Task 1: Enrichir completeTask avec dispatcher + caps + urgent + streak + saga + companion** - `51c1a07` (feat)
2. **Task 2: Consommer les bonus temporels dans useFarm** - `f7f04ad` (feat)

## Files Created/Modified

- `hooks/useGamification.ts` — completeTask câblé avec dispatcher sémantique, caps anti-abus, multiplier urgent, Double Loot Cascade, saga trait delta, companion event propagation, un seul write farm
- `hooks/useFarm.ts` — Building Turbo (EFFECTS-03) dans collectBuildingResources/collectPassiveIncome, Capacity Boost (EFFECTS-08) dans checkWear, Golden Harvest (EFFECTS-09) dans harvest
- `lib/mascot/companion-types.ts` — Ajout `lastEventType?` et `lastEventAt?` optionnels sur `CompanionData` (EFFECTS-04)

## Decisions Made

- `taskMeta?` optionnel dans la signature — garder `taskText` tel quel pour ne casser aucun appelant existant. Les appelants passent `taskMeta` uniquement quand ils disposent des métadonnées (tags, section, sourceFile)
- Double Loot Cascade : `openLootBox` (engine) ne retourne pas `newData` directement — utiliser `updateProfileInData(newData, cascadeResult.profile, cascadeResult.entries)` pour fusionner correctement
- Golden Harvest branch séparée dans `harvest` : early return avec `vault.writeFile` direct pour persister `nextHarvestGolden = false` en même temps que crops et harvest inventory, sans ajouter une deuxième écriture
- Building Turbo appliqué sur `productionBoost` (variable locale) dans les DEUX sites de collect — cohérence entre collecte manuelle et passive income

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] openLootBox ne retourne pas newData**
- **Found during:** Task 1 (completeTask Double Loot Cascade)
- **Issue:** Le plan spécifiait `cascadeResult.newData.profiles` etc., mais `openLootBox` dans `lib/gamification/engine.ts` retourne `{ box, profile, entries, newActiveRewards, extraLootBoxes }` sans `newData`
- **Fix:** Utiliser `updateProfileInData(newData, cascadeResult.profile, cascadeResult.entries)` + merge `newActiveRewards` séparément — pattern identique à ce qui est déjà fait dans `openLootBox` callback
- **Files modified:** hooks/useGamification.ts
- **Verification:** `npx tsc --noEmit` sans erreur sur useGamification.ts
- **Committed in:** 51c1a07 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug dans le plan)
**Impact on plan:** Correction mineure, comportement identique à ce qui était spécifié.

## Issues Encountered

- Conflict de merge sur STATE.md résolu manuellement (worktree parallèle)

## Known Stubs

Aucun stub — les données sont câblées jusqu'à la persistance. Le rendu visuel (toasts, animations HarvestBurst, messages compagnon) est intentionnellement différé à Phase 21.

## Next Phase Readiness

- Phase 21 (Feedback visuel + compagnon) peut lire `effectResult` dans le retour de `completeTask` et afficher les toasts/haptics/animations
- `farmData.companion.lastEventType` disponible pour le mood spike animation
- `effectResult.message` disponible pour les toasts (seedId ou recipeId droppé)
- Tous les 10 effets sont câblés et persistés — Phase 22 (UI config) peut afficher les stats via `loadCaps`

---
*Phase: 20-moteur-d-effets-anti-abus*
*Completed: 2026-04-09*
