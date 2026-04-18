# Phase 39 : Moteur prorata + calcul famille — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Moteur de calcul **pur** du pari Sporée : prorata cumulatif `(poids_sealeur / poids_famille_active_7j) × Tasks_pending`, poids par âge dérivés de la date de naissance (avec override), filtre profils actifs 7j glissants, filtre strict domaine Tasks, snapshot matinal stable + recompute 23h30 local.

**Livrable :** `lib/mascot/wager-engine.ts` (ou nom équivalent) — fonctions pures, zéro I/O, zéro UI, zéro hook. Suite Jest exhaustive.

**Hors scope :** toute UI (Phase 40), tout câblage hook temps réel (Phase 40 aussi), shop Sporée UI (Phase 40), tooltip onboarding (Phase 41).

</domain>

<decisions>
## Implementation Decisions

### D-01 Snapshot matinal — persistance
- Stocké **dans `jardin-familial.md`** en append-only sous une section dédiée `## Snapshots` avec format CSV date-keyed : `YYYY-MM-DD:pending:activeProfileIds|…`
- Réutilise le pattern append-only Phase 25 (village) et Phase 30 (constructions) — zéro nouvelle convention
- Rétention : garde les 14 derniers jours, purge au-delà (évite inflation fichier)
- Le snapshot est la **source of truth** pour toute réevaluation intra-journée — les recomputes 23h30 ne le modifient pas, ils lisent `snapshot[today]` et recalculent `cumulCurrent`

### D-02 Brackets d'âge (derivedAgeCategory)
- **Bébé** : 0-2 ans inclus (poids 0.0)
- **Jeune enfant** : 3-5 ans inclus (poids 0.15)
- **Enfant** : 6-12 ans inclus (poids 0.4)
- **Ado** : 13-17 ans inclus (poids 0.7)
- **Adulte** : 18 ans et + (poids 1.0)
- Dérivé depuis `profile.birthDate` via `computeAgeCategory(birthDate, today)` — pur, testable

### D-03 Override poids dans settings profil
- Champ vault `weight_override: 'adulte' | 'ado' | 'enfant' | 'jeune' | 'bebe'` dans le fichier profil (top-level frontmatter)
- Dropdown 5 presets dans UI settings profil — **PAS** de slider numérique libre (évite valeurs absurdes type 1.5)
- Si absent/null → dérivation automatique via `birthDate`
- `resolveWeight(profile) → number` : override si présent, sinon `WEIGHT_BY_CATEGORY[computeAgeCategory(birthDate)]`

### D-04 Edge cases
- **Divide-by-zero (aucun profil actif 7j hors sealeur, ou tous poids=0)** : fallback → `cumulTarget = Tasks_pending` (le sealeur porte la charge seul, prorata effectif = 1.0)
- **Sealeur avec poids 0 (bébé)** : refus à la création du pari (`canSealWager({weight}) → { ok: false, reason: 'zero_weight' }`) — un bébé ne peut pas parier
- **Pas de tâches pending au snapshot** : `cumulTarget = 0` → pari auto-gagné à la validation (cas marginal mais cohérent)
- **Profil sans birthDate et sans override** : traité comme adulte (1.0) par défaut — log warning dev only

### D-05 Catchup recompute
- **Un seul recompute au boot** — lecture `lastRecomputeDate` vs `today` local
- Si `lastRecomputeDate < today` ET l'heure actuelle ≥ 23h30 (du jour précédent) OU on est déjà dans le jour suivant → recompute une fois avec l'état courant des tâches
- **Pas de replay jour par jour** : si app fermée 3 jours, on prend l'état courant comme si on était au 23h30 d'hier. Simple, stateless, zéro backtracking.

### D-06 Snapshot trigger exact
- **Fenêtre recompute** : déclenchement si `now >= 23:30 local` ET `lastRecomputeDate !== today`
- **Fallback au boot** : à chaque app open, `maybeRecompute(now, lastRecomputeDate)` vérifie la condition — gère le cas app fermée au moment du 23h30
- **Morning snapshot** : pris à la première invocation du recompute après minuit local — c'est ce snapshot qui sert de référence jusqu'au suivant
- Une seule fonction pure `shouldRecompute(now, lastRecomputeDate) → boolean` testable en isolation

### Claude's Discretion
- Nom exact du module (`wager-engine.ts`, `prorata-engine.ts`, `family-weights.ts` — ou éclaté en 2-3 fichiers) — Claude choisit selon la cohérence avec les modules existants
- Signatures exactes des types `FamilySnapshot`, `WagerComputeResult` — Claude définit, du moment que consommables directement par Phase 40
- Stratégie de mock pour les tests (jest.useFakeTimers vs injection de `now` en paramètre) — **préférence** : injection de `now` en paramètre pour pureté maximale (pas de dépendance à Date.now dans le moteur)
- Structure suite Jest (un seul fichier `wager-engine.test.ts` ou éclaté par concept) — Claude choisit

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §SPOR-03, §SPOR-04, §SPOR-05, §SPOR-06, §SPOR-13 — acceptance criteria
- `.planning/ROADMAP.md` §"Phase 39" (lignes 262-272) — goal + success criteria

