---
phase: 30-decorations-persistantes
plan: 01
subsystem: village/data
tags: [village, building, catalog, parser, append-only, vault, obsidian, jest]

requires:
  - phase: 25-fondation-donnees-village
    provides: "lib/village/parser.ts pattern appendContribution, VILLAGE_GRID structure, jardin-familial.md format"
  - phase: 29-avatars-vivants-portail-retour
    provides: "VILLAGE_GRID avec role 'avatar' (11 slots existants après Phase 29)"
provides:
  - "UnlockedBuilding type + VillageData.unlockedBuildings champ"
  - "BUILDINGS_CATALOG statique 8 entrées avec paliers 100/300/700/1500/3000/6000/12000/25000"
  - "computeBuildingsToUnlock fonction pure idempotente"
  - "parseGardenFile/serializeGardenFile parse/emit section ## Constructions"
  - "appendBuilding + appendBuildingToVault append-only (jamais fin de fichier)"
  - "VILLAGE_GRID étendu à 19 slots (8 nouveaux slots role 'building')"
  - "Fix test stale VILLAGE_GRID.toHaveLength(4) → toHaveLength(19)"
affects: [30-02 unlock-engine, 30-03 UI bâtiments, ambiance Phase 31, arbre familial Phase 32]

tech-stack:
  added: []
  patterns:
    - "Catalogue statique avec require() PNG explicite (Metro-safe, Pitfall 4/5 RESEARCH)"
    - "Pattern append-only miroir strict de appendContribution — zéro duplication logique"
    - "Fonction pure computeBuildingsToUnlock (Set-based idempotence)"
    - "Mock file-asset retourne 0 en Jest → vérification `toBeDefined` au lieu de `toBeTruthy` pour sprites"

key-files:
  created:
    - lib/village/catalog.ts
  modified:
    - lib/village/types.ts
    - lib/village/parser.ts
    - lib/village/grid.ts
    - lib/village/index.ts
    - lib/__tests__/village-parser.test.ts

key-decisions:
  - "VillageRole union étendue avec 'building' (additif, non-breaking)"
  - "unlockedBuildings: champ obligatoire dans VillageData (non optionnel) — force tous les consommateurs à être explicites"
  - "BUILDINGS_CATALOG ordre narratif hameau→ville (puits→bibliothèque) et non paliers décroissants"
  - "appendBuilding reprend EXACTEMENT le pattern de appendContribution (insert avant section suivante, fallback création avant ## Historique, fallback fin de fichier)"
  - "Tests sprites : vérifier propriété définie au lieu de truthy (mock jest retourne 0 falsy)"
  - "Section ## Constructions toujours émise par serializeGardenFile même vide (cohérence avec ## Contributions et ## Historique)"

patterns-established:
  - "Catalogue statique bâtiments : id + labelFR + palier + sprite (require direct)"
  - "Fonction pure idempotente : Set sur ids déjà débloqués + filter sur entrées catalogue"
  - "Section markdown append-only : parser tolérant aux lignes malformées, serializer toujours présent, append insère avant prochaine section ##"

requirements-completed: [VILL-05, VILL-06]

duration: 12min
completed: 2026-04-11
---

# Phase 30 Plan 01: Fondation données bâtiments village Summary

**Schéma append-only des bâtiments village persistants + catalogue statique 8 entrées avec paliers exacts + parser round-trip + 8 slots grille prêts pour l'unlock engine Plan 02**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-11T12:44:13Z
- **Completed:** 2026-04-11T12:56:00Z
- **Tasks:** 2 (tous atomiques avec TDD)
- **Files modified:** 6 (1 créé, 5 modifiés)

## Accomplishments

- Couche données Phase 30 complète et 100% testée en isolation (43 tests Jest passants)
- BUILDINGS_CATALOG statique avec 8 entrées : puits/boulangerie/marché/café/forge/moulin/port/bibliothèque, paliers 100/300/700/1500/3000/6000/12000/25000
- computeBuildingsToUnlock pure et idempotente (6 scénarios testés : zéro, seuils, idempotence complète, skip partiels)
- Parser bidirectionnel ## Constructions : round-trip fidelity garantie, backward compat vaults legacy Phase 25
- appendBuilding/appendBuildingToVault reprenant EXACTEMENT le pattern éprouvé de appendContribution (Pitfall 3/4 : jamais append en fin de fichier)
- 8 nouveaux slots role 'building' dans VILLAGE_GRID (total 19)
- Dette technique Phase 25 éliminée : test stale VILLAGE_GRID.toHaveLength(4) corrigé à 19

## Task Commits

Chaque tâche committée atomiquement :

1. **Task 1: Types + catalogue statique + slots grille** — `d36e7dd` (feat)
2. **Task 2: Parser/serializer ## Constructions + appendBuilding** — `3104e8d` (feat)

_Note : TDD appliqué (test-first puis impl dans le même commit pour rester groupé par tâche)._

## Files Created/Modified

- **Créé** `lib/village/catalog.ts` — BUILDINGS_CATALOG 8 entrées + computeBuildingsToUnlock pure
- **Modifié** `lib/village/types.ts` — VillageRole + 'building', interface UnlockedBuilding, VillageData.unlockedBuildings obligatoire
- **Modifié** `lib/village/parser.ts` — parse/emit ## Constructions, appendBuilding + appendBuildingToVault
- **Modifié** `lib/village/grid.ts` — 8 slots village_building_{id} (x/y per D-11 CONTEXT)
- **Modifié** `lib/village/index.ts` — barrel export ./catalog
- **Modifié** `lib/__tests__/village-parser.test.ts` — fix stale toHaveLength(4)→19 + 19 nouveaux tests (10 catalog/compute + 6 parse/serialize + 3 appendBuilding)

