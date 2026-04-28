---
phase: quick-260428-fnw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/courses-constants.ts
  - hooks/useVaultCourses.ts
  - app/(tabs)/meals.tsx
autonomous: true
requirements:
  - COURSES-A1-CONSTANTS
  - COURSES-A2-FIX-37
  - COURSES-A3-WRITE-QUEUE

must_haves:
  truths:
    - "Aucun hardcode du chemin '02 - Maison/Liste de courses.md' ne subsiste dans hooks/useVaultCourses.ts ni app/(tabs)/meals.tsx (mobile)"
    - "Aucun string nu 'Divers' (sans emoji) ne subsiste comme fallback de section courses dans meals.tsx"
    - "Le décochage d'un item courses dans meals.tsx ne déclenche plus refresh() global, mais utilise toggleCourseItem (update local optimisé)"
    - "Toutes les écritures vault de useVaultCourses (add/toggle/remove/move/merge/clearCompleted) sont sérialisées via une queue partagée — pas de race condition possible entre deux appels concurrents"
    - "L'API publique de useVaultCourses (UseVaultCoursesResult) reste inchangée"
    - "npx tsc --noEmit ne produit aucune nouvelle erreur (les erreurs pré-existantes MemoryEditor.tsx / cooklang.ts / useVault.ts restent ignorées)"
  artifacts:
    - path: "lib/courses-constants.ts"
      provides: "Constantes COURSES_FILE_LEGACY, COURSES_DEFAULT_SECTION, COURSES_LISTS_DIR"
      exports: ["COURSES_FILE_LEGACY", "COURSES_DEFAULT_SECTION", "COURSES_LISTS_DIR"]
    - path: "hooks/useVaultCourses.ts"
      provides: "Hook courses avec queue d'écritures séquentielle + import constantes"
      contains: "enqueueWrite"
    - path: "app/(tabs)/meals.tsx"
      provides: "Onglet courses utilisant constantes + toggleCourseItem sur décochage"
  key_links:
    - from: "hooks/useVaultCourses.ts"
      to: "lib/courses-constants.ts"
      via: "import COURSES_FILE_LEGACY"
      pattern: "from.*courses-constants"
    - from: "app/(tabs)/meals.tsx"
      to: "lib/courses-constants.ts"
      via: "import COURSES_FILE_LEGACY, COURSES_DEFAULT_SECTION"
      pattern: "from.*courses-constants"
    - from: "app/(tabs)/meals.tsx handleCourseToggle"
      to: "useVault().toggleCourseItem"
      via: "appel direct sur branche item.completed"
      pattern: "toggleCourseItem\\(item, false\\)"
---

<objective>
Refactor préparatoire courses (Phase A) : centralise les constantes vault, fixe le bug #37 (refresh global au décochage), et sérialise les écritures vault du hook courses pour éliminer les races avant l'arrivée de l'optimistic UI (Phase B) et des listes multiples (Phase D).

Purpose : poser des fondations stables et token-sobres pour les futures phases courses sans introduire de changement UI visible.
Output : 3 fichiers modifiés/créés, 0 changement UI, 0 nouvelle dépendance.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@hooks/useVaultCourses.ts
@app/(tabs)/meals.tsx
@lib/parser.ts

<interfaces>
<!-- Contrat actuel useVaultCourses (hooks/useVaultCourses.ts:30-40) — ne pas casser -->
```typescript
export interface UseVaultCoursesResult {
  courses: CourseItem[];
  setCourses: (courses: CourseItem[]) => void;
  addCourseItem: (text: string, section?: string) => Promise<void>;
  toggleCourseItem: (item: CourseItem, completed: boolean) => Promise<void>;
  removeCourseItem: (lineIndex: number) => Promise<void>;
  moveCourseItem: (lineIndex: number, text: string, newSection: string) => Promise<void>;
  mergeCourseIngredients: (items: { text: string; name: string; quantity: number | null; section: string }[]) => Promise<{ added: number; merged: number }>;
  clearCompletedCourses: () => Promise<void>;
  resetCourses: () => void;
}
```

