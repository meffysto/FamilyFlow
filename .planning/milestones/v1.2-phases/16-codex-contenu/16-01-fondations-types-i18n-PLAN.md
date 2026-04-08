---
phase: 16-codex-contenu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/codex/types.ts
  - lib/codex/stats.ts
  - locales/fr/codex.json
  - locales/en/codex.json
  - lib/i18n.ts
autonomous: true
requirements: [CODEX-01]
must_haves:
  truths:
    - "Le type discriminé CodexEntry existe et couvre les 10 kinds"
    - "Les helpers getXxxStats permettent de lire les stats engine depuis un entry sans drift"
    - "Le namespace i18n 'codex' est enregistré FR+EN dans lib/i18n.ts"
  artifacts:
    - path: "lib/codex/types.ts"
      provides: "CodexEntry union + 10 variants + CodexKind"
    - path: "lib/codex/stats.ts"
      provides: "getCropStats, getAnimalStats, getBuildingStats, getCraftStats, getTechStats, getCompanionStats, getSagaStats, getQuestStats, getSeasonalStats"
    - path: "locales/fr/codex.json"
      provides: "Squelette JSON {crop:{}, animal:{}, building:{}, craft:{}, tech:{}, companion:{}, loot:{}, seasonal:{}, saga:{}, quest:{}}"
    - path: "locales/en/codex.json"
      provides: "Miroir EN du squelette FR"
    - path: "lib/i18n.ts"
      provides: "Namespace 'codex' câblé FR+EN"
  key_links:
    - from: "lib/i18n.ts"
      to: "locales/{fr,en}/codex.json"
      via: "import frCodex / enCodex + entry dans ns[] et resources"
      pattern: "codex: (frCodex|enCodex)"
---

<objective>
Poser les fondations Phase 16 : types discriminés CodexEntry, helpers stats (getters anti-drift D-02), squelette JSON i18n FR+EN et enregistrement du namespace `codex` dans `lib/i18n.ts`.

