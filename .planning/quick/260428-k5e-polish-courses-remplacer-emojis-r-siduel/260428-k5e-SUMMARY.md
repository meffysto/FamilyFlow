---
phase: quick-260428-k5e
plan: 01
subsystem: courses-ui
tags: [lucide, i18n, emoji-migration, courses, dashboard]
dependency_graph:
  requires: []
  provides: [courses-ui-lucide-complete, dashboard-courses-i18n]
  affects: [app/(tabs)/meals.tsx, components/dashboard/DashboardCourses.tsx]
tech_stack:
  added: []
  patterns: [lucide-react-native icons, useThemeColors colors, i18next t()]
key_files:
  created: []
  modified:
    - app/(tabs)/meals.tsx
    - components/CourseItemEditor.tsx
    - components/dashboard/DashboardCourses.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - Remplacement conditionnel pour le picker de section (selectedSection ? Text : FolderOpen) préserve la logique de troncage existante
  - Suppression des styles orphelins checkboxCheck et courseRemoveText (plus référencés après migration)
  - toTake choisi comme clé i18n cohérente avec la convention camelCase déjà en place sous dashboard.courses
metrics:
  duration: ~5min
  completed: 2026-04-28
  tasks_completed: 2
  files_modified: 5
---

# Phase quick-260428-k5e Plan 01: Polish Courses — Remplacer emojis résiduels — Summary

**One-liner:** Migration emoji→lucide complète pour le chrome Courses (ShoppingCart/FolderOpen/Check/X) + internationalisation de la chaîne "à prendre" dans DashboardCourses.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remplacer emojis résiduels par icônes lucide dans meals.tsx + commenter palette CourseItemEditor | 48f35f2 | app/(tabs)/meals.tsx, components/CourseItemEditor.tsx |
| 2 | i18n DashboardCourses + ajout clé locales fr/en | 9d90e2b | components/dashboard/DashboardCourses.tsx, locales/fr/common.json, locales/en/common.json |

## Changes Summary

### Task 1 — meals.tsx (4 remplacements) + CourseItemEditor.tsx (commentaire)

**meals.tsx:**
- Import lucide étendu: `Check, FolderOpen, ShoppingCart, X` ajoutés (conserve `Mic, Plus, ShoppingBag, Star`)
- Empty state Courses: `<Text style={styles.emptyEmoji}>🛒</Text>` → `<ShoppingCart size={48} color={colors.textMuted} style={{ marginBottom: 8 }} />`
- Checkbox cochée: `<Text style={[styles.checkboxCheck, ...]}>✓</Text>` → `<Check size={14} color={colors.onPrimary} strokeWidth={3} />`
- Bouton supprimer: `<Text style={[styles.courseRemoveText, ...]}>✕</Text>` → `<X size={16} color={colors.textMuted} />`
- Picker de section: restructuré en conditionnel `{selectedSection ? <Text ...> : <FolderOpen size={16} color={colors.textSub} />}`
- Styles orphelins `checkboxCheck` et `courseRemoveText` supprimés du StyleSheet

**CourseItemEditor.tsx:**
- Commentaire FR ajouté au-dessus de `NEW_CATEGORY_EMOJIS` expliquant pourquoi les emojis restent (compatibilité vault Obsidian)

### Task 2 — i18n DashboardCourses

- `locales/fr/common.json`: clé `dashboard.courses.toTake: "à prendre"` ajoutée
- `locales/en/common.json`: clé `dashboard.courses.toTake: "to buy"` ajoutée
- `DashboardCourses.tsx`: `{' à prendre'}` → `{` ${t('dashboard.courses.toTake')}`}`

## Deviations from Plan

None - plan exécuté exactement tel qu'écrit.

## Verification

- `npx tsc --noEmit` — aucune nouvelle erreur (modulo pré-existantes documentées CLAUDE.md)
- JSON valide: `node -e "JSON.parse(require('fs').readFileSync('locales/fr/common.json'))..."` → "locales OK"
- Inspection statique:
  - `🛒` retiré de la zone empty state Courses (ligne 1597)
  - `📂` retiré du picker de section (ligne ~1761)
  - `✓` retiré du checkbox check (ligne 1630)
  - `✕` retiré du bouton supprimer course (ligne 1674)
  - `' à prendre'` hardcodé absent de DashboardCourses.tsx
  - Commentaire `// Emojis stockés` présent dans CourseItemEditor.tsx ligne 39
  - Clé `toTake` présente dans fr/common.json ligne 1524 et en/common.json ligne 1516

## Self-Check: PASSED

- Commits 48f35f2 et 9d90e2b existent dans l'historique git
- Fichiers modifiés: meals.tsx, CourseItemEditor.tsx, DashboardCourses.tsx, fr/common.json, en/common.json
- Aucun style orphelin laissé (checkboxCheck + courseRemoveText supprimés)
- Couleurs strictement via `useThemeColors()` — `colors.textMuted`, `colors.onPrimary`, `colors.textSub`
