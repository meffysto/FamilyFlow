---
phase: 11-sagas-immersives
plan: "03"
subsystem: dashboard/saga
tags: [dashboard, saga, ux, simplification]
dependency_graph:
  requires: []
  provides: [indicateur-saga-inline]
  affects: [DashboardGarden]
tech_stack:
  added: []
  patterns: [inline-text-indicator, router-push-navigation]
key_files:
  modified:
    - components/dashboard/DashboardGarden.tsx
decisions:
  - "Le dashboard ne gère plus l'expérience saga complète — il crée de la curiosité et redirige vers l'arbre"
  - "Indicateur texte inline discret (TouchableOpacity) remplace la carte saga volumineuse"
  - "Spacing[2] inexistant → Spacing.xxs (2px) ; FontSize.xs inexistant → FontSize.caption (12px)"
metrics:
  duration: "4 minutes"
  completed_date: "2026-04-02T23:09:39Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 11 Plan 03: Indicateur Saga Inline Dashboard Summary

**One-liner:** Carte saga dashboard remplacée par indicateur texte inline discret avec tap vers l'écran arbre.

## What Was Built

Simplification de `DashboardGarden.tsx` : suppression des fonctions `renderSagaCard()` et `renderSagaDots()` (219 lignes supprimées) et remplacement par un `TouchableOpacity` compact affichant l'état saga en texte inline.

L'indicateur affiche :
- Texte principal coloré selon l'état : couleur primaire si chapitre disponible, `textMuted` si déjà fait aujourd'hui
- Sous-texte de progression : chapitre X/Y — titre saga
- Tap sur l'indicateur → `router.push('/(tabs)/tree')` vers l'écran arbre

Le démarrage de saga (`loadSagaProgress`, `shouldStartSaga`, `saveSagaProgress`) reste dans DashboardGarden.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Supprimer renderSagaCard/renderSagaDots, ajouter indicateur texte inline | 723a383 | components/dashboard/DashboardGarden.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Spacing[2] inexistant remplacé par Spacing.xxs**
- **Found during:** Task 1
- **Issue:** Le plan préconisait `Spacing[2]` mais Spacing n'a pas de clé numérique `2` — uniquement des clés nommées (xxs, xs, sm, etc.)
- **Fix:** Remplacé par `Spacing.xxs` (2px), valeur sémantiquement équivalente
- **Files modified:** components/dashboard/DashboardGarden.tsx
- **Commit:** 723a383

**2. [Rule 1 - Bug] FontSize.xs inexistant remplacé par FontSize.caption**
- **Found during:** Task 1
- **Issue:** Le plan préconisait `FontSize.xs` mais FontSize n'a pas de clé `xs` — les clés disponibles sont micro, caption, label, sm, body, etc.
- **Fix:** Remplacé par `FontSize.caption` (12px), taille la plus proche
- **Files modified:** components/dashboard/DashboardGarden.tsx
- **Commit:** 723a383

**3. [Rule 2 - Cleanup] Imports et variables inutilisés supprimés**
- **Found during:** Task 1 (après suppression renderSagaCard/renderSagaDots)
- **Fix:** Supprimé `FadeIn`, `getSagaCompletionResult`, `ALL_TRAITS`, `type Adventure`, `Shadows`, `useMemo`, et variables `currentChapter`, `isLastChapter`, `traitSummary`
- **Files modified:** components/dashboard/DashboardGarden.tsx
- **Commit:** 723a383

## Known Stubs

Aucun stub — l'indicateur est câblé sur les données saga réelles (`sagaProgress`, `activeSaga`).

## Self-Check

- [x] `components/dashboard/DashboardGarden.tsx` existe et contient `sagaIndicator`
- [x] Commit 723a383 existe
- [x] `grep -c "renderSagaCard" DashboardGarden.tsx` retourne 0
- [x] `npx tsc --noEmit` : 0 erreurs liées à DashboardGarden

## Self-Check: PASSED
