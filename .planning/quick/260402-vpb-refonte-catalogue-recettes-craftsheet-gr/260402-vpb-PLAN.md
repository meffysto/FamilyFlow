---
phase: quick
plan: 260402-vpb
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mascot/types.ts
  - lib/mascot/craft-engine.ts
  - components/mascot/CraftSheet.tsx
  - "app/(tabs)/tree.tsx"
  - locales/fr/common.json
  - locales/en/common.json
autonomous: true
requirements: []
must_haves:
  truths:
    - "Le catalogue CraftSheet affiche les recettes en grille 2 colonnes groupees par stade d'arbre"
    - "Les sections dont le stade depasse le stade actuel sont grisees avec cadenas"
    - "Un tap sur une carte ouvre un mini-modal avec details complets et bouton Crafter"
    - "Les chips filtre Tout / Disponibles filtrent les recettes correctement"
  artifacts:
    - path: "lib/mascot/types.ts"
      provides: "minTreeStage sur CraftRecipe"
      contains: "minTreeStage"
    - path: "lib/mascot/craft-engine.ts"
      provides: "minTreeStage rempli sur chaque recette"
      contains: "minTreeStage"
    - path: "components/mascot/CraftSheet.tsx"
      provides: "Catalogue grille par stade"
      min_lines: 200
  key_links:
    - from: "app/(tabs)/tree.tsx"
      to: "components/mascot/CraftSheet.tsx"
      via: "prop treeStage"
      pattern: "treeStage="
    - from: "components/mascot/CraftSheet.tsx"
      to: "lib/mascot/craft-engine.ts"
      via: "CRAFT_RECIPES avec minTreeStage"
      pattern: "minTreeStage"
---

<objective>
Refondre l'onglet "Catalogue" dans CraftSheet.tsx : passer d'une liste pleine largeur a une grille 2 colonnes groupee par stade d'arbre, avec filtre Tout/Disponibles, sections verrouillee/grisees, et mini-modal detail au tap.

Purpose: Rendre le catalogue plus lisible et visuellement organise, avec progression claire par stade.
Output: CraftSheet catalogue refait en grille par stade, type CraftRecipe enrichi de minTreeStage.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/mascot/types.ts
@lib/mascot/craft-engine.ts
@components/mascot/CraftSheet.tsx
@app/(tabs)/tree.tsx
@locales/fr/common.json
@locales/en/common.json

<interfaces>
<!-- Interfaces existantes consommees par le plan -->

From lib/mascot/types.ts:
```typescript
export type TreeStage = 'graine' | 'pousse' | 'arbuste' | 'arbre' | 'majestueux' | 'legendaire';

export interface CraftRecipe {
  id: string;
  labelKey: string;
  emoji: string;
  ingredients: CraftIngredient[];
  xpBonus: number;
  sellValue: number;
}

export const TREE_STAGES: TreeStageInfo[] = [
  { stage: 'graine',      minLevel: 1,  maxLevel: 2, ... },
  { stage: 'pousse',      minLevel: 3,  maxLevel: 5, ... },
  { stage: 'arbuste',     minLevel: 6,  maxLevel: 10, ... },
  { stage: 'arbre',       minLevel: 11, maxLevel: 18, ... },
  { stage: 'majestueux',  minLevel: 19, maxLevel: 30, ... },
  { stage: 'legendaire',  minLevel: 31, maxLevel: 50, ... },
];
```

From lib/mascot/farm-engine.ts:
```typescript
const stageOrder: TreeStage[] = ['graine', 'pousse', 'arbuste', 'arbre', 'majestueux', 'legendaire'];
```

CraftSheet props actuelles (tree.tsx l.1492-1507):
```typescript
<CraftSheet
  visible={showCraftSheet}
  onClose={() => setShowCraftSheet(false)}
  profileId={profile?.id ?? ''}
  coins={profile?.coins ?? 0}
  harvestInventory={profile?.harvestInventory ?? {}}
  farmInventory={profile?.farmInventory ?? { oeuf: 0, lait: 0, farine: 0, miel: 0 }}
  craftedItems={profile?.craftedItems ?? []}
  onCraft={...}
  onSellHarvest={...}
  onSellCrafted={...}
/>
```