<!-- parseCourses laisse section: undefined si pas de header ## (lib/parser.ts:442) — pas de 'Divers' à modifier dans parser.ts -->
<!-- Le fallback 'Divers' n'existe qu'aux lignes 556 et 568 de app/(tabs)/meals.tsx -->
</interfaces>

**Décisions cadrées (du scope) :**
- D-01 : `COURSES_DEFAULT_SECTION = '📦 Divers'` (avec emoji 📦) — aligne sur le pattern des autres sections vault (🥩, 🥬, etc.). Remplace la string nue `'Divers'` actuellement utilisée. Le label affiché changera donc de "Divers" → "📦 Divers" pour les items sans section. **Acceptable** car cosmétique, cohérent avec le reste de l'UI courses.
- D-02 : Nom `COURSES_FILE_LEGACY` (suffixe LEGACY) — Phase D le remplacera par un dossier `Listes/` ; le suffixe documente l'intention.
- D-03 : Apps desktop (`apps/desktop/**`) hors scope — pas de modification.
- D-04 : Pattern queue retenu : `chain = chain.then(fn, fn)` (la chaîne ne casse pas sur erreur, mais l'erreur est toujours rejetée à l'appelant via la nouvelle promesse retournée par enqueueWrite).
</context>

<tasks>

<task type="auto">
  <name>Task 1 : Créer lib/courses-constants.ts et brancher useVaultCourses + meals.tsx</name>
  <files>lib/courses-constants.ts, hooks/useVaultCourses.ts, app/(tabs)/meals.tsx</files>
  <action>
1. **Créer `lib/courses-constants.ts`** :
```typescript
/**
 * courses-constants.ts — Constantes vault domaine courses
 *
 * COURSES_FILE_LEGACY : fichier mono-liste actuel (Phase A).
 *   Phase D le remplacera par un dossier `Listes/` (multi-listes).
 * COURSES_DEFAULT_SECTION : section affichée pour les items sans header ##.
 * COURSES_LISTS_DIR : réservé Phase D, exporté maintenant pour faciliter la migration.
 */

export const COURSES_FILE_LEGACY = '02 - Maison/Liste de courses.md';
export const COURSES_DEFAULT_SECTION = '📦 Divers';
export const COURSES_LISTS_DIR = '02 - Maison/Listes';
```

2. **`hooks/useVaultCourses.ts`** :
   - Supprimer la constante locale `const COURSES_FILE = '02 - Maison/Liste de courses.md';` (ligne 20).
   - Ajouter en haut : `import { COURSES_FILE_LEGACY } from '../lib/courses-constants';`
   - Remplacer toutes les occurrences `COURSES_FILE` → `COURSES_FILE_LEGACY` dans le fichier (rechercher/remplacer fidèle au scope).

3. **`app/(tabs)/meals.tsx`** :
   - Supprimer la constante locale `const COURSES_FILE = '02 - Maison/Liste de courses.md';` (ligne 96).
   - Ajouter à l'import (groupe lib/) : `import { COURSES_FILE_LEGACY, COURSES_DEFAULT_SECTION } from '../../lib/courses-constants';` (ajuster le chemin relatif au besoin).
   - Remplacer `COURSES_FILE` → `COURSES_FILE_LEGACY` partout dans le fichier.
   - Ligne 556 : `const s = c.section ?? 'Divers';` → `const s = c.section ?? COURSES_DEFAULT_SECTION;`
   - Ligne 568 : idem.

4. **Hors scope confirmé** : `lib/parser.ts` n'a PAS de fallback `'Divers'` dans `parseCourses` (vérifié : section reste `undefined`). Ne rien modifier dans parser.ts. Apps desktop ignorées.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "courses-constants|useVaultCourses|meals\.tsx" | grep -v -E "MemoryEditor|cooklang|useVault\.ts" || echo "OK no new errors in scope files"</automated>
    Aussi : `grep -n "'02 - Maison/Liste de courses.md'" hooks/useVaultCourses.ts app/\(tabs\)/meals.tsx` doit ne rien retourner.
    Et : `grep -n "?? 'Divers'" app/\(tabs\)/meals.tsx` doit ne rien retourner.
  </verify>
  <done>
