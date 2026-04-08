---
phase: 13-evenements-saisonniers
plan: "02"
subsystem: ui
tags: [react-native, reanimated, seasonal-events, visitor-slot, saga-world-event, tree-screen]

# Dependency graph
requires:
  - phase: 13-01
    provides: SeasonalEventProgress types, engine (getVisibleEventId, buildSeasonalEventAsSaga, drawGuaranteedSeasonalReward), storage (loadEventProgressList, saveEventProgress), content (getEventContent)
  - phase: 11-sagas-immersives
    provides: VisitorSlot, SagaWorldEvent, tree.tsx diorama architecture

provides:
  - VisitorSlot accepte targetFX/targetFY optionnels pour position personnalisée (backward-compatible)
  - SagaWorldEvent accepte overrideSaga pour bypasser getSagaById (utilisé par les événements)
  - tree.tsx orchestre le second visiteur événementiel côté gauche (targetFX=0.28) + dialogue + récompenses

affects:
  - phase 13 (vérification UI)
  - tout futur travail sur VisitorSlot ou SagaWorldEvent

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second VisitorSlot côté gauche (targetFX=0.28) coexistant avec le visiteur saga côté droit (targetFX=0.72)"
    - "overrideSaga pour bypasser getSagaById() dans SagaWorldEvent — événements courts à chapitre unique"
    - "pointerEvents mutuellement exclusifs entre sagaEvent et eventDialogue"
    - "handleEventComplete délègue à completeSagaChapter pour les XP — réutilise la queue d'écriture existante"
    - "buildSeasonalEventAsSaga appelé dans le render (calcul léger, pas de side-effect)"

key-files:
  created: []
  modified:
    - components/mascot/VisitorSlot.tsx
    - components/mascot/SagaWorldEvent.tsx
    - app/(tabs)/tree.tsx

key-decisions:
  - "handleEventComplete réutilise completeSagaChapter pour les XP — évite de dupliquer la logique de queue d'écriture"
  - "buildSeasonalEventAsSaga appelé dans le render (pas de useMemo) — calcul léger acceptable pour un seul composant conditionnel"
  - "overrideSaga prop ajoutée sur SagaWorldEvent au lieu de refactorer getSagaById — changement minimal sans risque de régression"
  - "pointerEvents du visiteur saga conditionné par showEventDialogue (et vice versa) — coexistence sans conflit de tap"

patterns-established:
  - "VisitorSlot: props targetFX/targetFY pour position personnalisée — défaut conserve le comportement droit existant"
  - "SagaWorldEvent: overrideSaga prop — pattern bypass pour sagas synthétiques (événements)"

requirements-completed: [EVT-01, EVT-02, EVT-03]

# Metrics
duration: 8min
completed: 2026-04-03
---

# Phase 13 Plan 02: Câblage UI Événements Saisonniers Summary

**Visiteur pixel événementiel côté gauche du diorama + dialogue SagaWorldEvent avec overrideSaga + complétion XP/persistance SecureStore via VisitorSlot étendu (targetFX/targetFY)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-03T18:35:00Z
- **Completed:** 2026-04-03T18:43:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- VisitorSlot étendu avec targetFX/targetFY optionnels — backward-compatible, aucun usage existant modifié
- SagaWorldEvent étendu avec overrideSaga?: Saga — bypass getSagaById pour les sagas synthétiques d'événements
- tree.tsx: second visiteur événementiel côté gauche (targetFX=0.28), chargement SecureStore au focus profil, handleEventComplete avec récompense garantie + XP via completeSagaChapter, dialogue SagaWorldEvent complet, pointerEvents mutuellement exclusifs

## Task Commits

1. **Task 1: Étendre VisitorSlot + SagaWorldEvent** - `bea9a4b` (feat)
2. **Task 2: Câbler le visiteur événementiel dans tree.tsx** - `b06cdd8` (feat)

## Files Created/Modified

- `components/mascot/VisitorSlot.tsx` — Ajout props targetFX/targetFY optionnelles, TARGET_X/TARGET_Y utilisent (prop ?? constante)
- `components/mascot/SagaWorldEvent.tsx` — Import type Saga, ajout overrideSaga?: Saga, activeSaga = overrideSaga ?? getSagaById()
- `app/(tabs)/tree.tsx` — Imports événements saisonniers, état + useEffect event visitor, calcul activeEventId/activeEventContent, handleEventComplete, couches 3.7 (VisitorSlot) et 5.1 (SagaWorldEvent) dans le diorama

## Decisions Made

- **handleEventComplete délègue à completeSagaChapter** : réutilise la queue d'écriture enqueueWrite existante (race-condition safe) plutôt que d'écrire directement dans famille.md
- **buildSeasonalEventAsSaga dans le render** : calcul léger (pas de I/O), acceptable sans useMemo pour un composant conditionnel rare
- **overrideSaga minimal** : 2 modifications dans SagaWorldEvent, zéro changement de comportement pour les sagas existantes

## Deviations from Plan

None — plan exécuté exactement comme écrit. La résolution d'un conflit de merge dans STATE.md (stash vs upstream) a été traitée en gardant la version la plus récente (upstream avec statut de complétion 13-01).

## Issues Encountered

- Conflit de merge dans `.planning/STATE.md` (stash vs upstream) au moment du commit. Résolu en gardant la version upstream (plus récente — mentionne la complétion de 13-01).

## Known Stubs

Aucun stub bloquant. Le visiteur événementiel utilise les sprites du voyageur (idle_1.png) comme frame par défaut — c'est intentionnel (sprites dédiés à créer dans une future phase PixelLab).

## Next Phase Readiness

- Le flux complet événement saisonnier est câblé : détection calendaire → visiteur pixel (gauche) → dialogue interactif → récompense garantie + XP → persistance SecureStore → disparition
- Les visiteurs saga (droite) et événement (gauche) coexistent sans conflit de tap
- Prêt pour la vérification UI en conditions réelles (activer un événement test dans seasonal.ts)

---
*Phase: 13-evenements-saisonniers*
*Completed: 2026-04-03*
