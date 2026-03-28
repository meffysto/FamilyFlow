# Roadmap: FamilyFlow

## Overview

Ce milestone stabilise une app production TestFlight avant d'enrichir la gamification. Les phases suivent un ordre de dépendance non négociable : filet de sécurité (tests + nettoyage) → qualité code (couleurs + extractions initiales) → écriture concurrente (gate pour toute la gamification) → enrichissement ferme/quêtes → finalisation de l'architecture. Chaque phase laisse l'app non-cassante et déployable sur TestFlight.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Safety Net** - Setup tests, Sentry, nettoyage code mort et types `any`
- [ ] **Phase 2: Code Quality + Extractions initiales** - 228 couleurs hardcodées → tokens, hooks domaine feuilles
- [ ] **Phase 3: Write Concurrency + XP Model** - Write queue par fichier, modèle XP budget
- [ ] **Phase 4: Gamification Enrichment** - Événements saisonniers et quêtes familiales coopératives
- [ ] **Phase 5: Architecture Completion** - Extraction hooks restants, split parser, VaultProvider composer

## Phase Details

### Phase 1: Safety Net
**Goal**: Le codebase a un filet de sécurité — tests sur les modules critiques, visibilité sur les crashes production, et code mort éliminé avant tout refactoring
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, QUAL-01, QUAL-02, QUAL-04, QUAL-05
**Success Criteria** (what must be TRUE):
  1. `npx jest` tourne sans erreur avec jest-expo + RNTL configurés et au moins 1 test par module critique (budget, farm-engine, sagas-engine, world-grid)
  2. Un crash non-attrapé sur TestFlight remonte dans Sentry avec stacktrace lisible
  3. Les 5 fonctions dépréciées de lib/telegram.ts et la propriété menageTasks sont absentes du codebase
  4. `npx tsc --noEmit` ne rapporte aucune assertion `as any` sur les chemins de mutation dans useVault.ts
  5. ESLint avec `@typescript-eslint/no-explicit-any` est configuré et tourne en CI sans erreur bloquante
**Plans**: TBD

### Phase 2: Code Quality + Extractions initiales
**Goal**: Les 228 couleurs hardcodées sont remplacées par tokens sémantiques et les trois hooks domaine les plus isolés (budget, recettes, défis) sont extraits de useVault
**Depends on**: Phase 1
**Requirements**: QUAL-03, ARCH-02, ARCH-03, ARCH-04
**Success Criteria** (what must be TRUE):
  1. Le mode nuit n'affiche plus de couleurs hardcodées dans les écrans budget, recettes et défis — tous les éléments structurels suivent le thème
  2. `useBudget()`, `useRecipes()` et `useDefis()` sont des hooks importables indépendamment, testés en isolation avec un VaultManager mocké
  3. `useVault()` retourne le même état qu'avant l'extraction — aucun composant consommateur n'a été modifié
  4. `npx tsc --noEmit` passe sans nouvelles erreurs après chaque extraction
**Plans**: TBD

### Phase 3: Write Concurrency + XP Model
**Goal**: Les écritures concurrentes sur les fichiers vault partagés ne perdent plus de données, et un modèle XP budget documenté gouverne toutes les sources de récompense
**Depends on**: Phase 2
**Requirements**: ARCH-01, GAME-01
**Success Criteria** (what must be TRUE):
  1. Compléter 10 tâches en succession rapide ne perd aucun XP ni aucune écriture dans gamification.md — vérifiable par inspection directe du fichier
  2. Un modèle XP budget est documenté dans constants/rewards.ts avec des valeurs calibrées pour une "journée famille moyenne"
  3. Toute nouvelle source de récompense future passant par constants/rewards.ts ne peut pas créer d'inflation de niveau sans modifier le fichier de budget explicitement
**Plans**: TBD

### Phase 4: Gamification Enrichment
**Goal**: La ferme récompense le retour quotidien via des événements saisonniers liés au vrai calendrier, et des quêtes familiales coopératives donnent un objectif partagé multi-jours
**Depends on**: Phase 3
**Requirements**: GAME-02, GAME-03
**Success Criteria** (what must be TRUE):
  1. L'interface de la ferme affiche des visuels saisonniers correspondant à la saison réelle (printemps/été/automne/hiver) sans action manuelle de l'utilisateur
  2. Une quête familiale coopérative peut être démarrée, progressée par n'importe quel membre, et complétée — avec récompense distribuée à tous les participants
  3. Toutes les récompenses farm et quêtes passent par constants/rewards.ts — aucune valeur XP inline dans le code de gamification
**Plans**: TBD

### Phase 5: Architecture Completion
**Goal**: useVault devient un thin orchestrator composant des hooks domaine, lib/parser.ts est splitté en modules par domaine, et le lazy loading des recettes réduit le temps de chargement initial
**Depends on**: Phase 4
**Requirements**: ARCH-05, ARCH-06, ARCH-07, ARCH-08
**Success Criteria** (what must be TRUE):
  1. useVault.ts fait moins de 500 lignes et délègue à des hooks domaine couvrant tasks, journal, calendar, meals, profiles, memories, notes, stock
  2. lib/parser.ts n'existe plus — remplacé par lib/parsers/index.ts (barrel) + un fichier par domaine, sans aucun import cassé dans les consommateurs
  3. Les recettes ne sont pas toutes chargées au démarrage — un cache metadata permet d'ouvrir l'app sans parser tous les fichiers .cook
  4. `useVault()` retourne le même contrat de type qu'avant — aucun composant consommateur n'a été modifié
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Safety Net | 0/TBD | Not started | - |
| 2. Code Quality + Extractions initiales | 0/TBD | Not started | - |
| 3. Write Concurrency + XP Model | 0/TBD | Not started | - |
| 4. Gamification Enrichment | 0/TBD | Not started | - |
| 5. Architecture Completion | 0/TBD | Not started | - |
