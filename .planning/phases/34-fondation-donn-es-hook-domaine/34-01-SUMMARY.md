---
phase: 34-fondation-donn-es-hook-domaine
plan: 01
subsystem: love-notes-foundation
tags: [love-notes, types, parser, cache, v1.6]
requirements: [LOVE-01, LOVE-02, LOVE-04]
dependency-graph:
  requires: []
  provides:
    - "Type LoveNote + LoveNoteStatus"
    - "LOVENOTES_DIR, loveNoteFileName, loveNotePath"
    - "parseLoveNote, serializeLoveNote (round-trip)"
    - "VaultCacheState.loveNotes (CACHE_VERSION = 2)"
  affects:
    - hooks/useVault.ts (placeholder cache payload)
tech-stack:
  added: []
  patterns:
    - "File-per-entity markdown + YAML frontmatter (replique Note)"
    - "Serialisation manuelle (pas matter.stringify) pour preserver les dates ISO string"
    - "Bump CACHE_VERSION quand shape cache change (CLAUDE.md directive)"
key-files:
  created: []
  modified:
    - lib/types.ts
    - lib/parser.ts
    - lib/vault-cache.ts
    - hooks/useVault.ts
decisions:
  - "Pas de champ title dans LoveNote — discretion (le body parle de lui-meme)"
  - "Slug base36 deterministe depuis HHMMSSmmm : collision-safe a la milliseconde, fichiers stables"
  - "readAt emis conditionnellement (if note.readAt) — evite literal 'undefined' dans YAML"
  - "CACHE_FILE_URI bumpe v1 -> v2 (coherence CLAUDE.md) : snapshots v1 invalides au premier boot"
  - "loveNotes: [] placeholder dans saveCache de useVault.ts — Plan 03 remplacera par vrai load"
metrics:
  duration_minutes: 5
  completed_date: 2026-04-17
  tasks_completed: 3
  files_modified: 4
---

# Phase 34 Plan 01 : Fondation donnees LoveNote — Summary

Pose les briques statiques (type canonique, helpers path, parseur bidirectionnel, cache bumpe) pour le domaine Love Notes — replique exacte du pattern Notes, zero dependance npm, backward-compatible.

## Objective achieved

Fournir les fondations TypeScript du domaine LoveNote pour que Plan 02 (tests) et Plan 03 (hook + cablage useVault) puissent s'y brancher sans friction. Aucun hook React, aucune UI — pur types + fonctions + invalidation cache.

## What was built

### Task 1 — Types (`lib/types.ts`) — commit `0432e45`
- `LoveNoteStatus = 'pending' | 'revealed' | 'read'` (enum strict)
- `interface LoveNote { from, to, createdAt, revealAt, status, readAt?, body, sourceFile }`
- Insertion apres `Note`, avant la section Farm profile data
- Pas de champ `title` (decision : discretion, messages courts et intimes)

### Task 2 — Parser (`lib/parser.ts`) — commit `9e96a87`
- `LOVENOTES_DIR = '03 - Famille/LoveNotes'` (classement par destinataire)
- `loveNoteFileName(createdAt)` : slug deterministe `YYYY-MM-DD-{base36 de HHMMSSmmm}.md`
- `loveNotePath(toProfileId, createdAt)` : chemin relatif complet
- `parseLoveNote(relativePath, content)` : validation stricte frontmatter, retourne `null` si champ requis manquant ou status invalide
- `serializeLoveNote(note)` : construction manuelle (PAS matter.stringify — preserve les dates ISO string sans coercion Date), emet `readAt` uniquement si defini
- Round-trip loss-less verifie : `parseLoveNote(path, serializeLoveNote(data))` preserve toutes les donnees

### Task 3 — Cache (`lib/vault-cache.ts`) — commit `63c4120`
- `CACHE_VERSION = 1` -> `2` (invalide les snapshots v1 TestFlight)
- `CACHE_FILE_URI` : `vault-cache-v1.json` -> `vault-cache-v2.json`
- Import `LoveNote` depuis `./types` (alphabetique apres `HealthRecord`)
- `loveNotes: LoveNote[]` ajoute a `VaultCacheState`
- Collateral : `hooks/useVault.ts` a recu `loveNotes: []` en placeholder dans le payload `saveCache` (Plan 03 cablera le vrai load/persist)

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ok (aucune nouvelle erreur) |
| `grep -c "LoveNote" lib/types.ts` | 4 (>=3 requis) |
| `grep -c "LoveNote\|loveNote" lib/parser.ts` | 10 (>=5 requis) |
| `grep "CACHE_VERSION = 2" lib/vault-cache.ts` | 1 ligne |
| `grep "CACHE_VERSION = 1" lib/vault-cache.ts` | 0 ligne (bump effectif) |
| `grep "vault-cache-v2.json"` | 1 ligne |
| Aucun usage de `matter.stringify` dans le bloc LoveNote | confirme (seule la mention est dans un commentaire d'avertissement) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Placeholder `loveNotes: []` ajoute au payload `saveCache` dans `hooks/useVault.ts`**
- **Found during:** Task 3 (tsc apres ajout du champ requis `loveNotes: LoveNote[]` dans `VaultCacheState`)
- **Issue:** `loveNotes` etant requis (non optionnel), le call-site `saveCache({...})` en L1298 ne compile plus — erreur TS2345 "Property 'loveNotes' is missing".
- **Fix:** Ajout d'une ligne `loveNotes: [], // Phase 34 Plan 03 : sera remplace par le vrai load` dans le payload. Conforme a la note du plan Task 3 qui indique "Plan 03 fera le cablage cote useVault.ts". C'est un placeholder que Plan 03 remplacera par le vrai load depuis le vault.
- **Files modified:** hooks/useVault.ts (1 ligne ajoutee)
- **Commit:** `63c4120` (inclus dans le commit Task 3)

## Impact on devices

Au premier boot post-deploy de cette phase, les utilisateurs TestFlight perdront leur cache v1 (invalide automatiquement par le bump `CACHE_VERSION`). Ils auront un `loadVaultData` complet (~500ms-1s) ce boot-la uniquement. C'est le comportement attendu et documente (Pitfall 1 de RESEARCH evite).

## Known Stubs

- `hooks/useVault.ts` L1322 : `loveNotes: []` placeholder dans le payload `saveCache`. Raison : le hook `useLoveNotes` et le load depuis le vault seront cables dans Phase 34 Plan 03. Non-bloquant fonctionnellement (le cache n'est pas encore consomme pour re-hydrater des love notes). A remplacer en Plan 03.

## Next step

Plan 34-02 : tests Jest du round-trip `parseLoveNote` / `serializeLoveNote`, tests des helpers de path, tests de validation (status invalide, champs manquants, readAt optionnel).

## Commits

- `0432e45` — feat(34-01): ajouter type LoveNote et LoveNoteStatus
- `9e96a87` — feat(34-01): ajouter parseur bidirectionnel LoveNote
- `63c4120` — feat(34-01): bumper CACHE_VERSION a 2 et ajouter loveNotes au cache

## Self-Check: PASSED

All expected files exist. All three task commits found in git log.
