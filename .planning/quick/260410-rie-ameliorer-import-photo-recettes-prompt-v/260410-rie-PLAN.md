---
phase: quick-260410-rie
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/recipe-import.ts
  - app/(tabs)/meals.tsx
autonomous: true
requirements: [QUICK-RIE]
must_haves:
  truths:
    - "L'import photo utilise Claude Sonnet au lieu de Haiku pour une meilleure OCR"
    - "Le prompt vision donne des instructions specifiques pour lire les quantites exactes"
    - "max_tokens est 4096 pour les recettes longues"
    - "L'utilisateur voit le contenu .cook brut avant validation et peut l'editer"
  artifacts:
    - path: "lib/recipe-import.ts"
      provides: "COOK_VISION_PROMPT + model sonnet + max_tokens 4096"
      contains: "COOK_VISION_SYSTEM_PROMPT"
    - path: "app/(tabs)/meals.tsx"
      provides: "Preview editable du contenu cook avant sauvegarde"
  key_links:
    - from: "lib/recipe-import.ts"
      to: "app/(tabs)/meals.tsx"
      via: "ImportResult type cook avec cookContent"
      pattern: "importResult\\.data\\.cookContent"
---

<objective>
Ameliorer l'import de recettes par photo: prompt vision OCR specifique, modele Sonnet, max_tokens 4096, et previsualisation editable du contenu .cook avant validation.

Purpose: L'import photo actuel utilise Haiku avec un prompt generique — les quantites sont souvent approximees ou inventees. Sonnet + prompt OCR specifique + preview editable permettent un import fiable.
Output: Import photo plus precis avec possibilite de corriger avant sauvegarde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/recipe-import.ts
@app/(tabs)/meals.tsx

<interfaces>
From lib/recipe-import.ts:
```typescript
export interface CookImportResult {
  cookContent: string;
  title: string;
  category?: string;
  imageUrl?: string;
}

export type ImportResult =
  | { type: 'cook'; data: CookImportResult }
  | { type: 'parsed'; data: ImportedRecipe };

// Current constants:
const AI_API_URL = 'https://api.anthropic.com/v1/messages';
const AI_API_VERSION = '2023-06-01';

// COOK_SYSTEM_PROMPT at line 135 — generic, used for all AI conversions
// importRecipeFromPhoto at line 582 — uses 'claude-haiku-4-5-20251001', max_tokens: 2048, COOK_SYSTEM_PROMPT
```

From app/(tabs)/meals.tsx:
```typescript
// Photo import flow (line 798-818):
// setPhotoImportLoading → importRecipeFromPhoto() → setImportResult → setShowImport(true)
// The showImport modal shows title + "cook ready" for cook type — no content preview

// handleImportSave (line 734): reads importResult.data.cookContent, cleans it, writes to vault
// For cook type: just shows title + green "Recette .cook prete" text

// State variables available:
// importResult, setImportResult, showImport, setShowImport, importCategory, setImportCategory
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tache 1: Prompt vision OCR + modele Sonnet + max_tokens 4096</name>
  <files>lib/recipe-import.ts</files>
  <action>
1. Creer un nouveau prompt `COOK_VISION_SYSTEM_PROMPT` (apres le COOK_SYSTEM_PROMPT existant, ~ligne 155) specifique a l'OCR photo:

```
Tu es un expert en extraction de recettes depuis des photos.
Lis attentivement TOUTES les quantites exactes visibles sur l'image.

Regles strictes :
- Ne rien inventer — si une quantite ou un ingredient est illisible, ecris [illisible]
- Respecter les proportions exactes (ne pas arrondir 150g en 200g)
- Porter attention aux tableaux nutritionnels, listes d'ingredients, etapes numerotees
- Si la photo montre un livre de cuisine, lire page par page methodiquement
- Si plusieurs pages/photos, combiner en une seule recette coherente

