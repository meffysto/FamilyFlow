---
phase: 01-safety-net
plan: 04
subsystem: testing
tags: [maestro, e2e, mobile-testing, expo, react-native]

# Dependency graph
requires:
  - phase: 01-safety-net
    provides: "Unit tests and project baseline established"
provides:
  - "Maestro CLI 1.40.0 installé"
  - "3 flows E2E exécutables couvrant dashboard, tâches, et repas"
  - ".maestro/config.yaml avec appId com.familyvault.dev"
affects: [refactoring, regression-detection]

# Tech tracking
tech-stack:
  added: [maestro-cli 1.40.0]
  patterns: [yaml-e2e-flows, launchApp-assertVisible-tapOn]

key-files:
  created:
    - .maestro/config.yaml
    - .maestro/flows/dashboard-navigation.yaml
    - .maestro/flows/task-completion.yaml
    - .maestro/flows/meal-planning.yaml
  modified: []

key-decisions:
  - "Flows utilisent les labels de tabs visibles (Aujourd'hui, Tâches, Menu) plutôt que testID — sélecteurs stables sans modifier le code source"
  - "meal-planning utilise runFlow conditionnel car l'écran repas est hidden (href: null) accessible via Menu"
  - "task-completion utilise runFlow conditionnel pour robustesse — fonctionne même sans données de tâches"

patterns-established:
  - "Pattern Maestro: launchApp + assertVisible + tapOn sur texte visible"
  - "Pattern conditionnel: runFlow when visible pour interactions optionnelles"

requirements-completed: [TEST-07]

# Metrics
duration: 15min
completed: 2026-03-28
---

# Phase 01 Plan 04: Tests E2E Maestro Summary

**Maestro CLI 1.40.0 installé avec 3 flows E2E couvrant navigation dashboard, complétion tâches, et planification repas — en attente de validation sur simulateur**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-28T19:00:00Z
- **Completed:** 2026-03-28T19:15:00Z (Task 1 — checkpoint atteint pour Task 2)
- **Tasks:** 1/2 (Task 2 est un checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments
- Maestro CLI 1.40.0 installé via script officiel
- .maestro/config.yaml créé avec appId: com.familyvault.dev
- Flow dashboard-navigation: launchApp + navigation entre 5 onglets (Aujourd'hui, Tâches, Journal, Calendrier, Menu) + retour
- Flow task-completion: navigation vers tâches + interaction conditionnelle robuste + retour dashboard
- Flow meal-planning: navigation via Menu + accès conditionnel à l'écran Repas

## Task Commits

1. **Task 1: Installer Maestro et créer 3 flows E2E** - `90c27a3` (feat)

## Files Created/Modified
- `.maestro/config.yaml` - Configuration Maestro avec appId de l'app dev
- `.maestro/flows/dashboard-navigation.yaml` - Flow E2E navigation entre onglets principaux
- `.maestro/flows/task-completion.yaml` - Flow E2E interactions avec les tâches
- `.maestro/flows/meal-planning.yaml` - Flow E2E navigation vers l'écran repas via Menu

## Decisions Made
- Sélecteurs basés sur le texte visible (`Aujourd'hui`, `Tâches`, `Menu`) plutôt que testID — évite de modifier le code source et reste aligné sur les labels i18n fr
- `meal-planning` utilise `runFlow when visible` car l'écran repas est `href: null` (caché dans la tab bar) — accessible depuis le tab Menu
- `task-completion` utilise interaction conditionnelle pour robustesse en cas de vault vide

## Deviations from Plan

None - plan exécuté exactement comme spécifié.

## Issues Encountered
- `curl -Ls "https://get.maestro.mobile.dev" | bash` a échoué (RTK filtre la sortie) — résolu en téléchargeant le script dans un fichier temporaire puis en l'exécutant

## User Setup Required

None - pas de configuration de service externe requise pour Maestro.

## Next Phase Readiness
- Task 2 (checkpoint:human-verify) : L'utilisateur doit valider les flows sur simulateur
- Commande : `export PATH="$PATH":"$HOME/.maestro/bin" && maestro test .maestro/flows/`
- L'app doit être lancée sur simulateur avec `npx expo run:ios`

---
*Phase: 01-safety-net*
*Completed: 2026-03-28*
