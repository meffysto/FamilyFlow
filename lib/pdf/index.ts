// lib/pdf/ — Barrel export pour le domaine export PDF (Lulu Direct).
// Pattern cohérent avec lib/gamification/index.ts.
// Note : MANIFESTE_FILE/parseManifeste/serializeManifeste seront ajoutés
// par le plan 48-03 (manifeste impressions).

export {
  TRIM_SIZE_CM,
  BLEED_CM,
  PAGE_COUNT,
  LULU_FORMAT_LABEL,
  BOOK_PALETTE,
  FONT_SLOTS,
} from './constants';

export type {
  BookExportSpec,
  BookManifestEntry,
  BookPalette,
  FontSlot,
} from './types';
