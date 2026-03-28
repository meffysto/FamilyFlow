---
phase: 05-visuels-ferme
plan: 01
subsystem: ui
tags: [react-native-reanimated, animation, mascot, ambient, diorama]

# Dependency graph
requires:
  - phase: 05-visuels-ferme
    provides: AmbientParticles base component avec getTimeSlot statique et particules animees
provides:
  - AmbientParticles avec re-polling du slot horaire toutes les 60s
  - Transition animee de couleur overlay via withTiming(2000)
  - Gestion du slot jour sans return null (opacite anime a 0)
affects:
  - 05-visuels-ferme (plans suivants dependant de AmbientParticles)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-polling reactif via setInterval + useState pour les donnees dependantes de l'heure"
    - "Animation de couleur RGBA via 4 useSharedValue separes (R, G, B, A) avec withTiming"
    - "parseRgba helper pour decomposer les couleurs rgba en composantes numeriques"
    - "useReducedMotion : appliquer valeur directe (sans withTiming) si Reduce Motion actif"

key-files:
  created: []
  modified:
    - components/mascot/AmbientParticles.tsx

key-decisions:
  - "Animer la couleur overlay via 4 shared values RGBA separees plutot qu'une interpolation string — compatible avec Reanimated worklets"
  - "Toujours rendre l'Animated.View overlay (jamais return null) — l'opacite anime a 0 cache le tint sans interrompre la transition"
  - "setTimeSlot avec guard prev === newSlot pour eviter re-renders inutiles entre deux polls"

patterns-established:
  - "Pattern RGBA anime: overlayR/G/B/A useSharedValue + useAnimatedStyle generant rgba(${Math.round(r)}, ..., a)"

requirements-completed: [VIS-01]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 05 Plan 01: Visuels Ferme — Cycle Jour/Nuit Anime Summary

**Overlay couleur du diorama anime en fondu 2s via 4 shared values RGBA avec re-polling du slot horaire toutes les 60 secondes**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-28T20:59:46Z
- **Completed:** 2026-03-28T21:01:00Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- Remplacement du `useMemo(() => getTimeSlot(), [])` statique par `useState(() => getTimeSlot())` reactif
- Ajout d'un `setInterval` toutes les 60 secondes pour detecter les changements de slot horaire en temps reel
- Transition de couleur overlay progressive via 4 shared values RGBA (`overlayR`, `overlayG`, `overlayB`, `overlayA`) animees avec `withTiming({ duration: 2000 })`
- Slot jour (config === null) : l'overlay anime vers opacite 0 au lieu de `return null`, preservant la continuite de l'animation
- Respect de `useReducedMotion` : transition instantanee (sans `withTiming`) si Reduce Motion est active

## Task Commits

1. **Task 1: Ajouter re-polling du slot horaire et transition animee dans AmbientParticles** - `b3e224f` (feat)

**Plan metadata:** _(voir commit docs ci-dessous)_

## Files Created/Modified

- `components/mascot/AmbientParticles.tsx` - Re-polling 60s, overlay RGBA anime avec withTiming(2000), gestion slot jour sans return null

## Decisions Made

- Animer la couleur overlay via 4 shared values RGBA separees plutot qu'une interpolation string — les worklets Reanimated ne supportent pas la concatenation de strings dynamiques dans `useAnimatedStyle`
- Toujours rendre l'`Animated.View` overlay (pas conditionnel sur `config !== null`) — permet un fondu entrant/sortant fluide quand on passe au/depuis le slot jour
- Guard `prev === newSlot ? prev : newSlot` dans le `setInterval` pour eviter des re-renders et re-animations inutiles si le slot n'a pas change

## Deviations from Plan

None — plan execute exactement tel qu'ecrit.

## Issues Encountered

None.

## User Setup Required

None — aucune configuration externe requise.

## Next Phase Readiness

- `AmbientParticles.tsx` desormais reactif au passage du temps — pret pour les plans suivants de la phase 05
- L'overlay anime fonctionne independamment des particules, pas de regression sur le rendu existant
- `npx tsc --noEmit` : aucune nouvelle erreur (erreurs pre-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts ignorees)

---
*Phase: 05-visuels-ferme*
*Completed: 2026-03-28*
