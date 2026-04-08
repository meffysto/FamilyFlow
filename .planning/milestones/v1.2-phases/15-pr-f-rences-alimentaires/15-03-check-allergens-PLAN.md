---
phase: 15-pr-f-rences-alimentaires
plan: 03
type: tdd
wave: 2
depends_on: [15-01]
files_modified:
  - lib/dietary.ts
  - lib/__tests__/dietary.test.ts
autonomous: true
requirements: [PREF-09, ARCH-03]

must_haves:
  truths:
    - "checkAllergens détecte une allergie évidente (arachides dans une recette contenant cacahuète)"
    - "checkAllergens détecte une intolérance évidente (lactose dans une recette contenant crème)"
    - "checkAllergens évite les faux positifs (aucune allergie au lait → pas de conflit sur une recette au beurre quand le profil n'a aucune contrainte lait)"
    - "checkAllergens détecte un faux négatif caché (yaourt → lait via aliases)"
    - "checkAllergens retourne [] pour une recette sans ingrédient critique pour les profils donnés"
    - "Le matching est conservateur : en cas d'ambiguïté, le conflit est déclenché"
  artifacts:
    - path: "lib/dietary.ts"
      provides: "checkAllergens fonction pure + helpers normalize/match"
      exports: ["checkAllergens", "normalizeText"]
    - path: "lib/__tests__/dietary.test.ts"
      provides: "Minimum 5 tests de matching allergène (ARCH-03)"
      contains: "checkAllergens"
  key_links:
    - from: "lib/dietary.ts checkAllergens"
      to: "lib/dietary/catalogs.ts EU_ALLERGENS"
      via: "import pour résoudre les IDs canoniques en aliases"
      pattern: "EU_ALLERGENS|COMMON_INTOLERANCES"
    - from: "lib/dietary.ts checkAllergens"
      to: "lib/cooklang.ts AppRecipe"
      via: "lecture des ingrédients"
      pattern: "AppRecipe|ingredients"
---

<objective>
Implémenter la fonction pure `checkAllergens(recipe, profileIds, profiles, guests)` qui croise les ingrédients d'une recette avec les contraintes des convives et retourne la liste des conflits. TDD strict : la sécurité allergène (ARCH-03) est le cœur de cette phase.

Purpose: Fonction réutilisée par l'écran recette, le bandeau et le planificateur de repas. Tests exhaustifs obligatoires (ARCH-03 : minimum 5 cas).
Output: `lib/dietary.ts` + tests couvrant allergie/intolérance/faux positif évité/faux négatif détecté/recette saine.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/15-pr-f-rences-alimentaires/15-CONTEXT.md
@.planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md
@lib/dietary/types.ts
@lib/dietary/catalogs.ts
@lib/cooklang.ts
@CLAUDE.md

<interfaces>
<!-- Types from Plan 01 -->
From lib/dietary/types.ts:
```typescript
export type DietarySeverity = 'allergie' | 'intolerance' | 'regime' | 'aversion';
export interface DietaryItem { id: string; label: string; aliases?: string[]; }
export interface DietaryConflict {
  ingredientName: string;
  matchedAllergen: string;
  severity: DietarySeverity;
  profileIds: string[];
  profileNames: string[];
}
export interface GuestProfile { id: string; name: string; foodAllergies: string[]; ... }
```

<!-- Profile extended (Plan 02) -->
Profile contains: foodAllergies?: string[], foodIntolerances?: string[], foodRegimes?: string[], foodAversions?: string[]

