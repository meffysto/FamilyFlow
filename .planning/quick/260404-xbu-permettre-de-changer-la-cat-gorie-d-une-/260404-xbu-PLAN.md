---
phase: quick-260404-xbu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/useVault.ts
  - components/RecipeViewer.tsx
  - app/(tabs)/meals.tsx
autonomous: true
requirements: [move-recipe-category]
must_haves:
  truths:
    - "L'utilisateur peut changer la categorie d'une recette depuis RecipeViewer"
    - "Le fichier .cook et le .jpg associe sont deplaces vers le nouveau dossier"
    - "L'etat local recipes[] est mis a jour immediatement apres le deplacement"
  artifacts:
    - path: "hooks/useVault.ts"
      provides: "moveRecipeCategory function"
      contains: "moveRecipeCategory"
    - path: "components/RecipeViewer.tsx"
      provides: "Bouton categorie cliquable avec picker ActionSheet"
      contains: "onChangeCategory"
    - path: "app/(tabs)/meals.tsx"
      provides: "Wiring onChangeCategory prop vers moveRecipeCategory"
      contains: "moveRecipeCategory"
  key_links:
    - from: "components/RecipeViewer.tsx"
      to: "app/(tabs)/meals.tsx"
      via: "onChangeCategory callback prop"
      pattern: "onChangeCategory"
    - from: "app/(tabs)/meals.tsx"
      to: "hooks/useVault.ts"
      via: "moveRecipeCategory from useVault"
      pattern: "moveRecipeCategory"
---

<objective>
Permettre de changer la categorie d'une recette existante depuis RecipeViewer.

Purpose: Les recettes sont stockees dans `03 - Cuisine/Recettes/{Category}/{Name}.cook`. Changer de categorie = deplacer le .cook (et le .jpg image si existe) vers un autre dossier categorie.
Output: Fonction moveRecipeCategory + bouton UI dans RecipeViewer
</objective>

<execution_context>
@CLAUDE.md
</execution_context>

<context>
@hooks/useVault.ts (recipe functions lines 2270-2392)
@components/RecipeViewer.tsx
@app/(tabs)/meals.tsx (RecipeViewer usage lines 1417-1445)

<interfaces>
From hooks/useVault.ts:
```typescript
// Existing patterns to follow:
const RECIPES_DIR = '03 - Cuisine/Recettes';

// moveCookToRecipes (line 2370) — same pattern: read content, write to new path, delete old
const moveCookToRecipes = useCallback(async (sourcePath: string, category: string) => {
  const content = await vault.readFile(sourcePath);
  const fileName = parts[parts.length - 1];
  const destPath = `${RECIPES_DIR}/${category}/${fileName}`;
  await vault.ensureDir(`${RECIPES_DIR}/${category}`);
  await vault.writeFile(destPath, content);
  await vault.deleteFile(sourcePath);
  // optimistic update with parseRecipe
}, [loadRecipes]);

// VaultState interface (line 193-207) — add moveRecipeCategory here
```

From components/RecipeViewer.tsx:
```typescript
interface RecipeViewerProps {
  recipe: AppRecipe;
  onClose: () => void;
  onRename?: (newTitle: string) => void;
  // ... other props
}

// AppRecipe has: sourceFile, title, category, image?, ingredients, steps, etc.
```

