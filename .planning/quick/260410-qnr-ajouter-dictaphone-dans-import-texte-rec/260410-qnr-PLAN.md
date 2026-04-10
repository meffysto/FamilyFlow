---
phase: quick-260410-qnr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(tabs)/meals.tsx
  - lib/recipe-import.ts
autonomous: true
requirements: [DICT-01, PHOTO-01]
must_haves:
  truths:
    - "Le modal import texte affiche un bouton micro qui ouvre le dictaphone"
    - "Le texte transcrit par le dictaphone remplit le TextInput du modal texte"
    - "L'import photo permet de selectionner plusieurs photos"
    - "Plusieurs photos sont envoyees dans un seul appel Claude Vision"
  artifacts:
    - path: "app/(tabs)/meals.tsx"
      provides: "Bouton dictaphone + modal DictaphoneRecorder dans import texte"
      contains: "DictaphoneRecorder"
    - path: "lib/recipe-import.ts"
      provides: "Multi-photo import avec array d'images Claude Vision"
      contains: "allowsMultipleSelection"
  key_links:
    - from: "app/(tabs)/meals.tsx"
      to: "components/DictaphoneRecorder.tsx"
      via: "import + rendu conditionnel dans modal texte"
      pattern: "DictaphoneRecorder"
    - from: "lib/recipe-import.ts"
      to: "Claude Vision API"
      via: "array de content blocks type image"
      pattern: "type.*image.*source.*base64"
---

<objective>
Ajouter un dictaphone dans le modal d'import texte recettes + permettre la selection multi-photos dans l'import photo recettes.

Purpose: Ameliorer l'UX d'import de recettes — dicter au lieu de taper, scanner plusieurs pages d'un livre de recettes en une seule operation.
Output: Deux ameliorations dans meals.tsx et recipe-import.ts
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/(tabs)/meals.tsx
@lib/recipe-import.ts
@components/DictaphoneRecorder.tsx
</context>

<interfaces>
<!-- Composant DictaphoneRecorder existant -->
From components/DictaphoneRecorder.tsx:
```typescript
interface DictaphoneContext {
  title: string;
  subtitle?: string;
}

interface DictaphoneRecorderProps {
  rdv?: RDV;
  context?: DictaphoneContext;
  onResult: (text: string) => void;
  onClose: () => void;
}

export function DictaphoneRecorder({ rdv, context, onResult, onClose }: DictaphoneRecorderProps): JSX.Element;
```

<!-- States import texte existants (meals.tsx ~L209-212) -->
```typescript
const [showTextImport, setShowTextImport] = useState(false);
const [textImportValue, setTextImportValue] = useState('');
const [textImportResult, setTextImportResult] = useState<ImportResult | null>(null);
const [textImportCategory, setTextImportCategory] = useState('Importees');
```

