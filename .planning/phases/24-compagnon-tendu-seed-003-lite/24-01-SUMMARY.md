---
phase: 24-compagnon-tendu-seed-003-lite
plan: "01"
subsystem: companion
tags: [companion, securestore, persistence, anti-repetition]
dependency_graph:
  requires: []
  provides: [companion-storage-io, companion-messages-persistence]
  affects: [app/(tabs)/tree.tsx, lib/mascot/companion-engine.ts]
tech_stack:
  added: []
  patterns: [SecureStore fire-and-forget, hydration-on-mount guard]
key_files:
  created:
    - lib/mascot/companion-storage.ts
  modified:
    - lib/mascot/companion-engine.ts
    - app/(tabs)/tree.tsx
decisions:
  - "D-08 respected: celebration commentée dans detectProactiveEvent (pas supprimée — réactivable)"
  - "D-02 respected: slice(-5) dans saveCompanionMessages pour garder les 5 derniers messages"
  - "D-01/D-03: fire-and-forget avec timestamp ISO — non-bloquant sur le thread UI"
  - "Pitfall 6: guard companionRecentMessagesRef.current.length > 0 empêche l'écrasement de session"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  files_modified: 3
requirements_satisfied: [COMPANION-03, COMPANION-06]
---

# Phase 24 Plan 01: Persistance messages compagnon (SecureStore) Summary

**One-liner:** Persistance SecureStore des messages compagnon via nouveau module `companion-storage.ts` avec hydratation au mount pour alimenter l'anti-répétition IA entre sessions.

## What Was Built

### lib/mascot/companion-storage.ts (nouveau)
Module pur SecureStore (zéro import vault/hook), pattern identique à `caps.ts` :
- `PersistedCompanionMessage` : interface `{ text, event, timestamp }`
- `loadCompanionMessages(profileId)` : charge depuis clé `companion_messages_{profileId}`
- `saveCompanionMessages(profileId, messages)` : persiste en limitant à 5 messages (D-02), silencieux en cas d'erreur

### lib/mascot/companion-engine.ts (modifié)
Celebration commentée dans `detectProactiveEvent()` :
```typescript
// D-08: celebration désactivée Phase 24 — réactiver dans un futur milestone
// if (ctx.streak > 0 && ctx.streak % 7 === 0) return 'celebration';
```

### app/(tabs)/tree.tsx (modifié)
- Import de `loadCompanionMessages`, `saveCompanionMessages`, `PersistedCompanionMessage`
- `saveToMemory` étendu avec paramètre `event: CompanionEvent = 'greeting'` + persistance fire-and-forget (D-01, D-03)
- `showCompanionMsg` étendu avec 4ème paramètre `event: CompanionEvent = 'greeting'` threadé vers `saveToMemory`
- Tous les call sites mis à jour pour passer l'event correct
- `useEffect` d'hydratation sur `[activeProfile?.id]` avec guard `companionRecentMessagesRef.current.length > 0` (Pitfall 6)

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Créer companion-storage.ts + commenter celebration | 40137e0 | lib/mascot/companion-storage.ts, lib/mascot/companion-engine.ts |
| 2 | Câbler persistance SecureStore dans tree.tsx | f6107cd | app/(tabs)/tree.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. Toutes les fonctions sont câblées avec de vraies données SecureStore.

## Self-Check: PASSED

- `lib/mascot/companion-storage.ts` : FOUND
- commit 40137e0 : FOUND
- commit f6107cd : FOUND
- `npx tsc --noEmit` : zéro erreur nouvelle
