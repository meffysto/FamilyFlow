---
phase: quick-260516-oj6
plan: 01
status: complete
date: 2026-05-18
tasks_completed: 3
tasks_total: 3
commits:
  - 7dba60d4 feat(260516-oj6) data layer time-blocking — types, parser, moteur + tests
  - 4dff0aef feat(260516-oj6) UI mode Journée — toggle, day pills, slots auto-placés
  - 52c331a7 feat(260516-oj6) SlotBadge + picker + setTaskSlot + completion history
tests_jest: 113/113 passed
tsc_status: clean (TabletSidebar pré-existant ignoré)
files_created:
  - lib/time-blocking/slot-mapping.ts
  - lib/time-blocking/auto-placement.ts
  - lib/time-blocking/completion-history.ts
  - lib/time-blocking/index.ts
  - lib/__tests__/parser-slot.test.ts
  - lib/__tests__/auto-placement.test.ts
  - components/time-blocking/FreeTimeBand.tsx
  - components/time-blocking/SummaryPill.tsx
  - components/time-blocking/SlotBadge.tsx
  - components/time-blocking/SlotPickerSheet.tsx
files_modified:
  - lib/types.ts
  - lib/parser.ts
  - lib/vault-cache.ts
  - hooks/useVaultTasks.ts
  - hooks/useVault.ts
  - components/TaskCard.tsx
  - app/(tabs)/tasks.tsx
---

# Quick 260516-oj6 — Tasks time-blocking mode Journée — Summary

Toggle Liste/Journée ajouté à l'écran tâches existant avec auto-placement des
tâches du jour dans 4 slots fixes (Matin/Midi/Aprem/Soir). Zéro régression sur
le mode Liste, zéro impact gamification.

## Travail livré

### Data layer (Tâche 1 — commit 7dba60d4)

- **Type** : `Task.timeSlot?: 'matin' | 'midi' | 'aprem' | 'soir'` ajouté à
  l'interface (champ optionnel) + alias `SlotId`.
- **Parser** : `parseTask` reconnaît les emojis slot (☀️🍽️☕🌙) **en début**
  de label uniquement (regex anchored `^(\s*)(☀️|🍽️|☕|🌙)\s+/`). `stripEmoji`
  étendu pour retirer l'emoji slot avant de nettoyer les autres marqueurs.
