# Roadmap: FamilyFlow

## Milestones

- ✅ **v1.0 Stabilisation** — Phases 1-4 (shipped 2026-03-28)
- ✅ **v1.1 Ferme Enrichie** — Phases 5-14 (shipped 2026-04-07)
- ✅ **v1.2 Confort & Découverte** — Phases 15-18 (shipped 2026-04-08)
- ✅ **v1.3 Seed** — Phases 19-24 (shipped 2026-04-10)
- ✅ **v1.4 Jardin Familial** — Phases 25-28 (shipped 2026-04-11)
- 🟡 **v1.5 Village Vivant** — Phases 29-33 (partiel 2026-04-14, 3/5 livrées, 31-32 deferred)
- 🚧 **v1.6 Love Notes** — Phases 34-37 (planning)

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

<details>
<summary>🟡 v1.5 Village Vivant (Phases 29-33) — PARTIEL 2026-04-14</summary>

**Milestone Goal :** Transformer la Place du Village statique en espace vivant et personnalisé — les avatars de la famille y apparaissent, les semaines réussies laissent des traces visuelles durables, l'ambiance change selon l'heure et la saison, et l'arbre familial commun devient le cœur symbolique du village. Polish milestone, aucune nouvelle dépendance npm, réutilisation stricte de l'infra existante (`ReactiveAvatar`, `TileMapRenderer`, `useGarden`, `FarmProfileData`).

- [x] **Phase 29: Avatars vivants + portail retour** — completed 2026-04-11
- [x] **Phase 30: Décorations persistantes** — completed 2026-04-11
- [ ] **Phase 31: Ambiance dynamique** — DEFERRED
- [ ] **Phase 32: Arbre familial commun** — DEFERRED
- [x] **Phase 33: Expéditions** — completed 2026-04-14

Détails phase-by-phase préservés ci-dessous dans `## Phase Details`.

</details>

### 🚧 v1.6 Love Notes (Phases 34-37) — IN PLANNING

**Milestone Goal :** Permettre aux membres de la famille d'échanger des messages privés programmés ("love notes") qui apparaissent à une date future, avec un système de boîte aux lettres visualisé en carte enveloppe pinned en tête du dashboard — renforcer le lien affectif familial via des micro-moments de surprise asynchrones. Zéro nouvelle dépendance npm, backward compat Obsidian vault obligatoire, chaque phase non-cassante (app sur TestFlight).

- [ ] **Phase 34: Fondation données & hook domaine** — Type + parser + hook + cache + tests (LOVE-01, 02, 03, 04, 17)
- [ ] **Phase 35: Carte enveloppe dashboard + écran boîte aux lettres** — UI visible : enveloppe pinned + écran 3 segments + tuile more (LOVE-05, 06, 07, 08)
- [ ] **Phase 36: Composition & programmation reveal** — Éditeur modal + notifications locales + animation unfold (LOVE-09, 10, 11, 12, 13)
- [ ] **Phase 37: Garde-parent & polish** — Toggle parental + modération + polish final (LOVE-14, 15, 16)

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
**Plans**: DEFERRED (v1.5 milestone partiel — reporté v1.7+)
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
**Plans**: DEFERRED (v1.5 milestone partiel — reporté v1.7+)
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
**Plans:** 3/3 plans complete
Plans:
- [x] 33-01-PLAN.md — Types + parser CSV + expedition-engine (catalogue, roll, timer, pity, pool quotidien) (VILL-16, VILL-18, VILL-19, VILL-20)
- [x] 33-02-PLAN.md — Hook useExpeditions + cellule Camp d'exploration + items exclusifs expedition (VILL-16, VILL-17, VILL-19, VILL-20)
- [x] 33-03-PLAN.md — UI : ExpeditionsSheet modal + CampExplorationCell + ExpeditionChest + wiring tree.tsx (VILL-16, VILL-17, VILL-18, VILL-19, VILL-20)
**UI hint**: yes

