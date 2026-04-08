---
phase: 16-codex-contenu
plan: 04
type: execute
wave: 2
depends_on: [16-01]
files_modified:
  - lib/codex/sagas.ts
  - lib/codex/quests.ts
  - lib/codex/seasonal.ts
  - locales/fr/codex.json
  - locales/en/codex.json
autonomous: true
requirements: [CODEX-02, CODEX-03]
must_haves:
  truths:
    - "Les 4 sagas, 15 quêtes coopératives (ADVENTURES) et 8 événements saisonniers sont exposés comme entrées codex"
    - "Chaque entry référence son sourceId engine"
    - "Le lore FR+EN est complet pour les 27 entrées"
  artifacts:
    - path: "lib/codex/sagas.ts"
      provides: "sagaEntries: SagaEntry[] dérivé de SAGAS"
    - path: "lib/codex/quests.ts"
      provides: "questEntries: QuestEntry[] dérivé de ADVENTURES"
    - path: "lib/codex/seasonal.ts"
      provides: "seasonalEntries: SeasonalEntry[] dérivé de SEASONAL_EVENT_DIALOGUES (Record)"
  key_links:
    - from: "lib/codex/seasonal.ts"
      to: "SEASONAL_EVENT_DIALOGUES"
      via: "Object.keys(...).map"
      pattern: "Object.keys.*SEASONAL_EVENT_DIALOGUES"
---

<objective>
Créer les 3 derniers arrays de catégories : sagas, quests (adventures), seasonal. Remplir lore FR+EN.

