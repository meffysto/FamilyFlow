---
phase: 46-auberge-spawn-automatique-notifications-locales
plan: 02
subsystem: auberge
tags: [auberge, wiring, hooks, useVault]
requires:
  - lib/auberge/auto-tick.ts::tickAubergeAuto (Plan 46-01)
  - hooks/useVaultTasks.ts::subscribeTaskComplete
provides:
  - hooks/useVault.ts wiring tickAubergeAuto post-refresh
  - hooks/useVault.ts wiring tickAubergeAuto sur task complete
affects:
  - Plan 46-03 (cancel notifs dans deliverVisitor / dismissVisitor)
  - Plan 46-04 (re-gating __DEV__ bouton dev)
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget catch silencieux pour ne jamais bloquer le refresh ni la complétion"
    - "Refs live (activeProfileIdForWidgetRef + profilesRefForAuberge) pour éviter re-souscriptions"
key-files:
  created: []
  modified:
    - hooks/useVault.ts
decisions:
  - "Utilise activeProfileIdForWidgetRef.current (ref live) plutôt qu'activeProfile?.id (closure stale)"
  - "Nouvelle ref profilesRefForAuberge pour passer la liste profils à jour au listener task complete sans re-souscrire"
  - "Effect dépend uniquement de tasksHook (subscribeTaskComplete est mémoïsée par useVaultTasks via useCallback) — pas de re-souscription à chaque change profil"
metrics:
  duration: 10min
  completed: 2026-04-29
  tasks: 2
---

# Phase 46 Plan 02 : Wiring tickAubergeAuto dans useVault Summary

Wiring strictement additif de `tickAubergeAuto` à deux moments clés du cycle de vie : après chaque refresh complet du vault, et sur chaque tâche complétée — fire-and-forget, sans modification du reste de useVault.

## What Was Built

### 1. Import en tête de `hooks/useVault.ts`
```ts
import { tickAubergeAuto } from '../lib/auberge/auto-tick';
```

### 2. Appel post-refresh dans `loadVaultData` (après `setupAllNotifications`)
```ts
const aubergeActiveId = activeProfileIdForWidgetRef.current;
if (aubergeActiveId && profilesSnapshot.length > 0) {
  tickAubergeAuto(aubergeActiveId, { vault, profiles: profilesSnapshot }).catch(() => {});
}
```
- Utilise `activeProfileIdForWidgetRef.current` (ref live mise à jour ailleurs) plutôt que la closure potentiellement stale.
- Utilise `profilesSnapshot` (déjà construit pour saveCache) — données fraîches et à jour.
- Catch silencieux : ne bloque jamais le refresh.

### 3. useEffect souscription `subscribeTaskComplete`
Ajouté après les refs widget (ligne ~798) :
```ts
const profilesRefForAuberge = useRef(profiles);
profilesRefForAuberge.current = profiles;
useEffect(() => {
  const unsub = tasksHook.subscribeTaskComplete(() => {
    const activeId = activeProfileIdForWidgetRef.current;
    const vault = vaultRef.current;
    if (!activeId || !vault) return;
    tickAubergeAuto(activeId, { vault, profiles: profilesRefForAuberge.current }).catch(() => {});
  });
  return unsub;
}, [tasksHook]);
```
- `subscribeTaskComplete` est mémoïsée par `useVaultTasks` (useCallback) — pas de re-souscription à chaque rerender.
- Refs live évitent un effet sensible aux changements profils.
- Fire-and-forget : la complétion de tâche reste instantanée.

## Deviations from Plan

**[Decision] Utilisation de refs live plutôt que de closure variables**
- **Found during:** Task 2 implementation
- **Issue:** Le plan suggérait `[tasksHook.subscribeTaskComplete, activeProfile?.id, vault, profiles]` comme deps. Mais ça déclencherait une re-souscription à chaque change profil — risque de listener fantôme si l'unsub ne run pas exactement entre le change et le re-mount.
- **Fix:** Utiliser les refs déjà existantes (`activeProfileIdForWidgetRef`) + nouvelle ref locale (`profilesRefForAuberge`) pour lire les valeurs à jour au moment du callback, sans re-souscrire. Pattern cohérent avec le code existant (cf. `gamiDataForWidgetRef`).
- **Files modified:** hooks/useVault.ts
- **Commit:** 24b0d94

## Verification

- `npx tsc --noEmit` : 0 erreur (baseline pré-existantes inchangées).
- `grep -c "tickAubergeAuto" hooks/useVault.ts` : **3** (1 import + 2 call sites) ✓
- Aucun autre fichier modifié hors `hooks/useVault.ts` ✓
- Pas de bump CACHE_VERSION ✓
- Pas de modification de `setupAllNotifications`, du bloc défi spawn, ni de la logique tasks/refresh ✓

## Commits

- `e19db43` — feat(46-02): tickAubergeAuto post-refresh dans useVault
- `24b0d94` — feat(46-02): souscription subscribeTaskComplete pour tick Auberge

## Next

- **Plan 46-03** (parallèle wave 2) : Cancel notifs dans `deliverVisitor` / `dismissVisitor` côté `hooks/useAuberge.ts`.
- **Plan 46-04** : Re-gating `__DEV__` du bouton dev dans `AubergeSheet.tsx`.

## Self-Check

- [x] hooks/useVault.ts modifié (import + 2 call sites)
- [x] Commits e19db43 et 24b0d94 existent sur main
- [x] tsc clean (0 erreur)
- [x] Pas de modif d'autres fichiers
- [x] Pattern fire-and-forget appliqué partout

## Self-Check: PASSED
