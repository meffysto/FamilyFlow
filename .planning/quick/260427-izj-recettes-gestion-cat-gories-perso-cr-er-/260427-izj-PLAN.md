---
phase: quick-260427-izj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/useVaultRecipes.ts
  - app/(tabs)/meals.tsx
autonomous: true
requirements:
  - QUICK-IZJ-01  # Hook: createCategory / renameCategory / deleteCategory
  - QUICK-IZJ-02  # UI: chips filtre = vraies catégories vault (remplace meal-types)
  - QUICK-IZJ-03  # UI: modal CRUD catégories (créer/renommer/supprimer + réassignation)
  - QUICK-IZJ-04  # Tri alpha garanti dans filteredRecipes

must_haves:
  truths:
    - "Les chips de filtre sous la barre de recherche affichent les vraies catégories du vault (sous-dossiers de 03 - Cuisine/Recettes/), plus 'Toutes' et 'Favoris'"
    - "Sélectionner une chip catégorie filtre la liste sur les recettes ayant cette catégorie"
    - "Un bouton 'Gérer catégories' ouvre une modal CRUD avec toutes les catégories existantes et leur compteur de recettes"
    - "L'utilisateur peut créer une nouvelle catégorie (saisie nom → dossier créé dans le vault)"
    - "L'utilisateur peut renommer une catégorie (toutes les recettes du dossier sont déplacées vers le nouveau nom)"
    - "L'utilisateur peut supprimer une catégorie vide directement; pour une catégorie non-vide, l'app demande de choisir une catégorie cible et déplace les recettes avant suppression"
    - "filteredRecipes reste trié par titre (localeCompare 'fr') même si l'ordre du load est altéré"
  artifacts:
    - path: "hooks/useVaultRecipes.ts"
      provides: "createCategory / renameCategory / deleteCategory exposés sur UseVaultRecipesResult"
      contains: "createCategory"
    - path: "app/(tabs)/meals.tsx"
      provides: "Chips de filtre par catégorie vault + modal CRUD + tri alpha"
      contains: "categoryFilter"
  key_links:
    - from: "app/(tabs)/meals.tsx"
      to: "hooks/useVaultRecipes.ts"
      via: "useVault() — createCategory/renameCategory/deleteCategory"
      pattern: "createCategory|renameCategory|deleteCategory"
    - from: "hooks/useVaultRecipes.ts:renameCategory"
      to: "hooks/useVaultRecipes.ts:moveRecipeCategory"
      via: "boucle sur recettes du dossier"
      pattern: "moveRecipeCategory"
---

<objective>
Rendre la gestion des catégories de recettes pratique pour l'utilisateur.

Aujourd'hui les chips de filtre dans l'onglet « Recettes » sont des **types de repas** (Plat / Entrée / Dessert / Petit-déj) déduits via `detectMealType()`, et il n'existe **aucune UI** pour créer / renommer / supprimer une catégorie réelle (sous-dossier `03 - Cuisine/Recettes/{Category}/`).

Cette quick task :
- Ajoute 3 méthodes CRUD au hook recettes (`createCategory`, `renameCategory`, `deleteCategory`)
- Remplace les chips meal-type par des chips basés sur les **vraies catégories** du vault
- Ajoute un bouton « Gérer catégories » + modal CRUD (pageSheet, drag-to-dismiss)
- Garantit un tri alphabétique défensif dans `filteredRecipes`

Purpose: Aligner l'UI avec la structure réelle du vault Obsidian — l'utilisateur pense en catégories (ses dossiers), pas en meal-types détectés heuristiquement.

Output: Hook étendu + onglet meals refactoré + modal CRUD catégories opérationnelle, `npx tsc --noEmit` propre.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@hooks/useVaultRecipes.ts
@app/(tabs)/meals.tsx
@lib/vault.ts
@components/RecipeViewer.tsx

<interfaces>
<!-- Contrats existants pour le hook recettes (étendre, ne pas recréer). -->
<!-- L'exécutant ajoute 3 méthodes à UseVaultRecipesResult sans casser les autres. -->

From hooks/useVaultRecipes.ts (existant, à étendre) :
```typescript
const RECIPES_DIR = '03 - Cuisine/Recettes';

export interface UseVaultRecipesResult {
  recipes: Recipe[];
  // ... existant ...
  moveRecipeCategory: (sourceFile: string, newCategory: string) => Promise<void>;
  // ─── À AJOUTER (Task 1) ──────────────────────────
  createCategory: (name: string) => Promise<void>;
  renameCategory: (oldName: string, newName: string) => Promise<void>;
  deleteCategory: (name: string, reassignTo?: string) => Promise<void>;
}
```

