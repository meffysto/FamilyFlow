---
phase: 11-sagas-immersives
plan: "02"
subsystem: ui
tags: [react-native, reanimated, mascot, sagas, visitor, diorama, animations]

requires:
  - phase: 11-01
    provides: "VisitorSlot component avec 5 états (entering/idle/reacting/departing/departed), ReactionType type, sprites voyageur"

provides:
  - "SagaWorldEvent refactorisé avec portrait sprite voyageur (visitorIdleFrame) au lieu du spiritGlow emoji"
  - "Callback onChoiceReaction dans SagaWorldEvent — remonte le type de réaction (joy/surprise/mystery) au parent"
  - "VisitorSlot intégré dans tree.tsx (couche 3.6 du diorama) avec orchestration complète tap→dialogue→réaction→départ"
  - "Bouton 'Saga en attente' supprimé — remplacé par tap sur VisitorSlot dans la scène"

affects: [tree, sagas, diorama, gamification]

tech-stack:
  added: []
  patterns:
    - "Orchestration départ-réaction en 2 states (visitorShouldDepart + visitorReaction) — séquence événementielle via callbacks onReactionComplete/onDepartComplete"
    - "Portrait sprite conditionnel dans SagaWorldEvent — fallback spiritGlow préservé si visitorIdleFrame absent"
    - "reactionForChoice() helper pur — mapping trait dominant SagaChoice → ReactionType (joy/surprise/mystery)"

key-files:
  created: []
  modified:
    - "components/mascot/SagaWorldEvent.tsx"
    - "app/(tabs)/tree.tsx"

key-decisions:
  - "reactionForChoice utilise le trait dominant du choice.traits dict (sorted by value desc) pour mapper vers joy/surprise/mystery — fallback par index si aucun trait"
  - "handleSagaDismiss déclenche setVisitorShouldDepart(true) directement si pas de réaction en cours, sinon délègue au onReactionComplete du VisitorSlot"
  - "VisitorSlot en couche 3.6 avec zIndex conditionnel (20 si showSagaEvent, 3 sinon) pour éviter que le visiteur se retrouve devant le dialogue saga"
  - "Import de VISITOR_IDLE_FRAME en require() au niveau module — même sprite que VisitorSlot idle_1.png pour cohérence visuelle portrait/diorama"

patterns-established:
  - "Pattern orchestration visiteur: 2 states orthogonaux (reaction vs départ) avec callbacks en cascade (onReactionComplete → setVisitorShouldDepart)"
  - "Pattern portrait conditionnel: composant UI accepte prop optionnelle pour override visuel avec fallback vers comportement original"

requirements-completed:
  - SAG-02
  - SAG-04

duration: 3min
completed: 2026-04-03
---

# Phase 11 Plan 02: Intégration VisitorSlot + Refacto SagaWorldEvent Summary

**Portrait sprite voyageur dans SagaWorldEvent (remplace spiritGlow emoji) + VisitorSlot intégré dans le diorama avec séquence tap→dialogue→réaction joy/surprise/mystery→départ**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T12:33:44Z
- **Completed:** 2026-04-03T12:37:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- SagaWorldEvent accepte maintenant `visitorIdleFrame` (ImageSourcePropType) et affiche le sprite du voyageur comme portrait au lieu de l'emoji spiritGlow — fallback spiritGlow préservé
- Callback `onChoiceReaction` ajouté à SagaWorldEvent — appelé avec `reactionForChoice()` (mapping trait dominant → joy/surprise/mystery) au moment du tap sur un choix
- VisitorSlot intégré en couche 3.6 dans tree.tsx — tap sur le visiteur ouvre SagaWorldEvent, réaction animée visible dans la scène, puis départ en marchant
- Bouton flottant "Saga en attente" supprimé — l'interaction passe exclusivement par le VisitorSlot dans le diorama

## Task Commits

1. **Task 1: Refactorer SagaWorldEvent — portrait sprite voyageur + callback onChoiceReaction** - `9996888` (feat)
2. **Task 2: Intégrer VisitorSlot dans tree.tsx + orchestration arrivée/dialogue/réaction/départ** - `2564b93` (feat)

## Files Created/Modified
- `components/mascot/SagaWorldEvent.tsx` — ajout visitorIdleFrame prop, onChoiceReaction callback, reactionForChoice helper, portrait conditionnel, style visitorPortrait
- `app/(tabs)/tree.tsx` — import VisitorSlot + ReactionType, VISITOR_IDLE_FRAME constant, states visitorShouldDepart/visitorReaction, VisitorSlot couche 3.6, handleChoiceReaction/handleSagaDismiss callbacks, suppression bouton saga

## Decisions Made
- `reactionForChoice()` défini comme fonction pure au niveau module (pas dans le composant) — mapping trait dominant vers ReactionType via liste d'inclusions, fallback par index du choix
- `handleSagaDismiss` gère les deux cas : sans réaction → départ immédiat ; avec réaction → le départ est délégué à `onReactionComplete` du VisitorSlot après l'animation
- zIndex conditionnel sur le conteneur VisitorSlot (20 si `showSagaEvent`, 3 sinon) — évite la superposition visible du visiteur sur le dialogue saga ouvert
- Reset de `visitorShouldDepart` et `visitorReaction` dans le useEffect sur `profile?.id` pour éviter des états fantômes lors du changement de profil

## Deviations from Plan

None — plan exécuté exactement comme spécifié.

## Issues Encountered

None.

## Known Stubs

None — le portrait visitorIdleFrame pointe vers le sprite placeholder idle_1.png existant (déjà tracé dans 11-01-SUMMARY comme TODO remplacement par vrais sprites PixelLab). Le comportement fonctionnel est complet.

## Next Phase Readiness
- Expérience immersive saga complète : visiteur apparaît dans la scène, dialogue s'ouvre au tap, réaction animée aux choix, départ après interaction
- Plan 11-03 (DashboardGarden) est déjà complété selon STATE.md
- Phase 11 (sagas-immersives) est fonctionnellement complète

---
*Phase: 11-sagas-immersives*
*Completed: 2026-04-03*
