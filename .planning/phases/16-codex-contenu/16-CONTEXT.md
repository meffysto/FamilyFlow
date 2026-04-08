# Phase 16: Codex contenu - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Création du fichier de données pur `lib/codex/content.ts` qui exporte un tableau `CodexEntry[]` couvrant les 10 catégories ferme (Cultures, Animaux, Bâtiments productifs, Craft, Tech tree, Compagnons, Loot box & raretés, Drops saisonniers & événements, Sagas, Quêtes coopératives), en référençant les constantes engine existantes — **zéro UI, zéro duplication numérique**.

L'objectif est de produire un fichier de données validé en isolation avant toute UI (Phase 17). Tous les contenus narratifs (lore) sont externalisés en clés i18n FR+EN. La phase est non-cassante par construction puisqu'elle n'introduit aucun chemin d'exécution dans l'app existante.

</domain>

<decisions>
## Implementation Decisions

### Forme du type CodexEntry

- **D-01 (Type union discriminée):** `type CodexEntry = CropEntry | AnimalEntry | BuildingEntry | CraftEntry | TechEntry | CompanionEntry | LootEntry | SeasonalEntry | SagaEntry | QuestEntry`. Chaque variante porte un champ discriminant `kind: 'crop' | 'animal' | ...` et des champs typés spécifiques à la catégorie. L'UI Phase 17 saura exactement quels champs afficher selon `kind` via un switch exhaustif TS.
- **D-02 (Référence par id, pas de spread):** Chaque entrée stocke `sourceId: string` (l'id de l'item dans la constante engine) et **n'inline jamais** les valeurs numériques. Les stats sont récupérées via getter ou helper du type `getCropStats(entry: CropEntry): CropDefinition` qui fait `CROP_CATALOG.find(c => c.id === entry.sourceId)`. Cela garantit zéro drift à 100% : si l'engine change un cycle ou un coût, le codex reflète automatiquement.
- **D-03 (Base commune):** Tous les variants partagent au minimum `{ id: string; kind: CodexKind; sourceId: string; nameKey: string; loreKey: string; iconRef?: string }`. Le `id` du codex peut différer du `sourceId` engine si nécessaire (ex: une "pluie dorée" peut être une entrée codex sans équivalent direct).

### Mapping catégories ↔ sources engine

- **D-04 (Cultures):** Source = `CROP_CATALOG` (lib/mascot/types.ts:309). Le champ `dropOnly?: boolean` existe **déjà** dans `CropDefinition` (types.ts:286) — Phase 16 le réutilise tel quel sans toucher l'engine. Crops concernées : orchidée, rose dorée, truffe, fruit du dragon (CODEX-05).
- **D-05 (Animaux):** Source = `INHABITANTS` (lib/mascot/types.ts:241), **tous les habitants** sans filtrage. Les sous-catégories (animaux ferme / fantastiques / saga exclusifs) sont exposées via un champ optionnel `subgroup?: 'farm' | 'fantasy' | 'saga'` calculé au build à partir de la rareté + flag `sagaExclusive`. Les entrées avec `sagaExclusive: true` sont traitées comme `dropOnly` côté codex (silhouette `???` tant que la saga n'est pas résolue par le profil).
- **D-06 (Bâtiments productifs):** Source = `BUILDING_CATALOG` (lib/mascot/types.ts:421).
- **D-07 (Craft):** Source = `CRAFT_RECIPES` (lib/mascot/craft-engine.ts:27).
- **D-08 (Tech tree):** Source = `TECH_TREE` (lib/mascot/tech-engine.ts:36).
- **D-09 (Compagnons):** Source = `COMPANION_SPECIES_CATALOG` (lib/mascot/companion-types.ts:145).
- **D-10 (Sagas):** Source = `SAGAS` (lib/mascot/sagas-content.ts:15).
- **D-11 (Quêtes coopératives):** Source = `ADVENTURES` (lib/mascot/adventures.ts:32).
- **D-12 (Drops saisonniers):** Source = `SEASONAL_EVENT_DIALOGUES` (lib/mascot/seasonal-events-content.ts:15).
- **D-13 (Loot box & raretés):** **Pas de catalogue dédié dans l'engine.** Phase 16 agrège les constantes `HARVEST_EVENTS`, `RARE_SEED_DROP_RULES`, `GOLDEN_CROP_CHANCE`, `GOLDEN_HARVEST_MULTIPLIER` (toutes dans lib/mascot/farm-engine.ts) en `LootEntry[]` au sein de content.ts via getters référençant ces constantes. **Aucun refactor de l'engine** — la nouvelle constante n'est pas créée pour rester non-cassant. Cette catégorie documente explicitement la mécanique des "pluies dorées" (CODEX-04).

### dropOnly mechanism

- **D-14 (Réutiliser le flag engine existant pour Cultures):** `CropDefinition.dropOnly` est déjà présent — `CropEntry` se contente de l'exposer tel quel via getter.
- **D-15 (Étendre la sémantique dropOnly aux Animaux saga):** Pour `AnimalEntry`, calculer `dropOnly = inhabitant.sagaExclusive === true` au build. Phase 17 saura traiter ce flag de la même façon que pour les crops.
- **D-16 (Pas de dropOnly pour les autres catégories Phase 16):** Bâtiments, craft, tech, compagnons, sagas, quêtes ne sont pas marqués `dropOnly` — ils sont visibles dès l'ouverture du codex (les conditions de déblocage propres à l'engine restent affichées dans les stats brutes).

