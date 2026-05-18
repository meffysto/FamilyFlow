---
phase: quick-260516-oj6
reviewed: 2026-05-18T00:00:00Z
depth: quick
files_reviewed: 15
files_reviewed_list:
  - app/(tabs)/tasks.tsx
  - components/TaskCard.tsx
  - components/time-blocking/FreeTimeBand.tsx
  - components/time-blocking/SlotBadge.tsx
  - components/time-blocking/SlotPickerSheet.tsx
  - components/time-blocking/SummaryPill.tsx
  - hooks/useVault.ts
  - hooks/useVaultTasks.ts
  - lib/parser.ts
  - lib/time-blocking/auto-placement.ts
  - lib/time-blocking/completion-history.ts
  - lib/time-blocking/index.ts
  - lib/time-blocking/slot-mapping.ts
  - lib/types.ts
  - lib/vault-cache.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase quick-260516-oj6 — Code Review Report (Time-blocking)

**Reviewed :** 2026-05-18
**Depth :** quick
**Files Reviewed :** 15
**Status :** issues_found
**Scope :** time-blocking uniquement (Lightning et useFarm.ts hors scope par consigne)

## Résumé

Implémentation propre et bien commentée du time-blocking — types, parser, moteur pur, UI séparée en sous-composants memoïsés, contraintes respectées (gamification intacte dans `toggleTask`, parser compat, CACHE_VERSION bumpé à 14, Lucide-only dans le badge/picker, FR partout).

Les défauts sont concentrés sur le moteur statistique de la chaîne de décision et sur quelques edge cases écriture / fuseau horaire :

- **BLOCKER** : aucun.
- **WARNING (5)** : la "learning loop" history est corrompue dès la 1ère complétion sans signal (saveCompletion piégé par computeAutoSlot lui-même), tests Jest annoncés dans le PLAN absents, race read-modify-write dans `setTaskSlot`, race FIFO concurrente dans `saveCompletion`, bug fuseau horaire (`toISOString` UTC) sur le day filter.
- **MINOR (4)** : long-press SlotBadge "Renvoyer au backlog" no-op quand `isAuto=true`, `editTask` peut produire un double emoji slot si l'utilisateur le saisit, incohérence d'encodage `⏰` vs `⏰`, écriture silencieusement sautée si `lineIndex` hors bornes.

## Critical Issues

Aucune.

## Warnings

### WR-01 : `saveCompletion` enregistre le résultat de l'auto-placement, pas l'heure réelle de complétion → "learning loop" corrompue dès J1

**File :** `hooks/useVaultTasks.ts:128-135`
**Issue :** Dans `toggleTask`, on calcule `computeAutoSlot(task, [], history)` puis on persiste `result.slot` dans la completion-history. Le but déclaré (cf. `auto-placement.ts:9` et `completion-history.ts:9`) est d'apprendre le slot **dominant statistique** depuis les complétions réelles. Mais ici, pour une tâche sans `timeSlot` / `reminderTime` / `dueDate` avec heure / fichier `Routine matin|soir` / history préexistante, la chaîne tombe systématiquement sur la branche `nextfit`. Avec `dayTasks = []`, le premier slot rencontré (`'matin'`) gagne toujours.

Conséquence : toute tâche "sans signal" est persistée en history comme `'matin'`. Au bout de 2 complétions (`MIN_ENTRIES_FOR_DOMINANT = 2`), `getDominantSlot` retourne `'matin'` artificiellement → toutes les tâches inconnues se placent en Matin pour toujours. La boucle se renforce d'elle-même (history → dominant → save → reinforce).

**Fix :** Persister l'heure courante (slot réel), pas la décision du placement :

```ts
// hooks/useVaultTasks.ts — toggleTask, branche if (completed && !wasCompleted)
(async () => {
  try {
    const { timeToSlot, saveCompletion } = await import('../lib/time-blocking');
    const nowHHMM = new Date().toTimeString().slice(0, 5); // 'HH:MM' local
    const actualSlot = timeToSlot(nowHHMM);
    saveCompletion(task.text, actualSlot).catch(() => { /* silent */ });
  } catch { /* time-blocking — non-critical */ }
})();
```