Cles i18n existantes (craft.*):
- craft.atelier, craft.catalogue, craft.mesCreations, craft.inventaire
- craft.crafter, craft.vendre, craft.ingredients
- craft.aucuneRecette, craft.aucunItem, craft.aucuneRecolte
- craft.craftReussi, craft.venteReussie, craft.valeurVente
- craft.recipe.* (toutes les recettes)

Cles i18n stades existantes (dans "mascot" namespace du meme fichier):
- mascot.stages.graine/pousse/arbuste/arbre/majestueux/legendaire (ligne ~3289 fr)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter minTreeStage sur CraftRecipe et remplir CRAFT_RECIPES</name>
  <files>lib/mascot/types.ts, lib/mascot/craft-engine.ts</files>
  <action>
1. Dans `lib/mascot/types.ts`, ajouter `minTreeStage: TreeStage` a l'interface `CraftRecipe` (apres `sellValue`).

2. Dans `lib/mascot/craft-engine.ts`, ajouter `minTreeStage` sur chaque entree de `CRAFT_RECIPES` selon ce mapping exact :
   - soupe, bouquet, crepe → 'pousse'
   - fromage, gratin, omelette → 'arbuste'
   - pain, confiture, popcorn, gateau → 'arbre'
   - soupe_citrouille, tarte_citrouille → 'majestueux'
   - hydromel, nougat, pain_epices → 'arbuste'
   - parfum_orchidee → 'arbuste'
   - confiture_royale → 'arbre'
   - risotto_truffe → 'majestueux'

3. Exporter `TREE_STAGE_ORDER` depuis types.ts (s'il n'existe pas deja) — un tableau constant ordonne :
   ```typescript
   export const TREE_STAGE_ORDER: TreeStage[] = ['graine', 'pousse', 'arbuste', 'arbre', 'majestueux', 'legendaire'];
   ```
   Ceci centralise l'ordre utilise dans farm-engine.ts (stageOrder local) et le nouveau CraftSheet. Ne pas modifier farm-engine.ts pour l'instant — le refactoring sera un quick task futur.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "craft-engine|types\.ts" | head -5; echo "exit: $?"</automated>
  </verify>
  <done>CraftRecipe a minTreeStage: TreeStage, chaque recette dans CRAFT_RECIPES a la valeur correcte, TREE_STAGE_ORDER exporte, tsc passe.</done>
</task>

<task type="auto">
  <name>Task 2: Refondre renderCatalogue en grille par stade + mini-modal + i18n</name>
  <files>components/mascot/CraftSheet.tsx, app/(tabs)/tree.tsx, locales/fr/common.json, locales/en/common.json</files>
  <action>
**A. Nouvelles cles i18n** — ajouter dans l'objet `craft` des deux fichiers locales :
- FR: `"filtreToutes": "Tout"`, `"filtreDisponibles": "Disponibles ({{count}})"`, `"sectionLocked": "Debloque au stade {{stage}}"`, `"detailTitle": "Details"`, `"hintPlant": "Plante {{name}} sur une parcelle"`, `"hintBuilding": "Produit par {{name}}"`, `"niveauRequis": "niv. {{level}}+"`
- EN: `"filtreToutes": "All"`, `"filtreDisponibles": "Available ({{count}})"`, `"sectionLocked": "Unlocks at {{stage}} stage"`, `"detailTitle": "Details"`, `"hintPlant": "Plant {{name}} on a plot"`, `"hintBuilding": "Produced by {{name}}"`, `"niveauRequis": "lvl {{level}}+"`
- Note : `hintPlant` et `hintBuilding` existent deja avec des defaultValue inline dans CraftSheet — les ajouter comme vraies cles et retirer les defaultValue du code.

