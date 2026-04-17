---
phase: 35-carte-enveloppe-dashboard-cran-bo-te-aux-lettres
plan: 03
subsystem: lovenotes
tags: [lovenotes, dashboard, more, navigation]
requires:
  - lib/lovenotes/selectors.ts unreadForProfile (Phase 35-01)
  - components/lovenotes EnvelopeCard (Phase 35-02)
  - app/(tabs)/lovenotes.tsx route (Phase 35-01)
  - hooks/useVault loveNotes (Phase 34-03)
provides:
  - Carte enveloppe pinned conditionnelle dans le dashboard (visible si pendingLoveNotes.length > 0)
  - Tuile permanente 'Love Notes' dans more.tsx catégorie famille avec badge unread
affects:
  - app/(tabs)/index.tsx (+23 lignes : imports, destructure, useMemo, JSX injection)
  - app/(tabs)/more.tsx (+9 lignes : import selector, destructure, useMemo, entry)
tech-stack:
  added: []
  patterns:
    - useMemo ([loveNotes, activeProfile?.id]) — dérivation pure côté consommateur
    - SectionErrorBoundary wrapping pour isoler la carte (cohérent avec autres sections)
    - Render conditionnel pur (pas de flash, disparaît instantanément quand count = 0)
    - Pressable externe au transform rotate (Pitfall 8 — déjà géré par EnvelopeCard interne)
key-files:
  created: []
  modified:
    - app/(tabs)/index.tsx
    - app/(tabs)/more.tsx
decisions:
  - useMemo deps activeProfile?.id (pas activeProfile entier) — évite recompute sur changement de référence sans changement réel d'identité
  - Pas de clé i18n 'menu.items.loveNotes' créée — string literale 'Love Notes' suffit pour scope Phase 35 minimal
  - Injection JSX placée AVANT le bloc IIFE sortedSections.filter, pas dans sortedSections — la carte reste pinned hors config utilisateur (Anti-Pattern RESEARCH)
metrics:
  duration: 3min
  completed: 2026-04-17
  tasks: 2
  files: 2
---

# Phase 35 Plan 03 : Câblage consommateurs (dashboard pinned + tuile more)

Injection conditionnelle de la carte enveloppe pinned dans le dashboard (`app/(tabs)/index.tsx`) et tuile permanente Love Notes dans le menu more (`app/(tabs)/more.tsx`), catégorie famille. Pure composition — réutilise les primitives livrées par Plans 01 (route + selectors) et 02 (EnvelopeCard).

## Résultats

| Tâche | Status | Commit |
|-------|--------|--------|
| Task 1 — EnvelopeCard pinned dans dashboard (imports, useMemo, JSX) | ✓ | c13dcc7 |
| Task 2 — Tuile Love Notes permanente dans more.tsx famille | ✓ | 571e91b |

## Vérification

- `npx tsc --noEmit` (hors pré-existants MemoryEditor/cooklang/useVault) → **0 erreur nouvelle**
- `npx jest lib/__tests__/lovenotes-selectors.test.ts --no-coverage` → **19/19 tests verts**
- Gate ordering automatique : `pendingLoveNotes` (line 522) < `sortedSections.filter` (line 1062) ✓
- Acceptance criteria Task 1 : 8/8 grep checks ✓ (EnvelopeCard import, unreadForProfile, pendingLoveNotes useMemo, SectionErrorBoundary "Love Notes", router.push, Haptics.selectionAsync, recipientName={activeProfile.name})
- Acceptance criteria Task 2 : 7/7 grep checks ✓ (unreadForProfile, loveNoteUnreadCount, loveNotes destructure, label "Love Notes", route '/(tabs)/lovenotes', emoji 💌, catFamille préservé)

## Décisions

1. **Deps useMemo `activeProfile?.id` (pas `activeProfile`)** : optional chain sur l'id stable pour éviter recompute si la référence Profile change sans changement d'identité (cohérent pattern Phase 34-03 hook).
2. **Pas de clé i18n 'menu.items.loveNotes'** : string literale `'Love Notes'` suffisante pour scope Phase 35. Migration i18n possible en Phase 36 si besoin (modération nécessite garde-parent FR/EN). Évite pollution `i18n/locales/*.json`.
3. **Injection AVANT IIFE sortedSections.filter** : la carte est pinned hors config utilisateur — cohérent Anti-Pattern RESEARCH (ne pas l'ajouter à sortedSections sinon l'utilisateur peut la masquer via DashboardPrefsModal).
4. **SectionErrorBoundary `name="Love Notes"`** : isolation des erreurs runtime (Reanimated worklet, SVG layout) — cohérent avec toutes les sections dashboard.
5. **`router.push('/(tabs)/lovenotes' as any)`** : cast `any` obligatoire — la route n'est pas typée par expo-router (déclarée `href:null` Plan 01).

## Déviations

Aucune. Plan exécuté exactement comme écrit. Tous les imports vérifiés présents (Haptics absent du fichier — ajouté dans Task 1).

## Suite

- **Phase 36 (Wave 4)** : composition + reveal + notifications (LoveNoteComposer, RevealAnimation, expo-notifications planifiée). La boucle visibilité est complète — l'utilisateur peut consulter ses notes via dashboard pinned OU via more.tsx → /(tabs)/lovenotes.
- **Phase 37** : garde-parent + modération (toggle par profil enfant, validation parent avant envoi).

## Self-Check: PASSED

- [x] app/(tabs)/index.tsx — modifié (imports, destructure loveNotes, useMemo pendingLoveNotes, JSX EnvelopeCard injection)
- [x] app/(tabs)/more.tsx — modifié (import unreadForProfile, destructure loveNotes, useMemo loveNoteUnreadCount, entry 💌 Love Notes)
- [x] Commit c13dcc7 — FOUND in git log
- [x] Commit 571e91b — FOUND in git log
- [x] tsc clean (hors pré-existants)
- [x] jest selectors 19/19 verts
- [x] Gate ordering injection avant sortedSections.filter ✓