### Phase 34: Fondation données & hook domaine
**Goal**: Rendre le domaine LoveNote opérationnel côté data/hooks sans aucune UI visible — type canonique + parser bidirectionnel + hook domaine CRUD + cache vault + tests Jest. Fondation invisible que les phases suivantes (35, 36) consommeront sans re-toucher au data layer.
**Depends on**: Nothing (aucune phase v1.6 antérieure, réutilise directement l'infra `lib/parser.ts`, `lib/vault-cache.ts`, `hooks/useVault.ts`, `contexts/VaultContext.tsx` existante)
**Requirements**: LOVE-01, LOVE-02, LOVE-03, LOVE-04, LOVE-17
**Success Criteria** (what must be TRUE):
  1. User voit ses love notes persister dans le vault Obsidian au chemin `03 - Famille/LoveNotes/{to-profileId}/{YYYY-MM-DD-slug}.md` (un fichier = une note, classé par destinataire)
  2. User voit chaque fichier `.md` love note lisible manuellement dans Obsidian desktop avec frontmatter YAML propre (`from`, `to`, `createdAt`, `revealAt`, `status`, `readAt?`) et corps markdown du message
  3. User voit les love notes hydratées en mémoire au démarrage de l'app via `useVault().loveNotes` exposé par `VaultContext` (pattern identique aux 21 hooks domaine existants)
  4. User voit les love notes survivre à un restart à froid de l'app sans re-parse depuis disk (cachables dans `lib/vault-cache.ts`, `CACHE_VERSION` bumpé pour invalider propre)
  5. User voit la suite Jest `lib/__tests__/parser-lovenotes.test.ts` passer (parse/serialize roundtrip, gestion frontmatter invalide, listing par destinataire) — `npx tsc --noEmit` et `npx jest --no-coverage` clean
**Plans:** 3 plans
Plans:
- [ ] 34-01-PLAN.md — Fondation data: type LoveNote + parser bidirectionnel + bump CACHE_VERSION (LOVE-01, LOVE-02, LOVE-04)
- [ ] 34-02-PLAN.md — Suite Jest parser-lovenotes (parse/serialize/round-trip/listing) (LOVE-17)
- [ ] 34-03-PLAN.md — Hook useVaultLoveNotes + cablage useVault.ts + cache hydrate/save (LOVE-03, LOVE-04)

### Phase 35: Carte enveloppe dashboard + écran boîte aux lettres
**Goal**: Rendre les love notes visibles et navigables — carte enveloppe distinctive pinned en tête du dashboard quand au moins 1 note à révéler/non lue, plus écran boîte aux lettres complet organisé en 3 segments (reçues / envoyées / archivées) accessible depuis la carte ET depuis une tuile permanente dans `more.tsx`.
**Depends on**: Phase 34 (hook `useVaultLoveNotes` + parser + cache stables)
**Requirements**: LOVE-05, LOVE-06, LOVE-07, LOVE-08
**Success Criteria** (what must be TRUE):
  1. User voit une carte enveloppe distinctive (format paysage ≈ 2:1.15, papier ivoire via `useThemeColors()`, rabat triangulaire, cachet de cire rouge animé pulse, tilt -1.5°) pinned tout en haut du dashboard dès qu'au moins 1 love note destinée au profil actif est non lue ou prête à être révélée
  2. User voit un badge compteur sur le cachet + un effet stack visuel (enveloppes empilées derrière) quand ≥2 notes sont en attente sur le profil actif
  3. User peut accéder à sa boîte aux lettres complète (`/lovenotes`) en tappant la carte enveloppe OU via une tuile permanente dans l'écran `more.tsx`
  4. User voit l'écran Boîte aux lettres organisé en 3 segments segmented control : "Reçues" (non lues en priorité), "Envoyées" (programmées en attente), "Archivées" (lues + révélées) — chaque segment affiche sa propre liste virtualisée de `LoveNoteCard` mémoïsés
  5. User voit la carte enveloppe disparaître automatiquement du dashboard quand plus aucune note reçue n'est pending/unread pour le profil actif (pas de flash, render conditionnel propre)
**Plans**: TBD
**UI hint**: yes

### Phase 36: Composition & programmation reveal
**Goal**: Permettre à l'utilisateur d'écrire et de programmer une love note avec révélation animée au bon moment — éditeur modal complet, presets rapides, notification locale planifiée au `revealAt`, bascule auto `pending` → `revealed` au retour foreground, animation unfold Reanimated + haptic success.
**Depends on**: Phase 35 (écran boîte aux lettres existant pour relister après création, carte enveloppe pour déclencher le reveal animé)
**Requirements**: LOVE-09, LOVE-10, LOVE-11, LOVE-12, LOVE-13
**Success Criteria** (what must be TRUE):
  1. User peut composer une nouvelle love note via `LoveNoteEditor` (modal `pageSheet` + drag-to-dismiss) avec sélection destinataire (chips par profil famille, exclut l'auteur), zone texte markdown avec preview, et picker date/heure de révélation
  2. User peut choisir des presets rapides pour le moment de révélation ("Demain matin", "Dimanche soir", "Dans 1 mois", date custom) — le preset choisi remplit le picker date/heure sans bloquer la custom
  3. User voit une notification locale silencieuse planifiée au `revealAt` via `expo-notifications` — le tap sur la notif ouvre l'écran boîte aux lettres
  4. User voit les love notes `pending` dont `revealAt <= now` basculer automatiquement en `revealed` à chaque retour app foreground (`AppState` change → `active` → `revealPendingNotes()` appelé)
  5. User voit une animation "unfold" Reanimated (rotation X du rabat ≥175°, cachet qui saute, contenu dévoilé) au tap sur une enveloppe `revealed`, accompagnée d'un haptic `notificationAsync('success')` — la note passe ensuite en `read` avec `readAt` horodaté
**Plans**: TBD
**UI hint**: yes

### Phase 37: Garde-parent & polish
**Goal**: Sécuriser l'usage familial (toggle parental par profil enfant + mode modérateur anti-bullying sur notes envoyées par enfants) et livrer le polish final (empty states illustrés, micro-interactions, SectionErrorBoundary, non-régression TypeScript + Jest, privacy check commits).
**Depends on**: Phase 36 (features complètes — toggle et modération doivent pouvoir agir sur un flux Love Notes déjà fonctionnel)
**Requirements**: LOVE-14, LOVE-15, LOVE-16
**Success Criteria** (what must be TRUE):
  1. User parent peut activer/désactiver la fonctionnalité Love Notes par profil enfant depuis l'écran `ParentalControls` (défault ON) — côté profil enfant désactivé, la composition + la boîte aux lettres deviennent inaccessibles avec message explicite
  2. User parent peut consulter un mode modérateur listant toutes les love notes envoyées PAR ses enfants (protection anti-bullying) — les notes REÇUES par les enfants restent privées pour préserver la surprise parent→enfant
  3. User voit des empty states illustrés dans chaque segment vide de la boîte aux lettres (reçues/envoyées/archivées) + micro-interaction cachet cire pulse discret quand une note non lue est présente
  4. User ne voit aucune régression (SectionErrorBoundary autour composants critiques, `npx tsc --noEmit` clean hors erreurs pré-existantes, `npx jest --no-coverage` clean)
  5. User voit les commits, docs et noms d'exemple respecter la privacy policy (noms génériques Lucas/Emma/Dupont uniquement — aucun nom réel dans le repo)
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 29. Avatars vivants + portail retour | 2/2 | Completed | 2026-04-11 |
| 30. Décorations persistantes | 3/3 | Complete   | 2026-04-11 |
| 31. Ambiance dynamique | 0/TBD | Deferred | - |
| 32. Arbre familial commun | 0/TBD | Deferred | - |
| 33. Expéditions | 3/3 | Complete   | 2026-04-14 |
| 34. Fondation données & hook domaine | 0/3 | Planned | - |
| 35. Carte enveloppe dashboard + écran boîte aux lettres | 0/TBD | Not started | - |
| 36. Composition & programmation reveal | 0/TBD | Not started | - |
| 37. Garde-parent & polish | 0/TBD | Not started | - |

## Archived Milestones

- **v1.0 Stabilisation** — `.planning/milestones/v1.0-ROADMAP.md` *(si archivé rétro)*
- **v1.1 Ferme Enrichie** — `.planning/milestones/v1.1-ROADMAP.md`
- **v1.2 Confort & Découverte** — `.planning/milestones/v1.2-ROADMAP.md`
- **v1.3 Seed** — `.planning/milestones/v1.3-ROADMAP.md` *(si archivé)*
- **v1.4 Jardin Familial** — `.planning/milestones/v1.4-ROADMAP.md`