From lib/vault.ts (API disponibles — pas de deleteDir natif) :
```typescript
class VaultManager {
  ensureDir(relativeDir: string): Promise<void>;
  listDir(relativeDir: string): Promise<string[]>;
  listFilesRecursive(relativeDir: string, extension?: string): Promise<string[]>;
  exists(relativePath: string): Promise<boolean>;
  deleteFile(relativePath: string): Promise<void>; // fichiers uniquement
  // PAS de deleteDir : les dossiers vides restent sur disque, sans impact
  // car recipeCategories est dérivé de `recipes` (sources existantes).
}
```

From app/(tabs)/meals.tsx (état + dérivés actuels, lignes ~698-733) :
```typescript
// ligne ~698
const recipeMealTypes = useMemo(() => { /* index meal-type via detectMealType */ }, [recipes]);
// ligne ~711
const recipeCategories = useMemo(
  () => [...new Set(recipes.map(r => r.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr')),
  [recipes],
);
// ligne ~715
const filteredRecipes = useMemo(() => {
  let result = recipes;
  if (showFavoritesOnly && activeProfile) { ... }
  if (mealTypeFilter) { result = result.filter(r => recipeMealTypes.get(r.id) === mealTypeFilter); }
  if (recipeSearch.trim()) { ... }
  return result;
}, [...]);
// ligne ~1469 — chips à remplacer
{MEAL_TYPE_FILTERS.map((mt) => ( /* chips meal-type */ ))}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter createCategory / renameCategory / deleteCategory dans useVaultRecipes</name>
  <files>hooks/useVaultRecipes.ts</files>
  <action>
Étendre `UseVaultRecipesResult` et l'implémentation avec 3 nouvelles méthodes. Réutiliser le pattern existant (vaultRef + useCallback + recipesLoadedRef pour reload après mutation).

**1. Ajouter à `UseVaultRecipesResult` (interface, après `moveRecipeCategory`)** :
```typescript
createCategory: (name: string) => Promise<void>;
renameCategory: (oldName: string, newName: string) => Promise<void>;
deleteCategory: (name: string, reassignTo?: string) => Promise<void>;
```

**2. Implémentations (à placer après `moveRecipeCategory` dans le hook)** :

```typescript
// ─── Gestion catégories ─────────────────────────────────────────────────────