- `lib/courses-constants.ts` créé avec les 3 exports.
- `hooks/useVaultCourses.ts` importe `COURSES_FILE_LEGACY`, plus aucun hardcode du path.
- `app/(tabs)/meals.tsx` importe les 2 constantes, plus aucun hardcode du path ni `?? 'Divers'`.
- `npx tsc --noEmit` n'introduit aucune nouvelle erreur dans ces 3 fichiers.
  </done>
</task>

<task type="auto">
  <name>Task 2 : Fix #37 — utiliser toggleCourseItem au lieu de refresh() complet sur décochage</name>
  <files>app/(tabs)/meals.tsx</files>
  <action>
Dans `handleCourseToggle` (~ligne 580-626 de `app/(tabs)/meals.tsx`) :

1. Vérifier que `toggleCourseItem` est destructuré depuis `useVault()` dans le composant `MealsScreen` (chercher la grosse destructuration en début de fonction). Si absent, l'ajouter.

2. Dans la branche `if (item.completed)` (lignes ~583-588), remplacer :
```typescript
if (item.completed) {
  // Décocher simplement
  await vault.toggleTask(COURSES_FILE_LEGACY, item.lineIndex, false);
  await refresh();
  return;
}
```
par :
```typescript
if (item.completed) {
  // Décocher simplement — toggleCourseItem fait l'update local optimisé (pas de refresh global)
  await toggleCourseItem(item, false);
  return;
}
```

