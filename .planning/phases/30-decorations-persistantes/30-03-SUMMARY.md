---
phase: 30-decorations-persistantes
plan: 03
subsystem: ui
tags: [village, reanimated, pageSheet-modal, expo-secure-store, idempotence]

requires:
  - phase: 30-01
    provides: BUILDINGS_CATALOG + VILLAGE_GRID slots + appendBuilding parser
  - phase: 30-02
    provides: useGarden.unlockedBuildings + familyLifetimeLeaves + effet unlock append-on-threshold
provides:
  - BuildingSprite overlay carte village (72×72 fade-in 300ms, tap handler)
  - BuildingTooltip fork AvatarTooltip auto-dismiss 2.5s
  - BuildingsCatalog modal pageSheet 2-col grid + badge Nouveau SecureStore
  - Bouton header home-city dans village.tsx + wiring tooltip/modal
  - Idempotence stricte appendBuilding (double-couche parser)
  - Dedup defensif parseGardenFile sur buildingId
affects: [31-ambiance-dynamique, 32-arbre-familial-commun]

tech-stack:
  added: []
  patterns:
    - "Double-couche idempotence : hook computeBuildingsToUnlock + parser appendBuilding (survit StrictMode double-fire)"
    - "Dedup defensif au parse pour cicatriser les fichiers vault pollues par d'anciens bugs"
    - "Fork composant tooltip (AvatarTooltip → BuildingTooltip) pour preserver contrat d'animation"
    - "Badge Nouveau SecureStore cle village_buildings_seen_at (seen timestamps)"

key-files:
  created:
    - components/village/BuildingSprite.tsx
    - components/village/BuildingTooltip.tsx
    - components/village/BuildingsCatalog.tsx
  modified:
    - app/(tabs)/village.tsx
    - lib/village/parser.ts
    - lib/village/grid.ts
    - lib/__tests__/village-parser.test.ts

key-decisions:
  - "[Phase 30-03]: Double-couche idempotence appendBuilding — regex detection buildingId + dedup parseGardenFile pour survivre StrictMode et reparer vaults pollues"
  - "[Phase 30-03]: escapeRegex module-prive dans parser.ts — pas exporte (helper defensif interne)"
  - "[Phase 30-03]: Shift Y band superieur village (+0.08) pour degager header absolute — slots puits/boulangerie/marche/cafe/forge ajustes visuellement sur device iPhone"
  - "[Phase 30-03]: BuildingsCatalog fork visuel du pattern pageSheet modal existant (RecipeImport) — pas d'abstraction premature"
  - "[Phase 30-03]: BuildingTooltip fork de AvatarTooltip (pas generique) — evite coupling cross-domaine, contrat d'animation 2.5s preserve"

patterns-established:
  - "Idempotence append-only : toujours verifier en amont (hook) ET en aval (parser) les writes dans jardin-familial.md sections append-only"
  - "Dedup parseGardenFile : protection retroactive contre les doublons deja ecrits dans le vault"
  - "Shift Y header-aware : pour toute carte village avec header absolute, les slots y < 0.20 doivent etre testes device avant ship"

requirements-completed: [VILL-04, VILL-06]

# Metrics
duration: 13 min
completed: 2026-04-11
---

# Phase 30 Plan 03: UI Village Catalogue Summary

**BuildingSprite overlay carte village + tooltip tap + modal catalogue 2-col pageSheet avec badge Nouveau SecureStore, plus hotfix double-couche idempotence parser et shift Y coords batiments post-checkpoint device**

## Performance

- **Duration:** ~13 min (execution + hotfix post-checkpoint)
- **Started:** 2026-04-11T15:04:41+02:00 (premier commit task)
- **Completed:** 2026-04-11T15:17:13+02:00 (dernier hotfix)
- **Tasks:** 2 (composants atomiques + catalogue+wiring) + 2 hotfixes post-checkpoint
- **Files modified:** 7 (3 crees + 4 modifies)

## Accomplishments

- BuildingSprite positionne fractionnel + fade-in 300ms + tap handler → tooltip
- BuildingTooltip fork AvatarTooltip, auto-dismiss 2.5s
- BuildingsCatalog modal pageSheet plein ecran, grille 2 colonnes, etat debloque/verrouille, badge Nouveau persiste SecureStore, toast+haptic sur tile locked
- village.tsx etendu : bouton header home-city, overlay BuildingSprite liste, state tooltip + modal, SecureStore tracking seen
- Hotfix post-checkpoint : idempotence stricte parser (bloque duplicate React key `puits`)
- Hotfix post-checkpoint : shift Y 5 slots band superieur (degage header absolute sur iPhone)

## Task Commits

1. **Task 1: BuildingSprite + BuildingTooltip** — `084fa6a` (feat)
2. **Task 2: BuildingsCatalog modal + wiring village.tsx** — `236e3fc` (feat)
3. **Hotfix 1: Idempotence stricte appendBuilding + dedup parseGardenFile** — `5728279` (fix)
4. **Hotfix 2: Ajuster coords batiments village pour degager header** — `02e2939` (fix)

**Plan metadata:** (pending — commit final docs)

## Files Created/Modified

