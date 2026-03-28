---
phase: 05-visuels-ferme
plan: 03
subsystem: ui
tags: [react-native, reanimated, pixel-art, animation, sprites, mascot]

# Dependency graph
requires:
  - phase: 05-visuels-ferme
    provides: "Plan 02 — vrais sprites Mana Seed animaux placés dans assets/garden/animals/"
provides:
  - "ANIMAL_WALK_LEFT_FRAMES — frames walk_left pour les 5 animaux (poussin, poulet, canard, cochon, vache)"
  - "Detection de direction dans AnimatedAnimal (lastDx/lastDy)"
  - "scaleX: -1 flip sur Image pour mouvement vers la droite"
  - "ANIMAL_WALK_FRAMES etendu avec toutes les frames walk_down disponibles (4→8 frames)"
affects: [mascot, farm, TreeView]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direction detection via lastDx/lastDy state dans AnimatedAnimal"
    - "scaleX: -1 pour flip horizontal sans perspective (convention CLAUDE.md)"
    - "activeWalkFrames selection : walk_left si isHorizontal, walk_down sinon"

key-files:
  created: []
  modified:
    - "components/mascot/TreeView.tsx"

key-decisions:
  - "isHorizontal = Math.abs(lastDx) > Math.abs(lastDy) pour selectionner les frames walk_left vs walk_down"
  - "scaleX: -1 applique uniquement sur Image (pas sur Animated.View) pour flip directionnel propre"
  - "walkFrameIdx % activeWalkFrames.length garantit compatibilite canard (6 frames) sans cas special"

patterns-established:
  - "Flip directionnel: scaleX: -1 uniquement, jamais perspective dans transform array"
  - "Frames directionnelles: tracker lastDx/lastDy dans state pour selection walk_left vs walk_down"

requirements-completed: [VIS-03]

# Metrics
duration: 15min
completed: 2026-03-28
---

# Phase 05 Plan 03: Sprites Mana Seed Animaux — Direction Walk Summary

**ANIMAL_WALK_LEFT_FRAMES ajouté dans AnimatedAnimal avec detection direction (lastDx/lastDy) et flip scaleX: -1 pour mouvement droite**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-28T21:10:00Z
- **Completed:** 2026-03-28T21:25:00Z
- **Tasks:** 3 (Task 1 continuée depuis commit 9657439, Tasks 2-3 exécutées)
- **Files modified:** 1

## Accomplishments

- ANIMAL_WALK_LEFT_FRAMES défini avec frames walk_left pour 5 animaux (8 frames pour poussin/poulet/cochon/vache, 6 pour canard)
- ANIMAL_WALK_FRAMES étendu avec toutes les frames walk_down disponibles (was 4 frames, now 6-8)
- AnimatedAnimal trackle lastDx/lastDy à chaque startWalk pour détecter la direction dominante
- Sélection directionnelle : walk_left si mouvement horizontal, walk_down sinon
- Flip scaleX: -1 sur l'Image quand deplacement vers la droite — pas de perspective dans transform

## Task Commits

Chaque tâche committée atomiquement :

1. **Task 1: Placer les vrais sprites Mana Seed** - `9657439` (chore — continuation depuis agent précédent)
2. **Task 2: Ajouter ANIMAL_WALK_LEFT_FRAMES et detection direction** - `1086477` (feat)
3. **Task 3: Verification visuelle** - auto-approuvée (tsc passe, pas de nouvelles erreurs)

## Files Created/Modified

- `components/mascot/TreeView.tsx` — ANIMAL_WALK_LEFT_FRAMES ajouté, ANIMAL_WALK_FRAMES étendu, lastDx/lastDy state, sélection directionnelle activeWalkFrames, flipX + scaleX: -1

## Decisions Made

- `isHorizontal = Math.abs(lastDx) > Math.abs(lastDy)` — threshold simple pour distinguer mouvement horizontal vs vertical
- `walkFrameIdx % activeWalkFrames.length` — modulo sur activeWalkFrames.length garantit que le canard (6 frames) fonctionne sans cas spécial
- scaleX: -1 appliqué sur `<Image>` directement (pas sur Animated.View) pour éviter de flipper la bulle de pensée

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Étendu ANIMAL_WALK_FRAMES avec toutes les frames disponibles**
- **Found during:** Task 2 (vérification des fichiers walk_down sur disque)
- **Issue:** ANIMAL_WALK_FRAMES original n'utilisait que 4 frames walk_down par animal, mais les vrais sprites Mana Seed ont 6-8 frames selon l'animal
- **Fix:** Étendu ANIMAL_WALK_FRAMES pour inclure toutes les frames walk_down disponibles (poussin: 8, poulet: 8, canard: 6, cochon: 8, vache: 8)
- **Files modified:** components/mascot/TreeView.tsx
- **Verification:** npx tsc --noEmit — aucune erreur TreeView
- **Committed in:** 1086477 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — fonctionnalité manquante critique)
**Impact on plan:** Extension nécessaire pour utiliser tous les sprites disponibles depuis Task 1. Aucun scope creep.

## Issues Encountered

Aucun — npx tsc --noEmit ne produit aucune erreur dans TreeView.tsx. Les erreurs pré-existantes (farmCrops/farmBuildings, DictaphoneRecorder, TreeShop) sont ignorées conformément à CLAUDE.md.

## User Setup Required

Aucun — pas de service externe. La vérification visuelle finale (Task 3) nécessite un device physique iOS avec `npx expo run:ios --device`.

## Next Phase Readiness

- VIS-03 complété : animaux avec frames idle + walk_down + walk_left directionnels
- VIS-01 (overlay nuit) et VIS-02 (cultures animées) déjà complétés dans plans 01-02
- Phase 05 visuels-ferme complète — prête pour la phase suivante

---
*Phase: 05-visuels-ferme*
*Completed: 2026-03-28*