3. **Mettre à jour les deps du `useCallback`** ligne ~626 :
   - Retirer `refresh` (n'est plus utilisé dans cette branche — vérifier s'il l'est ailleurs dans handleCourseToggle ; si absent partout, retirer ; sinon laisser).
   - Ajouter `toggleCourseItem`.
   - Le tableau final attendu : `[vault, stock, updateStockQuantity, addStockItem, removeCourseItem, addCourseItem, toggleCourseItem, showToast, t]` (ajuster selon usage réel de refresh).

4. Si `vault.toggleTask` n'est plus utilisé nulle part dans `handleCourseToggle` après le changement, on peut conserver la garde `if (!vault) return;` au début (utilisé pour resolveStockAction côté cocher).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "meals.tsx" | grep -v -E "MemoryEditor|cooklang|useVault\.ts" || echo "OK"</automated>
    Aussi : `grep -A3 "if (item.completed)" app/\(tabs\)/meals.tsx | head -10` doit montrer `toggleCourseItem(item, false)` et PAS `refresh()`.
  </verify>
  <done>
- La branche décochage de `handleCourseToggle` appelle `toggleCourseItem(item, false)` directement.
- `await refresh()` retiré de cette branche.
- Deps du `useCallback` à jour.
- tsc OK.
  </done>
</task>

<task type="auto">
  <name>Task 3 : Queue d'écritures séquentielle dans useVaultCourses</name>
  <files>hooks/useVaultCourses.ts</files>
  <action>
Dans `hooks/useVaultCourses.ts`, ajouter une queue de promesses partagée par toutes les fonctions d'écriture.

1. **Imports** : ajouter `useRef` à l'import existant `useState, useCallback`.

2. **Au début du hook `useVaultCourses`** (juste après `const [courses, setCourses] = useState<CourseItem[]>([]);`), ajouter :
```typescript
// Queue d'écritures séquentielle — évite les races sur le même fichier vault
// quand plusieurs handlers UI déclenchent des writes concurrents (ex : tap rapide).
const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());

const enqueueWrite = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
  // .then(fn, fn) : la chaîne ne casse pas sur erreur (l'erreur est rejetée
  // à l'appelant via la promesse retournée, mais la queue continue).
  const next = writeQueueRef.current.then(fn, fn);
  writeQueueRef.current = next.catch(() => undefined); // swallow pour la chaîne
  return next as Promise<T>;
}, []);
```

3. **Wrapper le corps de chaque fonction d'écriture** dans `enqueueWrite(async () => { ... })`. Les fonctions à wrapper :
   - `addCourseItem` (ligne ~53)
   - `toggleCourseItem` (ligne ~60)
   - `removeCourseItem` (ligne ~66)
   - `moveCourseItem` (ligne ~82)
   - `mergeCourseIngredients` (ligne ~110)
   - `clearCompletedCourses` (ligne ~177)

   **Pattern type** (exemple `addCourseItem`) :
```typescript
const addCourseItem = useCallback(async (text: string, section?: string) => {
  return enqueueWrite(async () => {
    if (!vaultRef.current) return;
    await vaultRef.current.appendTask(COURSES_FILE_LEGACY, section ?? null, text);
    const newContent = await vaultRef.current.readFile(COURSES_FILE_LEGACY);
    setCourses(parseCourses(newContent, COURSES_FILE_LEGACY));
  });
}, [enqueueWrite]);
```

   **Cas spécial `mergeCourseIngredients`** : retourne `{ added, merged }`. Le wrapper :
```typescript
const mergeCourseIngredients = useCallback(async (items): Promise<{ added: number; merged: number }> => {
  return enqueueWrite(async () => {
    // ...corps existant inchangé, retourne { added, merged } à la fin
  });
}, [enqueueWrite]);
```

4. **Deps** : ajouter `enqueueWrite` aux deps de chaque `useCallback` wrappé.

5. **API publique inchangée** — `UseVaultCoursesResult` reste identique. `resetCourses` ne touche pas au vault donc PAS dans la queue.

6. **Pitfall à éviter** : NE PAS wrapper `setCourses` (le setter de state) dans la queue. La queue contient uniquement les opérations d'I/O vault.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "useVaultCourses" | grep -v -E "MemoryEditor|cooklang|useVault\.ts" || echo "OK"</automated>
    Aussi : `grep -c "enqueueWrite" hooks/useVaultCourses.ts` doit retourner ≥ 7 (1 helper + 6 wrappers minimum).
  </verify>
  <done>
- `useRef<Promise<unknown>>` + helper `enqueueWrite` en haut du hook.
- Les 6 fonctions d'écriture (add/toggle/remove/move/merge/clearCompleted) ont leur corps enveloppé dans `enqueueWrite(async () => {...})`.
- API publique inchangée.
- tsc OK.
  </done>
</task>

</tasks>

<verification>
**Validation finale globale (à exécuter après les 3 tâches) :**

1. `npx tsc --noEmit` — ne doit produire AUCUNE nouvelle erreur (modulo MemoryEditor.tsx, cooklang.ts, useVault.ts pré-existants documentés dans CLAUDE.md).

2. Grep de non-régression :
   - `grep -rn "'02 - Maison/Liste de courses.md'" hooks/ app/` → vide (sauf commentaires éventuels).
   - `grep -rn "?? 'Divers'" app/` → vide.
   - `grep -n "await refresh()" app/(tabs)/meals.tsx` → ne doit plus apparaître dans handleCourseToggle (peut subsister ailleurs dans le fichier).

3. Pas de changement de l'API `UseVaultCoursesResult` (diff de l'interface = 0 lignes).
</verification>

<success_criteria>
- 3 fichiers touchés (1 créé, 2 modifiés) — `apps/desktop/**` non touché.
- `npx tsc --noEmit` OK (0 nouvelle erreur).
- Aucun changement UI visible (sauf le label "Divers" → "📦 Divers" pour items sans section, intentionnel D-01).
- 0 nouvelle dépendance npm.
- Token sobriety respectée : pas de réécriture inutile, modifs ciblées.
</success_criteria>

<output>
Après complétion : créer `.planning/quick/260428-fnw-phase-a-courses-refactor-pr-paratoire-co/260428-fnw-SUMMARY.md` et mettre à jour STATE.md (Quick Tasks Completed).
</output>
