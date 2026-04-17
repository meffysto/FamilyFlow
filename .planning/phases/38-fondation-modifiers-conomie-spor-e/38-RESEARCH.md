# Phase 38: Fondation modifiers + économie Sporée — Research

**Researched:** 2026-04-18
**Domain:** Farm engine extension (data shape + RNG economy) — zéro UI
**Confidence:** HIGH (code local lu directement, aucune hypothèse externe)

## Summary

Phase 38 pose la fondation data/engine pour la Sporée V4 : champ `modifiers` extensible sur les plants + inventaire Sporée per-profil + 4 sources de drop (récolte / shop / expedition / cadeau onboarding). Zéro UI, zéro nouvelle dépendance. Toute la matière existe déjà dans le codebase — il s'agit essentiellement d'**étendre les shapes et les pipelines actuels** sans rien réinventer :

- Le type réel est `PlantedCrop` (pas `FarmCrop`) dans `lib/mascot/types.ts:305`. Le CSV est produit/consommé par `serializeCrops`/`parseCrops` (`lib/mascot/farm-engine.ts:225-245`), stocké dans la frontmatter-like `farm_crops:` du fichier `farm-{profileId}.md` comme **string brute** côté Profile.
- Le farm engine utilise `Math.random()` partout (pas de mulberry32). Le seul pattern seedé existant est le LCG de `getDailyExpeditionPool`. Tous les tests `farm-engine.test.ts` passent par `jest.spyOn(Math, 'random').mockReturnValueOnce(...)` — pattern à reproduire.
- Un précédent architectural idéal existe : **`farmRareSeeds`** — inventaire `{ [cropId]: count }` sérialisé `id:qty,id:qty` (`craft-engine.ts:634-650`), parsé/écrit via helpers dédiés, stocké dans `farm_rare_seeds:` de la frontmatter. L'inventaire Sporée doit réutiliser exactement ce pattern (mais dégénéré : une seule entrée `sporee:N`, ou plus simple encore un scalaire).
- `detectEvolution(oldLevel, newLevel)` (`lib/mascot/engine.ts:51-65`) détecte déjà les transitions de stade. Le cadeau onboarding s'accroche naturellement sur son retour quand `toStage === 'arbre'`.

**Primary recommendation :** ajouter un 7ᵉ champ CSV `modifiers` (JSON stringifié + **pipe-escape** caractère séparateur `|` pour échapper les `:` et `,` internes) à la ligne plant existante — c'est la voie **backward-compat stricte** (6-champs legacy = `modifiers === undefined`), sans rupture du contrat `farm_crops` de la frontmatter, et lisible à l'œil nu dans Obsidian. Stocker `sporeeCount`, `sporeeShopBoughtToday`, `sporeeShopLastResetDate`, `sporeeOnboardingGiftClaimed` comme nouveaux champs scalaires dans `farm-{profileId}.md` (même fichier, même pattern que `gift_history`/`gifts_sent_today`/`growth_sprint_until`). Bump `CACHE_VERSION: 3 → 4`.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Shape `FarmCrop.modifiers`** (MOD-01) : `modifiers?: FarmCropModifiers` optionnel ; type extensible `{ wager?: WagerModifier; graftedWith?: string }` ; absence = `undefined` (jamais `null`/`{}`) ; round-trip `serializeCrops → parseCrops` deep-equal pour plants avec ET sans modifiers
- **`WagerModifier` shape** figée dans CONTEXT : `sporeeId`, `duration` ∈ `'chill'|'engage'|'sprint'`, `multiplier` ∈ `1.3|1.7|2.5`, `appliedAt`, `sealerProfileId`, `cumulTarget?`, `cumulCurrent?` (2 derniers nullable en phase 38)
- **CACHE_VERSION** (MOD-02) bump obligatoire dans `lib/vault-cache.ts:41` avec commentaire inline
- **Inventaire** (SPOR-09) : per-profil, `sporeeCount: number` scalaire (Sporées fongibles), cap strict 10, toast français "Inventaire Sporée plein" sur overflow
- **Économie 4 sources** (SPOR-08) :
  - Récolte : 3% tier 1-3 / 8% rare / 15% expedition
  - Shop : 400 feuilles, cap 2/jour (reset minuit local), déblocage dès stade `'arbre'`
  - Expedition : 5% sur missions difficulté Pousse+
  - Cadeau : 1 Sporée à l'atteinte stade 3 `'arbre'` (transition stade 2 → stade 3)
- **Seeded RNG** (SPOR-13) : tous les rolls testables reproductiblement
- **Tests Jest fondations** : round-trip CSV / backward-compat legacy / drop rates déterministes / cap 10 / shop cap 2/jour

### Claude's Discretion
- Emplacement exact du type `FarmCropModifiers` (options : `types.ts` vs `farm-engine.ts` vs nouveau `lib/mascot/modifiers.ts`)
- Stratégie précise de sérialisation CSV (base64 vs pipe-escape vs ligne séparée) — contrainte lisibilité vault + backward-compat
- Nom exact du champ inventaire (`sporeeCount` vs `sporeeInventory` vs `wagerInventory`)
- Stratégie overflow drop (refusé pur vs conversion feuilles) — préférence : refusé pur
- Organisation des fichiers de test (nouveau fichier dédié vs extension existants)
- Pattern RNG (mulberry32 nouveau vs `Math.random()` + spy Jest — précédent existant)
- Intégration du drop dans `harvestCrop` (wrapper vs post-hook)

