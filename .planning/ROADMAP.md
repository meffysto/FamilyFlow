# Roadmap: FamilyFlow

## Milestones

- ✅ **v1.0 Stabilisation** — Phases 1-4 (shipped 2026-03-28)
- ✅ **v1.1 Ferme Enrichie** — Phases 5-14 (shipped 2026-04-07)
- ✅ **v1.2 Confort & Découverte** — Phases 15-18 (shipped 2026-04-08)
- 🚧 **v1.3 Seed** — Phases 19-24 (in progress)

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

### 🚧 v1.3 Seed (In Progress)

**Milestone Goal :** Transformer la ferme en reflet différencié du quotidien familial en couplant sémantiquement chaque catégorie de tâche réelle à un effet ferme spécifique (wow moment tangible). Pure lecture des fichiers Obsidian, zéro régression, chaque effet cappé et configurable par famille.

**Phases overview:**

- [x] **Phase 19: Détection catégorie sémantique** — Module de détection lisant filepath + sections + tags, feature flag off par défaut (completed 2026-04-09)
- [x] **Phase 20: Moteur d'effets + anti-abus** — Dispatcher, caps SecureStore, wiring des 10 effets wow sur les leviers existants (completed 2026-04-09)
- [ ] **Phase 21: Feedback visuel + compagnon** — HarvestBurst variants, toasts, haptic, messages compagnon i18n FR+EN
- [ ] **Phase 22: UI config famille** — Écran Réglages Couplage sémantique, toggles par catégorie, stats semaine
- [ ] **Phase 23: Musée des effets** — SEED-002 lite : chronologie persistée dans gami-{id}.md, écran Musée minimal
- [ ] **Phase 24: Compagnon étendu** — SEED-003 lite : 5 event types activés, messages persistés, triggers cross-feature

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
- [ ] 21-01: HarvestBurst variants + haptic pattern par catégorie
- [ ] 21-02: Toasts + extension `task_completed` companion event (sub_type)
- [ ] 21-03: Messages i18n FR+EN dédiés par catégorie

#### Phase 22: UI config famille
**Goal**: Livrer un écran "Couplage sémantique" dans les Réglages permettant à chaque famille d'activer/désactiver les 10 catégories individuellement, avec preview des effets et stats hebdo.
**Depends on**: Phase 21
**Requirements**: COUPLING-01, COUPLING-02, COUPLING-03, COUPLING-04, COUPLING-05, COUPLING-06
**Success Criteria** (what must be TRUE):
  1. User accède à un écran "Couplage sémantique" depuis les Réglages
  2. User voit les 10 catégories listées avec leur effet mappé et une preview
  3. User peut toggler on/off chaque catégorie individuellement, état persisté entre les restarts
  4. User voit les stats semaine (combien d'effets ont été déclenchés)
**Plans**: TBD (estimation 2 plans)

Plans:
- [ ] 22-01: Écran Réglages Couplage sémantique (toggles 10 rows + preview)
- [ ] 22-02: Stats semaine + persistance override per-famille

#### Phase 23: Musée des effets (SEED-002 lite)
**Goal**: Persister chaque effet déclenché dans une chronologie accessible via un écran Musée minimal, réutilisant les patterns Codex UI de la Phase 17.
**Depends on**: Phase 22
**Requirements**: MUSEUM-01, MUSEUM-02, MUSEUM-03, MUSEUM-04, MUSEUM-05
**Success Criteria** (what must be TRUE):
  1. User voit chaque effet déclenché enregistré dans un musée chronologique
  2. User peut ouvrir un écran "Musée" montrant les entrées datées, groupées par semaine/mois
  3. User retrouve les entrées du Musée après un restart (persistance gami-{id}.md)
  4. User reconnaît les patterns Codex UI (Phase 17) dans l'écran Musée
**Plans**: TBD (estimation 2 plans)

Plans:
- [ ] 23-01: `lib/museum/engine.ts` + persistance dans `gami-{id}.md` (nouvelle section Musée)
- [ ] 23-02: Écran Musée minimal (réutiliser patterns Codex UI)

#### Phase 24: Compagnon étendu (SEED-003 lite)
**Goal**: Activer 5 event types compagnon dormants, persister les messages (plus RAM-only), étendre les triggers au-delà de tree.tsx et intégrer les stats couplage dans le weekly recap.
**Depends on**: Phase 23
**Requirements**: COMPANION-01, COMPANION-02, COMPANION-03, COMPANION-04, COMPANION-05, COMPANION-06
**Success Criteria** (what must be TRUE):
  1. User reçoit un weekly_recap dimanche soir intégrant les stats de couplage sémantique
  2. User reçoit un morning_greeting à la première ouverture du jour (6h-11h)
  3. User reçoit une celebration aux multiples de 7 de son streak
  4. User reçoit un gentle_nudge si aucune tâche complétée dans l'après-midi, et un comeback après >24h d'absence
  5. User retrouve les messages compagnon après un restart (persistance effective)
**Plans**: 2 plans

Plans:
- [ ] 24-01: Activation des 5 event types (weekly_recap, morning_greeting, celebration, gentle_nudge, comeback)
- [ ] 24-02: Persistance messages compagnon (sortie RAM-only)
- [ ] 24-03: Triggers cross-feature + weekly recap intégrant stats couplage

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 15. Préférences alimentaires | v1.2 | 7/7 | Complete | 2026-04-08 |
| 16. Codex contenu | v1.2 | 5/5 | Complete | 2026-04-08 |
| 17. Codex UI | v1.2 | 3/3 | Complete | 2026-04-08 |
| 18. Tutoriel ferme | v1.2 | 4/4 | Complete | 2026-04-08 |
| 19. Détection catégorie sémantique | v1.3 | 2/2 | Complete    | 2026-04-09 |
| 20. Moteur d'effets + anti-abus | v1.3 | 4/4 | Complete    | 2026-04-09 |
| 21. Feedback visuel + compagnon | v1.3 | 0/TBD | Not started | - |
| 22. UI config famille | v1.3 | 0/TBD | Not started | - |
| 23. Musée des effets | v1.3 | 0/TBD | Not started | - |
| 24. Compagnon étendu | v1.3 | 0/TBD | Not started | - |

## Archived Milestones

- **v1.0 Stabilisation** — `.planning/milestones/v1.0-ROADMAP.md` *(si archivé rétro)*
- **v1.1 Ferme Enrichie** — `.planning/milestones/v1.1-ROADMAP.md`
- **v1.2 Confort & Découverte** — `.planning/milestones/v1.2-ROADMAP.md`
