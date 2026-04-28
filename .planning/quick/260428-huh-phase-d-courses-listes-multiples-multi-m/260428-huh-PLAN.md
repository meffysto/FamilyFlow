---
phase: 260428-huh-phase-d-courses-listes-multiples
plan: 01
type: execute
wave: 1
depends_on: []
requirements: [PHASE-D]
files_modified:
  - lib/courses-constants.ts
  - lib/parser.ts
  - lib/automation-config.ts
  - lib/vault-cache.ts
  - hooks/useVaultCourses.ts
  - hooks/useVault.ts
  - contexts/VaultContext.tsx
  - components/CourseListEditor.tsx
  - app/(tabs)/meals.tsx
  - app/(tabs)/index.tsx
  - app/(tabs)/more.tsx
  - locales/fr/common.json
  - locales/en/common.json
autonomous: true
must_haves:
  truths:
    - "Au premier boot post-merge, si Liste de courses.md existe, l'app crée Listes/Principale.md à partir de son contenu et met le legacy en .bak"
    - "L'utilisateur peut créer une nouvelle liste (nom + emoji) qui devient un fichier dans 02 - Maison/Listes/"
    - "Le PillTabSwitcher au-dessus de la liste de courses permet de switcher entre les listes existantes"
    - "Le long-press sur une pill ouvre un ActionSheet : Renommer / Dupliquer / Définir par défaut pour recettes / Archiver / Supprimer"
    - "Les auto-courses depuis recettes (saveEdit, weekly shopping, addToShoppingList) poussent vers la liste cible (defaultRecipeList ?? activeListId) sans changer la liste active"
    - "Le badge dashboard / more.tsx affiche totalRemainingAllLists (somme cross-listes) et non plus seulement la liste active"
    - "La liste active est persistée dans SecureStore et restaurée au mount, avec fallback sur la première liste non-archivée si invalide"
    - "Aucun write courant ne référence COURSES_FILE_LEGACY (sauf le code de migration one-shot)"
  artifacts:
    - path: "lib/parser.ts"
      provides: "parseCourseList + serializeCourseListMeta + slugifyListName"
      contains: "parseCourseList"
    - path: "hooks/useVaultCourses.ts"
      provides: "API étendue listes/activeListId + CRUD + mergeCourseIngredientsToList"
      contains: "createList"
    - path: "components/CourseListEditor.tsx"
      provides: "Modal pageSheet drag-to-dismiss create/rename liste"
      min_lines: 120
    - path: "app/(tabs)/meals.tsx"
      provides: "Header listes (PillTabSwitcher + bouton +) + empty state + auto-courses ciblées"
      contains: "listes"
    - path: "lib/vault-cache.ts"
      provides: "Exclusion courses du cache (CACHE_VERSION inchangé)"
      contains: "courses"
  key_links:
    - from: "hooks/useVaultCourses.ts"
      to: "02 - Maison/Listes/{slug}.md"
      via: "vaultRef.writeFile"
      pattern: "COURSES_LISTS_DIR"
    - from: "app/(tabs)/meals.tsx"
      to: "useVault().createList / setActiveList / listes"
      via: "consommation hook étendu"
      pattern: "listes"
    - from: "app/(tabs)/index.tsx"
      to: "totalRemainingAllLists"
      via: "remplacement de coursesRemaining"
      pattern: "totalRemainingAllLists"
---

<objective>
Phase D courses : transformer le mono-fichier `Liste de courses.md` en système multi-listes (un fichier `.md` par liste dans `02 - Maison/Listes/`), avec migration auto idempotente, switcher UI, persistance liste active, et ciblage auto-courses recettes.

Purpose: permettre des listes par magasin (Lidl, Pharmacie, Cadeaux…) sans casser l'existant ni nécessiter d'action utilisateur (migration silencieuse au premier boot).

Output:
- Format vault `Listes/{slug}.md` avec frontmatter `{nom, emoji, archive, createdAt}`
- API hook étendue (rétrocompat sur courses/setCourses/addCourseItem/...)
- UI onglet courses avec switcher de listes + modal create/rename + actions long-press
- Auto-courses recettes ciblées vers `defaultRecipeList ?? activeListId`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@hooks/useVaultCourses.ts
@hooks/useVault.ts
@contexts/VaultContext.tsx
@lib/parser.ts
@lib/vault.ts
@lib/courses-constants.ts
@lib/vault-cache.ts
@lib/automation-config.ts
@app/(tabs)/meals.tsx
@app/(tabs)/index.tsx
@app/(tabs)/more.tsx
@components/ui/PillTabSwitcher.tsx
@components/CourseItemEditor.tsx
@locales/fr/common.json

