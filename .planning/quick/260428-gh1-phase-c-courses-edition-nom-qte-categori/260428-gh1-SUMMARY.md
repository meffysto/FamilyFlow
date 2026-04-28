---
phase: quick-260428-gh1
plan: 01
subsystem: courses
tags: [courses, edit, bottom-sheet, ux, i18n]
requires: [quick-260428-fnw, quick-260428-g5n]
provides:
  - splitCourseText / joinCourseText helpers
  - updateCourseItem(lineIndex, patch) hook method
  - CourseItemEditor bottom sheet component
affects: [meals.tsx]
tech-stack:
  added: []
  patterns: [bottom-sheet-pageSheet, optimistic-ui, vault-line-rewrite, alert-menu]
key-files:
  created:
    - lib/courses-text.ts
    - components/CourseItemEditor.tsx
  modified:
    - lib/auto-courses.ts
    - hooks/useVaultCourses.ts
    - hooks/useVault.ts
    - app/(tabs)/meals.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - "Préservation de l'état coché [x]/[ ] lors d'updateCourseItem (regex sur ligne d'origine)"
  - "No-op explicite si patch identique (text + section inchangés)"
  - "Unités poids/volume gardées dans qty (`120g`) ; unités comptables (sachet, paquet) remises dans name pour ne pas perdre l'info"
  - "courseTextWrap nouveau style flex:1 (TouchableOpacity wrapper) — courseText n'a plus le flex:1, c'est le wrapper qui le porte"
  - "Long-press = Alert.alert natif iOS (3 options) plutôt que menu custom — KISS, cohérent avec le reste de l'app"
metrics:
  duration: 25min
  completed: 2026-04-28
---

# Quick task 260428-gh1: Phase C courses — édition nom + qté + catégorie

Bottom sheet pageSheet pour éditer un item de courses (tap sur le texte) + menu contextuel long-press (Dupliquer / Supprimer / Annuler).

## Tasks complétées

| # | Tâche | Commit |
|---|-------|--------|
| 1 | Helper splitCourseText/joinCourseText + export COURSE_TEXT_RE | 2ddf6fc |
| 2 | updateCourseItem dans useVaultCourses + propagation useVault | 954e538 |
| 3 | Composant CourseItemEditor.tsx (Modal pageSheet) | a190ee5 |
| 4 | Wiring meals.tsx — suppression ancien picker + tap/long-press | 198f619 |
| 5 | Clés i18n FR + EN (12 clés × 2) | 0b4afa9 |

## Décisions

- **Préservation [x]/[ ]** : `updateCourseItem` lit la ligne d'origine via regex `/^-\s+\[(x| )\]/i` avant réécriture — l'utilisateur ne perd pas son état "acheté" en éditant.
- **No-op patch identique** : early-return si `current.text === patch.text && current.section === patch.section` — évite write inutile dans le vault.
- **Round-trip non strict** pour unités comptables : `splitCourseText("3 sachets de levure")` retourne `{ quantity: "3", name: "sachet de levure" }` (l'unité est remise dans le nom). C'est volontaire — l'utilisateur voit "3 / sachet de levure" en édition, et en sauvegardant on obtient `3 sachet de levure` (l'app n'a pas besoin du round-trip strict pour les unités comptables, contrairement aux poids/volumes).
- **Long-press = Alert natif** : 3 options (Dupliquer / Supprimer / Annuler) avec `Haptics.impactAsync(Medium)` — pas de menu contextuel custom, cohérent avec les autres flows de l'app.
- **courseTextWrap** : nouveau style `flex:1` porté par le wrapper TouchableOpacity (le `flex:1` a été retiré de `courseText` pour préserver la mise en page flex de la row).

## Pitfalls rencontrés

- **`tint` import inutilisé** : retiré au passage de la suppression du picker (pas d'erreur TS car déjà utilisé ailleurs dans le fichier).
- **Styles orphelins (catPickerContent, catGrid, catChip…)** : laissés en place pour minimiser le diff. RN ne lève pas d'erreur sur les styles non utilisés.
- **Aucune regression TS** : `npx tsc --noEmit` retourne 0 erreur (build clean — y compris les fichiers documentés "pré-existants" qui ne lèvent plus rien dans cette branche).

## Vérifications

- [x] `npx tsc --noEmit` → 0 erreur (clean build)
- [x] `grep -E "#[0-9a-fA-F]{3,6}" components/CourseItemEditor.tsx` → 0 hit (theme-strict)
- [x] `grep "categoryPickerItem|handleChangeCourseCategory|handleSelectCategory|handleAddNewCategory" "app/(tabs)/meals.tsx"` → 0 hit (clean)
- [x] JSON valid (fr + en)

## Suite logique

- **Phase D — multi-listes** : permettre plusieurs listes de courses (vacances, hebdo, courses ponctuelles) avec swipe entre listes.
- **Phase E — prix lecture-only** : afficher un prix indicatif lu depuis le stock pour estimer le coût total de la liste.
- (Optionnel) Cleanup styles orphelins du picker dans meals.tsx (catPickerContent, catGrid, catChip, catChipText, catNewRow, catEmojiBtn, catEmojiBtnText, catNewInput, catNewBtn, catNewBtnText, emojiGrid, emojiOption, emojiOptionText) — purge ~80 lignes de styles morts.

## Self-Check: PASSED

- [x] FOUND: lib/courses-text.ts
- [x] FOUND: components/CourseItemEditor.tsx
- [x] FOUND: commits 2ddf6fc, 954e538, a190ee5, 198f619, 0b4afa9