`loadHistory` + `computeAutoSlot` ne sont plus utiles ici — la décision de placement est calculée à l'affichage, pas à la complétion.

---

### WR-02 : Tests Jest `parser-slot.test.ts` et `auto-placement.test.ts` annoncés dans le PLAN mais absents du repo

**File :** `lib/__tests__/` (livrable manquant)
**Issue :** `260516-oj6-PLAN.md:15-16, 59-62, 252-253` engage explicitement la livraison de :
- `lib/__tests__/parser-slot.test.ts`
- `lib/__tests__/auto-placement.test.ts`

`ls lib/time-blocking/` ne contient que les sources, et `find lib/__tests__` ne retourne aucun fichier `*slot*` ou `*auto-placement*`. Le commentaire d'`index.ts:6` ("testables en Node sans mocks") rend l'absence encore plus visible.

Sans ces tests, la chaîne de décision (5 sources) et le parser emoji slot ne sont protégés par aucune régression CI — particulièrement préoccupant compte tenu de WR-01 (logique non couverte) et de la contrainte projet "Le tests Jest parser existants passent sans modification" (PLAN ligne 39) qui ne vérifie pas que le nouveau comportement parser est correct.

**Fix :** Créer les deux fichiers de tests promis. Pour `auto-placement.test.ts`, couvrir au minimum les 5 branches (explicit / time / history / file / nextfit) + le cas WR-01 (nextfit avec `dayTasks=[]` retourne bien `'matin'`). Pour `parser-slot.test.ts`, tester round-trip emoji ↔ slot et préservation lors d'`editTask`.

---

### WR-03 : Race condition read-modify-write dans `setTaskSlot` (perte d'écriture possible)

**File :** `hooks/useVaultTasks.ts:269-296`
**Issue :** `setTaskSlot` lit le fichier (`readFile`) en dehors de la queue, modifie la ligne en mémoire, puis appelle `writeFile` qui s'enfile dans `enqueueWrite`. Si `toggleTask` (qui enqueue son propre read-modify-write atomique dans `vault.ts:316`) s'exécute entre le `readFile` et le `writeFile` de `setTaskSlot`, le write du toggle s'applique sur la révision N, puis setTaskSlot écrit sa propre version basée sur N → perte de la coche.

Pattern identique préexistant dans `editTask` lignes 252-256, mais étendu ici sans correction.

**Fix :** Exposer un helper `editLine(relativePath, lineIndex, transform)` sur `VaultManager` qui fait le read-modify-write atomique dans `enqueueWrite`, et l'utiliser dans `setTaskSlot` + `editTask`. À défaut, documenter explicitement le risque dans un commentaire du code.

---

### WR-04 : Race FIFO dans `saveCompletion` — entrée perdue si deux toggles concurrents

**File :** `lib/time-blocking/completion-history.ts:45-57`
**Issue :** `saveCompletion` lit l'historique complet via `loadHistory`, mute l'objet en mémoire, puis ré-écrit le tout sur SecureStore. Aucune sérialisation entre appels concurrents. Si l'utilisateur coche deux tâches très vite (deux Promises in-flight), les deux peuvent lire la même base, push leur entrée propre, et le write le plus tardif écrase le premier → entry du premier task perdue.

Le call site (`useVaultTasks.ts:133`) utilise `.catch(() => {})` sans `await`, ce qui maximise la fenêtre de race. Vu que WR-01 sera probablement corrigé, le volume d'écriture va même augmenter.

**Fix :** Ajouter un mutex simple (Promise chain) au module :

```ts
let writeQueue: Promise<void> = Promise.resolve();
export async function saveCompletion(title: string, slot: SlotId): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    try {
      const history = await loadHistory();
      const entries = history[title] ?? [];
      entries.push({ slot, timestamp: new Date().toISOString() });
      while (entries.length > MAX_ENTRIES_PER_TITLE) entries.shift();
      history[title] = entries;
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(history));
    } catch { /* silent */ }
  });
  return writeQueue;
}
```