Purpose: Complète la couverture CODEX-02 (10 catégories) avec les 3 dernières sources engine. Parallélisable avec plan 02 et plan 03.
Output: 3 fichiers lib/codex/* + 27 × 2 × 2 = 108 textes lore.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/16-codex-contenu/16-CONTEXT.md
@.planning/phases/16-codex-contenu/16-RESEARCH.md
@lib/codex/types.ts
@lib/mascot/sagas-content.ts
@lib/mascot/sagas-types.ts
@lib/mascot/adventures.ts
@lib/mascot/seasonal-events-content.ts
@lib/mascot/seasonal-events-types.ts
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1 : Créer sagas.ts + quests.ts et remplir lore FR+EN (19 entrées)</name>
  <files>lib/codex/sagas.ts, lib/codex/quests.ts, locales/fr/codex.json, locales/en/codex.json</files>
  <read_first>
    - lib/codex/types.ts (SagaEntry, QuestEntry)
    - lib/mascot/sagas-content.ts (SAGAS — 4 IDs : voyageur_argent, source_cachee, carnaval_ombres, graine_anciens)
    - lib/mascot/sagas-types.ts (type Saga)
    - lib/mascot/adventures.ts (ADVENTURES — 15 IDs listés dans RESEARCH lignes 369)
  </read_first>
  <action>
    **1a)** Créer `lib/codex/sagas.ts` :

    ```typescript
    // lib/codex/sagas.ts — Sagas immersives (source: SAGAS)
    import { SAGAS } from '../mascot/sagas-content';
    import type { SagaEntry } from './types';

    export const sagaEntries: SagaEntry[] = SAGAS.map(s => ({
      id: `saga_${s.id}`,
      kind: 'saga' as const,
      sourceId: s.id,
      nameKey: `codex.saga.${s.id}.name`,
      loreKey: `codex.saga.${s.id}.lore`,
    }));
    ```

    Note : si `SAGAS` est typé avec un `id` trop strict, caster via `String(s.id)`.

    **1b)** Créer `lib/codex/quests.ts` :

    ```typescript
    // lib/codex/quests.ts — Quêtes coopératives (source: ADVENTURES)
    import { ADVENTURES } from '../mascot/adventures';
    import type { QuestEntry } from './types';

    export const questEntries: QuestEntry[] = ADVENTURES.map(a => ({
      id: `quest_${a.id}`,
      kind: 'quest' as const,
      sourceId: a.id,
      nameKey: `codex.quest.${a.id}.name`,
      loreKey: `codex.quest.${a.id}.lore`,
      iconRef: a.emoji,
    }));
    ```

    **1c)** Remplir `locales/fr/codex.json` :
    - `saga` : 4 entrées `{name, lore}` pour `voyageur_argent, source_cachee, carnaval_ombres, graine_anciens`
    - `quest` : 15 entrées `{name, lore}` pour `tresor_ecureuil, tempete, voyageur, lucioles, graine_magique, arc_en_ciel, hibou_sage, tresor_pirate, fee_egaree, pluie_etoiles, papillon_geant, concert_oiseaux, neige_magique, champignon_dore, lettre_mysterieuse`

    **1d)** Remplir `locales/en/codex.json` symétriquement.

    Style : 2-4 phrases, évocateur, centré sur le mystère/l'aventure pour sagas et quests. Zéro stat.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const sSrc=fs.readFileSync('lib/mascot/sagas-content.ts','utf8');const sm=sSrc.match(/SAGAS[\s\S]*?\];/);const sids=[...sm[0].matchAll(/id:\s*'([a-z_]+)'/g)].map(x=>x[1]);const aSrc=fs.readFileSync('lib/mascot/adventures.ts','utf8');const am=aSrc.match(/ADVENTURES[\s\S]*?\];/);const aids=[...am[0].matchAll(/id:\s*'([a-z_]+)'/g)].map(x=>x[1]);const fr=require('./locales/fr/codex.json'),en=require('./locales/en/codex.json');const missS=sids.filter(id=>!fr.saga[id]?.lore||!en.saga[id]?.lore);const missA=aids.filter(id=>!fr.quest[id]?.lore||!en.quest[id]?.lore);if(missS.length||missA.length){console.error('MISS saga:',missS,'quest:',missA);process.exit(1)}console.log('OK',sids.length,'sagas,',aids.length,'quests')"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/sagas.ts` et `lib/codex/quests.ts` existent
    - `grep -q "SAGAS.map" lib/codex/sagas.ts` passe
    - `grep -q "ADVENTURES.map" lib/codex/quests.ts` passe
    - Les IDs extraits de SAGAS ont name+lore FR+EN
    - Les IDs extraits de ADVENTURES ont name+lore FR+EN
    - `npx tsc --noEmit` : zéro erreur sur sagas.ts / quests.ts
  </acceptance_criteria>
  <done>19 entrées saga+quest avec lore complet bilingue.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2 : Créer seasonal.ts (Record → array) et remplir lore FR+EN (8 entrées)</name>
  <files>lib/codex/seasonal.ts, locales/fr/codex.json, locales/en/codex.json</files>
  <read_first>
    - lib/codex/types.ts (SeasonalEntry)
    - lib/mascot/seasonal-events-content.ts (SEASONAL_EVENT_DIALOGUES — Record avec 8 clés : nouvel-an, st-valentin, poisson-avril, paques, ete, rentree, halloween, noel)
    - lib/mascot/seasonal-events-types.ts (type SeasonalEventContent)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md ligne 381-384 (attention : c'est un Record pas un array)
  </read_first>
  <action>
    **2a)** Créer `lib/codex/seasonal.ts` :

    ```typescript
    // lib/codex/seasonal.ts — Drops saisonniers & événements (source: SEASONAL_EVENT_DIALOGUES Record)
    import { SEASONAL_EVENT_DIALOGUES } from '../mascot/seasonal-events-content';
    import type { SeasonalEntry } from './types';

    export const seasonalEntries: SeasonalEntry[] = Object.keys(SEASONAL_EVENT_DIALOGUES).map(key => ({
      id: `seasonal_${key}`,
      kind: 'seasonal' as const,
      sourceId: key,
      nameKey: `codex.seasonal.${key}.name`,
      loreKey: `codex.seasonal.${key}.lore`,
    }));
    ```

    **2b)** Remplir `locales/fr/codex.json` clé `seasonal` avec 8 entrées name+lore pour les clés suivantes (entre guillemets à cause du tiret) :
    - `"nouvel-an"` : Nouvel An
    - `"st-valentin"` : Saint-Valentin
    - `"poisson-avril"` : Poisson d'avril
    - `"paques"` : Pâques
    - `"ete"` : Été
    - `"rentree"` : Rentrée
    - `"halloween"` : Halloween
    - `"noel"` : Noël

    **2c)** Remplir `locales/en/codex.json` clé `seasonal` avec les mêmes 8 clés et traductions EN.

    Style : 2-4 phrases évoquant l'événement et son impact sur la ferme.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const src=fs.readFileSync('lib/mascot/seasonal-events-content.ts','utf8');const keys=['nouvel-an','st-valentin','poisson-avril','paques','ete','rentree','halloween','noel'];const fr=require('./locales/fr/codex.json'),en=require('./locales/en/codex.json');const miss=keys.filter(k=>!fr.seasonal[k]?.lore||!en.seasonal[k]?.lore);if(miss.length){console.error('MISS:',miss);process.exit(1)}console.log('OK 8 seasonal')"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/seasonal.ts` existe et exporte `seasonalEntries`
    - `grep -q "Object.keys(SEASONAL_EVENT_DIALOGUES)" lib/codex/seasonal.ts` passe
    - Les 8 clés seasonal ont name+lore FR+EN
    - `npx tsc --noEmit` : zéro erreur sur seasonal.ts
  </acceptance_criteria>
  <done>8 entrées seasonal avec lore bilingue complet.</done>
</task>

</tasks>

<verification>
27 nouvelles entrées (4 sagas + 15 quests + 8 seasonal) avec lore FR+EN complet.
</verification>

<success_criteria>
Les 3 arrays compilent et leurs scripts de verify passent.
</success_criteria>

<output>
Create `.planning/phases/16-codex-contenu/16-04-SUMMARY.md`.
</output>
