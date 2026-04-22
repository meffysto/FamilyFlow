---
phase: 42-nourrir-le-compagnon
plan: 02
subsystem: parser-companion-cache
tags: [parser, cache, jest, companion, phase-42]
requirements: [FEED-04, FEED-05]
dependency-graph:
  requires: []
  provides:
    - "parseCompanion/serializeCompanion round-trip avec lastFedAt + feedBuff"
    - "CACHE_VERSION = 7 (shape CompanionData étendue)"
    - "Suite Jest edge cases ISO (14 tests) pour mitiger fragilité CSV positional"
  affects:
    - "lib/parser.ts — parseCompanion v3 + serializeCompanion v3"
    - "lib/vault-cache.ts — bump v6 → v7"
    - "lib/__tests__/companion-parser.test.ts — nouveau fichier"
tech-stack:
  added: []
  patterns:
    - "Scan MUL strict /^\\d+\\.\\d{4}$/ + fallback empty-trailing (robuste au timezone offset ISO)"
    - "toFixed(4) serialization du multiplicateur → round-trip lossless"
    - "Gate parts.length >= 8 pour discriminer v1 4-parts legacy (mood) de v3 Phase 42"
key-files:
  created:
    - "lib/__tests__/companion-parser.test.ts"
  modified:
    - "lib/parser.ts"
    - "lib/vault-cache.ts"
decisions:
  - "Format CSV flat v3 retenu (D-31) — cohérence pattern v1/v2, minimise diff parser"
  - "Scan MUL dynamique (pas slice fixe) — supporte ISO timezone offset +02:00 (3 colons) sans casser ISO Z (2 colons)"
  - "MUL strict /^\\d+\\.\\d{4}$/ évite collision avec trailing '00' numérique de l'offset"
metrics:
  duration: "5min"
  completed: "2026-04-22"
  tests: "14/14 pass"
  files_touched: 3
  commits: 4
---

# Phase 42 Plan 02 : Parser companion + cache bump Summary

Extension round-trip de `parseCompanion`/`serializeCompanion` pour persister `lastFedAt` + `feedBuff` en CSV flat v3, bump `CACHE_VERSION` 6→7, et suite Jest dédiée de 14 tests couvrant edge cases ISO (sans ms, timezone offset, toFixed stable, corruption tolérée).

## Objectif livré

Couvrir D-17 (CACHE_VERSION bump), D-30 (parser étendu), D-31 (format sérialisation — **flat CSV v3** retenu avec mitigation tests edge-case).

## Format CSV final

```
activeSpecies:name:unlocked1|unlocked2:lastFedAtISO:feedBuffMul:feedBuffExpiresAtISO
```

- **v2 sans feed** (3 parts) : `chat:Mimi:chat|chien`
- **v3 lastFedAt seul** (buff null) : `chat:Mimi:chat:2026-04-22T10:00:00.000Z::`
- **v3 full** : `chat:Mimi:chat:2026-04-22T10:00:00.000Z:1.4950:2026-04-22T11:30:00.000Z`

## Rationale format retenu (D-31)

**Retenu : CSV flat v3** — cohérence avec pattern v1/v2 companion (ligne CSV unique inline), `parseActiveExpeditions` utilise déjà le même pattern pour gérer les ISO avec `:`, pas de nouvelle clé YAML dans le frontmatter farm.

**Alternative rejetée : YAML dédié** (`companion_last_fed_at:` / `companion_feed_buff:`) — fragmentation du domaine companion sur 3 clés, nécessite modifs additionnelles dans `parseFarmProfile` pour regrouper, complexifie la sérialisation.

**Mitigation fragilité positional CSV** : suite Jest 14 tests (voir ci-dessous) + correctif scan MUL dynamique (voir Déviations).

## Edge cases couverts (Jest)

