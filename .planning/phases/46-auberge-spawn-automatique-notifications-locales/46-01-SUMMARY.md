---
phase: 46-auberge-spawn-automatique-notifications-locales
plan: 01
subsystem: auberge
tags: [auberge, notifications, helper, jest]
requires:
  - lib/mascot/auberge-engine.ts (spawnVisitor, expireVisitors, parseAuberge, serializeAuberge)
  - lib/mascot/visitor-catalog.ts (VISITOR_CATALOG)
  - lib/mascot/engine.ts (getTreeStageInfo)
  - lib/parser.ts (parseFarmProfile, serializeFarmProfile)
provides:
  - lib/auberge/auto-tick.ts::tickAubergeAuto
  - lib/scheduled-notifications.ts::scheduleAubergeVisitorArrival
  - lib/scheduled-notifications.ts::scheduleAubergeVisitorReminder
  - lib/scheduled-notifications.ts::cancelAubergeVisitorNotifs
  - lib/notifications.ts::BUILTIN_NOTIFICATIONS[auberge_visitor_reminder]
  - lib/types.ts::NotifEvent::auberge_visitor_reminder
affects:
  - Plan 46-02 (wiring useVault.ts + cancel notifs sur deliver/dismiss)
  - Plan 46-03 (cancel notifs dans actions Auberge)
tech-stack:
  added: []
  patterns:
    - "Helper pur testable Jest (sans React) — orchestrateur engine + persistance + notifs"
    - "Identifier scheme: auberge-visitor-arrival-{instanceId} / auberge-visitor-reminder-{instanceId}"
    - "Permission silencieuse : skip si requestNotificationPermissions() false"
key-files:
  created:
    - lib/auberge/auto-tick.ts
    - lib/__tests__/auberge-auto-tick.test.ts
  modified:
    - lib/types.ts
    - lib/notifications.ts
    - lib/scheduled-notifications.ts
decisions:
  - "humanizeVisitorId helper local : fallback i18n absent → 'hugo_boulanger' devient 'Hugo boulanger' (Plan 47 polish)"
  - "Notif locale ne consulte pas le toggle BUILTIN ; le toggle est lu uniquement par dispatchNotification Telegram (Plan 46-02 décidera s'il faut gater la notif locale)"
  - "Identifiers explicites (pas startsWith) dans cancelAubergeVisitorNotifs pour éviter collisions futures"
metrics:
  duration: 25min
  completed: 2026-04-29
  tasks: 2
  tests_added: 7
---

# Phase 46 Plan 01 : Helper auto-tick Auberge + notifs locales Summary

Helper pur `tickAubergeAuto(profileId, deps)` orchestrant expire + spawn + persistance farm + scheduling notifs locales arrival/reminder, avec 3 fonctions de scheduling/cancel exportées depuis `scheduled-notifications.ts` et toggle BUILTIN_NOTIFICATIONS pour visibilité dans NotificationSettings.

## What Was Built

### 1. `lib/types.ts` — NotifEvent étendu
Ajout `'auberge_visitor_reminder'` à l'union `NotifEvent`.

### 2. `lib/notifications.ts` — BUILTIN entry
Constante `DEFAULT_AUBERGE_VISITOR_REMINDER_TEMPLATE` + entrée dans `BUILTIN_NOTIFICATIONS` (id `auberge_visitor_reminder`, label `Visiteurs auberge`, emoji `🛖`, enabled `true` par défaut).

### 3. `lib/scheduled-notifications.ts` — 3 fonctions
- `scheduleAubergeVisitorArrival(instanceId, name, emoji, deadlineHours)` : trigger `null` (immédiat). Cancel précédente avant schedule (idempotent). Skip silencieux si permission refusée.
- `scheduleAubergeVisitorReminder(instanceId, name, emoji, deadlineAt)` : trigger DATE = `deadlineAt - 4h`. Skip silencieux si reminderDate ≤ now.
- `cancelAubergeVisitorNotifs(instanceId)` : itère `getAllScheduledNotificationsAsync` et cancel les identifiers exacts `auberge-visitor-arrival-{instanceId}` ET `auberge-visitor-reminder-{instanceId}`. Idempotent (no-throw).

### 4. `lib/auberge/auto-tick.ts` — Helper orchestrateur
`tickAubergeAuto(profileId, { vault, profiles })` :
1. No-op silencieux si vault absent ou profil introuvable.
2. Lit `farm-{profileId}.md` (catch error → contenu vide).
3. `parseAuberge` → `expireVisitors(now)` → cancel notifs des expirés.
4. `getTreeStageInfo(profile.level).stage` → `spawnVisitor(...)`.
5. Si spawn : `scheduleAubergeVisitorArrival` + `scheduleAubergeVisitorReminder`.
6. `serializeAuberge` → `serializeFarmProfile` → **1 seul `vault.writeFile`**.
7. Try/catch global silencieux (`if (__DEV__) console.warn(...)`).

