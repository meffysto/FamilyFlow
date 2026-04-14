# Roadmap: FamilyFlow

## Milestones

- ✅ **v1.0 Stabilisation** — Phases 1-4 (shipped 2026-03-28)
- ✅ **v1.1 Ferme Enrichie** — Phases 5-14 (shipped 2026-04-07)
- ✅ **v1.2 Confort & Découverte** — Phases 15-18 (shipped 2026-04-08)
- ✅ **v1.3 Seed** — Phases 19-24 (shipped 2026-04-10)
- ✅ **v1.4 Jardin Familial** — Phases 25-28 (shipped 2026-04-11)
- 🚧 **v1.5 Village Vivant** — Phases 29-33 (planning)

## Phases

<details>
<summary>✅ v1.0 Stabilisation (Phases 1-4) — SHIPPED 2026-03-28</summary>

Voir `.planning/milestones/v1.0-ROADMAP.md` *(si archivé rétro)*.

</details>

<details>
<summary>✅ v1.1 Ferme Enrichie (Phases 5-14) — SHIPPED 2026-04-07</summary>

- 9 phases initialement planifiées + Phase 8.1 insérée + phases événements/parité/quêtes ajoutées en cours de route
- 22 plans, 36 tâches livrées
- Détails : `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Confort & Découverte (Phases 15-18) — SHIPPED 2026-04-08</summary>

- [x] Phase 15: Préférences alimentaires (7/7 plans) — completed 2026-04-08
- [x] Phase 16: Codex contenu (5/5 plans) — completed 2026-04-08
- [x] Phase 17: Codex UI (3/3 plans) — completed 2026-04-08
- [x] Phase 18: Tutoriel ferme (4/4 plans) — completed 2026-04-08

Détails : `.planning/milestones/v1.2-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.3 Seed (Phases 19-24) — SHIPPED 2026-04-10</summary>

**Milestone Goal :** Transformer la ferme en reflet différencié du quotidien familial en couplant sémantiquement chaque catégorie de tâche réelle à un effet ferme spécifique (wow moment tangible). Pure lecture des fichiers Obsidian, zéro régression, chaque effet cappé et configurable par famille.

- [x] **Phase 19: Détection catégorie sémantique** — Module de détection lisant filepath + sections + tags, feature flag off par défaut (completed 2026-04-09)
- [x] **Phase 20: Moteur d'effets + anti-abus** — Dispatcher, caps SecureStore, wiring des 10 effets wow sur les leviers existants (completed 2026-04-09)
- [x] **Phase 21: Feedback visuel + compagnon** — HarvestBurst variants, toasts, haptic, messages compagnon i18n FR+EN (completed 2026-04-09)
- [x] **Phase 22: UI config famille** — Écran Réglages Couplage sémantique, toggles par catégorie, stats semaine (completed 2026-04-09)
- [x] **Phase 23: Musée des effets** — SEED-002 lite : chronologie persistée dans gami-{id}.md, écran Musée minimal (completed 2026-04-10)
- [x] **Phase 24: Compagnon étendu** — SEED-003 lite : 4 event types activés (celebration dormant D-08), messages persistés, bulle dashboard (completed 2026-04-10)

