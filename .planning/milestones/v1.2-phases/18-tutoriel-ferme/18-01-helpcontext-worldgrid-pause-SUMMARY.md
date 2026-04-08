---
phase: 18-tutoriel-ferme
plan: 01
subsystem: help-context, mascot/world-grid
tags: [tutoriel, help-context, animations, reanimated, pause]
requires:
  - HelpContext existant (contexts/HelpContext.tsx)
  - WorldGridView existant (components/mascot/WorldGridView.tsx)
  - react-native-reanimated (cancelAnimation)
provides:
  - HelpContext.activeFarmTutorialStep (number | null) + setter
  - WorldGridView.paused prop pour geler toutes les animations ambiantes
affects:
  - Tous les consumers de useHelp() (aucun breaking — additions seulement)
  - Tous les callers de <WorldGridView /> (prop optionnelle, défaut false)
tech-stack:
  added: []
  patterns:
    - "cancelAnimation(sv) + reset valeur neutre pour pause withRepeat"
    - "paused propagé en prop depuis le parent vers chaque sous-composant animé"
key-files:
  created: []
  modified:
    - contexts/HelpContext.tsx
    - components/mascot/WorldGridView.tsx
decisions:
  - "State tutoriel ferme in-memory uniquement — reset au restart app (pas de SecureStore)"
  - "Propagation manuelle de paused aux 4 sous-composants animés (CropCell, BuildingCell, BuildingIdleAnim, NextExpansionCell) plutôt que contexte global — explicite et traçable"
  - "cancelAnimation suivi de reset valeur neutre (1 pour scale, 0 pour translate/rotate, 0.7 pour opacity pending) — évite freeze visuel sur frame intermédiaire"
metrics:
  duration: "~6min"
  completed: 2026-04-08
tasks_completed: 2
tasks_total: 2
files_modified: 2
---

# Phase 18 Plan 01 : HelpContext + WorldGridView paused — Summary

One-liner : Fondation câblée pour le tutoriel ferme — HelpContext expose `activeFarmTutorialStep` (session) et WorldGridView accepte un prop `paused` qui stoppe toutes les animations ambiantes via `cancelAnimation` Reanimated.

## Objectif atteint

TUTO-06 (60fps pendant tutoriel) et TUTO-08 (pas de nouveau provider, extension stricte de HelpContext) sont câblés côté infrastructure. Les autres plans de la phase 18 peuvent maintenant piloter le tutoriel sans créer de provider et geler le diorama ferme pour préserver les frames pendant les coach marks.

## Tâches

### Task 1 : HelpContext étendu

Ajouté à `HelpContextValue` :
- `activeFarmTutorialStep: number | null`
- `setActiveFarmTutorialStep: (step: number | null) => void`

Implémenté via `useState<number | null>(null)` dans `HelpProvider`, exposé dans l'objet `value` mémoïsé (avec `activeFarmTutorialStep` en deps, `setActiveFarmTutorialStep` stable). Pas de persistance SecureStore — reset au restart par design (D-09).

Aucune modification de l'API existante (`hasSeenScreen`, `markScreenSeen`, `resetScreen`, `isLoaded`, `isTemplateInstalled`, `markTemplateInstalled` intacts).

Commit : `6714480`

### Task 2 : WorldGridView.paused

Ajouté l'import `cancelAnimation` depuis `react-native-reanimated`.

Ajouté le prop `paused?: boolean` (défaut `false`) à `WorldGridViewProps` et destructuré dans le composant.

Propagé `paused` aux 4 sous-composants animés en prop explicite :
- `CropCell` : prop `paused`, gate du `withRepeat` pulse mature + `cancelAnimation(pulse)` + reset à 1
- `BuildingIdleAnim` : prop `paused`, gate des 5 animations idle (chicken, cow, mill, 2 bees) + scintillement pending + cancel sur toutes les shared values + reset valeurs neutres
- `BuildingCell` : prop `paused`, gate de 3 `withRepeat` (pestWiggle, borderPulse, pulse) + cancel + reset, et passage de `paused` à `BuildingIdleAnim`
- `NextExpansionCell` : prop `paused`, gate du `withRepeat` opacity + cancel + reset

Gate des 2 `setInterval` au niveau WorldGridView parent :
- Frame swap global (800ms) : `if (reducedMotion || paused) return;` + `paused` en deps
- Whisper global (18000ms) : `if (paused) return;` + `paused` en deps

Les 5 appels JSX aux sous-composants (`<CropCell />` × 3, `<BuildingCell />` × 2, `<NextExpansionCell />` × 2) reçoivent maintenant `paused={paused}`.

Commit : `ec989d9`

## Verification

- `npx tsc --noEmit` : clean (aucune nouvelle erreur)
- `grep "paused" components/mascot/WorldGridView.tsx` : 27 occurrences (prop + destructure + 5 gates + 5 propagations JSX + deps)
- `grep "cancelAnimation" components/mascot/WorldGridView.tsx` : import + 12 appels
- `grep "activeFarmTutorialStep" contexts/HelpContext.tsx` : 5 occurrences (type + default + state + value + deps)
- Aucune nouvelle dépendance npm (ARCH-05 respecté)

## Deviations from Plan

None — plan executed exactly as written. La seule amplification : le plan listait "3+ withRepeat" côté BuildingCell mais il y en avait précisément 3 (pestWiggle, borderPulse, pulse) plus 5 animations dans BuildingIdleAnim et 1 dans NextExpansionCell et 1 dans CropCell, soit 10 `cancelAnimation` au total. Cela reste conforme à l'intention du plan (toutes les sources `withRepeat` gated).

## Success Criteria

- [x] TUTO-06 câblé côté composant (WorldGridView peut être mis en pause)
- [x] TUTO-08 respecté (pas de nouveau provider, HelpContext étendu)
- [x] tsc clean

## Self-Check: PASSED

- FOUND: contexts/HelpContext.tsx (modifié)
- FOUND: components/mascot/WorldGridView.tsx (modifié)
- FOUND: commit 6714480
- FOUND: commit ec989d9
