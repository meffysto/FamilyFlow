# Roadmap: FamilyFlow

## Milestones

- ✅ **v1.0 Stabilisation** - Phases 1-4 (shipped 2026-03-28)
- 🚧 **v1.1 Ferme Enrichie** - Phases 5-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 Stabilisation (Phases 1-4) - SHIPPED 2026-03-28</summary>

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
**Plans:** 4/4 plans executed

Plans:
- [x] 01-01-PLAN.md — Tests unitaires pour les 4 modules critiques (budget, farm-engine, sagas-engine, world-grid)
- [x] 01-02-PLAN.md — Nettoyage code mort + correction as any + ESLint
- [x] 01-03-PLAN.md — Integration Sentry crash reporting
- [x] 01-04-PLAN.md — Flows E2E Maestro (3 parcours critiques)

### Phase 2: Write Safety + Couleurs
**Goal**: Les écritures concurrentes ne perdent plus de données, les 228 couleurs hardcodées sont remplacées par tokens sémantiques, et un modèle XP budget gouverne les récompenses
**Depends on**: Phase 1
**Requirements**: ARCH-01, QUAL-03, GAME-01
**Success Criteria** (what must be TRUE):
  1. Compléter 10 tâches en succession rapide ne perd aucun XP ni aucune écriture dans gamification.md
  2. Le mode nuit n'affiche plus de couleurs hardcodées — tous les éléments structurels suivent le thème
  3. Un modèle XP budget est documenté dans constants/rewards.ts avec des valeurs calibrées
  4. Toute nouvelle source de récompense passe par constants/rewards.ts
**Plans:** 3/3 plans

Plans:
- [x] 02-01-PLAN.md — Write queue per-file dans VaultManager + modele XP budget
- [x] 02-02-PLAN.md — Migration couleurs ecrans (app/) et composants high-priority
- [x] 02-03-PLAN.md — Migration couleurs composants restants + verification visuelle mode nuit

### Phase 3: Gamification
**Goal**: La ferme a des événements saisonniers liés au vrai calendrier et des quêtes familiales coopératives donnent un objectif partagé
**Depends on**: Phase 2
**Requirements**: GAME-02, GAME-03
**Success Criteria** (what must be TRUE):
  1. L'interface ferme affiche des visuels saisonniers correspondant à la saison réelle sans action manuelle
  2. Une quête familiale peut être démarrée, progressée par n'importe quel membre, et complétée avec récompense distribuée
  3. Toutes les récompenses passent par constants/rewards.ts — aucune valeur XP inline
**Plans:** 2/2 plans

Plans:
- [x] 03-01-PLAN.md — Particules saisonnieres dans le diorama ferme (SeasonalParticles)
- [x] 03-02-PLAN.md — Quetes familiales cooperatives (types + logique + UI defis)

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

</details>

### 🚧 v1.1 Ferme Enrichie (In Progress)

**Milestone Goal:** Enrichir la ferme pour qu'elle soit un vrai moteur de motivation — plus de profondeur, plus de raisons de revenir faire ses tâches. La ferme est le levier de motivation, pas le produit lui-même.

#### Phase 5: Visuels Ferme
**Goal**: La ferme est visuellement vivante — cycle jour/nuit cohérent avec l'heure réelle et sprites améliorés pour les cultures et animaux
**Depends on**: Phase 4
**Requirements**: VIS-01, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):
  1. L'écran ferme adapte automatiquement sa luminosité et teinte selon l'heure réelle (clair le jour, tamisé la nuit) sans action manuelle
  2. Chaque culture affiche au moins 2 frames d'animation distinctes par stade de croissance — l'animation est perceptible
  3. Les animaux ont une animation idle visible et une animation de marche différenciée — ils paraissent vivants au repos
  4. `npx tsc --noEmit` passe sans nouvelles erreurs
**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — Transition animee cycle jour/nuit dans AmbientParticles (VIS-01)
- [x] 05-02-PLAN.md — Assets Mana Seed cultures + animation 2-frames CropCell (VIS-02)
- [x] 05-03-PLAN.md — Assets Mana Seed animaux + direction marche walk_left (VIS-03)