Purpose: Sans ces fondations, les plans 02/03/04 ne peuvent pas créer leurs arrays typés ni remplir les clés i18n.
Output: `lib/codex/{types,stats}.ts`, `locales/{fr,en}/codex.json` vides structurés, `lib/i18n.ts` édité.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/16-codex-contenu/16-CONTEXT.md
@.planning/phases/16-codex-contenu/16-RESEARCH.md
@CLAUDE.md
@lib/i18n.ts
@lib/mascot/types.ts
@lib/mascot/craft-engine.ts
@lib/mascot/tech-engine.ts
@lib/mascot/companion-types.ts
@lib/mascot/sagas-content.ts
@lib/mascot/sagas-types.ts
@lib/mascot/adventures.ts
@lib/mascot/seasonal-events-content.ts
@lib/mascot/seasonal-events-types.ts
@lib/mascot/farm-engine.ts
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1 : Créer lib/codex/types.ts (discriminated union CodexEntry)</name>
  <files>lib/codex/types.ts</files>
  <read_first>
    - lib/mascot/types.ts (lignes 241-330 pour INHABITANTS, CROP_CATALOG, BUILDING_CATALOG, CropDefinition, MascotInhabitant)
    - lib/mascot/companion-types.ts (CompanionSpeciesInfo)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md (Pattern 1 discriminated union, lignes 119-186)
    - .planning/phases/16-codex-contenu/16-CONTEXT.md (D-01, D-02, D-03, D-14, D-15)
  </read_first>
  <action>
    Créer `lib/codex/types.ts` en suivant exactement Pattern 1 du RESEARCH (16-RESEARCH.md lignes 119-186).

    Contenu obligatoire :

    ```typescript
    // lib/codex/types.ts — Types discriminés du codex ferme (Phase 16, per D-01/D-03)

    export type CodexKind =
      | 'crop' | 'animal' | 'building' | 'craft' | 'tech'
      | 'companion' | 'loot' | 'seasonal' | 'saga' | 'quest';

    export interface CodexEntryBase {
      id: string;
      kind: CodexKind;
      sourceId: string;   // id dans la constante engine référencée
      nameKey: string;    // `codex.{kind}.{sourceId}.name`
      loreKey: string;    // `codex.{kind}.{sourceId}.lore`
      iconRef?: string;
    }

    export interface CropEntry extends CodexEntryBase { kind: 'crop'; }

    export interface AnimalEntry extends CodexEntryBase {
      kind: 'animal';
      subgroup: 'farm' | 'fantasy' | 'saga';
      dropOnly: boolean;
    }

    export interface BuildingEntry extends CodexEntryBase { kind: 'building'; }
    export interface CraftEntry extends CodexEntryBase { kind: 'craft'; }
    export interface TechEntry extends CodexEntryBase { kind: 'tech'; }
    export interface CompanionEntry extends CodexEntryBase { kind: 'companion'; }

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

    Zéro import engine dans ce fichier — types purs seulement.
    Commentaires en français (convention CLAUDE.md).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | grep -v "MemoryEditor.tsx\|cooklang.ts\|useVault.ts" | grep -c "error TS" ; test $? -eq 1 || (echo "NEW TS ERROR" &amp;&amp; exit 1)</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/types.ts` existe
    - `grep -q "export type CodexEntry =" lib/codex/types.ts` passe
    - `grep -q "kind: 'crop'" lib/codex/types.ts` passe
    - `grep -q "kind: 'animal'" lib/codex/types.ts` passe
    - `grep -q "kind: 'loot'" lib/codex/types.ts` passe
    - Le fichier exporte 10 interfaces *Entry (crop, animal, building, craft, tech, companion, loot, seasonal, saga, quest) — vérifier via `grep -c "^export interface.*Entry extends" lib/codex/types.ts` → retourne 10
    - `grep -q "export type CodexKind" lib/codex/types.ts` passe
    - Zéro `import ... from '../mascot'` dans ce fichier (`grep -c "from '../mascot" lib/codex/types.ts` = 0)
    - `npx tsc --noEmit` n'ajoute aucune nouvelle erreur (ignorer les 3 erreurs pré-existantes listées dans CLAUDE.md)
  </acceptance_criteria>
  <done>Le fichier types.ts compile et expose l'union CodexEntry + 10 variants + CodexKind.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2 : Créer lib/codex/stats.ts (helpers getters anti-drift D-02)</name>
  <files>lib/codex/stats.ts</files>
  <read_first>
    - lib/codex/types.ts (créé Task 1)
    - lib/mascot/types.ts (CROP_CATALOG, INHABITANTS, BUILDING_CATALOG + leurs types exportés)
    - lib/mascot/craft-engine.ts (CRAFT_RECIPES, type CraftRecipe)
    - lib/mascot/tech-engine.ts (TECH_TREE, type TechNode)
    - lib/mascot/companion-types.ts (COMPANION_SPECIES_CATALOG, type CompanionSpeciesInfo)
    - lib/mascot/sagas-content.ts (SAGAS)
    - lib/mascot/sagas-types.ts (type Saga)
    - lib/mascot/adventures.ts (ADVENTURES, type Adventure)
    - lib/mascot/seasonal-events-content.ts (SEASONAL_EVENT_DIALOGUES)
    - lib/mascot/seasonal-events-types.ts (type SeasonalEventContent)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md Pattern 2 (lignes 188-203)
  </read_first>
  <action>
    Créer `lib/codex/stats.ts` avec un getter par kind (sauf `loot` qui agrège — géré dans plan 02).

    Contenu :

    ```typescript
    // lib/codex/stats.ts — Getters anti-drift (per D-02) : lit les stats engine à la demande

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

    import type {
      CropEntry, AnimalEntry, BuildingEntry, CraftEntry, TechEntry,
      CompanionEntry, SagaEntry, QuestEntry, SeasonalEntry,
    } from './types';

    export function getCropStats(entry: CropEntry): CropDefinition | undefined {
      return CROP_CATALOG.find(c => c.id === entry.sourceId);
    }

    export function getAnimalStats(entry: AnimalEntry): MascotInhabitant | undefined {
      return INHABITANTS.find(i => i.id === entry.sourceId);
    }

    export function getBuildingStats(entry: BuildingEntry): BuildingDefinition | undefined {
      return BUILDING_CATALOG.find(b => b.id === entry.sourceId);
    }

    export function getCraftStats(entry: CraftEntry): CraftRecipe | undefined {
      return CRAFT_RECIPES.find(r => r.id === entry.sourceId);
    }

    export function getTechStats(entry: TechEntry): TechNode | undefined {
      return TECH_TREE.find(t => t.id === entry.sourceId);
    }

    export function getCompanionStats(entry: CompanionEntry): CompanionSpeciesInfo | undefined {
      return COMPANION_SPECIES_CATALOG.find(c => c.id === entry.sourceId);
    }

    export function getSagaStats(entry: SagaEntry): Saga | undefined {
      return SAGAS.find(s => s.id === entry.sourceId);
    }

    export function getQuestStats(entry: QuestEntry): Adventure | undefined {
      return ADVENTURES.find(a => a.id === entry.sourceId);
    }

    export function getSeasonalStats(entry: SeasonalEntry): SeasonalEventContent | undefined {
      return SEASONAL_EVENT_DIALOGUES[entry.sourceId];
    }
    ```

    Note : `COMPANION_SPECIES_CATALOG.id` est typé littéral — la comparaison `c.id === entry.sourceId` doit caster (`c.id === entry.sourceId as any`) OU préférer `.find(c => String(c.id) === entry.sourceId)`. Utiliser la deuxième forme.

    Si un import fait échouer `tsc`, adapter le nom exact du type en vérifiant les exports réels des fichiers engine (ne PAS modifier les fichiers engine).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | grep "lib/codex/stats.ts" | wc -l | grep -q "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/stats.ts` existe
    - `grep -c "^export function get" lib/codex/stats.ts` retourne 9 (crop, animal, building, craft, tech, companion, saga, quest, seasonal)
    - `grep -q "from '../mascot/types'" lib/codex/stats.ts` passe
    - `grep -q "from '../mascot/craft-engine'" lib/codex/stats.ts` passe
    - `grep -q "from '../mascot/tech-engine'" lib/codex/stats.ts` passe
    - `grep -q "from '../mascot/farm-engine'" lib/codex/stats.ts` retourne 0 (farm-engine sera importé dans loot plan 02, pas ici)
    - `npx tsc --noEmit` : zéro erreur mentionnant `lib/codex/stats.ts`
    - Zéro valeur numérique hardcodée (pas de nombre autre que 0 dans les arrow functions) : `grep -E "[0-9]+" lib/codex/stats.ts` ne doit matcher que les commentaires et littéraux de clé, jamais un cycle/cost.
  </acceptance_criteria>
  <done>Les 9 getters compilent et retournent le type engine ou undefined.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3 : Créer squelettes JSON codex FR+EN et enregistrer le namespace dans lib/i18n.ts</name>
  <files>locales/fr/codex.json, locales/en/codex.json, lib/i18n.ts</files>
  <read_first>
    - lib/i18n.ts (pattern actuel des 5 namespaces : common, gamification, help, insights, skills)
    - locales/fr/gamification.json (référence de structure nested pour un namespace)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md §i18n Integration (lignes 483-541)
    - .planning/phases/16-codex-contenu/16-CONTEXT.md D-18
  </read_first>
  <action>
    **3a)** Créer `locales/fr/codex.json` avec la structure nested vide :

    ```json
    {
      "crop": {},
      "animal": {},
      "building": {},
      "craft": {},
      "tech": {},
      "companion": {},
      "loot": {},
      "seasonal": {},
      "saga": {},
      "quest": {}
    }
    ```

    **3b)** Créer `locales/en/codex.json` avec EXACTEMENT le même contenu (miroir).

    **3c)** Éditer `lib/i18n.ts` :
    - Ajouter après les imports FR existants : `import frCodex from '../locales/fr/codex.json';`
    - Ajouter après les imports EN existants : `import enCodex from '../locales/en/codex.json';`
    - Ajouter `'codex'` au tableau `ns: [...]` (à la fin)
    - Ajouter `codex: frCodex,` dans `resources.fr`
    - Ajouter `codex: enCodex,` dans `resources.en`

    NE PAS toucher au reste du fichier. Aucune autre modification.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | grep "lib/i18n.ts\|locales/.*codex" | wc -l | grep -q "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - `locales/fr/codex.json` existe et est un JSON valide : `node -e "JSON.parse(require('fs').readFileSync('locales/fr/codex.json','utf8'))"` sort 0
    - `locales/en/codex.json` idem
    - Les 10 clés racine (crop, animal, building, craft, tech, companion, loot, seasonal, saga, quest) présentes dans les deux : `node -e "const j=require('./locales/fr/codex.json'); process.exit(['crop','animal','building','craft','tech','companion','loot','seasonal','saga','quest'].every(k=>k in j)?0:1)"` sort 0
    - `grep -q "frCodex" lib/i18n.ts` passe
    - `grep -q "enCodex" lib/i18n.ts` passe
    - `grep -q "'codex'" lib/i18n.ts` passe (dans le tableau ns)
    - `grep -c "codex:" lib/i18n.ts` retourne au moins 2 (fr + en resources)
    - `npx tsc --noEmit` : zéro erreur mentionnant `lib/i18n.ts` ou `locales/*/codex.json`
  </acceptance_criteria>
  <done>Le namespace codex est câblé FR+EN et i18next n'a aucune erreur au boot.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` ne produit aucune erreur nouvelle (les 3 erreurs pré-existantes listées dans CLAUDE.md restent tolérées)
- `lib/codex/types.ts`, `lib/codex/stats.ts`, `locales/fr/codex.json`, `locales/en/codex.json` existent
- `lib/i18n.ts` contient l'enregistrement du namespace codex
</verification>

<success_criteria>
Plan 16-01 terminé quand tous les acceptance_criteria des 3 tâches passent et `tsc --noEmit` est vert.
</success_criteria>

<output>
After completion, create `.planning/phases/16-codex-contenu/16-01-SUMMARY.md`.
</output>
