---
phase: 14-parite-mobile-desktop
plan: "03"
subsystem: ui
tags: [react, typescript, health, routines, desktop, i18n]

requires:
  - phase: 14-01
    provides: VaultContext avec mutations health/routines, patterns GlassCard/SegmentedControl

provides:
  - Ecran Health desktop avec 3 onglets (croissance/vaccins/historique) et CRUD
  - Ecran Routines desktop avec timers CSS animés et drag-to-reorder

affects:
  - 14-04
  - 14-05

tech-stack:
  added: []
  patterns:
    - "SegmentedControl pour navigation onglets dans pages desktop"
    - "Hover-to-reveal delete sur lignes tableau per D-02"
    - "setInterval timer countdown + CSS transition width pour barre progression"
    - "Drag & drop HTML5 natif (draggable + onDragStart/onDragOver/onDrop) per D-02"
    - "useTranslation('common') avec fallback string per D-07"

key-files:
  created:
    - apps/desktop/src/pages/Health.tsx
    - apps/desktop/src/pages/Health.css
    - apps/desktop/src/pages/Routines.tsx
    - apps/desktop/src/pages/Routines.css
  modified: []

key-decisions:
  - "Historique médical stocké en state local (HealthRecord type ne contient pas de tableau historique) — session-only"
  - "completeRoutineStep est session-only confirmé (per décision Phase 14 STATE.md) — progressMap local en React state"
  - "Profile.role filtre 'enfant' | 'ado' (pas 'child') — conformément aux types @family-vault/core"
  - "Profile.avatar utilisé (pas .emoji) pour l'icone du profil — conformément aux types @family-vault/core"

requirements-completed: [PAR-01, PAR-02, PAR-03]

duration: 20min
completed: 2026-04-05
---

# Phase 14 Plan 03: Health et Routines Desktop Summary

**Ecrans Health (3 onglets CRUD + hover-to-reveal) et Routines (timers CSS setInterval + drag-to-reorder HTML5) pour la parité desktop/mobile**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-05T09:00:00Z
- **Completed:** 2026-04-05T09:10:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Ecran Health desktop avec SegmentedControl 3 onglets (Croissance/Vaccins/Historique), CRUD via addGrowthEntry/addVaccineEntry/saveHealthRecord, et hover-to-reveal delete per D-02
- Ecran Routines desktop avec liste de routines en cards, panneau détail cliquable, timer par étape (setInterval + barre CSS animée), drag & drop HTML5 natif pour réordonner les étapes
- Formulaires modaux pour chaque type de donnée avec validation et sélecteurs de vaccins courants
- Tous les textes UI via useTranslation('common') avec fallback string per D-07

## Task Commits

1. **Task 1: Ecran Health desktop** - `da25c3b` (feat)
2. **Task 2: Ecran Routines desktop** - `d64d03c` (feat)

## Files Created/Modified

- `apps/desktop/src/pages/Health.tsx` - Ecran santé avec onglets croissance/vaccins/historique, modals CRUD, hover-to-reveal delete
- `apps/desktop/src/pages/Health.css` - Styles tableau responsive, hover-to-reveal, vaccine chips, event rows
- `apps/desktop/src/pages/Routines.tsx` - Ecran routines avec timers setInterval, drag & drop HTML5, modals création/édition
- `apps/desktop/src/pages/Routines.css` - Layout responsive, barre de progression CSS animée, step rows avec bordure gauche

## Decisions Made

- Historique médical en state local car `HealthRecord` type ne contient pas de tableau `historique` — session-only acceptable pour la version desktop v1
- `completeRoutineStep` confirmé session-only per décision dans STATE.md — `progressMap` géré en React state local
- Utilisé `Profile.role === 'enfant' | 'ado'` (pas 'child') conformément aux types @family-vault/core
- Utilisé `Profile.avatar` (pas `.emoji`) conformément aux types @family-vault/core

## Deviations from Plan

None - plan executed exactly as written. Les deux fichiers stub Health.tsx et Routines.tsx existaient déjà (stubs vides), remplacés par l'implémentation complète.

## Issues Encountered

Deux corrections de types au cours de l'implémentation (non des déviations, mais des ajustements de précision) :
- `Profile.role` est `'enfant' | 'ado' | 'adulte'` (pas `'child'`) — corrigé avant tsc
- `Profile.avatar` (pas `.emoji`) — corrigé avant tsc

Aucune erreur TypeScript dans les fichiers créés. Les erreurs pré-existantes dans Stats.tsx restent ignorées per CLAUDE.md.

## Known Stubs

- **Historique médical** : `apps/desktop/src/pages/Health.tsx` — `medicalEvents` state est session-local. Le type `HealthRecord` ne contient pas de tableau `historique`, donc les événements ne persistent pas entre sessions. Intentionnel pour v1 — à relier à une extension du type `HealthRecord` dans une future phase.

## Next Phase Readiness

- Health et Routines sont fonctionnels avec CRUD pour croissance et vaccins
- Routines : drag-to-reorder et timers visuels complets
- `tsc --noEmit` passe sans erreur dans les nouveaux fichiers
- Prêt pour les prochains écrans de la phase 14

---
*Phase: 14-parite-mobile-desktop*
*Completed: 2026-04-05*
