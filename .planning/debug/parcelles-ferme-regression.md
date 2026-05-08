---
slug: parcelles-ferme-regression
status: fixed
trigger: FAM-22 (Linear) — Voleur de plante et d'amélioration de parcelles
created: 2026-05-08
updated: 2026-05-08
linear_issue: FAM-22
---

# Debug: Régression des parcelles de ferme

## Symptoms

- **Expected**: Les parcelles de ferme conservent leur niveau d'amélioration (dorées, double au max) et les plants qu'elles contiennent persistent entre les sessions.
- **Actual**: Une parcelle double (mega) qui était au niv 5 + autres parcelles dorées avec des plants ont régressé. La mega tombe à niv 1, et les niveaux d'expansion/mega se retrouvent appliqués à des parcelles de base.
- **Errors**: Aucune erreur runtime — corruption silencieuse au parse.
- **Timeline**: Apparu après mise à jour vers le commit 691f0964 (Phase 53, "fix(ferme): index stable des parcelles invariant au stade d'arbre"), à la première lecture du fichier `farm-{id}.md` (sentinel `farm_data_v: 2` absent → migration auto déclenchée).
- **Reproduction**: Fichier `farm-{id}.md` pré-Phase 53 avec `plot_levels` long (≥ 17 entrées, typique pour stade ≤ majestueux + tech expansion-2/3) → parseFarmProfile lance la migration avec un `inferredBaseCount` erroné.

## Current Focus

- hypothesis: ✅ Confirmée — Heuristique `inferredBaseCount` du bloc migration Phase 53 (lib/parser.ts:944) fausse pour les arbres < légendaire.
- next_action: Corriger la migration pour utiliser le vrai `baseCount` (passer treeStage en argument) + ajouter tests + recovery pour vaults déjà corrompus.

## Evidence

- timestamp: 2026-05-08 (analyse statique)
  observation: lib/parser.ts:943-946 calcule `inferredBaseCount = Math.max(0, Math.min(12, rawPlotLevels.length - expCount - (hasMega ? 1 : 0)))`. L'heuristique présume que le tableau pré-Phase 53 était tightement empaqueté (length = baseCount + expCount + hasMega).
- timestamp: 2026-05-08
  observation: Pre-Phase 53, `upgradePlot()` (lib/mascot/farm-engine.ts) initialisait via `Array(maxPlots).fill(1)` et `useFarm.ts` (commit 691f0964^) passait `maxPlots = getUnlockedPlotCount(treeStage) + 10`. Donc le tableau sérialisé avait toujours length ≥ baseCount + 10 (rembourrage de 1s), JAMAIS la longueur tightement empaquetée que présume la migration.
- timestamp: 2026-05-08
  observation: Pre-Phase 53, l'index plotIndex utilisé par WorldGridView (commit 691f0964^:components/mascot/WorldGridView.tsx:808-887) était le rang positionnel dans `[...unlockedCrops, ...unlockedExpansionCrops, megaCell]`. Donc mega plotIndex = baseCount(treeStage) + expCount.

### Reproduction step-by-step (cas user FAM-22)

Hypothèse user : arbre stage = `arbre` (7 base), tech = `expansion-2` + `expansion-3`, mega upgradée à niv 5, base[0] upgradée à niv 3.

Pré-fix sérialisé : `plot_levels: 3,1,1,1,1,1,1,1,1,1,1,1,5,1,1,1,1` (length 17, mega à index 12).

