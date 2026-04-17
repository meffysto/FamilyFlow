---
phase: 36
plan: 02
subsystem: lovenotes
tags: [lovenotes, notifications, routing, deep-link]
requires: [phase-36-01-fondations]
provides:
  - "Routing notif tap love note (warm + cold start) via data.route"
affects:
  - app/_layout.tsx (useEffect RootLayout étendu)
tech_stack:
  added: []
  patterns:
    - "addNotificationResponseReceivedListener + cleanup sub.remove() (warm start)"
    - "getLastNotificationResponseAsync + setTimeout(..., 0) (cold start race — Pitfall 7)"
    - "Lecture data.route posé par scheduler → router.push(route as any)"
key_files:
  created: []
  modified:
    - app/_layout.tsx
decisions:
  - "Étendre le useEffect existant (pas créer un nouveau) — 1 seul useEffect dans RootLayout, hiérarchie providers inchangée"
  - "setTimeout(..., 0) sur cold start — getLastNotificationResponseAsync peut résoudre avant que le Stack expo-router ne soit monté, déférer le push au prochain tick garantit nav ready"
  - "router.push(route as any) — route dynamique string non littérale, cast nécessaire pour Href typé strict expo-router"
  - "catch silencieux sur getLastNotificationResponseAsync — pattern idempotent, un échec ne doit pas bloquer le boot"
metrics:
  duration: "3 min"
  completed: 2026-04-17
requirements: [LOVE-11]
---

# Phase 36 Plan 02 : Routing notification tap love notes Summary

Branche le routing depuis notification tap dans `app/_layout.tsx` — warm start via `addNotificationResponseReceivedListener` ET cold start via `getLastNotificationResponseAsync`. Lit `data.route` posé par `scheduleLoveNoteReveal` (Plan 01) → `router.push(route)`. Complète LOVE-11 côté navigation : la notif arrive (schedule par 36-01) et le tap ouvre maintenant la boîte aux lettres.

## Scope

1 fichier modifié (`app/_layout.tsx`) — minimaliste, pas de nouveau provider, pas de duplication de useEffect. Imports `Notifications` et `router` déjà présents ligne 22 et 28.

## Tasks Executed

| # | Task | Commit |
|---|------|--------|
| 1 | Étendre useEffect RootLayout : warm listener + cold start handler | 5b72588 |

## Files

### Modified
- `app/_layout.tsx` — useEffect ligne 130 étendu de 5 lignes à 30 lignes : ajout `getLastNotificationResponseAsync().then(...)` (cold), `addNotificationResponseReceivedListener(...)` (warm), `return () => sub.remove()` (cleanup). `configureNotifications()` et `loadSavedLanguage()` préservés en place.

## Decisions Made

1. **useEffect étendu, pas dupliqué** — Un seul useEffect dans RootLayout pour rester cohérent avec le pattern existant et éviter l'ordering ambigu entre `configureNotifications()` et le listener.
2. **setTimeout(..., 0) sur cold start** — `getLastNotificationResponseAsync` peut résoudre AVANT que le Stack expo-router ne soit monté (cold start race, Pitfall 7 RESEARCH). Déférer `router.push` au prochain tick garantit que la nav est ready.
3. **router.push(route as any)** — La route vient de `data.route` (string dynamique), typage expo-router Href strict ne l'accepte pas. Cast pragmatique aligné avec le pattern documenté Plan 01.
4. **catch silencieux** — `getLastNotificationResponseAsync` qui échoue ne doit pas bloquer le boot de l'app. Idempotent, pas de warn.

## Deviations from Plan

None — plan exécuté exactement comme écrit. Imports `Notifications` et `router` déjà présents (vérifié par grep avant modification), pas d'ajout redondant.

## Verification

- [x] `app/_layout.tsx` importe `* as Notifications from 'expo-notifications'` (déjà présent L28)
- [x] `router` importé depuis `expo-router` (déjà présent L22)
- [x] useEffect existant étendu (pas dupliqué) avec :
  - `getLastNotificationResponseAsync()` pour cold start
  - `addNotificationResponseReceivedListener` pour warm start
  - cleanup `return () => sub.remove()`
- [x] `data.route` lu et passé à `router.push(route as any)` dans les deux cas
- [x] `configureNotifications()` toujours appelé en premier
- [x] Hiérarchie providers inchangée
- [x] `setTimeout(..., 0)` appliqué sur le cold start (Pitfall 7)
- [x] `npx tsc --noEmit` clean sur `_layout.tsx`
- [x] `grep "addNotificationResponseReceivedListener" app/_layout.tsx` → 1 match
- [x] `grep "getLastNotificationResponseAsync" app/_layout.tsx` → 1 match
- [x] `grep "sub.remove" app/_layout.tsx` → 1 match

## Known Stubs

None. Branchement routing pur, pas de UI, pas de hardcoded data flowing to render.

## Note sur la validation cold start

Le cold start (app tuée puis notif tappée) nécessite un test device réel — non vérifiable en static TypeScript. Laissé à la validation manuelle Phase 37 polish. Le code suit néanmoins le pattern documenté `getLastNotificationResponseAsync + setTimeout(..., 0)` (Pattern 4 RESEARCH, Pitfall 7).

## Self-Check: PASSED

Files existence verified :
- FOUND: app/_layout.tsx (modifié — 25 insertions, 1 deletion)

Commits existence verified :
- FOUND: 5b72588 (Task 1)
