---
phase: 07-craft
plan: 01
subsystem: gamification
tags: [craft, farm, inventory, serialization, tdd]

# Dependency graph
requires:
  - phase: 06-batiments-productifs
    provides: FarmInventory, building-engine serialize/parse, useFarm hook
provides:
  - CraftRecipe, CraftedItem, HarvestInventory types
  - craft-engine.ts avec 4 recettes et fonctions craft/sell/serialize
  - harvestCrop refactore vers inventaire (plus de reward direct)
  - useFarm avec actions craft, sellHarvest, sellCrafted
  - Parser etendu pour farm_harvest_inventory et farm_crafted_items
affects: [07-02-craft-ui, tree-screen, gamification]

# Tech tracking
tech-stack:
  added: []
  patterns: [craft-recipe-catalog, harvest-to-inventory, atomic-multi-field-write]

key-files:
  created:
    - lib/mascot/craft-engine.ts
    - lib/__tests__/craft-engine.test.ts
  modified:
    - lib/mascot/types.ts
    - lib/mascot/farm-engine.ts
    - lib/types.ts
    - lib/parser.ts
    - hooks/useFarm.ts
    - app/(tabs)/tree.tsx
    - lib/__tests__/farm-engine.test.ts

key-decisions:
  - "harvestCrop ne donne plus de feuilles directement — les recoltes vont en inventaire pour permettre craft ou vente"
  - "BUILDING_RESOURCE_VALUE (oeuf:30, lait:50, farine:40) pour calculer la sellValue des recettes utilisant des ressources batiment"
  - "writeProfileFields atomique pour ecrire plusieurs champs en une seule operation fichier"

patterns-established:
  - "Craft recipe catalog: CRAFT_RECIPES array avec ingredients, sellValue, xpBonus"
  - "Harvest inventory: HarvestInventory[cropId] = count, serialise en CSV cropId:count"
  - "Atomic multi-field write: writeProfileFields() pour eviter race conditions entre champs lies"

requirements-completed: [CRA-01, CRA-02, CRA-03]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 07 Plan 01: Systeme de Craft Summary

**Moteur de craft avec 4 recettes (confiture/gateau/omelette/bouquet), harvestCrop refactore vers inventaire, et actions craft/sell dans useFarm**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T19:36:53Z
- **Completed:** 2026-03-29T19:42:17Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- 4 recettes de craft definies avec ingredients (crop + building resources) et sellValue calcule
- harvestCrop ne donne plus de feuilles directement — les recoltes vont en inventaire
- useFarm expose craft, sellHarvest, sellCrafted pour l'UI
- 28 tests unitaires pour craft-engine, tous passent
- Parser etendu pour persister harvestInventory et craftedItems dans famille.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Types craft + craft-engine.ts + tests unitaires (TDD)**
   - `0db192f` (test: RED — tests failing)
   - `605f124` (feat: GREEN — implementation + tests passent)
2. **Task 2: Refactorer harvestCrop + parser + useFarm craft/sell** - `7083435` (feat)

## Files Created/Modified
- `lib/mascot/craft-engine.ts` - Moteur de craft : 4 recettes, craftItem, sellCraftedItem, sellRawHarvest, serialize/parse
- `lib/mascot/types.ts` - Types CraftIngredient, CraftRecipe, CraftedItem, HarvestInventory
- `lib/mascot/farm-engine.ts` - harvestCrop retourne harvestedCropId au lieu de reward
- `lib/types.ts` - Profile etendu avec harvestInventory et craftedItems
- `lib/parser.ts` - Parse farm_harvest_inventory et farm_crafted_items dans parseFamille
- `hooks/useFarm.ts` - Refactored harvest + ajout craft, sellHarvest, sellCrafted, writeProfileFields
- `app/(tabs)/tree.tsx` - Callback harvest adapte au nouveau type de retour
- `lib/__tests__/craft-engine.test.ts` - 28 tests pour craft-engine
- `lib/__tests__/farm-engine.test.ts` - Tests harvestCrop mis a jour pour nouvelle signature

## Decisions Made
- harvestCrop ne calcule plus le reward — c'est le caller (useFarm) qui decide si vendre ou stocker en inventaire
- BUILDING_RESOURCE_VALUE assigne des valeurs aux ressources batiment (oeuf:30, lait:50, farine:40) pour le calcul de sellValue
- writeProfileFields() cree pour ecrire plusieurs champs famille.md en une seule operation atomique (evite les race conditions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mise a jour tests farm-engine.test.ts**
- **Found during:** Task 2
- **Issue:** Tests farm-engine existants referençaient result.reward qui n'existe plus apres le refactoring de harvestCrop
- **Fix:** Mis a jour les 4 tests harvestCrop pour utiliser harvestedCropId et isGolden
- **Files modified:** lib/__tests__/farm-engine.test.ts
- **Verification:** 50 tests passent (28 craft + 22 farm)
- **Committed in:** 7083435 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correction for test consistency after API change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Craft engine complet et teste, pret pour l'UI (plan 07-02)
- useFarm expose toutes les actions necessaires pour le craft screen
- Les donnees sont persistees dans famille.md via les nouveaux champs farm_harvest_inventory et farm_crafted_items

---
*Phase: 07-craft*
*Completed: 2026-03-29*
