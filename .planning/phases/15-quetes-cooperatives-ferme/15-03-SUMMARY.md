---
phase: 15-quetes-cooperatives-ferme
plan: 03
subsystem: gamification
tags: [quetes, onQuestProgress, useFarm, useGamification, useVaultDefis, contributeFamilyQuest]

requires:
  - phase: 15-quetes-cooperatives-ferme-01
    provides: "useVaultFamilyQuests.contribute + signatures onQuestProgress dans useFarm/useGamification/useVaultDefis"
  - phase: 15-quetes-cooperatives-ferme-02
    provides: "UI quêtes (FamilyQuestBanner, FamilyQuestDetailSheet, FamilyQuestPickerSheet)"

provides:
  - "questsHook initialisé avant defisHook dans useVault.ts"
  - "questsHook.contribute passé comme 5e arg à useVaultDefis"
  - "contributeFamilyQuest passé à useFarm() dans tree.tsx"
  - "contributeFamilyQuest passé à useGamification() dans tasks.tsx et index.tsx"
  - "Progression quête automatiquement déclenchée sur tâches, récoltes, crafts, et défis"

affects: [15-quetes-cooperatives-ferme, gamification, ferme]

tech-stack:
  added: []
  patterns:
    - "contribute accepte string (pas FamilyQuestType) pour compatibilité contravariance avec hooks useVaultDefis/useFarm/useGamification"
    - "Hook questsHook initialisé en premier pour rendre contribute disponible aux hooks dépendants"

key-files:
  created: []
  modified:
    - hooks/useVault.ts
    - hooks/useVaultFamilyQuests.ts
    - app/(tabs)/tree.tsx
    - app/(tabs)/tasks.tsx
    - app/(tabs)/index.tsx

key-decisions:
  - "contribute élargi en type string (au lieu de FamilyQuestType) pour compatibilité contravariance avec les signatures existantes de useFarm/useVaultDefis/useGamification qui attendent string"
  - "questsHook initialisé AVANT defisHook dans useVault.ts pour que questsHook.contribute soit disponible lors de l'appel useVaultDefis"

patterns-established:
  - "Pattern onQuestProgress: toujours passer contributeFamilyQuest comme callback aux hooks gamification et ferme"

requirements-completed: [QUEST-01]

duration: 8min
completed: 2026-04-07
---

# Phase 15 Plan 03: Fermeture du gap Truth 4 — progression quête câblée de bout en bout

**4 call sites onQuestProgress câblés (useVaultDefis, useFarm, tasks.tsx, index.tsx) pour déclencher automatiquement la progression des quêtes coopératives lors de tâches, récoltes, crafts et défis**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-07T07:20:00Z
- **Completed:** 2026-04-07T07:28:00Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- questsHook initialisé avant defisHook dans useVault.ts — contribute disponible pour useVaultDefis
- useVaultDefis reçoit questsHook.contribute comme 5e argument (onQuestProgress)
- tree.tsx: contributeFamilyQuest ajouté au destructuring useVault() et passé à useFarm()
- tasks.tsx: contributeFamilyQuest ajouté au destructuring et passé à useGamification()
- index.tsx: contributeFamilyQuest ajouté au destructuring et passé à useGamification()
- Correction type contravariance: contribute passe de FamilyQuestType à string dans UseVaultFamilyQuestsResult

## Task Commits

1. **Tache 1: Câbler les 4 call sites onQuestProgress** - `89e6e28` (feat)

**Plan metadata:** (à venir)

## Files Created/Modified

- `hooks/useVault.ts` — ordre questsHook/defisHook inversé, gamiDataRef déplacé avec questsHook, type contributeFamilyQuest élargi à string
- `hooks/useVaultFamilyQuests.ts` — contribute signature élargie: FamilyQuestType → string dans interface et implémentation
- `app/(tabs)/tree.tsx` — contributeFamilyQuest ajouté au destructuring useVault(), passé à useFarm()
- `app/(tabs)/tasks.tsx` — contributeFamilyQuest ajouté au destructuring, onQuestProgress: contributeFamilyQuest passé à useGamification()
- `app/(tabs)/index.tsx` — contributeFamilyQuest ajouté au destructuring, onQuestProgress: contributeFamilyQuest passé à useGamification()

## Decisions Made

- `contribute` élargi de `FamilyQuestType` à `string` dans l'interface `UseVaultFamilyQuestsResult` et l'implémentation — nécessaire pour satisfaire la contravariance TypeScript: les hooks `useFarm`, `useVaultDefis`, `useGamification` déclarent leur callback `onQuestProgress` avec `type: string`, donc passer un callback `type: FamilyQuestType` (type plus étroit) est invalide en TypeScript (TS2345).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type contravariance FamilyQuestType vs string dans contribute**
- **Found during:** Tache 1 (vérification tsc)
- **Issue:** Les hooks `useFarm`, `useVaultDefis`, et `useGamification` déclarent leur paramètre `onQuestProgress` avec `type: string`. La fonction `contribute` avait `type: FamilyQuestType` (union string littérale), ce qui provoque une erreur TS2345 par contravariance — impossible de passer un callback avec paramètre plus étroit là où `string` est attendu.
- **Fix:** Élargi `contribute` de `FamilyQuestType` à `string` dans `UseVaultFamilyQuestsResult` et dans l'implémentation `useCallback`. La logique interne (`q.type !== type`) fonctionne identiquement car `q.type` est `FamilyQuestType` et la comparaison avec `string` est valide à l'exécution.
- **Files modified:** `hooks/useVaultFamilyQuests.ts`, `hooks/useVault.ts` (type VaultState)
- **Verification:** tsc --noEmit passe sans nouvelles erreurs sur les fichiers modifiés
- **Committed in:** `89e6e28` (inclus dans le commit principal)

---

**Total deviations:** 1 auto-fixed (1 bug type contravariance)
**Impact on plan:** Correction nécessaire pour la correction de type — aucun changement de comportement à l'exécution.

## Issues Encountered

Le plan mentionnait que `contributeFamilyQuest` était déjà destructuré dans `tree.tsx` (ligne 289) — ce n'était pas le cas. Le checker_note avait correctement identifié cette inaccurie. La correction a été appliquée en ajoutant `contributeFamilyQuest` au destructuring.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Truth 4 du VERIFICATION.md est clos : compléter une tâche, une récolte, un craft, ou un défi déclenche automatiquement la progression de la quête active correspondante
- Phase 15 complète — prête pour vérification finale

---
*Phase: 15-quetes-cooperatives-ferme*
*Completed: 2026-04-07*
