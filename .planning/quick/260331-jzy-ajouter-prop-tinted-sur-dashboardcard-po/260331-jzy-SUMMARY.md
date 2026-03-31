---
phase: quick
plan: 260331-jzy
subsystem: ui/dashboard
tags: [dashboard, ui, theming, react-native]
dependency_graph:
  requires: []
  provides: [tinted-dashboard-cards]
  affects: [components/DashboardCard.tsx, components/dashboard/*]
tech_stack:
  added: []
  patterns: [hex-to-rgba utility, absoluteFill overlay tint]
key_files:
  created: []
  modified:
    - components/DashboardCard.tsx
    - components/dashboard/DashboardOverdue.tsx
    - components/dashboard/DashboardGratitude.tsx
    - components/dashboard/DashboardMeals.tsx
    - components/dashboard/DashboardRdvs.tsx
    - components/dashboard/DashboardDefis.tsx
    - components/dashboard/DashboardMenage.tsx
    - components/dashboard/DashboardBudget.tsx
    - components/dashboard/DashboardCourses.tsx
    - components/dashboard/DashboardAnniversaires.tsx
decisions:
  - Overlay View absoluteFill pour le tint (glass + plain) plutôt que mélange de backgroundColor, pour cohérence et préserver le glass blur
  - overflow: 'hidden' ajouté à styles.card pour que l'overlay soit clippé au border radius
  - hexToRgba gère le passthrough rgb/rgba pour éviter une double-conversion
metrics:
  duration: 5min
  completed: 2026-03-31T12:27:56Z
  tasks_completed: 2
  files_modified: 10
---

# Quick Task 260331-jzy: Ajouter prop tinted sur DashboardCard

**One-liner:** Prop `tinted` sur DashboardCard appliquant un fond coloré subtil via overlay absolue (6% light / 10% dark), activée sur 9 sections dashboard.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Ajouter prop tinted à DashboardCard | f418bef | components/DashboardCard.tsx |
| 2 | Activer tinted sur les sections clés | 814e6ae | 9 fichiers dashboard |

## Implementation Details

### Task 1 — DashboardCard

- Fonction `hexToRgba(hex, alpha)` ajoutée avant le composant — gère hex 6 caractères + passthrough rgb/rgba
- Interface `DashboardCardProps` : nouvelle prop `/** Fond subtil coloré basé sur color. Default: false */ tinted?: boolean`
- `isDark` extrait de `useThemeColors()` (déjà utilisé via destructuring de primary/colors, ajout minimal)
- `tintBg` calculé depuis `accentColor` : `hexToRgba(accentColor, isDark ? 0.10 : 0.06)` ou `undefined` si `!tinted || !accentColor`
- Chemin **glass** : `<View style={[StyleSheet.absoluteFill, { backgroundColor: tintBg, borderRadius: Radius.xl }]} />` inséré avant `cardContent` dans GlassView
- Chemin **plain** : même overlay inséré avant `cardContent` dans la View principale
- `styles.card` : ajout de `overflow: 'hidden'` pour clipper l'overlay au border radius

### Task 2 — Sections dashboard

Toutes les occurrences de `<DashboardCard` dans les 9 fichiers ciblés ont reçu la prop `tinted` :

| Section | Color | Effet |
|---------|-------|-------|
| DashboardOverdue | colors.error | fond rouge subtil |
| DashboardGratitude | colors.info | fond bleu subtil |
| DashboardMeals | primary | fond thème subtil (3 états) |
| DashboardRdvs | colors.info | fond bleu subtil (3 états) |
| DashboardDefis | colors.warning | fond orange subtil |
| DashboardMenage | colors.success | fond vert subtil (3 états) |
| DashboardBudget | colors.success/error | fond conditionnel (2 états) |
| DashboardCourses | colors.warning | fond orange subtil |
| DashboardAnniversaires | colors.accentPink | fond rose subtil |

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Known Stubs

None.

## Self-Check: PASSED

- components/DashboardCard.tsx : modifié (hexToRgba, tinted prop, overlay, overflow hidden) - commit f418bef
- 9 fichiers dashboard : tinted ajouté à tous les DashboardCard - commit 814e6ae
- tsc --noEmit : aucune nouvelle erreur (seules erreurs docs/family-flow-promo.tsx, pre-existantes)