<interfaces>
<!-- Méthodes VaultManager utilisables (lib/vault.ts) -->
- readFile(path): Promise<string>
- writeFile(path, content): Promise<void>
- exists(path): Promise<boolean>          // ligne 147
- ensureDir(path): Promise<void>          // ligne 163
- listDir(path): Promise<string[]>        // ligne 177 — retourne noms d'entrées (pas de tri)
- deleteFile(path): Promise<void>
- appendTask(file, section, text): Promise<void>

<!-- Constantes existantes (lib/courses-constants.ts) -->
- COURSES_FILE_LEGACY = '02 - Maison/Liste de courses.md'
- COURSES_LISTS_DIR   = '02 - Maison/Listes'
- COURSES_DEFAULT_SECTION = '📦 Divers'

<!-- Hook actuel (hooks/useVaultCourses.ts) — INCHANGÉ en surface -->
courses, setCourses, addCourseItem, toggleCourseItem, removeCourseItem,
moveCourseItem, mergeCourseIngredients, clearCompletedCourses,
updateCourseItem, resetCourses

<!-- Pattern modal pageSheet existant à répliquer (components/CourseItemEditor.tsx) -->
- Modal presentation="pageSheet" + drag-to-dismiss
- ModalHeader avec onClose + title
- useThemeColors pour couleurs
- Haptics.selectionAsync sur tap, Haptics.impactAsync sur save

<!-- Pattern parseCourseList à créer -->
parseCourseList(content: string, sourceFile: string) => {
  meta: { nom: string; emoji: string; archive: boolean; createdAt: string };
  items: CourseItem[];
}
// items réutilisent parseCourses existant (sur le body post-frontmatter)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Parser/serializer multi-listes + helpers slug + types</name>
  <files>lib/parser.ts, lib/courses-constants.ts</files>
  <action>
Dans `lib/parser.ts` :
1. Ajouter (export) le type `CourseListMeta`:
   ```ts
   export interface CourseListMeta {
     nom: string;
     emoji: string;
     archive: boolean;
     createdAt: string;
   }
   ```
