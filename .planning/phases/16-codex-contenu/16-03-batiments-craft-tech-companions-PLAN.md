---
phase: 16-codex-contenu
plan: 03
type: execute
wave: 2
depends_on: [16-01]
files_modified:
  - lib/codex/buildings.ts
  - lib/codex/craft.ts
  - lib/codex/tech.ts
  - lib/codex/companions.ts
  - locales/fr/codex.json
  - locales/en/codex.json
autonomous: true
requirements: [CODEX-02, CODEX-03]
must_haves:
  truths:
    - "Les 4 bâtiments productifs, 24 recettes craft, 10 tech nodes et 5 compagnons sont exposés comme entrées codex"
    - "Chaque entry référence son sourceId engine sans inliner de stat numérique"
    - "Le lore FR+EN est complet pour les 43 entrées de ces 4 catégories"
  artifacts:
    - path: "lib/codex/buildings.ts"
      provides: "buildingEntries: BuildingEntry[] dérivé de BUILDING_CATALOG"
    - path: "lib/codex/craft.ts"
      provides: "craftEntries: CraftEntry[] dérivé de CRAFT_RECIPES"
    - path: "lib/codex/tech.ts"
      provides: "techEntries: TechEntry[] dérivé de TECH_TREE"
    - path: "lib/codex/companions.ts"
      provides: "companionEntries: CompanionEntry[] dérivé de COMPANION_SPECIES_CATALOG"
  key_links:
    - from: "lib/codex/craft.ts"
      to: "CRAFT_RECIPES"
      via: ".map"
      pattern: "CRAFT_RECIPES.map"
---

<objective>
Créer les 4 arrays lib/codex/{buildings,craft,tech,companions}.ts dérivés de leurs constantes engine respectives, et remplir le lore FR+EN associé.

