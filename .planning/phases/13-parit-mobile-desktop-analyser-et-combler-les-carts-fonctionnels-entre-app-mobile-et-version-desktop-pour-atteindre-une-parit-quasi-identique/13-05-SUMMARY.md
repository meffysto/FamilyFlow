---
phase: 14-parite-mobile-desktop
plan: 05
subsystem: ui
tags: [react, desktop, typescript, i18n, pregnancy, night-mode, compare, photos, navigation]

requires:
  - phase: 14-01
    provides: VaultContext desktop avec pregnancyEntries, addPregnancyEntry, files

provides:
  - Écran Pregnancy desktop — timeline SA 1-41, notes entrées, barre de progression
  - Écran NightMode desktop — interface nuit ultra-sombre, timer tétées, historique
  - Écran Compare desktop — split view 2 photos côte à côte, zoom molette + boutons
  - Écran More desktop — hub navigation grille vers 9 écrans secondaires

affects: [14-06, 14-07, 14-08, 14-09]

tech-stack:
  added: []
  patterns:
    - "NightMode couleurs hardcodées (#0a0a0a, #661111) pour préserver vision nocturne — exception délibérée à useThemeColors()"
    - "Compare: zoom partagé entre 2 panels via état local + onWheel + boutons +/-"
    - "More: tableau constant MORE_ITEMS + useNavigate pour hub navigation"
    - "Page-level timeline: div.pregnancy-timeline avec border-left + dots absolus positionnés"

key-files:
  created:
    - apps/desktop/src/pages/Pregnancy.tsx
    - apps/desktop/src/pages/Pregnancy.css
    - apps/desktop/src/pages/NightMode.tsx
    - apps/desktop/src/pages/NightMode.css
    - apps/desktop/src/pages/Compare.tsx
    - apps/desktop/src/pages/Compare.css
    - apps/desktop/src/pages/More.tsx
    - apps/desktop/src/pages/More.css
  modified:
    - apps/desktop/src/contexts/VaultContext.tsx

key-decisions:
  - "NightMode desktop utilise couleurs hardcodées pour vision nocturne — dérogation délibérée à useThemeColors() per D-01"
  - "Compare zoom partagé entre les deux panels — expérience cohérente comparaison côte à côte"
  - "Pregnancy remplace GlassCard par div+CSS card pour éviter prop className non supportée"
  - "serializeGamification dupliqué dans VaultContext supprimé — résolution merge conflict pré-existant"

patterns-established:
  - "Night mode pages: couleurs hardcodées OLED acceptables si documentées comme exception intentionnelle"
  - "Photo picker desktop: dropdown inline avec filtre texte + limite 100 résultats"

requirements-completed: [PAR-01]

duration: 8min
completed: 2026-04-05
---

# Phase 14 Plan 05: Écrans Pregnancy, NightMode, Compare, More Summary

**4 écrans desktop créés : timeline grossesse SA 1-41, interface nuit OLED timer tétées, comparaison photos split-view avec zoom molette, hub navigation grille responsive**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T09:04:50Z
- **Completed:** 2026-04-05T09:12:35Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Pregnancy.tsx: timeline verticale 41 semaines avec jalons développement bébé, barre de progression, grille notes, modal ajout entrée (semaine, date, poids, symptômes, notes)
- NightMode.tsx: fond #0a0a0a, texte rouge atténué pour vision nocturne, horloge setInterval 1s, timer tétées avec pause/reprise, historique session avec calcul intervalles entre tétées
- Compare.tsx: split view 2 colonnes, sélecteur photo avec filtre, zoom partagé via onWheel + boutons +/-, état vide si pas de photos
- More.tsx: grille auto-fill minmax(260px, 1fr), 9 cartes vers écrans secondaires, useNavigate de react-router-dom, hover scale animation

## Task Commits

1. **Task 1: Écrans Pregnancy + NightMode** - `e84a3b7` (feat)
2. **Task 2: Écrans Compare + More** - `f8c99b1` (feat)

**Plan metadata:** *(à venir dans le commit docs)*

## Files Created/Modified

- `apps/desktop/src/pages/Pregnancy.tsx` — Timeline grossesse SA 1-41, notes semaine, modal ajout, useTranslation
- `apps/desktop/src/pages/Pregnancy.css` — Timeline border-left, dots positionnés, progress bar, notes grid
- `apps/desktop/src/pages/NightMode.tsx` — Interface OLED nuit, setInterval horloge+timer, historique tétées
- `apps/desktop/src/pages/NightMode.css` — Fond #0a0a0a, texte #661111, boutons tactiles large
- `apps/desktop/src/pages/Compare.tsx` — Split 2 panels, sélecteur photo, zoom onWheel + boutons
- `apps/desktop/src/pages/Compare.css` — grid-template-columns 1fr 2px 1fr, picker dropdown, image zone
- `apps/desktop/src/pages/More.tsx` — Grille 9 cartes navigation, useNavigate react-router-dom
- `apps/desktop/src/pages/More.css` — Grid auto-fill responsive, hover scale transition
- `apps/desktop/src/contexts/VaultContext.tsx` — Merge conflict résolu (serializeGamification dupliqué)

## Decisions Made

- **NightMode couleurs hardcodées** : L'écran nuit exige des couleurs OLED fixes pour préserver la vision nocturne. Dérogation délibérée à `useThemeColors()` per D-01, documentée comme exception intentionnelle.
- **Pregnancy remplace GlassCard par div** : GlassCard ne supporte pas `className` prop. Les cards notes et la card progression utilisent des div avec CSS glass-card inline plutôt que GlassCard composant.
- **Compare zoom partagé** : Les deux panels partagent le même état de zoom — facilite la comparaison au même niveau de détail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Résolution merge conflict VaultContext.tsx**
- **Found during:** Task 1 (vérification tsc)
- **Issue:** `serializeGamification` importé deux fois — reste d'un merge conflict non résolu. Git status indiquait "both modified" avec marqueur dans l'index.
- **Fix:** `git add` pour marquer la résolution, puis suppression du doublon dans l'import.
- **Files modified:** `apps/desktop/src/contexts/VaultContext.tsx`
- **Verification:** `npx tsc --noEmit` passe sans erreur TS2300
- **Committed in:** `e84a3b7` (partie du commit task 1)

**2. [Rule 1 - Bug] GlassCard ne supporte pas className**
- **Found during:** Task 1 (erreur TypeScript TS2322)
- **Issue:** `<GlassCard className="pregnancy-progress-card">` — l'interface GlassCardProps ne déclare pas `className`
- **Fix:** Remplacé GlassCard par div avec styles glass card en CSS, supprimé l'import GlassCard
- **Files modified:** `apps/desktop/src/pages/Pregnancy.tsx`, `apps/desktop/src/pages/Pregnancy.css`
- **Verification:** `npx tsc --noEmit` passe sans erreur Pregnancy
- **Committed in:** `e84a3b7`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Corrections nécessaires pour compilation correcte. Aucun écart fonctionnel.

## Issues Encountered

- STATE.md avait des marqueurs de merge conflict (UU dans git status) — résolu en choisissant la version "Updated upstream" (la plus récente avec statut 14-01)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Les 4 écrans sont fonctionnels et enregistrés dans App.tsx (routes déjà définies)
- tsc passe proprement
- Ready pour les plans 14-06 à 14-09 (autres écrans desktop restants)

---
*Phase: 14-parite-mobile-desktop*
*Completed: 2026-04-05*