[Puis reprendre les regles de format Cooklang du COOK_SYSTEM_PROMPT existant]
```

Le prompt doit inclure les memes regles de format Cooklang (metadata >> key: value, syntaxe @ingredient{qty%unit}, etc.) que le COOK_SYSTEM_PROMPT, mais avec les instructions OCR en plus.

2. Dans `importRecipeFromPhoto()` (ligne ~644-658):
   - Changer le model: `'claude-haiku-4-5-20251001'` → `'claude-sonnet-4-6-20250514'`
   - Changer max_tokens: `2048` → `4096`
   - Changer system: `COOK_SYSTEM_PROMPT` → `COOK_VISION_SYSTEM_PROMPT`

Ne PAS modifier le type de retour ni la structure — la fonction retourne toujours `ImportResult | null`.
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>importRecipeFromPhoto utilise Sonnet avec prompt OCR specifique et max_tokens 4096. Le COOK_SYSTEM_PROMPT original reste inchange pour les autres usages (URL, texte).</done>
</task>

<task type="auto">
  <name>Tache 2: Preview editable du contenu .cook avant validation</name>
  <files>app/(tabs)/meals.tsx</files>
  <action>
Dans la modal d'import (showImport), quand `importResult.type === 'cook'`, remplacer le simple texte "Recette .cook prete" par une previsualisation editable:

1. Ajouter un state `editableCookContent` (string) initialise quand importResult change:
   ```typescript
   const [editableCookContent, setEditableCookContent] = useState('');
   ```
   Ajouter un useEffect qui sync editableCookContent quand importResult change:
   ```typescript
   useEffect(() => {
     if (importResult?.type === 'cook') {
       setEditableCookContent(importResult.data.cookContent);
     }
   }, [importResult]);
   ```

2. Dans la section preview du modal (ligne ~1873, le bloc `importResult.type === 'cook'`), remplacer le simple `<Text>` "cookReady" par:
   - Le titre (deja affiche)
   - Un `<Text>` label "Contenu .cook (modifiable)" en `colors.textMuted`, fontSize FontSize.xs
   - Un `<TextInput multiline>` affichant `editableCookContent` avec `onChangeText={setEditableCookContent}`:
     - style: backgroundColor colors.bg, color colors.text, borderColor colors.borderLight, borderWidth 1, borderRadius 8, padding 12, fontSize FontSize.sm, fontFamily monospace (Platform.OS === 'ios' ? 'Menlo' : 'monospace'), minHeight 200, maxHeight 400, textAlignVertical 'top'
   - Garder le category input et le bouton sauvegarder en dessous

3. Dans `handleImportSave` (ligne ~745-748), utiliser `editableCookContent` au lieu de `importResult.data.cookContent`:
   ```typescript
   if (importResult.type === 'cook') {
     const contentToSave = editableCookContent || importResult.data.cookContent;
     const cleaned = cleanCookContent(contentToSave);
     // ... rest unchanged
   }
   ```
   Ajouter `editableCookContent` aux deps du useCallback.

4. Aussi re-extraire le titre depuis editableCookContent pour que le titre affiche se mette a jour si l'utilisateur modifie la ligne >> title:
   Le titre dans la preview peut rester celui de importResult.data.title (statique) — c'est acceptable. Pas besoin de re-parser en temps reel.

5. Reinitialiser editableCookContent quand le modal se ferme:
   Dans le onRequestClose du modal, ajouter `setEditableCookContent('')`.
   Idem dans le cleanup apres handleImportSave success.
  </action>
  <verify>
    <automated>cd /Users/gabrielwaltio/Documents/family-vault && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>La modal d'import affiche le contenu .cook complet dans un TextInput editable. L'utilisateur peut corriger les quantites/ingredients avant de sauvegarder. Le contenu edite est utilise lors de la sauvegarde.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans nouvelles erreurs
- Dans le code: importRecipeFromPhoto reference `claude-sonnet-4-6-20250514`, max_tokens 4096, COOK_VISION_SYSTEM_PROMPT
- La modal showImport affiche un TextInput multiline quand importResult.type === 'cook'
- handleImportSave utilise editableCookContent
</verification>

<success_criteria>
- L'import photo utilise Sonnet avec un prompt OCR specifique et 4096 tokens
- L'utilisateur voit et peut editer le contenu .cook avant de sauvegarder
- Aucune regression sur les autres modes d'import (URL, texte)
- tsc --noEmit passe
</success_criteria>

<output>
After completion, create `.planning/quick/260410-rie-ameliorer-import-photo-recettes-prompt-v/260410-rie-SUMMARY.md`
</output>
