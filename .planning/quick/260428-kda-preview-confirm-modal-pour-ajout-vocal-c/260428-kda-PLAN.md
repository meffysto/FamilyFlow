---
phase: quick-260428-kda
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/VoiceCoursesReview.tsx
  - app/(tabs)/meals.tsx
  - locales/fr/common.json
  - locales/en/common.json
autonomous: true
requirements:
  - QUICK-260428-KDA
must_haves:
  truths:
    - "Après dictée vocale, le dictaphone se ferme et un modal de review s'ouvre listant les items détectés"
    - "L'utilisateur peut éditer le nom, la quantité (texte libre) et la section de chaque item avant validation"
    - "L'utilisateur peut supprimer un item de la review et ajouter une ligne manuelle"
    - "Le bouton « Ajouter aux courses » merge les items modifiés dans la liste, applique tracking + toast (logique pré-existante préservée)"
    - "Si la dictée ne détecte aucun item, on affiche le toast nothing detected sans ouvrir le modal review"
    - "Tous les libellés UI sont disponibles en FR et EN (clés meals.shopping.voiceReview.*)"
    - "npx tsc --noEmit passe (aucune nouvelle erreur TS)"
  artifacts:
    - path: "components/VoiceCoursesReview.tsx"
      provides: "Modal pageSheet review/édition items vocaux courses"
      min_lines: 200
    - path: "app/(tabs)/meals.tsx"
      provides: "handleVoiceResult refactorisé + handleVoiceReviewSave + state voiceReview + montage <VoiceCoursesReview/>"
      contains: "VoiceCoursesReview"
    - path: "locales/fr/common.json"
      provides: "Clés meals.shopping.voiceReview.*"
      contains: "voiceReview"
    - path: "locales/en/common.json"
      provides: "Clés meals.shopping.voiceReview.* (EN)"
      contains: "voiceReview"
  key_links:
    - from: "app/(tabs)/meals.tsx"
      to: "components/VoiceCoursesReview.tsx"
      via: "import + JSX <VoiceCoursesReview visible items sections onClose onSave/>"
      pattern: "VoiceCoursesReview"
    - from: "VoiceCoursesReview.onSave"
      to: "handleVoiceReviewSave -> mergeCourseIngredients"
      via: "callback prop reçoit VoiceCourseItem[]"
      pattern: "mergeCourseIngredients"
---

<objective>
Intercaler un modal de prévisualisation/correction entre la transcription vocale et l'ajout effectif aux courses, pour permettre à l'utilisateur de corriger les erreurs de speech-to-text avant validation.

Purpose: Réduire la friction des erreurs de dictée (mots mal compris, quantités fausses, section incorrecte) sans casser la régression budget (ReceiptReview reste intact — pattern dupliqué-adapté, pas extrait).

