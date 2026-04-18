# Requirements: v1.7 Modifiers de plants

**Milestone goal :** Introduire des objets consommables qui modifient le comportement des plants au moment de la plantation, pour créer des décisions stratégiques au-delà du cycle plant→récolte→craft classique — transformer le jardin en terrain de décisions plutôt qu'en simple timer.

**Scope v1.7 :** Sporée de Régularité uniquement (Chimère reportée v1.8). Fondation `modifiers` conçue extensible pour accueillir futurs modifiers sans refonte.

**Scope constraint (hérité CLAUDE.md) :**
- Aucune nouvelle dépendance npm (`expo-haptics`, `react-native-reanimated`, `expo-secure-store` déjà installés)
- Backward compat Obsidian vault obligatoire (farm CSV markdown lisible/éditable manuellement)
- Stack inchangée : React Native + Expo SDK 54, reanimated ~4.1
- Farm engine reste 100% synchrone et pur (patterns `farm-engine.ts` existants)
- UI/commits/commentaires en français
- Couleurs via `useThemeColors()` — jamais de hardcoded
- Bump `CACHE_VERSION` dans `lib/vault-cache.ts:41` car shape `FarmCrop` change

---

## v1 Requirements

### Catégorie FONDATION — Infra modifiers partagée

- [x] **MOD-01**: User voit ses plants plantés supporter un champ optionnel `modifiers` (objet JSON extensible : `{ wager?: {...}, graftedWith?: string, ... }`) sérialisé/désérialisé en CSV markdown sans perte, backward-compatible (plants existants sans champ restent lisibles)
- [x] **MOD-02**: User voit `CACHE_VERSION` bumpé dans `lib/vault-cache.ts:41` pour refléter le changement de shape `FarmCrop` — pas d'invalidation silencieuse au premier boot post-migration
- [x] **MOD-03**: User voit le seed picker existant étendu avec un slot optionnel "Sceller" (apparaît uniquement si ≥ 1 Sporée en inventaire) — intégration inline, zéro nouvelle modale, pattern extensible pour futurs slots modifier

### Catégorie SPORÉE — Mécanique principale

- [x] **SPOR-01**: User peut appliquer une Sporée à la plantation via le slot "Sceller", choisir parmi 3 durées (Chill / Engagé / Sprint) dérivées automatiquement de la taille du plant, avec multiplier de reward visible (×1.3 / ×1.7 / ×2.5) et prorata théorique affiché avant confirmation
- [x] **SPOR-02**: User voit un badge sur le plant scellé affichant `X/Y tâches aujourd'hui • cumul Z/N` avec code couleur dérivé de la progression vs ligne de pace (vert/jaune/orange), sans animation continue lourde
- [x] **SPOR-03**: User voit le cumul requis recalculé et mis à jour chaque soir à 23h30 (ou au boot de l'app si l'app était fermée) selon la formule `(poids_sealeur / poids_famille_active_7j) × Tasks_pending`, basé sur un snapshot matinal stable des tâches pending
- [x] **SPOR-04**: User voit les poids par âge appliqués automatiquement aux profils actifs (Adulte 1.0 / Ado 0.7 / Enfant 0.4 / Jeune enfant 0.15 / Bébé 0.0) — dérivés de la date de naissance du profil, avec override manuel possible dans les settings profil
- [x] **SPOR-05**: User voit seulement les profils actifs sur les 7 derniers jours glissants comptés dans le diviseur famille (au moins 1 tâche complétée dans la fenêtre) — un ado dormant n'allège pas la charge du parent sealeur
- [x] **SPOR-06**: User voit seulement les tâches du domaine Tasks comptabilisées (pas Courses, pas Repas, pas Routines, pas Anniversaires, pas Notes, pas Moods) — filtre strict par type de source
- [ ] **SPOR-07**: User récolte le plant scellé : si cumul atteint → reward × multiplier appliqué + toast de victoire + 15% chance de drop-back d'une Sporée, sinon reward normale sans pénalité autre que la Sporée consommée
- [x] **SPOR-08**: User obtient des Sporées via 4 sources : drops à la récolte (3% tier 1-3, 8% rare, 15% expedition), achat shop (400 feuilles, cap 2/jour, dès Arbre stade 3), loot expedition (5% missions Pousse+), cadeau onboarding (1 gratuite au stade 3 avec tooltip explicatif)
- [x] **SPOR-09**: User voit son inventaire de Sporées cappé à 10 — drops au-delà affichent un toast "Inventaire Sporée plein" et ne sont pas perdus silencieusement
- [x] **SPOR-10**: User voit un tooltip one-shot au premier drop/obtention de Sporée expliquant la mécanique en 1-2 phrases + compteur codex `wager.marathonWins` incrémenté sur chaque pari gagné (récompense vanité long terme)
- [x] **SPOR-11**: User voit un état visuel différencié sur un plant scellé qui est déjà mûr mais pas encore récolté (anneau vert "prêt à valider") pour faciliter la décision de récolter avant ou après avoir atteint le cumul