- **Module `lib/time-blocking/`** :
  - `slot-mapping.ts` — `SLOT_DEFINITIONS` (4 slots, icônes Lucide,
    capacityMinutes, time range, free-time icon), `timeToSlot(HH:MM)`,
    `fileToSlot(path)`.
  - `auto-placement.ts` — `computeAutoSlot(task, dayTasks, history)` avec la
    chaîne de décision **explicit > time > history > file > nextfit** (court-
    circuit dès qu'une source répond) + `estimateTaskDuration` (15min default).
  - `completion-history.ts` — wrapper `SecureStore` (clé `tasks.completionHistory`),
    FIFO 10 par titre, `getDominantSlot` requiert >=2 entrées (mode statistique).
  - `index.ts` — barrel + re-export `SlotId`.
- **Cache** : `CACHE_VERSION` bumpé 13→14 (`vault-cache-v14.json`) avec
  commentaire mentionnant Task.timeSlot.

### UI mode Journée (Tâche 2 — commit 4dff0aef)

- **Toggle Liste/Journée segmenté** dans `ScreenHeader.actions` (icônes Lucide
  `List` et `Clock`, masqué en mode vacances).
- **Persistance** : `viewMode` persisté en SecureStore (`tasks.viewMode`),
  restauré au boot dans un `useEffect`.
- **Mode Liste** : code existant **strictement inchangé** (sections par
  fichier, filter chips profils, deleteTip warning).
- **Mode Journée** :
  - 4 sections fixes Matin/Midi/Aprem/Soir avec header riche (icône Lucide
    Sunrise/Sun/Sunset/Moon + label + time range).
  - Day pills (Hier / Aujourd'hui / Demain / Semaine — Semaine = `Alert
    "Bientôt"`).
  - Filtre `dayTasks` : `dueDate.slice(0,10) === selectedDay` OU récurrente
    `<= selectedDay`.
  - `computeAutoSlot(task, dayTasks, completionHistory)` calculé pour chaque
    tâche au render (memo).
- **Composants nouveaux** :
  - `FreeTimeBand` — bande verte (`colors.successBg` + `colors.success`)
    rayures dashed, affichée si le slot a ≥1h libre. Icône contextuelle par
    slot (Coffee/Sun/Leaf/Heart), basculée sur Heart si "soirée couple"
    détectée (slot=soir + ≥2 adultes + parent actif).
  - `SummaryPill` — pill avec icône Sparkles + total temps libre + count
    tâches placées + label jour (aujourd'hui/hier/demain).

### Interactions & wiring (Tâche 3 — commit 52c331a7)

- **`SlotBadge`** sur TaskCard — 24×24, variant solid (timeSlot verrouillé,
  icône slot) vs dashed (auto, icône `Wand2`). Tap → picker, long-press 600ms
  → backlog (haptic `Medium`). Couleurs `colors.brand.soil` /
  `colors.brand.soilMuted` (variantes existantes).
- **`SlotPickerSheet`** — modal `pageSheet` drag-to-dismiss (CLAUDE.md compliant),
  4 options + slot courant mis en évidence.
- **`useVaultTasks.setTaskSlot(task, slot|null)`** :
  - Reconstruit la ligne markdown en préservant la queue (🔁📅⏰⭐).
  - Préfixe l'emoji slot UNIQUEMENT si slot défini (verrou utilisateur,
    pas de pollution vault si null).
  - Met à jour le state + déclenche widget refresh.
- **`editTask`** étendu : préserve l'emoji slot existant en début de label
  (évite régression accidentelle si user édite une tâche avec timeSlot).
- **`toggleTask`** : appel **silent fire-and-forget** à `saveCompletion` après
  les listeners (import dynamique pour éviter cycle + alléger bundle, catch
  silencieux — l'historique est un bonus, jamais bloquant).
- **`useVault.ts`** : `setTaskSlot` ajouté à `VaultState` interface + exposé
  dans le return.
- **`tasks.tsx renderItem`** : extrait `section` pour calculer `slotBadge` en
  mode Journée. Long-press = `setTaskSlot(item, null)` + toast feedback FR.
  Picker `onSelect` = `setTaskSlot(target, slot)` + alert FR sur erreur.

## Tests

### Jest — 113 tests verts

- **`parser.test.ts` (existant)** : 56 tests — zéro régression.
- **`parser-slot.test.ts` (nouveau, 28 tests)** :
  - Extraction des 4 emojis slot → `timeSlot` correct + emoji strippé.
  - Cohabitation avec 📅/⏰/🔁/⭐ → tous extraits, label propre.
  - Regex anchored : emoji slot au milieu/à la fin → `timeSlot` undefined.
  - Verrou utilisateur : pas de pollution (jamais d'emoji ajouté tout seul).
  - Round-trip : reconstruction sans emoji si `timeSlot` undefined.
- **`auto-placement.test.ts` (nouveau, 29 tests)** :
  - `timeToSlot` — frontières 06:00/12:00/14:00/18:00 + wrap nuit 00-05.
  - `getDominantSlot` — seuil >=2 entrées, mode statistique.
  - `saveCompletion` — FIFO 10 par titre.
  - `computeAutoSlot` — les 5 sources isolées + priorité (explicit > time >
    history > file > nextfit) testée 4 fois en chaîne.
  - `estimateTaskDuration` — défaut 15min + extraction "30min".

### TypeScript — `npx tsc --noEmit`

Aucune nouvelle erreur. Pré-existantes ignorées (CLAUDE.md) :
- `components/TabletSidebar.tsx` L97 (2x — tuple type)
- `video/src/*` (8 fichiers — `remotion` module not found)

## Patterns établis

1. **Regex emoji anchored au début** (`/^(\s*)(...)/`) pour éviter de matcher
   au milieu du texte utilisateur.
2. **Verrou utilisateur** : le parser ne réinjecte JAMAIS d'emoji slot ;
   l'injection se fait uniquement via `setTaskSlot` (sur action utilisateur).
3. **Chaîne de décision** `computeAutoSlot` : pure, court-circuit, 5 sources
   distinctes traçables via `source` du retour.
4. **completionHistory SecureStore FIFO 10** : silent-catch, fire-and-forget,
   import dynamique pour éviter cycles.
5. **Variante solid/dashed sur badge** : indicateur visuel auto vs explicit
   sans changer l'icône principale (Wand2 spécifique au mode auto).
6. **Free time bande dashed** : pattern non-intrusif (margin + dashed border)
   pour signaler du temps libre sans rajouter de chrome.

## Pitfalls évités

- **Pollution vault** : aucun emoji slot écrit dans le markdown sans action
  explicite de l'utilisateur (tap picker ou setTaskSlot null).
- **Régression gamification** : `completeTask`, `POINTS_PER_TASK`,
  `contributeFamilyQuest`, `addContribution` jardin/ferme **non touchés**.
  L'ajout de completionHistory est silent-catch hors du chemin XP.
- **Régression mode Liste** : la branche `if (viewMode === 'liste')` du
  `sections` useMemo conserve à l'identique le code original (groupBy
  sourceFile + tri récurrentes + sectionOrder). Tests parser existants verts.
- **Cache desync** : `CACHE_VERSION` bumpé 13→14 → le cache v13 sans
  `timeSlot` est invalidé proprement au prochain boot.
- **Perspective transform** : aucun ajout (compliance CLAUDE.md).
- **Cycle import** : `saveCompletion` chargé via `await import()` dynamique
  dans `toggleTask` (l'import statique aurait pu créer cycle avec types).
- **Worktree HEAD** : assertions de branche per-agent avant chaque commit.

## Test manuel à faire

Lancer `npx expo run:ios --device` puis :

1. **Mode Liste préservé** : écran Tâches identique à avant (sections par
   fichier, filter chips profils, swipe-to-delete, etc.).
2. **Toggle Liste/Journée** dans le ScreenHeader — bascule entre les 2 vues
   avec haptic feedback selection.
3. **Persistance** : tap "Journée", quit/reload l'app → mode Journée
   restauré.
4. **Day pills** : Hier / Aujourd'hui / Demain visibles. Tap "Semaine" →
   Alert FR "Bientôt".
5. **Tâche avec `⏰ 07:30`** → apparaît dans Matin avec badge Wand2
   pointillé (placement auto).
6. **Tap badge** → SlotPickerSheet en pageSheet → choisir "Soir" → la
   tâche se déplace vers Soir, badge devient Moon solide. Vérifier que le
   vault contient `- [ ] 🌙 ...` (préfixé).
7. **Long-press badge (600ms)** → tâche revient en auto, vault ne contient
   plus 🌙. Toast "Tâche renvoyée au backlog".
8. **Free time band** : créer un slot avec peu de tâches → bande verte
   dashed apparait sous la section. ≥1h requis.
9. **Summary pill** : affiche le total libre du jour en haut.
10. **Soirée couple** : 2 adultes + parent actif + slot soir avec ≥1h libre
    → la bande Soir affiche icône Heart + "SOIRÉE COUPLE".
11. **Gamification intacte** : compléter une tâche en mode Journée →
    XP/coins/loot box continuent normalement. Aucune régression.
12. **Edit task avec timeSlot** : ouvrir le picker → choisir Matin →
    long-press la tâche pour éditer → modifier le texte → save → vérifier
    que l'emoji ☀️ est préservé (pas effacé par l'edit).

## Self-Check: PASSED

- [x] Fichiers créés présents sur disque (10 nouveaux)
- [x] Fichiers modifiés trackés (7)
- [x] 3 commits visibles dans `git log --oneline -5` :
      `7dba60d4`, `4dff0aef`, `52c331a7`
- [x] `npx tsc --noEmit` : zéro nouvelle erreur
- [x] `npx jest lib/__tests__/parser.test.ts lib/__tests__/parser-slot.test.ts
       lib/__tests__/auto-placement.test.ts --no-coverage` : 113/113 verts
- [x] Plan PLAN.md frontmatter `files_modified` couvre tous les fichiers
      touchés (sauf `hooks/useVault.ts` ajouté à l'execution car wiring
      `setTaskSlot` nécessaire — déviation mineure Rule 3, propre)
