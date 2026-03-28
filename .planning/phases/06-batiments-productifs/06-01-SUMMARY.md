---
phase: 06-batiments-productifs
plan: 01
subsystem: gamification
tags: [farm, buildings, typescript, idle-production, mascot]

# Dependency graph
requires:
  - phase: 05-visuels-ferme
    provides: AnimatedAnimal, CropSprites, WorldGridView — composants visuels ferme existants

provides:
  - building-engine.ts : module autonome (constructBuilding, upgradeBuilding, collectBuilding, getPendingResources, serialize/parse)
  - PlacedBuilding, BuildingTier, FarmInventory, ResourceType — types etendus dans mascot/types.ts
  - BUILDING_CATALOG etendu : 3 batiments (poulailler/grange/moulin) avec 3 tiers chacun
  - building-sprites.ts : mapping sprites 3x3 (placeholder niveaux 2/3)
  - Slot b2 dans WORLD_GRID (row 1, col 5, unlockOrder 19)
  - Parser migre : parseBuildings() gere ancien format string[] et nouveau PlacedBuilding CSV
  - useFarm etendu : buyBuilding(+cellId), upgradeBuildingAction, collectBuildingResources, collectPassiveIncome refactore
  - Cles i18n : farm.building.{moulin,level,pending,collect,upgrade,...} en fr + en

affects:
  - 06-02-PLAN (UI batiments — consomme directement les fonctions de building-engine)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PlacedBuilding CSV serialization : buildingId:cellId:level:lastCollectAt — pattern identique a farm-engine crops"
    - "Migration backward-compatible : parseBuildings() detecte ancien format (string seul) et nouveau format (CSV avec colons)"
    - "writeField() helper generique dans useFarm pour ecrire n'importe quel champ dans famille.md"
    - "Idle production plafonnee a MAX_PENDING=3 pour eviter accumulation infinie"

key-files:
  created:
    - lib/mascot/building-engine.ts
    - lib/mascot/building-sprites.ts
  modified:
    - lib/mascot/types.ts
    - lib/mascot/world-grid.ts
    - lib/types.ts
    - lib/parser.ts
    - hooks/useFarm.ts
    - components/mascot/WorldGridView.tsx
    - components/mascot/TreeShop.tsx
    - app/(tabs)/tree.tsx
    - locales/fr/common.json
    - locales/en/common.json

key-decisions:
  - "MAX_PENDING=3 : plafond production idle — evite accumulation si l'utilisateur ne joue pas pendant des jours"
  - "buildingId:cellId:level:lastCollectAt — format CSV identique au pattern farm-engine pour coherence"
  - "Migration backward-compatible : parseBuildings() detecte l'ancien format (ID seul) et assigne automatiquement b0/b1"
  - "writeField() helper extrait de writeFarmCrops — elimine la duplication dans useFarm"
  - "BUILDING_SPRITES utilise moulin.png (asset deja present) pour les 3 niveaux placeholder"
  - "TreeShop auto-selectionne la prochaine cellule libre lors d'un achat (Plan 02 ajoutera le picker explicite)"

patterns-established:
  - "Pattern farm-engine suivi : fonctions pures + serialize/parse separes de la logique React"
  - "Separation nette : building-engine.ts = logique pure, useFarm.ts = acces vault + refresh"

requirements-completed: [BAT-01, BAT-02, BAT-03]

# Metrics
duration: 25min
completed: 2026-03-28
---

# Phase 6 Plan 01: Batiments Productifs — Couche Donnees Summary

**Systeme de batiments productifs idle (PlacedBuilding tiered, building-engine.ts, parser migre) fournissant la couche donnees complete pour le Plan 02 UI**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-28T22:00:00Z
- **Completed:** 2026-03-28T22:25:00Z
- **Tasks:** 2 (+ 4 auto-fixes Rule 1/3)
- **Files modified:** 11

## Accomplishments

- Module `building-engine.ts` autonome avec 10 fonctions exportees (construct, upgrade, collect, pending, getUpgradeCost, canUpgrade, serialize/parse x2)
- BUILDING_CATALOG etendu : poulailler (oeufs), grange (lait), moulin (farine) avec 3 tiers de production chacun
- Migration backward-compatible de `parseFamille()` : gere l'ancien format `string[]` (poulailler,grange) et le nouveau format CSV (poulailler:b0:1:2026-03-28T10:00)
- `useFarm` enrichi avec `upgradeBuildingAction`, `collectBuildingResources`, `collectPassiveIncome` refactore + helper `writeField` generique

## Task Commits

1. **Task 1: Types etendus + building-engine + sprites + world-grid b2** - `4c3d2a8` (feat)
2. **Task 2: Migration parser + useFarm etendu + cles i18n** - `3c3c4da` (feat)

## Files Created/Modified

- `lib/mascot/building-engine.ts` — Module logique batiments (construct/upgrade/collect/serialize/parse)
- `lib/mascot/building-sprites.ts` — Mapping sprites 3 batiments x 3 niveaux
- `lib/mascot/types.ts` — PlacedBuilding, BuildingTier, FarmInventory, ResourceType + BUILDING_CATALOG etendu (3 batiments, 3 tiers)
- `lib/mascot/world-grid.ts` — Slot b2 ajoute (row 1, col 5, unlockOrder 19)
- `lib/types.ts` — Profile.farmBuildings: PlacedBuilding[], Profile.farmInventory: FarmInventory
- `lib/parser.ts` — parseFamille() migre : parseBuildings() + parseInventory()
- `hooks/useFarm.ts` — writeField(), buyBuilding(+cellId), upgradeBuildingAction, collectBuildingResources, collectPassiveIncome refactore
- `components/mascot/WorldGridView.tsx` — Props ownedBuildings: PlacedBuilding[], lookup par cellId, sprites niveau-specifiques
- `components/mascot/TreeShop.tsx` — ownedBuildings: PlacedBuilding[], onBuyBuilding(buildingId, cellId), auto-selection cellule libre
- `app/(tabs)/tree.tsx` — onBuyBuilding callback mis a jour (buildingId, cellId)
- `locales/fr/common.json` — Cles farm.building.{moulin,level,pending,collect,upgrade,...} + farm.resource.* + farm.inventory.*
- `locales/en/common.json` — Traductions anglaises equivalentes

