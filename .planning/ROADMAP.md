# Roadmap: FamilyFlow

## Milestones

- ✅ **v1.0 Stabilisation** — Phases 1-4 (shipped 2026-03-28)
- ✅ **v1.1 Ferme Enrichie** — Phases 5-14 (shipped 2026-04-07)
- ✅ **v1.2 Confort & Découverte** — Phases 15-18 (shipped 2026-04-08)
- ✅ **v1.3 Seed** — Phases 19-24 (shipped 2026-04-10)
- 🚧 **v1.4 Jardin Familial** — Phases 25-28 (in progress)

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

#### Phase 19: Détection catégorie sémantique
**Goal**: Livrer un module pur de détection sémantique de catégorie pour les tâches, sans effet de bord, feature flag off par défaut, testé extensivement.
**Depends on**: Phase 18
**Requirements**: SEMANTIC-01, SEMANTIC-02, SEMANTIC-03, SEMANTIC-04, SEMANTIC-05, ARCH-01, ARCH-02, ARCH-03, ARCH-04
**Success Criteria** (what must be TRUE):
  1. User sees une catégorie correctement dérivée depuis le filepath Obsidian d'une tâche (maison/enfants/rendez-vous/…)
  2. User sees une catégorie dérivée depuis une section H2/H3 du fichier tâche (Quotidien/Ménage/Mensuel/…)
  3. User sees une catégorie dérivée depuis un tag (#urgent, #budget, …)
  4. User's task sans catégorie identifiable retombe en standard XP sans régression observable
  5. User peut désactiver instantanément tout le couplage via le feature flag
**Plans**: 2 plans

Plans:
- [x] 19-01-module-pur-derive-flag-PLAN.md — Module pur lib/semantic/ (categories + derive + flag + barrel)
- [x] 19-02-tests-jest-derive-flag-PLAN.md — Tests Jest extensifs (derive.test.ts + flag.test.ts)

#### Phase 20: Moteur d'effets + anti-abus
**Goal**: Câbler les 10 effets wow sur les leviers existants (wear-engine, farm-engine, tech bonuses, buildings, companion, saga, craft), piloté par le dispatcher `applyTaskEffect()` injecté dans `awardTaskCompletion()`, avec anti-abus daily/weekly caps persistés dans SecureStore.
**Depends on**: Phase 19
**Requirements**: SEMANTIC-06, SEMANTIC-07, SEMANTIC-08, SEMANTIC-09, EFFECTS-01, EFFECTS-02, EFFECTS-03, EFFECTS-04, EFFECTS-05, EFFECTS-06, EFFECTS-07, EFFECTS-08, EFFECTS-09, EFFECTS-10
**Success Criteria** (what must be TRUE):
  1. User voit chacune des 10 catégories déclencher un effet ferme observable distinct (weeds, wear, turbo, mood, sprint, rare seed, saga trait, capacity, golden, recipe)
  2. User ne peut jamais dépasser le cap quotidien/hebdomadaire d'un effet (vérifié par test d'abus spam + undo + cross-day)
  3. User complétant une tâche `#urgent` obtient ×2 multiplier sur les 5 tâches suivantes
  4. User avec un streak tâches >7j déclenche un Double Loot Cascade
**Plans**: 4 plans

Plans:
- [x] 20-01-PLAN.md — Dispatcher applyTaskEffect() + 10 handlers + FarmProfileData extension
- [x] 20-02-PLAN.md — Caps anti-abus SecureStore daily/weekly
- [x] 20-03-PLAN.md — Wiring dans completeTask + multiplier urgent + Double Loot Cascade
- [x] 20-04-PLAN.md — Tests Jest effects + caps

