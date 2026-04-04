---
phase: quick
plan: 260404-kdk
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mascot/craft-engine.ts
autonomous: true
must_haves:
  truths:
    - "Fromage requiert Lait x3 (au lieu de x2)"
    - "Nougat requiert Miel x2 (au lieu de x1)"
    - "17 recettes ont leur sellValue mis a jour"
    - "Parfum Orchidee, Confiture Royale, Risotto Truffe restent inchanges"
  artifacts:
    - path: "lib/mascot/craft-engine.ts"
      provides: "Catalogue CRAFT_RECIPES reequilibre"
  key_links: []
---

<objective>
Reequilibrer les recettes de la ferme : ajuster les ingredients de 2 recettes et les prix de vente de 17 recettes dans CRAFT_RECIPES.

Purpose: Equilibrage economique du systeme ferme/craft.
Output: craft-engine.ts mis a jour avec les nouvelles valeurs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/mascot/craft-engine.ts
</context>

<tasks>

<task type="auto">
  <name>Tache 1: Reequilibrer ingredients et prix des recettes ferme</name>
  <files>lib/mascot/craft-engine.ts</files>
  <action>
Dans le tableau CRAFT_RECIPES de lib/mascot/craft-engine.ts, appliquer ces modifications EXACTES :

**Changements d'ingredients :**
- `fromage` (ligne ~69) : changer `lait` quantity de 2 a 3
- `nougat` (ligne ~118) : changer `miel` quantity de 1 a 2

**Changements de sellValue (prix de vente) :**
- `soupe` : 120 → 150
- `bouquet` : 190 → 200
- `crepe` : 240 → 220
- `fromage` : 400 → 480
- `gratin` : 430 → 440
- `omelette` : 520 → 440
- `hydromel` : 720 → 660
- `nougat` : 580 → 760
- `pain_epices` : 600 → 560
- `pain` : 440 → 480
- `confiture` : 480 → 460
- `popcorn` : 600 → 540
- `huile_tournesol` : 400 → 500
- `brioche_tournesol` : 380 → 440
- `gateau` : 580 → 540
- `soupe_citrouille` : 600 → 560
- `tarte_citrouille` : 740 → 700

Mettre a jour les commentaires de calcul a cote des sellValue pour refleter les nouvelles valeurs.

**NE PAS TOUCHER :** parfum_orchidee (sellValue 1200), confiture_royale (sellValue 1500), risotto_truffe (sellValue 2000).
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Les 2 changements d'ingredients et 17 changements de prix sont appliques. Les 3 recettes exclues sont inchangees. tsc compile sans erreur.</done>
</task>

</tasks>

<verification>
- npx tsc --noEmit passe sans nouvelle erreur
- grep sellValue sur les 17 recettes modifiees confirme les nouvelles valeurs
- grep sellValue sur parfum_orchidee/confiture_royale/risotto_truffe confirme valeurs inchangees (1200/1500/2000)
</verification>

<success_criteria>
- craft-engine.ts contient les 19 modifications exactes (2 ingredients + 17 prix)
- Les 3 recettes exclues sont intactes
- Le projet compile
</success_criteria>

<output>
After completion, create `.planning/quick/260404-kdk-r-quilibrer-recettes-ferme-prix-et-ingr-/260404-kdk-SUMMARY.md`
</output>