## Decisions Made

- **Sprites require explicite (non dynamic)** : Pitfall 4 RESEARCH — Metro bundler n'accepte pas les require dynamiques, chaque PNG est un require littéral dans BUILDINGS_CATALOG.
- **Sous-dossier assets/buildings/village/** : Pitfall 5 RESEARCH — collision possible avec moulin.png ferme existant, isolation par sous-dossier obligatoire.
- **unlockedBuildings: champ requis** : ne pas rendre optionnel pour forcer tous les constructeurs de VillageData (useGarden.ts, tests) à être explicites — le spread `...gardenData` préserve naturellement la valeur.
- **Mock file-asset retourne 0 en Jest** : adaptation du test sprites → vérifier `toBeDefined` au lieu de `toBeTruthy` (0 est falsy mais le require a bien résolu).
- **Test stale Phase 25** : le test VILLAGE_GRID.toHaveLength(4) datait de Phase 25 et était déjà incohérent après Phase 29 (11 slots). Correction au passage à 19 (11+8) — dette éliminée.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture VillageData existantes sans unlockedBuildings**
- **Found during:** Task 1 (après ajout du champ obligatoire dans types.ts)
- **Issue:** Les fixtures FULL_GARDEN_DATA et emptyData dans village-parser.test.ts échouaient TS2741 (Property 'unlockedBuildings' is missing)
- **Fix:** Ajout de `unlockedBuildings: []` dans les 2 fixtures + le test "retourne un VillageData par defaut valide"
- **Files modified:** lib/__tests__/village-parser.test.ts
- **Verification:** `npx tsc --noEmit` passe
- **Committed in:** d36e7dd (Task 1)

**2. [Rule 1 - Bug] Test sprites incompatible avec mock Jest**
- **Found during:** Task 1 (exécution des nouveaux tests catalog)
- **Issue:** Le test `expect(entry.sprite).toBeTruthy()` échouait car le mock lib/__tests__/__mocks__/file-asset.ts retourne `0` (falsy) pour tous les PNG
- **Fix:** Remplacement par `expect(entry).toHaveProperty('sprite')` + `expect(entry.sprite).toBeDefined()` avec commentaire expliquant le quirk
- **Files modified:** lib/__tests__/village-parser.test.ts
- **Verification:** Test passe, sémantique préservée (on vérifie bien que le require est résolu, pas qu'il vaut quelque chose de "vrai")
- **Committed in:** d36e7dd (Task 1)

---

**Total deviations:** 2 auto-fixed (1 blocking TS, 1 bug test)
**Impact on plan:** Les deux corrections étaient nécessaires pour faire passer les tests en environnement Jest existant. Zéro scope creep — ajustements purement de conformité à l'infra de test du projet.

## Issues Encountered

- Coordination inter-tâches sur `lib/village/parser.ts` : les types Task 1 rendent `unlockedBuildings` obligatoire dans `VillageData`, ce qui force des patches minimaux sur `parser.ts` dès Task 1 (déclaration `unlockedBuildings: []` dans les deux chemins de retour de `parseGardenFile`, union `section: ... | 'constructions'`) pour que TS compile. Task 2 étend réellement la logique (parsing de la section, emit serializer, appendBuilding). Split accepté — Task 1 contient le minimum vital pour TS, Task 2 contient le comportement.

## Next Phase Readiness

**Plan 30-02 (unlock engine) peut immédiatement consommer :**
- `BUILDINGS_CATALOG` (pour itérer les 8 entrées)
- `computeBuildingsToUnlock(familyLifetimeLeaves, alreadyUnlocked)` (fonction pure)
- `appendBuildingToVault(vault, { timestamp, buildingId, palier })`
- `VillageData.unlockedBuildings` dans useGarden (spread `...gardenData` déjà suffisant)

**Plan 30-03 (UI) peut immédiatement consommer :**
- `BUILDINGS_CATALOG` (sprite + labelFR + palier pour rendering)
- `VILLAGE_GRID` étendu (8 slots `village_building_*` avec coordonnées x/y)
- `UnlockedBuilding` type pour typer les props

**Aucun blocker.** La fondation est prête, testée en isolation (zéro dépendance vault ou hook), et backward-compatible avec les vaults Phase 25+29 existants.

## Self-Check: PASSED

**Files verified:**
- FOUND: lib/village/catalog.ts
- FOUND: lib/village/types.ts (modifié)
- FOUND: lib/village/parser.ts (modifié)
- FOUND: lib/village/grid.ts (modifié)
- FOUND: lib/village/index.ts (modifié)
- FOUND: lib/__tests__/village-parser.test.ts (modifié)

**Commits verified:**
- FOUND: d36e7dd (Task 1 — types + catalogue + grid)
- FOUND: 3104e8d (Task 2 — parser Constructions + appendBuilding)

**Acceptance criteria verified:**
- `grep -c "require('../../assets/buildings/village/" lib/village/catalog.ts` = 8 ✓
- `grep -c "village_building_" lib/village/grid.ts` = 8 ✓
- `grep "toHaveLength(4)" lib/__tests__/village-parser.test.ts` = 0 (stale fixed) ✓
- `npx tsc --noEmit` exits 0 ✓
- `npx jest --no-coverage lib/__tests__/village-parser.test.ts` exits 0 (43 tests passing) ✓

---
*Phase: 30-decorations-persistantes*
*Completed: 2026-04-11*
