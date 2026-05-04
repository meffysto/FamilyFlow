---
phase: 48-fondation-export-pdf-assets
plan: 03
subsystem: pdf-export
tags: [lib-pdf, manifest-parser, jest, round-trip]
requires: [48-02]
provides:
  - lib/pdf/manifest-parser.ts (parseManifeste, serializeManifeste, MANIFESTE_FILE)
  - lib/pdf/index.ts barrel étendu (10 exports : 6 const + 4 types + 3 parser)
  - Suite Jest pdf-manifest-parser.test.ts (10 tests, round-trip strict equality PDF-04)
affects: [lib/pdf/index.ts]
tech-stack:
  added: []
  patterns: [gray-matter frontmatter + table markdown ligne par ligne (parseRDV + parseAnniversaires)]
key-files:
  created:
    - lib/pdf/manifest-parser.ts
    - lib/__tests__/pdf-manifest-parser.test.ts
  modified:
    - lib/pdf/index.ts
decisions:
  - "Frontmatter version: 1 figé pour migrations futures (cohérent avec parseRDV)"
  - "Format manifeste : frontmatter gray-matter + table markdown 5 colonnes (ID histoire | Hash | Date | Format | Chemin)"
  - "Fichier vault 12 - Impressions/manifeste.md PAS créé physiquement — convention vault lazy creation, sera généré par Phase 49 au premier export PDF (serializeManifeste([]))"
  - "Pas de bump CACHE_VERSION : manifeste est un nouveau domaine non caché"
metrics:
  duration: ~3min
  completed: 2026-05-04
requirements: [PDF-04, QA-02]
---

# Phase 48 Plan 03 : Manifeste impressions — Summary

Parser bidirectionnel `parseManifeste` / `serializeManifeste` + suite Jest round-trip dans `lib/pdf/manifest-parser.ts`. Pattern hybride parseRDV (frontmatter) + parseAnniversaires (scan table ligne par ligne). Barrel `lib/pdf/index.ts` étendu avec 3 nouveaux exports.

## Format manifeste finalisé

```markdown
---
tags:
  - impressions
  - manifeste
version: 1
---

# Manifeste impressions

Registre des PDFs exportés pour impression Lulu Direct.

| ID histoire | Hash | Date | Format | Chemin |
|-------------|------|------|--------|--------|
| story_foret | a3f7... | 2026-05-04 | Lulu 21×21 | 12 - Impressions/PDFs/foret.pdf |
```

## Tests Jest (10/10 passants)

| Suite | Tests |
|-------|-------|
| MANIFESTE_FILE | 1 — pointe vers '12 - Impressions/manifeste.md' |
| parseManifeste | 4 — vide, frontmatter sans table, parse 3 entrées, ignore malformés |
| serializeManifeste | 2 — liste vide, frontmatter version: 1 |
| round-trip (PDF-04) | 3 — **strict equality 3 entrées**, 1 entrée, liste vide |

Test critique PDF-04 : `parseManifeste(serializeManifeste(SAMPLE_THREE)) toEqual SAMPLE_THREE` ✓

## Verification

| Commande | Résultat |
|----------|----------|
| `npx jest lib/__tests__/pdf-manifest-parser.test.ts` | 10 passed |
| `npx tsc --noEmit` (filtré lib/pdf) | clean |
| `grep -c "^export" lib/pdf/index.ts` | 3 blocs (const + type + parser) |

## Note vault folder

Le dossier `12 - Impressions/` et le fichier `manifeste.md` ne sont **pas créés physiquement** par cette phase. Convention vault "lazy creation" : Phase 49 (export PDF) créera le fichier au premier export via `serializeManifeste([])`. Si test manuel souhaité, le dev peut générer un squelette à la demande.

## Deviations

Aucune — plan exécuté tel quel (TDD RED → GREEN → barrel).

## Self-Check: PASSED

- `lib/pdf/manifest-parser.ts` — FOUND
- `lib/__tests__/pdf-manifest-parser.test.ts` — FOUND
- Commit RED `86dfb6c4` — FOUND
- Commit GREEN `23a8f8b8` — FOUND
- Tests 10/10 verts, tsc clean

**Commits :**
- `86dfb6c4` — test(48-03): tests RED parser manifeste impressions — round-trip + edge cases
- `23a8f8b8` — feat(48-03): manifeste impressions — parser bidirectionnel + tests round-trip
