---
phase: 41-polish-onboarding-codex-non-r-gression
plan: "02"
subsystem: ui
tags: [onboarding, tooltip, modal, sporee, help-context, secure-store, haptics, reanimated]

requires:
  - phase: 41-01-polish-onboarding-codex-non-r-gression
    provides: wagerMarathonWins fondation data + FarmProfileData shape stable
  - phase: 40-ui-spor-e-seed-picker-badge-validation
    provides: flux Sporée seed picker + harvest wager complet (3 sources Sporée)
  - phase: 18-tutoriel-ferme
    provides: pattern TUTO-02 HelpContext.markScreenSeen device-global SecureStore

provides:
  - SporeeOnboardingTooltip composant Modal one-shot (flag sporee_tooltip device-global)
  - Signal sporeeFirstObtained propagé depuis 3 sources harvest/expedition/onboarding
  - Guard hasSeenScreen('sporee_tooltip') dans tree.tsx pour éviter re-trigger

affects:
  - 41-03 (non-régression) — peut vérifier que le tooltip ne se retrigger pas
  - future onboarding phases — pattern TUTO-02 étendu à un 2e flag device-global

tech-stack:
  added: []
  patterns:
    - "TUTO-02 reconduit : HelpContext.markScreenSeen('sporee_tooltip') + hasSeenScreen guard one-shot"
    - "Signal sporeeFirstObtained propagé via return enrichi (harvest + collectExpedition)"
    - "Tooltip delay 800ms via setTimeout pour laisser la récolte se terminer d'abord"

key-files:
  created:
    - components/mascot/SporeeOnboardingTooltip.tsx
  modified:
    - hooks/useFarm.ts
    - hooks/useExpeditions.ts
    - hooks/useGamification.ts
    - "app/(tabs)/tree.tsx"

key-decisions:
  - "Signal sporeeFirstObtained via return enrichi des fonctions harvest/collectExpedition (pas event global) — cohérence avec pattern tree.tsx .then(result => ...)"
  - "Delay 800ms pour tooltip post-harvest — laisser HarvestCardToast s'afficher en premier"
  - "Types retour harvest/collectExpedition annotés avec sporeeFirstObtained?: boolean (fix auto Rule 1)"

patterns-established:
  - "Pattern TUTO-02 : 2e flag device-global sporee_tooltip via HelpContext — précédent farm_tutorial"
  - "Return enrichi optionnel pour signaux one-shot : ajouter champ ?:boolean au return existant sans briser les appelants"

requirements-completed: [SPOR-10]

duration: ~15min
completed: "2026-04-19"
---

# Phase 41 Plan 02: Tooltip Onboarding Sporée One-Shot Summary

**SporeeOnboardingTooltip modal one-shot branché sur 3 sources (harvest drop, expedition drop, cadeau onboarding stade 3) avec flag `sporee_tooltip` persisté device-global via HelpContext — pattern TUTO-02 reconduit**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-19T01:00:00Z
- **Completed:** 2026-04-19T01:35:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify approuvé)
- **Files modified:** 5

## Accomplishments

- Composant `SporeeOnboardingTooltip.tsx` créé : Modal transparent overlay, texte FR expliquant la mécanique Sporée, bouton "Compris", haptic selectionAsync, useThemeColors + tokens Spacing/Radius/FontSize
- Signal `sporeeFirstObtained` propagé depuis les 3 sources : harvest drop (golden + non-golden), expedition drop post-expédition, cadeau onboarding stade 3 via useGamification
- Guard `hasSeenScreen('sporee_tooltip')` dans tree.tsx pour harvest et expedition — tooltip affiché 1x max, jamais re-triggré après dismiss

## Task Commits

1. **Task 1: Créer SporeeOnboardingTooltip composant Modal one-shot** - `d96f1a3` (feat)
2. **Task 2: Wiring 3 sources Sporée → signal sporeeFirstObtained + tooltip render dans tree.tsx** - `e1f82ae` (feat)
3. **Task 3: Checkpoint Vérifier tooltip one-shot sur device** - approuvé (checkpoint:human-verify)
   - Fix auto Rule 1 (types): `a746231` (fix)

**Plan metadata:** à créer lors du commit final docs

## Files Created/Modified

- `components/mascot/SporeeOnboardingTooltip.tsx` — Modal one-shot : emoji 🍄, titre, texte mécanique Sporée FR, bouton Compris, markScreenSeen('sporee_tooltip') au dismiss
- `hooks/useFarm.ts` — type return harvest étendu avec `sporeeFirstObtained?: boolean` + variable calculée avant les 2 returns (golden + standard)
- `hooks/useExpeditions.ts` — type return collectExpedition étendu + flag `sporeeFirstObtained = true` après drop Sporée post-expédition
- `hooks/useGamification.ts` — flag `sporeeFirstObtainedViaOnboarding` propagé dans completeTask return pour cadeau onboarding stade 3
- `app/(tabs)/tree.tsx` — import SporeeOnboardingTooltip, useState showSporeeTooltip, guard hasSeenScreen pour harvest + expedition, render conditionnel en fin de JSX

## Decisions Made

- Signal propagé via return enrichi (pas EventEmitter global) : cohérence avec le pattern `harvest().then(result => ...)` existant dans tree.tsx
- Delay 800ms avant affichage tooltip : laisser le HarvestCardToast s'afficher en premier, éviter collision visuelle
- Types retour `useFarm.harvest` et `useExpeditions.collectExpedition` étendus explicitement avec `sporeeFirstObtained?: boolean` pour conformité TypeScript strict (fix appliqué automatiquement)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Types retour harvest/collectExpedition manquants pour sporeeFirstObtained**
- **Found during:** Vérification TypeScript post-checkpoint (continuation agent)
- **Issue:** Les annotations explicites de `Promise<{...}>` dans `useFarm.ts` et `useExpeditions.ts` ne contenaient pas `sporeeFirstObtained` — tsc signalait TS2353 "Object literal may only specify known properties"
- **Fix:** Ajout de `sporeeFirstObtained?: boolean` dans les deux annotations de type retour
- **Files modified:** `hooks/useFarm.ts`, `hooks/useExpeditions.ts`
- **Verification:** `npx tsc --noEmit` sans nouvelle erreur sur ces fichiers
- **Committed in:** `a746231`

---

**Total deviations:** 1 auto-fixed (Rule 1 - type annotation bug)
**Impact on plan:** Fix nécessaire pour conformité TypeScript. Aucun changement de comportement runtime — les valeurs étaient déjà retournées correctement.

## Issues Encountered

Continuation agent dans un worktree différent du worktree original (agent-af7fb645 vs agent-a5b40cee). Les commits de tâches 1 et 2 existaient sur la branche `worktree-agent-a5b40cee`. Résolution : merge de `main` (41-01 commits) + cherry-pick des 2 commits de tâches depuis l'autre worktree. TypeScript errors TS2353 découvertes post-cherry-pick sur les return types — corrigées automatiquement (Rule 1).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 41-02 complet : tooltip onboarding Sporée one-shot fonctionnel et vérifié sur device
- Plan 41-03 (non-régression tests) peut démarrer : vérifier que sporee_tooltip ne se retrigger pas, tests de régression type + jest
- Aucun bloqueur identifié

---
*Phase: 41-polish-onboarding-codex-non-r-gression*
*Completed: 2026-04-19*