Détails : `.planning/milestones/v1.3-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.4 Jardin Familial (Phases 25-28) — SHIPPED 2026-04-11</summary>

- [x] Phase 25: Fondation données village (2/2 plans) — completed 2026-04-10
- [x] Phase 26: Hook domaine jardin (2/2 plans) — completed 2026-04-10
- [x] Phase 27: Écran Village + composants (2/2 plans) — completed 2026-04-10
- [x] Phase 28: Portail + câblage contributions (2/2 plans) — completed 2026-04-11

Détails : `.planning/milestones/v1.4-ROADMAP.md`.

</details>

### 🚧 v1.5 Village Vivant (Phases 29-32) — IN PLANNING

**Milestone Goal :** Transformer la Place du Village statique en espace vivant et personnalisé — les avatars de la famille y apparaissent, les semaines réussies laissent des traces visuelles durables, l'ambiance change selon l'heure et la saison, et l'arbre familial commun devient le cœur symbolique du village. Polish milestone, aucune nouvelle dépendance npm, réutilisation stricte de l'infra existante (`ReactiveAvatar`, `TileMapRenderer`, `useGarden`, `FarmProfileData`).

- [x] **Phase 29: Avatars vivants + portail retour** — Avatars par profil sur la carte village avec état d'activité hebdo + portail bidirectionnel village → ferme — completed 2026-04-11
- [x] **Phase 30: Décorations persistantes** — Schéma append-only, déblocage par palier de feuilles famille, catalogue des 8 bâtiments (completed 2026-04-11)
- [ ] **Phase 31: Ambiance dynamique** — Cycle jour/nuit selon l'heure réelle + effets saisonniers superposés à la carte
- [ ] **Phase 32: Arbre familial commun** — Sprite central au cœur du village, évolution visuelle selon le streak collectif
- [ ] **Phase 33: Expéditions** — Missions avec risque : miser feuilles/récoltes, timer, résultats aléatoires pondérés, objets exclusifs

## Phase Details

### Phase 29: Avatars vivants + portail retour
**Goal**: Peupler la carte village d'avatars par profil actif reflétant l'activité hebdo de chacun et refermer la boucle de navigation avec un portail retour symétrique à celui de la ferme.
**Depends on**: Phase 28 (portail ferme → village existant, `useGarden` stable, `ReactiveAvatar` et `TileMapRenderer` déjà câblés sur l'écran village)
**Requirements**: VILL-01, VILL-02, VILL-03, VILL-11, VILL-12
**Success Criteria** (what must be TRUE):
  1. User voit un avatar par profil actif positionné à un emplacement fixe sur la carte village (même profil → même tile à chaque ouverture)
  2. User distingue visuellement (halo coloré ou opacité) les profils qui ont contribué cette semaine de ceux restés inactifs
  3. User peut tap sur un avatar pour faire apparaître une bulle "[Prénom] — X contributions cette semaine" qui se dismiss automatiquement
  4. User peut revenir à sa ferme perso depuis le village via un portail de retour visuel symétrique au portail ferme → village
  5. User voit une transition fade cross-dissolve Reanimated ~400ms lors du retour village → ferme, cohérente avec l'animation aller
**Plans:** 2 plans
Plans:
- [x] 29-PLAN-01-avatars-vivants.md — Avatars pixel art + halo actif hebdo + tooltip tap (VILL-01, 02, 03) — completed 2026-04-11
- [x] 29-PLAN-02-portail-retour.md — Portail partagé + fade 400ms retour village → ferme (VILL-11, 12) — completed 2026-04-11
**UI hint**: yes

### Phase 30: Décorations persistantes
**Goal**: Transformer chaque semaine d'objectif collectif réussie en trace visuelle durable — introduire le schéma de données append-only, le moteur de déblocage par palier de feuilles famille et le catalogue des 8 bâtiments débloquables (scope shift décorations → bâtiments pixel art, streak → feuilles lifetime per CONTEXT.md D-01/D-05).
**Depends on**: Phase 29 (carte village stable, pattern append-only `jardin-familial.md` déjà en place depuis Phase 25)
**Requirements**: VILL-04, VILL-05, VILL-06
**Success Criteria** (what must be TRUE):
  1. User voit une nouvelle construction (puits, boulangerie, marché, café, forge, moulin, port, bibliothèque) apparaître sur la carte village quand un palier feuilles famille est franchi
  2. User retrouve l'ensemble des bâtiments accumulés après un restart complet de l'app (persistance append-only dans `jardin-familial.md` section `## Constructions`)
  3. User peut ouvrir un catalogue listant les 8 bâtiments débloquables et voit clairement le palier associé (100, 300, 700, 1500, 3000, 6000, 12000, 25000 feuilles)
  4. User voit dans le catalogue quelles bâtiments sont déjà débloqués versus verrouillés (silhouette sombre), avec la progression actuelle vers le prochain palier
**Plans:** 3/3 plans complete
Plans:
- [x] 30-01-PLAN.md — Data layer : types + parser ## Constructions + catalogue statique + slots VILLAGE_GRID (VILL-05, VILL-06)
- [x] 30-02-PLAN.md — Unlock engine : useGarden familyLifetimeLeaves + effet append-on-threshold idempotent (VILL-04, VILL-05)
- [x] 30-03-PLAN.md — UI : BuildingSprite + BuildingTooltip + BuildingsCatalog modal + wiring village.tsx (VILL-04, VILL-06)
**UI hint**: yes

