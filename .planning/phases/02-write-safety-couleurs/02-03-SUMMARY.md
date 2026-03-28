---
phase: 02-write-safety-couleurs
plan: 03
subsystem: ui
tags: [colors, dark-mode, tokens, useThemeColors, SkillNode, TreeShop, WeeklyGoal, tree]

# Dependency graph
requires:
  - phase: 02-write-safety-couleurs
    provides: Migration couleurs hardcodées Tier 1 (plans 01 et 02)
provides:
  - SkillNode avec tokens sémantiques pour bordures, texte XP, badge check
  - TreeShop avec tokens pour texte achat et indicateur équipe/bâtiment
  - WeeklyGoal avec tokens pour indicateurs de progression
  - tree.tsx CropWhisper avec useThemeColors() et onPrimary
affects: [dark-mode-verification, phase-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "StyleSheet static → inline dynamic pour les couleurs dans checkBadge/checkText"
    - "Composant enfant sans hook → appel useThemeColors() direct dans le composant"

key-files:
  created: []
  modified:
    - components/SkillNode.tsx
    - components/mascot/TreeShop.tsx
    - components/mascot/WeeklyGoal.tsx
    - app/(tabs)/tree.tsx

key-decisions:
  - "CropWhisper (composant standalone) reçoit useThemeColors() directement plutôt que via prop"
  - "checkBadge/checkText migré de StyleSheet statique vers inline pour supporter les tokens dynamiques"
  - "RARITY_COLORS map (cosmétique) et couleurs SVG diorama (#4CAF50, #FFD700) préservés intentionnellement"

patterns-established:
  - "Couleurs status (success/warning/info) via tokens sémantiques — jamais hardcodées"
  - "Composants enfants autonomes appellent useThemeColors() si besoin de couleurs thématiques"

requirements-completed: [QUAL-03]

# Metrics
duration: 15min
completed: 2026-03-28
---

# Phase 02 Plan 03: Migration couleurs Tier 1 (SkillNode, TreeShop, WeeklyGoal, tree.tsx) Summary

**Migration vers colors.* de 10 valeurs hardcodées dans 4 composants Tier 1 — complétion de QUAL-03 sur l'ensemble du périmètre couleurs**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-28T19:40:00Z
- **Completed:** 2026-03-28T19:55:00Z
- **Tasks:** 1/2 (Task 2 est un checkpoint:human-verify en attente)
- **Files modified:** 4

## Accomplishments
- SkillNode : 5 valeurs hardcodées remplacées (separator, success x2, textMuted x2, onPrimary) — bordure locked, XP text, badge check
- TreeShop : 3 valeurs remplacées (onPrimary, warning, success) — texte bouton achat, bordure owned bâtiment, indicateur revenu quotidien
- WeeklyGoal : 3 valeurs remplacées (success x3, info) — compteur, barre de progression, texte statut
- tree.tsx (CropWhisper) : #FFF → colors.onPrimary + ajout de useThemeColors() dans le composant standalone

## Task Commits

1. **Task 1: Migration couleurs SkillNode, TreeShop, WeeklyGoal, tree.tsx** - `64d4a78` (feat)

**Plan metadata:** (à créer après checkpoint)

## Files Created/Modified
- `components/SkillNode.tsx` - Tokens sémantiques pour bordures état locked, XP text, badge check vert
- `components/mascot/TreeShop.tsx` - Tokens pour texte bouton achat, bordure owned bâtiments, texte revenu vert
- `components/mascot/WeeklyGoal.tsx` - Tokens pour compteur, barre progression, texte statut (reçoit colors en prop)
- `app/(tabs)/tree.tsx` - CropWhisper: useThemeColors() + onPrimary pour texte tooltip

## Decisions Made
- CropWhisper étant un composant React autonome (hors TreeScreen), il appelle directement useThemeColors() plutôt que de passer colors en prop — plus cohérent avec les conventions du projet
- Les styles checkBadge/checkText migrés de StyleSheet.create (statique) vers inline pour accéder aux tokens dynamiques du hook

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ajout de useThemeColors() dans CropWhisper**
- **Found during:** Task 1 (Migration couleurs tree.tsx)
- **Issue:** CropWhisper est un composant standalone — il ne pouvait pas accéder au `colors` du parent TreeScreen
- **Fix:** Ajout de `const { colors } = useThemeColors();` dans CropWhisper
- **Files modified:** app/(tabs)/tree.tsx
- **Verification:** TypeScript compile sans erreur sur ce fichier
- **Committed in:** 64d4a78 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix nécessaire pour que le remplacement de #FFF fonctionne. Aucun scope creep.

## Issues Encountered
- Erreurs TypeScript pré-existantes dans TreeShop.tsx (costBadge/costText manquants dans StyleSheet) — présentes avant cette migration, ignorées conformément aux conventions du projet

## User Setup Required
None - pas de configuration externe requise.

## Next Phase Readiness
- Migration couleurs Tier 1 complète sur tous les fichiers (plans 02-01, 02-02, 02-03)
- Checkpoint human-verify (Task 2) en attente : l'utilisateur doit valider visuellement le mode nuit
- Après validation : plan 02-03 est terminé, phase 02 complète

## Self-Check: PASSED

- components/SkillNode.tsx: FOUND
- components/mascot/TreeShop.tsx: FOUND
- components/mascot/WeeklyGoal.tsx: FOUND
- app/(tabs)/tree.tsx: FOUND
- Commit 64d4a78: FOUND

---
*Phase: 02-write-safety-couleurs*
*Completed: 2026-03-28*
