---
phase: 33-exp-ditions
plan: 03
subsystem: ui
tags: [react-native, expo, reanimated, haptics, expedition, farm, mascot]

# Dependency graph
requires:
  - phase: 33-01
    provides: expedition-engine.ts (logique pure pool/roll/loot/timer)
  - phase: 33-02
    provides: useExpeditions hook (launchExpedition, collectExpedition, dismissExpedition, dailyPool, activeExpeditions)
provides:
  - ExpeditionsSheet.tsx : modal pageSheet 3 onglets (Catalogue / En cours / Résultats)
  - CampExplorationCell.tsx : cellule ferme avec badge actif + countdown + pulse Retour!
  - ExpeditionChest.tsx : coffre animé tap-to-open avec haptics + reveal + étoiles rare
  - tree.tsx câblé : Camp visible sur la ferme, modal ouvert depuis le Camp, coffre ouvert après collecte
affects: [33-exp-ditions, v1.5-village-vivant]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AwningStripes copié depuis BuildingsCatalog (Farm chrome header)
    - Tab indicator withTiming translateX 150ms (pattern UI-SPEC)
    - SPRING_CATALOG/SPRING_CHEST comme constantes module const as const
    - CampExplorationCell positionné en absolu sur le diorama via CAMP_EXPLORATION_CELL.x/y * container dims
    - handleCollectExpedition : ferme modal → délai 300ms → ouvre coffre (séquence sans collision modale)
    - Countdown ticker via useEffect + setInterval 60s dans ExpeditionsSheet

key-files:
  created:
    - components/mascot/ExpeditionsSheet.tsx
    - components/mascot/CampExplorationCell.tsx
    - components/mascot/ExpeditionChest.tsx
  modified:
    - app/(tabs)/tree.tsx

key-decisions:
  - "CampExplorationCell exporté depuis son propre fichier (pas tree.tsx) — pattern identique BuildingSprite"
  - "handleCollectExpedition : délai 300ms entre fermeture modal et ouverture coffre — évite collision animation iOS pageSheet + Modal transparent"
  - "CAMP_EXPLORATION_CELL réexporté depuis CampExplorationCell.tsx pour éviter double import dans tree.tsx"

patterns-established:
  - "ExpeditionChest : état `opened` interne + reset dans useEffect[visible] — pattern coffre isolé réutilisable"
  - "CampExplorationCell : withRepeat(withSequence) pour pulse animation badge retour"

requirements-completed: [VILL-16, VILL-17, VILL-18, VILL-19, VILL-20]

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 33 Plan 03: Composants UI Expéditions + Intégration tree.tsx Summary

**Modal expéditions pageSheet 3 onglets + cellule ferme animée + coffre tap-to-open avec haptics, câblés dans tree.tsx**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T21:34:49Z
- **Completed:** 2026-04-14T21:38:36Z
- **Tasks:** 2/3 (Task 3 = checkpoint humain, en attente)
- **Files modified:** 4

## Accomplishments

- ExpeditionsSheet.tsx : modal pageSheet 3 onglets avec AwningStripes Farm, countdown 60s, pity note, cards mission avec coûts + bouton Lancer
- CampExplorationCell.tsx : cellule 64px avec badge "1/2", badge "Retour !" + pulse withRepeat, mini countdown
- ExpeditionChest.tsx : overlay fullscreen tap-to-open, spring scale, haptics Success/Error/Heavy, reveal opacity, 4 étoiles staggerées pour rare_discovery
- tree.tsx : imports + state showExpeditions/chestData + hook useExpeditions + CampExplorationCell sur diorama (couche 8) + ExpeditionsSheet + ExpeditionChest câblés

## Task Commits

1. **Task 1: Composants UI** - `d9b9bff` (feat)
2. **Task 2: Intégration tree.tsx** - `08ba4d0` (feat)
3. **Task 3: Vérification humaine** - en attente checkpoint

## Files Created/Modified

- `components/mascot/ExpeditionsSheet.tsx` - Modal 3 onglets catalogue/en cours/résultats
- `components/mascot/CampExplorationCell.tsx` - Cellule ferme avec badges et pulse animation
- `components/mascot/ExpeditionChest.tsx` - Coffre animé reveal résultat expédition
- `app/(tabs)/tree.tsx` - Intégration complète expéditions (imports, state, hook, JSX)

## Decisions Made

- Délai 300ms entre fermeture ExpeditionsSheet et ouverture ExpeditionChest pour éviter collision animation iOS
- CampExplorationCell positionné en absolu sur le diorama via CAMP_EXPLORATION_CELL.x/y * dimensions conteneur (même pattern que PortalSprite Phase 29)
- Tab indicator `withTiming 150ms` sur translateX (UI-SPEC respect strict)

## Deviations from Plan

None - plan exécuté exactement comme spécifié.

## Issues Encountered

None — TypeScript propre dès la première compilation sur tous les fichiers.

## Known Stubs

None — tous les composants sont câblés aux données réelles via useExpeditions hook.

## Next Phase Readiness

- Système expéditions complet côté code — attend validation visuelle sur device iOS (Task 3 checkpoint)
- Task 3 checkpoint requis : vérifier Camp visible en bas-gauche de la ferme, modal catalogue avec 3 missions, lancement + timer, collecte coffre animé, persistance restart

---
*Phase: 33-exp-ditions*
*Completed: 2026-04-14*
