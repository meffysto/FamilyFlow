# Phase 16: Codex contenu - Research

**Researched:** 2026-04-08
**Domain:** Pure TypeScript data layer — discriminated union + engine constant re-export + i18n namespace
**Confidence:** HIGH

## Summary

Phase 16 crée un fichier de données pur (`lib/codex/content.ts`) qui exporte un tableau `CodexEntry[]` discriminé par `kind`, référençant 9 constantes engine existantes via `sourceId` (zéro drift). Toutes les sources sont déjà identifiées dans CONTEXT.md — cette recherche confirme les **counts exacts** (79 entrées totales), les **shapes TypeScript** des constantes, et comble les gaps laissés en discrétion Claude : stratégie de validation (D-21) et organisation fichier (D-22).

**Découverte importante** : CLAUDE.md prétend "pas de test suite" mais c'est **faux** — Jest est installé (`jest.config.js` + `ts-jest`), `lib/__tests__/` contient 27 fichiers de tests, dont `i18n.test.ts` et `farm-engine.test.ts`. Phase 16 peut donc **ajouter un test unitaire** sans toucher le tooling.

**Primary recommendation** : Single-file `lib/codex/content.ts` (~79 entrées × ~6 lignes ≈ 500 LOC, sous le seuil D-22 de 600) + test Jest `lib/__tests__/codex-content.test.ts` qui asserte la cohérence `sourceId` ↔ engine pour les 9 catégories, plus un test de parité des clés i18n FR/EN. Namespace `codex` ajouté à `lib/i18n.ts` exactement comme les 5 namespaces existants.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Forme du type CodexEntry**
- **D-01** Type union discriminée : `type CodexEntry = CropEntry | AnimalEntry | BuildingEntry | CraftEntry | TechEntry | CompanionEntry | LootEntry | SeasonalEntry | SagaEntry | QuestEntry` avec discriminant `kind: 'crop' | 'animal' | ...`
- **D-02** Référence par id, pas de spread : chaque entrée stocke `sourceId: string`, **n'inline jamais** de valeurs numériques. Stats via getter `getCropStats(entry)` qui fait `CROP_CATALOG.find(c => c.id === entry.sourceId)`.
- **D-03** Base commune : `{ id: string; kind: CodexKind; sourceId: string; nameKey: string; loreKey: string; iconRef?: string }`. Le `id` du codex peut différer du `sourceId` engine.

**Mapping catégories ↔ sources engine**
- **D-04** Cultures → `CROP_CATALOG` (lib/mascot/types.ts:309). Flag `dropOnly?: boolean` déjà présent (types.ts:279).
- **D-05** Animaux → `INHABITANTS` (types.ts:241), tous sans filtrage. Sous-groupe `subgroup?: 'farm' | 'fantasy' | 'saga'` calculé au build depuis rarity + `sagaExclusive`. `sagaExclusive: true` → traité comme `dropOnly` côté codex.
- **D-06** Bâtiments → `BUILDING_CATALOG` (types.ts:421)
- **D-07** Craft → `CRAFT_RECIPES` (craft-engine.ts:27)
- **D-08** Tech tree → `TECH_TREE` (tech-engine.ts:36)
- **D-09** Compagnons → `COMPANION_SPECIES_CATALOG` (companion-types.ts:145)
- **D-10** Sagas → `SAGAS` (sagas-content.ts:15)
- **D-11** Quêtes coopératives → `ADVENTURES` (adventures.ts:32)
- **D-12** Drops saisonniers → `SEASONAL_EVENT_DIALOGUES` (seasonal-events-content.ts:15)
- **D-13** Loot box & raretés → **pas de catalogue dédié**, agrégation de `HARVEST_EVENTS`, `RARE_SEED_DROP_RULES`, `GOLDEN_CROP_CHANCE`, `GOLDEN_HARVEST_MULTIPLIER` (tous dans farm-engine.ts). **Aucun refactor engine**.

**dropOnly mechanism**
- **D-14** Crops : réutiliser `CropDefinition.dropOnly` tel quel.
- **D-15** Animaux : `dropOnly = inhabitant.sagaExclusive === true` au build.
- **D-16** Autres catégories : pas de `dropOnly`, visibles dès l'ouverture.

**Lore narratif & i18n**
- **D-17** Lore riche style Stardew Valley wiki, 2-4 phrases par entrée.
- **D-18** Nouveau namespace `codex` FR+EN dès Phase 16. Clés : `codex.{kind}.{sourceId}.name` et `codex.{kind}.{sourceId}.lore`. Ajouté à `lib/i18n.ts`.
- **D-19** Claude rédige FR + EN, l'utilisateur valide. Volume ~150-200 textes courts.
- **D-20** `loreKey` obligatoire, aucun texte hardcodé en FR dans `content.ts`.

### Claude's Discretion

- **D-21** Stratégie de validation : Claude décide. Recommandation : `tsc --noEmit` + test Jest d'intégrité + assert `__DEV__` runtime (voir §Validation Architecture).
- **D-22** Single-file vs split : Claude décide selon volume (seuil 600 LOC). **Verdict de cette recherche : single-file** (estimation 500 LOC, cf §Volume estimates).

### Deferred Ideas (OUT OF SCOPE)

