---
phase: 16-codex-contenu
plan: 02
type: execute
wave: 2
depends_on: [16-01]
files_modified:
  - lib/codex/cultures.ts
  - lib/codex/animals.ts
  - lib/codex/loot.ts
  - locales/fr/codex.json
  - locales/en/codex.json
autonomous: true
requirements: [CODEX-02, CODEX-04, CODEX-05]
must_haves:
  truths:
    - "Les 15 crops de CROP_CATALOG produisent 15 CropEntry avec dropOnly reflété depuis l'engine"
    - "Les ~18 inhabitants produisent des AnimalEntry avec subgroup farm/fantasy/saga calculé et dropOnly=sagaExclusive"
    - "Les 8 entrées loot documentent GOLDEN_CROP_CHANCE, HARVEST_EVENTS (3), RARE_SEED_DROP_RULES (4)"
    - "Le lore FR et EN est renseigné pour les 4 crops dropOnly (orchidee, rose_doree, truffe, fruit_dragon) et les 2 animaux sagaExclusive (esprit_eau, ancien_gardien)"
  artifacts:
    - path: "lib/codex/cultures.ts"
      provides: "cropEntries: CropEntry[] dérivé de CROP_CATALOG"
    - path: "lib/codex/animals.ts"
      provides: "animalEntries: AnimalEntry[] dérivé de INHABITANTS"
    - path: "lib/codex/loot.ts"
      provides: "lootEntries: LootEntry[] agrégeant farm-engine + re-export des constantes"
  key_links:
    - from: "lib/codex/cultures.ts"
      to: "CROP_CATALOG"
      via: ".map(crop => ({ sourceId: crop.id, ... }))"
      pattern: "CROP_CATALOG.map"
    - from: "lib/codex/loot.ts"
      to: "farm-engine constants"
      via: "import HARVEST_EVENTS, RARE_SEED_DROP_RULES, GOLDEN_CROP_CHANCE, GOLDEN_HARVEST_MULTIPLIER"
      pattern: "from '../mascot/farm-engine'"
---

<objective>
Créer les 3 premiers arrays de codex : cultures (15), animaux (~18), loot (8), et remplir le lore FR+EN correspondant.

