---
phase: 08-progression-ferme
plan: 01
subsystem: gamification
tags: [tech-tree, farm, pure-functions, persistence, i18n]

requires:
  - phase: 07-craft
    provides: farm-engine, building-engine, craft-engine, useFarm hook, writeProfileField pattern
provides:
  - TECH_TREE definition with 10 nodes across 3 branches
  - getTechBonuses pure function for bonus aggregation
  - canUnlockTech/unlockTechNode pure functions
  - advanceFarmCrops with optional techBonuses parameter
  - collectBuilding with optional techBonuses parameter
  - getExpandedCropCells/getExpandedBuildingCells for expansion zones
  - getAvailableCrops/getEffectiveHarvestReward for tech-aware farm logic
  - farmTech persistence in Profile via parser
  - unlockTech action in useFarm hook
  - Sunflower crop gated behind culture-3 tech
  - Complete fr/en i18n for tech tree
affects: [08-02-PLAN, tree.tsx, WorldGridView.tsx, CraftSheet.tsx]

tech-stack:
  added: []
  patterns: [optional-techBonuses-parameter, tech-gated-content]

key-files:
  created:
    - lib/mascot/tech-engine.ts
  modified:
    - lib/mascot/types.ts
    - lib/mascot/farm-engine.ts
    - lib/mascot/building-engine.ts
    - lib/mascot/world-grid.ts
    - lib/types.ts
    - lib/parser.ts
    - hooks/useFarm.ts
    - locales/fr/common.json
    - locales/en/common.json

key-decisions:
  - "TechBonuses passe en parametre optionnel (pas de couplage direct tech-engine dans farm/building)"
  - "Coins lus depuis profiles context (merge gami) et non depuis parseFamille (qui n'a pas coins)"

patterns-established:
  - "Optional TechBonuses param: fonctions existantes gardent leur signature backward-compatible avec parametre optionnel"
  - "Tech-gated content: CropDefinition.techRequired optionnel filtre via getAvailableCrops"

requirements-completed: [PRO-01, PRO-02, PRO-03]

duration: 5min
completed: 2026-03-29
---

# Phase 08 Plan 01: Moteur Tech Tree Ferme Summary

**Moteur pur tech tree ferme avec 3 branches (Culture/Elevage/Expansion), bonus integres dans farm-engine et building-engine, parcelles d'extension dans world-grid, persistence farm_tech dans profil**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T20:33:27Z
- **Completed:** 2026-03-29T20:38:27Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- tech-engine.ts complet avec 10 noeuds, 3 branches, 5 fonctions pures exportees
- farm-engine et building-engine appliquent les bonus tech dynamiquement via parametre optionnel
- world-grid etendu avec 5 parcelles crop, 1 building, 1 parcelle geante conditionnelles
- Persistence farm_tech en CSV dans famille.md, parsing complet dans parser.ts
- unlockTech disponible dans useFarm pour le deblocage avec deduction de feuilles
- i18n fr/en complet pour le tech tree (30+ cles)

## Task Commits

Each task was committed atomically:

1. **Task 1: Creer tech-engine.ts avec TECH_TREE, bonus, et logique de deblocage** - `1dd2ee5` (feat)
2. **Task 2: Integrer bonus tech dans farm-engine, building-engine, world-grid + persistence** - `5a73954` (feat)

## Files Created/Modified
- `lib/mascot/tech-engine.ts` - Moteur pur tech tree : TECH_TREE, TechNode, TechBonuses, fonctions de deblocage et calcul bonus
- `lib/mascot/types.ts` - Ajout techRequired optionnel a CropDefinition + sunflower dans CROP_CATALOG
- `lib/mascot/farm-engine.ts` - advanceFarmCrops avec techBonuses, getEffectiveHarvestReward, getAvailableCrops
- `lib/mascot/building-engine.ts` - getPendingResources et collectBuilding avec techBonuses optionnel
- `lib/mascot/world-grid.ts` - EXPANSION_CROP_CELLS, EXPANSION_BUILDING_CELL, EXPANSION_LARGE_CROP_CELL, getExpandedCropCells, getExpandedBuildingCells
- `lib/types.ts` - farmTech?: string[] dans Profile
- `lib/parser.ts` - Parsing farm_tech CSV dans parseFamille
- `hooks/useFarm.ts` - Action unlockTech avec validation prerequis et deduction feuilles
- `locales/fr/common.json` - Section tech complete + farm.crop.sunflower
- `locales/en/common.json` - Section tech complete + farm.crop.sunflower

## Decisions Made
- TechBonuses passe en parametre optionnel aux fonctions existantes pour garder la backward-compatibility (pas de breaking change)
- Coins pour unlockTech lus depuis le contexte profiles (merge gamification) plutot que parseFamille qui ne contient pas les champs gamification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fix acces coins dans unlockTech**
- **Found during:** Task 2 (integration useFarm)
- **Issue:** parseFamille retourne les profils sans le champ coins (qui vient de gamification.md), causant une erreur TS2339
- **Fix:** Utiliser profiles du contexte useVault (qui merge les donnees gami) pour obtenir les coins
- **Files modified:** hooks/useFarm.ts
- **Verification:** npx tsc --noEmit passe sans nouvelles erreurs
- **Committed in:** 5a73954 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix necessaire pour la compilation. Pas de scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tout le backend/logique est pret pour Plan 02 (UI tech tree)
- Les fonctions sont toutes pures et testables
- L'UI pourra importer directement TECH_TREE, getTechBonuses, canUnlockTech
- Les bonus s'appliquent deja si le profil a des techs debloquees

---
*Phase: 08-progression-ferme*
*Completed: 2026-03-29*
