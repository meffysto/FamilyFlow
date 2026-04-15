---
phase: quick-260415-lyp
plan: 01
subsystem: mascot
tags: [companion, animation, movement, farm]
dependency_graph:
  requires: []
  provides: [organic-companion-movement]
  affects: [components/mascot/CompanionSlot.tsx]
tech_stack:
  added: []
  patterns: [weighted-random-zone-selection, walkable-zones]
key_files:
  created: []
  modified:
    - components/mascot/CompanionSlot.tsx
decisions:
  - "WalkableZone type avec poids de probabilité remplace les waypoints fixes — permet une sélection pondérée naturelle"
  - "Zone home-area (poids 4) est la favorite du compagnon — simule un comportement de repos réaliste"
  - "Micro-variation ±0.015 sur chaque destination — évite les arrêts identiques répétitifs"
  - "lastZoneIdRef empêche la répétition immédiate de zone — force la variété des déplacements"
  - "HOME_FX=0.42 / HOME_FY=0.55 comme constantes module remplacent activeRoute[HOME_IDX]"
metrics:
  duration: 8min
  completed: "2026-04-15"
  tasks: 1
  files: 1
---

# Quick Task 260415-lyp: Mouvement Naturel Compagnon Ferme

**One-liner:** Remplacement du circuit séquentiel rigide par un système de zones marchables pondérées avec destinations aléatoires et pauses variables.

## What Was Built

Le système de patrouille séquentiel (`PATROL_ROUTE`, `HOME_IDX`) a été remplacé par un moteur de mouvement organique basé sur des `WalkableZone`.

### Zones marchables

**Statiques (toujours présentes) :**
- `home-area` : x 0.38-0.48, y 0.50-0.60, poids 4, pause 2-6s — zone repos favorite
- `path-central` : x 0.38-0.46, y 0.38-0.65, poids 3, pause 1-4s — chemin vertical
- `path-south` : x 0.30-0.46, y 0.60-0.68, poids 1, pause 0.5-2s — bifurcation sud

**Dynamiques (selon état de la ferme) :**
- `crops-{fy}` : une zone par rangée de crops, positionnée à fy+0.04 (entre les rangées), poids 2
- `path-to-buildings` + `buildings-area` : zones construites seulement, poids 1 et 2
- `lake-shore` : si hasLake, rive x 0.14-0.22 y 0.63-0.78, poids 2, pause 3-6s

### Algorithme walkNext

1. Sélection pondérée parmi les zones (en excluant la dernière visitée)
2. Point aléatoire dans la zone + micro-variation ±0.015
3. `walkTo()` vers ce point (inchangé — easing sinusoidal, direction, walk animation)
4. Pause `zone.pauseMin + Math.random() * (pauseMax - pauseMin)` avant la prochaine destination

### Logique préservée

- `walkTo()` : inchangé (easing sinusoidal, détection direction, frames de marche)
- Détour récolte : déclenché quand `zone.id.startsWith('crops-')`, reset en `home-area`
- Cycle idle/walk (frame swap), bulles de message, handleTap — non modifiés
- Guard `if (paused) return;` et cleanup `mounted`/`timeouts` — préservés

## Commits

| Hash | Description |
|------|-------------|
| d7d5148 | feat(quick-260415-lyp-01): mouvement organique du compagnon avec zones marchables aléatoires |

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Known Stubs

None.

## Self-Check: PASSED

- `components/mascot/CompanionSlot.tsx` modifié et commité (d7d5148)
- `npx tsc --noEmit` : 3 erreurs pré-existantes dans `ExpeditionsSheet.tsx` uniquement — aucune nouvelle erreur introduite