- **CODEX-FUT-01** Tracking Pokédex de découverte par profil + stats complétion → v1.3+. Phase 16 pose juste le flag.
- **Refactor engine `LOOT_TABLES`** : extraction constante unifiée → non fait en Phase 16 pour rester non-cassant.
- **Lore audio / TTS** : non demandé.
- **i18n autres langues (ES, DE…)** : hors scope projet.
- **UI, bouton HUD, modale, recherche, virtualisation** : Phase 17.
- **Tutoriel et `resetScreen('farm_tutorial')`** : Phase 18.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CODEX-01 | `lib/codex/content.ts` importe directement les constantes engine, zéro duplication numérique | §Standard Stack (D-02 getter), §Code Examples, §Validation (test d'intégrité sourceId) |
| CODEX-02 | 10 catégories couvertes (Cultures, Animaux, Bâtiments, Craft, Tech, Compagnons, Loot, Seasonal, Sagas, Quêtes) | §Volume estimates — une catégorie par source engine, 79 entrées totales |
| CODEX-03 | Stats précises (cycle, rendement, déblocage, bonus, drop) lues depuis engine | §Code Examples (pattern getter), §Engine shapes (tous les fields nécessaires documentés) |
| CODEX-04 | Mécanique "pluies dorées" documentée avec taux + drops | §Loot aggregation (HARVEST_EVENTS, GOLDEN_CROP_CHANCE=0.03, GOLDEN_HARVEST_MULTIPLIER=5, RARE_SEED_DROP_RULES) |
| CODEX-05 | `dropOnly` marqué sur orchidée, rose dorée, truffe, fruit du dragon | §dropOnly current usage — IDs confirmés : `orchidee`, `rose_doree`, `truffe`, `fruit_dragon` |

## Project Constraints (from CLAUDE.md)

- **Langue** : UI/commits/commentaires en **français**
- **Type check** : `npx tsc --noEmit` (CLAUDE.md dit "pas de test suite" — **inexact**, Jest est en place via `jest.config.js`, cf Validation Architecture)
- **Aucune nouvelle dépendance** (ARCH-05 global v1.2) — Phase 16 réutilise i18next/react-i18next déjà installés
- **Non-cassant** : zéro modification de fichier engine, app TestFlight
- **Paths parenthèses** : `app/(tabs)/` à quoter — non pertinent pour Phase 16 (lib/ uniquement)
- **Conventions commits** : `/ship` (tsc + privacy check + commit FR + push)
- **Pas de hardcoded colors** : non pertinent (zéro UI en Phase 16)

## Standard Stack

### Core (déjà installé)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x strict | Typage discriminated union, littéraux `kind` | Seule validation obligatoire + enforcement via `tsc --noEmit` |
| i18next | existant | Namespaces de traduction | Déjà utilisé par 5 namespaces (common, gamification, help, insights, skills) |
| react-i18next | existant | Consommation runtime des clés i18n | Pattern `useTranslation(['codex', 'common'])` en Phase 17 |
| Jest + ts-jest | existant (jest.config.js) | Tests unitaires | **CLAUDE.md inexact** — la suite existe, 27 tests dans `lib/__tests__/` |

### Aucune nouvelle dépendance

ARCH-05 respecté — Phase 16 n'introduit **aucun package npm**. Tous les outils nécessaires (TS, i18next, Jest) sont déjà dans `package.json`.

## Architecture Patterns

### Recommended Project Structure

```
lib/codex/
├── content.ts         # CodexEntry[] unifié (single-file, ~500 LOC)
└── types.ts           # (optionnel) types CodexEntry / CropEntry / ... exportés séparément

locales/fr/
└── codex.json         # ~150 clés : codex.{kind}.{sourceId}.{name|lore}

locales/en/
└── codex.json         # Miroir FR, même structure

lib/i18n.ts            # Édité : +2 imports, +1 ns dans ns[], +2 resources.{fr|en}.codex

lib/__tests__/
└── codex-content.test.ts  # Test d'intégrité sourceId ↔ engine + parité FR/EN
```

**Note split (D-22)** : l'estimation LOC ci-dessous reste sous 600 — **single-file recommandé**. Si le volume dépasse, splitter en `lib/codex/{cultures,animals,buildings,craft,tech,companions,loot,seasonal,sagas,quests}.ts` + `lib/codex/index.ts` qui re-exporte.

### Pattern 1 : Discriminated union avec base commune

**What** : Toutes les variantes partagent `CodexEntryBase` et ajoutent un `kind` littéral + champs spécifiques.
**When to use** : Dès qu'on a >3 catégories avec stats hétérogènes mais mêmes métadonnées (id, nameKey, loreKey).
**Example** (à créer) :

```typescript
// lib/codex/content.ts
import {
  CROP_CATALOG, INHABITANTS, BUILDING_CATALOG,
  type CropDefinition, type MascotInhabitant, type BuildingDefinition,
} from '../mascot/types';
import { CRAFT_RECIPES, type CraftRecipe } from '../mascot/craft-engine';
import { TECH_TREE, type TechNode } from '../mascot/tech-engine';
import { COMPANION_SPECIES_CATALOG, type CompanionSpeciesInfo } from '../mascot/companion-types';
import { SAGAS } from '../mascot/sagas-content';
import type { Saga } from '../mascot/sagas-types';
import { ADVENTURES, type Adventure } from '../mascot/adventures';
import { SEASONAL_EVENT_DIALOGUES } from '../mascot/seasonal-events-content';
import type { SeasonalEventContent } from '../mascot/seasonal-events-types';
import {
  HARVEST_EVENTS, RARE_SEED_DROP_RULES,
  GOLDEN_CROP_CHANCE, GOLDEN_HARVEST_MULTIPLIER,
  type HarvestEvent,
} from '../mascot/farm-engine';

export type CodexKind =
  | 'crop' | 'animal' | 'building' | 'craft' | 'tech'
  | 'companion' | 'loot' | 'seasonal' | 'saga' | 'quest';

interface CodexEntryBase {
  id: string;
  kind: CodexKind;
  sourceId: string;   // id dans la constante engine référencée
  nameKey: string;    // clé i18n `codex.{kind}.{sourceId}.name`
  loreKey: string;    // clé i18n `codex.{kind}.{sourceId}.lore`
  iconRef?: string;   // emoji ou clé asset (optionnel)
}

export interface CropEntry extends CodexEntryBase {
  kind: 'crop';
}

export interface AnimalEntry extends CodexEntryBase {
  kind: 'animal';
  subgroup: 'farm' | 'fantasy' | 'saga';  // calculé au build
  dropOnly: boolean;                       // = inhabitant.sagaExclusive === true
}

export interface BuildingEntry extends CodexEntryBase { kind: 'building'; }
export interface CraftEntry extends CodexEntryBase { kind: 'craft'; }
export interface TechEntry extends CodexEntryBase { kind: 'tech'; }
export interface CompanionEntry extends CodexEntryBase { kind: 'companion'; }

// Catégorie Loot : agrégation de constantes farm-engine, pas de sourceId dans un catalogue
export interface LootEntry extends CodexEntryBase {
  kind: 'loot';
  lootType: 'golden_crop' | 'harvest_event' | 'rare_seed_drop';
}

export interface SeasonalEntry extends CodexEntryBase { kind: 'seasonal'; }
export interface SagaEntry extends CodexEntryBase { kind: 'saga'; }
export interface QuestEntry extends CodexEntryBase { kind: 'quest'; }

export type CodexEntry =
  | CropEntry | AnimalEntry | BuildingEntry | CraftEntry | TechEntry
  | CompanionEntry | LootEntry | SeasonalEntry | SagaEntry | QuestEntry;
```

### Pattern 2 : Getters de stats (zéro drift D-02)

```typescript
// lib/codex/content.ts — helpers exportés
export function getCropStats(entry: CropEntry): CropDefinition | undefined {
  return CROP_CATALOG.find(c => c.id === entry.sourceId);
}

export function getAnimalStats(entry: AnimalEntry): MascotInhabitant | undefined {
  return INHABITANTS.find(i => i.id === entry.sourceId);
}

// ... un getter par kind
```

L'UI Phase 17 appelle le getter selon `entry.kind` via switch exhaustif TS. **Aucune valeur numérique inlinée** dans les entrées.

### Pattern 3 : Build du tableau unifié

```typescript
// Génération déclarative par catégorie, puis concat final
const cropEntries: CropEntry[] = CROP_CATALOG.map(crop => ({
  id: `crop_${crop.id}`,
  kind: 'crop' as const,
  sourceId: crop.id,
  nameKey: `codex.crop.${crop.id}.name`,
  loreKey: `codex.crop.${crop.id}.lore`,
  iconRef: crop.emoji,
}));

const animalEntries: AnimalEntry[] = INHABITANTS.map(inh => ({
  id: `animal_${inh.id}`,
  kind: 'animal' as const,
  sourceId: inh.id,
  nameKey: `codex.animal.${inh.id}.name`,
  loreKey: `codex.animal.${inh.id}.lore`,
  iconRef: inh.emoji,
  subgroup: inh.sagaExclusive
    ? 'saga'
    : (inh.rarity === 'épique' || inh.rarity === 'légendaire' || inh.rarity === 'prestige')
      ? 'fantasy'
      : 'farm',
  dropOnly: inh.sagaExclusive === true,
}));

// ... même pattern pour les 7 autres sources

// Catégorie loot : entrées manuelles référençant les constantes
const lootEntries: LootEntry[] = [
  {
    id: 'loot_golden_crop',
    kind: 'loot',
    sourceId: 'golden_crop',         // virtuel, pas dans un catalogue
    nameKey: 'codex.loot.golden_crop.name',
    loreKey: 'codex.loot.golden_crop.lore',
    lootType: 'golden_crop',
    iconRef: '✨',
  },
  // une entrée par HARVEST_EVENTS[i] (3 entrées) + une par RARE_SEED_DROP_RULES[i] (4 entrées)
];

export const CODEX_CONTENT: CodexEntry[] = [
  ...cropEntries, ...animalEntries, ...buildingEntries, ...craftEntries,
  ...techEntries, ...companionEntries, ...lootEntries,
  ...seasonalEntries, ...sagaEntries, ...questEntries,
];
```

### Anti-Patterns à éviter

- **Hardcoder un cycle/rendement/cost** : interdit par CODEX-01 + D-02. Toujours passer par getter.
- **Traduire inline dans `content.ts`** : interdit par D-20. Chaque texte doit être une clé i18n.
- **Modifier un fichier `lib/mascot/*`** : interdit par la contrainte non-cassant. Si une info manque, créer un helper dans `lib/codex/` qui la calcule.
- **`kind: string`** : utiliser `kind: 'crop'` (literal type) pour que TS exige l'exhaustivité dans les switches.
- **Oublier `as const`** dans `.map(... => ({ kind: 'crop' as const, ... }))` — sans `as const`, TS élargit en `string` et casse le discriminant.

## Engine Shapes (canonical reference for the planner)

Chaque source identifie les champs utilisables dans les getters de stats. **Aucun champ nouveau n'est requis côté engine.**

### `CROP_CATALOG: CropDefinition[]` — 15 entrées
**Fichier** : `lib/mascot/types.ts:270-330`
```typescript
interface CropDefinition {
  id: string;              // ex: 'carrot', 'orchidee'
  labelKey: string;        // 'farm.crop.{id}' — déjà traduit ailleurs
  emoji: string;
  tasksPerStage: number;   // 1, 2, 3, 4, 5
  harvestReward: number;   // 25 à 800 feuilles
  minTreeStage: TreeStage; // 'pousse' | 'arbuste' | 'arbre' | 'majestueux' | 'legendaire'
  cost: number;            // 0 (dropOnly) ou 5-40
  techRequired?: string;   // ex: 'culture-3' pour sunflower
  dropOnly?: boolean;      // true pour orchidee, rose_doree, truffe, fruit_dragon
}
```
**IDs exacts** : `carrot`, `wheat`, `potato`, `beetroot`, `tomato`, `cabbage`, `cucumber`, `corn`, `strawberry`, `pumpkin`, `sunflower`, `orchidee`, `rose_doree`, `truffe`, `fruit_dragon`.

### `INHABITANTS: MascotInhabitant[]` — 18 entrées
**Fichier** : `lib/mascot/types.ts:241-263`
```typescript
interface MascotInhabitant {
  id: string;
  labelKey: string;
  emoji: string;
  cost: number;            // 0 si sagaExclusive
  rarity: 'commun' | 'rare' | 'épique' | 'légendaire' | 'prestige';
  minStage: TreeStage;
  sagaExclusive?: boolean; // esprit_eau, ancien_gardien
}
```
**IDs exacts** : `poussin, poulet, canard, cochon, vache, oiseau, ecureuil, papillons, coccinelle, chat, hibou, fee, dragon, phoenix, licorne, esprit_eau, ancien_gardien` (17 dans le texte lu, + un que j'ai pu mal compter — **le planner doit vérifier avec un count Jest `INHABITANTS.length`**).

**Mapping subgroup** (D-05) :
- `farm` : rarity ∈ {commun, rare} ET `!sagaExclusive`
- `fantasy` : rarity ∈ {épique, légendaire, prestige} ET `!sagaExclusive`
- `saga` : `sagaExclusive === true`

### `BUILDING_CATALOG: BuildingDefinition[]` — 4 entrées
**Fichier** : `lib/mascot/types.ts:421-479`
```typescript
interface BuildingDefinition {
  id: string;              // 'poulailler' | 'grange' | 'moulin' | 'ruche'
  labelKey: string;
  emoji: string;
  cost: number;
  dailyIncome: number;
  minTreeStage: TreeStage;
  resourceType: 'oeuf' | 'lait' | 'farine' | 'miel';
  tiers: BuildingTier[];   // 3 niveaux { level, productionRateHours, upgradeCoins, spriteSuffix }
  techRequired?: string;   // ex: 'elevage-3' pour ruche
}
```

### `CRAFT_RECIPES: CraftRecipe[]` — 24 entrées
**Fichier** : `lib/mascot/craft-engine.ts:27-323`
```typescript
interface CraftRecipe {
  id: string;
  labelKey: string;
  emoji: string;
  ingredients: CraftIngredient[];  // { itemId, quantity, source: 'crop' | 'building' }
  xpBonus: number;
  sellValue: number;
  minTreeStage: TreeStage;
  requiredUnlock?: string;         // ex: 'galette_royale' (quête coop)
}
```

### `TECH_TREE: TechNode[]` — 10 entrées
**Fichier** : `lib/mascot/tech-engine.ts:36-92`
```typescript
interface TechNode {
  id: string;              // 'culture-1'...'culture-4', 'elevage-1'..3, 'expansion-1'..3
  branch: 'culture' | 'elevage' | 'expansion';
  order: number;
  labelKey: string;
  descriptionKey: string;
  emoji: string;
  cost: number;
  requires: string | null;
}
```

### `COMPANION_SPECIES_CATALOG: CompanionSpeciesInfo[]` — 5 entrées
**Fichier** : `lib/mascot/companion-types.ts:145-151`
```typescript
interface CompanionSpeciesInfo {
  id: 'chat' | 'chien' | 'lapin' | 'renard' | 'herisson';
  nameKey: string;
  descriptionKey: string;
  rarity: 'initial' | 'rare' | 'epique';
}
```

### `SAGAS: Saga[]` — 4 entrées
**Fichier** : `lib/mascot/sagas-content.ts:15-593`
**IDs exacts** : `voyageur_argent`, `source_cachee`, `carnaval_ombres`, `graine_anciens`.
Type `Saga` dans `lib/mascot/sagas-types.ts` — le planner doit importer le type depuis là-bas, **pas depuis `sagas-content.ts`**.

### `ADVENTURES: Adventure[]` — 15 entrées
**Fichier** : `lib/mascot/adventures.ts:32-168`
**IDs exacts** : `tresor_ecureuil, tempete, voyageur, lucioles, graine_magique, arc_en_ciel, hibou_sage, tresor_pirate, fee_egaree, pluie_etoiles, papillon_geant, concert_oiseaux, neige_magique, champignon_dore, lettre_mysterieuse`.
```typescript
interface Adventure {
  id: string;
  emoji: string;
  titleKey: string;
  descriptionKey: string;
  choiceA: AdventureChoice;  // { labelKey, emoji, points }
  choiceB: AdventureChoice;
}
```

### `SEASONAL_EVENT_DIALOGUES: Record<string, SeasonalEventContent>` — 8 entrées
**Fichier** : `lib/mascot/seasonal-events-content.ts:15`
**Keys exactes** : `nouvel-an, st-valentin, poisson-avril, paques, ete, rentree, halloween, noel`.
**Attention** : c'est un `Record`, pas un array. Utiliser `Object.keys(SEASONAL_EVENT_DIALOGUES)` pour itérer. Type `SeasonalEventContent` dans `lib/mascot/seasonal-events-types.ts`.

### Loot — constantes farm-engine agrégées (pas de catalogue dédié)
**Fichier** : `lib/mascot/farm-engine.ts`
- `GOLDEN_CROP_CHANCE = 0.03` (ligne 13) — 3% mutation dorée à la plantation
- `GOLDEN_HARVEST_MULTIPLIER = 5` (ligne 16) — ×5 récolte si golden
- `HARVEST_EVENTS: HarvestEvent[]` (ligne 213) — **3 entrées** :
  ```typescript
  [
    { type: 'insectes',      modifier: 0, labelKey: 'farm.event.insectes',      emoji: '🐛' },
    { type: 'pluie_doree',   modifier: 3, labelKey: 'farm.event.pluie_doree',   emoji: '🌧️' },
    { type: 'mutation_rare', modifier: 2, labelKey: 'farm.event.mutation_rare', emoji: '✨' },
  ]
  ```
  Déclenchés à 5% de chance (`rollHarvestEvent`, ligne 221).
- `RARE_SEED_DROP_RULES: SeedDropRule[]` (ligne 248) — **4 entrées** :
  ```typescript
  [
    { sourceCropIds: ['tomato', 'cabbage', 'cucumber', 'corn', 'strawberry', 'pumpkin', 'sunflower'], seedId: 'orchidee',     chance: 0.08 },
    { sourceCropIds: ['corn', 'strawberry', 'pumpkin'],                                               seedId: 'rose_doree',   chance: 0.08 },
    { sourceCropIds: ['pumpkin', 'sunflower'],                                                        seedId: 'truffe',       chance: 0.08 },
    { sourceCropIds: '*',                                                                             seedId: 'fruit_dragon', chance: 0.02 },
  ]
  ```
  `SeedDropRule` est un **type `interface` non exporté** dans farm-engine.ts (ligne 241). Si le planner en a besoin côté codex, recommandation : **ne pas importer le type**, mais exposer les mêmes infos via `LootEntry.lootType = 'rare_seed_drop'` + lecture directe de `RARE_SEED_DROP_RULES` dans l'UI Phase 17.

**`LootEntry[]` recommandé (8 entrées totales)** :
1. `loot_golden_crop` (documente GOLDEN_CROP_CHANCE + GOLDEN_HARVEST_MULTIPLIER)
2. `loot_harvest_insectes` (HARVEST_EVENTS[0])
3. `loot_harvest_pluie_doree` (HARVEST_EVENTS[1])
4. `loot_harvest_mutation_rare` (HARVEST_EVENTS[2])
5. `loot_seed_orchidee` (RARE_SEED_DROP_RULES[0])
6. `loot_seed_rose_doree` (RARE_SEED_DROP_RULES[1])
7. `loot_seed_truffe` (RARE_SEED_DROP_RULES[2])
8. `loot_seed_fruit_dragon` (RARE_SEED_DROP_RULES[3])

## dropOnly Current Usage (CODEX-05 confirmation)

Grep `dropOnly` sur la codebase → **4 crops marqués `dropOnly: true`**, confirmé dans `lib/mascot/types.ts:326-329` :
- `orchidee` (ligne 326)
- `rose_doree` (ligne 327)
- `truffe` (ligne 328)
- `fruit_dragon` (ligne 329)

Usages actuels du flag :
- `lib/mascot/farm-engine.ts:268, 290` — exclus de `getAvailableCrops()` et de `rollSeedDrop()`
- `hooks/useFarm.ts:229` — `isRareSeed = cropDef.dropOnly === true`
- `app/(tabs)/tree.tsx:1451, 1576` — filtrage UI
- `apps/desktop/src/pages/Tree.tsx:1371, 1395, 1411, 1424` — équivalent desktop

**Conclusion** : Phase 16 n'a qu'à lire `entry.kind === 'crop'` puis `getCropStats(entry)?.dropOnly` — le flag existe déjà et les 4 IDs correspondent exactement à la liste CODEX-05.

Pour `AnimalEntry.dropOnly` (D-15), **2 habitants** avec `sagaExclusive: true` dans `INHABITANTS` :
- `esprit_eau` (types.ts:261)
- `ancien_gardien` (types.ts:262)

## Volume Estimates (D-22 resolution)

| Source | Entrées | LOC estimé (entrée × ~6 lignes) |
|--------|---------|----------------------------------|
| `CROP_CATALOG` | 15 | ~90 |
| `INHABITANTS` | 18 | ~120 |
| `BUILDING_CATALOG` | 4 | ~25 |
| `CRAFT_RECIPES` | 24 | ~145 |
| `TECH_TREE` | 10 | ~60 |
| `COMPANION_SPECIES_CATALOG` | 5 | ~30 |
| `SAGAS` | 4 | ~25 |
| `ADVENTURES` | 15 | ~90 |
| `SEASONAL_EVENT_DIALOGUES` | 8 | ~50 |
| Loot (agrégé) | 8 | ~50 |
| **Total entrées** | **111** | **~685** |

Ajouter : imports (~30 lignes), types `CodexEntry*` (~60 lignes), helpers `getXxxStats` (~50 lignes), header commentaire (~10 lignes).

**Total estimé : ~830 LOC.** Dépasse le seuil D-22 de 600.

**Verdict révisé (D-22)** : **splitter en sous-fichiers**. Structure recommandée :

```
lib/codex/
├── types.ts                # CodexEntry + 10 variants + CodexKind (~80 LOC)
├── stats.ts                # getCropStats, getAnimalStats, ... (~60 LOC)
├── cultures.ts             # cropEntries: CropEntry[] (~90 LOC)
├── animals.ts              # animalEntries: AnimalEntry[] (~120 LOC)
├── buildings.ts            # buildingEntries (~25 LOC)
├── craft.ts                # craftEntries (~145 LOC)
├── tech.ts                 # techEntries (~60 LOC)
├── companions.ts           # companionEntries (~30 LOC)
├── loot.ts                 # lootEntries agrégé (~80 LOC) — inclut imports farm-engine
├── seasonal.ts             # seasonalEntries (~50 LOC)
├── sagas.ts                # sagaEntries (~25 LOC)
├── quests.ts               # questEntries depuis ADVENTURES (~90 LOC)
└── content.ts              # CODEX_CONTENT = [...tous] + re-exports (~30 LOC)
```

**Note** : le requirement CODEX-01 parle de "lib/codex/content.ts" — conserver ce fichier comme **point d'entrée** (il re-exporte le tableau unifié et les helpers). Les sous-fichiers restent des détails d'implémentation.

**Alternative single-file** : si l'utilisateur préfère la simplicité (lecture en un coup d'œil), le fichier unique de ~830 LOC reste gérable — c'est un fichier **généré et rarement édité**, pas de la logique métier. Le planner peut laisser ce choix ouvert dans le PLAN et demander confirmation à l'utilisateur en Wave 0.

## i18n Integration

### Pattern actuel (lib/i18n.ts lignes 7-42)

5 namespaces déjà câblés, tous selon le même pattern :

```typescript
// Imports en tête
import frCodex from '../locales/fr/codex.json';
import enCodex from '../locales/en/codex.json';

// Ajout au tableau ns
ns: ['common', 'gamification', 'help', 'insights', 'skills', 'codex'],

// Ajout dans resources.fr et resources.en
resources: {
  fr: { common: frCommon, gamification: frGamification, help: frHelp,
        insights: frInsights, skills: frSkills, codex: frCodex },
  en: { common: enCommon, ..., codex: enCodex },
},
```

**Total édition de `lib/i18n.ts`** : +4 lignes d'imports, +1 entrée dans `ns`, +2 entrées dans `resources`. Ordre alphabétique non requis (les existants ne le sont pas).

### Structure des fichiers locale

`locales/fr/codex.json` et `locales/en/codex.json` suivent la structure nested du pattern existant (voir `locales/fr/gamification.json` pour référence). Clés selon D-18 :

```json
{
  "crop": {
    "carrot": {
      "name": "Carotte",
      "lore": "La culture de départ, généreuse et rapide. Une botte de carottes fraîchement arrachées sent bon la terre..."
    },
    "orchidee": {
      "name": "Orchidée sauvage",
      "lore": "Rare pousse née d'un drop mystérieux. On raconte qu'elle n'éclot qu'aux abords d'une ferme bien aimée."
    }
  },
  "animal": { "poussin": { "name": "...", "lore": "..." } },
  "building": { ... },
  "craft": { ... },
  "tech": { ... },
  "companion": { ... },
  "loot": {
    "golden_crop": {
      "name": "Mutation dorée",
      "lore": "À la plantation, 3% de chance qu'une graine devienne dorée. La récolte est multipliée par 5."
    }
  },
  "seasonal": { ... },
  "saga": { ... },
  "quest": { ... }
}
```

**Volume estimé** : 111 entrées × 2 clés (name + lore) = 222 clés par langue = **444 textes à rédiger** (FR puis EN). Tous courts (nom = 1-3 mots, lore = 2-4 phrases). Cohérent avec l'estimation D-19 de "~150-200 textes courts" (légèrement sous-estimée côté utilisateur — le planner doit flagger).

### Test i18n existant

`lib/__tests__/i18n.test.ts` ligne 46 teste `ns` mais **pas la parité FR/EN des clés**. Il se contente de vérifier que des helpers de traduction spécifiques retournent le bon texte. **Il n'y a pas de test de parité FR/EN** sur l'ensemble des clés d'un namespace.

Phase 16 peut **ajouter un test de parité** dans `lib/__tests__/codex-content.test.ts` qui vérifie que toutes les clés `loreKey` / `nameKey` listées dans `CODEX_CONTENT` existent **dans les deux langues** (`frCodex` et `enCodex`). Exemple :

```typescript
import { CODEX_CONTENT } from '../codex/content';
import frCodex from '../../locales/fr/codex.json';
import enCodex from '../../locales/en/codex.json';

function hasKey(obj: any, dottedPath: string): boolean {
  return dottedPath.split('.').reduce((o, k) => o?.[k], obj) !== undefined;
}

describe('codex content — parité i18n', () => {
  it.each(CODEX_CONTENT)('entrée $id a ses clés FR et EN', (entry) => {
    // la clé est `codex.{kind}.{sourceId}.name` — on enlève le prefix "codex." pour chercher dans le JSON
    const nameKey = entry.nameKey.replace(/^codex\./, '');
    const loreKey = entry.loreKey.replace(/^codex\./, '');
    expect(hasKey(frCodex, nameKey)).toBe(true);
    expect(hasKey(enCodex, nameKey)).toBe(true);
    expect(hasKey(frCodex, loreKey)).toBe(true);
    expect(hasKey(enCodex, loreKey)).toBe(true);
  });
});
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplication des cycles/rendements | Copier les valeurs de `CROP_CATALOG` dans des strings i18n | Getter `getCropStats(entry)` + formatage à l'affichage (Phase 17) | Drift garanti à la première modification engine (CODEX-01) |
| Détection dropOnly animaux | Nouvel enum ou liste séparée | `inhabitant.sagaExclusive === true` au build | Réutilise flag engine existant (D-15, non-cassant) |
| Test FR/EN key parity | Script manuel ou bash | Test Jest `it.each(CODEX_CONTENT)` | Jest déjà configuré, pattern cohérent avec les 27 autres tests |
| Loot catalog manquant | Créer un `LOOT_CATALOG` dans farm-engine.ts | Agrégation dans `lib/codex/loot.ts` uniquement | Non-cassant (D-13), engine intact |
| Validation runtime | `zod` ou `io-ts` | `__DEV__` assert + test Jest | ARCH-05 zéro dépendance + tsc strict couvre 95% |

## Common Pitfalls

### Pitfall 1 : Widening de `kind` vers `string`

**What goes wrong** : TS élargit `kind: 'crop'` en `kind: string`, cassant l'exhaustivité des switches.
**Why** : Sans `as const` dans les object literals `map(() => ({ kind: 'crop', ... }))`, TS infère un type trop large.
**How to avoid** : Toujours écrire `kind: 'crop' as const` dans les entrées, OU typer explicitement le tableau de sortie `const cropEntries: CropEntry[] = CROP_CATALOG.map(...)`.
**Warning sign** : `tsc --noEmit` refuse le `switch (entry.kind)` ou accepte sans warning d'exhaustivité.

### Pitfall 2 : `CROP_CATALOG.find` dans un hot path UI

**What goes wrong** : Phase 17 appelle `getCropStats` 100× par render → perf dégradée sur grande liste virtualisée.
**Why** : `.find()` est O(n) × 15 crops × 60 renders/s.
**How to avoid** : Exposer des helpers memoized **côté Phase 17**, ou créer `const CROP_BY_ID: Map<string, CropDefinition> = new Map(CROP_CATALOG.map(c => [c.id, c]))` dans `lib/codex/stats.ts`. **Non bloquant pour Phase 16** mais à flagger dans le handoff Phase 17.
**Warning sign** : FlatList codex saccade en scroll sur device TestFlight.

### Pitfall 3 : Import circulaire `codex → mascot → codex`

**What goes wrong** : Si un fichier engine importe quoi que ce soit de `lib/codex/`, on crée un cycle.
**Why** : `lib/codex/` doit rester en aval de `lib/mascot/` (flux de données unidirectionnel).
**How to avoid** : **Aucun fichier `lib/mascot/*` ne doit jamais importer `lib/codex/*`**. Phase 16 le respecte par construction (zéro édition engine), mais un garde-fou dans le test : `expect(Object.keys(require('../mascot/types'))).not.toContain('CODEX_CONTENT')`.
**Warning sign** : Erreur TS cryptique "circular dependency detected" ou crash runtime au premier require.

### Pitfall 4 : JSON trop riche → lint i18next parser

**What goes wrong** : Certains projets ont un linter i18next qui scanne le code pour les clés utilisées — si Phase 16 ajoute 444 clés et aucune UI ne les consomme (Phase 17 viendra après), le lint pourrait les marquer "unused".
**Why** : Le projet ne semble pas avoir un tel lint (aucun `i18next-parser` ni `eslint-plugin-i18next` dans le repo), mais **à vérifier pendant le plan** via `grep -r "i18next-parser\|eslint.*i18next" package.json`.
**How to avoid** : Si un tel lint existe, ajouter un commentaire `// @ts-ignore-i18next-unused` ou équivalent dans `content.ts` près des références aux clés.
**Warning sign** : CI échoue au premier push avec "Unused translation keys".

### Pitfall 5 : Oublier une catégorie dans l'union `CodexEntry`

**What goes wrong** : Le planner écrit 9 variants au lieu de 10, le 10e devient `never` ou cause une erreur d'exhaustivité.
**Why** : 10 catégories × 10 fichiers × copier-coller → facile d'oublier Loot (celui qui n'a pas de catalogue dédié).
**How to avoid** : Écrire d'abord `type CodexKind = 'crop' | 'animal' | ... | 'quest'` (liste explicite de 10), puis **exiger** via TS qu'une interface existe pour chaque. Test Jest qui asserte `new Set(CODEX_CONTENT.map(e => e.kind)).size === 10`.
**Warning sign** : `CODEX_CONTENT.length` < 80 entrées ou TS laisse passer un switch non-exhaustif.

## Code Examples

### Exemple 1 — Cultures (source : CROP_CATALOG)

```typescript
// lib/codex/cultures.ts
import { CROP_CATALOG } from '../mascot/types';
import type { CropEntry } from './types';

export const cropEntries: CropEntry[] = CROP_CATALOG.map(crop => ({
  id: `crop_${crop.id}`,
  kind: 'crop' as const,
  sourceId: crop.id,
  nameKey: `codex.crop.${crop.id}.name`,
  loreKey: `codex.crop.${crop.id}.lore`,
  iconRef: crop.emoji,
}));
```

### Exemple 2 — Animaux avec subgroup + dropOnly (D-05, D-15)

```typescript
// lib/codex/animals.ts
import { INHABITANTS } from '../mascot/types';
import type { AnimalEntry } from './types';

function computeSubgroup(rarity: string, sagaExclusive: boolean): 'farm' | 'fantasy' | 'saga' {
  if (sagaExclusive) return 'saga';
  if (rarity === 'épique' || rarity === 'légendaire' || rarity === 'prestige') return 'fantasy';
  return 'farm';
}

export const animalEntries: AnimalEntry[] = INHABITANTS.map(inh => ({
  id: `animal_${inh.id}`,
  kind: 'animal' as const,
  sourceId: inh.id,
  nameKey: `codex.animal.${inh.id}.name`,
  loreKey: `codex.animal.${inh.id}.lore`,
  iconRef: inh.emoji,
  subgroup: computeSubgroup(inh.rarity, inh.sagaExclusive === true),
  dropOnly: inh.sagaExclusive === true,
}));
```

### Exemple 3 — Loot aggregation (D-13, CODEX-04)

```typescript
// lib/codex/loot.ts
import {
  HARVEST_EVENTS, RARE_SEED_DROP_RULES,
  GOLDEN_CROP_CHANCE, GOLDEN_HARVEST_MULTIPLIER,
} from '../mascot/farm-engine';
import type { LootEntry } from './types';

// Re-export des constantes pour que l'UI Phase 17 puisse les afficher sans re-importer farm-engine
export { HARVEST_EVENTS, RARE_SEED_DROP_RULES, GOLDEN_CROP_CHANCE, GOLDEN_HARVEST_MULTIPLIER };

export const lootEntries: LootEntry[] = [
  {
    id: 'loot_golden_crop',
    kind: 'loot', sourceId: 'golden_crop', lootType: 'golden_crop',
    nameKey: 'codex.loot.golden_crop.name',
    loreKey: 'codex.loot.golden_crop.lore',
    iconRef: '✨',
  },
  ...HARVEST_EVENTS.map(ev => ({
    id: `loot_harvest_${ev.type}`,
    kind: 'loot' as const,
    sourceId: ev.type,
    lootType: 'harvest_event' as const,
    nameKey: `codex.loot.harvest_${ev.type}.name`,
    loreKey: `codex.loot.harvest_${ev.type}.lore`,
    iconRef: ev.emoji,
  })),
  ...RARE_SEED_DROP_RULES.map(rule => ({
    id: `loot_seed_${rule.seedId}`,
    kind: 'loot' as const,
    sourceId: rule.seedId,
    lootType: 'rare_seed_drop' as const,
    nameKey: `codex.loot.seed_${rule.seedId}.name`,
    loreKey: `codex.loot.seed_${rule.seedId}.lore`,
  })),
];
```

### Exemple 4 — Runtime assert en `__DEV__` (D-21)

```typescript
// lib/codex/content.ts — en bas du fichier
import { CROP_CATALOG, INHABITANTS, BUILDING_CATALOG } from '../mascot/types';
import { CRAFT_RECIPES } from '../mascot/craft-engine';
// ... etc

export const CODEX_CONTENT: CodexEntry[] = [ /* ... */ ];