Migration (current code) :
- `expCount = 5`, `hasMega = true`
- `inferredBaseCount = max(0, min(12, 17 - 5 - 1)) = 11` ❌ (vrai baseCount = 7)
- `trailingStart = 11`, `hasTrailing = true`
- Base loop : `migrated[0..10] = rawPlotLevels[0..10]` → bonus `migrated[0]=3` ✓ mais **migrated[7..10] reçoivent les valeurs des slots 7..10 du tableau pré-fix (qui étaient des EXPANSIONS dans l'ancien layout)** → expansion levels écrits dans des slots stables c7..c10 (= des parcelles base !)
- Expansions loop : `migrated[15..19] = rawPlotLevels[11..15]` → **migrated[16] = rawPlotLevels[12] = 5** (le niveau de la mega atterrit dans l'expansion slot c16)
- Mega : `migrated[20] = rawPlotLevels[16] = 1` → **mega reset à niv 1** ❌

Migration `farmCrops` même chose : un crop à `plotIndex = 12` (mega pré-fix) → `offset = 1 < expCount = 5` → réécrit à `FIRST_EXPANSION_STABLE_INDEX + 1 = 16`. Les plants de la mega "voyagent" vers l'expansion slot c16 (ou disparaissent si c16 n'est pas rendu pour ce stade d'arbre).

Symptôme observé identique au rapport user : "Ma parcelle double était au max" → mega niv 5 perdue ; "les autres dorées" → niveaux non-triviaux apparaissent à des stable indices c7..c10/c16 qui devraient être level 1 ; "j'avais des plants dedans" → plants de la mega remappés vers c16 (ou hors écran).

### Pourquoi le test n'a rien attrapé

`lib/__tests__/farm-parser.test.ts` ne couvre que les champs `sporee_*`. Aucun test couvre la migration `plot_levels` Phase 53 avec un tableau pré-fix réaliste (rembourré). Le commit 691f0964 a expédié sans test de migration.

## Eliminated

- ❌ Cache : confirmé que les parcelles ne sont PAS cachées (lib/vault-cache.ts exclut `farm` + `champs farm/mascot des profils`). La régression vient bien du parse du vault.
- ❌ Race save : pas de mutation impliquée — la corruption se produit dès la première lecture post-mise-à-jour.
- ❌ Saga : aucun saga ne mute `plotLevels`.
- ❌ Sérialiseur asymétrique : serializeFarmProfile (parser.ts:1137-1141) est cohérent ; problème uniquement à la migration de lecture.

## Root Cause

**Fichier**: `lib/parser.ts:944-946`

**Bug**: L'heuristique `inferredBaseCount = rawPlotLevels.length - expCount - (hasMega ? 1 : 0)` (clipée à [0, 12]) présume que le tableau pré-Phase 53 contenait exactement `baseCount + expCount + hasMega` entrées. C'est faux : pre-Phase 53, `upgradePlot()` initialisait le tableau à `Array(getUnlockedPlotCount(treeStage) + 10).fill(1)`, donc le tableau était toujours rembourré avec ≥ 10 trailing 1s.

**Conséquence** : pour tous les utilisateurs dont l'arbre n'était PAS au stade légendaire (12 base) avec mega + 5 expansions au moment du upgrade (cas où length ≥ 22 et la `Math.min(12, ...)` clippe correctement), la migration place :
- les niveaux d'expansion → dans des slots stables base (c7..c11)
- le niveau de la mega → dans un slot stable d'expansion (c16..c19)
- le slot stable mega (20) → reset à 1

Les plants subissent la même translation via le bloc `farmCrops` (parser.ts:985-1000) qui partage le même `inferredBaseCount`.

## Fix proposé

### Option A — Fix in place + recovery (recommandé)

1. **Refactorer la signature** : `parseFarmProfile(content, opts?: { treeStage?: TreeStage })`. Quand `treeStage` est fourni, calculer `baseCount = getUnlockedPlotCount(treeStage)` et l'utiliser directement (au lieu de l'heuristique). Quand absent, conserver l'heuristique actuelle pour rétro-compat (mais éventuellement améliorée).
2. **Adapter les appelants** :
   - `useFarm.ts` (lectures principales) : passer le `treeStage` dérivé du profil/gamification.
   - `quest-engine.ts` (3 sites) : pareil.
3. **Recovery** : pour les vaults déjà migrés (avec sentinel `farm_data_v: 2`) où la corruption a eu lieu, fournir un script (`scripts/farm-recover.ts`) qui :
   - Détecte les vaults où mega = 1 mais d'autres slots stables d'expansion (c16..c19) ont une valeur > 1.
   - Propose une réversion heuristique. *Ou* : ajouter un compagnon "snapshot pre-migration" en lecture future.
4. **Tests** : ajouter dans `lib/__tests__/farm-parser-migration.test.ts` :
   - Cas `arbre` (7 base) + expansions + mega niv 5 (length 17 padded) → mega reste à 20 niv 5.
   - Cas `majestueux` (9 base) + expansions + mega niv 5 (length 19 padded) → idem.
   - Cas `legendaire` (12 base, length 22+ padded) → no-op correct.
   - Cas crops à plotIndex pré-fix mega → plotIndex = 20 post-fix.

### Option B — Fix heuristique sans refactor (plus risqué)

Détecter le padding via la longueur du tableau et le nombre de slots non-1 :
- Si `length > maxPossibleTightLength` (= 12 + expCount + (hasMega ? 1 : 0)), on sait qu'on est en padding → inférer `baseCount` par la position du dernier non-1 (rightmost upgrade), en supposant que la mega (si upgradée) occupe ce slot.

C'est moins robuste et casse si la mega n'a pas été upgradée mais une parcelle base à index ≥ 5 l'a été.

### Recommandation

Option A. Étapes minimales pour FAM-22 :
1. Étendre `parseFarmProfile` avec param optionnel `treeStage`.
2. Adapter `useFarm.ts` au minimum (l'appelant principal qui déclenche la migration vivante).
3. Test de migration unitaire qui reproduit FAM-22.
4. Note de release : utilisateurs déjà touchés devront restaurer leur farm depuis sauvegarde iCloud, OU fournir script de recovery.

## Resolution

**Approche retenue** : fix d'heuristique in-place dans `parseFarmProfile` (sans refactor de signature à 50+ callsites).

**Changement** (`lib/parser.ts:939-975`) : nouvelle heuristique padded-first :
1. Cherche `padCandidate = length - 10` ∈ {3, 5, 7, 9, 12} (valeurs valides de `getUnlockedPlotCount`).
2. Tie-breaker : la valeur retenue doit être ≥ `minBase = maxNonOne - expCount - hasMega` (impossible que des slots non-1 dépassent `baseCount + expCount + hasMega` pré-Phase 53).
3. Fallback (tableau étendu) : `length - expCount - hasMega` clipée à [minBase, 12].

Cas FAM-22 (L=17, expCount=5, hasMega=true, mega upgradée index 12) :
- padCandidate = 17 - 10 = 7 ∈ {3,5,7,9,12}, et minBase = 12 - 5 - 1 = 6 ≤ 7 → retourne 7 ✓ (vrai baseCount = arbre = 7).

**Tests** (`lib/__tests__/farm-parser-migration.test.ts`) : 9 cas couvrant arbuste/arbre/majestueux/legendaire, migration crops mega + expansion, idempotence, round-trip serialize/parse, tableau vide.

**Validation** :
- `npx jest --no-coverage lib/__tests__/farm-parser-migration.test.ts` : 9/9 PASS.
- `npx tsc --noEmit` : clean.
- Tests adjacents (farm-parser, parser-auberge, market-engine-daily-deal, useFarm-wager) : tous PASS.
- `auberge-auto-tick` : 3 échecs pré-existants (vérifiés via stash sur baseline) — non liés au fix.

## Files changed

- `lib/parser.ts` (+25 / -3) — heuristique baseCount durcie
- `lib/__tests__/farm-parser-migration.test.ts` (+148 / 0) — nouveau fichier de tests

## Caveats — recovery user FAM-22

Le fix prévient les futures régressions mais **ne réparera pas automatiquement le vault déjà corrompu** de l'utilisatrice (sentinel `farm_data_v: 2` déjà stampé sur fichier corrompu → migration ne re-run pas).

Recovery possible côté user :
- Restaurer une version antérieure de `farm-{id}.md` via l'historique iCloud (Réglages iCloud → Données → Réinitialiser).
- Ou supprimer manuellement la ligne `farm_data_v: 2` dans le fichier `farm-{id}.md` du vault Obsidian, puis relancer l'app : la migration tournera à nouveau, cette fois avec l'heuristique correcte.

Note : la 2e option ne fonctionne que si `plot_levels` n'a pas été ré-écrit post-corruption (i.e., aucune nouvelle upgrade/plant depuis). Sinon → recovery iCloud.