2. Ajouter `slugifyListName(nom: string): string` — lowercase, strip accents (NFD + replace /[̀-ͯ]/g), replace non-alphanumeric par `-`, trim hyphens, max 40 chars. Empty string → fallback `"liste"`.
3. Ajouter `parseCourseList(content: string, sourceFile: string): { meta: CourseListMeta; items: CourseItem[] }` :
   - `matter(content)` → `data` + `content` body
   - meta = `{ nom: data.nom ?? 'Sans nom', emoji: data.emoji ?? '🛒', archive: data.archive === true, createdAt: typeof data.createdAt === 'string' ? data.createdAt : (data.createdAt instanceof Date ? data.createdAt.toISOString().slice(0,10) : new Date().toISOString().slice(0,10)) }`
   - items = `parseCourses(body, sourceFile)` (réutilise l'existant ; le body post-frontmatter contient les sections + cases)
4. Ajouter `serializeCourseListMeta(meta: CourseListMeta): string` retournant un bloc frontmatter YAML manuel (pas matter.stringify — convention codebase, voir [Phase 25-01]) :
   ```
   ---
   nom: {nom}
   emoji: "{emoji}"
   archive: {archive}
   createdAt: {createdAt}
   ---
   ```
   Échapper la nom si elle contient `:` ou `"` en wrappant entre quotes simples.
5. Ajouter `serializeCourseList(meta, items): string` qui concatène frontmatter + body reconstruit (sections `## {section}` + lignes `- [{x| }] {text}`). Préserver l'ordre des sections, défaut `COURSES_DEFAULT_SECTION` pour items sans section.

Dans `lib/courses-constants.ts` : aucune modif (constantes déjà présentes).

Aucun appel ne doit être fait à matter.stringify (Pitfall codebase).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang\|useVault.ts" | grep -E "error TS" | head -5 ; echo "---" ; grep -c "export function parseCourseList\|export function serializeCourseListMeta\|export function slugifyListName\|export function serializeCourseList" lib/parser.ts</automated>
  </verify>
  <done>
- `parseCourseList`, `serializeCourseListMeta`, `serializeCourseList`, `slugifyListName` exportés.
- `tsc --noEmit` ne signale aucune nouvelle erreur (modulo erreurs pré-existantes documentées CLAUDE.md).
  </done>
</task>

<task type="auto">
  <name>Task 2: Hook useVaultCourses étendu — listes, activeListId, CRUD, migration auto</name>
  <files>hooks/useVaultCourses.ts</files>
  <action>
Réécrire ciblé `hooks/useVaultCourses.ts`. **Préserver l'API existante (signatures inchangées)**, ajouter au-dessus :

1. Imports nouveaux :
   - `import * as SecureStore from 'expo-secure-store';`
   - `import { COURSES_FILE_LEGACY, COURSES_LISTS_DIR, COURSES_DEFAULT_SECTION } from '../lib/courses-constants';`
   - `import { parseCourseList, serializeCourseList, serializeCourseListMeta, slugifyListName, type CourseListMeta } from '../lib/parser';`

2. Constantes module :
   - `const ACTIVE_LIST_KEY = 'active_course_list_v1';`

3. Type exporté :
   ```ts
   export interface CourseList {
     id: string;       // = slug = nom de fichier sans .md
     nom: string;
     emoji: string;
     archive: boolean;
     createdAt: string;
     itemCount: number;
     remainingCount: number;
   }
   ```

4. Étendre `UseVaultCoursesResult` avec :
   ```ts
   listes: CourseList[];
   activeListId: string | null;
   totalRemainingAllLists: number;
   setActiveList: (id: string) => Promise<void>;
   createList: (nom: string, emoji: string) => Promise<string>;
   renameList: (id: string, nom: string) => Promise<void>;
   deleteList: (id: string) => Promise<void>;
   duplicateList: (id: string, newNom: string) => Promise<void>;
   archiveList: (id: string, archive: boolean) => Promise<void>;
   mergeCourseIngredientsToList: (listId: string, items: Parameters<UseVaultCoursesResult['mergeCourseIngredients']>[0]) => Promise<{ added: number; merged: number }>;
   ```

5. State interne :
   - `const [listes, setListes] = useState<CourseList[]>([]);`
   - `const [activeListId, setActiveListId] = useState<string | null>(null);`
   - `const listesRef = useRef<CourseList[]>([]);` synchronisé via useEffect

6. **Helper `pathOf(id)`** : `${COURSES_LISTS_DIR}/${id}.md`.

7. **Helper `loadListes()`** (async, internal) :
   - `await vaultRef.current.ensureDir(COURSES_LISTS_DIR)` (idempotent)
   - `const entries = await vaultRef.current.listDir(COURSES_LISTS_DIR)` (catch → [])
   - Filtrer fichiers `.md`, exclure `.bak`. Pour chacun :
     - readFile → parseCourseList(content, path) → calcul `itemCount = items.length`, `remainingCount = items.filter(i => !i.completed).length`
     - id = nom de fichier sans `.md`
   - Trier alphabétique par nom (FR : localeCompare)
   - `setListes(parsed)`
   - Retourner les CourseList (utile pour migration init).

8. **Helper `migrateIfNeeded()`** (async, idempotent, appelé une fois au mount) :
   - Si `await vaultRef.current.exists(COURSES_LISTS_DIR)` && au moins un `.md` dans listDir → no-op.
   - Sinon, `ensureDir(COURSES_LISTS_DIR)`.
   - Si `await vaultRef.current.exists(COURSES_FILE_LEGACY)` :
     - `const legacyContent = await readFile(COURSES_FILE_LEGACY)`
     - Construire meta = `{ nom: 'Principale', emoji: '🛒', archive: false, createdAt: today (YYYY-MM-DD local) }`
     - Items = `parseCourses(legacyContent, COURSES_FILE_LEGACY)` (appel direct au parseur existant)
     - Écrire `serializeCourseList(meta, items)` dans `Listes/principale.md`
     - **Renommer legacy en `.bak`** : lire content, writeFile(`02 - Maison/Liste de courses.md.bak`, legacyContent), puis `deleteFile(COURSES_FILE_LEGACY)`. Sécuriser : si écriture .bak échoue, NE PAS deleteFile.
   - Sinon (vault vierge) :
     - Créer `Listes/principale.md` minimal (frontmatter + section `## ${COURSES_DEFAULT_SECTION}`)
   - Catch global silencieux + warnUnexpected.

9. **Mount effect** :
   ```ts
   useEffect(() => {
     if (!vaultRef.current) return;
     (async () => {
       await migrateIfNeeded();
       const all = await loadListes();
       const stored = await SecureStore.getItemAsync(ACTIVE_LIST_KEY).catch(() => null);
       const nonArchived = all.filter(l => !l.archive);
       const validStored = stored && all.find(l => l.id === stored && !l.archive);
       const fallback = nonArchived[0]?.id ?? null;
       const initialId = validStored ? stored : fallback;
       setActiveListId(initialId);
       if (initialId) {
         const content = await vaultRef.current!.readFile(pathOf(initialId));
         const { items } = parseCourseList(content, pathOf(initialId));
         setCourses(items);
       } else {
         setCourses([]);
       }
     })().catch(() => {});
   }, [vaultRef.current]);
   ```

10. **Réécrire les writes existants** pour cibler `pathOf(activeListId)` au lieu de `COURSES_FILE_LEGACY` :
    - `addCourseItem`, `toggleCourseItem`, `removeCourseItem`, `moveCourseItem`, `updateCourseItem`, `mergeCourseIngredients`, `clearCompletedCourses`.
    - Ajouter early-return si `activeListId == null`.
    - Utiliser un `activeListIdRef` (useRef) pour capturer l'ID au moment du run dans la queue.
    - **Important** : pour les writes qui font `readFile + lines.split + writeFile`, conserver le frontmatter (meta) intact ! Stratégie :
      - readFile → `parseCourseList(content, path)` → récupérer `meta` + `items`
      - Manipuler le **body brut** (matter(content).content) plutôt que `content` pour les opérations ligne par ligne
      - Reserialize via `serializeCourseListMeta(meta) + body modifié`
    - Plus simple : ré-implémenter avec `parseCourseList` + manipulation `items` puis `serializeCourseList(meta, newItems)`. Mais cela casserait la préservation des sections vides et l'ordre. **Garder l'approche ligne-par-ligne** et ne toucher qu'au body.

11. **CRUD listes** :
    - `setActiveList(id)`: writeSecureStore + setActiveListId + load courses depuis pathOf(id) + reload listes (compteurs).
    - `createList(nom, emoji)`: slug = slugifyListName(nom). Si collision avec un id existant → suffixer `-2`, `-3`... Écrire `serializeCourseList({nom, emoji, archive: false, createdAt: today}, [])` via enqueueWrite. Reload listes. Retourne id.
    - `renameList(id, nom)`: read+parse, modifier meta.nom, reserialize. **Le slug (id/fichier) reste stable** — pas de rename de fichier (évite bugs SecureStore + cohérence URL). Reload listes.
    - `deleteList(id)`: deleteFile(pathOf(id)). Si id === activeListId → setActiveList(premier non-archivé, ou null). Reload listes.
    - `duplicateList(id, newNom)`: read+parse source, créer nouveau slug + écrire avec nouveau meta + items copiés. Reload.
    - `archiveList(id, archive)`: read+parse, modifier meta.archive, reserialize. Si archive=true et activeListId===id → switcher vers premier non-archivé. Reload.

12. **`mergeCourseIngredientsToList(listId, items)`** : variante de mergeCourseIngredients qui opère sur `pathOf(listId)` sans toucher au state `courses`. Si `listId === activeListId` → déléguer à mergeCourseIngredients existant. Sinon écrire en arrière-plan + reload listes (pour rafraîchir les compteurs).

13. **`totalRemainingAllLists`** : `useMemo` sur `listes` non-archivées : `listes.filter(l => !l.archive).reduce((sum, l) => sum + l.remainingCount, 0)`. Si `activeListId` est dans listes, **substituer** la valeur par `courses.filter(c => !c.completed).length` pour la liste active (cohérence temps réel optimistic).

14. Conserver tous les patterns existants : `enqueueWrite`, `coursesRef`, rollback optimistic, warnUnexpected, makeTempId.

15. Retourner toutes les nouvelles props dans l'objet final.

**Aucune référence à `COURSES_FILE_LEGACY` en dehors de `migrateIfNeeded`.**
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang" | grep "useVaultCourses" | head -5 ; echo "---refs legacy hors migration---" ; grep -n "COURSES_FILE_LEGACY" hooks/useVaultCourses.ts | grep -v "migrateIfNeeded\|migration"</automated>
  </verify>
  <done>
- API étendue exportée (CourseList type + 8 nouvelles méthodes + 3 props).
- Migration auto idempotente : Listes/ vide + legacy existe → crée Listes/principale.md + .bak.
- Tous les writes courants ciblent pathOf(activeListId).
- Aucune référence à COURSES_FILE_LEGACY hors migrateIfNeeded.
- tsc --noEmit propre (modulo erreurs pré-existantes).
  </done>
</task>

<task type="auto">
  <name>Task 3: Câblage useVault.ts + VaultContext + automation-config + cache exclusion</name>
  <files>hooks/useVault.ts, contexts/VaultContext.tsx, lib/automation-config.ts, lib/vault-cache.ts</files>
  <action>
1. **`hooks/useVault.ts`** :
   - Localiser le `return` de `useVaultInternal()` qui spread `...coursesHook`. **Aucun changement requis** : les nouvelles props sont automatiquement propagées via le spread (TypeScript inférera depuis UseVaultCoursesResult étendu).
   - Vérifier que l'interface globale `VaultState` (ou `UseVaultResult`) inclut bien les nouvelles props. Si elle est typée explicitement, étendre la signature avec les 11 nouveaux champs (listes, activeListId, totalRemainingAllLists, setActiveList, createList, renameList, deleteList, duplicateList, archiveList, mergeCourseIngredientsToList) — réutiliser `Pick<UseVaultCoursesResult, ...>` pour éviter la duplication.
   - Si interface implicite (juste `ReturnType<typeof useVaultInternal>`) → rien à faire.

2. **`contexts/VaultContext.tsx`** :
   - Si le contexte expose un type explicite `VaultContextValue` avec liste de props → ajouter les 11 nouvelles props. Réutiliser `Pick<UseVaultCoursesResult, ...>` si possible.
   - Sinon (type dérivé de useVaultInternal) → rien à faire.
   - Vérifier qu'aucun memo ne filtre les props sortantes.

3. **`lib/automation-config.ts`** :
   - Ajouter clé : `defaultRecipeList: 'auto_default_recipe_list'` dans `KEYS`.
   - Étendre `AutomationConfig` :
     ```ts
     defaultRecipeList: string | null;
     ```
   - `DEFAULT_AUTOMATION_CONFIG.defaultRecipeList = null` (= active du moment).
   - `ensureLoaded()` : ajouter lecture parallèle de la 4e clé. `defaultRecipeList: v4 ?? null`.
   - **Adapter `setAutomationFlag`** : la signature actuelle prend `boolean`. Ajouter une fonction parallèle `setDefaultRecipeList(id: string | null): Promise<void>` qui fait `SecureStore.setItemAsync(KEYS.defaultRecipeList, id ?? '')` (string vide = null). Adapter `ensureLoaded` : `defaultRecipeList: v4 && v4.length > 0 ? v4 : null`.
   - Exporter `getDefaultRecipeList(): Promise<string | null>` helper synchrone-sur-cache.

4. **`lib/vault-cache.ts`** :
   - **Décision (validée)** : exclure courses du cache plutôt que de bumper la version. Le re-launch sera ~50ms plus lent sur l'onglet courses, mais zéro risque de stale state ou de corruption sur la migration.
   - Modifier le commentaire d'en-tête (lignes 8-15) pour ajouter `courses` à la liste des exclusions volontaires.
   - Modifier `VaultCacheState` : remplacer `courses: CourseItem[]` par un commentaire `// courses: exclu du cache (multi-listes Phase D — toujours frais)`. **Mais** le payload doit rester compatible : garder le champ comme `courses?: never[]` ou retirer complètement.
   - **Stratégie minimale non-cassante** : garder le champ `courses: CourseItem[]` dans VaultCacheState mais documenter qu'il est ignoré au load. Côté useVault.ts (callsite saveCache) : passer `courses: []`. Côté hydrateFromCache : ignorer le champ pour le state initial (laisser `courses: []`).
   - Localiser l'appel `saveCache(...)` et `hydrateFromCache(...)` dans useVault.ts. Forcer `courses: []` dans le payload save. Ne pas hydrater `courses` depuis le cache (le hook useVaultCourses gère son propre mount).
   - **Pas de bump de CACHE_VERSION** : le shape ne change pas, juste la sémantique.

5. Vérifier qu'aucun reset (resetCourses) ne casse l'init multi-listes — appel uniquement sur déconnexion vault, donc OK.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang" | grep -E "useVault\.ts|VaultContext|automation-config|vault-cache" | head -10</automated>
  </verify>
  <done>
- useVault.ts spread inchangé (ou interface étendue si explicite).
- VaultContext expose les 11 nouvelles props.
- automation-config.ts a defaultRecipeList + setDefaultRecipeList + getDefaultRecipeList.
- vault-cache.ts : commentaire mis à jour, courses passé en [] au save, ignoré au hydrate.
- tsc propre.
  </done>
</task>

<task type="auto">
  <name>Task 4: CourseListEditor — modal create/rename + UI header listes dans meals.tsx</name>
  <files>components/CourseListEditor.tsx, app/(tabs)/meals.tsx, locales/fr/common.json, locales/en/common.json</files>
  <action>
1. **Créer `components/CourseListEditor.tsx`** :
   - Modal `presentation="pageSheet"` drag-to-dismiss (réutiliser pattern `CourseItemEditor.tsx`).
   - Props : `{ visible, mode: 'create' | 'edit', initialNom?, initialEmoji?, existingIds: string[], onClose(), onSave(nom, emoji) }`
   - Body :
     - ModalHeader avec title `t('meals.shopping.lists.createTitle')` ou `editTitle`
     - TextInput nom (placeholder `t('meals.shopping.lists.name')`, autoFocus, maxLength 40)
     - Grille horizontale 10 emojis fixes : `['🛒', '🥬', '🍎', '🥩', '🐟', '🧀', '💊', '🎁', '🍷', '🌿']`. Pill sélectionnée = bordure `colors.primary`. Tap → `Haptics.selectionAsync()`.
     - Erreur inline si nom vide ou si slug en collision (calculer slug temp avec slugifyListName + check existingIds, exclude self si edit).
     - Bouton Annuler + bouton Enregistrer (disabled si invalid). Sur save → `Haptics.impactAsync(Light)`.
   - Tous les styles dynamiques inline avec `useThemeColors()`. Tokens `Spacing/Radius/FontSize/Layout`. Pas de hardcoded colors.

2. **`app/(tabs)/meals.tsx`** — onglet courses :

   a. Imports :
   - `CourseListEditor`
   - `Alert`, `ActionSheetIOS` (déjà probablement importés)
   - `Haptics`
   - `getDefaultRecipeList, setDefaultRecipeList` depuis automation-config
   - Du hook : `listes, activeListId, totalRemainingAllLists, setActiveList, createList, renameList, deleteList, duplicateList, archiveList`

   b. State local :
   - `const [listEditorVisible, setListEditorVisible] = useState(false);`
   - `const [listEditorMode, setListEditorMode] = useState<'create' | 'edit'>('create');`
   - `const [listEditorTarget, setListEditorTarget] = useState<CourseList | null>(null);`
   - `const [defaultRecipeListId, setDefaultRecipeListId] = useState<string | null>(null);` + useEffect mount → getDefaultRecipeList.

   c. **Header listes** (rendu dans le bloc onglet courses, lignes ~1302-1481, AU-DESSUS de la liste actuelle, EN-DESSOUS du PillTabSwitcher repas/courses/recettes existant) :
   - `const visibleListes = listes.filter(l => !l.archive)`
   - Si `visibleListes.length > 1` :
     - ScrollView horizontal de pills custom (réutiliser style PillTabSwitcher si exportable, sinon un ScrollView + Pressable). Chaque pill = `{emoji} {nom}` + badge count `{remainingCount}` à droite. Active = activeListId. onPress → setActiveList. onLongPress → openListActionsSheet(liste).
     - Trailing `Pressable` carré avec icône `Plus` (lucide-react-native) → setListEditorMode('create') + setListEditorVisible(true).
   - Si `visibleListes.length === 1` : pas de switcher (gain d'espace). Mais montrer un petit bouton `+` discret en haut à droite du header pour permettre la création.
   - Si `visibleListes.length === 0` : empty state centré.

   d. **Empty state** (au lieu du contenu liste) :
   - Si `listes.length === 0` ou `activeListId === null` : empty state avec icône (lucide `ShoppingBag`), titre `t('meals.shopping.lists.emptyTitle')`, hint, bouton CTA `t('meals.shopping.lists.emptyCta')` qui ouvre l'editor en mode create.

   e. **`openListActionsSheet(liste)`** : `Alert.alert(liste.nom, undefined, [...])` (ou ActionSheetIOS sur iOS) avec options :
     - Renommer → setListEditorMode('edit'), setListEditorTarget(liste), setListEditorVisible(true)
     - Dupliquer → prompt nom via Alert.prompt → duplicateList(liste.id, newNom)
     - Définir par défaut pour recettes → setDefaultRecipeList(liste.id) + setDefaultRecipeListId(liste.id) + toast/haptic
     - Archiver / Désarchiver → archiveList(liste.id, !liste.archive)
     - Supprimer (destructive) → 2-step confirm via Alert.alert avec t('meals.shopping.lists.confirmDelete', {nom: liste.nom}) + warn → deleteList(liste.id)
     - Annuler

   f. Badge "Par défaut" : si `liste.id === defaultRecipeListId` → afficher un petit dot ou "★" sur la pill (indicatif visuel).

   g. **CourseListEditor onSave handler** :
   - Mode create → `await createList(nom, emoji)` → `setActiveList(newId)` → close.
   - Mode edit → `await renameList(target.id, nom)` (emoji change aussi : étendre renameList si pertinent OU faire un update générique. **Décision** : étendre renameList signature à `renameList(id, nom, emoji?)`. Adapter Task 2 si besoin — mais Task 2 est déjà figée. **Alternative** : ajouter un `updateListMeta(id, patch: Partial<CourseListMeta>)` — choisir cette option, l'ajouter dans Task 2 *si pas déjà fait*, sinon utiliser renameList pour le nom et accepter de ne pas changer l'emoji en edit. **Décision finale pour cette task** : limiter l'edit au nom uniquement dans CourseListEditor v1, gérer emoji via une future itération si demandé. Garder le picker emoji visible mais griser/disabled en mode edit.).

3. **i18n** : ajouter dans `locales/fr/common.json` toutes les clés `meals.shopping.lists.*` du scope :
   - title, create, createTitle, editTitle, name, emoji, actionRename, actionDuplicate, actionArchive, actionUnarchive, actionDelete, actionSetDefault, defaultBadge, confirmDelete, confirmDeleteWarn, migrationDone, addedToList, emptyTitle, emptyHint, emptyCta.
   - Mêmes clés en anglais dans `locales/en/common.json` (traductions naturelles).
   - confirmDelete avec interpolation `{{nom}}` (i18next syntax).

Conventions : FR partout, useThemeColors, pas de hardcoded color, Haptics, Spacing/Radius/FontSize.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang\|useVault.ts" | grep -E "CourseListEditor|meals\.tsx" | head -10 ; ls components/CourseListEditor.tsx ; grep -c "lists.createTitle\|lists.editTitle\|lists.emptyCta" locales/fr/common.json</automated>
  </verify>
  <done>
- components/CourseListEditor.tsx créé, modal pageSheet fonctionnelle.
- meals.tsx onglet courses : header listes (switcher + bouton +), empty state, ActionSheet long-press.
- i18n FR + EN avec toutes les clés meals.shopping.lists.*.
- tsc propre.
  </done>
</task>

<task type="auto">
  <name>Task 5: Auto-courses recettes ciblées + dashboard/badge totalRemainingAllLists</name>
  <files>app/(tabs)/meals.tsx, app/(tabs)/index.tsx, app/(tabs)/more.tsx</files>
  <action>
1. **`app/(tabs)/meals.tsx`** — câblage auto-courses ciblées :
   - Helper local `resolveTargetListId(): Promise<string | null>` :
     ```ts
     const def = await getDefaultRecipeList();
     return def && listes.find(l => l.id === def && !l.archive) ? def : activeListId;
     ```
   - **Ligne ~376-389 `saveEdit`** : auto-courses post-recipe.
     - Avant l'appel à `mergeCourseIngredients(items)`, calculer `targetListId = await resolveTargetListId()`.
     - Si `targetListId === activeListId` → garder appel actuel `mergeCourseIngredients(items)`.
     - Sinon → appeler `mergeCourseIngredientsToList(targetListId, items)` + toast `t('meals.shopping.lists.addedToList', {nom: targetList.nom})`.
   - **Ligne ~516-548 `generateWeeklyShoppingList`** : même pattern.
   - **Ligne ~764-782 `handleAddToShoppingList`** : même pattern.
   - Toast via le système existant (chercher pattern de toast dans le fichier ou ToastContext).

2. **`app/(tabs)/index.tsx`** :
   - Ligne ~558 `topCourses` : **garder inchangé** — c'est `courses` (liste active), 5 derniers ajoutés, comportement OK pour le dashboard détail.
   - Ligne ~671 `coursesRemaining` : remplacer `topCourses.length` (ou `courses.filter(...)`) par `totalRemainingAllLists` depuis useVault().
   - Si la section dashboard "courses" a une condition de visibilité basée sur `coursesRemaining > 0` → utiliser `totalRemainingAllLists > 0`.

3. **`app/(tabs)/more.tsx`** :
   - Ligne 173 : badge route courses. Remplacer `courses.filter(c => !c.completed).length` par `totalRemainingAllLists`.
   - Importer depuis useVault().

Conventions : aucun hardcoded color, FR, Haptics si nouveaux taps, console.warn sous __DEV__.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v "MemoryEditor\|cooklang\|useVault.ts" | grep -E "meals\.tsx|index\.tsx|more\.tsx" | head -10 ; grep -n "totalRemainingAllLists" app/\(tabs\)/index.tsx app/\(tabs\)/more.tsx ; grep -n "mergeCourseIngredientsToList\|resolveTargetListId" app/\(tabs\)/meals.tsx | head</automated>
  </verify>
  <done>
- saveEdit / generateWeeklyShoppingList / handleAddToShoppingList ciblent defaultRecipeList ?? activeListId, avec toast si liste cible !== active.
- Dashboard et more.tsx affichent totalRemainingAllLists.
- tsc propre.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passe (modulo erreurs pré-existantes documentées CLAUDE.md : MemoryEditor, cooklang, useVault.ts).
2. Vérifier qu'aucune référence active à `COURSES_FILE_LEGACY` n'existe en dehors de `migrateIfNeeded` dans useVaultCourses.ts :
   ```bash
   grep -rn "COURSES_FILE_LEGACY" hooks/ app/ components/ lib/ | grep -v "courses-constants.ts\|migrateIfNeeded\|migration"
   ```
3. Vérifier la présence des nouvelles exports parser :
   ```bash
   grep -E "export function (parseCourseList|serializeCourseList|serializeCourseListMeta|slugifyListName)" lib/parser.ts
   ```
4. Vérifier la présence de `CourseListEditor.tsx`.
5. Vérifier l'extension de l'API hook : `grep -E "createList|setActiveList|totalRemainingAllLists" hooks/useVaultCourses.ts`.
6. Vérifier i18n FR + EN : `grep -c "lists.createTitle" locales/fr/common.json locales/en/common.json` (= 1 chacun).
7. Inspection visuelle du flow migration (lecture du code) : si `Liste de courses.md` existe ET `Listes/` vide → boot crée `Listes/principale.md` + `.bak`.
</verification>

<success_criteria>
- Multi-listes opérationnel : créer, renommer, dupliquer, archiver, supprimer une liste depuis l'UI.
- Switch entre listes via PillTabSwitcher horizontal — réactif (les writes ciblent la liste active).
- Migration auto silencieuse au premier boot post-merge (zero action utilisateur).
- Auto-courses recettes vers liste cible (defaultRecipeList ?? activeListId), avec toast si différente de l'active.
- Badge dashboard et more.tsx = somme cross-listes (totalRemainingAllLists).
- Conventions CLAUDE.md respectées (FR, useThemeColors, drag-to-dismiss, tokens, pas de hardcoded, Haptics, console.warn __DEV__, Alert.alert FR).
- API hook rétrocompat — aucun call site existant cassé.
- tsc --noEmit propre (modulo erreurs documentées).
</success_criteria>

<output>
After completion, create `.planning/quick/260428-huh-phase-d-courses-listes-multiples-multi-m/260428-huh-SUMMARY.md`
</output>