**B. Ajouter prop `treeStage` a CraftSheetProps** :
```typescript
interface CraftSheetProps {
  // ... existants
  treeStage: TreeStage;
}
```
Importer `TreeStage`, `TREE_STAGES`, `TREE_STAGE_ORDER` depuis `../../lib/mascot/types`.

**C. Passer la prop dans tree.tsx** (l.1492) :
```typescript
<CraftSheet
  // ... existants
  treeStage={profile?.tree?.stage ?? 'graine'}
/>
```

**D. Ajouter etats dans CraftSheet** :
- `filterMode: 'all' | 'craftable'` (defaut `'all'`)
- `selectedRecipe: CraftRecipe | null` (defaut `null`)

**E. Refondre `renderCatalogue()`** — remplacer entierement le contenu actuel :

1. **Chips filtre** en haut du ScrollView (hors scroll) : deux Chip "Tout" et "Disponibles (N)" cote-a-cote. Le chip actif utilise `backgroundColor: primary, color: colors.onPrimary`, l'inactif `backgroundColor: tint, color: primary`. Utiliser `Spacing.sm` gap, `Radius.full` pour les chips, `Spacing.lg` padding horizontal.

2. **Calculer `groupedByStage`** avec useMemo : iterer `TREE_STAGE_ORDER`, pour chaque stade filtrer les recettes CRAFT_RECIPES ayant ce minTreeStage, appliquer le filterMode ('craftable' filtre seulement `canCraft === true`). Retourner un tableau de `{ stage: TreeStage, stageInfo: TreeStageInfo, recipes: CraftRecipe[], locked: boolean }` ou `locked = stageOrder.indexOf(stage) > stageOrder.indexOf(treeStage)`. Ne pas inclure les stades sans recettes (sauf si locked et qu'il y a des recettes originales avant filtre).

3. **Emojis par stade** pour les headers de section :
   - graine: '🌱', pousse: '🌿', arbuste: '🌳', arbre: '🏔️', majestueux: '👑', legendaire: '⭐'

4. **Header section sticky** par stade : `<View>` avec flexDirection row, alignItems center, backgroundColor `colors.bg`, paddingVertical `Spacing.sm`, paddingHorizontal `Spacing.lg`. Afficher : emoji stade + label stade (via `t(stageInfo.labelKey)`) en `FontSize.body` `FontWeight.bold` + "niv. {minLevel}+" en `FontSize.caption` `colors.textMuted` + badge count (nombre de recettes) a droite en `FontSize.caption`. Si locked, ajouter un badge '🔒' a gauche.

5. **Grille 2 colonnes** : `View` avec `flexDirection: 'row', flexWrap: 'wrap'` sous chaque header. Chaque carte = `width: '48%'` avec `marginHorizontal: '1%'`, `marginBottom: Spacing.sm`.

6. **Carte compacte** par recette :
   - Container : `backgroundColor: colors.card`, `borderRadius: Radius.lg`, `padding: Spacing.md`, `Shadows.sm`. Si craftable : `borderColor: colors.success, borderWidth: 1.5`. Si locked : `opacity: 0.5`.
   - Ligne 1 : emoji (fontSize 32) + badge "✓" vert si craftable (position absolute top-right, petit cercle `backgroundColor: colors.success`, 18x18, texte blanc)
   - Ligne 2 : nom (`FontSize.sm`, `FontWeight.semibold`, `colors.text`, `numberOfLines: 1`)
   - Ligne 3 : valeur `{sellValue} 🍃 +{xpBonus}XP` en `FontSize.micro`, `colors.textMuted`
   - Ligne 4 : dots ingredients — une rangee de petits cercles (8x8, borderRadius 4) colores : `colors.success` si have >= need, `colors.error` sinon. Gap `Spacing.xs`.
   - Si locked : badge '🔒' overlay centre (position absolute, fontSize 20).
   - `onPress` : si pas locked, `setSelectedRecipe(recipe)`. Si locked, ne rien faire.
   - Utiliser `TouchableOpacity` avec `activeOpacity: 0.7`.
   - Entree animee : `FadeInDown.delay(idx * 40).duration(250)` (idx = index dans la section, pas global — eviter des delais trop longs).

7. **Mini-modal interne** (quand `selectedRecipe !== null`) :
   - Utiliser un `Modal` avec `transparent: true, animationType: 'fade'`.
   - Overlay : `backgroundColor: 'rgba(0,0,0,0.4)'`, flex 1, justifyContent center, alignItems center.
   - Tap sur overlay : `setSelectedRecipe(null)`.
   - Contenu : `View` avec `backgroundColor: colors.card`, `borderRadius: Radius.xl`, `padding: Spacing.xl`, `width: '85%'`, `maxHeight: '60%'`, `Shadows.lg`.
   - Header : emoji (48px) + nom (`FontSize.titleLg`, `FontWeight.bold`) + valeur/XP.
   - Liste ingredients complete (reprendre le pattern existant du renderCatalogue actuel : emoji + nom + have/need colore + hints). Garder les hints `hintPlant` et `hintBuilding` mais utiliser les vraies cles i18n au lieu des defaultValue.
   - Bouton "Crafter" en bas : meme style que l'actuel `craftBtn` (`backgroundColor: primary` si craftable, `colors.cardAlt` sinon). Appeler `handleCraft(selectedRecipe)` puis `setSelectedRecipe(null)`.
   - Bouton fermer (X) en haut a droite ou tap overlay.

**F. Styles** — ajouter les nouveaux styles dans le StyleSheet.create existant. Prefixer les noms avec `cat` (catalogue) pour distinguer : `catChipRow`, `catChip`, `catChipActive`, `catChipText`, `catSectionHeader`, `catGrid`, `catCard`, `catCardEmoji`, `catCardName`, `catCardValue`, `catDotRow`, `catDot`, `catLockBadge`, `catCraftableBadge`, `catModalOverlay`, `catModalContent`, etc.

**G. NE PAS toucher** renderInventaire() ni renderCreations() — uniquement renderCatalogue().

**Contraintes :**
- Toutes les couleurs via `useThemeColors()` — aucun hardcoded sauf le rgba overlay du modal.
- Tous les spacing via `Spacing.*`, `Radius.*`, `FontSize.*`, `FontWeight.*` de constants/.
- Garder le meme pattern FadeInDown pour les animations d'entree.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang\|useVault" | tail -5; echo "exit: $?"</automated>
  </verify>
  <done>Le catalogue CraftSheet affiche une grille 2 colonnes groupee par stade d'arbre. Les sections au-dela du stade actuel sont grisees avec cadenas. Un tap ouvre un mini-modal avec details complets et bouton Crafter. Les chips Tout/Disponibles filtrent correctement. La prop treeStage est passee depuis tree.tsx. Cles i18n ajoutees en FR et EN. Les onglets Inventaire et Mes creations sont inchanges. tsc passe.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe (en ignorant les erreurs pre-existantes MemoryEditor/cooklang/useVault)
- CraftSheet s'ouvre avec la grille par stade
- Sections lockees sont visuellement distinctes (grisees + cadenas)
- Tap sur carte non-lockee ouvre le mini-modal detail
- Filtre Disponibles ne montre que les recettes craftables
</verification>

<success_criteria>
- CraftRecipe.minTreeStage existe et est rempli pour les 18 recettes
- CraftSheet catalogue = grille 2 colonnes groupee par stade
- Sections verrouillees grisees avec badges cadenas
- Mini-modal detail avec ingredients + bouton Crafter fonctionnel
- Chips filtre Tout/Disponibles operationnels
- Prop treeStage passee depuis tree.tsx
- Cles i18n fr + en ajoutees
- Onglets Inventaire et Mes creations inchanges
</success_criteria>

<output>
After completion, create `.planning/quick/260402-vpb-refonte-catalogue-recettes-craftsheet-gr/260402-vpb-SUMMARY.md`
</output>
