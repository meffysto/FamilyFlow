---
phase: 260428-huh-phase-d-courses-listes-multiples
plan: 01
subsystem: courses-multi-listes
tags: [courses, multi-listes, migration, vault, useVault, i18n]
requires:
  - lib/courses-constants.ts (existant)
  - lib/parser.ts parseCourses (réutilisé)
  - hooks/useVaultCourses.ts (Phase B optimistic UI)
  - components/CourseItemEditor.tsx (pattern modal pageSheet)
provides:
  - lib/parser.ts : parseCourseList, serializeCourseListMeta, serializeCourseList, slugifyListName, type CourseListMeta
  - hooks/useVaultCourses.ts : type CourseList + 11 nouvelles props (listes, activeListId, totalRemainingAllLists, setActiveList, createList, renameList, deleteList, duplicateList, archiveList, mergeCourseIngredientsToList)
  - lib/automation-config.ts : defaultRecipeList + getDefaultRecipeList + setDefaultRecipeList
  - components/CourseListEditor.tsx : modal pageSheet create/rename liste
  - app/(tabs)/meals.tsx : header listes (PillTabSwitcher + bouton +) + ActionSheet long-press + auto-courses ciblées
  - app/(tabs)/index.tsx : badge dashboard cross-listes
  - app/(tabs)/more.tsx : badge route courses cross-listes
affects:
  - app/(tabs)/meals.tsx (header courses + 3 handlers auto-courses)
  - hooks/useVault.ts (interface VaultState + spread coursesHook + cache exclusion courses)
  - lib/vault-cache.ts (commentaire courses exclu — pas de bump CACHE_VERSION)
tech-stack:
  added:
    - expo-secure-store ACTIVE_LIST_KEY = 'active_course_list_v1'
    - SecureStore key 'auto_default_recipe_list'
  patterns:
    - Slug stable au rename (id = nom de fichier sans .md)
    - Frontmatter YAML manuel via serializeCourseListMeta (pas matter.stringify — convention codebase)
    - Migration auto idempotente : Listes/ vide + legacy existant → Listes/principale.md + .bak
    - mergeIntoLines helper réutilisable pour mergeCourseIngredients + mergeCourseIngredientsToList
    - resolveTargetListId() : defaultRecipeList ?? activeListId pour auto-courses recettes
key-files:
  created:
    - components/CourseListEditor.tsx
  modified:
    - lib/parser.ts
    - hooks/useVaultCourses.ts
    - hooks/useVault.ts
    - lib/automation-config.ts
    - lib/vault-cache.ts
    - components/settings/SettingsAutomations.tsx
    - app/(tabs)/meals.tsx
    - app/(tabs)/index.tsx
    - app/(tabs)/more.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - Slug stable au rename (pas de rename de fichier) — préserve cohérence SecureStore activeListId + URL
  - Pas de bump CACHE_VERSION — exclusion courses du cache au lieu de migration shape
  - Emoji read-only en mode edit (Plan v1) — édition emoji deferred itération future
  - SettingsAutomations toggles typés via subset BooleanFlagKey (defaultRecipeList est string | null, pas boolean)
  - mergeCourseIngredientsToList dispatch sur mergeCourseIngredients si listId === activeListId — évite divergence d'état
metrics:
  duration: ~45min
  completed: 2026-04-28
  tasks: 5
  files: 11 (1 nouveau, 10 modifiés)
---

# Phase D Plan 01: Courses listes multiples — Multi-magasins, migration auto, UI switcher Summary

Migration auto idempotente du mono-fichier `Liste de courses.md` vers un système multi-listes (un `.md` par liste dans `02 - Maison/Listes/`), avec switcher UI long-press, persistance liste active dans SecureStore, et ciblage auto-courses recettes via `defaultRecipeList ?? activeListId`.

## Tasks complétés

| # | Nom | Commit | Files |
|---|-----|--------|-------|
| 1 | Parser multi-listes (parseCourseList + serializeCourseListMeta + slugifyListName + serializeCourseList) | 63fdffc | lib/parser.ts |
| 2 | Hook useVaultCourses étendu — listes/activeListId + CRUD + migration auto idempotente | 9b34a42 | hooks/useVaultCourses.ts |
| 3 | Câblage useVault.ts + automation-config defaultRecipeList + cache exclusion courses | 42a90e5 | hooks/useVault.ts, lib/automation-config.ts, lib/vault-cache.ts, components/settings/SettingsAutomations.tsx |
| 4 | CourseListEditor + UI header listes onglet courses + i18n FR/EN (24 clés × 2) | 61e1dac | components/CourseListEditor.tsx, app/(tabs)/meals.tsx, locales/fr/common.json, locales/en/common.json |
| 5 | Auto-courses recettes ciblées + dashboard/badge totalRemainingAllLists | 3e19f2f | app/(tabs)/meals.tsx, app/(tabs)/index.tsx, app/(tabs)/more.tsx |

Bonus commit après nettoyage : suppression import inutilisé `COURSES_FILE_LEGACY` dans `app/(tabs)/meals.tsx`.

## Architecture

### Vault format
Un fichier par liste dans `02 - Maison/Listes/{slug}.md` avec frontmatter :

```
---
nom: Lidl
emoji: "🛒"
archive: false
createdAt: 2026-04-28
---

## 🥬 Frais
- [ ] Lait
- [x] Pommes
```