| Catégorie | Test | Pitfall couvert |
|-----------|------|-----------------|
| Backward compat | v2 3-parts | Pas de lastFedAt/feedBuff |
| Backward compat | v1 4-parts (mood) | Mood ignoré, pas de Phase 42 |
| Backward compat | v2 minimal 2 parts | unlockedSpecies fallback |
| Backward compat | serialize sans Phase 42 | Format v2 inchangé |
| Round-trip | lastFedAt seul (buff null) | Trailing `::` correct |
| Round-trip | lastFedAt + buff complet | Round-trip lossless |
| Round-trip | unlockedSpecies multi + buff | Séparateur `|` préservé |
| ISO | Sans millisecondes (`2026-04-22T10:00:00Z`) | Parse OK |
| ISO | Timezone offset `+02:00` (3 colons) | **Correctif scan MUL dynamique** |
| Multiplier | 1.05 → `"1.0500"` | toFixed(4) stable |
| Multiplier | 1.495 → `"1.4950"` | Round-trip précis |
| Corruption | Chaînes dégénérées (`:::::`) | Pas de crash |
| Corruption | ISO invalide dans v3 | Ignoré sans crash |

## Confirmation CACHE_VERSION

```typescript
// lib/vault-cache.ts:50-51
const CACHE_VERSION = 7;
const CACHE_FILE_URI = FileSystem.documentDirectory + 'vault-cache-v7.json';
```

Commentaire historique préservé, ligne v7 ajoutée avec rationale FR.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Scan MUL positional échouait sur ISO timezone offset**

- **Found during:** Task 3 (exécution Jest `ISO timezone offset +02:00 round-trip`)
- **Issue:** Le plan proposait `parts.slice(3, 6).join(':')` pour reconstituer lastFedAt (hypothèse ISO = 2 colons, Z-only). Un ISO avec offset `+02:00` contient 3 colons internes → split produit 4 segments (incluant un trailing `00` purement numérique), ce qui décalait tous les indices et faisait passer lastFedAt comme `undefined`.
- **Fix:** Remplacé le slice fixe par un **scan dynamique du MUL** :
  - MUL strict `/^\d+\.\d{4}$/` (matche exactement le format `toFixed(4)`, ne matche PAS le trailing `00` d'un offset)
  - Fallback empty-trailing quand buff null (deux parts vides à la fin)
- **Files modified:** lib/parser.ts (parseCompanion)
- **Commit:** 52b46a0

Aucune autre déviation. Bump cache et tests livrés conformes au plan.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 32099cf | feat(42-02): étendre parseCompanion/serializeCompanion pour lastFedAt + feedBuff |
| 2 | 266c2f3 | chore(42-02): bump CACHE_VERSION 6 → 7 pour shape CompanionData étendue |
| 3 | 52b46a0 | fix(42-02): parseCompanion supporte ISO timezone offset (+02:00) |
| 4 | 3146b73 | test(42-02): suite Jest round-trip parseCompanion + edge cases ISO |

## Verification

- ✅ `grep -q "lastFedAt" lib/parser.ts` — OK
- ✅ `grep -q "feedBuff" lib/parser.ts` — OK
- ✅ `grep -q "toFixed(4)" lib/parser.ts` — OK
- ✅ `grep -q "parts.length >= 8" lib/parser.ts` — OK
- ✅ `grep -q "CACHE_VERSION = 7" lib/vault-cache.ts` — OK
- ✅ `grep -q "vault-cache-v7.json" lib/vault-cache.ts` — OK
- ✅ `grep -q "v7 : Phase 42" lib/vault-cache.ts` — OK
- ✅ `npx jest lib/__tests__/companion-parser.test.ts --no-coverage` — 14/14 passed
- ✅ `npx tsc --noEmit` — pas de nouvelle erreur introduite

## Self-Check: PASSED

- ✅ lib/parser.ts modifié et contient parseCompanion v3
- ✅ lib/vault-cache.ts bumpé v7
- ✅ lib/__tests__/companion-parser.test.ts créé (14 tests pass)
- ✅ 4 commits présents dans git log (32099cf, 266c2f3, 52b46a0, 3146b73)
