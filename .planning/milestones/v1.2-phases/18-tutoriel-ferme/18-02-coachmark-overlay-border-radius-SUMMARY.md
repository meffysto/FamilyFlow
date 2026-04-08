---
phase: 18
plan: 02
subsystem: help/coachmark
tags: [coachmark, overlay, tutorial, border-radius, retrocompat]
requires: []
provides:
  - "CoachMarkOverlay.borderRadius prop"
  - "cutout spotlight aux coins arrondis sans SVG"
affects:
  - "components/help/CoachMarkOverlay.tsx"
tech-stack:
  added: []
  patterns:
    - "borderWidth géant pour obtenir un cutout arrondi via une seule View (D-05bis, ARCH-05)"
key-files:
  created: []
  modified:
    - "components/help/CoachMarkOverlay.tsx"
decisions:
  - "Option B (borderWidth géant) retenue : une seule View avec borderRadius + borderWidth = max(screen) — zéro dépendance, rétrocompat garantie via branche historique 4-Views"
  - "borderRadius=0 préserve intégralement la technique 4-Views historique pour ne rien casser côté dashboard/tasks"
metrics:
  duration: "3min"
  completed: "2026-04-08"
  tasks: 1
  files_modified: 1
requirements: [TUTO-04]
---

# Phase 18 Plan 02: CoachMarkOverlay borderRadius Summary

## One-liner

CoachMarkOverlay accepte désormais un prop optionnel `borderRadius` qui bascule sur une technique borderWidth géant pour obtenir un cutout aux coins arrondis sans SVG, en conservant la branche 4-Views historique pour la rétrocompatibilité.

## What was built

- Ajout du prop `borderRadius?: number` (défaut 0) à `CoachMarkOverlayProps`
- Nouvelle branche de rendu conditionnelle (`if borderRadius > 0`) utilisant une View unique avec `borderRadius` + `borderWidth = max(screenWidth, screenHeight)` et `borderColor: OVERLAY_COLOR`
- Documentation JSDoc du composant mise à jour pour expliquer la technique "borderWidth géant"
- Branche historique 4-Views conservée inchangée pour les consommateurs actuels (dashboard, tasks, etc.)

## Files Modified

| File | Change |
|------|--------|
| `components/help/CoachMarkOverlay.tsx` | +35 / -1 : nouveau prop `borderRadius`, nouvelle branche cutout arrondi |

## Verification

- `grep "borderRadius?: number"` → trouvé ligne 29 (interface prop)
- `grep -c "borderRadius"` → 5+ occurrences (doc, interface, destructure, garde, style)
- `grep "react-native-svg"` → 0 résultats (D-05bis respecté)
- `npx tsc --noEmit` → exit code 0 (aucune erreur)
- Rétrocompat : les appelants existants sans `borderRadius` prop continuent de passer par la technique 4-Views historique (aucune modification observable)

## Deviations from Plan

None - plan executed exactly as written. Le fichier était déjà dans l'état cible (modifications non committées d'une session précédente), la vérification des critères d'acceptation a confirmé la conformité et la tâche a été committée telle quelle.

## Known Stubs

None.

## Commits

- `2139474` feat(18-02): ajoute borderRadius optionnel à CoachMarkOverlay

## Self-Check: PASSED

- FOUND: components/help/CoachMarkOverlay.tsx
- FOUND commit: 2139474