### API hook
`useVaultCourses` expose 11 nouvelles props sans toucher l'API existante :
- `listes: CourseList[]` (id, nom, emoji, archive, createdAt, itemCount, remainingCount)
- `activeListId: string | null`
- `totalRemainingAllLists: number` (somme cross-listes, substitue la liste active par le state temps réel pour cohérence optimistic)
- 8 méthodes CRUD : `setActiveList`, `createList`, `renameList`, `deleteList`, `duplicateList`, `archiveList`, `mergeCourseIngredientsToList`
- Tous les writes existants (`addCourseItem`, `toggleCourseItem`, etc.) ciblent automatiquement `pathOf(activeListId)`

### Migration auto (au mount)
1. Si `Listes/` contient déjà un `.md` → no-op (idempotent post-relaunch).
2. Sinon `ensureDir(Listes/)` :
   - Legacy `Liste de courses.md` existe → parse contenu + écrit `Listes/principale.md` (frontmatter + sections + items préservés) + backup `.bak` + delete legacy.
   - Sinon (vault vierge) → crée `Listes/principale.md` minimal.
3. Restore `activeListId` depuis SecureStore avec fallback première liste non-archivée.

### Cache (lib/vault-cache.ts)
**Pas de bump CACHE_VERSION** — décision : `courses` exclu du cache plutôt que migration shape. Le re-launch sur l'onglet courses sera ~50ms plus lent mais zéro risque de stale state ou corruption migration. Le hook `useVaultCourses` charge ses listes au mount, indépendamment du cache.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SettingsAutomations.tsx typing après ajout defaultRecipeList**
- **Found during:** Task 3 verification
- **Issue:** `keyof AutomationConfig` incluait désormais `defaultRecipeList: string | null` qui n'est pas un boolean — incompatible avec `<Switch value={...}>` et `setAutomationFlag(key, boolean)`.
- **Fix:** Type local `BooleanFlagKey = 'autoCoursesFromRecipes' | 'autoStockFromCourses' | 'autoStockDecrementCook'` dans SettingsAutomations.tsx + `setAutomationFlag` typée avec ce subset.
- **Files modified:** components/settings/SettingsAutomations.tsx, lib/automation-config.ts
- **Commit:** 42a90e5

**2. [Rule 3 - Blocking] resolveTargetListId déclaré après ses utilisateurs (TS2448)**
- **Found during:** Task 5 tsc check
- **Issue:** `resolveTargetListId` défini ligne 865 mais référencé dans `generateWeeklyShoppingList` deps ligne 576 — TS2448 block-scoped used before declaration.
- **Fix:** Déplacé `resolveTargetListId` au-dessus de `saveEdit`, juste après les states multi-listes.
- **Commit:** 3e19f2f

**3. [Rule 1 - Bug] Cache hydrate écrasait courses après mount du hook**
- **Found during:** Task 3 design
- **Issue:** `loadVaultData()` lit `COURSES_FILE` (legacy) et appelle `coursesHook.setCourses(...)` — après migration ce fichier n'existe plus → setCourses([]) écraserait l'état du hook qui a chargé la liste active depuis Listes/.
- **Fix:** Commenté l'appel `coursesHook.setCourses(val(results[2], []))` dans loadVaultData. Le hook gère son propre mount (multi-listes).
- **Commit:** 42a90e5

### Auto-added (Rule 2)

**1. [Rule 2 - Critical] Import inutilisé COURSES_FILE_LEGACY dans meals.tsx**
- **Found during:** Final verification (grep refs hors migration)
- **Issue:** Import présent mais jamais utilisé après refactor multi-listes — pollue grep audit.
- **Fix:** Supprimé l'import.
- **Commit:** dans 3e19f2f follow-up

## Conventions respectées
- FR partout (UI, commits, commentaires, i18n)
- useThemeColors strict — aucune couleur hardcoded
- Modal pageSheet drag-to-dismiss (CourseListEditor)
- Spacing/Radius/FontSize/FontWeight tokens
- expo-haptics : `Haptics.selectionAsync()` sur tap pill, `Haptics.impactAsync(Light)` sur save, `Haptics.impactAsync(Medium)` sur long-press
- `console.warn` sous `if (__DEV__)`
- Alert.alert FR pour confirmations destructives

## Verification

- `npx tsc --noEmit` : 0 erreur nouvelle (modulo pré-existantes MemoryEditor/cooklang/useVault.ts documentées CLAUDE.md) ✓
- `COURSES_FILE_LEGACY` hors `migrateIfNeeded` : 0 référence active ✓
- 4 nouveaux exports parser : `parseCourseList`, `serializeCourseListMeta`, `serializeCourseList`, `slugifyListName` ✓
- API hook étendue présente (createList/setActiveList/totalRemainingAllLists) ✓
- i18n FR + EN : 24 clés `meals.shopping.lists.*` × 2 langues ✓
- `components/CourseListEditor.tsx` créé ✓

## Self-Check: PASSED

- [x] lib/parser.ts (4 nouveaux exports)
- [x] hooks/useVaultCourses.ts (CourseList + 11 props)
- [x] hooks/useVault.ts (VaultState étendu)
- [x] lib/automation-config.ts (defaultRecipeList)
- [x] lib/vault-cache.ts (commentaire mis à jour)
- [x] components/CourseListEditor.tsx (créé)
- [x] components/settings/SettingsAutomations.tsx (BooleanFlagKey)
- [x] app/(tabs)/meals.tsx (header listes + handlers + auto-courses ciblées)
- [x] app/(tabs)/index.tsx (totalRemainingAllLists)
- [x] app/(tabs)/more.tsx (totalRemainingAllLists)
- [x] locales/fr/common.json (24 clés lists.*)
- [x] locales/en/common.json (24 clés lists.*)

Commits vérifiés : 63fdffc, 9b34a42, 42a90e5, 61e1dac, 3e19f2f.