### Lore narratif & i18n

- **D-17 (Lore narratif riche, ~2-4 phrases par entrée):** Chaque `CodexEntry` porte un `loreKey` qui pointe vers une description immersive (style Stardew Valley wiki) — pas de stats brutes seules.
- **D-18 (Nouveau namespace i18n `codex` FR+EN dès Phase 16):** Création de `locales/fr/codex.json` ET `locales/en/codex.json`. Toutes les clés sont remplies dans les **deux langues** au moment de la phase. Structure des clés : `codex.{kind}.{sourceId}.name` et `codex.{kind}.{sourceId}.lore`. Le namespace est ajouté à l'init i18next (`lib/i18n.ts`).
- **D-19 (Claude rédige FR + EN, l'utilisateur valide):** Pendant l'exécution, Claude génère les descriptions FR puis EN en se basant sur les stats engine. L'utilisateur relit et corrige avant commit. Volume estimé : ~70-100 entrées × 2 langues = ~150-200 textes courts.
- **D-20 (loreKey est obligatoire, pas de fallback inline):** Aucun texte hardcodé en FR dans `content.ts` — chaque entrée DOIT avoir une clé i18n résolvable. Un test peut le vérifier (cf D-21).

### Validation & garde anti-drift (Claude's Discretion)

- **D-21 (Claude's Discretion):** L'utilisateur n'a pas tranché sur la stratégie de validation. Claude décide pendant le plan : minimum un test TypeScript strict (`tsc --noEmit`) qui plante si un `sourceId` n'existe pas dans la constante engine référencée, idéalement complété par un assert runtime au démarrage du module en `__DEV__`. Pas de test framework supplémentaire — Phase 16 ne touche pas le tooling.

### Organisation fichier (Claude's Discretion)

- **D-22 (Claude's Discretion):** L'utilisateur n'a pas tranché single-file vs split. Claude décide selon le volume final : si content.ts dépasse ~600 LOC, splitter en `lib/codex/{cultures,animals,buildings,...}.ts` + un `lib/codex/index.ts` qui agrège et exporte le tableau unifié. Sinon, garder un seul fichier.

### Folded Todos

Aucun todo n'a été folded — `gsd-tools todo match-phase 16` retourne 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & exigences
- `.planning/ROADMAP.md` §Phase 16 — Goal et critères de succès
- `.planning/REQUIREMENTS.md` §Codex ferme — contenu — CODEX-01 à CODEX-05 (lignes 35-39)

### Constantes engine sources de vérité (interdiction de dupliquer)
- `lib/mascot/types.ts:309` — `CROP_CATALOG` (Cultures, inclut déjà `dropOnly?: boolean` ligne 286)
- `lib/mascot/types.ts:241` — `INHABITANTS` (Animaux + habitants fantastiques + saga exclusifs via `sagaExclusive`)
- `lib/mascot/types.ts:421` — `BUILDING_CATALOG` (Bâtiments productifs)
- `lib/mascot/craft-engine.ts:27` — `CRAFT_RECIPES` (Craft)
- `lib/mascot/tech-engine.ts:36` — `TECH_TREE` (Tech tree)
- `lib/mascot/companion-types.ts:145` — `COMPANION_SPECIES_CATALOG` (Compagnons)
- `lib/mascot/sagas-content.ts:15` — `SAGAS` (Sagas immersives)
- `lib/mascot/adventures.ts:32` — `ADVENTURES` (Quêtes coopératives)
- `lib/mascot/seasonal-events-content.ts:15` — `SEASONAL_EVENT_DIALOGUES` (Drops saisonniers & événements)

### Constantes engine pour catégorie "Loot box & raretés" (agrégation, pas de catalogue dédié)
- `lib/mascot/farm-engine.ts:13` — `GOLDEN_CROP_CHANCE = 0.03` (taux pluies dorées — CODEX-04)
- `lib/mascot/farm-engine.ts:16` — `GOLDEN_HARVEST_MULTIPLIER = 5` (multiplicateur récolte dorée)
- `lib/mascot/farm-engine.ts:213` — `HARVEST_EVENTS` (table de drops à la récolte)
- `lib/mascot/farm-engine.ts:248` — `RARE_SEED_DROP_RULES` (règles de drop graines rares)

### Infrastructure i18n
- `lib/i18n.ts` — Configuration i18next (namespaces actuels: common, gamification, help, insights, skills) — ajouter `codex`
- `locales/fr/` et `locales/en/` — Dossiers cibles pour les nouveaux fichiers `codex.json`
- `lib/__tests__/i18n.test.ts` — Test existant à étendre éventuellement

### Conventions projet
- `CLAUDE.md` §Conventions — Langue UI/commits FR, pas de hardcoded colors, etc.
- `.planning/codebase/CONVENTIONS.md` — Patterns établis (à lire si plus de détail nécessaire pendant le plan)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CropDefinition.dropOnly`** : Le flag est déjà défini dans l'engine (types.ts:286) — réutilisable tel quel pour `CropEntry`. Aucun refactor engine nécessaire.
- **`MascotInhabitant.sagaExclusive`** : Présent sur INHABITANTS — exploitable pour calculer `dropOnly` côté `AnimalEntry` au build.
- **`lib/i18n.ts`** : Stack i18next + react-i18next + expo-localization déjà en place. Ajouter un namespace `codex` est trivial (~5 lignes d'import + ajout à `resources`).
- **Pattern namespace i18n** : Tous les namespaces existants suivent `locales/{lang}/{namespace}.json`. `codex.json` respecte ce pattern.

### Established Patterns
- **Constantes engine = source unique de vérité** : Toutes les phases ferme précédentes (5-14) ont consolidé les constantes dans `lib/mascot/{type}-engine.ts` ou `types.ts`. Phase 16 doit IMPÉRATIVEMENT importer ces constantes, jamais redéfinir des valeurs (CODEX-01 + ARCH-05 zéro nouvelle dépendance).
- **Discriminated unions TS** : Le projet utilise déjà ce pattern (cf types.ts pour `MascotInhabitant`, `Saga`, etc.). `CodexEntry` s'inscrit dans la continuité.
- **i18next fallback** : Configuration actuelle gère déjà le fallback FR si une clé EN manque — donc D-18 (FR+EN dès Phase 16) reste safe même en cas de retard sur EN.

### Integration Points
- **Nouveau dossier** : `lib/codex/` n'existe pas encore — Phase 16 le crée avec `content.ts` (et éventuellement les sous-fichiers selon D-22).
- **i18n init** : `lib/i18n.ts` doit être édité pour ajouter `codex` au tableau de namespaces et importer les deux JSON FR/EN.
- **Aucun consommateur Phase 16** : `content.ts` est exporté mais aucun écran ne l'importe. Le câblage HUD ferme + modale arrive en Phase 17.

</code_context>

<specifics>
## Specific Ideas

- Style de lore visé : **Stardew Valley wiki** — descriptif immersif mais court (2-4 phrases), centré sur la fonction dans la ferme et un détail évocateur.
- Volume estimé : ~70-100 entrées au total (10-15 cultures, ~18 inhabitants, ~10 buildings, ~10 craft, ~10 tech, ~5 compagnons, plusieurs sagas/quêtes, drops saisonniers, ~5 entrées loot box).
- Le codex est généré du code, jamais éditable par l'utilisateur — décision déjà ancrée dans REQUIREMENTS.md §Out of Scope (ligne 82).

</specifics>

<deferred>
## Deferred Ideas

- **CODEX-FUT-01** (déjà documenté dans REQUIREMENTS.md ligne 72) : Mécanique "Pokédex" avec tracking de découverte par profil et statistiques de complétion — Phase future v1.3+. Phase 16 pose juste le flag `dropOnly` qui sera consommé par cette future feature.
- **Refactor engine `LOOT_TABLES`** : Extraire une constante unifiée dans farm-engine.ts pour les tables de drop — non fait en Phase 16 pour rester non-cassant. À reconsidérer si l'agrégation getter dans content.ts devient pénible à maintenir.
- **Lore audio / TTS** : Pas demandé. Si un jour souhaité, les `loreKey` i18n facilitent la génération audio par clé.
- **i18n autres langues (ES, DE, etc.)** : Out of scope projet. Le namespace `codex` est extensible si besoin.

### Reviewed Todos (not folded)
Aucun — `todo match-phase 16` a retourné 0 matches.

</deferred>

---

*Phase: 16-codex-contenu*
*Context gathered: 2026-04-08*