---

### WR-05 : `formatDateOffset` / `setSelectedDay` utilisent `toISOString()` (UTC) → décalage en soirée

**File :** `app/(tabs)/tasks.tsx:238-240, 345, 965`
**Issue :** `formatDateOffset` et l'init de `selectedDay` utilisent `new Date(...).toISOString().slice(0, 10)`. `toISOString` retourne du **UTC**. En France (UTC+1 / +2 été), entre minuit local et 1h–2h du matin local, `toISOString().slice(0, 10)` renvoie la date d'**hier**. Conséquence :
- Le chip "Aujourd'hui" filtre les tâches sur hier (de minuit à 1h–2h locaux).
- Comparé à `format(new Date(), 'yyyy-MM-dd')` (date-fns, **local**) utilisé dans `vault.ts:326` pour `✅ <today>` et dans le `toggleTask` de `useVaultTasks.ts:100` (`completedDate`), la date écrite dans le vault est correcte (locale), mais le filtre Journée est décalé.

Pattern préexistant ligne 605 (`filter='retard'`), mais propagé ici.

**Fix :** Utiliser une helper basée sur date-fns ou Intl :

```ts
import { format, addDays } from 'date-fns';
function todayLocalISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
function formatDateOffset(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd');
}
// Init : useState<string>(() => todayLocalISO())
```

## Info

### IN-01 : Long-press sur SlotBadge auto-placé est silencieusement no-op

**File :** `app/(tabs)/tasks.tsx:767-774`, `components/time-blocking/SlotBadge.tsx`
**Issue :** Sur une tâche auto-placée (`isAuto=true`), le long-press appelle `setTaskSlot(item, null)`. Mais `item.timeSlot` est déjà `undefined`, donc la ligne markdown n'a pas d'emoji slot. L'écriture rewrite la même ligne, le toast "Tâche renvoyée au backlog" s'affiche, et la tâche reste affichée dans le même slot (recalculée par `computeAutoSlot` au prochain render).

**Fix :** Court-circuiter le call si `!item.timeSlot`, et afficher un toast différent ("Déjà en placement automatique") ou désactiver le long-press visuellement quand `isAuto=true`.

---

### IN-02 : `editTask` peut générer un double emoji slot si l'utilisateur saisit lui-même `☀️` au début du texte

**File :** `hooks/useVaultTasks.ts:215-222`
**Issue :** `editTask` préfixe `SLOT_EMOJI[task.timeSlot]` au `newText` sans vérifier si `newText` commence déjà par un emoji slot. Le modal d'édition (`tasks.tsx:541`) initialise `editTaskText` depuis `task.text` (stripped), donc en flux nominal pas de problème. Mais si l'utilisateur tape `☀️ ` au début, ou copie-colle un autre item de tâche, le résultat sera `☀️ ☀️ Texte`. Au prochain parse, le regex `^(...|☀️|...)\s+` ne consomme que le premier → la ligne reste avec un doublon visible dans Obsidian.

**Fix :** Strip défensif au début de `editTask` :

```ts
const cleanText = newText.replace(/^(☀️|🍽️|☕|🌙)\s+/, '');
let taskLine = cleanText;
// ...
if (task.timeSlot) taskLine = `${SLOT_EMOJI[task.timeSlot]} ${taskLine}`;
```

Idem pour `setTaskSlot` (même protection).

---

### IN-03 : Incohérence encodage `⏰` vs `⏰` entre `setTaskSlot` et `editTask`

**File :** `hooks/useVaultTasks.ts:218, 276`
**Issue :** `editTask` écrit `⏰` (escape), `setTaskSlot` écrit `⏰` (littéral). Même caractère, mais lecture/diff Git moins lisible. Cohérence à viser.

