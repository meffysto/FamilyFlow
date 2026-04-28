---
phase: quick-260428-e5h
plan: 01
subsystem: courses
tags: [courses, voice-input, history, frequent-items, expo-secure-store]
dependency_graph:
  requires: []
  provides: [lib/course-history.ts, lib/parse-voice-courses.ts]
  affects: [app/(tabs)/meals.tsx]
tech_stack:
  added: []
  patterns: [SecureStore persistence, transcript parsing, ScrollView chips]
key_files:
  created:
    - lib/course-history.ts
    - lib/parse-voice-courses.ts
  modified:
    - app/(tabs)/meals.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - Normalisation NFD pour les clés SecureStore (insensible aux accents)
  - Cap 100 entrées max, filtre 30 jours staleness, drop oldest lastUsedAt
  - Séparateurs FR retenus : /\s+et\s+|,|;|\.\s+|\n+/i
  - Pattern Modal pageSheet identique au Dictaphone recettes existant (ligne 2334)
  - trackCourseAdd fire-and-forget (catch silencieux) pour ne pas bloquer l'UI
metrics:
  duration: ~20min
  completed: "2026-04-28"
  tasks: 2
  files: 5
---

# Phase quick-260428-e5h Plan 01: Articles fréquents + entrée vocale courses Summary

**One-liner:** Articles fréquents tap-to-add via historique SecureStore NFD + saisie vocale transcript FR parsé en items batch via DictaphoneRecorder.

## Fichiers créés

### lib/course-history.ts
Persistance de l'historique de fréquence des articles de courses via expo-secure-store.
- `trackCourseAdd(name)` — incrémente le compteur (clé normalisée NFD), persiste sous `course_history_v1`
- `getFrequentCourses(limit=8)` — top N triés par count desc / lastUsedAt desc, filtre 30j
- `clearCourseHistory()` — reset debug
- Cap 100 entrées, drop oldest lastUsedAt si dépassement

### lib/parse-voice-courses.ts
Parseur de transcript vocal vers items de courses individuels.
- `parseVoiceCourses(transcript)` — découpe sur séparateurs FR, extrait quantité + déterminants, catégorise via `categorizeIngredient`
- Déduplication par nom normalisé NFD
- Retourne tableau vide si transcript vide

## Fichiers modifiés

### app/(tabs)/meals.tsx
- Imports des 2 nouveaux modules
- State `frequentItems` + `showVoiceModal`
- `useEffect` chargement au basculement vers l'onglet courses
- `handleAddCourse` enrichi : trackCourseAdd fire-and-forget après ajout réussi
- `handleAddFrequent` : tap chip → addCourseItem + haptics + refresh chips
- `handleVoiceResult` : parseVoiceCourses → mergeCourseIngredients → toast FR
- Bandeau horizontal `frequentBar` (ScrollView de chips) au-dessus du KeyboardAvoidingView
- Bouton micro 🎙️ dans l'addBar à droite du +
- Modal DictaphoneRecorder `pageSheet` pour saisie vocale
- Styles via tokens design : `frequentBar`, `frequentScrollContent`, `frequentChip`, `frequentChipText`, `micBtn`, `micBtnIcon`

### locales/fr/common.json + locales/en/common.json
8 clés i18n ajoutées sous `meals.shopping` dans les deux fichiers :
- `frequentLabel`, `frequentHintA11y`, `frequentChipA11y`
- `voiceAddBtnA11y`, `voiceAddTitle`, `voiceAddSubtitle`
- `voiceAddedToast`, `voiceNothingDetected`

## Décisions clés

| Décision | Raison |
|----------|--------|
| Normalisation NFD pour clés SecureStore | Insensible aux accents ("tomates" == "tomates") |
| Cap 100 entrées, drop oldest | Évite ballonnement SecureStore (limit ~2KB typique) |
| Filtre 30 jours staleness | N'affiche que les habitudes récentes |
| Séparateurs `/\s+et\s+|,|;|\.\s+|\n+/i` | Couvre l'élocution FR naturelle du Dictaphone |
| trackCourseAdd fire-and-forget | Ne bloque pas le thread UI en cas de latence SecureStore |
| Modal pageSheet + DictaphoneRecorder | Réutilise le composant existant, cohérence avec le Dictaphone recettes |

## Limitations connues

- Parsing vocal heuristique non exhaustif : syntaxes atypiques ("une barquette de fraises Gariguette") peuvent perdre des nuances de quantité
- Pas de tests Jest formels (cohérent avec scope quick-task)
- frequentBar n'affiche rien au premier lancement (historique vide) — comportement attendu et documenté

## Known Stubs

Aucun stub — les chips sont alimentés par l'historique réel SecureStore, la liste est vide au premier usage (comportement attendu).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `lib/course-history.ts` existe et exporte trackCourseAdd, getFrequentCourses, clearCourseHistory
- [x] `lib/parse-voice-courses.ts` existe et exporte parseVoiceCourses
- [x] `app/(tabs)/meals.tsx` contient imports, états, handlers, UI bandeau chips, bouton micro, modale vocale
- [x] 8 clés i18n présentes dans FR et EN
- [x] `npx tsc --noEmit` — zéro nouvelle erreur
- [x] Commits : 6687935 (lib), 1b94ddd (meals.tsx + i18n)
