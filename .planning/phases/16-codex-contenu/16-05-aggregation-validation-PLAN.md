---
phase: 16-codex-contenu
plan: 05
type: execute
wave: 3
depends_on: [16-02, 16-03, 16-04]
files_modified:
  - lib/codex/content.ts
  - lib/__tests__/codex-content.test.ts
autonomous: true
requirements: [CODEX-01, CODEX-02, CODEX-03, CODEX-04, CODEX-05]
must_haves:
  truths:
    - "lib/codex/content.ts exporte CODEX_CONTENT: CodexEntry[] agrégeant les 10 catégories"
    - "Le tableau couvre ~111 entrées couvrant les 10 CodexKind (une assertion Jest le vérifie)"
    - "Chaque entry a un sourceId valide dans sa constante engine (test d'intégrité Jest)"
    - "Chaque nameKey/loreKey existe dans locales/fr/codex.json ET locales/en/codex.json (test parité)"
    - "Les 4 crops dropOnly (orchidee, rose_doree, truffe, fruit_dragon) sont détectables via getCropStats(entry).dropOnly === true"
  artifacts:
    - path: "lib/codex/content.ts"
      provides: "CODEX_CONTENT: CodexEntry[] + re-exports helpers/types"
    - path: "lib/__tests__/codex-content.test.ts"
      provides: "Tests Jest : couverture 10 kinds, intégrité sourceId↔engine, parité i18n FR/EN, présence dropOnly"
  key_links:
    - from: "lib/codex/content.ts"
      to: "lib/codex/{cultures,animals,buildings,craft,tech,companions,loot,seasonal,sagas,quests}.ts"
      via: "import + spread"
      pattern: "...(cropEntries|animalEntries|...)"
    - from: "lib/__tests__/codex-content.test.ts"
      to: "CODEX_CONTENT"
      via: "import et itération"
      pattern: "import.*CODEX_CONTENT"
---

<objective>
Agréger les 10 arrays catégorie en un unique `CODEX_CONTENT: CodexEntry[]` exporté depuis `lib/codex/content.ts`, puis ajouter un test Jest d'intégrité qui garantit : (1) 10 kinds distincts, (2) sourceId valide pour chaque entry, (3) parité FR/EN des clés i18n, (4) les 4 crops dropOnly sont bien marqués.