### Catégorie QUALITÉ — Non-régression et tests

- [ ] **SPOR-12**: User ne voit aucune régression TypeScript (`npx tsc --noEmit` clean hors erreurs pré-existantes) ni aucune régression Jest (`npx jest --no-coverage` clean) après chaque phase
- [x] **SPOR-13**: User a des tests Jest couvrant les fonctions pures critiques : calcul du prorata, pondération famille par âge, sérialisation/désérialisation `modifiers` CSV, validation cumul à la récolte

---

## Future Requirements (deferred v1.8)

- **CHIM-F01**: Pollen de Chimère — objet consommable pour greffer 2 graines en 1 plant (champ `modifiers.graftedWith`), reward moyenné entre parents + drop tables cumulées + règles spéciales par tier du donneur (tier 1: -1 tâche/stade, tier 2: +10% reward, tier 3: double harvest, rare: moyenne + drop hérité, expedition: moyenne + golden garanti)
- **CHIM-F02**: Cumul visible du Pollen + Sporée sur un même plant (les 2 slots modifier indépendants, multipliers cumulés)
- **CHIM-F03**: Économie Pollen (drops, shop, expedition) à définir au moment du milestone v1.8 après feedback Sporée
- **SPOR-F01**: Pari familial coopératif — le cumul compte les tâches de tous les profils actifs, pas seulement le sealeur
- **SPOR-F02**: Streak de paris gagnés d'affilée (3/5/10) débloquant un plant spécial ou un cosmétique
- **SPOR-F03**: Mode vacances famille qui fige les paris en cours (compteur pause, reprise au retour)
- **MOD-F01**: Pattern de "catalyseurs" étendu à d'autres mécaniques ferme (ex: booster expédition, accélérateur craft)

---

## Out of Scope

- **Pénalité en feuilles sur pari perdu** — contraire à la Core Value "bien-être familial" ; seul coût reste la Sporée consommée
- **Task-farming artificiel obligatoire** — le pari ne doit pas pousser à créer de fausses tâches ; filtrage strict domain Tasks + poids famille réalistes protègent contre ça
- **Refonte du grid ferme ou des sprites** — les modifiers s'intègrent dans l'infra existante (badge inline, slot picker inline), pas de refonte visuelle
- **Synchronisation cross-profile des Sporées** — chaque profil a son propre inventaire (alignement pattern gamification per-profil existant)
- **Notifications push à 23h30** — le check est passif (au prochain boot ou via scheduled local notif silencieuse), pas de push intrusif
- **Difficulté dynamique basée sur l'historique du joueur** — multipliers fixes pour transparence ; joueur comprend exactement ce qu'il engage

---

## Traceability

Mapping REQ-ID → Phase (v1.7 Phases 38-41).

| Requirement | Phase | Status |
|-------------|-------|--------|
| MOD-01 | Phase 38 | Complete |
| MOD-02 | Phase 38 | Complete |
| MOD-03 | Phase 40 | Complete |
| SPOR-01 | Phase 40 | Complete |
| SPOR-02 | Phase 40 | Complete |
| SPOR-03 | Phase 39 | Complete |
| SPOR-04 | Phase 39 | Complete |
| SPOR-05 | Phase 39 | Complete |
| SPOR-06 | Phase 39 | Complete |
| SPOR-07 | Phase 40 | Pending |
| SPOR-08 | Phase 38 | Complete |
| SPOR-09 | Phase 38 | Complete |
| SPOR-10 | Phase 41 | Complete |
| SPOR-11 | Phase 40 | Complete |
| SPOR-12 | Phase 41 | Pending |
| SPOR-13 | Phase 38 + Phase 39 | Complete |

**Coverage check :** 16/16 REQ-IDs mappés ✓ (3 MOD + 13 SPOR). Aucun orphelin, aucune duplication (SPOR-13 couvre les tests Jest fondations en Phase 38 ET moteur en Phase 39 — deux suites distinctes).

### Phase repartition summary

- **Phase 38 — Fondation modifiers + économie Sporée (5 REQ)** : MOD-01, MOD-02, SPOR-08, SPOR-09, SPOR-13 (tests fondations)
- **Phase 39 — Moteur prorata + calcul famille (5 REQ)** : SPOR-03, SPOR-04, SPOR-05, SPOR-06, SPOR-13 (tests moteur)
- **Phase 40 — UI Sporée (5 REQ)** : MOD-03, SPOR-01, SPOR-02, SPOR-07, SPOR-11
- **Phase 41 — Polish onboarding + non-régression (2 REQ)** : SPOR-10, SPOR-12