### Deferred Ideas (OUT OF SCOPE)
- **Phase 39** : moteur prorata, pondération famille par âge, filtre 7j, filtre domaine Tasks, snapshot matinal 23h30 (SPOR-03 à SPOR-06)
- **Phase 40** : slot "Sceller", seed picker, badge plant, validation récolte multiplier, anneau prêt à valider (MOD-03, SPOR-01, SPOR-02, SPOR-07, SPOR-11)
- **Phase 41** : tooltip onboarding one-shot, codex `wager.marathonWins`, non-régression finale (SPOR-10, SPOR-12)
- **v1.8** : Pollen de Chimère (`graftedWith`) — shape `modifiers` doit rester extensible, zéro implémentation en 38
- Pari coopératif famille (SPOR-F01), streaks (SPOR-F02), mode vacances (SPOR-F03) → v1.8+

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOD-01 | Plants supportent champ optionnel `modifiers` JSON extensible, sérialisé CSV markdown sans perte, backward-compat | Pattern 7ᵉ champ pipe-escapé dans `serializeCrops`/`parseCrops` (investigations §1) |
| MOD-02 | `CACHE_VERSION` bumpé dans `lib/vault-cache.ts:41` | Ligne 45 aujourd'hui `const CACHE_VERSION = 3` + fichier cache `vault-cache-v3.json` ligne 46 → bump vers 4 |
| SPOR-08 | 4 sources de drops Sporée (récolte 3/8/15%, shop 400🍃 cap 2/j dès arbre, expedition 5% Pousse+, cadeau stade 3) | Hook points : `useFarm.harvestCrop` (§3), `rollExpeditionLoot` (§6), `detectEvolution` (§7) |
| SPOR-09 | Inventaire capé à 10 + toast overflow | Pattern `farmRareSeeds` réutilisé (§2) + `Alert.alert` français standard |
| SPOR-13 | Suite Jest fondations (round-trip CSV, drops déterministes, cap, backward-compat) | Pattern existant `farm-engine.test.ts` (§10) — `jest.spyOn(Math, 'random')` + mock dates |

---

## Project Constraints (from CLAUDE.md)

Directives actionnables applicables à cette phase :

- **Langue** : UI/commits/commentaires en français — toasts "Inventaire Sporée plein", messages de code en FR
- **Couleurs** : `useThemeColors()` obligatoire — MAIS phase 38 zéro UI donc non applicable
- **Animations** : `react-native-reanimated` ~4.1 (jamais RN Animated) — non applicable phase 38
- **Persistance prefs** : `expo-secure-store` — à considérer pour `sporeeOnboardingGiftClaimed` si retenu device-global, mais préférence CONTEXT = per-profil dans `farm-{id}.md`
- **Type check** : `npx tsc --noEmit` obligatoire avant chaque commit (erreurs pré-existantes `MemoryEditor.tsx`, `cooklang.ts`, `useVault.ts` à ignorer)
- **Tests** : `npx jest --no-coverage` — la suite de fondations Phase 38 doit être clean
- **CACHE bump** : section Cache CLAUDE.md liste explicitement `Task, Profile base, ...` — mais **ferme/mascotte/companion/farmCrops sont EXCLUS du cache** (CLAUDE.md + `vault-cache.ts:8-12`). Néanmoins CONTEXT verrouille le bump par sécurité/cohérence.
- **Privacy** : noms génériques Lucas/Emma/Dupont dans tests et docs — appliquer dans `sporee-economy.test.ts`
- **Zéro dépendance npm nouvelle** — `expo-haptics`, `expo-secure-store`, `reanimated` déjà installés suffisent

---

## Project Skills

Répertoires `.claude/skills/` et `.agents/skills/` : **non présents** dans ce projet (vérifié via `ls`). Aucun SKILL.md à charger.

---

## Investigations détaillées

### 1. Shape actuelle `PlantedCrop` + sérialisation CSV

**Fichier :** `lib/mascot/types.ts:305-312`
```ts
export interface PlantedCrop {
  cropId: string;
  plotIndex: number;       // index de la parcelle (0-9)
  currentStage: number;    // 0 = graine, 4 = pret a recolter
  tasksCompleted: number;  // taches completees dans le stade actuel
  plantedAt: string;       // YYYY-MM-DD
  isGolden?: boolean;      // mutation doree — 3% chance a la plantation
}
```

**Sérialiseur actuel** (`lib/mascot/farm-engine.ts:225-229`) :
```ts
export function serializeCrops(crops: PlantedCrop[]): string {
  return crops
    .map(c => `${c.plotIndex}:${c.cropId}:${c.currentStage}:${c.tasksCompleted}:${c.plantedAt}:${c.isGolden ? '1' : ''}`)
    .join(',');
}
```