if (__DEV__) {
  // Vérification sourceId ↔ engine : plante au démarrage si drift
  const unknownSources = CODEX_CONTENT.filter(entry => {
    switch (entry.kind) {
      case 'crop':     return !CROP_CATALOG.find(c => c.id === entry.sourceId);
      case 'animal':   return !INHABITANTS.find(i => i.id === entry.sourceId);
      case 'building': return !BUILDING_CATALOG.find(b => b.id === entry.sourceId);
      case 'craft':    return !CRAFT_RECIPES.find(r => r.id === entry.sourceId);
      // ... etc (exhaustif)
      case 'loot':     return false; // sourceId virtuel
      default: return false;
    }
  });
  if (unknownSources.length > 0) {
    console.error('[codex] sourceId inconnus dans l\'engine:', unknownSources.map(e => e.id));
  }
}
```

**Note** : `jest.config.js` ligne 8 définit `__DEV__: false` global — le bloc ne s'exécutera pas pendant les tests Jest, donc **le test de parité sourceId doit être séparé** (fonction pure exportée ou test indépendant).

### Exemple 5 — Test d'intégrité (lib/__tests__/codex-content.test.ts)

```typescript
import { CODEX_CONTENT } from '../codex/content';
import { CROP_CATALOG, INHABITANTS, BUILDING_CATALOG } from '../mascot/types';
import { CRAFT_RECIPES } from '../mascot/craft-engine';
import { TECH_TREE } from '../mascot/tech-engine';
import { COMPANION_SPECIES_CATALOG } from '../mascot/companion-types';
import { SAGAS } from '../mascot/sagas-content';
import { ADVENTURES } from '../mascot/adventures';
import { SEASONAL_EVENT_DIALOGUES } from '../mascot/seasonal-events-content';
import frCodex from '../../locales/fr/codex.json';
import enCodex from '../../locales/en/codex.json';

