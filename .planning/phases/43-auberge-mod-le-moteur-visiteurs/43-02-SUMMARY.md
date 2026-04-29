---
phase: 43-auberge-mod-le-moteur-visiteurs
plan: 02
subsystem: persistance-vault-auberge
tags: [auberge, parser, vault, persistance, phase-43]
dependency_graph:
  requires: []
  provides:
    - "FarmProfileData étendu (4 champs Auberge)"
    - "parseFarmProfile + serializeFarmProfile branchés sur auberge_*"
    - "Suite Jest round-trip + backward compat"
  affects:
    - "Plan 43-03 (auberge-engine.ts) consommera ces 4 champs comme canal de persistance"
    - "Plan 43-04 (useAuberge hook) écrira via writeProfileFields"
tech_stack:
  added: []
  patterns:
    - "Sérialisation conditionnelle (skip si 0/vide) — pattern miroir sporeeCount/wagerMarathonWins"
    - "Chaînes CSV opaques au parser — encodage interne géré par le moteur (Plan 03)"
key_files:
  created:
    - "lib/__tests__/parser-auberge.test.ts (103 lignes, 12 tests)"
  modified:
    - "lib/types.ts (+5 lignes : 4 champs FarmProfileData)"
    - "lib/parser.ts (+20 lignes : lecture + écriture conditionnelle)"
decisions:
  - "Phase 43-02: 4 champs auberge_* = chaînes opaques pour le parser, encodage CSV/JSON géré par auberge-engine.ts (Plan 03) — pattern miroir farm_crops/farm_buildings"
  - "Phase 43-02: CACHE_VERSION INCHANGÉ (=9) — ferme exclue du cache (vault-cache.ts:53)"
  - "Phase 43-02: auberge_total_deliveries sérialisé uniquement si >0 (anti-bruit)"
metrics:
  duration: "~2 min"
  tasks_completed: 2
  files_modified: 3
  tests_added: 12
  completed_date: "2026-04-29"
---

# Phase 43 Plan 02 : Persistance vault Auberge — Summary

Extension de `FarmProfileData` avec 4 champs optionnels pour persister l'état Auberge dans `farm-{profileId}.md`, parser/serializer branchés en sérialisation conditionnelle, suite Jest 12 tests vérifiant round-trip lossless et backward compat. Aucune logique métier — chaînes opaques pour le moteur (Plan 03).

## Tasks Completed

| Task | Name                                                       | Commit  | Files                                                        |
| ---- | ---------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| 1    | Étendre FarmProfileData + parseFarmProfile + serialize     | c8ada8b | lib/types.ts, lib/parser.ts                                  |
| 2    | Suite Jest parser-auberge — round-trip + backward compat   | 1ad32b8 | lib/__tests__/parser-auberge.test.ts                         |

## Champs ajoutés à FarmProfileData

```typescript
// Phase 43 — Auberge (chaînes opaques, encodage interne géré par auberge-engine.ts)
auberge_visitors?: string;               // CSV opaque des visiteurs actifs/livrés non archivés
auberge_reputations?: string;            // CSV opaque des réputations par PNJ
auberge_last_spawn?: string;             // ISO datetime — dernier spawn (cooldown global 6h)
auberge_total_deliveries?: number;       // compteur lifetime (incrémenté à chaque deliver)
```

## Confirmations clés

- **CACHE_VERSION non bumpé** : reste à `9` (vault-cache.ts:53). Ferme volontairement exclue du cache, pas de régression.
- **Sérialisation conditionnelle** : `auberge_total_deliveries` n'est écrit que si `> 0`, les chaînes que si non-vides (pattern Phase 38/41).
- **Backward compat** : profil legacy sans champs auberge_* parse à `undefined / undefined / undefined / undefined`, jamais `null` ni `''`.
- **ISO datetime avec `:`** : `auberge_last_spawn` round-trippe correctement car `parseFarmProfile` utilise `indexOf(': ')` (slice après le 1er ': '), tout le reste de la ligne est conservé. Test dédié.

## Tests Jest passants (12/12)

```
Phase 43 — Persistance Auberge dans farm-{id}.md
  Backward compat
    ✓ parse un profil legacy sans champs auberge_* sans erreur
  Lecture individuelle
    ✓ parse auberge_visitors (chaîne opaque)
    ✓ parse auberge_reputations
    ✓ parse auberge_last_spawn (ISO datetime avec ":")
    ✓ parse auberge_total_deliveries: 7
  Round-trip
    ✓ round-trip lossless des 4 champs auberge_*
  Sérialisation conditionnelle
    ✓ skip auberge_total_deliveries si === 0
    ✓ skip auberge_total_deliveries si undefined
    ✓ skip auberge_visitors si chaîne vide
    ✓ skip auberge_reputations si chaîne vide
    ✓ skip auberge_last_spawn si undefined
    ✓ écrit auberge_total_deliveries si > 0
```

## Deviations from Plan

None — plan exécuté tel quel. Une seule note d'adaptation **non-bloquante** : le plan référençait `frontmatter.X` (objet gray-matter), or `parseFarmProfile` utilise un format `key: value` ligne à ligne (pas YAML frontmatter). Le pattern réel a été suivi (`props['auberge_X']`), cohérent avec les blocs sporée/wager existants.

## Verification

- `npx tsc --noEmit` — aucune nouvelle erreur introduite (erreurs pré-existantes MemoryEditor.tsx/cooklang.ts/useVault.ts ignorées par CLAUDE.md).
- `npx jest lib/__tests__/parser-auberge.test.ts --no-coverage` — 12/12 passants.
- `lib/vault-cache.ts:53` — `CACHE_VERSION = 9` confirmé inchangé.

## Self-Check: PASSED

- `lib/types.ts` modifié : FOUND (4 champs auberge_*)
- `lib/parser.ts` modifié : FOUND (read + write conditionnel)
- `lib/__tests__/parser-auberge.test.ts` créé : FOUND (12 tests)
- Commit `c8ada8b` : FOUND
- Commit `1ad32b8` : FOUND
- `CACHE_VERSION = 9` (inchangé) : FOUND
