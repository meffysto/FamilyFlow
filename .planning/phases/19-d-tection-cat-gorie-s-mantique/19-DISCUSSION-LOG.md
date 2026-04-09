# Phase 19: Détection catégorie sémantique - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 19-d-tection-cat-gorie-s-mantique
**Areas discussed:** Mapping table & forme ; Priorité des signaux ; Stratégie matching ; API & fallback (+ feature flag)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Mapping table & forme | Où vivent les 10 catégories, structure des entrées | ✓ |
| Priorité des signaux | Ordre tag / section / filepath en cas de conflit | ✓ |
| Stratégie matching filepath + section | Normalisation, littéral vs contains | ✓ |
| API deriveTaskCategory() & fallback | Shape de retour, flag location, null vs standard | ✓ |

**User's choice:** "Je te laisse faire" — Claude a pris toutes les décisions ci-dessous.

---

## Mapping table & forme

| Option | Description | Selected |
|--------|-------------|----------|
| `constants/` hardcodé TS | Module TypeScript avec tableau readonly typé | ✓ |
| JSON externe dans assets | Fichier JSON chargé au runtime | |
| Config dynamique SecureStore | Modifiable par utilisateur | |

**Claude's pick:** Module TypeScript hardcodé à `lib/semantic/categories.ts`.
**Rationale:** type-safe, tree-shakeable, zéro I/O, zéro nouvelle dépendance (ARCH-04), extensibilité user explicitement out of scope (REQUIREMENTS.md §Out of Scope). Placé dans `lib/semantic/` plutôt que `constants/` car il contient de la logique métier (patterns de matching), pas uniquement des tokens design.

---

## Priorité des signaux

| Option | Description | Selected |
|--------|-------------|----------|
| tag > section > filepath (figé) | Intention utilisateur explicite gagne | ✓ |
| filepath > section > tag | Structure vault priorisée | |
| Score de spécificité | Tag spécifique > section générique, etc. | |
| Premier match rencontré | Ordre d'itération du mapping | |

**Claude's pick:** Ordre figé tag > section > filepath.
**Rationale:** un tag est une annotation explicite ajoutée par l'utilisateur sur CE task spécifique → c'est le signal le plus intentionnel. La section est intermédiaire (organisation d'un fichier). Le filepath est le plus général. Prévisible, testable, aucun tuning de score requis.

---

## Stratégie de matching

| Signal | Option retenue | Alternatives écartées |
|--------|----------------|-----------------------|
| Filepath | Premier segment + strip préfixe `NN - ` + normalize + `===` exact | Regex libre (trop permissif), substring match (collisions) |
| Section | normalize + `.includes(pattern)` | Littéral exact (trop rigide pour "Ménage hebdomadaire"), regex (overkill) |
| Tag | normalize + `===` strict | `startsWith` (trop permissif), regex (pas nécessaire) |
| Helper commun | `normalize()` = lowercase + strip accents (NFD) + trim | Bibliothèque externe `slugify` (nouvelle dep, ARCH-04 ❌) |

**Claude's pick:** Voir tableau. Toutes les stratégies utilisent un helper `normalize()` unique privé à `lib/semantic/derive.ts`.
**Rationale:** équilibre entre tolérance aux variantes de casse/accents (très présentes dans un vault FR) et précision (pas de matches accidentels). Le `includes` sur section est le seul compromis permissif, justifié par la richesse des intitulés de section ("Ménage hebdomadaire", "Courses de la semaine").

---

## API `deriveTaskCategory()` & fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Retour `CategoryId \| null` | Simple, minimal | |
| Retour `CategoryMatch \| null` objet riche | Inclut `matchedBy` + `evidence` | ✓ |
| Retour `{ id, score, signals[] }` | Plusieurs signaux + score | |

**Claude's pick:** `CategoryMatch \| null` avec `{ id, matchedBy, evidence }`.
**Rationale:** Phase 21 aura besoin de `evidence` pour les toasts ("🌿 Ménage : 1 weeds retiré !" référençant la section réelle). Le champ `matchedBy` aidera à debugger + Phase 23 Musée pourra potentiellement s'en servir. Coût marginal sur la pureté/performance.

**Fallback:** `null` uniquement. Phase 20 traduit `null` → standard XP. La distinction "flag off" vs "pas de match" est gérée en amont (Phase 20 n'appelle même pas `deriveTaskCategory` si flag off).

---

## Feature flag `semanticCoupling`

| Option | Description | Selected |
|--------|-------------|----------|
| SecureStore global | Une clé famille-wide | ✓ |
| SecureStore par profil | Une clé par profileId | |
| Frontmatter `gami-{id}.md` | Persistance game data | |
| In-memory uniquement | Pas persisté | |

**Claude's pick:** SecureStore clé globale `semantic-coupling-enabled`.
**Rationale:** la ferme est partagée par la famille entière (un seul état), pas de sens de diverger par profil. SecureStore = pattern existant pour prefs. Helpers async isolés dans `lib/semantic/flag.ts` pour garder `derive.ts` 100% pur. Default `false` (OFF) respecte la contrainte "feature flag off par défaut" du phase goal.

**Call-site du check:** dans Phase 20 dispatcher, PAS à l'intérieur de `deriveTaskCategory`. Séparation claire des responsabilités.

---

## Arborescence module

| Option | Description | Selected |
|--------|-------------|----------|
| `lib/semantic/` (nouveau dossier) | Module isolé, cohérent avec `lib/gamification/` | ✓ |
| `lib/gamification/semantic.ts` | Colocation avec le consommateur futur | |
| `lib/taskCategories.ts` (flat) | Un seul fichier | |

**Claude's pick:** Nouveau dossier `lib/semantic/` avec `categories.ts` + `derive.ts` + `flag.ts` + `index.ts` + `__tests__/`.
**Rationale:** la phase livre un module multi-fichiers (mapping + derive + flag + tests) qui mérite son propre namespace. Le barrel `index.ts` suit la convention projet. Cohérence avec `lib/gamification/`, `lib/mascot/`, etc.

---

## Claude's Discretion

Suite à "Je te laisse faire", TOUTES les décisions ci-dessus ont été prises par Claude. Points laissés volontairement flexibles pour le planner :

- Strings exactes des `filepathPatterns` / `sectionPatterns` / `tagPatterns` pour chaque catégorie (à dériver du vault réel en phase plan)
- Nom exact des types exportés
- Nombre total de cas de test dans `derive.test.ts` (minimum spécifié dans CONTEXT.md)
- Format SecureStore stockage (string simple proposé, JSON possible)

## Deferred Ideas

- Catégories dynamiques user-defined (out of scope milestone)
- Score de confiance sur match (hors besoin Phase 19)
- Detection depuis frontmatter `category:` (hors requirements)
- Mapping multi-langue pour vaults EN (future extension)
- Telemetry / metrics (Phase 22 côté stats, Phase 20 côté counts)
