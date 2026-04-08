---
phase: 15-pr-f-rences-alimentaires
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/dietary/types.ts
  - lib/dietary/catalogs.ts
autonomous: true
requirements: [PREF-01, PREF-03]

must_haves:
  truths:
    - "Les 4 sévérités (allergie/intolerance/regime/aversion) sont définies comme union TypeScript exportée"
    - "Les 14 allergènes UE sont listés avec IDs stables et aliases FR"
    - "Un catalogue d'intolérances courantes et un catalogue de régimes existent avec IDs canoniques"
  artifacts:
    - path: "lib/dietary/types.ts"
      provides: "DietarySeverity, DietaryItem, DietaryConflict, GuestProfile types"
      exports: ["DietarySeverity", "DietaryItem", "DietaryConflict", "GuestProfile"]
    - path: "lib/dietary/catalogs.ts"
      provides: "EU_ALLERGENS (14), COMMON_INTOLERANCES, COMMON_REGIMES"
      exports: ["EU_ALLERGENS", "COMMON_INTOLERANCES", "COMMON_REGIMES"]
  key_links:
    - from: "lib/dietary/catalogs.ts"
      to: "lib/dietary/types.ts"
      via: "import type { DietaryItem }"
      pattern: "import.*DietaryItem.*from.*types"
---

<objective>
Poser les fondations typées et les catalogues canoniques pour toute la phase 15.

Purpose: Tous les autres plans (parser, checkAllergens, UI, voix) importent depuis ces fichiers. Doit être livré en premier, sans aucune dépendance.
Output: `lib/dietary/types.ts` + `lib/dietary/catalogs.ts`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md
@.planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md
@CLAUDE.md