Purpose: Ces 3 catégories couvrent CODEX-04 (pluies dorées) et CODEX-05 (dropOnly) — les exigences les plus critiques.
Output: 3 fichiers lib/codex/* + ~41 blocs name/lore × 2 langues dans codex.json.
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
@lib/mascot/farm-engine.ts
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1 : Créer lib/codex/cultures.ts et remplir lore FR+EN des 15 crops</name>
  <files>lib/codex/cultures.ts, locales/fr/codex.json, locales/en/codex.json</files>
  <read_first>
    - lib/codex/types.ts
    - lib/mascot/types.ts (CROP_CATALOG lignes 270-330, CropDefinition)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md Exemple 1 (lignes 619-634)
  </read_first>
  <action>
    **1a)** Créer `lib/codex/cultures.ts` :

    ```typescript
    // lib/codex/cultures.ts — Cultures ferme (source: CROP_CATALOG)
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

    **1b)** Remplir `locales/fr/codex.json` — clé `crop` — avec une entrée `{ name, lore }` pour CHACUN des 15 IDs suivants (vérifier la liste exacte dans `CROP_CATALOG` avant édition) :
    `carrot, wheat, potato, beetroot, tomato, cabbage, cucumber, corn, strawberry, pumpkin, sunflower, orchidee, rose_doree, truffe, fruit_dragon`

    Format par entrée :
    ```json
    "carrot": {
      "name": "Carotte",
      "lore": "Culture de départ, généreuse et rapide. Une botte fraîchement arrachée sent bon la terre humide du petit matin."
    }
    ```

    Style : 2-4 phrases, style Stardew Valley wiki, centré sur la fonction dans la ferme et un détail évocateur. ZÉRO valeur numérique (cycle, rendement, coût) — ces infos sont lues depuis l'engine à l'affichage Phase 17.

    Pour les 4 crops dropOnly (`orchidee`, `rose_doree`, `truffe`, `fruit_dragon`), évoquer la rareté et le drop mystérieux sans dévoiler la mécanique exacte.

    **1c)** Remplir `locales/en/codex.json` — clé `crop` — avec les MÊMES 15 IDs, traduction anglaise naturelle (pas calque mot-à-mot).

    Utiliser `Edit` en une seule passe pour chaque fichier JSON, ou `Write` si l'édition est plus simple.
  </action>
  <verify>
    <automated>node -e "const fr=require('./locales/fr/codex.json'),en=require('./locales/en/codex.json'),ids=['carrot','wheat','potato','beetroot','tomato','cabbage','cucumber','corn','strawberry','pumpkin','sunflower','orchidee','rose_doree','truffe','fruit_dragon'];const miss=ids.filter(id=>!fr.crop[id]?.name||!fr.crop[id]?.lore||!en.crop[id]?.name||!en.crop[id]?.lore);if(miss.length){console.error('MISSING:',miss);process.exit(1)}"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/cultures.ts` existe et exporte `cropEntries`
    - `grep -q "CROP_CATALOG.map" lib/codex/cultures.ts` passe
    - `grep -q "kind: 'crop' as const" lib/codex/cultures.ts` passe
    - `grep -c "^" lib/codex/cultures.ts` ≤ 25 (fichier court, pas de logique)
    - Zéro valeur numérique hardcodée dans cultures.ts (pas de digit dans les valeurs)
    - `locales/fr/codex.json` contient les 15 IDs sous `crop.*` avec `name` et `lore` non vides
    - `locales/en/codex.json` idem (parité FR/EN totale)
    - Les 4 IDs dropOnly (`orchidee`, `rose_doree`, `truffe`, `fruit_dragon`) sont présents dans les deux fichiers
    - `npx tsc --noEmit` : zéro erreur sur `lib/codex/cultures.ts`
  </acceptance_criteria>
  <done>15 CropEntry typées + 60 textes lore (15 × 2 clés × 2 langues) écrits.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2 : Créer lib/codex/animals.ts et remplir lore FR+EN des inhabitants</name>
  <files>lib/codex/animals.ts, locales/fr/codex.json, locales/en/codex.json</files>
  <read_first>
    - lib/codex/types.ts
    - lib/mascot/types.ts (INHABITANTS lignes 241-263 — LIRE la liste exacte des IDs et vérifier combien il y en a)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md Exemple 2 (lignes 636-659) + D-05, D-15
  </read_first>
  <action>
    **2a)** D'abord, lire `lib/mascot/types.ts` lignes 241-270 et lister exactement tous les IDs INHABITANTS (le research estime 17-18 mais demande de vérifier). Noter aussi quels sont `sagaExclusive: true`.

    **2b)** Créer `lib/codex/animals.ts` :

    ```typescript
    // lib/codex/animals.ts — Habitants ferme + fantastiques + saga (source: INHABITANTS)
    import { INHABITANTS } from '../mascot/types';
    import type { AnimalEntry } from './types';

    function computeSubgroup(
      rarity: string,
      sagaExclusive: boolean
    ): 'farm' | 'fantasy' | 'saga' {
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

    **2c)** Remplir `locales/fr/codex.json` clé `animal` avec une entrée name+lore pour CHAQUE ID trouvé dans INHABITANTS (vérifier exhaustivité). Les IDs attendus (confirmer avec le fichier source) incluent typiquement :
    `poussin, poulet, canard, cochon, vache, oiseau, ecureuil, papillons, coccinelle, chat, hibou, fee, dragon, phoenix, licorne, esprit_eau, ancien_gardien` — compléter la liste en lisant INHABITANTS.

    Pour `esprit_eau` et `ancien_gardien` (sagaExclusive → dropOnly), évoquer une rencontre rare liée à une saga, sans dévoiler laquelle.

    **2d)** Remplir `locales/en/codex.json` clé `animal` avec les mêmes IDs et traductions EN.

    Style : 2-4 phrases, identique à cultures.ts. Zéro stat numérique.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const src=fs.readFileSync('lib/mascot/types.ts','utf8');const m=src.match(/INHABITANTS[\s\S]*?\];/);const ids=[...m[0].matchAll(/id:\s*'([a-z_]+)'/g)].map(x=>x[1]);const fr=require('./locales/fr/codex.json'),en=require('./locales/en/codex.json');const miss=ids.filter(id=>!fr.animal[id]?.name||!fr.animal[id]?.lore||!en.animal[id]?.name||!en.animal[id]?.lore);if(miss.length){console.error('MISSING:',miss);process.exit(1)}console.log('OK',ids.length,'animals')"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/animals.ts` existe et exporte `animalEntries`
    - `grep -q "INHABITANTS.map" lib/codex/animals.ts` passe
    - `grep -q "computeSubgroup" lib/codex/animals.ts` passe
    - `grep -q "dropOnly: inh.sagaExclusive === true" lib/codex/animals.ts` passe
    - Chaque ID extrait de `INHABITANTS` dans `lib/mascot/types.ts` a une entrée `{name, lore}` complète dans `locales/fr/codex.json` ET `locales/en/codex.json` sous `animal.*` (voir verify script)
    - `esprit_eau` et `ancien_gardien` présents avec lore non vide dans les 2 langues
    - `npx tsc --noEmit` : zéro erreur sur `lib/codex/animals.ts`
  </acceptance_criteria>
  <done>animalEntries typé généré + lore complet FR+EN pour tous les inhabitants.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3 : Créer lib/codex/loot.ts (agrégation pluies dorées CODEX-04) + lore FR+EN des 8 entries</name>
  <files>lib/codex/loot.ts, locales/fr/codex.json, locales/en/codex.json</files>
  <read_first>
    - lib/codex/types.ts (LootEntry)
    - lib/mascot/farm-engine.ts (GOLDEN_CROP_CHANCE ligne 13, GOLDEN_HARVEST_MULTIPLIER ligne 16, HARVEST_EVENTS ligne 213, RARE_SEED_DROP_RULES ligne 248)
    - .planning/phases/16-codex-contenu/16-RESEARCH.md Exemple 3 (lignes 662-699) + §Loot constantes (lignes 386-418)
  </read_first>
  <action>
    **3a)** Créer `lib/codex/loot.ts` en suivant Exemple 3 du RESEARCH :

    ```typescript
    // lib/codex/loot.ts — Loot box & raretés agrégés (per D-13, CODEX-04)
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
        kind: 'loot',
        sourceId: 'golden_crop',
        lootType: 'golden_crop',
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

    **3b)** Remplir `locales/fr/codex.json` clé `loot` avec 8 entrées :
    - `golden_crop` : name "Mutation dorée", lore explique 3% à la plantation + récolte ×5 (référence conceptuelle, pas dupliquer la valeur — mais OK en lore car D-20 interdit les textes hardcodés dans content.ts, pas dans les JSON lore)
    - `harvest_insectes` : name "Nuée d'insectes", lore évocatrice
    - `harvest_pluie_doree` : name "Pluie dorée", lore couvrant CODEX-04 (événement rare à la récolte qui multiplie le rendement)
    - `harvest_mutation_rare` : name "Mutation rare", lore
    - `seed_orchidee` : name "Orchidée mystérieuse", lore (drop rare certaines cultures)
    - `seed_rose_doree` : name "Rose dorée", lore
    - `seed_truffe` : name "Truffe parfumée", lore
    - `seed_fruit_dragon` : name "Fruit du dragon", lore (drop ultra-rare toutes cultures)

    IMPORTANT : CODEX-04 exige que la mécanique pluies dorées soit documentée — la doc vit dans `loot.golden_crop.lore` + `loot.harvest_pluie_doree.lore`. Mentionner explicitement que les valeurs exactes viennent des constantes engine (sans les copier numériquement dans le texte, OU en les copiant avec une note "valeurs de référence : voir engine").

    **3c)** Remplir `locales/en/codex.json` clé `loot` avec les mêmes 8 entrées en anglais.
  </action>
  <verify>
    <automated>node -e "const fr=require('./locales/fr/codex.json'),en=require('./locales/en/codex.json');const ids=['golden_crop','harvest_insectes','harvest_pluie_doree','harvest_mutation_rare','seed_orchidee','seed_rose_doree','seed_truffe','seed_fruit_dragon'];const miss=ids.filter(id=>!fr.loot[id]?.name||!fr.loot[id]?.lore||!en.loot[id]?.name||!en.loot[id]?.lore);if(miss.length){console.error('MISSING:',miss);process.exit(1)}console.log('OK 8 loot')"</automated>
  </verify>
  <acceptance_criteria>
    - `lib/codex/loot.ts` existe et exporte `lootEntries`
    - `grep -q "GOLDEN_CROP_CHANCE" lib/codex/loot.ts` passe
    - `grep -q "HARVEST_EVENTS" lib/codex/loot.ts` passe
    - `grep -q "RARE_SEED_DROP_RULES" lib/codex/loot.ts` passe
    - `grep -q "from '../mascot/farm-engine'" lib/codex/loot.ts` passe
    - Les 8 IDs de loot listés ci-dessus sont présents dans `locales/fr/codex.json` et `locales/en/codex.json` avec name+lore non vides (script verify)
    - `lib/codex/loot.ts` n'hardcode aucun nombre (pas de `0.03` ni `5`) — valeurs lues uniquement via les imports
    - `npx tsc --noEmit` : zéro erreur sur `lib/codex/loot.ts`
  </acceptance_criteria>
  <done>lootEntries (8) typé + lore FR+EN documentant pluies dorées (CODEX-04).</done>
</task>

</tasks>

<verification>
- 15 cropEntries + ~18 animalEntries + 8 lootEntries générés
- 4 crops dropOnly et 2 animaux sagaExclusive tracés
- Parité FR/EN 100% sur les clés créées
- tsc --noEmit vert
</verification>

<success_criteria>
CODEX-04 (pluies dorées documentées) et CODEX-05 (4 crops dropOnly tracés) adressés. Les 3 arrays compilent.
</success_criteria>

<output>
Create `.planning/phases/16-codex-contenu/16-02-SUMMARY.md` at completion.
</output>