#### Phase 21: Feedback visuel + compagnon
**Goal**: Rendre les effets tangibles à la complétion via feedback différencié par catégorie — variantes HarvestBurst, toasts spécifiques, haptic pattern, messages compagnon contextualisés, parité i18n FR+EN.
**Depends on**: Phase 20
**Requirements**: FEEDBACK-01, FEEDBACK-02, FEEDBACK-03, FEEDBACK-04, FEEDBACK-05
**Success Criteria** (what must be TRUE):
  1. User voit un toast spécifique à chaque effet déclenché (ex : "🌿 Ménage : 1 weeds retiré !")
  2. User sent un pattern haptique distinct par catégorie d'effet
  3. User voit un HarvestBurst variant (golden / rare / ambient) adapté à l'effet
  4. User lit un message compagnon contextuel référencant la vraie catégorie de tâche complétée
  5. User retrouve la parité FR+EN stricte sur tous les strings de feedback
**Plans**: 2 plans

Plans:
- [x] 21-01-PLAN.md — EFFECT_TOASTS dictionnaire + haptic patterns + HarvestBurst variant prop
- [x] 21-02-PLAN.md — Toast/haptic dispatch + taskMeta fix + companion sub-type + i18n FR+EN

#### Phase 22: UI config famille
**Goal**: Livrer un écran "Couplage sémantique" dans les Réglages permettant à chaque famille d'activer/désactiver les 10 catégories individuellement, avec preview des effets et stats hebdo.
**Depends on**: Phase 21
**Requirements**: COUPLING-01, COUPLING-02, COUPLING-03, COUPLING-04, COUPLING-05, COUPLING-06
**Success Criteria** (what must be TRUE):
  1. User accède à un écran "Couplage sémantique" depuis les Réglages
  2. User voit les 10 catégories listées avec leur effet mappé et une preview
  3. User peut toggler on/off chaque catégorie individuellement, état persisté entre les restarts
  4. User voit les stats semaine (combien d'effets ont été déclenchés)
**Plans**: 2 plans

Plans:
- [x] 22-01-PLAN.md — coupling-overrides.ts + injection useGamification + i18n FR/EN
- [x] 22-02-PLAN.md — SettingsCoupling.tsx + câblage settings.tsx

#### Phase 23: Musée des effets (SEED-002 lite)
**Goal**: Persister chaque effet déclenché dans une chronologie accessible via un écran Musée minimal, réutilisant les patterns Codex UI de la Phase 17.
**Depends on**: Phase 22
**Requirements**: MUSEUM-01, MUSEUM-02, MUSEUM-03, MUSEUM-04, MUSEUM-05
**Success Criteria** (what must be TRUE):
  1. User voit chaque effet déclenché enregistré dans un musée chronologique
  2. User peut ouvrir un écran "Musée" montrant les entrées datées, groupées par semaine/mois
  3. User retrouve les entrées du Musée après un restart (persistance gami-{id}.md)
  4. User reconnaît les patterns Codex UI (Phase 17) dans l'écran Musée
**Plans**: 2 plans

Plans:
- [x] 23-01: `lib/museum/engine.ts` + persistance dans `gami-{id}.md` (nouvelle section Musée)
- [x] 23-02: Écran Musée minimal (réutiliser patterns Codex UI)

#### Phase 24: Compagnon étendu (SEED-003 lite)
**Goal**: Activer 4 event types compagnon proactifs (morning_greeting, gentle_nudge, comeback, weekly_recap), persister les messages (plus RAM-only), étendre les triggers au-delà de tree.tsx et intégrer les stats couplage dans le weekly recap. Celebration (streak%7) dormant per D-08.
**Depends on**: Phase 23
**Requirements**: COMPANION-01, COMPANION-02, COMPANION-03, COMPANION-04, COMPANION-05, COMPANION-06
**Success Criteria** (what must be TRUE):
  1. User reçoit un weekly_recap dimanche soir intégrant les stats de couplage sémantique
  2. User reçoit un morning_greeting à la première ouverture du jour (6h-11h)
  3. User reçoit une celebration aux multiples de 7 de son streak (dormant D-08 — code commenté, prêt à réactiver)
  4. User reçoit un gentle_nudge si aucune tâche complétée dans l'après-midi, et un comeback après >24h d'absence
  5. User retrouve les messages compagnon après un restart (persistance effective)
**Plans**: 2 plans

Plans:
- [x] 24-01-PLAN.md — companion-storage.ts SecureStore + persistance tree.tsx + celebration dormant
- [x] 24-02-PLAN.md — DashboardCompanion bulle + weekly_recap + nudge flag + triggers cross-feature

</details>

### 🚧 v1.4 Jardin Familial (In Progress)

**Milestone Goal :** Créer un espace coopératif partagé entre tous les profils — une "Place du Village" avec sa propre carte — où la famille contribue ensemble (récoltes + tâches) vers un objectif hebdomadaire commun.

**Phases overview:**

- [x] **Phase 25: Fondation données village** — Schéma `jardin-familial.md`, parseur bidirectionnel, grille village namespacée, templates d'objectif (completed 2026-04-10)
- [x] **Phase 26: Hook domaine jardin** — `useGarden.ts` isolé, génération objectif hebdo, anti-double-claim, câblage VaultContext (completed 2026-04-10)
- [x] **Phase 27: Écran Village + composants** — Carte tilemap village, feed contributions, barre progression, panneau historique (completed 2026-04-10)
- [x] **Phase 28: Portail + câblage contributions** — Portail ferme → village, auto-contribution récoltes + tâches, récompense collective (completed 2026-04-11)

## Phase Details

### Phase 25: Fondation données village
**Goal**: Les données village sont persistées dans un fichier Obsidian partagé avec un format append-only pour les contributions, sans risque de corruption iCloud, avec les constantes de grille et les templates d'objectif prêts.
**Depends on**: Phase 24
**Requirements**: DATA-01, DATA-02, DATA-04, MAP-02
**Success Criteria** (what must be TRUE):
  1. Un fichier `jardin-familial.md` est parsé et sérialisé de façon bidirectionnelle sans perte de données
  2. Les contributions sont écrites comme lignes append-only (timestamp, profileId, type, montant) — un iCloud conflict ne peut pas corrompre le total
  3. Les IDs de grille village utilisent le préfixe `village_` (ex: `village_c0`) — aucune collision avec les IDs de la ferme perso
  4. La grille village définit les positions des éléments interactifs (fontaine, étals, panneau historique)
**Plans**: 2 plans

Plans:
- [x] 25-01-PLAN.md — Module lib/village/ complet (types, grid, templates, parser, barrel)
- [x] 25-02-PLAN.md — Tests Jest module village (parser, grid, templates)

### Phase 26: Hook domaine jardin
**Goal**: Toute la logique village est encapsulée dans `hooks/useGarden.ts` isolé — jamais dans `useVault.ts` — avec génération d'objectif hebdomadaire, protection anti-double-claim, et câblage VaultContext vérifié par `tsc --noEmit`.
**Depends on**: Phase 25
**Requirements**: DATA-03, OBJ-01, OBJ-05
**Success Criteria** (what must be TRUE):
  1. `useVault.ts` grandit de 20 lignes maximum (boundary god hook respectée)
  2. L'objectif hebdomadaire est auto-généré chaque lundi (ou premier accès village), avec une cible adaptée au nombre de profils actifs
  3. Un flag partagé dans `jardin-familial.md` empêche la double-génération d'objectif si deux profils ouvrent le village simultanément
  4. Un flag per-profil dans `gami-{id}.md` empêche le double-claim de récompense pour la même semaine
**Plans**: 2 plans

Plans:
- [x] 26-01-PLAN.md — Cablage useVault.ts (gardenRaw) + FarmProfileData village_claimed_week
- [x] 26-02-PLAN.md — Hook domaine useGarden.ts complet (generation objectif, contributions, claim)

### Phase 27: Écran Village + composants
**Goal**: L'écran village est navigable, distinct visuellement de la ferme perso (tilemap cobblestone), et affiche le feed contributions, la barre de progression de l'objectif, les indicateurs par membre, et le panneau historique des semaines accomplies.
**Depends on**: Phase 26
**Requirements**: MAP-01, COOP-03, COOP-04, OBJ-02, HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. L'écran village affiche une carte tilemap distincte (cobblestone dominant, fontaine, étals) via le `TileMapRenderer` existant
  2. Un feed affiche qui a contribué quoi cette semaine (nom du profil, type, montant)
  3. Une barre de progression montre l'avancement collectif vers la cible de la semaine (ex: 47/100)
  4. Chaque membre de la famille a un indicateur de sa contribution hebdomadaire visible sur l'écran
  5. Un panneau historique interactif liste les semaines passées avec leur cible, total, contributions par membre et statut récompense
**Plans**: 2 plans

Plans:
- [x] 27-01-PLAN.md — buildVillageMap() + TileMapRenderer mode village + FAB navigation
- [x] 27-02-PLAN.md — Ecran village.tsx complet (objectif, feed, membres, historique)

### Phase 28: Portail + câblage contributions
**Goal**: La boucle coopérative est complète — récolter dans la ferme perso ou compléter une tâche IRL ajoute automatiquement une contribution au village, l'atteinte de l'objectif déclenche une récompense collective (XP + suggestion activité IRL), et un portail animé dans la ferme permet d'accéder au village.
**Depends on**: Phase 27
**Requirements**: MAP-03, COOP-01, COOP-02, OBJ-03, OBJ-04
**Success Criteria** (what must be TRUE):
  1. Un portail interactif sur l'écran ferme navigue vers le village avec une transition visuelle (fade Reanimated)
  2. Chaque récolte dans la ferme perso ajoute automatiquement une contribution à l'objectif village
  3. Chaque tâche IRL complétée (via couplage sémantique v1.3) ajoute automatiquement une contribution au village
  4. Quand l'objectif est atteint, tous les profils reçoivent un bonus XP + item cosmétique
  5. La récompense inclut une suggestion d'activité familiale IRL adaptée à la saison
**Plans**: 2 plans

Plans:
- [x] 28-01-PLAN.md — Portail animé ferme + câblage contributions (useFarm + useGamification)
- [x] 28-02-PLAN.md — Récompense collective + activités IRL saisonnières

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 15. Préférences alimentaires | v1.2 | 7/7 | Complete | 2026-04-08 |
| 16. Codex contenu | v1.2 | 5/5 | Complete | 2026-04-08 |
| 17. Codex UI | v1.2 | 3/3 | Complete | 2026-04-08 |
| 18. Tutoriel ferme | v1.2 | 4/4 | Complete | 2026-04-08 |
| 19. Détection catégorie sémantique | v1.3 | 2/2 | Complete | 2026-04-09 |
| 20. Moteur d'effets + anti-abus | v1.3 | 4/4 | Complete | 2026-04-09 |
| 21. Feedback visuel + compagnon | v1.3 | 2/2 | Complete | 2026-04-09 |
| 22. UI config famille | v1.3 | 2/2 | Complete | 2026-04-09 |
| 23. Musée des effets | v1.3 | 2/2 | Complete | 2026-04-10 |
| 24. Compagnon étendu | v1.3 | 2/2 | Complete | 2026-04-10 |
| 25. Fondation données village | v1.4 | 2/2 | Complete    | 2026-04-10 |
| 26. Hook domaine jardin | v1.4 | 2/2 | Complete    | 2026-04-10 |
| 27. Écran Village + composants | v1.4 | 2/2 | Complete    | 2026-04-10 |
| 28. Portail + câblage contributions | v1.4 | 2/2 | Complete    | 2026-04-11 |

## Archived Milestones

- **v1.0 Stabilisation** — `.planning/milestones/v1.0-ROADMAP.md` *(si archivé rétro)*
- **v1.1 Ferme Enrichie** — `.planning/milestones/v1.1-ROADMAP.md`
- **v1.2 Confort & Découverte** — `.planning/milestones/v1.2-ROADMAP.md`