#### Phase 6: Bâtiments Productifs
**Goal**: L'utilisateur peut construire des bâtiments sur la ferme qui génèrent des ressources passives, créant une raison de revenir régulièrement
**Depends on**: Phase 5
**Requirements**: BAT-01, BAT-02, BAT-03
**Success Criteria** (what must be TRUE):
  1. L'utilisateur peut placer un bâtiment (moulin, serre, étable) sur une parcelle dédiée et le voir apparaître sur la ferme
  2. Un bâtiment placé génère automatiquement une ressource toutes les X heures — visible dans l'inventaire sans replanter
  3. Un bâtiment peut être amélioré au moins 2 fois, chaque niveau augmentant visiblement la production affichée
  4. Les ressources produites sont persistées dans le vault et survivent à un redémarrage de l'app
**Plans:** 2 plans

Plans:
- [x] 06-01-PLAN.md — Types etendus + building-engine + migration parser + useFarm
- [x] 06-02-PLAN.md — UI batiments (WorldGridView, bottom sheets, integration tree.tsx)

#### Phase 7: Craft
**Goal**: Les récoltes brutes peuvent être combinées en items spéciaux via des recettes, offrant plus de valeur XP et une boucle de progression plus riche
**Depends on**: Phase 6
**Requirements**: CRA-01, CRA-02, CRA-03
**Success Criteria** (what must be TRUE):
  1. L'utilisateur peut combiner des récoltes pour créer un item spécial (ex : confiture, bouquet) via une interface de craft
  2. Un catalogue liste toutes les recettes disponibles avec les ingrédients exacts requis — l'utilisateur sait quoi cultiver
  3. Un item crafté attribue plus d'XP qu'une récolte brute équivalente — la différence est visible dans le résumé de récompense
  4. Les items craftés sont persistés dans le vault et apparaissent dans l'inventaire du profil
**Plans:** 2/2 plans complete

Plans:
- [x] 07-01-PLAN.md — Types craft + craft-engine + refactoring harvestCrop inventaire + parser + useFarm
- [x] 07-02-PLAN.md — CraftSheet UI (Atelier bottom sheet) + integration tree.tsx + i18n

#### Phase 8: Progression Ferme
**Goal**: Un arbre de technologies ferme débloque des améliorations et de nouvelles zones, donnant une direction claire à la progression long terme
**Depends on**: Phase 7
**Requirements**: PRO-01, PRO-02, PRO-03
**Success Criteria** (what must be TRUE):
  1. L'écran arbre de technologies affiche les noeuds de progression ferme disponibles, débloqués, et verrouillés avec leurs coûts
  2. Débloquer un noeud tech produit un effet observable (vitesse de pousse augmentée, nouvelle culture disponible, rendement amélioré)
  3. L'utilisateur peut dépenser des ressources pour débloquer une nouvelle zone/parcelle — la zone apparaît sur la ferme
  4. La progression tech est persistée dans le vault — les déblocages survivent à un redémarrage
**Plans**: TBD

#### Phase 9: Cadeaux Familiaux
**Goal**: Les membres de la famille peuvent s'envoyer des récoltes et items craftés, renforçant la dimension coopérative et la motivation partagée
**Depends on**: Phase 8
**Requirements**: SOC-01, SOC-02
**Success Criteria** (what must be TRUE):
  1. Un membre peut sélectionner une récolte ou un item crafté depuis son inventaire et l'envoyer à un autre profil familial
  2. Le destinataire reçoit une notification locale indiquant qui lui a envoyé quoi
  3. L'item envoyé apparaît dans l'inventaire du destinataire sans action supplémentaire de l'expéditeur
  4. L'item est retiré de l'inventaire de l'expéditeur au moment de l'envoi — pas de duplication possible
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Safety Net | v1.0 | 4/4 | Complete | 2026-03-28 |
| 2. Write Safety + Couleurs | v1.0 | 3/3 | Complete | 2026-03-28 |
| 3. Gamification | v1.0 | 2/2 | Complete | 2026-03-28 |
| 4. Ambiance + Retention | v1.0 | 2/2 | Complete | 2026-03-28 |
| 5. Visuels Ferme | v1.1 | 3/3 | Complete   | 2026-03-28 |
| 6. Bâtiments Productifs | v1.1 | 0/2 | Planned | - |
| 7. Craft | v1.1 | 2/2 | Complete   | 2026-03-29 |
| 8. Progression Ferme | v1.1 | 0/TBD | Not started | - |
| 9. Cadeaux Familiaux | v1.1 | 0/TBD | Not started | - |
