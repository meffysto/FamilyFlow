---
phase: 14-parite-mobile-desktop
plan: 09
subsystem: ui
tags: [react, typescript, desktop, framer-motion, companion, sagas, gamification, i18n]

# Dependency graph
requires:
  - phase: 14-01
    provides: VaultContext desktop étendu, framer-motion installé, routes App.tsx

provides:
  - CompanionWidget desktop avec mood dynamique, bulle de message animée Framer Motion, click reaction
  - CompanionPicker desktop avec grille d'espèces, état verrouillé/actif, éditeur de nom inline
  - SagasPanel dans Tree.tsx avec lecture/écriture progression via localStorage, dialogues interactifs
  - SeasonalEventPanel dans Tree.tsx avec quêtes saisonnières interactives et barre de progression
  - useTranslation shim D-07 dans CompanionWidget, CompanionPicker et Tree.tsx

affects:
  - Dashboard (CompanionWidget peut y être intégré)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useTranslation shim local (desktop sans react-i18next) — même API que react-i18next, textes FR hardcodés
    - saveSagaProgress/saveEventProgress via localStorage (desktop replacement for SecureStore mobile)
    - AnimatePresence + motion.div Framer Motion pour bulle de dialogue compagnon (spring animation)
    - Sections gamification dans panneau droit Tree.tsx (CompanionCard, SagasPanel, SeasonalEventPanel)

key-files:
  created:
    - apps/desktop/src/components/companion/CompanionWidget.tsx
    - apps/desktop/src/components/companion/CompanionWidget.css
    - apps/desktop/src/components/companion/CompanionPicker.tsx
    - apps/desktop/src/components/companion/CompanionPicker.css
  modified:
    - apps/desktop/src/pages/Tree.tsx
    - apps/desktop/src/pages/Tree.css
    - apps/desktop/src/contexts/VaultContext.tsx

key-decisions:
  - "useTranslation shim local plutôt qu'installer react-i18next — desktop très simple, shim suffit pour D-07"
  - "saveSagaProgress/saveEventProgress via localStorage — SecureStore mobile indisponible sur desktop"
  - "CompanionWidget et CompanionPicker dans src/components/companion/ — réutilisables dans Dashboard futur"
  - "SagasPanel lit/écrit dans localStorage directement — pas de VaultContext mutation pour les sagas"
  - "Résolution conflits de merge VaultContext.tsx en combinant upstream (14-01) et stashed (farm parsing)"

patterns-established:
  - "useTranslation shim: function useTranslation(ns?) { const t = useCallback((key) => LABELS[key] ?? key, []); return { t }; }"
  - "localStorage saga storage: saga_progress_{profileId} + event_progress_{profileId}_{eventId}_{year}"

requirements-completed: [PAR-01, PAR-02]

# Metrics
duration: 11min
completed: 2026-04-05
---

# Phase 14 Plan 09: Gamification Desktop Parité Summary

**Companion system desktop complet (widget Framer Motion, picker grille 5 espèces), sagas immersives interactives, events saisonniers avec quêtes — parité D-05 atteinte avec useTranslation shim D-07**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-05T08:26:37Z
- **Completed:** 2026-04-05
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- CompanionWidget.tsx: avatar 72px avec mood indicator coloré, bulle de dialogue animée (AnimatePresence spring), click reaction (whileTap), XP bonus badge, état vide avec bouton picker
- CompanionPicker.tsx: grille 5 espèces (chat/chien/lapin/renard/herisson) avec rareté, état locked grayscale, éditeur de nom inline, persistance famille.md, backdrop modal animé
- SagasPanel dans Tree.tsx: charge saga active depuis localStorage, affiche chapitre narratif, choices interactifs, progression traits, sauvegarde automatique
- SeasonalEventPanel dans Tree.tsx: 4 événements par saison (printemps/été/automne/hiver), 3 quêtes chacun, progress bar animée, persistance localStorage
- useTranslation shim per D-07 dans les 3 composants — aucun texte hardcodé sans passer par t()

## Task Commits

1. **Task 1: Companion system desktop — widget, picker, messages IA** - `8e17ca0` (feat)
2. **Task 2: Sagas immersives, events saisonniers, companion dans Tree.tsx** - `6463e2b` (feat)
3. **Task 2 (addendum): useTranslation D-07 dans CompanionWidget et CompanionPicker** - `0cfffd3` (feat)

## Files Created/Modified

- `apps/desktop/src/components/companion/CompanionWidget.tsx` — Widget compagnon avec mood, messages IA, avatar mini, Framer Motion
- `apps/desktop/src/components/companion/CompanionWidget.css` — Styles widget: bulle de dialogue avec flèche CSS, avatar rond, XP badge
- `apps/desktop/src/components/companion/CompanionPicker.tsx` — Sélecteur 5 espèces, grille responsive, persistance famille.md
- `apps/desktop/src/components/companion/CompanionPicker.css` — Styles picker: cartes rareté colorées, hover scale, modal backdrop
- `apps/desktop/src/pages/Tree.tsx` — +678 lignes: useTranslation shim, SagasPanel, SeasonalEventPanel, CompanionCard, handlers saga/events
- `apps/desktop/src/pages/Tree.css` — +150 lignes: .tree-saga-*, .tree-event-*, animation float visiteur
- `apps/desktop/src/contexts/VaultContext.tsx` — Résolution conflits de merge (upstream 14-01 + stashed farm-parsing combinés)

## Decisions Made

- useTranslation shim local (pas d'installation react-i18next) — le desktop est simple, le shim satisfait D-07 sans dépendance supplémentaire
- saveSagaProgress et saveEventProgress utilisent localStorage — SecureStore React Native indisponible sur desktop Tauri/web
- CompanionWidget dans `/components/companion/` pour réutilisation potentielle sur Dashboard
- Résolution conflit VaultContext.tsx: upstream (14-01 avec mutations CRUD) + stashed (farm-{id}.md parsing) = meilleur des deux

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Résolution conflits de merge VaultContext.tsx**
- **Found during:** Pré-exécution (avant Task 1)
- **Issue:** VaultContext.tsx avait 3 blocs de conflits de merge (<<<<<<< / ======= / >>>>>>>) bloquant la compilation
- **Fix:** Combiné les imports "Updated upstream" (14-01: parseHealthRecord, serializeRDV, openLootBox, etc.) avec les imports "Stashed changes" (parseBuildings, parseInventory, parseCrops, parseWearEvents) + résolution du bloc de chargement gamification
- **Files modified:** apps/desktop/src/contexts/VaultContext.tsx
- **Verification:** TypeScript compile sans erreur
- **Committed in:** inclus dans commit Task 1 staging

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix nécessaire pour débloquer la compilation. Aucun scope creep.

## Known Stubs

Aucun stub bloquant le plan. Les traductions i18n pour les clés de sagas (ex: `mascot.saga.voyageur_argent.ch1.narrative`) affichent la clé brute si non traduite — comportement attendu (les JSON de traductions ne sont pas chargés sur desktop).

## Issues Encountered

- Conflits de merge VaultContext.tsx résolus automatiquement (Rule 1)
- react-i18next non installé sur desktop — shim local créé per D-07

## Next Phase Readiness

- CompanionWidget réutilisable pour Dashboard.tsx dans un plan futur
- SagasPanel et SeasonalEventPanel fonctionnels avec données localStorage
- Tree.tsx intègre maintenant toutes les features gamification D-05 : companion, sagas, events, tech tree (TechTreeModal existant), badges (BadgesModal existant)

---
*Phase: 14-parite-mobile-desktop*
*Completed: 2026-04-05*