const sanitizeCategoryName = (name: string): string => {
  return name.replace(/[/\\:*?"<>|]/g, '').trim();
};

const createCategory = useCallback(async (name: string) => {
  if (!vaultRef.current) return;
  const clean = sanitizeCategoryName(name);
  if (!clean) throw new Error('Nom de catégorie invalide');
  await vaultRef.current.ensureDir(`${RECIPES_DIR}/${clean}`);
  // Pas de reload nécessaire : recipeCategories est dérivé des recettes,
  // mais une catégorie vide ne sera visible qu'après ajout d'une recette.
  // → On force quand même un reload pour rafraîchir l'état si l'UI le requête.
  recipesLoadedRef.current = false;
  await loadRecipes(true);
}, [loadRecipes]);

const renameCategory = useCallback(async (oldName: string, newName: string) => {
  if (!vaultRef.current) return;
  const cleanOld = sanitizeCategoryName(oldName);
  const cleanNew = sanitizeCategoryName(newName);
  if (!cleanNew) throw new Error('Nouveau nom de catégorie invalide');
  if (cleanOld === cleanNew) return;
  // Lister toutes les recettes de l'ancienne catégorie
  const toMove = recipes.filter(r => r.category === cleanOld);
  // Réutiliser moveRecipeCategory pour chaque recette (gère .cook + image)
  for (const recipe of toMove) {
    await moveRecipeCategory(recipe.sourceFile, cleanNew);
  }
  // L'ancien dossier reste vide sur disque (pas de deleteDir natif) — sans impact UX
  // car recipeCategories dérive de `recipes`.
  recipesLoadedRef.current = false;
  await loadRecipes(true);
}, [recipes, moveRecipeCategory, loadRecipes]);

const deleteCategory = useCallback(async (name: string, reassignTo?: string) => {
  if (!vaultRef.current) return;
  const clean = sanitizeCategoryName(name);
  const inCategory = recipes.filter(r => r.category === clean);
  if (inCategory.length > 0) {
    if (!reassignTo) {
      throw new Error(`La catégorie "${clean}" contient ${inCategory.length} recette(s). Choisis une catégorie de destination avant de supprimer.`);
    }
    const cleanTarget = sanitizeCategoryName(reassignTo);
    if (!cleanTarget || cleanTarget === clean) {
      throw new Error('Catégorie de destination invalide');
    }
    for (const recipe of inCategory) {
      await moveRecipeCategory(recipe.sourceFile, cleanTarget);
    }
  }
  // Dossier vide reste sur disque (pas de deleteDir) — invisible côté UI.
  recipesLoadedRef.current = false;
  await loadRecipes(true);
}, [recipes, moveRecipeCategory, loadRecipes]);
```

**3. Ajouter au `return` du hook** :
```typescript
return {
  // ... existant ...
  moveRecipeCategory,
  createCategory,
  renameCategory,
  deleteCategory,
  // ... favoris, reset ...
};
```

**Notes critiques** :
- `moveRecipeCategory` est déjà défini (lignes 192-225) → on le réutilise tel quel, pas de duplication.
- Pas de `deleteDir` dans `lib/vault.ts` : les dossiers vides ne sont pas nettoyés. Acceptable car `recipeCategories` est dérivé de `recipes` (les dossiers vides sont invisibles côté UI). Documenter ce comportement en commentaire.
- Sanitisation identique à `addRecipe` (ligne 83) pour cohérence.
- `recipes` doit être dans les deps du `useCallback` pour `renameCategory` / `deleteCategory` (lecture pour filtrer).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
- `UseVaultRecipesResult` expose `createCategory`, `renameCategory`, `deleteCategory` typés
- Implémentations utilisent `vault.ensureDir` + `moveRecipeCategory` + `loadRecipes(true)`
- `deleteCategory` throw une Error explicite si non-vide et `reassignTo` absent
- `npx tsc --noEmit` passe sans nouvelle erreur
  </done>
</task>

<task type="auto">
  <name>Task 2: Remplacer chips meal-type par chips catégories + tri alpha + modal CRUD dans meals.tsx</name>
  <files>app/(tabs)/meals.tsx</files>
  <action>
Refactor de l'onglet Recettes pour utiliser les vraies catégories du vault au lieu des meal-types détectés.

**1. État** :
- Renommer le state `mealTypeFilter` (et son setter) en `categoryFilter: string | null` (et `setCategoryFilter`).
  - Ajuster les références dans le composant (rechercher `mealTypeFilter` et `setMealTypeFilter` dans le fichier — limiter le scope au filtrage de la liste recettes, pas à l'éditeur de repas hebdo qui est une logique séparée).
- Ajouter : `const [showCategoriesModal, setShowCategoriesModal] = useState(false);`
- Ajouter : `const [newCategoryName, setNewCategoryName] = useState('');`
- Ajouter : `const [renamingCategory, setRenamingCategory] = useState<string | null>(null);` + `const [renameDraft, setRenameDraft] = useState('');`

**2. Récupérer les nouvelles méthodes du hook** : ajouter `createCategory, renameCategory, deleteCategory` à la destructuration de `useVault()` (qui ré-exporte `useVaultRecipes`).

**3. `filteredRecipes` (ligne ~715)** :
- Remplacer `if (mealTypeFilter) { result = result.filter((r) => recipeMealTypes.get(r.id) === mealTypeFilter); }` par :
  ```typescript
  if (categoryFilter) {
    result = result.filter((r) => r.category === categoryFilter);
  }
  ```
- **Tri alpha défensif** ajouté en fin de chaîne (avant le `return`) :
  ```typescript
  result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  return result;
  ```
- Mettre à jour les deps du useMemo : remplacer `mealTypeFilter, recipeMealTypes` par `categoryFilter`.

**4. `recipeMealTypes` (ligne ~698)** : si plus aucun usage après le refactor (chercher `recipeMealTypes` dans le fichier), supprimer le useMemo. Si encore utilisé ailleurs (ex: `pickerRecipes`, suggestions repas), laisser tel quel.

**5. Chips de filtre (lignes ~1469-1490)** :
- Garder « Toutes » et « Favoris » identiques (cliquer sur Toutes → `setCategoryFilter(null); setShowFavoritesOnly(false);`).
- Remplacer `MEAL_TYPE_FILTERS.map(...)` par `recipeCategories.map((cat) => ...)` :
  ```tsx
  {recipeCategories.map((cat) => (
    <TouchableOpacity
      key={cat}
      style={[
        styles.categoryChip,
        { backgroundColor: colors.cardAlt },
        categoryFilter === cat && { backgroundColor: tint },
      ]}
      onPress={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: categoryFilter === cat }}
    >
      <Text style={[
        styles.categoryChipText,
        { color: colors.textSub },
        categoryFilter === cat && { color: primary, fontWeight: FontWeight.bold },
      ]}>
        {cat}
      </Text>
    </TouchableOpacity>
  ))}
  ```
- Ajouter une chip « 📁 Gérer » en fin de liste (juste après les catégories) :
  ```tsx
  <TouchableOpacity
    style={[styles.categoryChip, { backgroundColor: colors.cardAlt }]}
    onPress={() => { Haptics.selectionAsync(); setShowCategoriesModal(true); }}
    activeOpacity={0.7}
    accessibilityLabel="Gérer les catégories"
    accessibilityRole="button"
  >
    <Text style={[styles.categoryChipText, { color: colors.textSub }]}>📁 Gérer</Text>
  </TouchableOpacity>
  ```

**6. Modal CRUD catégories** (à ajouter dans le JSX, près des autres modals du fichier — chercher `presentationStyle="pageSheet"` pour trouver le pattern) :

```tsx
<Modal
  visible={showCategoriesModal}
  presentationStyle="pageSheet"
  animationType="slide"
  onRequestClose={() => setShowCategoriesModal(false)}
>
  <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
    <ModalHeader
      title="Gérer les catégories"
      onClose={() => setShowCategoriesModal(false)}
    />
    <ScrollView style={{ flex: 1, padding: Spacing.lg }} keyboardShouldPersistTaps="handled">
      {/* Création */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl }}>
        <TextInput
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder="Nouvelle catégorie…"
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1, backgroundColor: colors.cardAlt, color: colors.text,
            paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
            borderRadius: 8, fontSize: FontSize.md,
          }}
          returnKeyType="done"
        />
        <TouchableOpacity
          onPress={async () => {
            const name = newCategoryName.trim();
            if (!name) return;
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await createCategory(name);
              setNewCategoryName('');
            } catch (e) {
              Alert.alert('Erreur', String(e));
            }
          }}
          style={{
            backgroundColor: tint, paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm, borderRadius: 8, justifyContent: 'center',
          }}
        >
          <Text style={{ color: primary, fontWeight: FontWeight.bold }}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Liste catégories existantes */}
      {recipeCategories.map((cat) => {
        const count = recipes.filter(r => r.category === cat).length;
        const isRenaming = renamingCategory === cat;
        return (
          <View
            key={cat}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
              paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
            }}
          >
            {isRenaming ? (
              <TextInput
                value={renameDraft}
                onChangeText={setRenameDraft}
                autoFocus
                style={{
                  flex: 1, backgroundColor: colors.cardAlt, color: colors.text,
                  paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
                  borderRadius: 6, fontSize: FontSize.md,
                }}
                returnKeyType="done"
                onSubmitEditing={async () => {
                  const target = renameDraft.trim();
                  if (!target || target === cat) { setRenamingCategory(null); return; }
                  try {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    await renameCategory(cat, target);
                    setRenamingCategory(null);
                    setRenameDraft('');
                  } catch (e) {
                    Alert.alert('Erreur', String(e));
                  }
                }}
              />
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.medium }}>{cat}</Text>
                <Text style={{ color: colors.textMuted, fontSize: FontSize.sm }}>
                  {count} recette{count > 1 ? 's' : ''}
                </Text>
              </View>
            )}
            {!isRenaming && (
              <>
                <TouchableOpacity
                  onPress={() => { setRenamingCategory(cat); setRenameDraft(cat); }}
                  accessibilityLabel={`Renommer ${cat}`}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.textSub, fontSize: FontSize.lg }}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (count === 0) {
                      Alert.alert(
                        'Supprimer la catégorie',
                        `Supprimer "${cat}" ?`,
                        [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Supprimer', style: 'destructive',
                            onPress: async () => {
                              try { await deleteCategory(cat); } catch (e) { Alert.alert('Erreur', String(e)); }
                            },
                          },
                        ],
                      );
                      return;
                    }
                    // Non-vide → demander la cible parmi les autres catégories
                    const others = recipeCategories.filter(c => c !== cat);
                    if (others.length === 0) {
                      Alert.alert(
                        'Impossible',
                        `"${cat}" contient ${count} recette(s) et aucune autre catégorie n'existe pour les accueillir. Crée d'abord une autre catégorie.`,
                      );
                      return;
                    }
                    Alert.alert(
                      'Réassigner les recettes',
                      `"${cat}" contient ${count} recette(s). Vers quelle catégorie les déplacer ?`,
                      [
                        { text: 'Annuler', style: 'cancel' },
                        ...others.slice(0, 3).map((target) => ({
                          text: target,
                          onPress: async () => {
                            try { await deleteCategory(cat, target); } catch (e) { Alert.alert('Erreur', String(e)); }
                          },
                        })),
                      ],
                    );
                  }}
                  accessibilityLabel={`Supprimer ${cat}`}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.error, fontSize: FontSize.lg }}>🗑️</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}

      {recipeCategories.length === 0 && (
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xl }}>
          Aucune catégorie pour l'instant. Ajoute une recette ou crée-en une ci-dessus.
        </Text>
      )}
    </ScrollView>
  </SafeAreaView>
