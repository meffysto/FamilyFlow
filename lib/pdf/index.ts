// lib/pdf/ — Barrel export pour le domaine export PDF (Lulu Direct).
// Pattern cohérent avec lib/gamification/index.ts.

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

export {
  MANIFESTE_FILE,
  parseManifeste,
  serializeManifeste,
} from './manifest-parser';

// Phase 49 — Layout livre + génération PDF
export {
  loadFontsBase64,
  loadIllustrationBase64,
  preloadAllAssets,
  clearAssetCache,
} from './asset-loader';
export {
  PRINT_ILLUSTRATIONS,
  getPrintIllustrationModule,
} from './print-illustrations';
export * as ornaments from './ornaments';
export {
  renderBookHtml,
  renderCss,
  escapeHtml,
} from './html-template';
export type { BookHtmlSpec } from './html-template';
