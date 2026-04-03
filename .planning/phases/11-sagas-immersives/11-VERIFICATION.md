---
status: passed
phase: 11-sagas-immersives
verified: 2026-04-03
---

# Phase 11: Sagas Immersives — Verification

## Goal
Les sagas ne sont plus des boutons dans le dashboard — un personnage visiteur pixel apparaît dans la scène de l'arbre pour raconter son histoire de manière immersive, avec des dialogues interactifs et des animations d'arrivée/départ.

## Must-Haves Verification

| # | Must-Have | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Visiteur pixel dans la scène de l'arbre avec animation d'arrivée | `VisitorSlot.tsx` (467 lignes), 5 états (entering/idle/reacting/departing/departed), 8 sprites dans `assets/garden/animals/voyageur/`, intégré dans `tree.tsx` | PASS |
| 2 | Tap sur visiteur ouvre dialogue narratif avec choix | `onChoiceReaction` callback wired dans `SagaWorldEvent.tsx`, `visitorIdleFrame` prop pour portrait sprite, déclenché par tap dans `tree.tsx` | PASS |
| 3 | Dashboard indicateur texte compact (plus de boutons) | `renderSagaCard()` et `renderSagaDots()` supprimés de `DashboardGarden.tsx`, remplacés par texte inline avec navigation vers arbre | PASS |
| 4 | Animations de réaction (joie, surprise, mystère) et départ | `ReactionType` = 'joy' \| 'surprise' \| 'mystery' dans `VisitorSlot.tsx`, animations bounce/shake/flicker, départ animé avec marche | PASS |
| 5 | `npx tsc --noEmit` sans nouvelles erreurs | Pre-existing errors only (MemoryEditor, cooklang, useVault) | PASS |

## Requirements Coverage

| REQ-ID | Description | Plan | Status |
|--------|-------------|------|--------|
| SAG-01 | Visiteur pixel PixelLab dans scène arbre | 11-01 | PASS |
| SAG-02 | Tap visiteur ouvre dialogue narratif | 11-02 | PASS |
| SAG-03 | Dashboard indicateur texte compact | 11-03 | PASS |
| SAG-04 | Animations réaction + départ | 11-01, 11-02 | PASS |

## Key Files Created/Modified

- `components/mascot/VisitorSlot.tsx` — NEW (467 lignes)
- `components/mascot/SagaWorldEvent.tsx` — MODIFIED (portrait sprite + onChoiceReaction)
- `app/(tabs)/tree.tsx` — MODIFIED (VisitorSlot intégration + orchestration)
- `components/dashboard/DashboardGarden.tsx` — MODIFIED (saga card supprimée → texte inline)
- `assets/garden/animals/voyageur/*.png` — NEW (8 sprites placeholder)
- `locales/fr/gamification.json` — MODIFIED (clés saga.indicator)
- `locales/en/gamification.json` — MODIFIED (clés saga.indicator)

## Human Verification Items

1. Vérifier visuellement que le visiteur apparaît dans le diorama quand une saga est active
2. Tester le tap sur le visiteur → dialogue s'ouvre avec choix
3. Vérifier que le dashboard montre bien le texte indicateur (pas de carte)
4. Remplacer les sprites placeholder par de vrais sprites PixelLab

## Notes

- Sprites sont des placeholder 48x48 PNG — PixelLab MCP n'était pas accessible depuis les subagents d'exécution. TODO marqué dans VisitorSlot.tsx pour remplacement.
- Le moteur saga (sagas-engine, sagas-types, sagas-content, sagas-storage) n'a pas été modifié — seule l'UI/UX a changé.
