---
phase: quick-260427-jp0
title: Onboarding — cohérence couleurs/UI
completed: 2026-04-27
status: completed
---

# Quick Task 260427-jp0 — SUMMARY

## Livré
Suppression des hardcoded couleurs/tokens dans `app/onboarding.tsx` pour aligner sur les conventions post-refactor (palette atténuée + tokens design + dark mode).

## Modifs

### Imports
- Ajout `import { Shadows } from '../constants/shadows'`

### JSX
- `ProgressBar`: récupère `colors` depuis `useThemeColors()`, applique `colors.border` (track) + `colors.textMuted` (label) inline
- `TinderCard` badges Yes/No: `colors.success` / `colors.error` inline (border + bg avec alpha `+ '22'`)
- Quote `"` décoratif: `colors.borderLight` inline
- Tinder buttons (tap fallback): `colors.error` / `colors.success` au lieu de `#EF4444` / `#22C55E`

### StyleSheet
- `progressTrack`: suppression `backgroundColor: '#E5E7EB'`
- `progressLabel`: suppression `color: '#9CA3AF'`
- `welcomePreview`: shadow inline → `...Shadows.md`
- `testimonialCard`: shadow inline → `...Shadows.sm`
- `tinderCard`: shadow inline → `...Shadows.lg` (override `shadowColor: colors.text` au point d'usage conservé)
- `tinderBadgeYes` / `tinderBadgeNo`: suppression couleurs (déplacées en inline)
- `tinderQuote`: `fontSize: 48` → `FontSize.hero` (32px), `lineHeight` aligné, suppression `color: '#D1D5DB'`

### Préservé volontairement
- `miniFarmSky` (#b8e4f5), `miniFarmGroundBack` (#7ab648), `miniFarmGroundFront` (#5a9032) — illustration décorative ciel/herbe, pas du chrome UI

## Validation
- `npx tsc --noEmit` → ✅ pas d'erreur
- 11 hardcoded values → tokens du design system
- Dark mode désormais supporté pour ces zones (les couleurs adaptatives suivent le thème)

## Fichiers touchés
- `app/onboarding.tsx`
