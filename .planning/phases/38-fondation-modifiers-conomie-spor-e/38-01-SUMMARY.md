---
phase: 38-fondation-modifiers-conomie-spor-e
plan: 01
subsystem: mascot/farm-engine
tags: [modifiers, sporee, farm, cache, serialization]
requires: []
provides:
  - PlantedCrop.modifiers (optional, extensible)
  - WagerModifier type (sporeeId, duration, multiplier, appliedAt, sealerProfileId, cumulTarget?, cumulCurrent?)
  - FarmCropModifiers type (wager?, graftedWith?)
  - WagerDuration / WagerMultiplier types
  - encodeModifiers / decodeModifiers (pipe-escape JSON)
  - CACHE_VERSION = 4 (vault-cache-v4.json)
affects: []
tech-added: []
patterns: [pipe-escape-json-csv, backward-compat-positional-split]
key-files:
  created: []
  modified:
    - lib/mascot/types.ts
    - lib/mascot/farm-engine.ts
    - lib/vault-cache.ts
    - lib/__tests__/farm-engine.test.ts
decisions:
  - "Stratégie pipe-escape JSON (, → |, : → §) vs base64/ligne séparée — lisibilité Obsidian préservée"
  - "serializeCrops 7e champ conditionnel — JAMAIS de trailing `:` pour plants legacy"
  - "parseCrops : modifiers ajouté à l'objet uniquement si défini (pas `modifiers: undefined` qui pollue deep-equal)"
metrics:
  duration: "~2min"
  completed: 2026-04-18
  tasks: 3
  files: 4
---

# Phase 38 Plan 01: Fondation modifiers + CACHE bump Summary

Fondation data pure pour v1.7 Sporée : extension `PlantedCrop` avec champ `modifiers` extensible (WagerModifier + graftedWith), sérialisation CSV backward-compatible via pipe-escape JSON (`,` → `|`, `:` → `§`), CACHE_VERSION 3→4.

## What Was Built

### Tâche 1 — PlantedCrop.modifiers + encode/decode (TDD)

**Types ajoutés** dans `lib/mascot/types.ts` (avant `PlantedCrop`) :
- `WagerDuration = 'chill' | 'engage' | 'sprint'`
- `WagerMultiplier = 1.3 | 1.7 | 2.5`
- `WagerModifier` (sporeeId, duration, multiplier, appliedAt, sealerProfileId, cumulTarget?, cumulCurrent?)
- `FarmCropModifiers` (wager?, graftedWith?)
- `PlantedCrop.modifiers?: FarmCropModifiers` ajouté en fin de shape

**Helpers purs** exportés depuis `lib/mascot/farm-engine.ts` :
- `encodeModifiers` ligne **228** — JSON.stringify puis escape `,` → `|` et `:` → `§`, retourne `''` si undefined/vide
- `decodeModifiers` ligne **233** — fallback défensif sur JSON invalide → `undefined`

**serializeCrops / parseCrops** adaptés :
- serializeCrops : 7e fragment conditionnel — `modStr ? \`${base}:${modStr}\` : base` (jamais trailing `:` pour legacy)
- parseCrops : `parts.length >= 7` check, `modifiers` ajouté à l'objet uniquement si défini

### Tâche 2 — CACHE_VERSION bump 3→4

`lib/vault-cache.ts` ligne 46-47 :
```ts
// v4 : Phase 38 — shape PlantedCrop.modifiers + sporeeCount frontmatter farm
const CACHE_VERSION = 4;
const CACHE_FILE_URI = FileSystem.documentDirectory + 'vault-cache-v4.json';
```
Zéro autre modification (domaines farm/mascot déjà exclus du cache).

### Tâche 3 — Suite Jest round-trip (9 nouveaux tests)

Nouveau `describe('serializeCrops / parseCrops with modifiers (Phase 38 MOD-01)')` avec 9 `it()` couvrant :
1. Round-trip plant legacy sans modifier (6 champs, pas de trailing `:`)
2. Round-trip plant avec wager complet deep-equal
3. Parse CSV legacy 6 champs → modifiers undefined
4. Parse 7e fragment vide string → modifiers undefined
5. Round-trip sporeeId avec tirets uuid-style (`sp-emma-d4e5-f678`)
6. Mix plants legacy + plants avec wager dans un même CSV
7. `encodeModifiers({})` retourne `''`
8. `decodeModifiers` défensif sur input invalide
9. JSON modifiers n'inclut JAMAIS `,` ni `:` bruts (escape pipe/§)

**Résultat `npx jest --no-coverage lib/__tests__/farm-engine.test.ts`** : **31 passed, 0 failed**.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pipe-escape JSON (`,`/`:` → `\|`/`§`) | Lisible Obsidian à l'œil + zéro conflit séparateurs CSV | Retenu |
| 7e fragment conditionnel (jamais trailing `:`) | Vaults legacy pré-v1.7 restent identiques après serialize → minimize diff iCloud | Retenu |
| `modifiers` ajouté à l'objet uniquement si défini | Évite `modifiers: undefined` qui pollue `toEqual` | Retenu |
| Base64 rejeté | Perte totale de lisibilité Obsidian | Rejeté |

## Deviations from Plan

None — plan exécuté exactement comme écrit. TDD RED → GREEN → verify → commit sans déviation.

## Commits

- `6c0ade4` test(38-01): ajouter tests round-trip modifiers + backward-compat (RED)
- `93d5e65` feat(38-01): étendre PlantedCrop avec modifiers + pipe-escape JSON (GREEN)
- `5f4e1b2` chore(38-01): bump CACHE_VERSION 3→4 pour shape PlantedCrop.modifiers

## Verification

- [x] `npx tsc --noEmit` clean (hors pré-existants MemoryEditor/cooklang/useVault)
- [x] `npx jest --no-coverage lib/__tests__/farm-engine.test.ts` → **31/31 passed**
- [x] `grep "modifiers?: FarmCropModifiers" lib/mascot/types.ts` → 1 match (shape PlantedCrop)
- [x] `grep "export function encodeModifiers" lib/mascot/farm-engine.ts` → 1 match (ligne 228)
- [x] `grep "export function decodeModifiers" lib/mascot/farm-engine.ts` → 1 match (ligne 233)
- [x] `grep "CACHE_VERSION = 4" lib/vault-cache.ts` → 1 match
- [x] `grep "vault-cache-v4.json" lib/vault-cache.ts` → 1 match
- [x] `grep "CACHE_VERSION = 3\|vault-cache-v3.json" lib/vault-cache.ts` → 0

## Next Steps

Phase 38-02 : Moteur pur économie Sporée (drops, shop, expedition, cadeau, cap inventaire) consommant la shape livrée ici. Phase 38-03 : câblage hooks. Plans 38-02 et 38-03 doivent vérifier que `PlantedCrop.modifiers?.wager` est bien consommé sans rupture.

## Self-Check: PASSED

- Files modified verified: types.ts, farm-engine.ts, vault-cache.ts, farm-engine.test.ts
- Commits verified: 6c0ade4 (test), 93d5e65 (feat), 5f4e1b2 (chore)
- 31/31 tests passing
