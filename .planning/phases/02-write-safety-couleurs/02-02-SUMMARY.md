---
phase: 02-write-safety-couleurs
plan: 02
subsystem: ui
tags: [dark-mode, theming, react-native, colors, tokens]

# Dependency graph
requires: []
provides:
  - 12 fichiers migres vers tokens semantiques useThemeColors() pour le chrome UI
  - app/_layout.tsx, setup.tsx, tasks.tsx, more.tsx sans hex literals dans chrome UI
  - VaultPicker, RecipeCard, RecipeCookingMode, ContactImporter, TabletSidebar, LiquidXPBar migres
affects:
  - phase-03-write-queue
  - mode-nuit dark-mode

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Couleurs theme-dependantes toujours inline avec colors.* (jamais dans StyleSheet.create)"
    - "Couleurs pre-provider (ErrorBoundary, loading): importer LightColors/DarkColors directement depuis constants/colors.ts"
    - "Exemptions documentees: PhotoViewer #000 (fond absolu photo), SegmentedControl shadowColor (convention RN), WEATHER_COLORS (cosmetics interpolation), menu item color fields (cosmetics)"

key-files:
  created: []
  modified:
    - app/_layout.tsx
    - app/setup.tsx
    - app/(tabs)/tasks.tsx
    - app/(tabs)/more.tsx
    - components/VaultPicker.tsx
    - components/RecipeCard.tsx
    - components/RecipeCookingMode.tsx
    - components/ContactImporter.tsx
    - components/TabletSidebar.tsx
    - components/ui/LiquidXPBar.tsx

key-decisions:
  - "ErrorBoundary (classe React avant ThemeProvider) utilise LightColors/DarkColors importes directement — hook useThemeColors() impossible dans class component et composant pre-provider"
  - "WEATHER_COLORS conserve tel quel — tableau de couleurs cosmetics pour interpolation animee, pas du chrome UI"
  - "PhotoViewer #000 exempt — fond noir absolu intentionnel pour viewer photo, independant du theme"
  - "SegmentedControl shadowColor '#000' exempt — convention React Native (shadows toujours noirs)"
  - "confirmBtnDisabled remplace backgroundColor fixe par primary+'99' (opacity) pour cohérence theme"

patterns-established:
  - "StyleSheet.create = valeurs statiques uniquement. Toute couleur dependante du theme → inline avec colors.*"
  - "Composants avant-provider: importer LightColors/DarkColors depuis constants/colors.ts"

requirements-completed: [QUAL-03]

# Metrics
duration: 12min
completed: 2026-03-28
---

# Phase 02 Plan 02: Migration Couleurs Hardcodes Ecrans et Composants Summary

**12 fichiers migres vers tokens semantiques useThemeColors(), eliminant tous les hex literals du chrome UI pour le support complet du mode nuit**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-28T19:40:00Z
- **Completed:** 2026-03-28T19:52:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- 4 ecrans app/ (layout, setup, tasks, more) sans couleurs hardcodees dans le chrome UI
- 6 composants high-priority (VaultPicker, RecipeCard, RecipeCookingMode, ContactImporter, TabletSidebar, LiquidXPBar) migres vers tokens semantiques
- Couleurs cosmetiques preservees (WEATHER_COLORS, menu item colors, PhotoViewer fond noir, SegmentedControl shadow)
- Zero nouvelles erreurs TypeScript introduites

## Task Commits

Chaque tache commitee atomiquement:

1. **Task 1: Migration couleurs ecrans (app/)** - `897b950` (feat)
2. **Task 2: Migration couleurs composants high-priority** - `fcdef1c` (feat)

## Files Created/Modified
- `app/_layout.tsx` - LightColors/DarkColors pour loading overlay bg, ErrorBoundary styles via constantes directes
- `app/setup.tsx` - recapCheckDone utilise colors.success inline au lieu de #16a34a
- `app/(tabs)/tasks.tsx` - TaskWeather label/message/count via colors.text/textSub/textMuted inline
- `app/(tabs)/more.tsx` - badgeText utilise colors.onPrimary inline (deux usages: liste et grille)
- `components/VaultPicker.tsx` - createBtnText, confirmText, errorText via colors.onPrimary/error; ActivityIndicator via colors.onPrimary
- `components/RecipeCard.tsx` - badgeText et imageTitle via colors.onPrimary inline
- `components/RecipeCookingMode.tsx` - stepBadgeText et navDoneBtnText via colors.onPrimary inline
- `components/ContactImporter.tsx` - checkmark via colors.onPrimary inline
- `components/TabletSidebar.tsx` - badgeText via colors.onPrimary inline
- `components/ui/LiquidXPBar.tsx` - barText via colors.onPrimary inline

## Decisions Made
- ErrorBoundary est un class component monte avant ThemeProvider — impossible d'utiliser useThemeColors(). Solution: importer LightColors/DarkColors directement depuis constants/colors.ts pour les styles statiques.
- WEATHER_COLORS (tableau pour interpolateColor animee) conserve car cosmetics, pas chrome UI.
- confirmBtnDisabled remplace backgroundColor fixe par `primary + '99'` pour maintenir la coherence theme.

## Deviations from Plan

None - plan execute exactement comme specifie. Les exemptions (PhotoViewer, SegmentedControl) etaient pre-planifiees.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Mode nuit fonctionnel sans couleurs hardcodees dans ces 10 fichiers
- Phase 02-03 peut continuer la migration sur d'autres fichiers Tier 1 restants
- Aucun bloqueur

---
*Phase: 02-write-safety-couleurs*
*Completed: 2026-03-28*
