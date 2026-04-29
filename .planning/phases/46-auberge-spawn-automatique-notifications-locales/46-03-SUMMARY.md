---
phase: 46-auberge-spawn-automatique-notifications-locales
plan: 03
subsystem: auberge
tags: [auberge, notifications, hook, hygiene]
requires:
  - lib/scheduled-notifications.ts::cancelAubergeVisitorNotifs (Plan 46-01)
provides:
  - hooks/useAuberge.ts::deliverVisitor (cancel notifs après persistance)
  - hooks/useAuberge.ts::dismissVisitor (cancel notifs après persistance)
affects:
  - Hygiène utilisateur : plus de notif fantôme H-4 sur visiteur déjà résolu
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget cancel notifs après persistance vault réussie"
key-files:
  created: []
  modified:
    - hooks/useAuberge.ts
decisions:
  - "Cancel placée APRÈS refreshFarm/refreshGamification (en fin de fonction) — assure que la persistance est durable avant l'effet secondaire notifs"
  - "Pattern fire-and-forget (.catch(() => {})) — la cancel ne bloque ni la livraison ni la refusal"
metrics:
  duration: 5min
  completed: 2026-04-29
  tasks: 1
  tests_added: 0
---

# Phase 46 Plan 03 : Cancel notifs Auberge sur deliver/dismiss Summary

Branchement de `cancelAubergeVisitorNotifs(instanceId)` dans les setters `deliverVisitor` et `dismissVisitor` du hook `useAuberge`, garantissant qu'aucune notif fantôme (arrivée/rappel H-4) n'arrive sur l'iPhone après résolution d'une commande visiteur.

## What Was Built

### `hooks/useAuberge.ts` — 3 modifications minimales

1. **Import** ligne 60 : `import { cancelAubergeVisitorNotifs } from '../lib/scheduled-notifications';`
2. **deliverVisitor** ligne 241 : appel fire-and-forget après `refreshFarm` + `refreshGamification`, juste avant le `return { ok: true, reward }`.
3. **dismissVisitor** ligne 270 : appel fire-and-forget après `refreshFarm`, en fin de fonction.

Aucune autre modification (tickAuberge / forceSpawn / addCoins / applyAubergeToFarmData inchangés — c'est `tickAubergeAuto` côté Plan 46-01/46-02 qui gère l'expire).

## Deviations from Plan

None — plan exécuté exactement comme écrit. Le placement après `refreshFarm/refreshGamification` est cohérent avec les `<critical_constraints>` (après la persistance ferme réussie) et avec la spec du plan (juste avant le `return` final pour deliver, en fin de fonction pour dismiss).

## Verification

- `grep -c "cancelAubergeVisitorNotifs" hooks/useAuberge.ts` : **3** (1 import + 2 calls) ✓
- `npx tsc --noEmit` : **0 nouvelle erreur** ✓
- Les 2 appels passent `instanceId` (le param du callback, garanti string non-null par le contrat de signature).
- Pattern fire-and-forget : `.catch(() => {})` consomme silencieusement les erreurs réseau/permissions (cohérent avec idempotence côté lib).

## Commits

- `b87f20b` — feat(46-03): cancel notifs Auberge sur deliverVisitor + dismissVisitor

## Next

- **Plan 46-04** : Re-gating `__DEV__` du bouton "Forcer un visiteur" dans `AubergeSheet.tsx` (déjà complété d'après l'init context — vérifier).

## Self-Check

- [x] `hooks/useAuberge.ts` modifié (3 occurrences cancelAubergeVisitorNotifs)
- [x] Commit `b87f20b` exists on main
- [x] tsc clean
- [x] Aucun autre fichier modifié

## Self-Check: PASSED
