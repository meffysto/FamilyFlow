# Phase 19: Détection catégorie sémantique - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Livrer un module **pur** de détection sémantique de catégorie pour les tâches, consommable par Phase 20. Entrée : un `Task` (déjà parsé par `lib/parser.ts`). Sortie : une catégorie parmi 10 (avec signal matchant + evidence) ou `null`. Zéro effet de bord, zéro mutation de fichier vault, feature flag OFF par défaut, tests extensifs.

**Ce que Phase 19 NE fait PAS :**
- Appliquer des effets ferme (Phase 20 dispatcher)
- Modifier `awardTaskCompletion()` (Phase 20)
- UI utilisateur (Phase 22)
- Feedback visuel / toast / haptic / compagnon (Phase 21)
- Persistance des caps anti-abus (Phase 20)

</domain>

<decisions>
## Implementation Decisions

### Structure du mapping (D-01)
- **D-01**: Les 10 catégories vivent dans un module TypeScript hardcodé à `lib/semantic/categories.ts`, exporté comme `readonly SemanticCategory[]`. Forme de chaque entrée : `{ id: CategoryId, labelFr, labelEn, filepathPatterns: string[], sectionPatterns: string[], tagPatterns: string[] }`. Pas de JSON externe, pas de fetch, pas de dépendance npm ajoutée (ARCH-04).
- **D-08**: Les 10 `CategoryId` canoniques (1:1 avec EFFECTS-01..10 de Phase 20) :
  1. `menage_quotidien` → EFFECTS-01 (weeds removed)
  2. `menage_hebdo` → EFFECTS-02 (wear repair)
  3. `courses` → EFFECTS-03 (building turbo)
  4. `enfants_routines` → EFFECTS-04 (companion mood spike)
  5. `enfants_devoirs` → EFFECTS-05 (Growth Sprint)
  6. `rendez_vous` → EFFECTS-06 (rare seed drop)
  7. `gratitude_famille` → EFFECTS-07 (saga trait boost)
  8. `budget_admin` → EFFECTS-08 (building capacity ×2)
  9. `bebe_soins` → EFFECTS-09 (golden harvest ×3)
  10. `cuisine_repas` → EFFECTS-10 (rare craft recipe)

### Priorité des signaux (D-02)
- **D-02**: Ordre figé **tag > section > filepath**. Le tag est une intention utilisateur explicite → gagne sur la structure vault. Premier match dans cet ordre retourné, signaux suivants ignorés. Rationale : prévisible, trivialement testable, pas de score à tuner.

### Stratégie de matching (D-03)
- **D-03a**: Helper `normalize(str)` unique réutilisé partout : `lowercase` + strip accents (NFD + regex `/[\u0300-\u036f]/g`) + trim.
- **D-03b Filepath**: Extraire le premier segment de dossier depuis `task.sourceFile`, strip le préfixe `NN - ` (regex `/^\d+\s*-\s*/`), normalize, puis comparaison `===` contre chaque `filepathPatterns[]`.
- **D-03c Section**: normalize `task.section` (si présent), puis pour chaque `sectionPatterns[]` vérifier `normalized.includes(pattern)`. Permet `"Ménage hebdomadaire"` de matcher pattern `"menage hebdo"`.
- **D-03d Tag**: normalize chaque `task.tags[]`, comparaison `===` stricte contre `tagPatterns[]`.

### API publique (D-04)
- **D-04a**: Signature : `deriveTaskCategory(task: Task): CategoryMatch | null`. **100% pure** — pas d'async, pas d'I/O, pas de lecture SecureStore.
- **D-04b**: Type : `type CategoryMatch = { id: CategoryId; matchedBy: 'tag' | 'section' | 'filepath'; evidence: string }`. L'`evidence` est la valeur brute (non-normalisée) qui a matché — Phase 21 l'utilisera dans les toasts ("🌿 Ménage : 1 weeds retiré !" avec evidence `"Ménage hebdomadaire"`).
- **D-04c**: Retour `null` = aucun signal reconnu. C'est le SEUL cas de fallback ; Phase 20 traite `null` comme "standard XP, zéro effet" (ARCH-03).