Purpose: Ce plan ferme Phase 16 — sans l'aggregation point d'entrée et les tests, rien ne garantit l'absence de drift ni l'exhaustivité.
Output: 1 fichier entry point + 1 fichier de test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/16-codex-contenu/16-CONTEXT.md
@.planning/phases/16-codex-contenu/16-RESEARCH.md
@lib/codex/types.ts
@lib/codex/stats.ts
@lib/codex/cultures.ts
@lib/codex/animals.ts
@lib/codex/buildings.ts
@lib/codex/craft.ts
@lib/codex/tech.ts
@lib/codex/companions.ts
@lib/codex/loot.ts
@lib/codex/seasonal.ts
@lib/codex/sagas.ts
@lib/codex/quests.ts
@locales/fr/codex.json
@locales/en/codex.json
@jest.config.js
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1 : Créer lib/codex/content.ts (point d'entrée unifié CODEX-01)</name>
  <files>lib/codex/content.ts</files>
  <read_first>
    - lib/codex/types.ts
    - lib/codex/stats.ts
    - Tous les sous-fichiers créés par plans 02/03/04 (cultures, animals, loot, buildings, craft, tech, companions, sagas, quests, seasonal)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md Pattern 3 (lignes 205-254)
  </read_first>
  <action>
    Créer `lib/codex/content.ts` qui agrège et re-exporte :

    ```typescript
    // lib/codex/content.ts — Point d'entrée unifié du codex ferme (Phase 16, CODEX-01)
    // Agrège les 10 catégories dérivées des constantes engine sans drift (per D-02).

    import { cropEntries } from './cultures';
    import { animalEntries } from './animals';
    import { buildingEntries } from './buildings';
    import { craftEntries } from './craft';
    import { techEntries } from './tech';
    import { companionEntries } from './companions';
    import { lootEntries } from './loot';
    import { seasonalEntries } from './seasonal';
    import { sagaEntries } from './sagas';
    import { questEntries } from './quests';

    import type { CodexEntry } from './types';

    export const CODEX_CONTENT: CodexEntry[] = [
      ...cropEntries,
      ...animalEntries,
      ...buildingEntries,
      ...craftEntries,
      ...techEntries,
      ...companionEntries,
      ...lootEntries,
      ...seasonalEntries,
      ...sagaEntries,
      ...questEntries,
    ];

    // Re-exports pour permettre un import unique depuis lib/codex/content
    export * from './types';
    export * from './stats';
    export {
      HARVEST_EVENTS, RARE_SEED_DROP_RULES,
      GOLDEN_CROP_CHANCE, GOLDEN_HARVEST_MULTIPLIER,
    } from './loot';

    // Assert __DEV__ : garantit que les 10 kinds sont tous représentés au démarrage
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const kinds = new Set(CODEX_CONTENT.map(e => e.kind));
      const expected = ['crop', 'animal', 'building', 'craft', 'tech', 'companion', 'loot', 'seasonal', 'saga', 'quest'];
      const missing = expected.filter(k => !kinds.has(k as CodexEntry['kind']));
      if (missing.length > 0) {
        console.error('[codex] Kinds manquants dans CODEX_CONTENT:', missing);
      }
    }
    ```

    Le fichier doit rester sous 60 lignes.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | grep "lib/codex/content.ts" | wc -l | grep -q "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/content.ts` existe
    - `grep -q "export const CODEX_CONTENT" lib/codex/content.ts` passe
    - `grep -c "^import { .*Entries } from './" lib/codex/content.ts` retourne 10
    - `grep -q "...cropEntries" lib/codex/content.ts` passe
    - `grep -q "...lootEntries" lib/codex/content.ts` passe
    - `grep -q "export \* from './types'" lib/codex/content.ts` passe
    - `grep -q "export \* from './stats'" lib/codex/content.ts` passe
    - `npx tsc --noEmit` : zéro erreur sur content.ts
    - Zéro valeur numérique dans content.ts (pas de digit dans le code — seulement dans commentaires éventuels)
  </acceptance_criteria>
  <done>CODEX_CONTENT compile et agrège les 10 arrays.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 : Créer le test Jest d'intégrité codex (sourceId + parité i18n + dropOnly)</name>
  <files>lib/__tests__/codex-content.test.ts</files>
  <read_first>
    - lib/codex/content.ts (créé task 1)
    - lib/codex/stats.ts
    - lib/__tests__/i18n.test.ts (pattern Jest existant dans ce projet)
    - jest.config.js (à la racine)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md §i18n test (lignes 547-568)
  </read_first>
  <behavior>
    - Test 1 : CODEX_CONTENT contient les 10 CodexKind distincts (`new Set(kinds).size === 10`)
    - Test 2 : Chaque entrée (hors 'loot') a un sourceId résoluble via son getter respectif — si `getCropStats(cropEntry)` retourne undefined, le test échoue avec le sourceId fautif
    - Test 3 : Parité FR/EN — pour chaque entry, les clés `nameKey` et `loreKey` existent dans `frCodex` ET `enCodex` (après avoir retiré le préfixe `codex.`)
    - Test 4 : Les 4 crops dropOnly attendus (`orchidee, rose_doree, truffe, fruit_dragon`) sont présents dans cropEntries ET getCropStats retourne `dropOnly === true` pour chacun
    - Test 5 : Tous les `AnimalEntry` avec `dropOnly === true` correspondent à des `INHABITANTS` avec `sagaExclusive === true`
  </behavior>
  <action>
    Créer `lib/__tests__/codex-content.test.ts` :

    ```typescript
    // lib/__tests__/codex-content.test.ts — Tests d'intégrité Phase 16 (CODEX-01..05)
    import {
      CODEX_CONTENT,
      getCropStats, getAnimalStats, getBuildingStats, getCraftStats,
      getTechStats, getCompanionStats, getSagaStats, getQuestStats, getSeasonalStats,
    } from '../codex/content';
    import type {
      CropEntry, AnimalEntry, BuildingEntry, CraftEntry, TechEntry,
      CompanionEntry, SagaEntry, QuestEntry, SeasonalEntry,
    } from '../codex/types';
    import frCodex from '../../locales/fr/codex.json';
    import enCodex from '../../locales/en/codex.json';

    function hasNestedKey(obj: any, dottedPath: string): boolean {
      return dottedPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj) !== undefined;
    }

    describe('CODEX-01/02 — couverture des 10 catégories', () => {
      it('contient les 10 CodexKind distincts', () => {
        const kinds = new Set(CODEX_CONTENT.map(e => e.kind));
        const expected = ['crop','animal','building','craft','tech','companion','loot','seasonal','saga','quest'];
        expected.forEach(k => expect(kinds.has(k as any)).toBe(true));
        expect(kinds.size).toBe(10);
      });

      it('contient au moins 100 entrées totales', () => {
        expect(CODEX_CONTENT.length).toBeGreaterThanOrEqual(100);
      });
    });

    describe('CODEX-01 — intégrité sourceId ↔ engine (anti-drift)', () => {
      it.each(CODEX_CONTENT.filter(e => e.kind === 'crop') as CropEntry[])('crop $sourceId existe dans CROP_CATALOG', (entry) => {
        expect(getCropStats(entry)).toBeDefined();
      });
      it.each(CODEX_CONTENT.filter(e => e.kind === 'animal') as AnimalEntry[])('animal $sourceId existe dans INHABITANTS', (entry) => {
        expect(getAnimalStats(entry)).toBeDefined();
      });
      it.each(CODEX_CONTENT.filter(e => e.kind === 'building') as BuildingEntry[])('building $sourceId existe dans BUILDING_CATALOG', (entry) => {
        expect(getBuildingStats(entry)).toBeDefined();
      });
      it.each(CODEX_CONTENT.filter(e => e.kind === 'craft') as CraftEntry[])('craft $sourceId existe dans CRAFT_RECIPES', (entry) => {
        expect(getCraftStats(entry)).toBeDefined();
      });
      it.each(CODEX_CONTENT.filter(e => e.kind === 'tech') as TechEntry[])('tech $sourceId existe dans TECH_TREE', (entry) => {
        expect(getTechStats(entry)).toBeDefined();
      });
      it.each(CODEX_CONTENT.filter(e => e.kind === 'companion') as CompanionEntry[])('companion $sourceId existe dans COMPANION_SPECIES_CATALOG', (entry) => {
        expect(getCompanionStats(entry)).toBeDefined();
      });
      it.each(CODEX_CONTENT.filter(e => e.kind === 'saga') as SagaEntry[])('saga $sourceId existe dans SAGAS', (entry) => {
        expect(getSagaStats(entry)).toBeDefined();
      });
      it.each(CODEX_CONTENT.filter(e => e.kind === 'quest') as QuestEntry[])('quest $sourceId existe dans ADVENTURES', (entry) => {
        expect(getQuestStats(entry)).toBeDefined();
      });
      it.each(CODEX_CONTENT.filter(e => e.kind === 'seasonal') as SeasonalEntry[])('seasonal $sourceId existe dans SEASONAL_EVENT_DIALOGUES', (entry) => {
        expect(getSeasonalStats(entry)).toBeDefined();
      });
    });

    describe('D-18/D-20 — parité i18n FR/EN', () => {
      it.each(CODEX_CONTENT)('entry $id a nameKey et loreKey FR+EN', (entry) => {
        const nameKey = entry.nameKey.replace(/^codex\./, '');
        const loreKey = entry.loreKey.replace(/^codex\./, '');
        expect(hasNestedKey(frCodex, nameKey)).toBe(true);
        expect(hasNestedKey(enCodex, nameKey)).toBe(true);
        expect(hasNestedKey(frCodex, loreKey)).toBe(true);
        expect(hasNestedKey(enCodex, loreKey)).toBe(true);
      });
    });

    describe('CODEX-05 — dropOnly crops', () => {
      const expectedDropOnly = ['orchidee', 'rose_doree', 'truffe', 'fruit_dragon'];

      it.each(expectedDropOnly)('crop %s est marqué dropOnly dans l\\'engine', (sourceId) => {
        const entry = (CODEX_CONTENT.filter(e => e.kind === 'crop') as CropEntry[])
          .find(e => e.sourceId === sourceId);
        expect(entry).toBeDefined();
        const stats = getCropStats(entry!);
        expect(stats?.dropOnly).toBe(true);
      });

      it('les 4 crops dropOnly attendus sont présents dans le codex', () => {
        const dropOnlyInCodex = (CODEX_CONTENT.filter(e => e.kind === 'crop') as CropEntry[])
          .filter(e => getCropStats(e)?.dropOnly === true)
          .map(e => e.sourceId)
          .sort();
        expect(dropOnlyInCodex).toEqual(expectedDropOnly.sort());
      });
    });

    describe('D-15 — animaux sagaExclusive → dropOnly', () => {
      it('chaque AnimalEntry avec dropOnly=true a sagaExclusive=true côté engine', () => {
        const entries = (CODEX_CONTENT.filter(e => e.kind === 'animal') as AnimalEntry[])
          .filter(e => e.dropOnly);
        expect(entries.length).toBeGreaterThan(0);
        entries.forEach(entry => {
          const stats = getAnimalStats(entry);
          expect(stats?.sagaExclusive).toBe(true);
        });
      });
    });
    ```

    Si un test échoue car la typing de `.find(e => e.kind === 'crop')` n'est pas narrow, garder le `as CropEntry[]` cast explicite comme dans l'exemple.
  </action>
  <verify>
    <automated>npx jest lib/__tests__/codex-content.test.ts --no-coverage 2>&amp;1 | tail -20 &amp;&amp; npx jest lib/__tests__/codex-content.test.ts --no-coverage --silent</automated>
  </verify>
  <acceptance_criteria>
    - `lib/__tests__/codex-content.test.ts` existe
    - `grep -q "CODEX_CONTENT" lib/__tests__/codex-content.test.ts` passe
    - `grep -q "getCropStats" lib/__tests__/codex-content.test.ts` passe
    - `grep -q "orchidee" lib/__tests__/codex-content.test.ts` passe (test dropOnly)
    - `grep -q "rose_doree" lib/__tests__/codex-content.test.ts` passe
    - `grep -q "truffe" lib/__tests__/codex-content.test.ts` passe
    - `grep -q "fruit_dragon" lib/__tests__/codex-content.test.ts` passe
    - `npx jest lib/__tests__/codex-content.test.ts` exit code 0 (tous les tests passent)
    - Au moins 5 blocs `describe` présents
    - `npx tsc --noEmit` reste vert
  </acceptance_criteria>
  <done>Tous les tests Jest codex-content passent. Phase 16 close.</done>
</task>

</tasks>

<verification>
- `CODEX_CONTENT.length` ≥ 100 (couvre ~111 entrées attendues)
- Les 10 kinds présents
- `npx jest lib/__tests__/codex-content.test.ts` exit 0
- `npx tsc --noEmit` sans nouvelle erreur
- Les 4 crops dropOnly et les animaux sagaExclusive détectables correctement
</verification>

<success_criteria>
Phase 16 Success Criteria du ROADMAP tous atteints :
1. `lib/codex/content.ts` compile et exporte CodexEntry[] sur 10 catégories
2. Zéro valeur numérique hardcodée (vérifié par les getters anti-drift + grep)
3. Pluies dorées documentées via lootEntries + constantes re-exportées
4. Les 4 crops dropOnly marqués et testés
</success_criteria>

<output>
Create `.planning/phases/16-codex-contenu/16-05-SUMMARY.md`.
</output>