### 5. `lib/__tests__/auberge-auto-tick.test.ts` — 7 tests Jest
Mock `expo-notifications` inline (jest.mock factory). Tests :
- Profil introuvable → no-op
- vault.readFile throw → no-op silencieux
- State vide + level=5 → spawn + arrival notif scheduled
- Visiteur deadline passée → cancel ses 2 notifs
- 1 seul writeFile par appel
- Idempotence (cooldown 6h) : 2e appel sans nouveau spawn
- level=1 (graine, cap=0) → aucun spawn

## Deviations from Plan

**[Rule 1 - Bug] Spec impossible : `cancelByCategory('auberge-visitor-' + instanceId)` ne match pas `auberge-visitor-arrival-{id}`**
- **Found during:** Task 1 implementation
- **Issue:** L'objectif documenté dans 46-CONTEXT.md utilisait un préfixe `auberge-visitor-{id}` pour cancel les deux types de notifs, mais les identifiers sont `auberge-visitor-arrival-{id}` et `auberge-visitor-reminder-{id}` — `startsWith('auberge-visitor-' + id)` ne match aucun.
- **Fix:** `cancelAubergeVisitorNotifs` utilise une comparaison **exacte** des deux identifiers (pas un préfixe), via `getAllScheduledNotificationsAsync` puis filter `notif.identifier === ...`.
- **Files modified:** lib/scheduled-notifications.ts
- **Commit:** aacab89

**[Rule 4 - Microcopy] `visitorName` non disponible via `def.name`**
- **Found during:** Task 2 implementation
- **Issue:** Les `<critical_constraints>` mentionnent `def.name` dans VISITOR_CATALOG, mais le shape réel a `labelKey` (i18n key) et `descriptionKey`, pas de `name` en dur. L'i18n n'est pas branchée Phase 46 (deferred Phase 47 polish).
- **Fix:** Helper `humanizeVisitorId(id)` local : `'hugo_boulanger'` → `'Hugo boulanger'`. Pattern simple, lisible, désormais stable jusqu'à Phase 47.
- **Files modified:** lib/auberge/auto-tick.ts

**[Decision] Toggle BUILTIN non consulté par notif locale**
- Le plan recommandait de consulter `loadBuiltinPref('auberge_visitor_reminder')` avant scheduling. Pour ce premier jet (Plan 01), la notif locale ignore ce toggle (cohérent avec Love Notes et défis). Le toggle servira uniquement quand `dispatchNotification` Telegram sera branchée. Plan 46-02 ou 46-03 pourra décider de gater si nécessaire.

## Verification

- `npx tsc --noEmit` : 0 nouvelle erreur (baseline pré-existantes : MemoryEditor, cooklang, useVault — ignorées).
- `npx jest --no-coverage lib/__tests__/auberge-auto-tick.test.ts` : **7/7 tests PASS**.
- `npx jest --no-coverage lib/__tests__/auberge-engine.test.ts` : **45/45 tests PASS** (non-régression).
- `grep "auberge_visitor_reminder" lib/types.ts lib/notifications.ts` : 4 occurrences ✓
- `grep "scheduleAubergeVisitorArrival\|scheduleAubergeVisitorReminder\|cancelAubergeVisitorNotifs" lib/scheduled-notifications.ts` : 3 exports ✓
- `grep "tickAubergeAuto" lib/auberge/auto-tick.ts` : 1 export ✓

## Commits

- `aacab89` — feat(46-01): notifs Auberge — NotifEvent + BUILTIN + 3 fonctions schedule/cancel
- `f498259` — feat(46-01): helper tickAubergeAuto + tests Jest

## Next

- **Plan 46-02** : Wiring `tickAubergeAuto` dans `useVault.ts` (launch + `subscribeTaskComplete`).
- **Plan 46-03** : Cancel notifs dans `deliverVisitor` / `dismissVisitor` (côté hook).
- **Plan 46-04** : Re-gating `__DEV__` du bouton dev dans `AubergeSheet.tsx`.

## Self-Check

- [x] `lib/auberge/auto-tick.ts` exists
- [x] `lib/__tests__/auberge-auto-tick.test.ts` exists
- [x] Commits `aacab89`, `f498259` exist on main
- [x] tsc clean
- [x] 7/7 + 45/45 jest passing

## Self-Check: PASSED
