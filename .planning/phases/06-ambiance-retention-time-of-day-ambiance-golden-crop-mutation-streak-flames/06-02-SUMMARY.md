---
phase: 06-ambiance-retention-time-of-day-ambiance-golden-crop-mutation-streak-flames
plan: 02
subsystem: ui
tags: [react-native-reanimated, mascot, ambiance, streak, animations, time-of-day]

# Dependency graph
requires: []
provides:
  - "lib/mascot/ambiance.ts: getTimeSlot(), AMBIENT_CONFIGS, TimeSlot, AmbiantConfig"
  - "AmbientParticles: overlay particules horaires sur le diorama (rosee matin, lucioles nuit)"
  - "StreakFlames: flammes animees sous le diorama basees sur STREAK_MILESTONES"
  - "Integration tree.tsx: AmbientParticles (zIndex:5) + StreakFlames entre FarmStats et WeeklyGoal"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Logique pure ambiance horaire dans lib/mascot/ sans import React"
    - "Overlay absoluteFill avec pointerEvents=none pour particules non-bloquantes"
    - "useReducedMotion guard: render statique si Reduce Motion active"
    - "Tier calcule dynamiquement depuis STREAK_MILESTONES (pas de valeurs hardcodees)"

key-files:
  created:
    - lib/mascot/ambiance.ts
    - components/mascot/AmbientParticles.tsx
    - components/mascot/StreakFlames.tsx
  modified:
    - app/(tabs)/tree.tsx

key-decisions:
  - "AmbientParticles utilise une largeur generique (390) car le composant est absoluteFill dans un parent de taille connue"
  - "StreakFlames tier = STREAK_MILESTONES.length - milestoneIdx pour eviter valeurs hardcodees"
  - "Lucioles (nuit) detectees par color === '#AAFF66' pour le glow shadowColor iOS"

patterns-established:
  - "Pattern ambiance pure: lib/mascot/*.ts sans React, composant UI importe la config"
  - "useReducedMotion guard en haut du useEffect, pas de branche conditionnelle de hook"

requirements-completed: [AMB-01, AMB-03]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 06 Plan 02: Ambiance Horaire + Flammes Streak Summary

**Particules de rosee le matin, lucioles la nuit et flammes de streak animees sur l'ecran arbre avec tint colore par moment de la journee et desactivation useReducedMotion**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T18:00:00Z
- **Completed:** 2026-03-28T18:06:46Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- `lib/mascot/ambiance.ts` — logique pure: getTimeSlot() (5 tranches horaires), AMBIENT_CONFIGS (matin/jour/soir/nuit avec jour=null), types exports
- `AmbientParticles.tsx` — overlay absoluteFill pointerEvents=none avec particules animees (chute matin, float nuit/soir), colorOverlay tint, useReducedMotion guard
- `StreakFlames.tsx` — flammes 1-4 selon tier calcule depuis STREAK_MILESTONES, animation scale+opacity avec delay par index, tier 4 = diamant
- `tree.tsx` — AmbientParticles integre a zIndex:5 dans le diorama, StreakFlames entre FarmStats et WeeklyGoal

## Task Commits

1. **Task 1: Creer lib/mascot/ambiance.ts et composants AmbientParticles + StreakFlames** - `25855ad` (feat)
2. **Task 2: Integrer AmbientParticles et StreakFlames dans tree.tsx** - `d9b6224` (feat)

## Files Created/Modified

- `lib/mascot/ambiance.ts` — logique pure time-slot + configs particules par moment
- `components/mascot/AmbientParticles.tsx` — overlay particules ambiantes horaires
- `components/mascot/StreakFlames.tsx` — flammes animees selon tier de streak
- `app/(tabs)/tree.tsx` — integration des deux composants dans le diorama et sous le diorama

## Decisions Made

- Largeur containerWidth=390 dans AmbientParticles car le composant est absoluteFill — valeur generique correcte pour iPhone standard
- Detection lucioles par `particleColor === '#AAFF66'` pour appliquer le glow iOS (shadowColor)
- Tier StreakFlames = `STREAK_MILESTONES.length - milestoneIdx` pour rester dynamique si les paliers changent

## Deviations from Plan

None — plan execute exactement tel qu'ecrit.

## Issues Encountered

None — TypeScript compile sans nouvelles erreurs. Erreurs pre-existantes ignorees (TreeShop, docs/family-flow-promo.tsx, lib/__tests__/).

## User Setup Required

None — aucune configuration externe requise.

## Next Phase Readiness

- Ambiance horaire et flammes streak livrees, prets pour la suite de la phase 06
- Composants respectent useReducedMotion et pointerEvents=none (aucun impact sur l'interactivite du diorama)

---
*Phase: 06-ambiance-retention-time-of-day-ambiance-golden-crop-mutation-streak-flames*
*Completed: 2026-03-28*
