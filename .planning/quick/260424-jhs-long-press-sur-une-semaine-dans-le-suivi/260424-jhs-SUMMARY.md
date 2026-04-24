---
phase: quick-260424-jhs
plan: 01
subsystem: pregnancy
tags: [pregnancy, long-press, haptics, i18n, modal]
dependency_graph:
  requires: []
  provides: [long-press-edit-pregnancy-week]
  affects: [app/(tabs)/pregnancy.tsx]
tech_stack:
  added: []
  patterns: [onLongPress, editingWeek state, haptics impactAsync]
key_files:
  created: []
  modified:
    - app/(tabs)/pregnancy.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - editingWeek null = semaine courante, non-null = semaine arbitraire via long press
  - Préservation de la date existante si édition d'une semaine passée (date actuelle sinon)
  - TouchableOpacity wrapper sur weekCard avec delayLongPress=400ms
metrics:
  duration: ~5min
  completed: "2026-04-24"
---

# Phase quick-260424-jhs Plan 01: Long press édition semaine grossesse — Summary

**One-liner:** Long press sur chaque carte semaine ouvre le modal pré-rempli avec les données existantes, l'enregistrement cible uniquement la semaine éditée via `editingWeek ?? currentWeek`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Ajouter long press + modal prefill + save ciblé | b964d59 | app/(tabs)/pregnancy.tsx |
| 2 | Ajouter clés i18n FR + EN | fb98a5b | locales/fr/common.json, locales/en/common.json |

## What Was Built

- Nouvel état `editingWeek: number | null` — `null` = semaine courante, non-null = semaine ciblée par long press
- Fonction `openEdit(week, entry?)` : déclenche `Haptics.impactAsync(Medium)`, préremplit le formulaire avec les données de l'entrée existante (poids, symptômes, notes), ouvre le modal
- `openAdd()` modifié pour reset `editingWeek` à `null` (bouton `+ Cette semaine` inchangé)
- `handleSave()` utilise `targetWeek = editingWeek ?? pregnancyInfo.currentWeek` — préserve la date existante si édition d'une semaine passée
- Chaque `weekCard` wrappé dans `TouchableOpacity` avec `onLongPress={() => openEdit(week, entry)}` et `delayLongPress={400}`
- Titre du modal dynamique : affiche la semaine ciblée (`editingWeek ?? currentWeek`)
- `onRequestClose` et `ModalHeader.onClose` nettoient `editingWeek` à la fermeture
- Hint discret sous le titre "Semaine par semaine" : `t('pregnancy.longPressHint')`
- Style `hint` ajouté dans `StyleSheet.create`
- Clés `pregnancy.longPressHint` ajoutées dans FR (`"Appui long sur une semaine pour modifier"`) et EN (`"Long press on a week to edit"`)

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Known Stubs

None.

## Self-Check: PASSED

- `app/(tabs)/pregnancy.tsx` modifié et commité (b964d59)
- `locales/fr/common.json` et `locales/en/common.json` mis à jour et commités (fb98a5b)
- `npx tsc --noEmit` : 0 nouvelles erreurs
- JSON locales valides