## Decisions Made

- `MAX_PENDING=3` : plafond de production idle pour eviter accumulation infinie si l'utilisateur est absent plusieurs jours
- Format CSV `buildingId:cellId:level:lastCollectAt` identique au pattern farm-engine pour coherence de l'architecture
- `writeField()` extrait de `writeFarmCrops` — elimine la duplication dans useFarm
- `TreeShop` auto-selectionne la prochaine cellule libre — Plan 02 ajoutera un picker explicite pour les batiments

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mise a jour de WorldGridView pour PlacedBuilding[]**
- **Found during:** Task 1 (modification lib/types.ts)
- **Issue:** WorldGridView.tsx utilisait `ownedBuildings: string[]` et `ownedBuildings[idx]` (lookup par index). Avec le nouveau type `PlacedBuilding[]`, les refs par index ne fonctionnent plus — il faut un lookup par `cellId`.
- **Fix:** Mis a jour WorldGridView props, BuildingCell props, lookup par `cell.id`, sprites niveau-specifiques depuis BUILDING_SPRITES
- **Files modified:** components/mascot/WorldGridView.tsx
- **Committed in:** 4c3d2a8 (Task 1 commit)

**2. [Rule 1 - Bug] Mise a jour de TreeShop pour PlacedBuilding[]**
- **Found during:** Task 1 (verification TSC)
- **Issue:** TreeShop.tsx utilisait `ownedBuildings: string[]` et `ownedBuildings.includes(building.id)`
- **Fix:** Mis a jour props (PlacedBuilding[]), check `some(b => b.buildingId === building.id)`, callback `onBuyBuilding(buildingId, cellId)`, auto-selection cellule libre depuis BUILDING_CELLS
- **Files modified:** components/mascot/TreeShop.tsx
- **Committed in:** 4c3d2a8 (Task 1 commit)

**3. [Rule 3 - Blocking] Migration parser.ts anticipee**
- **Found during:** Task 1 (TSC check)
- **Issue:** `lib/parser.ts` generait un TS2322 (string[] non assignable a PlacedBuilding[]) bloquant la compilation
- **Fix:** Import `parseBuildings`/`parseInventory` + migration parseFamille() depuis parser.ts (anticipation Task 2)
- **Files modified:** lib/parser.ts
- **Committed in:** 4c3d2a8 (Task 1 commit)

**4. [Rule 3 - Blocking] tree.tsx callback signature mise a jour**
- **Found during:** Task 1 (TSC check — TS2554 Expected 3 arguments, got 2)
- **Issue:** `onBuyBuilding` dans tree.tsx appelait `buyBuilding(profile.id, buildingId)` sans cellId
- **Fix:** Mis a jour le callback pour `buyBuilding(profile.id, buildingId, cellId)`
- **Files modified:** app/(tabs)/tree.tsx
- **Committed in:** 4c3d2a8 (Task 1 commit)

---

**Total deviations:** 4 auto-fixes (2 Rule 1 bugs, 2 Rule 3 blocking)
**Impact on plan:** Tous les auto-fixes necessaires pour la coherence des types. Aucun scope creep.

## Issues Encountered

- Les sprites de niveaux 2 et 3 sont des placeholders (meme asset que niveau 1). Ils seront remplacés par des vrais sprites pixel-art Mana Seed 32x32 (D-15).
- La valeur de `moulin.png` (asset deja present dans assets/buildings/) a pu etre reutilisee directement pour les 3 niveaux du moulin.

## Self-Check: PASSED

All created files verified:
- FOUND: lib/mascot/building-engine.ts
- FOUND: lib/mascot/building-sprites.ts
- FOUND: .planning/phases/06-batiments-productifs/06-01-SUMMARY.md

All commits verified:
- FOUND: 4c3d2a8 (Task 1)
- FOUND: 3c3c4da (Task 2)

Acceptance criteria (all passing):
- PlacedBuilding, FarmInventory, BuildingTier interfaces defined in types.ts
- id: 'moulin' in BUILDING_CATALOG (3rd building)
- constructBuilding exported from building-engine.ts
- Slot b2 in world-grid.ts
- farmBuildings?: PlacedBuilding[] in lib/types.ts
- farmInventory?: FarmInventory in lib/types.ts
- TSC: only pre-existing TabletSidebar.tsx errors remain

## Next Phase Readiness

- Plan 02 (UI batiments) peut consommer directement `building-engine.ts` et les types — aucune logique metier a re-implementer
- `useFarm` expose `upgradeBuildingAction` et `collectBuildingResources` prets pour le binding UI
- Slot b2 existe dans WORLD_GRID mais le commentaire de layout en haut du fichier doit etre mis a jour (cosmetic, pas bloquant)
- Concern pre-existant : la formule de progression idle devra etre calibree contre le modele XP

---
*Phase: 06-batiments-productifs*
*Completed: 2026-03-28*
