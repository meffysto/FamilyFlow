---
phase: 26-hook-domaine-jardin
plan: 02
subsystem: hooks
tags: [village, jardin-familial, useGarden, hooks-domaine, gamification, date-fns]

# Dependency graph
requires:
  - phase: 26-01
    provides: gardenRaw/setGardenRaw dans VaultState + village_claimed_week dans FarmProfileData
  - phase: 25-fondation-donnees-village
    provides: lib/village/ (types, parser, templates, grid)
provides:
  - hooks/useGarden.ts exportant useGarden() avec API complète (D-09)
affects:
  - 26-03 (écran village — consomme useGarden)
  - 26-04 (portail + contributions — consomme useGarden)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook domaine isolé consommant useVault() directement (D-01) — même pattern que useFarm.ts"
    - "Guard anti-boucle via currentWeekStart === getMondayISO(new Date()) dans useEffect"
    - "Formule déterministe template index — safe iCloud multi-profil concurrent (D-06)"
    - "Anti-double-claim via village_claimed_week dans gami-{id}.md (D-08)"

key-files:
  created:
    - hooks/useGarden.ts
  modified: []

key-decisions:
  - "statut !== 'grossesse' pour filtrer les profils actifs — role n'inclut pas 'grossesse', c'est statut"
  - "gami-{id}.md sans préfixe 04 - Gamification/ — cohérent avec le pattern réel du codebase (museum, quest-engine)"
  - "appendContributionToVault retourne void — relecture VILLAGE_FILE après écriture pour mettre à jour gardenRaw"

patterns-established:
  - "Hook domaine village (useGarden) : import useVault, useMemo/useCallback sur toutes les dérivations, useEffect pour side-effects asynchrones"
  - "claimReward pattern : read → check guard → write flag → return bool"

requirements-completed: [DATA-03, OBJ-01, OBJ-05]

# Metrics
duration: 2min
completed: 2026-04-10
---

# Phase 26 Plan 02: Hook Domaine Jardin Summary

**useGarden() — hook domaine village complet avec génération hebdomadaire, anti-double-claim et contributions, isolé de useVault via pattern D-01**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-10T19:03:49Z
- **Completed:** 2026-04-10T19:05:53Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Créé `hooks/useGarden.ts` (251 lignes) exportant `useGarden()` avec l'API complète D-09
- Génération automatique objectif hebdomadaire au premier accès de la semaine (lundi courant), avec archivage semaine précédente dans `pastWeeks`
- Guard anti-boucle infinie : `gardenData.currentWeekStart === currentMonday` arrête le useEffect si déjà à jour
- Anti-double-claim : vérifie `village_claimed_week` dans `gami-{id}.md` avant de valider `claimReward`
- TSC --noEmit passe sans nouvelles erreurs

## Task Commits

Chaque tâche committée atomiquement :

1. **Task 1: Créer hooks/useGarden.ts — hook domaine village complet** - `1756a4c` (feat)

**Plan metadata:** (à venir — commit docs)

## Files Created/Modified

- `hooks/useGarden.ts` — Hook domaine village : parsing gardenRaw, génération objectif, addContribution, claimReward

## Decisions Made

- Utilisé `p.statut !== 'grossesse'` (pas `p.role`) pour filtrer les profils actifs — le champ `role` est `'enfant' | 'ado' | 'adulte'`, le statut grossesse est dans `statut`. Auto-corrigé à la compilation TSC.
- Chemin gami-{id}.md sans préfixe `04 - Gamification/` — audit codebase confirme que museum/engine.ts, quest-engine.ts et autres utilisent `gami-${profileId}.md` directement (vault root relatif).
- `appendContributionToVault` retourne `void` (pas `string`) — après l'écriture, relecture de `VILLAGE_FILE` pour récupérer le contenu mis à jour et appeler `setGardenRaw`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Filtrage profils actifs : role !== 'grossesse' → statut !== 'grossesse'**
- **Found during:** Compilation TSC après Task 1
- **Issue:** Le plan mentionnait `p.role !== 'grossesse'` mais le type `Profile.role` est `'enfant' | 'ado' | 'adulte'` — la comparaison était toujours fausse selon TypeScript
- **Fix:** Remplacé par `p.statut !== 'grossesse'` (champ correct dans l'interface Profile)
- **Files modified:** hooks/useGarden.ts (ligne 89)
- **Verification:** TSC --noEmit passe sans erreur
- **Committed in:** 1756a4c (task commit)

---

**Total deviations:** 1 auto-fixed (1 bug — mauvais champ Profile)
**Impact on plan:** Correctif nécessaire pour la compilation. Aucun scope creep.

## Issues Encountered

Aucun problème bloquant. La déviation TSC a été résolue immédiatement.

## User Setup Required

Aucun — aucune configuration externe requise.

## Next Phase Readiness

- `useGarden()` est prêt à être consommé dans les composants Phase 26-03 (écran village)
- L'anti-double-claim est en place, les écrans peuvent appeler `claimReward(profileId)` directement
- Aucun bloqueur identifié

---
*Phase: 26-hook-domaine-jardin*
*Completed: 2026-04-10*