Output:
- Nouveau composant `components/VoiceCoursesReview.tsx` (modal pageSheet, ItemRow mémoïsée, picker section overlay, animations Reanimated cascade).
- Refactor `handleVoiceResult` dans `app/(tabs)/meals.tsx` : parse → ouvre review (au lieu d'écrire direct).
- Nouveau `handleVoiceReviewSave` qui contient la logique d'écriture pré-existante.
- Clés i18n `meals.shopping.voiceReview.*` en FR et EN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@components/ReceiptReview.tsx
@components/CourseItemEditor.tsx
@lib/parse-voice-courses.ts
@app/(tabs)/meals.tsx

<interfaces>
<!-- Contrats clés extraits du codebase — l'exécuteur n'a pas besoin d'explorer. -->

From lib/parse-voice-courses.ts:
```typescript
export interface VoiceCourseItem {
  text: string;        // libellé reconstruit (ex: "3 oeufs", "120g de farine")
  name: string;        // nom seul (ex: "oeufs", "farine")
  quantity: number | null;
  section: string;     // catégorie déduite via categorizeIngredient
}
export function parseVoiceCourses(transcript: string): VoiceCourseItem[];
```

From useVault().mergeCourseIngredients (signature consommée par meals.tsx):
```typescript
mergeCourseIngredients(items: { name: string; quantity: number | null; section: string }[])
  : Promise<{ added: number; merged: number }>;
```
Note: VoiceCourseItem est compatible (super-set) — `text` est ignoré côté merge.

From app/(tabs)/meals.tsx (existant, ne pas casser):
- `courseSections: string[]` — liste des sections disponibles, à passer en prop
- `setShowVoiceModal(false)` — ferme le DictaphoneModal
- `showToast(msg, level)` — toast contextuel
- `trackCourseAdd(name)`, `getFrequentCourses(8)`, `setFrequentItems(...)` — tracking fréquence

ReceiptReview pattern à dupliquer (composant frère, ne pas modifier) :
- `<Modal presentationStyle="pageSheet">` + drag handle + `<ModalHeader>`
- `Animated.View` avec `entering={FadeInDown.delay(index * 50)}`, `exiting={FadeOutUp}`, `layout={LinearTransition}`
- `ItemRow` mémoïsée avec `React.memo` ; `onUpdate(index, field, value)` + `onDelete(index)`
- Picker section : TouchableOpacity overlay avec liste déroulante `<ScrollView nestedScrollEnabled>` (PAS chips horizontales)
- Bouton fixe en bas via `<Button variant="primary" size="lg" fullWidth>`

Conventions CLAUDE.md à respecter :
- `useThemeColors()` strict — JAMAIS de hex hardcoded
- Icônes lucide-react-native (X, Check, Plus, ChevronDown) — PAS les ✕/✓/▼ texte de ReceiptReview
- `react-native-reanimated` (déjà utilisé par ReceiptReview)
- `presentationStyle="pageSheet"` + drag handle visuel pour le swipe-to-dismiss iOS natif
- Tokens design : `Spacing`, `Radius`, `FontSize`, `FontWeight`, `Shadows`
- FR commits + FR commentaires dans le code

Hors scope explicite :
- Ne PAS migrer les ✕/✓/▼ de ReceiptReview vers lucide (autre quick task budget-ciblée)
- Ne PAS extraire un composant générique partagé (décision utilisateur D-01 : copier-adapter pour préserver budget)
- Ne PAS modifier `parse-voice-courses.ts` ni `DictaphoneModal`
- Pas de persistance de l'état d'édition si l'utilisateur ferme le modal review (OK pour v1)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Créer VoiceCoursesReview.tsx + clés i18n</name>
  <files>components/VoiceCoursesReview.tsx, locales/fr/common.json, locales/en/common.json</files>
  <action>
Créer le composant `components/VoiceCoursesReview.tsx` en copiant la structure de `components/ReceiptReview.tsx` puis en l'adaptant pour des `VoiceCourseItem` au lieu de `ReceiptItem`.

**Signature du composant :**
```typescript
interface VoiceCoursesReviewProps {
  visible: boolean;
  items: VoiceCourseItem[];        // depuis lib/parse-voice-courses.ts
  sections: string[];              // courseSections passées par meals.tsx
  onClose: () => void;
  onSave: (items: VoiceCourseItem[]) => void;
}
export function VoiceCoursesReview(props: VoiceCoursesReviewProps): JSX.Element;
```

**Mapping ReceiptReview → VoiceCoursesReview :**
- `data.items` → `items` (prop directe, pas de wrapper `{ store, date, items }`)
- `categories` → `sections`
- ItemRow champs : `label` → `name` (TextInput), `amount` → `qty` (TextInput texte libre, pas decimal-pad — accepte "3" ou "120g"), `category` → `section`
- `formatAmount(...)` → supprimé, qty est texte libre stocké tel quel
- Pas d'en-tête « storeCard » (date/magasin) ni de bloc « total » — supprimer ces sections
- Header : `t('meals.shopping.voiceReview.title')` avec count → "{count} articles détectés"

**État local mémoïsé (pattern ReceiptReview) :**
```typescript
type ItemWithId = VoiceCourseItem & { id: number };
const [localItems, setLocalItems] = useState<ItemWithId[]>([]);
const [nextId, setNextId] = useState(0);
useEffect(() => {
  setLocalItems(items.map((it, i) => ({ ...it, id: i })));
  setNextId(items.length);
}, [items]);
```

**Handlers :**
- `handleUpdateItem(index, field: 'name' | 'qty' | 'section', value)` — pour `qty`, mappe vers `quantity: number | null` (si parseFloat OK → number, sinon null) ET garde le texte affiché localement (state `qtyText: string` par item, ou recompute via `quantity != null ? String(quantity) : ''`). **Décision simplificatrice** : ajouter un champ runtime `qtyDisplay: string` sur ItemWithId, et au save reconstruire `text` via `${qtyDisplay} ${name}` trim, et `quantity = parseFloat(qtyDisplay)` ou null.
- `handleDeleteItem(index)`
- `handleAddRow()` — ajoute un ItemWithId vide `{ id: nextId, text: '', name: '', quantity: null, section: sections[0] ?? '🛒 Courses', qtyDisplay: '' }`, incrémente nextId
- `handleSave()` — construit `VoiceCourseItem[]` final (recompose `text`, `quantity`), filtre les items dont `name.trim() === ''`, appelle `onSave(payload)` puis laisse le parent fermer

**UI lucide (au lieu de ✕/✓/▼ de ReceiptReview) :**
```typescript
import { X, Check, Plus, ChevronDown, ChevronUp } from 'lucide-react-native';
```
- Bouton supprimer ligne : `<X size={16} color={colors.error} />` dans un cercle `colors.errorBg`
- Chevron picker section : `showSectionPicker ? <ChevronUp/> : <ChevronDown/>`
- Coche item sélectionné dans picker : `<Check size={16} color={primary} />`
- Bouton « Ajouter une ligne » : `<Plus size={18} color={primary} />` + texte
- Le bouton final « Ajouter aux courses » réutilise `<Button variant="primary" size="lg" fullWidth icon={...}>` — passer une chaîne icône reste OK (pattern Button existant), on peut omettre l'icône ou passer "+"

**Empty state :**
Si `localItems.length === 0` après suppression :
```jsx
<View style={styles.emptyContainer}>
  <ShoppingCart size={48} color={colors.textMuted} />
  <Text>{t('meals.shopping.voiceReview.empty')}</Text>
</View>
```
(Importer `ShoppingCart` lucide pour cohérence avec quick-260428-k5e qui a aligné le dashboard courses sur lucide.)

**Modal :**
```jsx
<Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colors.bg }]}>
    {/* drag handle bar identique ReceiptReview */}
    <ModalHeader title={t('meals.shopping.voiceReview.title', { count: localItems.length })} onClose={onClose} />
    <ScrollView ...>
      {localItems.length === 0 ? <EmptyState/> : localItems.map((it, idx) => <ItemRow .../>)}
      <TouchableOpacity onPress={handleAddRow} style={...}><Plus/><Text>{t('meals.shopping.voiceReview.addRow')}</Text></TouchableOpacity>
    </ScrollView>
    {localItems.length > 0 && (
      <View style={styles.bottomBar}>
        <Button label={t('meals.shopping.voiceReview.save')} onPress={handleSave} variant="primary" size="lg" fullWidth />
      </View>
    )}
  </KeyboardAvoidingView>
</Modal>
```

**Styles :** `StyleSheet.create({...})` en bas, copier les styles ReceiptReview pertinents (container, dragHandleBar, dragHandle, scroll, scrollContent, sectionTitle, itemRow, itemMainRow, deleteBtn, categoryRow, categorySelector, categoryPicker, categoryPickerScroll, categoryOption, emptyContainer, bottomSpacer, bottomBar) — supprimer styles storeCard, storeName, storeDate, totalCard, totalRow, totalLabel, totalAmount, totalDetectedLabel, totalDetected, diffBadge, diffText. Tout via tokens (`Spacing`, `Radius`, `FontSize`, `FontWeight`, `Shadows`). Toutes les couleurs via `useThemeColors()` au runtime — JAMAIS de hex.

**Picker section overlay :**
Reproduire à l'identique le bloc `categorySelector` + `categoryPicker` de ReceiptReview (overlay inline `<Animated.View entering={FadeInDown.duration(200)}>` avec ScrollView nestedScrollEnabled, max 200px). C'est un choix conscient (cohérence ReceiptReview > chips de CourseItemEditor) confirmé par les task_specifics.

**i18n — ajouter dans `locales/fr/common.json`** sous `meals.shopping` :
```json
"voiceReview": {
  "title": "{{count}} articles détectés",
  "title_one": "{{count}} article détecté",
  "nameLabel": "Article",
  "qtyLabel": "Quantité",
  "sectionLabel": "Rayon",
  "delete": "Supprimer cette ligne",
  "save": "Ajouter aux courses",
  "empty": "Aucun article — ferme et réessaye",
  "addRow": "Ajouter une ligne",
  "qtyPlaceholder": "ex. 3 ou 120g"
}
```

**i18n — ajouter dans `locales/en/common.json`** sous `meals.shopping` :
```json
"voiceReview": {
  "title": "{{count}} items detected",
  "title_one": "{{count}} item detected",
  "nameLabel": "Item",
  "qtyLabel": "Quantity",
  "sectionLabel": "Aisle",
  "delete": "Delete this row",
  "save": "Add to shopping list",
  "empty": "No items — close and try again",
  "addRow": "Add a row",
  "qtyPlaceholder": "e.g. 3 or 120g"
}
```

Si la clé `meals.shopping` n'existe pas (cas improbable), créer la sous-section. Vérifier avec `grep` avant édition pour insérer au bon endroit JSON.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "VoiceCoursesReview|voiceReview" | head -20 ; test $? -ne 0 || echo "pas d'erreur sur VoiceCoursesReview"</automated>
  </verify>
  <done>Fichier `components/VoiceCoursesReview.tsx` existe, exporte `VoiceCoursesReview`, utilise `useThemeColors()` (zéro hex hardcoded), Reanimated pour les animations cascade, lucide pour les icônes, `presentationStyle="pageSheet"`. Les 4 fichiers sont touchés. Aucune nouvelle erreur TS attribuable à `VoiceCoursesReview` ou aux clés i18n.</done>
</task>

<task type="auto">
  <name>Task 2: Câbler VoiceCoursesReview dans meals.tsx (refactor handleVoiceResult)</name>
  <files>app/(tabs)/meals.tsx</files>
  <action>
Refactoriser le câblage vocal courses dans `app/(tabs)/meals.tsx`.

**1. Imports** — ajouter en haut avec les autres imports composants :
```typescript
import { VoiceCoursesReview } from '../../components/VoiceCoursesReview';
import type { VoiceCourseItem } from '../../lib/parse-voice-courses';
```
(`VoiceCourseItem` est probablement déjà importé indirectement via `parseVoiceCourses` ; ajouter l'import de type explicitement si absent.)

**2. Nouveaux states** — à placer près des autres useState liés aux modals courses (rechercher `showVoiceModal` pour localiser) :
```typescript
const [voiceReviewItems, setVoiceReviewItems] = useState<VoiceCourseItem[]>([]);
const [showVoiceReview, setShowVoiceReview] = useState(false);
```

**3. Refactoriser `handleVoiceResult`** (lignes 718-734 actuelles) :
```typescript
const handleVoiceResult = useCallback((transcript: string) => {
  const items = parseVoiceCourses(transcript);
  if (items.length === 0) {
    showToast(t('meals.shopping.voiceNothingDetected'), 'info');
    setShowVoiceModal(false);
    return;
  }
  // Ferme le dictaphone et ouvre la review pour correction utilisateur
  setVoiceReviewItems(items);
  setShowVoiceModal(false);
  setShowVoiceReview(true);
}, [showToast, t]);
```
Note : on retire `mergeCourseIngredients`, `trackCourseAdd`, `getFrequentCourses` et le toast success de cette fonction — ils migrent dans `handleVoiceReviewSave`. La fonction devient synchrone (plus besoin d'`async`).

**4. Nouveau `handleVoiceReviewSave`** — placer juste après `handleVoiceResult` :
```typescript
const handleVoiceReviewSave = useCallback(async (finalItems: VoiceCourseItem[]) => {
  setShowVoiceReview(false);
  if (finalItems.length === 0) return;
  try {
    const result = await mergeCourseIngredients(finalItems);
    finalItems.forEach(i => trackCourseAdd(i.name).catch(() => {}));
    getFrequentCourses(8).then(setFrequentItems).catch(() => {});
    showToast(
      t('meals.shopping.voiceAddedToast', { count: result.added + result.merged }),
      'success',
    );
  } catch (e) {
    Alert.alert(t('meals.alert.error'), String(e));
  }
}, [mergeCourseIngredients, showToast, t]);
```

**5. Monter le composant `<VoiceCoursesReview/>`** — le placer dans le JSX près du `DictaphoneModal` existant (autour de la ligne 2675 ; rechercher `showVoiceModal` dans le JSX pour localiser le voisinage exact). Insérer juste après le `<DictaphoneModal>` :
```jsx
<VoiceCoursesReview
  visible={showVoiceReview}
  items={voiceReviewItems}
  sections={courseSections}
  onClose={() => setShowVoiceReview(false)}
  onSave={handleVoiceReviewSave}
/>
```

**6. Vérifier `courseSections`** — s'assurer que la variable `courseSections` est bien définie en scope (elle l'est : c'est utilisée par les autres composants courses). Si elle s'appelle différemment (ex. `sections`), utiliser le bon nom — vérifier en grepant `courseSections|sectionsList` dans meals.tsx avant édition.

**Préserver intact :**
- Toute la logique de tracking fréquence et toast existante (juste déplacée)
- `mergeCourseIngredients`, `trackCourseAdd`, `getFrequentCourses`, `setFrequentItems`, `showToast`, `t` — déjà disponibles dans le scope
- Le DictaphoneModal lui-même n'est pas modifié
- Pas de modification du parseur ni de la signature de `mergeCourseIngredients`

**Edge case :** si l'utilisateur ferme le modal review via swipe/onClose sans valider, les items sont perdus (pas de persistance — explicitement hors scope v1). Le state `voiceReviewItems` n'est pas reset à la fermeture (ça n'a pas d'impact tant que `visible=false`, et au prochain ouvrir on les écrase via `setVoiceReviewItems(items)`).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -30</automated>
  </verify>
  <done>`handleVoiceResult` n'écrit plus directement dans le vault — il ouvre `<VoiceCoursesReview/>`. `handleVoiceReviewSave` contient la logique merge+tracking+toast. Le composant `<VoiceCoursesReview/>` est monté dans le JSX avec les 5 props (visible, items, sections, onClose, onSave). `npx tsc --noEmit` ne révèle aucune nouvelle erreur (les erreurs pré-existantes documentées dans CLAUDE.md restent : MemoryEditor.tsx, cooklang.ts, useVault.ts).</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — aucune nouvelle erreur (ignorer pré-existantes documentées CLAUDE.md)
2. Lancer l'app : onglet Courses → bouton dictaphone → dicter "trois oeufs et 500g de farine" → vérifier que le DictaphoneModal se ferme ET que `VoiceCoursesReview` s'ouvre avec 2 items
3. Modifier un nom dans le review (ex. corriger « farine » en « farine T55 ») → tap « Ajouter aux courses » → vérifier que la liste de courses contient bien la version corrigée
4. Ré-ouvrir le dictaphone, dicter quelque chose d'inintelligible (ou silence) → vérifier toast « rien détecté » et PAS d'ouverture du review
5. Drag-to-dismiss du modal review (swipe down iOS) → modal se ferme sans rien ajouter aux courses
6. Bouton « Ajouter une ligne » dans review → nouvelle ligne vide ajoutée → remplir nom → save → ligne ajoutée
7. Suppression d'un item via bouton X → item disparaît avec animation FadeOutUp ; si tous supprimés → empty state visible
8. Picker section : tap selector → liste déroulante → sélectionner une autre section → chevron remonte, label mis à jour
9. Mode FR + EN : changer la langue → vérifier que `voiceReview.title`, `addRow`, `save`, `empty` sont bien traduits
10. Aucun warning console runtime (`if (__DEV__)` only)
</verification>

<success_criteria>
- Modal `VoiceCoursesReview` s'intercale correctement entre transcription et merge
- Logique métier pré-existante (mergeCourseIngredients + trackCourseAdd + toast) préservée intacte, simplement déplacée dans `handleVoiceReviewSave`
- Aucune régression sur ReceiptReview (fichier non modifié)
- Aucune régression sur DictaphoneModal ni parse-voice-courses (non modifiés)
- `useThemeColors()` strict (zéro hex hardcoded) — vérifier par `grep -E '#[0-9a-fA-F]{3,8}' components/VoiceCoursesReview.tsx` qui doit retourner vide
- Icônes lucide (X, Check, Plus, ChevronDown/Up, ShoppingCart) — pas de ✕/✓/▼ texte
- i18n FR + EN complets (clés `meals.shopping.voiceReview.*`)
- `npx tsc --noEmit` clean (modulo pré-existantes documentées)
- 2 commits FR atomiques (un par task)
</success_criteria>

<output>
Après complétion, créer `.planning/quick/260428-kda-preview-confirm-modal-pour-ajout-vocal-c/260428-kda-SUMMARY.md` avec :
- Files créés/modifiés
- Décisions notables (notamment : `qtyDisplay` runtime field choisi vs reconstruction depuis `quantity`, picker overlay vs chips)
- Pitfalls rencontrés
- Pattern réutilisable pour futur composant review (ex. importPhoto, autres flux IA)
</output>
