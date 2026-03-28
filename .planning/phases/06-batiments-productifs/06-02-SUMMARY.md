---
phase: 06-batiments-productifs
plan: 02
subsystem: ui
tags: [react-native, reanimated, building-engine, farm, i18n, bottomsheet]

# Dependency graph
requires:
  - phase: 06-01
    provides: building-engine.ts, building-sprites.ts, types etendus (Plan 01 non execute — cree inline comme deviation Rule 3)

provides:
  - WorldGridView.tsx avec BuildingCell interactif (badge pending pulsant, sprite par niveau, onBuildingCellPress)
  - BuildingShopSheet.tsx (bottom sheet construction, filtrage stade/coins/possession)
  - BuildingDetailSheet.tsx (bottom sheet detail/collecte/amelioration, haptics)
  - tree.tsx integre (handlers, states, modals)
  - lib/mascot/building-engine.ts (constructBuilding, upgradeBuilding, collectBuilding, getPendingResources)
  - lib/mascot/building-sprites.ts (BUILDING_SPRITES par niveau)
  - types etendus PlacedBuilding, BuildingTier, ResourceType, FarmInventory
  - Migration backward-compatible farm_buildings CSV -> PlacedBuilding[]
  - hooks/useFarm.ts etendu (buyBuilding avec cellId, upgradeBuildingAction, collectBuildingResources)

affects:
  - 06-03
  - tree-screen
  - farm-system

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BuildingCell avec useSharedValue pulse animation quand pendingCount > 0"
    - "parseBuildings() backward-compatible: gere string[], CSV simple, et nouveau format"
    - "Bottom sheets batiments: pageSheet + drag-to-dismiss via Modal transparent"
    - "Haptics.impactAsync(Medium) sur la collecte de ressources"

key-files:
  created:
    - lib/mascot/building-engine.ts
    - lib/mascot/building-sprites.ts
    - components/mascot/BuildingShopSheet.tsx
    - components/mascot/BuildingDetailSheet.tsx
  modified:
    - lib/mascot/types.ts
    - lib/mascot/world-grid.ts
    - lib/types.ts
    - lib/parser.ts
    - hooks/useFarm.ts
    - components/mascot/WorldGridView.tsx
    - app/(tabs)/tree.tsx
    - locales/fr/common.json
    - locales/en/common.json

key-decisions:
  - "Plan 01 (couche donnees) non execute — cree inline comme deviation Rule 3 (bloquant)"
  - "parseBuildings() gere 3 formats: string[], CSV simple 'poulailler,grange', et nouveau 'poulailler:b0:1:ISO'"
  - "TreeShop recu ownedBuildings en string[] via .map(b => b.buildingId) pour retrocompat"
  - "collectPassiveIncome utilise maintenant les PlacedBuilding et collecte les ressources oeuf/lait/farine"
  - "pulse animation sur BuildingCell demarree via useEffect avec dependance pendingCount > 0 (boolean stable)"

patterns-established:
  - "Pattern pulse badge: useSharedValue(1) + withRepeat(withSequence(withTiming),-1,true) quand count > 0"
  - "Pattern bottom sheet batiment: Modal transparent + overlayBg TouchableOpacity + sheet View"

requirements-completed: [BAT-01, BAT-02, BAT-03]

# Metrics
duration: 10min
completed: 2026-03-28
---

# Phase 06 Plan 02: Batiments Productifs UI Summary

**BuildingCell interactif avec badge pulsant, BuildingShopSheet et BuildingDetailSheet complets, migration backward-compatible PlacedBuilding[], 3 actions (construire/collecter/ameliorer) integrees dans tree.tsx**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-28T22:02:06Z
- **Completed:** 2026-03-28T22:12:04Z
- **Tasks:** 2 (Task 3 = checkpoint human-verify)
- **Files modified:** 12

## Accomplishments

- Couche donnees complete (building-engine.ts, building-sprites.ts, types, migration parser) creee en deviation Rule 3
- BuildingCell interactif avec badge pending pulsant (Reanimated), sprite par niveau, tap handler
- BuildingShopSheet: filtrage dynamique batiments par stade arbre, coins et possession
- BuildingDetailSheet: collecte avec haptics, amelioration, badge "Niveau max"
- Integration complete dans tree.tsx avec 5 handlers et 2 modals

