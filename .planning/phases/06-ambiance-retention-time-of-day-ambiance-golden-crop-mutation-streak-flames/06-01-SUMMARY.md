---
phase: 06-ambiance-retention-time-of-day-ambiance-golden-crop-mutation-streak-flames
plan: "01"
subsystem: gamification
tags: [farm, gamification, animation, typescript, reanimated]

# Dependency graph
requires: []
provides:
  - "Mutation culture dorée dans la ferme : 3% chance à la plantation, visuel or, récompense x5"
  - "PlantedCrop.isGolden champ optionnel dans types.ts"
  - "GOLDEN_CROP_CHANCE et GOLDEN_HARVEST_MULTIPLIER exportés de farm-engine.ts"
  - "Backward-compatibility CSV 5 champs (ancien format) et 6 champs (nouveau format)"
  - "Styles goldenGlow et goldenGlowGrowing dans FarmPlots"
affects:
  - "hooks/useFarm.ts"
  - "app/(tabs)/tree.tsx"
  - "06-02 (streak flames)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation probabiliste à la plantation : Math.random() < GOLDEN_CROP_CHANCE"
    - "CSV backward-compatible : champ optionnel via destructuring (goldenFlag === '1')"
    - "Glow conditionnel : isMature && !isGolden pour vert, isGolden pour or"

key-files:
  created: []
  modified:
    - lib/mascot/types.ts
    - lib/mascot/farm-engine.ts
    - components/mascot/FarmPlots.tsx

key-decisions:
  - "Couleurs dorées (#FFD700) définies comme constantes de contenu dans StyleSheet, pas dans useThemeColors() — couleur de jeu, pas sémantique"
  - "Backward-compatibility sans migration : undefined === '1' est false, isGolden = false par défaut"
  - "goldenGrowGrowing réduit l'opacité du shadow et du borderColor pendant la croissance pour effet subtil"

patterns-established:
  - "Mutation probabiliste : constante GOLDEN_CROP_CHANCE + Math.random() dans plantCrop"
  - "CSV extension backward-compatible : destructurer le Nème champ, === '1' pour boolean"

requirements-completed: [AMB-02]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 06 Plan 01: Golden Crop Mutation Summary

**Mutation culture dorée dans la ferme : roll 3% à la plantation, liseré or #FFD700 sur FarmPlots, récompense x5 à la récolte, CSV backward-compatible**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T18:04:43Z
- **Completed:** 2026-03-28T18:07:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `PlantedCrop` étendu avec `isGolden?: boolean` — backward-compatible avec toutes les données existantes
- `plantCrop()` effectue un roll 3% à la plantation via `Math.random() < GOLDEN_CROP_CHANCE`
- `harvestCrop()` multiplie la récompense x5 (`GOLDEN_HARVEST_MULTIPLIER`) pour les cultures dorées
- `serializeCrops()` / `parseCrops()` gèrent le 6ème champ CSV, les anciens CSV à 5 champs sont désérialisés avec `isGolden = false`
- `FarmPlots` affiche un glow doré complet (`#FFD700` + shadow) pour les cultures matures dorées, et un liseré subtil pendant la croissance

## Task Commits

Chaque tâche commitée atomiquement :

1. **Task 1: Extension PlantedCrop et logique farm-engine** - `3e275c6` (feat)
2. **Task 2: Visuel doré sur FarmPlots** - `af906ba` (feat)

## Files Created/Modified
- `lib/mascot/types.ts` — ajout `isGolden?: boolean` dans `PlantedCrop`
- `lib/mascot/farm-engine.ts` — constantes `GOLDEN_CROP_CHANCE`/`GOLDEN_HARVEST_MULTIPLIER`, logique mutation dans `plantCrop`/`harvestCrop`/`serializeCrops`/`parseCrops`
- `components/mascot/FarmPlots.tsx` — styles `goldenGlow` et `goldenGlowGrowing`, rendu conditionnel matureGlow vs goldenGlow

## Decisions Made
- Couleurs dorées (`#FFD700`) définies directement dans le StyleSheet comme constantes de contenu (pas `useThemeColors()`) — couleur de jeu/cosmétique, pas sémantique du thème
- Backward-compatibility sans migration de données : `undefined === '1'` est `false`, donc les cultures existantes ont `isGolden = false` automatiquement
- Haptics sur plantation dorée non implémenté (instruction du plan : skip si flow complexe) — le visuel seul suffit

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Issues Encountered

None.

## User Setup Required

None — aucune configuration externe requise.

## Next Phase Readiness
- Mutation dorée opérationnelle de bout en bout — prêt pour plan 06-02 (streak flames)
- `GOLDEN_CROP_CHANCE` et `GOLDEN_HARVEST_MULTIPLIER` exportés, peuvent être référencés dans les tests ou d'autres modules

---
*Phase: 06-ambiance-retention-time-of-day-ambiance-golden-crop-mutation-streak-flames*
*Completed: 2026-03-28*
