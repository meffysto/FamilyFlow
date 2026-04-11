# Roadmap: FamilyFlow

## Milestones

- ✅ **v1.0 Stabilisation** — Phases 1-4 (shipped 2026-03-28)
- ✅ **v1.1 Ferme Enrichie** — Phases 5-14 (shipped 2026-04-07)
- ✅ **v1.2 Confort & Découverte** — Phases 15-18 (shipped 2026-04-08)
- ✅ **v1.3 Seed** — Phases 19-24 (shipped 2026-04-10)
- ✅ **v1.4 Jardin Familial** — Phases 25-28 (shipped 2026-04-11)
- 🚧 **v1.5 Village Vivant** — Phases 29-32 (planning)

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

- [ ] **Phase 29: Avatars vivants + portail retour** — Avatars par profil sur la carte village avec état d'activité hebdo + portail bidirectionnel village → ferme
- [ ] **Phase 30: Décorations persistantes** — Schéma append-only, déblocage par palier de streak collectif, catalogue des ~8 décorations
- [ ] **Phase 31: Ambiance dynamique** — Cycle jour/nuit selon l'heure réelle + effets saisonniers superposés à la carte
- [ ] **Phase 32: Arbre familial commun** — Sprite central au cœur du village, évolution visuelle selon le streak collectif

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
**Plans**: TBD
**UI hint**: yes

### Phase 30: Décorations persistantes
**Goal**: Transformer chaque semaine d'objectif collectif réussie en trace visuelle durable — introduire le schéma de données append-only, le moteur de déblocage par palier de streak et le catalogue des décorations débloquables.
**Depends on**: Phase 29 (carte village stable, pattern append-only `jardin-familial.md` déjà en place depuis Phase 25)
**Requirements**: VILL-04, VILL-05, VILL-06
**Success Criteria** (what must be TRUE):
  1. User voit une nouvelle décoration (guirlande, fanion, lanterne, banc, etc.) apparaître sur la carte village chaque semaine où l'objectif collectif est atteint
  2. User retrouve l'ensemble des décorations accumulées après un restart complet de l'app (persistance append-only dans `jardin-familial.md`)
  3. User peut ouvrir un catalogue listant les ~8 décorations débloquables et voit clairement le palier de streak collectif associé (1, 3, 5, 10, 15, 20, 25, 30 semaines)
  4. User voit dans le catalogue quelles décorations sont déjà débloquées versus verrouillées, avec le prochain palier à atteindre
**Plans**: TBD
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

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 29. Avatars vivants + portail retour | 0/TBD | Not started | - |
| 30. Décorations persistantes | 0/TBD | Not started | - |
| 31. Ambiance dynamique | 0/TBD | Not started | - |
| 32. Arbre familial commun | 0/TBD | Not started | - |

## Archived Milestones

- **v1.0 Stabilisation** — `.planning/milestones/v1.0-ROADMAP.md` *(si archivé rétro)*
- **v1.1 Ferme Enrichie** — `.planning/milestones/v1.1-ROADMAP.md`
- **v1.2 Confort & Découverte** — `.planning/milestones/v1.2-ROADMAP.md`
- **v1.3 Seed** — `.planning/milestones/v1.3-ROADMAP.md` *(si archivé)*
- **v1.4 Jardin Familial** — `.planning/milestones/v1.4-ROADMAP.md`
