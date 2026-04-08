---
phase: 15-pr-f-rences-alimentaires
plan: "04"
subsystem: dietary
tags: [allergen, p0-safety, pref-11, tdd, enforcement]
dependency_graph:
  requires: [15-01]
  provides: [AllergenBanner, AllergenBannerProps, components/dietary/index.ts]
  affects: [RecipeViewer, plan-06]
tech_stack:
  added: []
  patterns: [static-type-enforcement, pointer-events-none, tdd-red-green]
key_files:
  created:
    - components/dietary/AllergenBanner.tsx
    - components/dietary/index.ts
    - lib/__tests__/allergen-banner.test.ts
  modified: []
decisions:
  - "PREF-11 P0 SAFETY : pointerEvents='none' + zéro prop dismiss dans AllergenBannerProps — enforcement statique via test TypeScript"
  - "Ligne allergie toujours rendue sans collapsible — jamais enfant d'un CollapsibleSection"
  - "Ligne régime/aversion utilise colors.tagMention + colors.tagMentionText (pas colors.infoBg/info) pour cohérence avec le design system"
metrics:
  duration: "2min"
  completed: 2026-04-07
  tasks_completed: 1
  files_created: 3
  files_modified: 0
---

# Phase 15 Plan 04: AllergenBanner P0 SAFETY (PREF-11) Summary

AllergenBanner non-dismissible avec enforcement TypeScript statique — 3 tests bloquent toute PR ajoutant une API dismiss.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Test statique P0 SAFETY | bebd0c3 | lib/__tests__/allergen-banner.test.ts |
| GREEN | AllergenBanner + barrel export | 9eb7c6b | components/dietary/AllergenBanner.tsx, components/dietary/index.ts |

## What Was Built

### `components/dietary/AllergenBanner.tsx`

Composant garde-fou P0 SAFETY (PREF-11). Rendu conditionnel : `null` si `conflicts=[]`, sinon affiche les lignes de conflits selon sévérité.

- `AllergenBannerProps` : une seule prop `conflicts: DietaryConflict[]`, zéro prop dismiss
- `pointerEvents="none"` sur la View container
- Ligne allergie : `colors.errorBg` + `borderLeftColor: colors.error` (3px) + texte `colors.errorText`, toujours visible
- Ligne intolérance : `colors.warningBg` + `colors.warning`
- Ligne régime/aversion : `colors.tagMention` + `colors.tagMentionText`
- Copywrite exact conforme UI-SPEC lignes 176-178 : "Risque vital pour", "Inconfort pour", "Préférence de"
- Zéro hex hardcodé — `useThemeColors()` exclusivement

### `components/dietary/index.ts`

Barrel export du sous-dossier dietary — `AllergenBanner` + `AllergenBannerProps`.

### `lib/__tests__/allergen-banner.test.ts`

3 tests statiques TypeScript. Pattern : `'onDismiss' extends keyof AllergenBannerProps ? true : false` assigné à `false`. Si une prop dismiss est ajoutée, `tsc --noEmit` échoue → build bloqué.

## Verification

- `npx jest lib/__tests__/allergen-banner.test.ts` : 3/3 tests PASS
- `npx tsc --noEmit` : zéro erreur dans les fichiers créés
- `grep -q 'pointerEvents="none"'` : PASS
- `grep -q "colors.errorBg"` : PASS
- `grep -q "borderLeftColor: colors.error"` : PASS
- `grep -q "Risque vital pour"` : PASS
- `! grep -qE "#[0-9A-Fa-f]{3,}"` : PASS (zéro hex)
- `grep -q 'export interface AllergenBannerProps'` : PASS
- `grep -q 'export { AllergenBanner }'` (index.ts) : PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Implementation] Lignes régime/aversion utilisent tagMention au lieu de infoBg**
- **Found during:** Task 1 (GREEN)
- **Issue:** `colors.infoBg` existe mais `colors.infoText` n'existe pas — le token texte est `colors.info` (violet) qui n'est pas approprié pour ce contexte. Le design system utilise `colors.tagMention` + `colors.tagMentionText` pour les infos jaunes (UI-SPEC tableau sévérité ligne `regime/aversion` mentionne les deux options).
- **Fix:** Utilisation de `colors.tagMention` + `colors.tagMentionText` cohérent avec les autres badges du projet et le tableau UI-SPEC.
- **Files modified:** components/dietary/AllergenBanner.tsx

## Known Stubs

None — le composant est complet et fonctionnel. Les profils sont passés via `conflicts[0].profileNames` (données calculées par checkAllergens, Plan 02).

## Self-Check: PASSED

- `components/dietary/AllergenBanner.tsx` : EXISTS
- `components/dietary/index.ts` : EXISTS
- `lib/__tests__/allergen-banner.test.ts` : EXISTS
- Commit bebd0c3 : EXISTS
- Commit 9eb7c6b : EXISTS
