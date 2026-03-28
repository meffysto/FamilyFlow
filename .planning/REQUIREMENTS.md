# Requirements: FamilyFlow

**Defined:** 2026-03-28
**Core Value:** L'app doit rester fiable et stable pour un usage quotidien familial — les données ne doivent jamais être perdues ou corrompues, et les features existantes ne doivent pas régresser.

## v1 Requirements

Requirements pour ce milestone. Chaque requirement est mappé à une phase du roadmap.

### Testing

- [ ] **TEST-01**: Setup jest-expo + @testing-library/react-native avec config fonctionnelle
- [ ] **TEST-02**: Tests unitaires pour lib/budget.ts (parsing, sérialisation, calculs)
- [ ] **TEST-03**: Tests unitaires pour lib/mascot/farm-engine.ts (planter, récolter, timers)
- [ ] **TEST-04**: Tests unitaires pour lib/mascot/sagas-engine.ts (progression, cooldowns)
- [ ] **TEST-05**: Tests unitaires pour lib/mascot/world-grid.ts (placement, rendu grille)
- [ ] **TEST-06**: Sentry intégré pour crash reporting en production
- [ ] **TEST-07**: Tests E2E Maestro pour les 3-5 parcours utilisateur critiques

### Code Quality

- [ ] **QUAL-01**: Suppression des fonctions dépréciées dans lib/telegram.ts (5 fonctions)
- [ ] **QUAL-02**: Suppression de la propriété dépréciée menageTasks et du code de migration associé
- [ ] **QUAL-03**: Remplacement des 228 couleurs hardcodées par tokens sémantiques via useThemeColors()
- [ ] **QUAL-04**: Correction des 8 assertions `as any` sur les chemins de mutation dans useVault.ts
- [ ] **QUAL-05**: Setup ESLint avec @typescript-eslint/no-explicit-any

### Architecture

- [ ] **ARCH-01**: Write queue per-file pour les opérations concurrentes sur le vault
- [ ] **ARCH-02**: Extraction de useBudget depuis useVault (premier hook domaine)
- [ ] **ARCH-03**: Extraction de useRecipes depuis useVault
- [ ] **ARCH-04**: Extraction de useDefis depuis useVault
- [ ] **ARCH-05**: Extraction des hooks domaine restants (tasks, journal, calendar, profiles, etc.)
- [ ] **ARCH-06**: Split lib/parser.ts en modules par domaine (lib/parsers/*.ts)
- [ ] **ARCH-07**: VaultProvider compose les hooks domaine, useVault() API inchangée
- [ ] **ARCH-08**: Lazy loading recettes avec cache metadata

### Gamification

- [ ] **GAME-01**: Modèle XP budget pour éviter l'inflation des niveaux
- [ ] **GAME-02**: Événements saisonniers liés au calendrier réel (printemps, été, automne, hiver)
- [ ] **GAME-03**: Quêtes familiales coopératives (objectifs partagés entre membres)

### Ambiance & Retention

- [ ] **AMB-01**: Ambiance horaire du diorama — particules (rosée matin, lucioles nuit) + tint coloré selon l'heure
- [ ] **AMB-02**: Mutation culture dorée — 3% chance à la plantation, visuel or, récompense x5 à la récolte
- [ ] **AMB-03**: Flammes de streak — affichage visuel animé sous le diorama selon le streak du profil

## v2 Requirements

Déférés à un futur milestone. Trackés mais pas dans le roadmap actuel.

### Testing

- **TEST-V2-01**: Tests hooks avec renderHook pour chaque hook domaine extrait
- **TEST-V2-02**: Coverage report automatisé dans CI

### Architecture

- **ARCH-V2-01**: Optimisation foreground reload (stat/mtime pour skip fichiers inchangés)
- **ARCH-V2-02**: noUncheckedIndexedAccess progressif par fichier

### Gamification

- **GAME-V2-01**: Progression idle offline (cultures poussent pendant l'absence)
- **GAME-V2-02**: Boucle de soin des animaux
- **GAME-V2-03**: Célébrations milestones de l'arbre
- **GAME-V2-04**: Système de rareté pour les récoltes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend serveur / BDD | L'app reste 100% locale + iCloud |
| Refonte UI complète | On stabilise, on ne redesign pas |
| Publication App Store | TestFlight famille pour l'instant |
| Migration hors Obsidian | Le vault Markdown reste la source de vérité |
| Accessibilité WCAG | Pas prioritaire pour usage familial privé |
| Streaks punitives | Recherche montre que c'est nocif pour les enfants |
| Contenu IA généré par action | Brûle les crédits API pour peu de valeur |
| Détox E2E | Maestro recommandé pour Expo en 2026 |
| @shopify/react-native-skia | Uniquement si New Architecture activée — à évaluer plus tard |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 1 | Pending |
| TEST-04 | Phase 1 | Pending |
| TEST-05 | Phase 1 | Pending |
| TEST-06 | Phase 1 | Pending |
| TEST-07 | Phase 1 | Pending |
| QUAL-01 | Phase 1 | Pending |
| QUAL-02 | Phase 1 | Pending |
| QUAL-04 | Phase 1 | Pending |
| QUAL-05 | Phase 1 | Pending |
| QUAL-03 | Phase 2 | Pending |
| ARCH-02 | Phase 2 | Pending |
| ARCH-03 | Phase 2 | Pending |
| ARCH-04 | Phase 2 | Pending |
| ARCH-01 | Phase 3 | Pending |
| GAME-01 | Phase 3 | Pending |
| GAME-02 | Phase 4 | Pending |
| GAME-03 | Phase 4 | Pending |
| ARCH-05 | Phase 5 | Pending |
| ARCH-06 | Phase 5 | Pending |
| ARCH-07 | Phase 5 | Pending |
| ARCH-08 | Phase 5 | Pending |
| AMB-01 | Phase 6 | Pending |
| AMB-02 | Phase 6 | Pending |
| AMB-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after Phase 6 planning — AMB-01, AMB-02, AMB-03 added*