From lib/cooklang.ts:
```typescript
export interface AppRecipe {
  // ...
  category: string;  // extracted from folder path (line 215)
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tache 1: Ajouter moveRecipeCategory dans useVault.ts</name>
  <files>hooks/useVault.ts</files>
  <action>
1. Ajouter `moveRecipeCategory` a l'interface VaultState (apres `moveCookToRecipes` ligne ~203):
   ```typescript
   /** Deplacer une recette vers une autre categorie */
   moveRecipeCategory: (sourceFile: string, newCategory: string) => Promise<void>;
   ```

2. Implementer `moveRecipeCategory` (apres `moveCookToRecipes` ligne ~2392), en suivant le meme pattern que `moveCookToRecipes`:
   ```typescript
   const moveRecipeCategory = useCallback(async (sourceFile: string, newCategory: string) => {
     if (!vaultRef.current) return;
     const vault = vaultRef.current;
     // Lire le contenu du .cook
     const content = await vault.readFile(sourceFile);
     const parts = sourceFile.split('/');
     const fileName = parts[parts.length - 1]; // ex: "Poulet-Basquaise.cook"
     const destPath = `${RECIPES_DIR}/${newCategory}/${fileName}`;
     // Verifier que source != dest
     if (sourceFile === destPath) return;
     await vault.ensureDir(`${RECIPES_DIR}/${newCategory}`);
     await vault.writeFile(destPath, content);
     await vault.deleteFile(sourceFile);
     // Deplacer aussi l'image .jpg si elle existe (meme nom, extension .jpg)
     const oldImagePath = sourceFile.replace(/\.cook$/, '.jpg');
     const newImagePath = destPath.replace(/\.cook$/, '.jpg');
     try {
       const imgContent = await vault.readFile(oldImagePath);
       // Si readFile reussit, le fichier existe — le deplacer
       // Pour les images binaires, utiliser copyFile + delete si disponible
       // Sinon, on ignore l'image (elle sera retrouvee au reload)
     } catch {
       // Pas d'image — ignorer silencieusement
     }
     // Mise a jour optimiste du state
     const { parseRecipe } = require('../lib/cooklang');
     setRecipes(prev => prev.map(r =>
       r.sourceFile === sourceFile ? parseRecipe(destPath, content) : r
     ).sort((a, b) => a.title.localeCompare(b.title, 'fr')));
   }, []);
   ```

   IMPORTANT pour l'image: VaultManager a `copyFileToVault` (pour copier depuis un URI externe) mais pas de `copyFile` interne. Verifier si `vault.copyFile` ou `vault.moveFile` existe. Si non, utiliser le pattern: lire le contenu brut n'est pas fiable pour les binaires. A la place, utiliser le chemin complet avec `vault.getFullPath(oldImagePath)` et `vault.copyFileToVault(fullPath, newImagePath)` puis `vault.deleteFile(oldImagePath)`. Si `getFullPath` n'existe pas, chercher `getFileUri` ou similaire dans VaultManager (`lib/vault.ts`). En dernier recours, ignorer le deplacement d'image (l'utilisateur peut re-ajouter la photo).

   Verifier dans `lib/vault.ts` / `modules/vault-access/` quelles methodes existent pour copier/deplacer des fichiers binaires internes au vault.

3. Ajouter `moveRecipeCategory` au return du hook (apres `moveCookToRecipes` ligne ~3699):
   ```typescript
   moveCookToRecipes,
   moveRecipeCategory,
   ```

4. Ajouter `moveRecipeCategory` dans le useMemo du context value (section exports ligne ~3780):
   ```typescript
   moveCookToRecipes, moveRecipeCategory, toggleFavorite,
   ```
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -i "moveRecipe" || echo "OK — pas d'erreur moveRecipe"</automated>
  </verify>
  <done>moveRecipeCategory existe dans VaultState, est implemente, et est expose dans le context value</done>
</task>

<task type="auto">
  <name>Tache 2: Ajouter bouton categorie dans RecipeViewer + wiring meals.tsx</name>
  <files>components/RecipeViewer.tsx, app/(tabs)/meals.tsx</files>
  <action>
**RecipeViewer.tsx:**

1. Ajouter prop `onChangeCategory` a RecipeViewerProps:
   ```typescript
   onChangeCategory?: (newCategory: string) => void;
   /** Liste des categories existantes pour le picker */
   availableCategories?: string[];
   ```

2. Destructurer les nouvelles props dans le composant (ligne ~41).

3. Rendre la ligne categorie (ligne ~133-135) cliquable quand `onChangeCategory` est fourni. Remplacer le Text categorie simple par un TouchableOpacity qui ouvre un ActionSheet (Alert avec boutons) listant les categories disponibles:
   ```typescript
   {recipe.category ? (
     <TouchableOpacity
       disabled={!onChangeCategory}
       activeOpacity={onChangeCategory ? 0.6 : 1}
       onPress={() => {
         if (!onChangeCategory || !availableCategories?.length) return;
         // Filtrer la categorie actuelle
         const others = availableCategories.filter(c => c !== recipe.category);
         if (others.length === 0) return;
         Alert.alert(
           'Changer de categorie',
           `Categorie actuelle : ${recipe.category}`,
           [
             ...others.map(cat => ({
               text: cat,
               onPress: () => {
                 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                 onChangeCategory(cat);
               },
             })),
             { text: 'Annuler', style: 'cancel' as const },
           ],
         );
       }}
     >
       <Text style={[styles.category, { color: colors.textMuted }]}>
         {recipe.category}
         {onChangeCategory ? ' 📁' : ''}
       </Text>
     </TouchableOpacity>
   ) : null}
   ```

   Note: Utiliser `Alert.alert` avec des boutons (pas Alert.prompt) car c'est un choix parmi des options existantes. Si le nombre de categories est > 8, envisager un Modal simple avec une FlatList a la place de l'ActionSheet (iOS limite les boutons ActionSheet).

**meals.tsx:**

4. Importer `moveRecipeCategory` depuis useVault (ligne ~108, ajouter a la destructuration existante):
   ```typescript
   recipes, loadRecipes, deleteRecipe, renameRecipe, moveRecipeCategory,
   ```

5. Calculer la liste des categories existantes (useMemo):
   ```typescript
   const recipeCategories = useMemo(() => {
     return [...new Set(recipes.map(r => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
   }, [recipes]);
   ```

6. Ajouter les props `onChangeCategory` et `availableCategories` sur le RecipeViewer (ligne ~1418):
   ```typescript
   onChangeCategory={async (newCategory) => {
     await moveRecipeCategory(selectedRecipe.sourceFile, newCategory);
     setSelectedRecipe((prev) => prev ? { ...prev, category: newCategory, sourceFile: prev.sourceFile.replace(/\/[^/]+\/([^/]+)$/, `/${newCategory}/$1`) } : null);
   }}
   availableCategories={recipeCategories}
   ```
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <done>Le bouton categorie apparait dans RecipeViewer, un tap ouvre un ActionSheet avec les categories existantes, le choix declenche le deplacement du fichier .cook (et .jpg) vers le nouveau dossier</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` compile sans nouvelles erreurs
2. Ouvrir une recette dans l'onglet Repas, verifier que la categorie affiche un indicateur cliquable (icone dossier)
3. Taper sur la categorie, verifier que l'ActionSheet liste les autres categories
4. Choisir une nouvelle categorie, verifier que la recette est deplacee (dossier change dans le vault)
</verification>

<success_criteria>
- moveRecipeCategory deplace le .cook ET le .jpg vers le nouveau dossier categorie
- L'etat local recipes[] est mis a jour immediatement (pas besoin de recharger)
- Le RecipeViewer affiche la nouvelle categorie apres deplacement
- Les categories disponibles sont derivees dynamiquement des recettes existantes
</success_criteria>

<output>
Apres completion, creer `.planning/quick/260404-xbu-permettre-de-changer-la-cat-gorie-d-une-/260404-xbu-SUMMARY.md`
</output>
