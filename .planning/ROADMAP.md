# Roadmap: FamilyFlow

## Overview

Ce milestone stabilise l'app TestFlight (tests, nettoyage, write safety) puis enrichit la gamification. Pas de refacto archi — le god hook fonctionne et on est seul dev. Chaque phase est non-cassante et déployable sur TestFlight.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Safety Net** - Tests critiques, Sentry, nettoyage code mort, types `any`, ESLint
- [ ] **Phase 2: Write Safety + Couleurs** - Write queue par fichier, couleurs hardcodées → tokens, XP budget model
- [ ] **Phase 3: Gamification** - Événements saisonniers et quêtes familiales coopératives
- [x] **Phase 4: Ambiance + Retention** - Ambiance horaire, mutation dorée, flammes de streak (completed 2026-03-28)

## Phase Details

### Phase 1: Safety Net
**Goal**: Le codebase a un filet de sécurité — tests sur les modules critiques, visibilité sur les crashes production, et code mort éliminé
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, QUAL-01, QUAL-02, QUAL-04, QUAL-05
**Success Criteria** (what must be TRUE):
  1. `npx jest` tourne sans erreur avec jest-expo + RNTL configurés et au moins 1 test par module critique (budget, farm-engine, sagas-engine, world-grid)
  2. Un crash non-attrapé sur TestFlight remonte dans Sentry avec stacktrace lisible
  3. Les 5 fonctions dépréciées de lib/telegram.ts et la propriété menageTasks sont absentes du codebase
  4. `npx tsc --noEmit` ne rapporte aucune assertion `as any` sur les chemins de mutation dans useVault.ts
  5. ESLint avec `@typescript-eslint/no-explicit-any` est configuré et tourne sans erreur bloquante
**Plans:** 2/4 plans executed

Plans:
- [x] 01-01-PLAN.md — Tests unitaires pour les 4 modules critiques (budget, farm-engine, sagas-engine, world-grid)
- [x] 01-02-PLAN.md — Nettoyage code mort + correction as any + ESLint
- [x] 01-03-PLAN.md — Integration Sentry crash reporting
- [ ] 01-04-PLAN.md — Flows E2E Maestro (3 parcours critiques)

### Phase 2: Write Safety + Couleurs
**Goal**: Les écritures concurrentes ne perdent plus de données, les 228 couleurs hardcodées sont remplacées par tokens sémantiques, et un modèle XP budget gouverne les récompenses
**Depends on**: Phase 1
**Requirements**: ARCH-01, QUAL-03, GAME-01
**Success Criteria** (what must be TRUE):
  1. Compléter 10 tâches en succession rapide ne perd aucun XP ni aucune écriture dans gamification.md
  2. Le mode nuit n'affiche plus de couleurs hardcodées — tous les éléments structurels suivent le thème
  3. Un modèle XP budget est documenté dans constants/rewards.ts avec des valeurs calibrées
  4. Toute nouvelle source de récompense passe par constants/rewards.ts
**Plans**: TBD

### Phase 3: Gamification
**Goal**: La ferme a des événements saisonniers liés au vrai calendrier et des quêtes familiales coopératives donnent un objectif partagé
**Depends on**: Phase 2
**Requirements**: GAME-02, GAME-03
**Success Criteria** (what must be TRUE):
  1. L'interface ferme affiche des visuels saisonniers correspondant à la saison réelle sans action manuelle
  2. Une quête familiale peut être démarrée, progressée par n'importe quel membre, et complétée avec récompense distribuée
  3. Toutes les récompenses passent par constants/rewards.ts — aucune valeur XP inline
**Plans**: TBD

### Phase 4: Ambiance + Retention
**Goal**: L'ecran arbre reagit au moment de la journee avec des particules ambiantes (rosee le matin, lucioles la nuit), les cultures ont une mutation doree rare (3%, recompense x5), et les flammes de streak recompensent visuellement l'engagement quotidien
**Depends on**: Phase 3
**Requirements**: AMB-01, AMB-02, AMB-03
**Success Criteria** (what must be TRUE):
  1. Le diorama affiche des particules ambiantes correspondant a l'heure reelle (rosee matin, lucioles nuit) sans action manuelle
  2. plantCrop() a 3% de chance de creer une culture doree, visible par un liseré or, avec recompense x5 a la recolte
  3. Les flammes de streak s'affichent sous le diorama quand le streak >= 2, avec intensite croissante par palier (2+, 7+, 14+, 30+)
  4. Toutes les animations respectent useReducedMotion et se desactivent si l'utilisateur a active Reduce Motion
  5. `npx tsc --noEmit` passe sans nouvelles erreurs
**Plans:** 2/2 plans complete

Plans:
- [x] 06-01-PLAN.md — Mutation culture doree (types + farm-engine + FarmPlots visuel)
- [x] 06-02-PLAN.md — Ambiance horaire + flammes de streak (ambiance.ts + composants + integration tree.tsx)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Safety Net | 2/4 | In Progress|  |
| 2. Write Safety + Couleurs | 0/TBD | Not started | - |
| 3. Gamification | 0/TBD | Not started | - |
| 4. Ambiance + Retention | 2/2 | Complete   | 2026-03-28 |