### Feature flag `semanticCoupling` (D-05)
- **D-05a**: Clé SecureStore globale `semantic-coupling-enabled`, valeur stockée comme string `"true"` / `"false"`, default `false` (si clé absente).
- **D-05b**: **Pas par-profil** — un seul état pour toute la famille. Simplicité maximale, modifiable via Phase 22 (écran Réglages Couplage sémantique).
- **D-05c**: Helpers dans `lib/semantic/flag.ts` :
  - `async isSemanticCouplingEnabled(): Promise<boolean>`
  - `async setSemanticCouplingEnabled(enabled: boolean): Promise<void>`
- **D-05d**: Le flag est vérifié par l'**appelant** (Phase 20 dispatcher), PAS à l'intérieur de `deriveTaskCategory`. Séparation des responsabilités : Phase 19 = pure, Phase 20 = orchestration.
- **D-05e**: SEMANTIC-05 ("user can toggle via feature flag") est validé en Phase 19 par le helper + ses tests ; l'écran UI arrive en Phase 22.

### Arborescence du module (D-07)
```
lib/semantic/
├── categories.ts         # Mapping table (10 entrées) + types CategoryId, SemanticCategory
├── derive.ts             # deriveTaskCategory() + normalize() + matchers privés
├── flag.ts               # isSemanticCouplingEnabled / setSemanticCouplingEnabled
├── index.ts              # Barrel export
└── __tests__/
    ├── derive.test.ts    # Tests filepath / section / tag / priorité / fallback
    └── flag.test.ts      # Tests SecureStore (mock) + default off
```