## Task Commits

1. **Task 1: WorldGridView BuildingCell interactif + BuildingShopSheet + BuildingDetailSheet** - `81675b2` (feat)
2. **Task 2: Integration tree.tsx** - `cb9c033` (feat)
3. **Task 3: Verification visuelle** - Checkpoint human-verify (en attente)

## Files Created/Modified

- `lib/mascot/building-engine.ts` — Logique metier batiments (construct, upgrade, collect, pending, serialize, parse)
- `lib/mascot/building-sprites.ts` — Mapping sprites par batimentId et niveau
- `components/mascot/BuildingShopSheet.tsx` — Bottom sheet construction batiment
- `components/mascot/BuildingDetailSheet.tsx` — Bottom sheet detail/collecte/amelioration
- `lib/mascot/types.ts` — Etendu avec PlacedBuilding, BuildingTier, ResourceType, FarmInventory, moulin dans BUILDING_CATALOG
- `lib/mascot/world-grid.ts` — Ajout slot b2 pour le moulin
- `lib/types.ts` — Profile.farmBuildings: PlacedBuilding[], farmInventory: FarmInventory
- `lib/parser.ts` — parseBuildings() backward-compat, parseInventory()
- `hooks/useFarm.ts` — buyBuilding(3 args), upgradeBuildingAction, collectBuildingResources
- `components/mascot/WorldGridView.tsx` — BuildingCell refactore avec props/badge/animation
- `app/(tabs)/tree.tsx` — Integration 5 handlers + 2 modals batiments
- `locales/fr/common.json`, `locales/en/common.json` — Cles i18n batiments

## Decisions Made

- Plan 01 (couche donnees) n'avait pas ete execute - cree en deviation Rule 3 comme prerequis bloquant
- parseBuildings() gere 3 formats pour la migration backward-compatible
- TreeShop garde son interface string[] — conversion .map(b => b.buildingId) dans tree.tsx
- collectPassiveIncome refactore pour utiliser PlacedBuilding et produire des ressources (oeuf/lait/farine)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Creation de la couche donnees Plan 01 (building-engine.ts, building-sprites.ts, types)**
- **Found during:** Debut de Task 1
- **Issue:** Plan 02 depend de Plan 01 (building-engine.ts, building-sprites.ts, types etendus) qui n'avait pas ete execute. Sans ces fichiers, Task 1 etait impossible.
- **Fix:** Cree toute la couche donnees de Plan 01 inline: building-engine.ts (6 fonctions pures), building-sprites.ts, types etendus (PlacedBuilding/BuildingTier/ResourceType/FarmInventory/BUILDING_CATALOG moulin), world-grid b2, migration parser backward-compat, useFarm etendu
- **Files modified:** lib/mascot/building-engine.ts (NEW), lib/mascot/building-sprites.ts (NEW), lib/mascot/types.ts, lib/mascot/world-grid.ts, lib/types.ts, lib/parser.ts, hooks/useFarm.ts, locales/fr/common.json, locales/en/common.json
- **Verification:** npx tsc --noEmit - 0 nouvelles erreurs
- **Committed in:** 81675b2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bloquant)
**Impact on plan:** Deviation necessaire — Plan 01 etait un prerequis non satisfait. Toute la logique metier prevue par Plan 01 a ete implementee. Aucun scope creep.

## Issues Encountered

- `TreeShop` attendait `ownedBuildings?: string[]` (ancien format) — resolu en passant `.map(b => b.buildingId)` dans tree.tsx pour retrocompatibilite sans modifier TreeShop
- Import duplique de `collectBuilding` dans useFarm.ts — corrige immediatement

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BuildingShopSheet, BuildingDetailSheet et WorldGridView sont prets pour verification visuelle (Task 3 checkpoint)
- La verification humaine doit confirmer: badges pending, sprites, collecte/amelioration fonctionnels sur device
- Apres approbation: phase 06 complete, prochaine phase peut consommer ces composants

---
*Phase: 06-batiments-productifs*
*Completed: 2026-03-28*
