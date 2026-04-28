---
phase: quick-260428-kda
plan: "01"
subsystem: courses
tags: [courses, vocal, modal, i18n, reanimated, lucide]
dependency_graph:
  requires:
    - components/DictaphoneRecorder.tsx
    - lib/parse-voice-courses.ts
    - hooks/useVaultCourses.ts (mergeCourseIngredients)
  provides:
    - components/VoiceCoursesReview.tsx
  affects:
    - app/(tabs)/meals.tsx (handleVoiceResult refactorisé)
tech_stack:
  added: []
  patterns:
    - "Modal pageSheet + drag handle + KeyboardAvoidingView"
    - "ItemRow mémoïsée React.memo avec qtyDisplay string locale"
    - "Picker section overlay inline (Animated.View FadeInDown)"
    - "FadeInDown.delay(index*50) cascade + FadeOutUp + LinearTransition"
key_files:
  created:
    - components/VoiceCoursesReview.tsx
  modified:
    - app/(tabs)/meals.tsx
    - locales/fr/common.json
    - locales/en/common.json
decisions:
  - "qtyDisplay champ runtime sur ItemWithId : stocke la string brute pour l'édition, parse en number|null au save — évite la perte de saisies comme '120g'"
  - "Picker section overlay (pattern ReceiptReview) plutôt que chips de CourseItemEditor — cohérence visuelle ReceiptReview, confirmé plan"
  - "Copier-adapter ReceiptReview (pas extraire) — isolation domaines budget vs courses préservée (D-01)"
  - "handleVoiceResult devient synchrone — async déplacé dans handleVoiceReviewSave uniquement"
metrics:
  duration: "~10min"
  completed: "2026-04-28T12:47:00Z"
  tasks: 2
  files: 4
---

# Phase quick-260428-kda Plan 01: VoiceCoursesReview Summary

**One-liner:** Modal pageSheet de révision/correction des articles vocaux avec ItemRow mémoïsée, picker section overlay lucide et sauvegarde via mergeCourseIngredients.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Créer VoiceCoursesReview.tsx + clés i18n | 57315eb | components/VoiceCoursesReview.tsx, locales/fr/common.json, locales/en/common.json |
| 2 | Câbler VoiceCoursesReview dans meals.tsx | 35072e8 | app/(tabs)/meals.tsx |

## What Was Built

**VoiceCoursesReview.tsx** (260 lignes) — modal pageSheet qui s'intercale entre la transcription vocale (`DictaphoneRecorder`) et l'écriture vault (`mergeCourseIngredients`).

Fonctionnalités :
- Liste les articles détectés avec champs éditables : nom (TextInput), quantité texte libre (TextInput), rayon (picker overlay)
- Supprimer une ligne : icône `X` lucide + animation `FadeOutUp`
- Ajouter une ligne vide : bouton `Plus` lucide avec bordure pointillée
- État vide : `ShoppingCart` lucide + message i18n
- Cascade d'entrée : `FadeInDown.delay(index * 50)`
- Bouton fixe bas : `Button variant="primary" size="lg" fullWidth`
- Drag handle + `presentationStyle="pageSheet"` pour swipe-to-dismiss iOS natif

**meals.tsx** — refactor câblage vocal :
- `handleVoiceResult` simplifié (synchrone) : parse → si 0 items → toast, sinon ouvre review
- `handleVoiceReviewSave` nouveau : ferme review → merge → tracking → toast
- `<VoiceCoursesReview>` monté avec 5 props (visible, items, sections, onClose, onSave)

## Decisions Made

1. **qtyDisplay string locale** — champ runtime `ItemWithId.qtyDisplay` stocke la saisie brute ("3", "120g", "1,5"). Au save, `parseFloat(value.replace(',','.'))` produit `quantity: number | null`. Cela évite la perte de saisies contenant des unités.

2. **Picker section overlay** — reproduit le pattern de `ReceiptReview` (overlay inline `Animated.View`) plutôt que les chips de `CourseItemEditor`. Cohérence visuelle avec le flux budget, confirmé par le plan.

3. **Pas d'extraction de composant générique** — `VoiceCoursesReview` est un fork de `ReceiptReview` (isolation domaines, décision utilisateur D-01).

4. **handleVoiceResult synchrone** — la logique async (merge + tracking + toast) est entièrement dans `handleVoiceReviewSave`. `handleVoiceResult` n'a plus besoin d'`async`.

## Deviations from Plan

Aucune — plan exécuté exactement tel qu'écrit.

## Pattern Réutilisable

Pour tout futur flux "IA parse → review → write" (import photo, autre flux IA) :

```
1. Modal pageSheet (presentationStyle + animationType="slide")
2. useEffect([inputs]) → setLocalItems(inputs.map((it, i) => ({...it, id: i, displayField: ...})))
3. ItemRow React.memo avec onUpdate(index, field, value)
4. handleSave : filter(trim) + recompose payload → onSave(payload)
5. parent: onSave → setVisible(false) + write vault
```

Ce pattern isole : (a) l'affichage/édition dans le composant Review, (b) l'écriture dans le parent via callback — testable indépendamment.

## Known Stubs

Aucun — toutes les données passées en props depuis `voiceReviewItems` (réel) et `courseSections` (réel).

## Self-Check: PASSED

- `components/VoiceCoursesReview.tsx` : existe (créé)
- Commit 57315eb : `feat(quick-260428-kda-01): créer VoiceCoursesReview + clés i18n`
- Commit 35072e8 : `feat(quick-260428-kda-01): câbler VoiceCoursesReview dans meals.tsx`
- `npx tsc --noEmit` : aucune nouvelle erreur TS
- Zéro hex hardcoded dans VoiceCoursesReview.tsx
- Icônes lucide (X, Check, Plus, ChevronDown/Up, ShoppingCart) — pas de ✕/✓/▼ texte
- Clés `meals.shopping.voiceReview.*` présentes en FR et EN