</Modal>
```

**7. Vérifications finales** :
- Vérifier que `Haptics`, `Modal`, `SafeAreaView`, `ModalHeader`, `TextInput`, `Alert`, `Spacing`, `FontSize`, `FontWeight`, `colors`, `tint`, `primary` sont déjà importés (la majorité l'est déjà — chercher en haut du fichier et compléter si besoin).
- `MEAL_TYPE_FILTERS` constant : si plus utilisé nulle part dans le fichier après le refactor, supprimer la déclaration. Sinon, conserver.
- `detectMealType` : si seul `recipeMealTypes` l'utilisait et qu'on supprime ce useMemo, retirer aussi l'import. Sinon laisser.

**Conventions à respecter (CLAUDE.md)** :
- Couleurs : TOUJOURS via `colors.*` / `tint` / `primary` (pas de hardcoded hex)
- Strings UI : français
- `Haptics.impactAsync()` sur actions destructives, `Haptics.selectionAsync()` sur ouverture modal
- `Alert.alert()` français pour confirmation suppression
- Drag-to-dismiss : `presentationStyle="pageSheet"` + `onRequestClose` (déjà appliqué dans le snippet)
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
- Les chips sous la barre de recherche affichent les catégories du vault (issues de `recipeCategories`) + « Toutes » + « Favoris » + « 📁 Gérer »
- Cliquer sur une chip catégorie filtre la liste sur cette catégorie
- Le bouton « 📁 Gérer » ouvre une modal pageSheet avec : input « Nouvelle catégorie », liste des catégories avec compteur, boutons renommer (inline) et supprimer (Alert avec choix cible si non-vide)
- `filteredRecipes` est trié par titre via `localeCompare('fr')` en fin de chaîne
- `MEAL_TYPE_FILTERS.map(...)` n'apparaît plus dans le JSX (remplacé par `recipeCategories.map(...)`)
- `npx tsc --noEmit` passe sans nouvelle erreur
- Conventions FR + `colors.*` + `Haptics.*` + Alert FR respectées
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zéro nouvelle erreur (les erreurs pré-existantes dans MemoryEditor.tsx, cooklang.ts, useVault.ts sont à ignorer per CLAUDE.md)
2. Lancement runtime (manuel) :
   - Ouvrir l'onglet Recettes → les chips affichent les vraies catégories du vault, plus « Toutes » + « Favoris » + « 📁 Gérer »
   - Cliquer une chip catégorie → la liste filtre correctement
   - Tap « 📁 Gérer » → modal s'ouvre, lister les catégories avec compteurs
   - Créer une catégorie → réapparaît dans les chips après ajout d'une recette dedans
   - Renommer une catégorie → toutes les recettes du dossier déplacées (vérifier dans Obsidian)
   - Supprimer une catégorie vide → disparaît
   - Supprimer une catégorie non-vide → Alert demande la cible, choisir une → recettes déplacées + catégorie disparaît
3. Tri alpha : ouvrir Recettes avec >5 recettes, vérifier ordre alphabétique strict (avec gestion des accents via 'fr')
</verification>

<success_criteria>
- [ ] Hook expose `createCategory`, `renameCategory`, `deleteCategory` (signature exacte)
- [ ] Onglet Recettes : chips = vraies catégories vault (plus de meal-types)
- [ ] Bouton « 📁 Gérer » + modal CRUD opérationnelle (créer / renommer / supprimer avec réassignation)
- [ ] `filteredRecipes` trié alphabétiquement (défensif)
- [ ] `npx tsc --noEmit` passe
- [ ] Conventions projet respectées : FR, `colors.*`, `Haptics.*`, Alert FR, pageSheet
</success_criteria>

<output>
Après complétion, créer `.planning/quick/260427-izj-recettes-gestion-cat-gories-perso-cr-er-/260427-izj-SUMMARY.md` résumant les modifs (hook + UI + modal CRUD), les décisions clés (réassignation obligatoire, dossiers vides laissés sur disque), et toute découverte runtime.
</output>
