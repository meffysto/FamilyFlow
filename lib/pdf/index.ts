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
export { renderCoverPage } from './components/cover';
export type { CoverPageOpts } from './components/cover';
export { renderTitlePage } from './components/title';
export type { TitlePageOpts } from './components/title';
export { renderSceneDoublePage } from './components/scene-double-page';
export type { SceneDoublePageOpts } from './components/scene-double-page';
export { renderBackCoverPage } from './components/back-cover';
export type { BackCoverOpts } from './components/back-cover';

// Plan 49-03 — Pipeline génération + persistance
export { detectTomeBadge } from './saga-detection';
export type { TomeBadge } from './saga-detection';
export { generateBookPdf, PAGE_SIZE_PT } from './pdf-generator';
export type {
  GenerateBookPdfOptions,
  GenerateBookPdfResult,
} from './pdf-generator';
export { persistBookPdf } from './book-storage';
