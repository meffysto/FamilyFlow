# Quick Task 260331-jzy: Ajouter prop tinted sur DashboardCard pour fond subtil coloré par section

**Mode:** quick
**Created:** 2026-03-31

## Plan 1: Prop tinted + activation sections

### Task 1: Ajouter prop tinted à DashboardCard

**files:** `components/DashboardCard.tsx`
**action:**
- Ajouter prop `tinted?: boolean` (default false) à DashboardCardProps
- Quand `tinted` est true et `color` est fourni, ajouter un fond subtil sur la carte :
  - Pour le mode `glass` (GlassView) : ajouter une View overlay absolue avec `backgroundColor: accentColor` à 6% opacité (utiliser une string rgba calculée), positionnée derrière le contenu avec `borderRadius: Radius.xl`
  - Pour le mode plain (View) : mélanger dans le style backgroundColor existant avec la même couleur à 6% opacité
- Approche concrète pour convertir hex en rgba : créer une fonction utilitaire locale `hexToRgba(hex: string, alpha: number): string` en haut du fichier
- En dark mode, utiliser 10% d'opacité au lieu de 6% pour que le tint soit visible sur fond sombre (vérifier `isDark` depuis useThemeColors)
**verify:** Le composant compile, la prop est optionnelle et ne casse rien quand non fournie
**done:** DashboardCard supporte la prop tinted

### Task 2: Activer tinted sur les sections clés

**files:** `components/dashboard/DashboardOverdue.tsx`, `components/dashboard/DashboardGratitude.tsx`, `components/dashboard/DashboardMeals.tsx`, `components/dashboard/DashboardRdvs.tsx`, `components/dashboard/DashboardDefis.tsx`, `components/dashboard/DashboardMenage.tsx`, `components/dashboard/DashboardBudget.tsx`, `components/dashboard/DashboardCourses.tsx`, `components/dashboard/DashboardAnniversaires.tsx`
**action:**
Ajouter `tinted` à chaque appel `<DashboardCard>` dans ces sections. Chacune a déjà une prop `color` sémantique :
- DashboardOverdue : `color={colors.error}` + `tinted` → fond rouge subtil
- DashboardGratitude : `color={colors.info}` + `tinted` → fond bleu/violet subtil  
- DashboardMeals : `color={primary}` + `tinted` → fond thème subtil
- DashboardRdvs : `color={colors.info}` + `tinted` → fond bleu subtil
- DashboardDefis : `color={colors.warning}` + `tinted` → fond orange subtil
- DashboardMenage : `color={colors.success}` + `tinted` → fond vert subtil
- DashboardBudget : `color={colors.success/error}` + `tinted` → fond conditionnel
- DashboardCourses : `color={colors.warning}` + `tinted` → fond orange subtil
- DashboardAnniversaires : `color={colors.accentPink}` + `tinted` → fond rose subtil

ATTENTION : certains fichiers ont PLUSIEURS appels à DashboardCard (état vide, état normal). Ajouter `tinted` à TOUS les appels dans chaque fichier.
**verify:** Tous les fichiers compilent, les cartes affichent un fond subtil différencié
**done:** Les sections clés du dashboard ont des fonds colorés différenciés
