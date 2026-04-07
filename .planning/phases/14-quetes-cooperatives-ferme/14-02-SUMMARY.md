---
phase: 15-quetes-cooperatives-ferme
plan: 02
subsystem: ui
tags: [quetes, cooperatif, ferme, reanimated, modal, dashboard, banniere]

requires:
  - phase: 15-01
    provides: [lib/quest-engine.ts, hooks/useVaultFamilyQuests.ts, constants/questTemplates.ts, familyQuests dans VaultState]

provides:
  - components/mascot/FamilyQuestBanner.tsx — widget banniere quete active avec barre progression animee + avatars contributions
  - components/mascot/FamilyQuestDetailSheet.tsx — bottom sheet pageSheet detail quete avec contributions individuelles et actions
  - components/mascot/FamilyQuestPickerSheet.tsx — picker templates quetes en grille 2 colonnes (restreint adulte/ado)
  - getRewardLabel exporte depuis FamilyQuestBanner — fonction partagee banner/detail/picker
  - Integration tree.tsx — banniere quete avant WeeklyGoal, role gate UI, modals detail et picker
  - Integration DashboardGarden.tsx — indicateur compact quete active (titre + barre + X/Y)

affects: [tree.tsx, DashboardGarden.tsx, hooks/useVaultFamilyQuests.ts]

tech-stack:
  added: [date-fns (differenceInDays, parseISO — deja dans le projet)]
  patterns: [primary prop separate de colors (pattern useThemeColors), getRewardLabel fonction utilitaire exportee et partagee, role gate cote appelant (pas dans le composant picker)]

key-files:
  created:
    - components/mascot/FamilyQuestBanner.tsx
    - components/mascot/FamilyQuestDetailSheet.tsx
    - components/mascot/FamilyQuestPickerSheet.tsx
  modified:
    - app/(tabs)/tree.tsx
    - components/dashboard/DashboardGarden.tsx

key-decisions:
  - "primary passe en prop separee (pas dans colors) — useThemeColors retourne primary et colors comme valeurs distinctes, les composants acceptent les deux"
  - "getRewardLabel exporte depuis FamilyQuestBanner et reutilise dans Detail et Picker — une seule source de verite pour les labels recompense"
  - "Role gate UI dans tree.tsx (canStartQuest) et non dans FamilyQuestPickerSheet — le picker reste generique, l'appelant controle l'acces"
  - "FamilyQuestDetailSheet accepte onComplete/onDelete en callback — le composant delègue la logique metier a tree.tsx"

patterns-established:
  - "Pattern primary/colors: destructurer useThemeColors() en { primary, tint, colors } et passer les deux aux composants enfants qui en ont besoin"
  - "Pattern role gate UI: canStartQuest calcule dans le parent avant de conditionner l'affichage du bouton"
  - "Pattern getRewardLabel: fonction utilitaire exportee depuis le composant qui la definit, importee dans les siblings"

requirements-completed: [QUEST-01, QUEST-02, QUEST-03]

duration: 30min
completed: "2026-04-07"
---

# Phase 15 Plan 02: Composants UI Quêtes Coopératives Summary

**Widget bannière quête active sur l'écran ferme (FadeInDown + barre progression), bottom sheet détail avec contributions individuelles, picker de templates en grille (role gate adulte/ado), et indicateur compact dans la carte dashboard jardin**

## Performance

- **Duration:** 30 min
- **Started:** 2026-04-07T06:35:00Z
- **Completed:** 2026-04-07T07:09:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- 3 composants créés (FamilyQuestBanner, FamilyQuestDetailSheet, FamilyQuestPickerSheet) — aucune couleur hardcodée, React.memo, animations reanimated
- tree.tsx intègre les 3 composants avec role gate UI (bouton "+ Nouvelle quête" invisible pour les enfants), handlers useCallback avec haptics
- DashboardGarden.tsx affiche un indicateur compact (titre + barre + X/Y) de la quête active en tap-to-navigate vers tree.tsx
- getRewardLabel exportée comme utilitaire partagé — couvre les 11 types de FamilyFarmReward

## Task Commits

