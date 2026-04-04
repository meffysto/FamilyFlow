---
phase: quick
plan: 260404-hfb
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mascot/craft-engine.ts
  - locales/fr/common.json
  - locales/en/common.json
autonomous: true
requirements: [quick-260404-hfb]
must_haves:
  truths:
    - "Deux nouvelles recettes craft utilisent le tournesol (sunflower)"
    - "Les recettes sont visibles dans le catalogue CraftSheet au stade arbre"
    - "Les recettes peuvent etre craftees avec les bons ingredients"
  artifacts:
    - path: "lib/mascot/craft-engine.ts"
      provides: "huile_tournesol et brioche_tournesol dans CRAFT_RECIPES"
      contains: "huile_tournesol"
    - path: "locales/fr/common.json"
      provides: "Labels francais des deux recettes"
      contains: "huile_tournesol"
    - path: "locales/en/common.json"
      provides: "Labels anglais des deux recettes"
      contains: "huile_tournesol"
  key_links:
    - from: "lib/mascot/craft-engine.ts"
      to: "locales/fr/common.json"
      via: "labelKey craft.recipe.huile_tournesol"
      pattern: "craft\\.recipe\\.huile_tournesol"
---

<objective>
Ajouter deux recettes craft utilisant le tournesol (sunflower) dans le moteur de craft.

Purpose: Le tournesol (culture-3) n'a aucune recette — il faut lui donner une utilite dans le systeme de craft pour motiver sa culture.
Output: Deux recettes dans CRAFT_RECIPES + cles i18n FR/EN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/mascot/craft-engine.ts
@lib/mascot/types.ts
@locales/fr/common.json
@locales/en/common.json

<interfaces>
From lib/mascot/types.ts:
```typescript
export interface CraftRecipe {
  id: string;
  labelKey: string;
  emoji: string;
  ingredients: CraftIngredient[];
  xpBonus: number;
  sellValue: number;
  minTreeStage: TreeStage;
}

export interface CraftIngredient {
  itemId: string;
  quantity: number;
  source: 'crop' | 'building';
}
```

CROP_CATALOG sunflower: `{ id: 'sunflower', harvestReward: 100, tasksPerStage: 2, minTreeStage: 'pousse', cost: 20, techRequired: 'culture-3' }`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter les deux recettes tournesol dans CRAFT_RECIPES + i18n</name>
  <files>lib/mascot/craft-engine.ts, locales/fr/common.json, locales/en/common.json</files>
  <action>
1. Dans `lib/mascot/craft-engine.ts`, ajouter deux recettes dans le tableau `CRAFT_RECIPES` dans la section `// -- Arbre (niv 11-18)` (apres `popcorn`, avant `gateau`). Le tournesol est debloque par culture-3 qui est un noeud avance, donc placer au stade `arbre` :

```typescript
{
  id: 'huile_tournesol',
  labelKey: 'craft.recipe.huile_tournesol',
  emoji: '🫙',
  ingredients: [
    { itemId: 'sunflower', quantity: 2, source: 'crop' },
  ],
  xpBonus: 20,
  sellValue: 400, // (100+100) x 2
  minTreeStage: 'arbre',
},
{
  id: 'brioche_tournesol',
  labelKey: 'craft.recipe.brioche_tournesol',
  emoji: '🥐',
  ingredients: [
    { itemId: 'sunflower', quantity: 1, source: 'crop' },
    { itemId: 'farine', quantity: 1, source: 'building' },
  ],
  xpBonus: 25,
  sellValue: 380, // (100+90) x 2
  minTreeStage: 'arbre',
},
```

2. Dans `locales/fr/common.json`, ajouter dans l'objet `craft.recipe` (apres `risotto_truffe`) :
```json
"huile_tournesol": "Huile de tournesol",
"brioche_tournesol": "Brioche au tournesol"
```

3. Dans `locales/en/common.json`, ajouter dans l'objet `craft.recipe` (apres `risotto_truffe`) :
```json
"huile_tournesol": "Sunflower Oil",
"brioche_tournesol": "Sunflower Brioche"
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Les deux recettes tournesol apparaissent dans CRAFT_RECIPES avec les bons ingredients, sellValue, xpBonus, minTreeStage arbre, et les cles i18n existent en FR et EN.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` compile sans nouvelles erreurs
- CRAFT_RECIPES contient 'huile_tournesol' et 'brioche_tournesol'
- Les labelKey correspondent aux cles ajoutees dans les deux fichiers de traduction
</verification>

<success_criteria>
- Deux recettes craft tournesol dans CRAFT_RECIPES au stade arbre
- Cles i18n presentes en FR et EN
- TypeScript compile
</success_criteria>

<output>
After completion, create `.planning/quick/260404-hfb-ajouter-deux-recettes-craft-tournesol-da/260404-hfb-SUMMARY.md`
</output>