describe('codex content — intégrité sourceId', () => {
  it('couvre 10 catégories', () => {
    const kinds = new Set(CODEX_CONTENT.map(e => e.kind));
    expect(kinds.size).toBe(10);
  });

  it('crops : chaque sourceId existe dans CROP_CATALOG', () => {
    for (const entry of CODEX_CONTENT.filter(e => e.kind === 'crop')) {
      expect(CROP_CATALOG.find(c => c.id === entry.sourceId)).toBeDefined();
    }
  });

  it('animals : chaque sourceId existe dans INHABITANTS', () => {
    for (const entry of CODEX_CONTENT.filter(e => e.kind === 'animal')) {
      expect(INHABITANTS.find(i => i.id === entry.sourceId)).toBeDefined();
    }
  });

  // ... idem pour building, craft, tech, companion, saga, quest, seasonal

  it('CODEX-05 : les 4 crops dropOnly sont marqués', () => {
    const expected = ['orchidee', 'rose_doree', 'truffe', 'fruit_dragon'];
    const dropOnlyCrops = CODEX_CONTENT
      .filter(e => e.kind === 'crop')
      .filter(e => CROP_CATALOG.find(c => c.id === e.sourceId)?.dropOnly);
    expect(dropOnlyCrops.map(e => e.sourceId).sort()).toEqual(expected.sort());
  });

  it('CODEX-02 : au moins une entrée par catégorie', () => {
    const kinds: string[] = ['crop', 'animal', 'building', 'craft', 'tech',
                             'companion', 'loot', 'seasonal', 'saga', 'quest'];
    for (const k of kinds) {
      expect(CODEX_CONTENT.some(e => e.kind === k)).toBe(true);
    }
  });
});