1. **Tache 1: FamilyQuestBanner + FamilyQuestDetailSheet** - `fd15694` (feat)
2. **Tache 2: FamilyQuestPickerSheet + integration tree.tsx + indicateur DashboardGarden** - `e60a8d4` (feat)

## Files Created/Modified

- `components/mascot/FamilyQuestBanner.tsx` — Widget bannière quête active : titre, jours restants, barre progression animée (FadeInDown), contributions par avatar (max 4 + extras), label récompense
- `components/mascot/FamilyQuestDetailSheet.tsx` — Bottom sheet pageSheet : grande barre progression, FlatList contributions individuelles avec barre par membre, aperçu récompense, dates, bouton Compléter (haptic notification), bouton Supprimer discret (Alert confirmation)
- `components/mascot/FamilyQuestPickerSheet.tsx` — Picker templates : grille 2 colonnes avec 7 templates, emoji + titre + type + target + recompense, haptic selectionAsync au tap
- `app/(tabs)/tree.tsx` — Imports 3 composants + Haptics, destructure familyQuests/startFamilyQuest/completeFamilyQuest/deleteFamilyQuest depuis useVault(), states showQuestDetail/showQuestPicker, memos activeQuest/canStartQuest, handlers handleCompleteQuest/handleDeleteQuest/handleCreateQuest, JSX avant WeeklyGoal, modals après HarvestEventOverlay
- `components/dashboard/DashboardGarden.tsx` — useMemo import, familyQuests destructuré, activeQuest memo, indicateur compact JSX avant bouton CTA, 6 nouveaux styles questCompact*

## Decisions Made

- `primary` passé en prop séparée dans les composants (pas dans `colors`) : `useThemeColors()` retourne `primary` et `colors` comme valeurs distinctes — les composants UI du projet suivent ce pattern (WeeklyGoal passe aussi `colors` sans `primary`, les composants qui ont besoin de `primary` le reçoivent séparément).
- `getRewardLabel` exportée depuis `FamilyQuestBanner.tsx` et importée dans `FamilyQuestDetailSheet` et `FamilyQuestPickerSheet` — une seule source de vérité pour les 11 types de récompense.
- Role gate UI dans `tree.tsx` plutôt que dans `FamilyQuestPickerSheet` — le picker reste un composant générique réutilisable, l'appelant contrôle l'accès.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] colors.primary n'existe pas dans l'objet colors**
- **Found during:** Tache 2 (TypeScript check)
- **Issue:** Le plan spécifiait `colors.primary` dans les composants, mais `useThemeColors()` retourne `primary` et `colors` comme valeurs distinctes. `colors.primary` n'existe pas (TypeError au runtime + erreur tsc).
- **Fix:** Ajout de `primary: string` en prop dans FamilyQuestBanner, FamilyQuestDetailSheet, FamilyQuestPickerSheet. Remplacement de `colors.primary` par `primary`. Mise à jour des call sites dans tree.tsx et DashboardGarden.tsx.
- **Files modified:** 3 composants + tree.tsx + DashboardGarden.tsx
- **Verification:** `npx tsc --noEmit` passe sans nouvelles erreurs
- **Committed in:** e60a8d4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixé (Rule 1 — bug correctness)
**Impact on plan:** Correction nécessaire pour la correction du code. Aucun scope creep.

## Issues Encountered

Aucun problème bloquant. La déviation sur `colors.primary` était détectée par TypeScript et corrigée immédiatement.

## User Setup Required

Aucune — pas de configuration externe requise.

## Next Phase Readiness

- UI quêtes coopératives complète — bannière, détail, picker, dashboard compact
- Les quêtes peuvent être démarrées, suivies, et complétées depuis l'écran ferme
- Phase 15 terminée — toutes les quêtes coopératives sont visibles et interactives
- Prochaine itération possible : animations de complétion de quête, trophées familiaux visuels

## Known Stubs

Aucun stub. Tous les composants sont connectés aux vraies données via `familyQuests` depuis `useVault()`.

---
*Phase: 15-quetes-cooperatives-ferme*
*Completed: 2026-04-07*