### Prior Phase Artifacts (consommés par Phase 39)
- `.planning/phases/38-fondation-modifiers-conomie-spor-e/38-01-SUMMARY.md` — shape `WagerModifier` (sporeeId, duration, multiplier, cumulTarget?, cumulCurrent?) + encode/decode
- `.planning/phases/38-fondation-modifiers-conomie-spor-e/38-02-SUMMARY.md` — `sporee-economy.ts` (helper `getLocalDateKey` à réutiliser) + `SPOREE_*` constantes
- `.planning/phases/38-fondation-modifiers-conomie-spor-e/38-VERIFICATION.md` — contrats vérifiés

### Codebase (fichiers à lire)
- `lib/mascot/types.ts` — `WagerModifier`, `WagerDuration`, `WagerMultiplier`, `PlantedCrop.modifiers`
- `lib/mascot/farm-engine.ts` — `encodeModifiers`/`decodeModifiers` (lignes 228, 233), pattern fonction pure
- `lib/mascot/sporee-economy.ts` — `getLocalDateKey()` à réutiliser
- `lib/types.ts` — type `Profile` (birthDate, id, role, statut)
- `lib/parser.ts` — parseFarmProfile/serializeFarmProfile (lignes 691-769) pour référence pattern parser
- `hooks/useVault.ts` — Tasks domain isolation (pour ID du filtre domaine SPOR-06)

### Tests de référence
- `lib/__tests__/sporee-economy.test.ts` — pattern `jest.spyOn(Math, 'random')` + describe par concept
- `lib/__tests__/farm-engine.test.ts` — pattern round-trip + backward-compat

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getLocalDateKey(d)`** (lib/mascot/sporee-economy.ts) : déjà livré Phase 38 — à réutiliser tel quel pour snapshot keys
- **`WagerModifier` shape** (lib/mascot/types.ts) : champs `cumulTarget?` et `cumulCurrent?` déjà présents — le moteur Phase 39 les peuple
- **Pattern append-only `jardin-familial.md`** (lib/vault.ts + Phase 25/30 summaries) : section `## Snapshots` réutilise ce contrat
- **Pattern fonction pure + injection `now`** : `applyDailyResetIfNeeded(boughtToday, lastReset, today)` de sporee-economy.ts est le modèle exact pour `shouldRecompute` et `recomputeCumulTarget`

### Established Patterns
- Moteur pur zéro I/O (`sporee-economy.ts`, `farm-engine.ts`) — jamais de FileSystem/AsyncStorage dans ces modules
- Tests Jest : injection des dépendances (Math.random via spy, Date via paramètre) — pattern strict
- TypeScript : types discriminés pour résultats (`{ ok: true, ... } | { ok: false, reason: ... }`) — préféré aux exceptions

### Integration Points
- Phase 40 consommera : `computeWagerProrata`, `resolveWeight`, `isProfileActive7d`, `filterTasksForWager`, `shouldRecompute`, `maybeRecompute`
- Phase 40 câblera dans `useFarm.harvest` : validation cumul via `validateWagerOnHarvest(wager, cumulCurrent, cumulTarget)` (fonction pure livrée ici)
- Le snapshot `jardin-familial.md` sera lu/écrit par Phase 40 (hooks), pas par le moteur lui-même

</code_context>

<specifics>
## Specific Ideas

- **Contrat pureté strict** : aucune fonction de `wager-engine.ts` ne doit appeler `Date.now()` ou `new Date()` sans paramètre — tout `now` est injecté. Même contrainte que `sporee-economy.ts` (référence vérifiée Phase 38).
- **Signature pivot** suggérée : `computeCumulTarget({ sealerProfile, allProfiles, tasksSnapshot, today }) → { cumulTarget: number, activeProfileIds: string[], weights: Record<string, number> }` — explicite, testable, consommable directement par Phase 40.
- **Bornes âge** : utiliser `differenceInYears(today, birthDate)` avec ≥ (inclusif sur la borne basse). Ex: 3 ans révolus → jeune enfant. Testable avec dates précises.
- **Suite Jest minimum** : 1) `computeAgeCategory` (6 cas bornes + override), 2) `resolveWeight` (override vs dérivation), 3) `isProfileActive7d` (tasks dans/hors fenêtre), 4) `filterTasksForWager` (Tasks pur, exclusions Courses/Repas/Routines/Anniversaires/Notes/Moods), 5) `computeCumulTarget` (prorata fractionnaire + edge cases D-04), 6) `shouldRecompute` + `maybeRecompute` (fenêtre 23h30 + catchup boot), 7) `validateWagerOnHarvest` (cumul atteint / non atteint).

</specifics>

<deferred>
## Deferred Ideas

- **UI settings profil override poids** — dropdown 5 presets : forme exacte (composant, label, position dans l'écran settings) laissée à Phase 40/41 (polish settings).
- **Visualisation du snapshot** en debug menu — utile pour QA, mais hors scope moteur pur. Phase 41 possible.
- **Réconciliation snapshot si vault édité manuellement** (user modifie `jardin-familial.md` à la main) — scope trop large, confiance dans l'intégrité vault pour v1.7.
- **Métriques long-terme prorata** (historique des paris gagnés/perdus par profil, moyennes) — codex `marathonWins` couvre partiellement en Phase 41.

</deferred>

---

*Phase: 39-moteur-prorata-calcul-famille*
*Context gathered: 2026-04-18*