<!-- AppRecipe / AppIngredient from cooklang -->
From lib/cooklang.ts : AppRecipe has `ingredients: AppIngredient[]` where `AppIngredient.name: string`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1: TDD checkAllergens — écrire les tests puis implémenter</name>
  <files>lib/__tests__/dietary.test.ts, lib/dietary.ts</files>
  <read_first>
    - lib/dietary/types.ts
    - lib/dietary/catalogs.ts (aliases FR)
    - lib/cooklang.ts (AppRecipe, AppIngredient structure)
    - .planning/phases/15-pr-f-rences-alimentaires/15-RESEARCH.md (Pattern 3 + "Normalisation pour matching")
    - lib/__tests__/cooklang.test.ts (pattern existant Jest, fixtures)
  </read_first>
  <behavior>
    RED phase (tests d'abord, tous doivent échouer) — minimum 5 tests ARCH-03 :

    - Test 1 "allergie évidente" : profil avec `foodAllergies: ['arachides']`, recette avec ingrédient "cacahuètes grillées" → retourne 1 conflit `severity: 'allergie'`, `matchedAllergen: 'arachides'`, `profileIds: ['profile1']`
    - Test 2 "intolérance évidente" : profil avec `foodIntolerances: ['lactose']`, recette avec ingrédient "crème fraîche" → retourne 1 conflit `severity: 'intolerance'`
    - Test 3 "faux positif évité" : profil SANS aucune contrainte, recette avec "beurre" → retourne `[]`
    - Test 4 "faux négatif détecté" : profil avec `foodAllergies: ['lait']`, recette avec "yaourt nature" → retourne 1 conflit (alias yaourt→lait)
    - Test 5 "recette saine" : profil avec `foodAllergies: ['gluten']`, recette avec uniquement "riz" et "courgette" → retourne `[]`
    - Test 6 bonus : recette avec 1 ingrédient qui matche PLUSIEURS profils → `profileIds` contient les 2 IDs
    - Test 7 bonus "conservatisme" : profil avec `foodAllergies: ['lait']`, recette avec "mozzarella di bufala" → retourne 1 conflit (substring match sur alias "mozzarella")

    GREEN phase : implémenter `checkAllergens` jusqu'à ce que les 7 tests passent.
  </behavior>
  <action>
    Étape RED :
    1. Créer `lib/__tests__/dietary.test.ts` avec les 7 tests ci-dessus en utilisant des fixtures AppRecipe minimales (stub d'`AppRecipe` avec `ingredients: [{ name: 'cacahuètes grillées', quantity: undefined }]` — vérifier la vraie forme dans lib/cooklang.ts). Utiliser des noms génériques (Lucas, Emma).
    2. Lancer `npx jest lib/__tests__/dietary.test.ts` → les tests échouent (fichier `lib/dietary.ts` n'existe pas encore).
    3. Commit RED : `test(15-03): tests RED pour checkAllergens`.

    Étape GREEN :
    4. Créer `lib/dietary.ts` :
    ```typescript
    import type { DietarySeverity, DietaryConflict, GuestProfile } from './dietary/types';
    import type { Profile } from './types';
    import type { AppRecipe } from './cooklang';
    import { EU_ALLERGENS, COMMON_INTOLERANCES, COMMON_REGIMES } from './dietary/catalogs';

    export function normalizeText(text: string): string {
      return text.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['']/g, "'")
        .trim();
    }

    // Résout un ID utilisateur (ex: 'lait') vers la liste d'aliases depuis le catalogue.
    // Si l'ID n'est pas dans un catalogue (texte libre), retourne juste [id].
    function resolveConstraintAliases(constraintId: string, severity: DietarySeverity): string[] { ... }

    export function checkAllergens(
      recipe: AppRecipe,
      profileIds: string[],
      allProfiles: Profile[],
      guests: GuestProfile[],
    ): DietaryConflict[] {
      // 1. Combiner profiles+guests filtrés par profileIds
      // 2. Pour chaque convive, collecter ses contraintes par sévérité
      // 3. Pour chaque ingrédient de recipe, normaliser
      // 4. Pour chaque contrainte, résoudre les aliases puis substring match
      // 5. Regrouper les matches : même ingredientName+matchedAllergen+severity → fusionner profileIds
      // 6. Retourner les conflits
    }
    ```
    5. Itérer jusqu'à ce que tous les tests passent.
    6. Commit GREEN : `feat(15-03): implémente checkAllergens (PREF-09 + ARCH-03)`.

    Règles :
    - Conservatisme : un match ambigu déclenche le conflit
    - Pas de fuzzy matching probabiliste (substring uniquement)
    - Aversions traitées comme une sévérité distincte, même chemin de matching
    - Commentaires en français
  </action>
  <verify>
    <automated>npx jest lib/__tests__/dietary.test.ts &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `lib/dietary.ts` existe et exporte `checkAllergens` et `normalizeText`
    - `lib/__tests__/dietary.test.ts` contient au moins 5 tests (grep `it\(` ≥ 5)
    - `grep -q "faux positif" lib/__tests__/dietary.test.ts`
    - `grep -q "faux négatif\|yaourt" lib/__tests__/dietary.test.ts`
    - `npx jest lib/__tests__/dietary.test.ts` : TOUS les tests passent
    - `grep -q "import.*EU_ALLERGENS" lib/dietary.ts`
    - `grep -q "normalize('NFD')" lib/dietary.ts`
    - `npx tsc --noEmit` passe
  </acceptance_criteria>
  <done>checkAllergens passe tous les tests ARCH-03, matching conservateur, zéro nouvelle dépendance npm</done>
</task>

</tasks>

<verification>
- Tous les tests `dietary.test.ts` passent
- ARCH-03 satisfait : ≥5 cas (allergie, intolérance, faux positif évité, faux négatif détecté, recette saine)
- ARCH-05 respecté : aucun import npm nouveau
- `npx tsc --noEmit` passe
</verification>

<success_criteria>
Les plans suivants peuvent importer `checkAllergens` depuis `lib/dietary` et obtenir des conflits fiables pour afficher le bandeau et les badges inline.
</success_criteria>

<output>
`.planning/phases/15-pr-f-rences-alimentaires/15-03-SUMMARY.md`
</output>