### Phase 31: Ambiance dynamique
**Goal**: Rendre le village sensible à l'heure réelle et à la saison courante — luminosité globale adaptative (jour/couchant/nuit avec lanternes) et effets saisonniers superposés à la carte.
**Depends on**: Phase 30 (décorations persistantes placées — les lanternes doivent pouvoir s'allumer la nuit)
**Requirements**: VILL-07, VILL-08
**Success Criteria** (what must be TRUE):
  1. User voit la luminosité globale du village varier selon l'heure réelle de l'appareil (jour clair, couchant tiède, nuit tamisée)
  2. User voit les lanternes du village s'allumer visuellement la nuit (état visuel distinct du jour)
  3. User voit un effet saisonnier spécifique village superposé à la carte selon la saison courante (pétales au printemps, papillons en été, feuilles mortes en automne, flocons en hiver)
  4. User voit l'ambiance basculer sans redémarrage de l'app — le passage d'une période à l'autre est perçu lors d'une ouverture ultérieure
**Plans**: TBD
**UI hint**: yes

### Phase 32: Arbre familial commun
**Goal**: Planter au cœur du village un arbre familial commun — distinct de l'arbre ferme perso — qui évolue visuellement au rythme du streak collectif de semaines d'objectif réussies.
**Depends on**: Phase 31 (ambiance dynamique stable — l'arbre central doit recevoir la lumière jour/nuit)
**Requirements**: VILL-09, VILL-10
**Success Criteria** (what must be TRUE):
  1. User voit un arbre familial commun planté au centre du village, avec un sprite visuellement distinct de l'arbre ferme perso
  2. User voit l'arbre évoluer par stades (graine → pousse → arbuste → arbre → arbre majestueux) selon le streak collectif de semaines réussies
  3. User retrouve le stade correct de l'arbre après un restart (persistance du streak collectif respectée)
  4. User voit le stade de l'arbre refléter fidèlement l'historique des semaines réussies (pas de désynchro avec le compteur affiché sur l'écran village)
**Plans**: TBD
**UI hint**: yes

### Phase 33: Expéditions
**Goal**: Créer un système d'expéditions inspiré OGame — le joueur mise des feuilles et des récoltes pour envoyer des expéditions de difficulté variable, reçoit un résultat aléatoire pondéré après un timer, et peut obtenir des objets exclusifs introuvables autrement. Sink récurrent infini pour l'économie de feuilles.
**Depends on**: Phase 30 (économie feuilles stable, catalogue bâtiments, stock récoltes via craft-engine)
**Requirements**: VILL-16, VILL-17, VILL-18, VILL-19, VILL-20
**Success Criteria** (what must be TRUE):
  1. User peut choisir une expédition parmi un catalogue de missions de difficulté croissante et voit clairement le coût d'entrée (feuilles + récoltes)
  2. User voit un timer en cours avec la durée restante et peut consulter les expéditions actives
  3. User reçoit un résultat aléatoire à la fin du timer (réussite/partielle/échec/découverte rare) avec feedback visuel et haptic
  4. User peut perdre sa mise en cas d'échec — le risque est réel et communiqué clairement avant lancement
  5. User peut obtenir via les expéditions des objets exclusifs (habitants, décos, graines rares) introuvables dans la boutique classique
  6. User retrouve ses expéditions en cours et résultats après un restart de l'app (persistance dans le vault)
**Plans:** 1/3 plans executed
Plans:
- [x] 33-01-PLAN.md — Types + parser CSV + expedition-engine (catalogue, roll, timer, pity, pool quotidien) (VILL-16, VILL-18, VILL-19, VILL-20)
- [ ] 33-02-PLAN.md — Hook useExpeditions + cellule Camp d'exploration + items exclusifs expedition (VILL-16, VILL-17, VILL-19, VILL-20)
- [ ] 33-03-PLAN.md — UI : ExpeditionsSheet modal + CampExplorationCell + ExpeditionChest + wiring tree.tsx (VILL-16, VILL-17, VILL-18, VILL-19, VILL-20)
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 29. Avatars vivants + portail retour | 2/2 | Completed | 2026-04-11 |
| 30. Décorations persistantes | 3/3 | Complete   | 2026-04-11 |
| 31. Ambiance dynamique | 0/TBD | Not started | - |
| 32. Arbre familial commun | 0/TBD | Not started | - |
| 33. Expéditions | 1/3 | In Progress|  |

## Archived Milestones

- **v1.0 Stabilisation** — `.planning/milestones/v1.0-ROADMAP.md` *(si archivé rétro)*
- **v1.1 Ferme Enrichie** — `.planning/milestones/v1.1-ROADMAP.md`
- **v1.2 Confort & Découverte** — `.planning/milestones/v1.2-ROADMAP.md`
- **v1.3 Seed** — `.planning/milestones/v1.3-ROADMAP.md` *(si archivé)*
- **v1.4 Jardin Familial** — `.planning/milestones/v1.4-ROADMAP.md`
