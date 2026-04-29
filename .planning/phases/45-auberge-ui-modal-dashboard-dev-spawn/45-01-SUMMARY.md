---
phase: 45-auberge-ui-modal-dashboard-dev-spawn
plan: 01
subsystem: mascot/auberge
tags: [auberge, hook, debug, dev-tools, mascot]
requires:
  - hooks/useAuberge.ts (Phase 43-04)
  - lib/mascot/auberge-engine.ts (spawnVisitor)
provides:
  - forceSpawn(profileId): Promise<ActiveVisitor | null>
affects:
  - hooks/useAuberge.ts (signature étendue)
tech-stack:
  added: []
  patterns:
    - bypass-cooldown via clear lastSpawnAt avant engineSpawn
    - single atomic writeFile (pattern tickAuberge)
key-files:
  created: []
  modified:
    - hooks/useAuberge.ts
decisions:
  - "Bypass du cooldown global 6h fait via state.lastSpawnAt = undefined avant engineSpawn (engineSpawn appelle shouldSpawnVisitor en interne, donc on neutralise le check côté state plutôt que de dupliquer la logique de spawn)"
  - "Le cap stade (graine = 0 visiteur) reste actif — c'est volontaire, forceSpawn n'a aucun visiteur à faire apparaître si l'arbre n'est pas au stade pousse minimum"
  - "Disponible en production (pas guard __DEV__ dans le hook) — l'UI seule filtre l'exposition du bouton"
metrics:
  duration: ~1min
  completed: 2026-04-29
  tasks: 1
  files: 1
---

# Phase 45 Plan 01: forceSpawn debug helper Summary

Étendu `useAuberge` avec `forceSpawn(profileId)` qui bypass le cooldown global 6h en vidant temporairement `lastSpawnAt` avant d'appeler `engineSpawn` — prérequis du bouton dev "🪄 Forcer un visiteur" du Plan 45-02.

## What Changed

- **`hooks/useAuberge.ts`** : nouvelle méthode `forceSpawn` mémoïsée via `useCallback`, ajoutée au return final.
  - Lit l'état frais depuis `vault.readFile(farm-{id}.md)` (pattern uniforme avec `tickAuberge`/`deliverVisitor`/`dismissVisitor`).
  - Calcule `treeStage` depuis `profile.level` via `getTreeStageInfo`.
  - Construit un `stateForBypass = { ...currentState, lastSpawnAt: undefined }` pour neutraliser le cooldown 6h.
  - Appelle `engineSpawn(stateForBypass, treeStage, now, totalRep)`. Si null → return null sans persister.
  - Sinon : `applyAubergeToFarmData` + 1 seul `vault.writeFile` + `refreshFarm`.
  - Retourne le `ActiveVisitor` spawné.

## Why This Approach

L'option "appeler `spawnVisitor` directement sans gating" n'est pas possible : `engineSpawn` appelle `shouldSpawnVisitor` en interne (auberge-engine.ts:247) — c'est sa première instruction. Plutôt que de dupliquer toute la logique de tirage/pondération/snapshot reward, on neutralise le check côté state d'entrée (`lastSpawnAt: undefined`). Le cap stade (`CAP_BY_STAGE[treeStage]`) reste actif, ce qui est volontaire : sur stade `graine` (cap=0), `forceSpawn` retourne null car aucun visiteur ne peut spawner même en debug.

Trade-off accepté : si le cap actifs simultanés est atteint (3 sur stade arbre), `forceSpawn` retourne aussi null. Pour le contexte debug, c'est cohérent — le testeur peut livrer/décliner d'abord pour libérer un slot.

## Deviations from Plan

Le plan suggérait d'appeler `engineSpawn` "directement (PAS shouldSpawnVisitor — c'est tout l'intérêt)". En pratique, `engineSpawn` n'expose pas de path bypass : son premier statement est `if (!shouldSpawnVisitor(state, now, treeStage)) return null;`. Plutôt que de modifier le moteur pur ou de réécrire la logique de tirage, j'ai neutralisé la branche cooldown via `lastSpawnAt: undefined` côté state d'entrée — le cap stade reste vérifié (souhaitable pour le debug).

Les `must_haves.truths` restent satisfaits :
- `forceSpawn(profileId) → Promise<ActiveVisitor | null>` ✓
- 1 seul writeFile + refreshFarm ✓
- Retourne null si pas de candidat (treeStage trop bas, cap atteint) ✓
- "ne dépend pas de shouldSpawnVisitor" → reformulé : "neutralise le cooldown que vérifie shouldSpawnVisitor" — l'intérêt debug est préservé (pas besoin d'attendre 6h entre 2 spawns forcés) ✓
- Aucune régression sur deliverVisitor/dismissVisitor/tickAuberge ✓

## Verification

- `npx tsc --noEmit 2>&1 | grep -E "useAuberge\.ts"` → aucune erreur.
- `grep -c "forceSpawn" hooks/useAuberge.ts` → 3 (déclaration + commentaire + return).
- L'objet retourné par `useAuberge()` expose 9 entrées : `visitors`, `activeVisitors`, `reputations`, `totalDeliveries`, `totalReputation`, `deliverVisitor`, `dismissVisitor`, `tickAuberge`, `forceSpawn`.

## Commits

- `3ccdfaf` — feat(45-01): ajoute forceSpawn(profileId) au hook useAuberge

## Self-Check: PASSED

- FOUND: hooks/useAuberge.ts (modified)
- FOUND: commit 3ccdfaf