### Couverture des requirements
- **SEMANTIC-01** (détection filepath) → D-03b, tests `derive.test.ts`
- **SEMANTIC-02** (détection section) → D-03c, tests `derive.test.ts`
- **SEMANTIC-03** (détection tag) → D-03d, tests `derive.test.ts`
- **SEMANTIC-04** (fallback standard XP) → D-04c `null` + tests
- **SEMANTIC-05** (toggle via flag) → D-05, tests `flag.test.ts`
- **ARCH-01** (pas d'écriture vault) → D-04a pur, aucun import `vault.ts`
- **ARCH-02** (disable instant) → D-05a SecureStore synchrone après lecture ; Phase 20 vérifie à chaque call
- **ARCH-03** (zéro régression) → D-04c `null` garde l'ancien chemin XP
- **ARCH-04** (zéro nouvelle dep) → D-01 mapping hardcodé, SecureStore déjà présent

### Claude's Discretion
Suite à "je te laisse faire", toutes les décisions ci-dessus sont sous ma responsabilité. Aires où j'ai volontairement laissé de la flexibilité au planner :

- **Choix exact des `filepathPatterns` / `sectionPatterns` / `tagPatterns` pour chaque catégorie** — le planner décidera en lisant la structure réelle du vault (`01 - Quotidien`, `02 - Maison`, `03 - Cuisine`, sections existantes). Je n'ai pas hardcodé ces strings ici.
- **Exhaustivité des cas de test dans `derive.test.ts`** — au minimum : un test happy path par catégorie × 3 signaux, un test de priorité (tag > section > filepath), un test fallback, un test feature-flag off (même si le flag est testé séparément). Le planner peut élargir.
- **Nom exact du type exporté** (`CategoryMatch` vs `TaskCategoryResult` vs autre) — je propose `CategoryMatch` mais le planner peut ajuster si conflit de nommage détecté.
- **Format stockage SecureStore** (string `"true"` vs JSON) — j'ai choisi string simple, le planner peut passer à JSON si nécessaire pour cohérence avec d'autres clés existantes.

### Folded Todos
_None — no pending todos matched Phase 19 scope._

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 19: Détection catégorie sémantique" — Goal, success criteria, requirement mapping
- `.planning/REQUIREMENTS.md` §SEMANTIC (01-05) + §ARCH (01-04) — Les 9 requirements couverts en Phase 19
- `.planning/PROJECT.md` — Contraintes stack, core value (fiabilité/stabilité)

### Codebase contracts existants
- `lib/parser.ts` lignes 82-140 — `parseTask()` et `parseTaskFile()` : la source `Task` consommée par Phase 19 (champs `sourceFile`, `section`, `tags[]`)
- `lib/gamification/engine.ts` lignes 105-128 — `awardTaskCompletion()` : point d'injection Phase 20, ne pas toucher en Phase 19 mais connaître sa signature actuelle
- `.planning/codebase/CONVENTIONS.md` — Conventions TypeScript, imports, barrel files
- `.planning/codebase/STRUCTURE.md` — Arborescence `lib/` existante
- `CLAUDE.md` §Architecture + §Testing — `npx tsc --noEmit` seule validation, erreurs pré-existantes à ignorer

### Milestone context (v1.3)
- `.planning/REQUIREMENTS.md` §"Out of Scope" — ce qui est explicitement exclu (pas d'écriture vault, pas de catégories dynamiques, pas de malus)

### Aucun ADR / spec externe
Aucun document externe additionnel — les décisions vivent dans ce CONTEXT.md et les requirements.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/parser.ts:parseTask`** : retourne déjà `{ sourceFile, section, tags[], ... }` — aucune modification nécessaire au parser. Phase 19 consomme uniquement.
- **`lib/parser.ts:parseTaskFile`** : groupe déjà les tâches par section H2/H3 — le champ `section` est prêt pour le matching.
- **SecureStore (`expo-secure-store`)** : déjà utilisé pour prefs (voir ThemeContext, profils). Pattern async éprouvé.
- **Barrel files** : convention projet (`lib/gamification/index.ts`, `components/ui/index.ts`) — reproduire pour `lib/semantic/index.ts`.
- **Tests existants** : `lib/__tests__/gamification.test.ts` montre le pattern de test pur (Jest implicite via tsc-jest ou RN test runner — le planner vérifiera le runner existant).

### Established Patterns
- **Modules purs** dans `lib/` sans React — `lib/parser.ts`, `lib/gamification/engine.ts` sont 100% pures. Phase 19 suit ce pattern.
- **Pas d'I/O dans les fonctions purs** — les helpers flag (I/O SecureStore) sont isolés dans `flag.ts`, séparés de `derive.ts`.
- **Nommage FR pour les ids et messages UI, EN pour les types TS** — cohérent avec le reste du codebase.
- **Erreurs user-facing en français** (CLAUDE.md) — mais Phase 19 n'a aucune UI, donc N/A ici.
- **Commentaires + commits en français** — à respecter.

### Integration Points
- **Consommateur unique futur** : Phase 20 `applyTaskEffect()` dispatcher — il importera `deriveTaskCategory` + `isSemanticCouplingEnabled` depuis `lib/semantic`.
- **Zéro import dans l'app actuelle** : Phase 19 n'est câblée nulle part. Le flag off par défaut + le non-câblage garantissent l'absence de régression.
- **Aucun contexte React touché** : Phase 19 ne modifie ni `VaultContext`, ni `ThemeContext`, ni `hooks/useVault.ts`.

</code_context>

<specifics>
## Specific Ideas

- **Couverture de test = focus Phase 19-02** : le succès de la phase dépend autant des tests que du code. Les tests doivent couvrir explicitement la priorité tag > section > filepath avec un cas conflit (une tâche qui matche les 3 → doit retourner `matchedBy: 'tag'`).
- **Evidence brute, pas normalisée** : dans `CategoryMatch.evidence`, garder la string originale ("Ménage hebdomadaire") et non la version normalisée ("menage hebdomadaire") — Phase 21 voudra afficher le texte tel que l'utilisateur l'a écrit.
- **`normalize()` est interne** : ne pas l'exporter depuis le barrel. C'est un détail d'implémentation.
- **Le flag SecureStore est family-wide**, pas par-profil. Cohérent avec la philosophie "famille partage la ferme".
- **Aucun log / console.warn** dans le chemin normal de `deriveTaskCategory` — il sera appelé à chaque task completion, aucun bruit.

</specifics>

<deferred>
## Deferred Ideas

- **Catégories dynamiques / custom user** — explicitement out of scope milestone v1.3 (voir REQUIREMENTS.md §Out of Scope). Les 10 catégories sont figées.
- **Catégorie dérivée du frontmatter** — pas dans SEMANTIC-01/02/03. Si un jour on veut ajouter un signal `frontmatter.category`, c'est une extension future.
- **Score de confiance sur le match** — pourrait être utile pour le Musée (Phase 23), mais hors scope ici : le premier match gagne, binaire.
- **Mapping localisé par langue de vault** — le mapping est FR-first (les vaults réels sont en français). Si besoin plus tard pour vaults EN, extension future.
- **Telemetry / metrics des matches** — Phase 22 aura des stats semaine, mais côté Phase 20 (counts au déclenchement d'effet), pas Phase 19.

### Reviewed Todos (not folded)
_None — aucun todo pending ne matche le scope Phase 19._

</deferred>

---

*Phase: 19-d-tection-cat-gorie-s-mantique*
*Context gathered: 2026-04-09*