<interfaces>
<!-- Profile type existing contract for reference -->
From lib/types.ts ligne 67:
```typescript
export interface Profile {
  id: string;
  name: string;
  role: 'enfant' | 'ado' | 'adulte';
  // ...
}
```
Le nouveau `GuestProfile` NE doit PAS étendre Profile (invités sans gamification).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tâche 1: Créer lib/dietary/types.ts avec les types de base</name>
  <files>lib/dietary/types.ts</files>
  <read_first>
    - lib/types.ts (voir l'interface Profile pour le contrat existant)
    - .planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md (sections Pattern 3 + catalogues)
  </read_first>
  <action>
    Créer le fichier `lib/dietary/types.ts` qui exporte :

    1. `export type DietarySeverity = 'allergie' | 'intolerance' | 'regime' | 'aversion';` (per PREF-01, D-04)
    2. `export interface DietaryItem { id: string; label: string; aliases?: string[]; }` — entrée de catalogue canonique
    3. `export interface DietaryConflict { ingredientName: string; matchedAllergen: string; severity: DietarySeverity; profileIds: string[]; profileNames: string[]; }` — résultat de checkAllergens. `profileNames` permet l'affichage direct dans le bandeau sans lookup.
    4. `export interface GuestProfile { id: string; name: string; foodAllergies: string[]; foodIntolerances: string[]; foodRegimes: string[]; foodAversions: string[]; }` — pas de gamification, pas de role, pas d'avatar (per D-03, PREF-06)
    5. `export interface DietaryExtraction { profileId: string | null; profileName: string; category: DietarySeverity; item: string; confidence: 'high' | 'medium' | 'low'; }` — sortie IA vocale pour Plan 06 (per D-13/D-14)

    Commentaires en français. Aucun import runtime. Fichier purement déclaratif.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export type DietarySeverity = 'allergie' | 'intolerance' | 'regime' | 'aversion'" lib/dietary/types.ts`
    - `grep -q "export interface DietaryItem" lib/dietary/types.ts`
    - `grep -q "export interface DietaryConflict" lib/dietary/types.ts`
    - `grep -q "export interface GuestProfile" lib/dietary/types.ts`
    - `grep -q "export interface DietaryExtraction" lib/dietary/types.ts`
    - `npx tsc --noEmit` passe sans erreur nouvelle
  </acceptance_criteria>
  <done>Fichier créé, types exportés, tsc passe</done>
</task>

<task type="auto">
  <name>Tâche 2: Créer lib/dietary/catalogs.ts avec les 3 catalogues canoniques</name>
  <files>lib/dietary/catalogs.ts</files>
  <read_first>
    - lib/dietary/types.ts (créé à la tâche 1)
    - .planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md (section "Catalogue 14 allergènes UE")
    - .planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md (D-05 pour listes intolérances/régimes)
  </read_first>
  <action>
    Créer `lib/dietary/catalogs.ts` qui importe `DietaryItem` depuis `./types` et exporte :

    1. `EU_ALLERGENS: DietaryItem[]` — EXACTEMENT les 14 allergènes UE suivants avec ces IDs canoniques (stables, ne jamais renommer) : `gluten`, `crustaces`, `oeufs`, `poissons`, `arachides`, `soja`, `lait`, `fruits_a_coque`, `celeri`, `moutarde`, `sesame`, `sulfites`, `lupin`, `mollusques`. Chaque entrée a `label` (FR) + `aliases` FR. Reprendre EXACTEMENT les aliases listés dans 15-RESEARCH.md section "Catalogue 14 allergènes UE" (arachides → cacahuète/cacahouète ; lait → beurre/crème/yaourt/fromage/mascarpone/mozzarella/ricotta/ghee/caséine/lactose/lactosérum ; gluten → blé/farine/orge/seigle/épeautre/seitan/pain/pâtes/semoule/boulgour ; œufs → mayonnaise/meringue/hollandaise ; fruits_a_coque → noisette/noix/amande/cajou/pistache/noix de pécan/macadamia/praline ; etc).

    2. `COMMON_INTOLERANCES: DietaryItem[]` — minimum 8 items : `lactose`, `gluten_ncg` (gluten non cœliaque), `fructose`, `histamine`, `fodmap`, `sorbitol`, `cafeine`, `sulfites_intol`. Label FR + aliases si pertinent.

    3. `COMMON_REGIMES: DietaryItem[]` — minimum 8 items : `vegetarien`, `vegan`, `halal`, `casher`, `sans_porc`, `sans_alcool`, `pescetarien`, `sans_boeuf`. Label FR. Les aliases restent minimaux car ce sont des choix déclaratifs (pas de matching d'ingrédient).

    4. Aversions : PAS de catalogue (per D-05 : texte libre uniquement). Ne pas exporter de catalogue aversions.

    5. Helper `export function findCatalogForSeverity(severity: DietarySeverity): DietaryItem[]` qui retourne `EU_ALLERGENS` pour 'allergie', `COMMON_INTOLERANCES` pour 'intolerance', `COMMON_REGIMES` pour 'regime', `[]` pour 'aversion'. Utilisé par l'autocomplete de l'écran dietary.tsx.

    Commentaires en français. Aucun import runtime sauf le type.
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; node -e "const c = require('./lib/dietary/catalogs.ts'); /* ts file, use grep instead */"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "id: '" lib/dietary/catalogs.ts` retourne au moins 30 (14 allergènes + 8 intolérances + 8 régimes)
    - `grep -q "id: 'gluten'" lib/dietary/catalogs.ts` et `grep -q "id: 'arachides'" lib/dietary/catalogs.ts` et `grep -q "id: 'lait'" lib/dietary/catalogs.ts`
    - `grep -q "id: 'fruits_a_coque'" lib/dietary/catalogs.ts` (underscore, pas tiret)
    - `grep -q "id: 'lactose'" lib/dietary/catalogs.ts` (intolérances)
    - `grep -q "id: 'vegetarien'" lib/dietary/catalogs.ts` (régimes)
    - `grep -q "cacahuète" lib/dietary/catalogs.ts` (alias arachides)
    - `grep -q "beurre" lib/dietary/catalogs.ts` (alias lait)
    - `grep -q "export function findCatalogForSeverity" lib/dietary/catalogs.ts`
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>3 catalogues exportés avec IDs canoniques stables, aliases FR, tsc passe</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans erreur nouvelle
- Les 14 allergènes UE sont présents avec IDs exactement conformes à PREF-03
- Les aliases FR couvrent les dérivés courants (sécurité PREF-11 : faux positif acceptable)
</verification>

<success_criteria>
Tous les plans suivants peuvent importer `DietarySeverity`, `DietaryItem`, `DietaryConflict`, `GuestProfile`, `DietaryExtraction` depuis `lib/dietary/types` et `EU_ALLERGENS`, `COMMON_INTOLERANCES`, `COMMON_REGIMES`, `findCatalogForSeverity` depuis `lib/dietary/catalogs`.
</success_criteria>

<output>
Après complétion, créer `.planning/phases/15-pr-f-rences-alimentaires/15-01-SUMMARY.md`
</output>
