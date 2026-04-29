# Roadmap: FamilyFlow

## Milestones

- ✅ **v1.0 Stabilisation** — Phases 1-4 (shipped 2026-03-28)
- ✅ **v1.1 Ferme Enrichie** — Phases 5-14 (shipped 2026-04-07)
- ✅ **v1.2 Confort & Découverte** — Phases 15-18 (shipped 2026-04-08)
- ✅ **v1.3 Seed** — Phases 19-24 (shipped 2026-04-10)
- ✅ **v1.4 Jardin Familial** — Phases 25-28 (shipped 2026-04-11)
- 🟡 **v1.5 Village Vivant** — Phases 29-33 (partiel 2026-04-14, 3/5 livrées, 31-32 deferred)
- 🟡 **v1.6 Love Notes** — Phases 34-37 (partiel 2026-04-17, 3/4 livrées, 37 deferred)
- 🚧 **v1.7 Modifiers de plants** — Phases 38-41 (planning)

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

<details>
<summary>🟡 v1.6 Love Notes (Phases 34-37) — PARTIEL 2026-04-17</summary>

- [x] **Phase 34: Fondation données & hook domaine** — completed 2026-04-17
- [x] **Phase 35: Carte enveloppe dashboard + écran boîte aux lettres** — completed 2026-04-17
- [x] **Phase 36: Composition & programmation reveal** — completed 2026-04-17
- [ ] **Phase 37: Garde-parent & polish** — DEFERRED

</details>

### 🚧 v1.7 Modifiers de plants (Phases 38-41) — IN PLANNING

**Milestone Goal :** Introduire des objets consommables qui modifient le comportement des plants au moment de la plantation, pour créer des décisions stratégiques au-delà du cycle plant→récolte→craft classique — transformer le jardin en terrain de décisions plutôt qu'en simple timer. Scope v1.7 = Sporée de Régularité uniquement (Chimère reportée v1.8). Fondation `modifiers` conçue extensible. Zéro nouvelle dépendance npm, backward compat Obsidian vault obligatoire, chaque phase non-cassante (app sur TestFlight).

- [x] **Phase 38: Fondation modifiers + économie Sporée** — Shape `FarmCrop.modifiers` + CSV backward-compat + bump cache + drop/shop/expedition/cadeau + cap inventaire + tests Jest fondations (MOD-01, MOD-02, SPOR-08, SPOR-09, SPOR-13) (completed 2026-04-18)
- [x] **Phase 39: Moteur prorata + calcul famille** — Calcul cumulatif 23h30 + snapshot matinal + poids par âge + profils actifs 7j glissants + filtre strict Tasks + tests Jest (SPOR-03, SPOR-04, SPOR-05, SPOR-06, SPOR-13) (completed 2026-04-18)
- [ ] **Phase 40: UI Sporée — seed picker + badge + validation** — Slot "Sceller" inline + application Sporée 3 durées + badge plant progression + validation récolte multiplier + état visuel plant mûr (MOD-03, SPOR-01, SPOR-02, SPOR-07, SPOR-11)
- [x] **Phase 41: Polish onboarding + codex + non-régression** — Tooltip one-shot premier drop + compteur codex `marathonWins` + non-régression TS/Jest finale (SPOR-10, SPOR-12) (completed 2026-04-19)

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
**Plans:** 3/3 plans complete
Plans:
- [x] 34-01-PLAN.md — Fondation data: type LoveNote + parser bidirectionnel + bump CACHE_VERSION (LOVE-01, LOVE-02, LOVE-04)
- [x] 34-02-PLAN.md — Suite Jest parser-lovenotes (parse/serialize/round-trip/listing) (LOVE-17)
- [x] 34-03-PLAN.md — Hook useVaultLoveNotes + cablage useVault.ts + cache hydrate/save (LOVE-03, LOVE-04)

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
**Plans:** 3/3 plans complete
Plans:
- [x] 35-01-PLAN.md — Selectors dérivés purs + route skeleton /(tabs)/lovenotes + _layout href:null (LOVE-06, LOVE-07, LOVE-08)
- [x] 35-02-PLAN.md — Composants visuels : WaxSeal + EnvelopeFlap + EnvelopeCard + LoveNoteCard + câblage écran (LOVE-05, LOVE-06, LOVE-08)
- [x] 35-03-PLAN.md — Injection dashboard pinned + tuile permanente more.tsx (LOVE-05, LOVE-07)
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
**Plans:** 4/4 plans complete
Plans:
- [x] 36-01-PLAN.md — Reveal engine fondations (presets reveal-engine.ts + scheduleLoveNoteReveal/cancel + useRevealOnForeground hook) (LOVE-11, LOVE-12)
- [x] 36-02-PLAN.md — Notification routing app/_layout.tsx (warm + cold start) (LOVE-11)
- [x] 36-03-PLAN.md — LoveNoteEditor modal + FAB Écrire + useRevealOnForeground branché (LOVE-09, LOVE-10, LOVE-12)
- [x] 36-04-PLAN.md — EnvelopeUnfoldModal animation Reanimated + câblage tap LoveNoteCard (LOVE-13)
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