<!-- Fonction import photo existante (recipe-import.ts ~L582) -->
```typescript
export async function importRecipeFromPhoto(
  aiConfig: AIConfig,
  onStatus?: (msg: string) => void,
): Promise<ImportResult | null>;
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Ajouter le dictaphone dans le modal import texte</name>
  <files>app/(tabs)/meals.tsx</files>
  <action>
1. Ajouter l'import du composant DictaphoneRecorder:
   `import { DictaphoneRecorder } from '../../components/DictaphoneRecorder';`

2. Ajouter un state `showDictaphone` a cote des states textImport existants (~L212):
   `const [showDictaphone, setShowDictaphone] = useState(false);`

3. Dans le modal texte import (~L2017-2030), apres le label "fieldLabel" et AVANT le TextInput, ajouter une `View` row qui contient le TextInput (flex: 1) et un bouton micro a droite:

   ```
   <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
     <TextInput ... style={[existingStyle, { flex: 1 }]} />
     <TouchableOpacity
       onPress={() => setShowDictaphone(true)}
       style={{
         width: 44, height: 44, borderRadius: 22,
         backgroundColor: colors.cardAlt,
         borderWidth: 1, borderColor: colors.borderLight,
         justifyContent: 'center', alignItems: 'center',
         marginTop: 0,
       }}
       activeOpacity={0.7}
     >
       <Text style={{ fontSize: 20 }}>🎙️</Text>
     </TouchableOpacity>
   </View>
   ```

   Le TextInput existant garde toutes ses props (value, onChangeText, placeholder, multiline, etc.) mais recoit `flex: 1` en plus dans son style.

4. Ajouter un Modal pour le dictaphone APRES le modal texte import (apres L2143), au meme niveau:

   ```jsx
   <Modal
     visible={showDictaphone}
     animationType="slide"
     presentationStyle="pageSheet"
     onRequestClose={() => setShowDictaphone(false)}
   >
     <DictaphoneRecorder
       context={{ title: 'Import recette', subtitle: 'Dictez votre recette ou les ingredients' }}
       onResult={(text) => {
         setTextImportValue(prev => prev ? prev + '\n' + text : text);
         setShowDictaphone(false);
       }}
       onClose={() => setShowDictaphone(false)}
     />
   </Modal>
   ```

   Note: onResult APPENDS au texte existant (avec \n) si le champ n'est pas vide — permet de dicter en plusieurs fois.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Le modal import texte affiche un bouton micro a droite du TextInput. Cliquer ouvre le DictaphoneRecorder en modal pageSheet. Le texte transcrit remplit le TextInput. L'utilisateur peut ensuite cliquer "Analyser" normalement.</done>
</task>

<task type="auto">
  <name>Task 2: Multi-photos dans importRecipeFromPhoto</name>
  <files>lib/recipe-import.ts</files>
  <action>
1. Dans `importRecipeFromPhoto()` (~L593), modifier le picker pour autoriser la multi-selection:
   ```typescript
   const result = await ImagePicker.launchImageLibraryAsync({
     mediaTypes: ImagePicker.MediaTypeOptions.Images,
     quality: 0.8,
     allowsEditing: false,
     allowsMultipleSelection: true,
     selectionLimit: 5,
   });
   ```

2. Remplacer le traitement single-asset par un traitement multi-asset. Apres le check `result.canceled`:

   ```typescript
   if (result.canceled || !result.assets?.length) return null;
   const assets = result.assets;
   ```

3. Remplacer le bloc try/finally (L602-675) par un nouveau bloc qui traite tous les assets:

   ```typescript
   const optimizedUris: string[] = [];
   try {
     // 2. Optimiser chaque image (HEIC->JPEG + resize)
     onStatus?.(`Optimisation de ${assets.length} image${assets.length > 1 ? 's' : ''}…`);
     const maxWidth = 1568;
     const base64Images: string[] = [];

     for (const asset of assets) {
       const actions: ImageManipulator.Action[] = [];
       if ((asset.width ?? 0) > maxWidth) {
         actions.push({ resize: { width: maxWidth } });
       }
       const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
         compress: 0.8,
         format: ImageManipulator.SaveFormat.JPEG,
       });
       optimizedUris.push(manipulated.uri);

       const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
         encoding: FileSystem.EncodingType.Base64,
       });
       base64Images.push(base64);
     }

     if (__DEV__) console.log('[recipe-import] Photos base64 prets:', base64Images.length, 'images, total:', Math.round(base64Images.reduce((s, b) => s + b.length, 0) / 1024), 'KB');

     // 3. Construire les content blocks pour Claude Vision
     onStatus?.('Extraction de la recette…');
     const imageBlocks = base64Images.map(b64 => ({
       type: 'image' as const,
       source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: b64 },
     }));

     const textPrompt = base64Images.length > 1
       ? `Ces ${base64Images.length} photos montrent differentes parties d'une meme recette (ingredients, etapes, etc.). Combine toutes les informations en un seul fichier .cook complet.`
       : 'Extrais la recette de cette image et convertis-la en fichier .cook.';

     const content = [...imageBlocks, { type: 'text' as const, text: textPrompt }];

     // 4. Envoyer a Claude Vision
     const response = await fetch(AI_API_URL, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'x-api-key': aiConfig.apiKey,
         'anthropic-version': AI_API_VERSION,
         'anthropic-dangerous-direct-browser-access': 'true',
       },
       body: JSON.stringify({
         model: 'claude-haiku-4-5-20251001',
         max_tokens: 2048,
         system: COOK_SYSTEM_PROMPT,
         messages: [{ role: 'user', content }],
       }),
     });

     if (!response.ok) {
       if (response.status === 401) throw new Error('Cle API invalide. Verifiez dans les reglages.');
       if (response.status === 429) throw new Error('Trop de requetes IA. Reessayez dans un moment.');
       throw new Error(`Erreur API IA (${response.status})`);
     }

     const data = await response.json();
     const cookContent = (data.content?.[0]?.text ?? '').trim();

     if (!cookContent || cookContent === 'NOT_A_RECIPE') {
       throw new Error(base64Images.length > 1
         ? 'Les images ne semblent pas contenir une recette.'
         : 'L\'image ne semble pas contenir une recette.');
     }

     const titleMatch = cookContent.match(/^>> title:\s*(.+)/m);
     const title = titleMatch ? titleMatch[1].trim() : 'Recette importee';

     return { type: 'cook', data: { cookContent, title } };
   } finally {
     // Nettoyer TOUS les fichiers temporaires
     for (const uri of optimizedUris) {
       FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
     }
   }
   ```

   Important: Le pattern est identique au code existant mais en boucle. Les messages d'erreur sont adaptes au singulier/pluriel. Le `finally` nettoie TOUS les URIs temporaires.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>importRecipeFromPhoto() ouvre le picker en mode multi-selection (max 5). Chaque image est optimisee, convertie en base64, et envoyee dans un seul appel Claude Vision avec un prompt adapte. Les fichiers temporaires sont nettoyes dans le finally.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passe sans erreur
- Le modal texte import affiche un bouton micro a droite du TextInput
- Le DictaphoneRecorder s'ouvre en modal pageSheet depuis le bouton micro
- importRecipeFromPhoto() accepte la multi-selection d'images
</verification>

<success_criteria>
- Le dictaphone est accessible depuis le modal import texte et le texte transcrit remplit le champ
- L'import photo supporte la selection de 1 a 5 photos et les envoie toutes a Claude Vision
- `npx tsc --noEmit` passe
</success_criteria>

<output>
After completion, create `.planning/quick/260410-qnr-ajouter-dictaphone-dans-import-texte-rec/260410-qnr-01-SUMMARY.md`
</output>
