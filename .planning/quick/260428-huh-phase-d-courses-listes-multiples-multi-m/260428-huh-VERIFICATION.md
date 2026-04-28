---
phase: 260428-huh-phase-d-courses-listes-multiples
verified: 2026-04-28T00:00:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase D: Courses Listes Multiples — Verification Report

**Phase Goal:** Multi-listes courses (multi-magasins) avec migration auto idempotente, hook étendu, UI switcher, auto-courses ciblées, dashboard badge agrégé.
**Verified:** 2026-04-28
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration auto idempotente au boot (legacy → Listes/principale.md + .bak) | VERIFIED | `hooks/useVaultCourses.ts:170-220` migrateIfNeeded — early-return si Listes/ contient déjà des .md, parse legacy via parseCourses, écrit principale.md, backup .bak puis delete sécurisé (skip delete si .bak fail) |
| 2 | API hook étendue exposée (listes, activeListId, totalRemainingAllLists, setActiveList, createList, renameList, deleteList, duplicateList, archiveList, mergeCourseIngredientsToList) | VERIFIED | `hooks/useVaultCourses.ts:88-96` interface + `:556-721` implémentations + `:754-762` retour |
| 3 | UI switcher header listes + bouton + + long-press ActionSheet | VERIFIED | `app/(tabs)/meals.tsx:1466-1560` ScrollView pills horizontal avec emoji/nom/badge/star, bouton Add trailing, onLongPress=handleListLongPress |
| 4 | CourseListEditor.tsx existe (modal pageSheet) | VERIFIED | 240 lignes, `presentationStyle="pageSheet"` ligne 108, drag-to-dismiss natif iOS |
| 5 | automation-config defaultRecipeList + helpers | VERIFIED | `lib/automation-config.ts` : KEYS.defaultRecipeList, AutomationConfig.defaultRecipeList, getDefaultRecipeList, setDefaultRecipeList |
| 6 | Auto-courses meals.tsx résolvent listId cible | VERIFIED | `app/(tabs)/meals.tsx:257` resolveTargetListId + utilisé dans saveEdit (l.400), generateWeeklyShoppingList (l.567), handleAddToShoppingList (l.924) |
| 7 | Dashboard index.tsx + more.tsx utilisent totalRemainingAllLists | VERIFIED | `app/(tabs)/index.tsx:299,618,672,711,779` ; `app/(tabs)/more.tsx:115,173,201` |
| 8 | Aucune ref orpheline à COURSES_FILE_LEGACY hors migration | VERIFIED | grep : 6 refs dans useVaultCourses.ts toutes dans migrateIfNeeded (l.187-202) ; constante définie dans courses-constants.ts (OK) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/parser.ts` | parseCourseList + serializeCourseListMeta + slugifyListName + serializeCourseList + CourseListMeta | VERIFIED | 5 exports confirmés |
| `hooks/useVaultCourses.ts` | API étendue + migration + CRUD | VERIFIED | UseVaultCoursesResult étendu avec 11 props, mergeCourseIngredientsToList ligne 692 |
| `components/CourseListEditor.tsx` | Modal pageSheet drag-to-dismiss create/rename | VERIFIED | 240 lignes (>120 min), pageSheet présentation native iOS |
| `app/(tabs)/meals.tsx` | Header listes + auto-courses ciblées | VERIFIED | listes destructurés (l.135), pill switcher (l.1466+), 3 handlers auto-courses ciblés |
| `lib/vault-cache.ts` | courses exclu, CACHE_VERSION inchangé | VERIFIED | Commentaire "courses (Phase D 260428-huh : multi-listes)" l.12 ; CACHE_VERSION=8 inchangé |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| useVaultCourses | 02 - Maison/Listes/{slug}.md | vaultRef.writeFile + COURSES_LISTS_DIR | WIRED | pathOf(id) helper utilisé partout |
| meals.tsx | useVault().createList/setActiveList/listes | hook spread | WIRED | Destructuring ligne 135 + appels dans les handlers |
| index.tsx | totalRemainingAllLists | remplacement coursesRemaining | WIRED | Ligne 672 `coursesRemaining: totalRemainingAllLists` |
| more.tsx | totalRemainingAllLists | badge route courses | WIRED | Ligne 173 `badge: totalRemainingAllLists \|\| undefined` |
| useVault.ts | saveCache courses=[] | Phase D exclusion | WIRED | Ligne 1622 `courses: [] as CourseItem[], // Phase D : exclu du cache` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| meals.tsx pill switcher | listes | useVault → useVaultCourses → loadListes() lit Listes/*.md | Yes (parseCourseList sur chaque fichier) | FLOWING |
| index.tsx badge | totalRemainingAllLists | useMemo sur listes + courses (substitue active par state temps réel) | Yes (lignes 728-740) | FLOWING |
| more.tsx badge | totalRemainingAllLists | même source | Yes | FLOWING |
| CourseListEditor onSave | nom + emoji | TextInput controlled + emoji grid | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compile (filtré pré-existantes) | `npx tsc --noEmit | grep -v "MemoryEditor\|cooklang\|useVault.ts" | grep "error TS"` | (empty) | PASS |
| Parser exports présents | `grep "export" lib/parser.ts` | 5 exports | PASS |
| CourseListEditor existe | `ls components/CourseListEditor.tsx` | 240 lignes | PASS |
| Hook API étendu | `grep "createList\|setActiveList\|totalRemainingAllLists" hooks/useVaultCourses.ts` | tous présents | PASS |
| i18n FR `lists` | `grep -c "lists" locales/fr/common.json` | 1 namespace | PASS |
| i18n EN `lists` | `grep -c "lists" locales/en/common.json` | 2 namespaces | PASS |
| Refs legacy hors migration | `grep "COURSES_FILE_LEGACY" hooks/ app/ components/ lib/` | uniquement migrateIfNeeded + constants | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PHASE-D | 260428-huh-PLAN.md | Multi-listes courses + migration + UI switcher + auto-courses ciblées + dashboard agrégé | SATISFIED | Toutes les 8 truths VERIFIED |

### Anti-Patterns Found

Aucun anti-pattern bloquant détecté. Notes :
- Ligne 89 vault-cache.ts : `courses: CourseItem[]` conservé dans VaultCacheState pour compat shape (write `[]`, hydrate ignoré). Décision documentée et non régressive.
- Emoji edit deferred (mode 'edit' du CourseListEditor) — décision documentée dans SUMMARY, non bloquant.

### Human Verification Required

Items recommandés pour test manuel runtime (non bloquants) :

1. **Migration boot post-merge** — Tester sur device avec un vault ayant `Liste de courses.md` existant : vérifier qu'au premier boot, `Listes/principale.md` est créé, `.bak` présent, et legacy supprimé.
2. **Persistance activeListId** — Tester switch de liste, kill app, relaunch : la liste active doit être restaurée. Si liste supprimée/archivée pendant l'absence → fallback sur première non-archivée.
3. **Long-press ActionSheet** — Tester chaque action (Renommer/Dupliquer/SetDefault/Archiver/Supprimer) sur device.
4. **Auto-courses cross-liste** — Définir une liste comme défaut recettes, depuis le menu repas générer la weekly shopping list, vérifier le toast et que les items vont bien sur la liste cible (pas la active).

### Gaps Summary

Aucun gap. Phase D entièrement implémentée selon le plan, avec 5 commits propres, 3 deviations auto-fixed documentées dans le SUMMARY (SettingsAutomations BooleanFlagKey, resolveTargetListId hoisting, cache hydrate non-write courses).

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