**Fix :** Uniformiser sur le littéral `⏰` (déjà utilisé pour `📅`, `🔁`, `⭐` dans le reste du fichier) — supprimer l'usage `\u{1F501}` / `\u{1F4C5}` / `⏰`.

---

### IN-04 : Écriture silencieusement sautée si `lineIndex` hors bornes — UI/vault divergent

**File :** `hooks/useVaultTasks.ts:286-294`
**Issue :** `setTaskSlot` met à jour `setTasks` (state in-memory) **avant** de vérifier que `task.lineIndex < lines.length`. Si la ligne a disparu entre le render et le tap (refresh concurrent, suppression depuis Obsidian), l'utilisateur voit le slot changer dans l'UI, mais le vault n'est pas écrit → divergence jusqu'au prochain refresh disque.

Pattern préexistant dans `editTask`, `deleteTask`. Acceptable comme trade-off mais à signaler.

**Fix :** Inverser l'ordre — vérifier bornes et écrire d'abord, n'updater le state qu'en cas de succès :

```ts
const content = await vaultRef.current.readFile(task.sourceFile);
const lines = content.split('\n');
if (task.lineIndex < 0 || task.lineIndex >= lines.length) return; // task stale
lines[task.lineIndex] = fullLine;
await vaultRef.current.writeFile(task.sourceFile, lines.join('\n'));
setTasks(prev => prev.map(t => ...));
```

## OK / Bien fait

- **Gamification intacte** : `toggleTask` (useVaultTasks.ts:90-137) conserve l'appel `await vaultRef.current.toggleTask(...)` + `setTasks` + listeners Phase 40 + widget refresh. Aucune des constantes `POINTS_PER_TASK`, `completeTask`, `contributeFamilyQuest`, `addContribution` n'a été modifiée. `tasks.tsx:401-468` (`handleTaskToggle`) reste identique côté flow rewardCard / addContribution / refreshGamification.
- **Parser compat** : le nouveau regex slot est anchored `^(\s*)(☀️|🍽️|☕|🌙)\s+/` — il ne matche pas en milieu de ligne, donc une tâche qui mentionne un de ces emojis dans son corps n'est pas affectée. Les tests existants (`lib/__tests__/parser.test.ts`) ne contiennent aucune ligne préfixée par ces emojis : ils passeront sans modif.
- **CACHE_VERSION** : bumpé de 13 → 14 + commentaire détaillé (vault-cache.ts:71-74). Filename `vault-cache-v14.json` cohérent.
- **Lucide only** : SlotBadge, SlotPickerSheet, FreeTimeBand, SummaryPill, slot section headers — toutes les icônes UI sont Lucide. Les emojis subsistent uniquement dans le markdown (vault) via `SLOT_EMOJI` et `SLOT_EMOJI_REGEX`, ce qui est l'intention.
- **FR partout** : labels `Matin / Midi / Après-midi / Soir`, sublabels `PAUSE / RESPIRE / PROFITE / DÉTENTE`, toasts `Tâche renvoyée au backlog`, alerts `Erreur — Impossible de modifier le créneau.`, accessibilité `Mode liste / Mode journée / Choisir un créneau`.
- **Module pur** : `slot-mapping.ts` + `auto-placement.ts` n'importent rien de React/RN — barrel `index.ts:9-11` propre. `completion-history.ts` isole le wrapper SecureStore.
- **Memo / perf** : `FreeTimeBand`, `SlotBadge`, `SummaryPill` tous wrappés en `React.memo`. `renderItem` / `renderSectionHeader` / `renderSectionFooter` en `useCallback`. Le `sections` memo reste dépendant uniquement de `viewMode / selectedDay / completionHistory / activeTasks / sectionOrder / t` — pas de re-render parasite.
- **Style** : `successText ?? colors.text` (FreeTimeBand) défensif si une variante de thème ne définit pas cette clé.
- **Accessibilité** : labels `accessibilityLabel` sur SlotBadge, SlotPickerSheet rows, mode toggle segments. `accessibilityRole="checkbox"` / `"button"` corrects.

---

_Reviewed: 2026-05-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