### Phase 38: Fondation modifiers + économie Sporée
**Goal**: Poser l'infra `modifiers` sur `FarmCrop` (champ JSON extensible, sérialisé en CSV markdown backward-compatible) et câbler l'économie complète Sporée (drops à la récolte, entrée shop conditionnelle, loot expedition, cadeau onboarding stage 3) + cap inventaire à 10 — zéro UI nouvelle, pure fondation data/engine consommée par les phases 39-40.
**Depends on**: Phase 36 (dernier ship v1.6, infra ferme/parser/cache stable) — aucune phase v1.7 antérieure
**Requirements**: MOD-01, MOD-02, SPOR-08, SPOR-09, SPOR-13
**Success Criteria** (what must be TRUE):
  1. User voit ses plants existants (pré-v1.7) rester parsables et affichables sans régression — le CSV de `FarmCrop` supporte un champ optionnel `modifiers` JSON sérialisé, l'absence reste lisible comme avant
  2. User voit `CACHE_VERSION` bumpé dans `lib/vault-cache.ts:41` — le premier boot post-migration rehydrate proprement sans plant corrompu en cache
  3. User peut obtenir une Sporée via 4 sources distinctes : drop à la récolte (3% tier 1-3 / 8% rare / 15% expedition), achat shop à 400 feuilles (cap 2/jour, dès Arbre stade 3), loot expedition (5% missions Pousse+), cadeau onboarding (1 gratuite à l'atteinte stade 3 arbre)
  4. User voit son inventaire Sporée capé à 10 — tout drop au-delà affiche un toast "Inventaire Sporée plein" sans perte silencieuse
  5. User voit la suite Jest fondations passer (round-trip CSV `modifiers`, drop rate deterministe seed-based, cap 10, backward-compat plants legacy) — `npx tsc --noEmit` et `npx jest --no-coverage` clean
**Plans:** 3/3 plans complete
Plans:
- [x] 38-01-PLAN.md — Fondation data: shape PlantedCrop.modifiers + serialize/parse 7e champ pipe-escape + bump CACHE_VERSION + tests round-trip (MOD-01, MOD-02, SPOR-13)
- [x] 38-02-PLAN.md — Moteur pur économie Sporée: constantes + rolls drop/expedition + canBuySporee + cap 10 + tests Jest matrice (SPOR-08, SPOR-09, SPOR-13)
- [x] 38-03-PLAN.md — Câblage hooks: parseFarmProfile fields + useFarm post-harvest + useExpeditions post-loot + useGamification cadeau onboarding + toast overflow (SPOR-08, SPOR-09)

### Phase 39: Moteur prorata + calcul famille
**Goal**: Implémenter le moteur de calcul pur du pari Sporée — prorata cumulatif `(poids_sealeur / poids_famille_active_7j) × Tasks_pending` recalculé à 23h30 avec snapshot matinal stable, poids par âge dérivés de la date de naissance (avec override settings), filtre profils actifs 7j glissants, filtre strict domaine Tasks. Fonctions pures testables, zéro UI nouvelle.
**Depends on**: Phase 38 (shape `FarmCrop.modifiers` stable + économie Sporée — le moteur prorata lit le wager depuis le modifier)
**Requirements**: SPOR-03, SPOR-04, SPOR-05, SPOR-06, SPOR-13
**Success Criteria** (what must be TRUE):
  1. User voit le cumul requis du pari recalculé à chaque passage 23h30 (ou au boot si app fermée) selon la formule `(poids_sealeur / poids_famille_active_7j) × Tasks_pending`, basé sur un snapshot matinal stable des tâches pending
  2. User voit les poids par âge appliqués automatiquement (Adulte 1.0 / Ado 0.7 / Enfant 0.4 / Jeune enfant 0.15 / Bébé 0.0) dérivés de la date de naissance du profil, avec override manuel possible dans settings profil
  3. User voit seulement les profils avec ≥1 tâche complétée sur les 7 derniers jours glissants comptés dans le diviseur famille — un ado dormant n'allège pas la charge du parent sealeur
  4. User voit seulement les tâches du domaine Tasks comptabilisées (Courses, Repas, Routines, Anniversaires, Notes, Moods exclus) — filtre strict par type de source
  5. User voit la suite Jest moteur passer (prorata fractionnaire, override poids, détection 7j glissants, filtre domaine Tasks, snapshot matinal stable) — `npx tsc --noEmit` et `npx jest --no-coverage` clean
**Plans:** 2/2 plans complete
Plans:
- [x] 39-01-PLAN.md — Fondations data: Profile.weight_override + parseSnapshots/appendSnapshot/pruneSnapshots (SPOR-04, SPOR-13)
- [x] 39-02-PLAN.md — Moteur pur wager-engine.ts (7 concepts) + suite Jest ≥45 tests (SPOR-03, SPOR-04, SPOR-05, SPOR-06, SPOR-13)

### Phase 40: UI Sporée — seed picker + badge + validation
**Goal**: Rendre la Sporée utilisable bout-en-bout via l'UI — slot "Sceller" inline étendant le seed picker existant (apparaît si ≥1 Sporée), application Sporée avec choix de 3 durées dérivées de la taille du plant (multipliers ×1.3 / ×1.7 / ×2.5), badge sur plant scellé affichant progression jour + cumul avec code couleur pace, état visuel "prêt à valider" sur plant mûr, validation à la récolte appliquant multiplier ou reward normale.
**Depends on**: Phase 39 (moteur prorata + économie Sporée stables — l'UI pur consommation)
**Requirements**: MOD-03, SPOR-01, SPOR-02, SPOR-07, SPOR-11
**Success Criteria** (what must be TRUE):
  1. User voit le seed picker existant étendu avec un slot "Sceller" inline qui n'apparaît QUE si ≥1 Sporée en inventaire — zéro nouvelle modale, pattern extensible pour futurs slots modifier
  2. User peut appliquer une Sporée à la plantation en choisissant parmi 3 durées (Chill ×1.3 / Engagé ×1.7 / Sprint ×2.5) dérivées de la taille du plant, avec multiplier et prorata théorique visibles avant confirmation
  3. User voit un badge sur chaque plant scellé affichant `X/Y tâches aujourd'hui • cumul Z/N` avec code couleur pace (vert/jaune/orange) — pas d'animation continue lourde
  4. User voit un anneau vert "prêt à valider" sur un plant scellé déjà mûr mais pas encore récolté — distingue clairement la fenêtre de décision récolter avant ou après le cumul
  5. User récolte un plant scellé : si cumul atteint → reward × multiplier + toast de victoire + 15% chance de drop-back d'une Sporée ; sinon reward normale, seul coût = Sporée consommée (pari bienveillant, jamais de pénalité)
**Plans:** 3/4 plans executed
Plans:
- [x] 40-01-PLAN.md — Data & hook: useFarm startWager/incrementWagerCumul/harvest wager + wager-ui-helpers + rollWagerDropBack + câblage onTaskComplete (MOD-03, SPOR-01, SPOR-07, SPOR-11)
- [x] 40-02-PLAN.md — UI WagerSealerSheet pageSheet secondaire (3 durées + preview prorata + skip) + câblage tree.tsx (MOD-03, SPOR-01)
- [x] 40-03-PLAN.md — UI PlantWagerBadge + WagerReadyRing injectés dans CropCell (SPOR-02, SPOR-11)
- [ ] 40-04-PLAN.md — Finalisation toast victoire/défaite/drop-back + suite Jest + checkpoint device (SPOR-07)
**UI hint**: yes

### Phase 41: Polish onboarding + codex + non-régression
**Goal**: Finaliser l'expérience Sporée par un onboarding discret (tooltip one-shot au premier drop expliquant la mécanique en 1-2 phrases) et un compteur long-terme (codex `wager.marathonWins` incrémenté sur chaque pari gagné, récompense vanité), plus garantir une sortie de milestone propre (`tsc --noEmit` clean, `jest --no-coverage` clean, privacy check commits).
**Depends on**: Phase 40 (boucle Sporée complète jouable — onboarding et codex ne peuvent s'accrocher qu'à un flux fonctionnel)
**Requirements**: SPOR-10, SPOR-12
**Success Criteria** (what must be TRUE):
  1. User voit un tooltip one-shot au premier drop/obtention d'une Sporée expliquant la mécanique en 1-2 phrases, dismissable, jamais re-triggeré (flag persisté SecureStore device-global)
  2. User voit son compteur codex `wager.marathonWins` incrémenté de +1 à chaque pari Sporée gagné — consultable dans le codex ferme existant (FarmCodexModal), récompense vanité long terme
  3. User ne voit aucune régression TypeScript (`npx tsc --noEmit` clean hors erreurs pré-existantes MemoryEditor.tsx / cooklang.ts / useVault.ts) ni Jest (`npx jest --no-coverage` clean) après la phase finale
  4. User voit les commits, docs et noms d'exemple de v1.7 respecter la privacy policy (noms génériques Lucas/Emma/Dupont uniquement — aucun nom réel dans le repo)
**Plans:** 3/3 plans complete
Plans:
- [x] 41-01-PLAN.md — Data fondation: FarmProfileData.wagerMarathonWins + parser + incrément harvest wager.won + tests Jest (SPOR-10)
- [x] 41-02-PLAN.md — SporeeOnboardingTooltip one-shot + wiring 3 sources (harvest/expedition/onboarding) + flag SecureStore via HelpContext (SPOR-10)
- [x] 41-03-PLAN.md — Affichage compteur codex FarmCodexModal + checkpoint non-régression TS/Jest/privacy milestone v1.7 (SPOR-10, SPOR-12)
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 29. Avatars vivants + portail retour | 2/2 | Completed | 2026-04-11 |
| 30. Décorations persistantes | 3/3 | Complete   | 2026-04-11 |
| 31. Ambiance dynamique | 0/TBD | Deferred | - |
| 32. Arbre familial commun | 0/TBD | Deferred | - |
| 33. Expéditions | 3/3 | Complete   | 2026-04-14 |
| 34. Fondation données & hook domaine | 3/3 | Complete    | 2026-04-17 |
| 35. Carte enveloppe dashboard + écran boîte aux lettres | 3/3 | Complete   | 2026-04-17 |
| 36. Composition & programmation reveal | 4/4 | Complete   | 2026-04-17 |
| 37. Garde-parent & polish | 0/TBD | Deferred | - |
| 38. Fondation modifiers + économie Sporée | 3/3 | Complete   | 2026-04-18 |
| 39. Moteur prorata + calcul famille | 2/2 | Complete   | 2026-04-18 |
| 40. UI Sporée — seed picker + badge + validation | 3/4 | In Progress|  |
| 41. Polish onboarding + codex + non-régression | 3/3 | Complete    | 2026-04-19 |

## Archived Milestones

- **v1.0 Stabilisation** — `.planning/milestones/v1.0-ROADMAP.md` *(si archivé rétro)*
- **v1.1 Ferme Enrichie** — `.planning/milestones/v1.1-ROADMAP.md`
- **v1.2 Confort & Découverte** — `.planning/milestones/v1.2-ROADMAP.md`
- **v1.3 Seed** — `.planning/milestones/v1.3-ROADMAP.md` *(si archivé)*
- **v1.4 Jardin Familial** — `.planning/milestones/v1.4-ROADMAP.md`

### Phase 42: Nourrir le compagnon

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 41
**Plans:** 9/9 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 42 to break down) (completed 2026-04-22)

### Phase 43: Auberge — Modèle & moteur visiteurs

**Goal:** Livrer les fondations pures et invisibles du système Auberge (types, catalogue 6 PNJ, moteur pur testé, parsers vault, hook React) sans aucune UI ni notif. Phase complète bout-en-bout, testable via Jest, qui débloque les phases UI/notif/sprite ultérieures.
**Requirements**: TBD (newly added phase, no requirement mapping yet)
**Depends on:** Phase 42
**Plans:** 4/4 plans complete

Plans:
- [x] 43-01-PLAN.md — Types Auberge + catalogue 6 visiteurs (lib/mascot/types.ts + visitor-catalog.ts)
- [x] 43-02-PLAN.md — Persistance vault (FarmProfileData + parseFarmProfile/serializeFarmProfile + tests)
- [x] 43-03-PLAN.md — Moteur pur auberge-engine.ts (12 fonctions + serialize/parse + 15+ tests Jest)
- [x] 43-04-PLAN.md — Hook useAuberge (orchestrateur deliver/dismiss/tick atomique)

### Phase 44: Auberge — Bâtiment & branche tech social

**Goal:** Brancher l'Auberge dans le système de bâtiments via un flag `producesResource` (rétrocompat), ajouter le bâtiment `auberge` au BUILDING_CATALOG (gated par `social-1`), créer la branche tech `social-1/2/3`, et faire en sorte que `BuildingDetailSheet` gère gracieusement un bâtiment non-productif. Tests de non-régression sur les 4 bâtiments existants.
**Requirements**: TBD
**Depends on:** Phase 43
**Plans:** 4/4 plans complete

Plans:
- [x] 44-01-PLAN.md — Refacto producesResource (flag BuildingDefinition + court-circuit building-engine + tests)
- [x] 44-02-PLAN.md — Bâtiment auberge dans BUILDING_CATALOG + i18n FR
- [x] 44-03-PLAN.md — Branche tech social (3 nœuds + bonus TechBonuses + i18n + tests)
- [x] 44-04-PLAN.md — BuildingDetailSheet — affichage gracieux non-productif

### Phase 45: Auberge — UI modal + dashboard + dev spawn

**Goal:** Rendre l'Auberge testable bout-en-bout (modal AubergeSheet, carte DashboardAuberge conditionnelle, bouton dev `__DEV__` "Forcer un visiteur", wiring du CTA dans BuildingDetailSheet).
**Requirements**: AUB45-01-FORCE-SPAWN, AUB45-02-AUBERGE-SHEET, AUB45-03-DASHBOARD-AUBERGE, AUB45-04-WIRING-CTA
**Depends on:** Phase 44
**Plans:** 4/4 plans complete

Plans:
- [x] 45-01-PLAN.md — Hook useAuberge : ajout forceSpawn(profileId) (debug bypass shouldSpawn)
- [x] 45-02-PLAN.md — AubergeSheet.tsx : modale principale (cartes visiteurs, empty state, réputation repliée, bouton dev)
- [x] 45-03-PLAN.md — DashboardAuberge.tsx + enregistrement section (zone farm, toggle prefs auto)
- [x] 45-04-PLAN.md — Wiring CTA "Voir l'auberge" dans BuildingDetailSheet

### Phase 46: Auberge — Spawn automatique + notifications locales

**Goal:** Faire passer l'''Auberge de démo testable à feature jouable — visiteurs apparaissent automatiquement au launch + après chaque tâche, avec notifs locales d'''arrivée et rappel H-4, et cancellation propre sur deliver/dismiss/expire.
**Requirements**: AUBERGE-46-01 (spawn auto au launch), AUBERGE-46-02 (spawn auto sur task complete), AUBERGE-46-03 (cancel notifs sur deliver/dismiss), AUBERGE-46-04 (toggle BUILTIN visiteurs auberge), AUBERGE-46-05 (re-gate bouton dev __DEV__)
**Depends on:** Phase 45
**Plans:** 4/4 plans complete

Plans:
- [x] 46-01-PLAN.md — Helper lib/auberge/auto-tick.ts + 3 fonctions notifs Auberge + entrée BUILTIN_NOTIFICATIONS + tests Jest
- [x] 46-02-PLAN.md — Wiring useVault.ts : tickAubergeAuto post-refresh + souscription subscribeTaskComplete
- [x] 46-03-PLAN.md — Cancel notifs sur deliverVisitor / dismissVisitor dans hooks/useAuberge.ts
- [x] 46-04-PLAN.md — Re-gate __DEV__ autour du bouton 'Forcer un visiteur' dans AubergeSheet.tsx

### Phase 47: Auberge — Sprites pixel art + animations + microcopy

**Goal:** Polish visuel et feel : remplacer les emojis fallback par des sprites pixel art (1 bâtiment 3 niveaux + 6 portraits PNJ), ajouter une animation Reanimated festive à la livraison, migrer les couleurs hex vers le thème, snapshotter `lootChance` au spawn, et polir la microcopy (empty state, bios PNJ, toast, notifs).
**Requirements**: AUBERGE-SPRITES-BUILDING, AUBERGE-SPRITES-VISITORS, AUBERGE-WIRING-SPRITES, AUBERGE-THEME-COLORS, AUBERGE-LOOTCHANCE-SNAPSHOT, AUBERGE-DELIVERY-ANIMATION, AUBERGE-MICROCOPY-POLISH
**Depends on:** Phase 46
**Plans:** 2/4 plans executed

Plans:
- [ ] 47-01-PLAN.md — Sprites bâtiment auberge L1/L2/L3 (pixellab) + extension BUILDING_SPRITES
- [x] 47-02-PLAN.md — 6 portraits PNJ (pixellab) + nouveau registry lib/mascot/visitor-sprites.ts
- [x] 47-03-PLAN.md — Wiring sprites dans AubergeSheet/DashboardAuberge + theme colors + ActiveVisitor.lootChance snapshot
- [ ] 47-04-PLAN.md — Animation livraison Reanimated (scale + flash + particule) + microcopy polish (empty state, bios, toast, notifs)