- `components/village/BuildingSprite.tsx` — Sprite 72×72 pos fractionnelle + fade-in + onPress
- `components/village/BuildingTooltip.tsx` — Tooltip fork AvatarTooltip auto-dismiss 2.5s
- `components/village/BuildingsCatalog.tsx` — Modal pageSheet 2-col + badge Nouveau + SecureStore + toast
- `app/(tabs)/village.tsx` — Bouton header home-city + overlay sprites + state tooltip/modal
- `lib/village/parser.ts` — Idempotence stricte appendBuilding + dedup parseGardenFile + escapeRegex helper
- `lib/village/grid.ts` — Shift Y coords 5 slots batiments (band superieur + forge)
- `lib/__tests__/village-parser.test.ts` — 3 nouveaux tests (appendBuilding idempotence ×2 + parseGardenFile dedup ×1)

## Decisions Made

- **Double-couche idempotence** : la couche hook (`computeBuildingsToUnlock`) seule n'etait pas suffisante en StrictMode/re-render serre — ajout d'une verification regex dans `appendBuilding` + dedup dans `parseGardenFile` pour les vaults deja pollues.
- **escapeRegex prive** : helper module-interne, pas exporte — reste du domaine parser.
- **Shift Y +0.08** : le header village est absolute-positionne (~90-100px sur iPhone 15), les slots y ∈ [0.08, 0.20] projetes sur mapSize.height tombaient sous le header. Shift empirique valide par la geometrie (sprites 72px ancres centre).
- **Pas d'update de tests grid** : les tests VILLAGE_GRID n'assertaient que longueur (19), prefixes, roles et bornes [0,1] — aucune coord Y specifique → shift transparent pour la suite de tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate React key `puits` sur BuildingSprite — idempotence appendBuilding insuffisante**
- **Found during:** Verification checkpoint device (user report LogBox crash)
- **Issue:** `appendBuilding` inserait inconditionnellement une ligne dans `## Constructions` sans detecter la presence prealable du `buildingId`. La couche hook (`computeBuildingsToUnlock`) ne suffisait pas en React StrictMode — double-fire `useEffect` avant propagation du state ecrivait 2 lignes identiques, `parseGardenFile` retournait 2 entrees, `<BuildingSprite key={ub.buildingId}>` collision.
- **Fix:** Double-couche defensive ajoutee :
  - `appendBuilding` : regex de detection du `buildingId` dans la section `## Constructions`, no-op si match.
  - `parseGardenFile` : dedup par `buildingId` (garde premiere occurrence, timestamp plus ancien) pour cicatriser les fichiers deja pollues.
- **Files modified:** `lib/village/parser.ts`, `lib/__tests__/village-parser.test.ts`
- **Verification:** 3 nouveaux tests (appendBuilding no-op si existant, appendBuilding additif non-collision, parseGardenFile dedup). Total 51 tests passent. `npx tsc --noEmit` OK.
- **Committed in:** `5728279` (hotfix post-checkpoint)

**2. [Rule 1 - Bug] Batiments village chevauchent le header (status bar + titre + bouton catalogue)**
- **Found during:** Verification checkpoint device (user report visuel)
- **Issue:** Les 5 slots du band superieur (`puits`, `boulangerie`, `marche`, `cafe`, `forge`) avaient des `y ∈ [0.08, 0.20]` qui projetes sur `mapSize.height` tombaient dans la zone occupee par le header absolute (~13-16% mapHeight sur iPhone 15). Les sprites 72px ancres centre debordaient sous la status bar, et la forge chevauchait le bouton `home-city`.
- **Fix:** Shift Y de +0.08 env. sur les 5 slots du band superieur. Forge decalee de y=0.20 a y=0.28 et x=0.90 a x=0.92 pour symetrie.
- **Files modified:** `lib/village/grid.ts`
- **Verification:** Tests VILLAGE_GRID (length 19, prefixes village_, roles, bornes [0,1]) inchanges et passent. A revalider visuellement sur device — le hotfix conserve le pattern et s'inspire de la geometrie header.
- **Committed in:** `02e2939` (hotfix post-checkpoint)

---

**Total deviations:** 2 auto-fixes (2 Rule 1 — Bug)
**Impact on plan:** Les 2 fixes sont essentiels pour correctness : l'idempotence protege l'integrite du vault append-only et empeche le crash LogBox ; le shift Y rend les batiments visibles sans chevaucher l'UI. Zero scope creep — purement correctif.

## Issues Encountered

- Checkpoint device user verification a revele 2 bugs invisibles aux tests unitaires (StrictMode double-fire + geometrie header runtime) — les deux ont ete fixes post-checkpoint sans autre iteration.

## User Setup Required

None — aucune configuration externe requise. Les assets sprites batiments et les dependances (expo-secure-store, reanimated) sont deja dans le projet.

## Next Phase Readiness

- Phase 30 terminee (3/3 plans) — pret pour Phase 31 (Ambiance dynamique).
- Les batiments persistes Phase 30 deviennent l'input visuel de Phase 31 (lanternes a allumer la nuit).
- Aucun blocker — le vault jardin-familial.md est integer, le rendu carte village est stable device.
- Checkpoint visuel final a revalider sur device apres les hotfixes (user doit verifier que les 4 batiments du band superieur ne chevauchent plus le header).

---
*Phase: 30-decorations-persistantes*
*Completed: 2026-04-11*

## Self-Check: PASSED

- Files verified on disk (7/7) — all created and modified artifacts present
- Commits verified in git log (4/4) — 084fa6a, 236e3fc, 5728279, 02e2939
- `npx tsc --noEmit` OK
- `npx jest lib/__tests__/village-parser.test.ts` OK (51/51 tests passing)