Purpose: Couvre 4 catégories sur les 10 requises par CODEX-02 (43 entrées au total). Parallélisable avec plan 02 et plan 04 car aucun fichier partagé avec eux sauf codex.json (édition par clés racine distinctes : `building`, `craft`, `tech`, `companion`).
Output: 4 fichiers + 43 × 2 × 2 = 172 textes lore.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/16-codex-contenu/16-CONTEXT.md
@.planning/phases/16-codex-contenu/16-RESEARCH.md
@lib/codex/types.ts
@lib/mascot/types.ts
@lib/mascot/craft-engine.ts
@lib/mascot/tech-engine.ts
@lib/mascot/companion-types.ts
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1 : Créer buildings.ts + craft.ts et remplir lore FR+EN (28 entrées)</name>
  <files>lib/codex/buildings.ts, lib/codex/craft.ts, locales/fr/codex.json, locales/en/codex.json</files>
  <read_first>
    - lib/codex/types.ts (BuildingEntry, CraftEntry)
    - lib/mascot/types.ts (BUILDING_CATALOG lignes 421-479 — noter les 4 IDs : poulailler, grange, moulin, ruche)
    - lib/mascot/craft-engine.ts (CRAFT_RECIPES lignes 27-323 — 24 IDs exacts à extraire)
  </read_first>
  <action>
    **1a)** Créer `lib/codex/buildings.ts` :

    ```typescript
    // lib/codex/buildings.ts — Bâtiments productifs (source: BUILDING_CATALOG)
    import { BUILDING_CATALOG } from '../mascot/types';
    import type { BuildingEntry } from './types';

    export const buildingEntries: BuildingEntry[] = BUILDING_CATALOG.map(b => ({
      id: `building_${b.id}`,
      kind: 'building' as const,
      sourceId: b.id,
      nameKey: `codex.building.${b.id}.name`,
      loreKey: `codex.building.${b.id}.lore`,
      iconRef: b.emoji,
    }));
    ```

    **1b)** Créer `lib/codex/craft.ts` :

    ```typescript
    // lib/codex/craft.ts — Recettes craft (source: CRAFT_RECIPES)
    import { CRAFT_RECIPES } from '../mascot/craft-engine';
    import type { CraftEntry } from './types';

    export const craftEntries: CraftEntry[] = CRAFT_RECIPES.map(r => ({
      id: `craft_${r.id}`,
      kind: 'craft' as const,
      sourceId: r.id,
      nameKey: `codex.craft.${r.id}.name`,
      loreKey: `codex.craft.${r.id}.lore`,
      iconRef: r.emoji,
    }));
    ```

    **1c)** Lire `lib/mascot/types.ts` pour extraire les 4 IDs exacts de BUILDING_CATALOG (attendu : `poulailler, grange, moulin, ruche`) et `lib/mascot/craft-engine.ts` pour extraire les 24 IDs exacts de CRAFT_RECIPES.

    **1d)** Remplir `locales/fr/codex.json` :
    - `building` : 4 entrées `{name, lore}` (une par ID)
    - `craft` : 24 entrées `{name, lore}` (une par ID)

    Style : 2-4 phrases par lore, centrées sur l'usage dans la ferme. Zéro valeur numérique.

    **1e)** Remplir `locales/en/codex.json` symétriquement.

    Utiliser le Write tool pour édition complète des JSON en une seule passe par langue (plus fiable que des Edit multiples sur gros JSON).
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const bSrc=fs.readFileSync('lib/mascot/types.ts','utf8');const cSrc=fs.readFileSync('lib/mascot/craft-engine.ts','utf8');const bm=bSrc.match(/BUILDING_CATALOG[\s\S]*?\];/);const bids=[...bm[0].matchAll(/id:\s*'([a-z_]+)'/g)].map(x=>x[1]);const cm=cSrc.match(/CRAFT_RECIPES[\s\S]*?\];/);const cids=[...cm[0].matchAll(/id:\s*'([a-z_]+)'/g)].map(x=>x[1]);const fr=require('./locales/fr/codex.json'),en=require('./locales/en/codex.json');const missB=bids.filter(id=>!fr.building[id]?.lore||!en.building[id]?.lore);const missC=cids.filter(id=>!fr.craft[id]?.lore||!en.craft[id]?.lore);if(missB.length||missC.length){console.error('MISSING building:',missB,'craft:',missC);process.exit(1)}console.log('OK',bids.length,'buildings,',cids.length,'crafts')"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/buildings.ts` existe avec `BUILDING_CATALOG.map` et exporte `buildingEntries`
    - `lib/codex/craft.ts` existe avec `CRAFT_RECIPES.map` et exporte `craftEntries`
    - Les 4 IDs BUILDING_CATALOG ont name+lore FR+EN
    - Les 24 IDs CRAFT_RECIPES ont name+lore FR+EN (script verify)
    - Aucun nombre hardcodé dans buildings.ts ou craft.ts
    - `npx tsc --noEmit` : zéro erreur sur ces 2 fichiers
  </acceptance_criteria>
  <done>28 entrées building+craft générées avec lore complet bilingue.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2 : Créer tech.ts + companions.ts et remplir lore FR+EN (15 entrées)</name>
  <files>lib/codex/tech.ts, lib/codex/companions.ts, locales/fr/codex.json, locales/en/codex.json</files>
  <read_first>
    - lib/codex/types.ts (TechEntry, CompanionEntry)
    - lib/mascot/tech-engine.ts (TECH_TREE lignes 36-92 — 10 IDs)
    - lib/mascot/companion-types.ts (COMPANION_SPECIES_CATALOG lignes 145-151 — 5 IDs : chat, chien, lapin, renard, herisson)
  </read_first>
  <action>
    **2a)** Créer `lib/codex/tech.ts` :

    ```typescript
    // lib/codex/tech.ts — Tech tree (source: TECH_TREE)
    import { TECH_TREE } from '../mascot/tech-engine';
    import type { TechEntry } from './types';

    export const techEntries: TechEntry[] = TECH_TREE.map(t => ({
      id: `tech_${t.id}`,
      kind: 'tech' as const,
      sourceId: t.id,
      nameKey: `codex.tech.${t.id}.name`,
      loreKey: `codex.tech.${t.id}.lore`,
      iconRef: t.emoji,
    }));
    ```

    **2b)** Créer `lib/codex/companions.ts` :

    ```typescript
    // lib/codex/companions.ts — Compagnons (source: COMPANION_SPECIES_CATALOG)
    import { COMPANION_SPECIES_CATALOG } from '../mascot/companion-types';
    import type { CompanionEntry } from './types';

    export const companionEntries: CompanionEntry[] = COMPANION_SPECIES_CATALOG.map(c => ({
      id: `companion_${c.id}`,
      kind: 'companion' as const,
      sourceId: c.id,
      nameKey: `codex.companion.${c.id}.name`,
      loreKey: `codex.companion.${c.id}.lore`,
    }));
    ```

    **2c)** Lire TECH_TREE pour extraire les 10 IDs exacts (attendu : `culture-1` à `culture-4`, `elevage-1` à `elevage-3`, `expansion-1` à `expansion-3`). Attention : les IDs contiennent un tiret, donc la clé JSON utilise le tiret (valide en JSON).

    **2d)** Remplir `locales/fr/codex.json` :
    - `tech` : 10 entrées `{name, lore}` avec clés **entre guillemets** (ex: `"culture-1": {...}`)
    - `companion` : 5 entrées pour chat, chien, lapin, renard, herisson

    **2e)** Remplir `locales/en/codex.json` symétriquement.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const tSrc=fs.readFileSync('lib/mascot/tech-engine.ts','utf8');const tm=tSrc.match(/TECH_TREE[\s\S]*?\];/);const tids=[...tm[0].matchAll(/id:\s*'([a-z0-9_-]+)'/g)].map(x=>x[1]);const cids=['chat','chien','lapin','renard','herisson'];const fr=require('./locales/fr/codex.json'),en=require('./locales/en/codex.json');const missT=tids.filter(id=>!fr.tech[id]?.lore||!en.tech[id]?.lore);const missC=cids.filter(id=>!fr.companion[id]?.lore||!en.companion[id]?.lore);if(missT.length||missC.length){console.error('MISS tech:',missT,'comp:',missC);process.exit(1)}console.log('OK',tids.length,'tech,',cids.length,'comp')"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/tech.ts` et `lib/codex/companions.ts` existent et exportent `techEntries` / `companionEntries`
    - `grep -q "TECH_TREE.map" lib/codex/tech.ts` passe
    - `grep -q "COMPANION_SPECIES_CATALOG.map" lib/codex/companions.ts` passe
    - Les 10 IDs TECH_TREE ont name+lore FR+EN
    - Les 5 IDs companion (chat, chien, lapin, renard, herisson) ont name+lore FR+EN
    - `npx tsc --noEmit` : zéro erreur nouvelle
  </acceptance_criteria>
  <done>15 entrées tech+companion générées avec lore complet bilingue.</done>
</task>

</tasks>

<verification>
43 nouvelles entrées codex (4 buildings + 24 craft + 10 tech + 5 companions) avec lore FR+EN complet.
</verification>

<success_criteria>
Plan 03 terminé quand les 4 arrays compilent et que les scripts de verify passent sur les 43 IDs.
</success_criteria>

<output>
Create `.planning/phases/16-codex-contenu/16-03-SUMMARY.md`.
</output>