**Parser actuel** (`farm-engine.ts:232-245`) : split par `,` puis par `:` — 6 champs positionnels, avec queue vide pour `isGolden` non-golden.

**CONTRAINTE forte** : le champ `plantedAt` est déjà `YYYY-MM-DD` (pas d'ISO complet) — donc le `:` n'apparaît jamais dans les valeurs existantes. La virgule ne peut pas apparaître non plus (cropId est un identifier). **Ajouter un 7ᵉ champ est safe** tant qu'on garantit que son contenu n'a pas de `,` ni `:` bruts.

**Note vocabulaire CONTEXT.md** : le document parle de `serializeFarmCrops`/`parseFarmCrops` et de `FarmCrop` — les noms réels dans le code sont `serializeCrops`/`parseCrops` et `PlantedCrop`. Aligner terminologie dans le plan (ne pas renommer — trop de surface d'impact).

**Recommandation sérialisation** — **pipe-escape JSON** (option B) :

Format par plant :
```
plotIndex:cropId:currentStage:tasksCompleted:plantedAt:goldenFlag:modifiersJson
```
où `modifiersJson` est le `JSON.stringify(modifiers)` avec `,` remplacés par `|` et `:` remplacés par `§` (ou toute paire de chars ASCII safe) via helpers `encodeModifiers(obj): string` / `decodeModifiers(str): FarmCropModifiers | undefined`. Retransformation inverse au parse.

Exemple plant **sans** modifier (absence complète, pas de trailing colon) :
```
0:carrot:2:1:2026-04-18:
```
→ round-trip exact (6 fragments après split, `modifiers === undefined`).

Exemple plant **avec** wager :
```
2:tomato:1:1:2026-04-18::{"wager"§{"sporeeId"§"sp_xxx"|"duration"§"engage"|"multiplier"§1.7|"appliedAt"§"2026-04-18"|"sealerProfileId"§"parent1"}}
```
Lisible à l'œil (on voit `wager`, `duration`, `engage` clairement) — **bat largement** base64 sur la lisibilité vault. L'alternative "ligne séparée indexée par plotIndex" (option C) double le nombre de lignes, casse le pattern single-line existant et complique le parser — **déconseillée**.

**Trade-offs résumés :**

| Option | Lisibilité Obsidian | Backward-compat | Implémentation | Robustesse |
|--------|--------------------|-----------------|-----------------|------------|
| **B. 7ᵉ champ pipe-escape JSON** ⭐ | Très bonne (JSON reconnaissable) | Stricte (6 champs = legacy) | ~30 lignes | Haute (escape deterministe) |
| A. 7ᵉ champ base64 | Mauvaise (opaque) | Stricte | ~20 lignes | Très haute |
| C. Ligne séparée `## Modifiers` | Moyenne (2 passes parsing) | Bonne | ~60 lignes | Moyenne (désync possible entre les 2 lignes) |

**Garde-fou :** jamais utiliser `null` ni `{}` pour `modifiers` absents — toujours `undefined`, reflété par l'absence totale du 7ᵉ fragment après split. Si le fragment existe mais est vide string → également `undefined`.

**File refs :**
- `lib/mascot/farm-engine.ts:225-245` (à étendre)
- `lib/mascot/types.ts:305-312` (PlantedCrop à étendre avec `modifiers?`)
- `lib/__tests__/farm-engine.test.ts` existant — ajouter cas round-trip

### 2. Shape Profile — absence totale de `sporee*`/`wager*`

Vérifié par grep : **aucun** fichier `hooks/`, `lib/`, `contexts/` ne contient déjà `sporee`, `Sporée`, `wager`, `sporeeCount` ou `wagerInventory` (hors docs planning). Partir from scratch.

**Emplacement recommandé des nouveaux champs** : fichier `farm-{profileId}.md` (lu/écrit par `parseFarmProfile`/`serializeFarmProfile` dans `lib/parser.ts:613-730`). Le `FarmProfileData` se trouve typed dans `lib/types.ts` (cherché autour des lignes 617-625 : `farmCrops?: string; ... companion?: ...`).

**Nouveaux champs à ajouter au `FarmProfileData`** + parsing/serialization dans `parser.ts` :
```ts
sporeeCount?: number;                    // inventaire 0-10, default 0
sporeeShopBoughtToday?: number;          // 0-2, default 0
sporeeShopLastResetDate?: string;        // ISO YYYY-MM-DD, default ''
sporeeOnboardingGiftClaimed?: boolean;   // default false (per-profil, aligné inventaire)
```

Et dans la frontmatter :
```
sporee_count: 3
sporee_shop_bought_today: 1
sporee_shop_last_reset: 2026-04-18
sporee_onboarding_gift_claimed: true
```

**Décision nom** : `sporeeCount` (nom CONTEXT préféré). `wagerInventory` est rejeté car confus (Sporée ≠ wager — la Sporée *crée* le wager à la plantation).

**Impact VaultCache** : **aucun direct** — le cache exclut `Profile.farm*` / `companion` / `mascot*` (CLAUDE.md Cache section + `vault-cache.ts:8-12` commentaire explicite). Le ProfileCacheEntry (lignes 49-69) ne contient aucun champ farm. Donc `sporeeCount` stocké dans `farm-{id}.md` ne traverse pas le cache. **MAIS** le CONTEXT verrouille le bump `CACHE_VERSION 3 → 4` quand même (défensif, cohérence shape `PlantedCrop.modifiers`).

### 3. Intégration drop récolte

**Flow actuel `harvestCrop`** (`useFarm.ts:294-360` approx) :

1. Charge `farm-{id}.md`, parse via `parseFarmProfile` → `profile.farmCrops` (raw CSV)
2. `parseCrops(profile.farmCrops)` → `PlantedCrop[]`
3. `harvestCrop(currentCrops, plotIndex)` → `{ crops, harvestedCropId, isGolden }` (`farm-engine.ts:208-222`)
4. Met à jour `harvestInventory`, tente `rollSeedDrop(harvestedCropId)` (`farm-engine.ts:323-342`)
5. Sérialise + écrit fichier

**Stratégie recommandée** : ajouter une fonction **pure** `rollSporeeDropOnHarvest(cropId: string, cropContext: 'base'|'rare'|'expedition'): boolean` dans un nouveau fichier `lib/mascot/sporee-economy.ts`, appelée **après** `rollSeedDrop` dans `useFarm.harvestCrop`. Zéro wrapper autour de `harvestCrop` (la fonction pure reste intouchée) — **post-hook côté useFarm uniquement**. La classification `'base'|'rare'|'expedition'` se fait via les flags `dropOnly` et `expeditionExclusive` du `CROP_CATALOG`.

**Détection tier depuis `cropId`** (lecture `CROP_CATALOG` dans `lib/mascot/types.ts:331-358`) :
- `expeditionExclusive === true` → tier `'expedition'` → 15%
- `dropOnly === true` (orchidee/rose_doree/truffe/fruit_dragon) → tier `'rare'` → 8%
- sinon → tier `'base'` → 3%

Retourne un booléen (drop accepté ou non) + le caller appelle `incrementSporeeCount(profileId)` qui applique le cap 10 et retourne `{ accepted: boolean; reason?: 'inventory_full' }` pour déclencher le toast.

**Fichier à modifier :** `hooks/useFarm.ts` ~ligne 340 (après `rollSeedDrop`).

### 4. Pattern RNG seedé

**État actuel :**
- `farm-engine.ts` utilise `Math.random()` partout (plantCrop, rollHarvestEvent, rollSeedDrop)
- Tests utilisent `jest.spyOn(Math, 'random').mockReturnValueOnce(X)` — pattern fluide et bien maîtrisé (cf. `farm-engine.test.ts:61-71`)
- Seul précédent LCG seedé : `getDailyExpeditionPool` (`expedition-engine.ts:645-666`) — mais pour partage déterministe famille, pas pour drops

**Recommandation** — **NE PAS introduire mulberry32**. Réutiliser `Math.random()` + spy Jest :

```ts
// lib/mascot/sporee-economy.ts
export const SPOREE_DROP_RATES = {
  base: 0.03,
  rare: 0.08,
  expedition: 0.15,
} as const;

export function rollSporeeDropOnHarvest(tier: 'base' | 'rare' | 'expedition'): boolean {
  return Math.random() < SPOREE_DROP_RATES[tier];
}
```

Testable via `jest.spyOn(Math, 'random').mockReturnValueOnce(0.02)` → `rollSporeeDropOnHarvest('base')` retourne `true`. Reproductible à 100%. **Zéro nouvelle dépendance**, zéro complexité, aligné convention du codebase. Le mot "seed-based" du CONTEXT se traduit pragmatiquement en "testable avec spy Jest déterministe" — intention respectée sans infra supplémentaire.

Si on voulait vraiment un seed composite (`plantedAt + plotIndex + cropId`), ajouter un `mulberry32` utilitaire coûte : (a) divergence patterns farm, (b) surface nouvelle à maintenir, (c) risque de drift avec `rollSeedDrop` qui reste sur `Math.random`. **Déconseillé** sauf demande explicite planner.

### 5. Shop — layer hook/engine

**Pas de fichier shop existant pour la ferme dédié.** Le `TreeShop` composant UI consomme `BUILDING_CATALOG` et `coins` directement via `useFarm`. Pour Phase 38 (zéro UI), la logique shop Sporée vit dans :

- **Engine pur** : `lib/mascot/sporee-economy.ts` (même fichier que le drop) :
  ```ts
  export const SPOREE_SHOP_PRICE = 400;
  export const SPOREE_SHOP_DAILY_CAP = 2;
  export const SPOREE_SHOP_MIN_TREE_STAGE: TreeStage = 'arbre';

  export function canBuySporee(opts: {
    coins: number;
    treeStage: TreeStage;
    boughtToday: number;
    lastResetDate: string;
    today: string;  // YYYY-MM-DD — injecté pour testabilité
    sporeeCount: number;
  }): { ok: boolean; reason?: 'insufficient_stage'|'insufficient_coins'|'daily_cap'|'inventory_full' }

  export function applyDailyResetIfNeeded(boughtToday: number, lastResetDate: string, today: string): { boughtToday: number; lastResetDate: string }
  ```

- **Hook side** (dans `useFarm.ts` ou nouveau `useSporeeEconomy.ts`) : `buySporee(profileId)` qui orchestre `canBuySporee` + `deductCoins` + `incrementSporeeCount` + écriture vault.

**Décision organisation fichier :** créer `hooks/useSporeeEconomy.ts` (pattern existant `useExpeditions.ts`, `useGarden.ts`). Expose `buySporee`, `giftOnboardingSporee`, `tryDropSporee` (wrappée autour de `rollSporeeDropOnHarvest` + cap). N'importe pas `useFarm` — reçoit profile en paramètre, écrit directement via `vault.readFile`/`vault.writeFile`. Évite couplage circulaire.

**TreeStage détection** : lire `profile.level` → `getTreeStage(level)` (`engine.ts:10-15`). Comparaison avec `arbre` = index ≥ 3 dans `TREE_STAGE_ORDER`.

### 6. Loot expedition — drop 5% Pousse+

**Flow actuel** (`hooks/useExpeditions.ts:240-246`) :
```ts
const loot = rollExpeditionLoot(exp.difficulty, outcome);
// Distribuer le loot
```

**Difficultés éligibles** : `'pousse' | 'medium' | 'hard' | 'expert' | 'legendary'` (exclut `'easy'`). Vérifié par grep sur `expedition-engine.ts:22-497`. Le type `ExpeditionDifficulty` existe déjà.

**Stratégie recommandée** : ne **pas** modifier `rollExpeditionLoot` (garder sa signature pure pour loot items). Ajouter un second roll post-hook dans `useExpeditions.ts` juste après la ligne 244 :

```ts
import { rollSporeeDropOnExpedition } from '../lib/mascot/sporee-economy';

// ...
const loot = rollExpeditionLoot(exp.difficulty, outcome);
const gotSporee = rollSporeeDropOnExpedition(exp.difficulty);  // true si 5% et difficulty ≠ 'easy'
if (gotSporee) {
  // await tryIncrementSporeeCount(profileId) — retourne { accepted, reason }
  // si !accepted → toast "Inventaire Sporée plein"
}
```

**Engine pur à créer** :
```ts
export const SPOREE_EXPEDITION_DROP_RATE = 0.05;
export const SPOREE_EXPEDITION_ELIGIBLE: ExpeditionDifficulty[] =
  ['pousse', 'medium', 'hard', 'expert', 'legendary'];

export function rollSporeeDropOnExpedition(difficulty: ExpeditionDifficulty): boolean {
  if (!SPOREE_EXPEDITION_ELIGIBLE.includes(difficulty)) return false;
  return Math.random() < SPOREE_EXPEDITION_DROP_RATE;
}
```

### 7. Détection transition stade 2 → stade 3 (cadeau onboarding)

**Fonction existante parfaite** : `detectEvolution(oldLevel, newLevel)` (`lib/mascot/engine.ts:51-65`) retourne `{ evolved: true, fromStage: 'arbuste', toStage: 'arbre', newLevel }` lors d'un level-up qui traverse le seuil `minLevel=11` (cf. `TREE_STAGES` dans `types.ts:32-39`).

**Où s'accrocher ?** `detectEvolution` est consommée dans `hooks/useGamification.ts` (levels-up par XP) et dans `tree.tsx`. Cherché ci-dessus → présence dans `hooks/useGamification.ts`. Le bon point d'accroche est le callsite qui **detect l'évolution après gain XP** — injecter là un call `giftOnboardingSporee(profileId)` gardé par :

```ts
if (evolution.evolved && evolution.toStage === 'arbre' && !profile.sporeeOnboardingGiftClaimed) {
  await giftOnboardingSporee(profileId);  // set flag + increment sporeeCount
}
```

Le flag `sporeeOnboardingGiftClaimed: boolean` stocké dans `farm-{id}.md` (pas SecureStore) — **per-profil** conforme à la préférence CONTEXT. Couvre l'édge-case profil supprimé/recréé (le cadeau peut re-déclencher — acceptable, marginal).

**Edge-case** : si l'inventaire est plein à l'atteinte stade 3, appliquer la même règle overflow (refus + toast). Le flag `sporeeOnboardingGiftClaimed` reste à `false` → le prochain boot/récolte après avoir dépensé une Sporée déclenchera à nouveau le cadeau. **Discutable** (alternative : flag passe `true` même sur refus, cadeau "consommé" sans effet) — **trancher avec le planner**.

### 8. VaultCache — bump obligatoire mais impact nul

- `vault-cache.ts:45` → `const CACHE_VERSION = 3` → à passer à `4`
- `vault-cache.ts:46` → `const CACHE_FILE_URI = ... + 'vault-cache-v3.json'` → à passer à `'vault-cache-v4.json'` (nommage dérivé du version)
- Commentaire inline : `// v4: Phase 38 — shape PlantedCrop.modifiers + sporeeCount (frontmatter farm) — invalidation propre`
- `VaultCacheState` interface (lignes 71-98) **n'a pas besoin de modification** — farm exclu, sporeeCount vit dans frontmatter farm exclue

**Rationale du bump malgré absence directe dans VaultCacheState :** par sécurité, pour que tout device upgradé invalide son cache et rehydrate depuis les fichiers vault (y compris si un plant existant a été planté pré-migration et se ré-écrit avec modifiers après). Défensif, aligné avec le pattern systématique du projet (LoveNote Phase 34 l'a bumpé pareil — cf. STATE.md ligne 303).

### 9. Stratégie overflow (drop refusé vs feuilles fallback)

**Préférence CONTEXT = refusé pur.** Arguments supplémentaires :
- **Conversion feuilles** créerait un flux de valeur automatique — encourage à laisser l'inventaire plein pour "farmer" des feuilles. Anti-pattern gameplay.
- **Refus pur** garde la Sporée comme ressource discrète, le joueur voit clairement qu'il doit en dépenser avant de re-dropper.
- **Aucun pity timer** → simple, transparent, conforme à la philosophie "pari bienveillant" (on ne "punit" pas, on attend).

**Implémentation** : `tryIncrementSporeeCount(profileId, currentCount): Promise<{ accepted: boolean; reason?: 'inventory_full' }>` — si `currentCount >= 10`, retourne `{ accepted: false, reason: 'inventory_full' }` **sans effet secondaire** (pas d'écriture, pas de feuilles crédités). Le caller affiche le toast.

### 10. Stratégie tests

**Pattern existant `lib/__tests__/farm-engine.test.ts`** :
- 8.5KB, tests fondations plantCrop / advanceFarmCrops / harvestCrop / serializeCrops / golden
- Mock `getCurrentSeason` via `jest.mock('../mascot/seasons', ...)`
- Mock `Math.random` via `jest.spyOn(Math, 'random').mockReturnValueOnce(X)` (cf. `farm-engine.test.ts:61-71`)
- Privacy : utilise cropIds (pas de noms perso), ✅ safe

**Recommandation organisation** — **2 fichiers** :

1. **Étendre `farm-engine.test.ts`** (déjà le bon fichier) avec `describe('serializeCrops / parseCrops with modifiers')` :
   - Round-trip plant SANS modifier (legacy shape identique)
   - Round-trip plant AVEC `wager` complet (deep equal)
   - Parse legacy CSV 6-champs (pas de 7ᵉ fragment) → `modifiers === undefined`
   - Parse 7ᵉ fragment vide string → `modifiers === undefined`
   - Caractères spéciaux dans `sporeeId` (uuid avec `-`) round-trip
   - Plant avec `modifiers` + plant sans → serialize + parse → array identique

2. **Nouveau `lib/__tests__/sporee-economy.test.ts`** :
   - `rollSporeeDropOnHarvest` : 3% base / 8% rare / 15% expedition via spy `Math.random`
   - `rollSporeeDropOnExpedition` : 0% sur `easy`, 5% sur `pousse`/`medium`/`hard`/`expert`/`legendary`
   - `tryIncrementSporeeCount` : cap 10 — 9→10 accepté, 10→11 refusé `reason: 'inventory_full'`
   - `canBuySporee` : matrice conditions (stage insuffisant, feuilles insuffisantes, cap quotidien, inventaire plein)
   - `applyDailyResetIfNeeded` : today === lastReset → no-op, today > lastReset → boughtToday reset à 0
   - `giftOnboardingSporee` : déjà claimed → no-op, transition 'arbuste' → 'arbre' → increment + flag true
   - Privacy : noms profiles générique `'parent1'`, `'enfant-lucas'` — aligné CLAUDE.md

**Pattern mock date** : pour cap quotidien, injecter `today: string` en paramètre des fonctions pures (pas de `new Date()` interne) → testabilité sans mocker `Date`.

---

## Recommended File Layout

**Nouveaux fichiers** :
- `lib/mascot/sporee-economy.ts` (~150 lignes) — fonctions pures :
  - `SPOREE_DROP_RATES`, `SPOREE_SHOP_PRICE`, `SPOREE_SHOP_DAILY_CAP`, `SPOREE_SHOP_MIN_TREE_STAGE`, `SPOREE_EXPEDITION_DROP_RATE`, `SPOREE_EXPEDITION_ELIGIBLE`, `SPOREE_MAX_INVENTORY = 10`
  - `rollSporeeDropOnHarvest`, `rollSporeeDropOnExpedition`
  - `canBuySporee`, `applyDailyResetIfNeeded`
  - `classifyHarvestTier(cropId): 'base'|'rare'|'expedition'`
  - Helpers `encodeModifiers(m): string`, `decodeModifiers(s: string): FarmCropModifiers | undefined`, `type FarmCropModifiers`, `type WagerModifier`

- `hooks/useSporeeEconomy.ts` (~120 lignes) — mutations vault :
  - `buySporee(profileId)`, `giftOnboardingSporee(profileId, evolution)`, `tryIncrementSporeeCount(profileId, qty=1)`, `getSporeeState(profileId)` — read helper
  - Appelle `vault.readFile`/`writeFile` directement sur `farm-{id}.md` via `parseFarmProfile`/`serializeFarmProfile`

- `lib/__tests__/sporee-economy.test.ts` (~300 lignes) — couverture ~90%

**Fichiers à modifier** :
- `lib/mascot/types.ts` → ajouter `modifiers?: FarmCropModifiers` à `PlantedCrop` (ligne 305) + export `FarmCropModifiers`/`WagerModifier` (ou ré-export depuis sporee-economy.ts)
- `lib/mascot/farm-engine.ts:225-245` → étendre `serializeCrops`/`parseCrops` avec 7ᵉ fragment pipe-escape
- `lib/__tests__/farm-engine.test.ts` → ajouter describe block round-trip modifiers (~80 lignes)
- `lib/vault-cache.ts:45-46` → `CACHE_VERSION = 4`, fichier `vault-cache-v4.json`
- `lib/types.ts:617-625` (FarmProfileData) → ajouter 4 champs `sporeeCount?`, `sporeeShopBoughtToday?`, `sporeeShopLastResetDate?`, `sporeeOnboardingGiftClaimed?`
- `lib/parser.ts:613-730` → parseFarmProfile lit `sporee_count`, `sporee_shop_bought_today`, `sporee_shop_last_reset`, `sporee_onboarding_gift_claimed` ; serializeFarmProfile les écrit (conditionnellement sur defaults 0/''/false)
- `hooks/useFarm.ts` ~ligne 340 (post `rollSeedDrop`) → appel `tryDropSporeeOnHarvest` + toast overflow
- `hooks/useExpeditions.ts` ~ligne 244-246 → appel `rollSporeeDropOnExpedition` + cap + toast
- `hooks/useGamification.ts` — callsite `detectEvolution` (à localiser précisément au plan) → gate `giftOnboardingSporee`
- `contexts/VaultContext.tsx` / `hooks/useVault.ts` — exposer `sporeeCount`, `buySporee`, etc. via domaine hook (pattern existant 21 hooks)

**Fichiers à NE PAS toucher** :
- `lib/mascot/farm-engine.ts` fonctions `harvestCrop`, `rollSeedDrop`, `plantCrop` — signatures pures préservées
- `lib/mascot/expedition-engine.ts` — pas de modification, uniquement consommé en lecture
- UI : `tree.tsx`, components/farm/* — **zéro** modification (Phase 38 = zéro UI)
- `lib/mascot/engine.ts` `detectEvolution` — pas de modif, uniquement consommé

---

## Risk Register

| Risque | Niveau | Mitigation |
|--------|--------|-----------|
| **Breaking change CSV si 7ᵉ champ mal parsé** | Élevé | Test backward-compat explicite (6-field legacy → modifiers === undefined) ; défensif `split(':').length < 7 ? undefined : decode(parts[6])` |
| **Collision caractères dans JSON stringifié (`:` ou `,`)** | Moyen | Encoding dédié (`|` pour `,`, `§` pour `:`) + round-trip test avec cropId contenant tirets/underscores + sporeeId uuid ; **jamais** `JSON.stringify` direct sans escape |
| **Cache invalidation silencieuse au premier boot post-migration** | Faible | CACHE_VERSION bumpé → `hydrateFromCache` retourne `null` si version diffère (`vault-cache.ts:168-171`) → reload depuis vault frais, OK par design |
| **Seeded RNG reproductibilité tests** | Faible | Pattern `jest.spyOn(Math, 'random').mockReturnValueOnce(X)` déjà battle-tested dans farm-engine.test.ts, zéro nouvelle infra |
| **Overflow race (2 drops simultanés au 9ᵉ/10ᵉ)** | Très faible | App mono-thread JS, mutations farm sont sequential via `await` ; `tryIncrementSporeeCount` re-read profile **avant** increment (pattern `useFarm.plantCrop` déjà) → pas de race |
| **`detectEvolution` déclenché avant écriture flag** | Moyen | Gate check `!profile.sporeeOnboardingGiftClaimed` se fait **après re-read** du profil le plus frais — pas le Profile du VaultContext (qui peut être stale) |
| **Imports circulaires** `useSporeeEconomy` ⇄ `useFarm` | Moyen | `useSporeeEconomy` indépendant — pas d'import de `useFarm`. useFarm.harvestCrop **appelle** un helper de sporee-economy.ts, pas l'inverse |
| **Tests Jest pré-existants cassent à cause extension parseCrops** | Moyen | Les tests actuels (`farm-engine.test.ts`) utilisent `parseCrops(serializeCrops([...]))` → le round-trip reste stable tant que `modifiers === undefined` n'écrit pas de trailing `:` ; **à vérifier explicitement** dans le 1er plan |
| **`CACHE_FILE_URI` change → ancien fichier cache orphelin** | Très faible | Le fichier `vault-cache-v3.json` reste sur device mais n'est plus lu ; consomme ~100KB négligeable, auto-purgé à la prochaine installation propre. Optionnellement : `hydrateFromCache` pourrait `deleteAsync` les anciennes versions en nettoyage — hors scope 38 |
| **Plant planté pré-v1.7 re-sérialisé sans modifier → trailing `:`** | Moyen | Contrat serialize : **ne pas** append `:` si modifiers === undefined. Ne jamais produire `...goldenFlag:` ; produire `...goldenFlag` seul |

---

## Open Questions

1. **`sporeeOnboardingGiftClaimed` sur overflow au stade 3** : si l'inventaire est plein exactement au moment de la transition, le flag passe-t-il `true` (cadeau "consommé" mais perdu) ou reste-t-il `false` (retry au prochain level-up / à la prochaine récolte) ?
   - **Recommandation researcher :** rester `false` + re-tenter jusqu'à succès (transparent, aligné "zéro perte silencieuse"). À confirmer planner.

2. **Expedition outcome `'partial'`/`'failure'` donne-t-il droit au roll Sporée ?**
   - Le CONTEXT dit juste "5% sur missions Pousse+" — ne spécifie pas que `success` est requis. `rollExpeditionLoot` retourne `undefined` sur failure/partial, mais la Sporée est un drop **indépendant**.
   - **Recommandation researcher :** rouler la Sporée **toujours** (peu importe outcome) tant que difficulty ∈ Pousse+. Une mission ratée peut quand même donner une Sporée — cohérent avec "expedition = loot à part". À confirmer planner.

3. **Localisation exacte de `FarmCropModifiers` type** : `types.ts` (avec les autres types farm) vs `sporee-economy.ts` (avec sa logique) vs `lib/mascot/modifiers.ts` (extensible v1.8 Pollen) ?
   - **Recommandation researcher :** `sporee-economy.ts` pour v1.7 (pas de Pollen), ré-export depuis `types.ts` pour consommateurs transverses. Un futur `modifiers.ts` sera créé **si et seulement si** Pollen atterrit en v1.8 (anticipation mais pas overengineering).

4. **Reset quotidien shop — minuit local device vs UTC ?**
   - CONTEXT dit "minuit local device". `new Date().toISOString().slice(0, 10)` retourne UTC. **Risque** : un utilisateur UTC-4 qui achète à 22h local (= 02h UTC le lendemain) ne peut pas ré-acheter le lendemain matin.
   - **Recommandation researcher :** utiliser `new Date()` + `getFullYear`/`getMonth`/`getDate` locaux, format `YYYY-MM-DD` manuel (pattern déjà présent Phase 35 LoveNote `isRevealed`, cf. STATE.md ligne 308). À confirmer planner.

---

## RESEARCH COMPLETE

**Phase:** 38 — Fondation modifiers + économie Sporée
**Confidence:** HIGH (toutes les investigations ont été vérifiées directement dans le code source du projet)

### Key Findings
- Le type réel est `PlantedCrop` (pas `FarmCrop`), sérialisé via `serializeCrops`/`parseCrops` dans `lib/mascot/farm-engine.ts:225-245` — 6 champs `:` actuellement
- **Stratégie sérialisation recommandée** : 7ᵉ champ pipe-escape JSON (lisible Obsidian, backward-compat stricte, ~30 lignes de code)
- Farm utilise `Math.random()` + tests via `jest.spyOn(Math, 'random')` — pas besoin de mulberry32, réutiliser le pattern
- `detectEvolution` existant (`lib/mascot/engine.ts:51`) est parfaitement adapté au cadeau onboarding stade 2→3
- `farmRareSeeds` est le précédent architectural à cloner pour `sporeeCount` (frontmatter + helpers parse/serialize)
- VaultCache bump obligatoire mais impact fonctionnel nul (farm exclu du cache)
- 4 nouveaux champs profil (`sporeeCount`, `sporeeShopBoughtToday`, `sporeeShopLastResetDate`, `sporeeOnboardingGiftClaimed`) dans `farm-{id}.md`
- 2 nouveaux fichiers engine recommandés : `lib/mascot/sporee-economy.ts` (pur) + `hooks/useSporeeEconomy.ts` (mutations)

### File Created
`.planning/phases/38-fondation-modifiers-conomie-spor-e/38-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Sérialisation CSV | HIGH | Code lu directement + pattern farmRareSeeds précédent éprouvé |
| Architecture drops | HIGH | Hook points identifiés et validés (`useFarm.harvestCrop` ligne 340, `useExpeditions` ligne 244) |
| Cadeau onboarding | HIGH | `detectEvolution` existe et est parfait |
| RNG testable | HIGH | Pattern `jest.spyOn(Math, 'random')` déjà battle-tested |
| VaultCache impact | HIGH | Exclusions farm vérifiées dans `vault-cache.ts:8-12` |
| Overflow strategy | MEDIUM | Préférence CONTEXT claire mais edge-case stade 3 overflow à arbitrer |
| Reset minuit local | MEDIUM | Pattern existant Phase 35 à reproduire — à confirmer planner |

### Open Questions (4)
Voir section `## Open Questions` — toutes arbitrables par le planner, aucune ne bloque la planification.

### Ready for Planning
Research complète. Le planner dispose de :
- Shape exacte à produire (type `PlantedCrop.modifiers` + 4 champs profil)
- Fichiers précis à créer/modifier (avec numéros de ligne)
- Stratégie de sérialisation recommandée avec tradeoffs
- Découpage test clair (étendre farm-engine.test.ts + nouveau sporee-economy.test.ts)
- Risques identifiés avec mitigations
- 4 questions arbitrables à trancher en plan
