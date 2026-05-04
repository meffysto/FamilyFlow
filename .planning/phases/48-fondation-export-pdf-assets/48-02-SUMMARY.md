---
phase: 48-fondation-export-pdf-assets
plan: 02
subsystem: pdf-export
tags: [lib-pdf, constants, types, barrel]
requires: [48-01]
provides:
  - lib/pdf/index.ts barrel (6 constantes + 4 types)
  - constantes Lulu Direct figées (TRIM_SIZE_CM, BLEED_CM, PAGE_COUNT, LULU_FORMAT_LABEL)
  - BOOK_PALETTE placeholder (finalisable Phase 49 sans casser l'API)
  - FONT_SLOTS mappant les alias Andika déclarés en 48-01
  - types BookExportSpec, BookManifestEntry, BookPalette, FontSlot
affects: []
tech-stack:
  added: []
  patterns: [barrel lib/gamification/index.ts, as const pour types littéraux]
key-files:
  created:
    - lib/pdf/constants.ts
    - lib/pdf/types.ts
    - lib/pdf/index.ts
  modified: []
decisions:
  - "Structure aplatie 3 fichiers (index/constants/types) — manifest-parser.ts laissé pour 48-03 selon PLAN explicite (RESEARCH.md propose 4 fichiers, le PLAN découpe ce 4e en 48-03)"
  - "BOOK_PALETTE placeholder ivory/terracotta/sage/ink/paperShadow figée comme API — valeurs hex modifiables Phase 49"
  - "FONT_SLOTS.body='Andika-Regular' / bodyBold='Andika-Bold' alignés avec useFonts() de 48-01 (T-48-04 mitigé)"
metrics:
  duration: ~2min
  completed: 2026-05-04
requirements: [PDF-02, QA-01]
---

# Phase 48 Plan 02 : Module lib/pdf/ — Summary

Création du module `lib/pdf/` avec structure aplatie 3 fichiers : constantes Lulu Direct (TRIM/BLEED/PAGE_COUNT/palette/font slots), types domaine (BookExportSpec, BookManifestEntry + dérivés), et barrel `index.ts`.

## Exports finaux du barrel

**Constantes (6) :** `TRIM_SIZE_CM`, `BLEED_CM`, `PAGE_COUNT`, `LULU_FORMAT_LABEL`, `BOOK_PALETTE`, `FONT_SLOTS`
**Types (4) :** `BookExportSpec`, `BookManifestEntry`, `BookPalette`, `FontSlot`

## Note 48-03

`manifest-parser.ts` à ajouter par 48-03 — le barrel `index.ts` sera étendu avec `MANIFESTE_FILE`, `parseManifeste`, `serializeManifeste` (commentaire explicite déjà présent dans le fichier).

## Verification

| Commande | Résultat |
|----------|----------|
| `ls lib/pdf/` | 3 fichiers (constants.ts, types.ts, index.ts) |
| `npx tsc --noEmit` (filtré lib/pdf) | clean — aucune erreur |
| `grep "Andika-Regular" lib/pdf/constants.ts` | 1 occurrence (FONT_SLOTS.body) |
| `grep -c "^export" lib/pdf/index.ts` | 2 (export + export type) |

## Deviations

Aucune — plan exécuté tel quel.

## Self-Check: PASSED

- `lib/pdf/constants.ts` — FOUND
- `lib/pdf/types.ts` — FOUND
- `lib/pdf/index.ts` — FOUND
- Commit `b4181719` — FOUND
- TS clean confirmé

**Commit :** `b4181719` — feat(48-02): module lib/pdf/ — constantes Lulu + types