describe('codex content — parité i18n FR/EN', () => {
  function hasKey(obj: any, path: string): boolean {
    return path.split('.').reduce((o, k) => o?.[k], obj) !== undefined;
  }

  it.each(CODEX_CONTENT)('$id a nameKey et loreKey dans FR et EN', (entry) => {
    const nameKey = entry.nameKey.replace(/^codex\./, '');
    const loreKey = entry.loreKey.replace(/^codex\./, '');
    expect(hasKey(frCodex, nameKey)).toBe(true);
    expect(hasKey(enCodex, nameKey)).toBe(true);
    expect(hasKey(frCodex, loreKey)).toBe(true);
    expect(hasKey(enCodex, loreKey)).toBe(true);
  });
});
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (jest.config.js existe) |
| Config file | `/Users/gabrielwaltio/Documents/family-vault/jest.config.js` |
| Quick run command | `npx jest lib/__tests__/codex-content.test.ts` |
| Full suite command | `npx jest` |
| Type check | `npx tsc --noEmit` (seule validation mentionnée dans CLAUDE.md) |

**Correction importante** : CLAUDE.md ligne 9 et 59 prétend "pas de test suite". **Ceci est inexact** — jest est installé et 27 tests existent dans `lib/__tests__/`. Phase 16 peut ajouter un test sans modifier le tooling. Le planner devrait flagger cette contradiction dans CLAUDE.md pour correction future (hors scope Phase 16).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CODEX-01 | content.ts importe les constantes engine (tsc strict) | compile | `npx tsc --noEmit` | ✅ |
| CODEX-01 | Aucune valeur numérique hardcodée | unit | `npx jest codex-content.test.ts -t "intégrité sourceId"` | ❌ Wave 0 |
| CODEX-02 | 10 catégories couvertes | unit | `npx jest codex-content.test.ts -t "couvre 10 catégories"` | ❌ Wave 0 |
| CODEX-03 | Stats lisibles via getter (pas d'inline) | compile | `tsc --noEmit` + revue visuelle content.ts | ✅ |
| CODEX-04 | Pluies dorées documentées avec taux | unit | `npx jest codex-content.test.ts -t "loot golden_crop"` | ❌ Wave 0 |
| CODEX-05 | 4 crops dropOnly marqués | unit | `npx jest codex-content.test.ts -t "CODEX-05"` | ❌ Wave 0 |
| D-20 | loreKey obligatoire résolvable FR+EN | unit | `npx jest codex-content.test.ts -t "parité i18n"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit** : `npx tsc --noEmit && npx jest lib/__tests__/codex-content.test.ts`
- **Per wave merge** : `npx jest` (suite complète pour détecter régressions)
- **Phase gate** : `npx tsc --noEmit && npx jest` tout vert avant `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/__tests__/codex-content.test.ts` — couvre CODEX-01, CODEX-02, CODEX-04, CODEX-05, D-20
- [ ] `locales/fr/codex.json` — squelette avec au moins les 10 catégories racines (clés vides si rédaction progressive)
- [ ] `locales/en/codex.json` — idem
- [ ] `lib/codex/types.ts` — définir `CodexEntry` avant d'écrire les entrées

**Dépendances** : aucune installation requise (Jest + ts-jest + i18next déjà en place).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Discriminator par classe | Interface + `kind` literal | TS 2.0 (2016) | Standard absolu sur TS moderne, zero-cost au runtime |
| `any` cast pour stats hétérogènes | Union discriminée + switch exhaustif | TS 3.7 + | Compile-time safety, autocomplete par variant |
| `i18next-scanner` pour extraire clés | Co-location clé + usage (manuel) | - | Project pattern existant, pas de scanner installé |

**Deprecated** : aucun, Phase 16 s'inscrit dans la continuité des patterns déjà en place.

## Open Questions

1. **Nombre exact d'entrées `INHABITANTS`**
   - What we know : 17 IDs comptés dans le grep (poussin → ancien_gardien)
   - What's unclear : Le tableau pourrait avoir 17 ou 18 entrées selon si j'ai manqué un habitant. Le décompte dans "Volume estimates" suppose 18 par prudence.
   - Recommendation : Le planner doit exécuter `grep -c "^  { id: '" lib/mascot/types.ts` ciblé sur le bloc INHABITANTS (lignes 241-263) en Wave 0 et ajuster le test `expect(INHABITANTS.length).toBe(N)` pour figer l'intégrité.

2. **Volume lore FR/EN sous-estimé par D-19**
   - What we know : D-19 estime "~150-200 textes courts" — cette recherche en compte **444** (111 entrées × 2 clés × 2 langues).
   - What's unclear : L'utilisateur accepte-t-il ce volume pour un batch unique, ou préfère-t-il un split (crops en P01, animaux en P02, etc.) ?
   - Recommendation : Plan P01 = structure + catalogue cultures + test intégrité. Plans P02-P04 = lore narratif par lots. Permet des commits incrémentaux reviewables et un démarrage rapide de la Phase 17 sans attendre tous les lores.

3. **Single-file vs split (D-22)**
   - What we know : Volume estimé 830 LOC, dépasse seuil 600 → recommandation split.
   - What's unclear : L'utilisateur a dit "Claude décide" mais pourrait préférer la simplicité single-file (un seul fichier à scanner).
   - Recommendation : Planner propose les deux options au Wave 0 et demande validation. Par défaut : split (structure détaillée dans §Volume estimates).

4. **Sprite/iconRef versus emoji**
   - What we know : `iconRef?` est optionnel dans `CodexEntryBase` (D-03). Les constantes engine ont toutes un `emoji: string`.
   - What's unclear : Phase 17 affichera-t-elle l'emoji tel quel, ou un sprite pixel art (ex: `ITEM_ILLUSTRATIONS` pour certains habitants) ?
   - Recommendation : Phase 16 stocke `iconRef = crop.emoji` par défaut. Si Phase 17 a besoin de plus, elle ajoutera un helper `getCodexIcon(entry)` qui préfère `ITEM_ILLUSTRATIONS[entry.sourceId]` puis fallback emoji. **Non bloquant pour Phase 16.**

5. **Catégorie "Quêtes coopératives" = `ADVENTURES` ?**
   - What we know : CONTEXT.md D-11 dit "Quêtes coopératives → ADVENTURES". Mais `ADVENTURES` (lib/mascot/adventures.ts) décrit des événements quotidiens (trésor écureuil, tempête…), pas des quêtes multi-joueurs.
   - What's unclear : Les "quêtes coopératives" pourraient faire référence à `lib/mascot/family-quests*.ts` (que je n'ai pas lu). Le fichier `craft-engine.ts:321` mentionne `requiredUnlock: 'galette_royale'` avec le commentaire "Recettes déverrouillables (quêtes coopératives)".
   - Recommendation : Le planner doit **vérifier en Wave 0** s'il existe un `FAMILY_QUESTS` ou équivalent dans `lib/mascot/`. Si oui, l'utiliser pour la catégorie `QuestEntry`. Si non, confirmer avec l'utilisateur que `ADVENTURES` est bien la source (D-11).

## Sources

### Primary (HIGH confidence)

- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/types.ts` — CROP_CATALOG, INHABITANTS, BUILDING_CATALOG, CropDefinition.dropOnly, MascotInhabitant.sagaExclusive (lu intégralement lignes 1-479)
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/craft-engine.ts` — CRAFT_RECIPES (24 entrées confirmées par grep)
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/tech-engine.ts` — TECH_TREE (10 entrées lues intégralement)
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/companion-types.ts` — COMPANION_SPECIES_CATALOG (5 entrées lues)
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/farm-engine.ts` — GOLDEN_CROP_CHANCE=0.03, GOLDEN_HARVEST_MULTIPLIER=5, HARVEST_EVENTS (3), RARE_SEED_DROP_RULES (4) lus lignes 1-320
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/sagas-content.ts` — 4 SAGAS confirmées par grep (voyageur_argent, source_cachee, carnaval_ombres, graine_anciens)
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/adventures.ts` — 15 ADVENTURES confirmées par grep
- `/Users/gabrielwaltio/Documents/family-vault/lib/mascot/seasonal-events-content.ts` — 8 keys confirmées (nouvel-an → noel)
- `/Users/gabrielwaltio/Documents/family-vault/lib/i18n.ts` — pattern namespace, 5 namespaces existants confirmés
- `/Users/gabrielwaltio/Documents/family-vault/jest.config.js` — jest + ts-jest installés, `__DEV__: false` global en test
- `/Users/gabrielwaltio/Documents/family-vault/lib/__tests__/i18n.test.ts` — test existant, pas de parité FR/EN deep mais structure helpers
- `/Users/gabrielwaltio/Documents/family-vault/CLAUDE.md` — conventions projet (langue FR, pas de hardcoded colors, inexactitude sur "pas de test suite")
- `/Users/gabrielwaltio/Documents/family-vault/.planning/phases/16-codex-contenu/16-CONTEXT.md` — 22 décisions utilisateur
- `/Users/gabrielwaltio/Documents/family-vault/.planning/REQUIREMENTS.md` — CODEX-01 à CODEX-05

### Secondary (MEDIUM confidence)

- Grep `dropOnly` cross-codebase — 4 crops confirmés (orchidee, rose_doree, truffe, fruit_dragon)
- `lib/mascot/companion-types.ts:145` partiel (lignes 120-151 lues)

### Tertiary (LOW confidence)

- Count exact `INHABITANTS` : 18 supposé, à vérifier en Wave 0 (voir Open Questions §1)
- Existence `FAMILY_QUESTS` distinct de `ADVENTURES` : non vérifié (voir Open Questions §5)

## Metadata

**Confidence breakdown:**

- Standard stack : HIGH — toutes les dépendances déjà installées et confirmées par lecture directe
- Architecture (discriminated union + getters) : HIGH — pattern standard TS, exemples d'existants similaires dans lib/mascot/types.ts (MascotInhabitant, CropDefinition)
- Engine shapes : HIGH — lecture directe de chaque fichier source, counts vérifiés par grep
- i18n integration : HIGH — pattern actuel lu in extenso dans lib/i18n.ts
- Loot aggregation : HIGH — constantes lues lignes 13-16, 213-258 de farm-engine.ts
- Validation strategy : HIGH — jest.config.js lu, test existant lu, pattern clair
- Volume estimates : MEDIUM — counts précis mais extrapolation LOC est approximative (±20%)
- Open questions : LOW — 5 points à résoudre en Wave 0

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable, aucune mise à jour majeure de RN/Expo/i18next attendue d'ici là)
