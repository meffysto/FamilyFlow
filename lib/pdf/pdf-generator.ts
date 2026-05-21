// lib/pdf/pdf-generator.ts — Orchestrateur pipeline PDF (Phase 49 Plan 03).
// Étapes : preload assets parallèle → renderBookHtml → SHA-256 du HTML source
// → printToFileAsync (page 21.64×21.64 cm = 613.4 pt). Mesure perf décomposée
// loggée __DEV__ (CONTEXT.md §183 + RESEARCH.md §688-694).
//
// Hash SHA-256 calculé sur le HTML SOURCE (pas le PDF binaire) pour garantir
// le déterminisme — RESEARCH.md §481-515 : les métadonnées PDF (date création,
// XObject IDs) ne sont pas déterministes côté WKWebView.

import * as Print from 'expo-print';
import * as Crypto from 'expo-crypto';
import type { BedtimeStory, SceneArchetype } from '../types';
import type { BookManifestEntry } from './types';
import { TRIM_SIZE_CM, BLEED_CM, BOOK_PALETTE, LULU_FORMAT_LABEL } from './constants';
import { renderBookHtml, renderCss } from './html-template';
import { renderCoverPage } from './components/cover';
import { loadFontsBase64, loadIllustrationBase64 } from './asset-loader';
import { detectTomeBadge } from './saga-detection';
import { generateStoryQrSvg } from './qr-generator';

const PT_PER_CM = 28.346456693;
/** Page final size en points : 21.64cm × 28.346 = 613.4 pt (Pitfall 2 RESEARCH.md). */
export const PAGE_SIZE_PT = (TRIM_SIZE_CM + 2 * BLEED_CM) * PT_PER_CM;

const ALL_ARCHETYPES: readonly SceneArchetype[] = [
  'paysage',
  'rencontre',
  'decouverte',
  'vulnerable',
  'echange',
  'etreinte',
] as const;

export interface GenerateBookPdfOptions {
  story: BedtimeStory;
  allStories: BedtimeStory[];
}

export interface GenerateBookPdfResult {
  /** URI cache app du PDF généré (à passer à `persistBookPdf`). */
  uri: string;
  /** URI cache du PDF couverture séparé (1 page recto, publication Lulu). */
  coverUri: string;
  /** SHA-256 hex du HTML source (déterministe). */
  hash: string;
  /** Entrée manifeste prête à persister (sans `chemin`, rempli par persistBookPdf). */
  entry: Omit<BookManifestEntry, 'chemin'>;
  /** HTML source rendu (debug + tests). Pas écrit sur disque. */
  html: string;
  /** Mesures perf décomposées (ms). */
  perf: {
    totalMs: number;
    assetsMs: number;
    renderMs: number;
    hashMs: number;
    printMs: number;
  };
}

/**
 * Génère un PDF Lulu 21×21 du livre depuis l'histoire fournie.
 * Pipeline complet : assets parallèle → HTML → hash → print.
 *
 * @throws si scenes présentes mais length !== 6 (renderBookHtml — strict CONTEXT.md D-Q2).
 */
export async function generateBookPdf(
  opts: GenerateBookPdfOptions,
): Promise<GenerateBookPdfResult> {
  const t0 = Date.now();

  // 1. Charger assets en parallèle (fonts + QR SVG Phase 50 + 6 illustrations forêt)
  const tA0 = Date.now();
  const [fonts, qrSvg, ...illuResults] = await Promise.all([
    loadFontsBase64(),
    generateStoryQrSvg(opts.story.id, BOOK_PALETTE),
    ...ALL_ARCHETYPES.map((a) => loadIllustrationBase64(opts.story.univers, a, opts.story.id)),
  ]);
  const illustrations = new Map<SceneArchetype, string>();
  ALL_ARCHETYPES.forEach((arche, idx) => {
    const b64 = illuResults[idx];
    if (b64) illustrations.set(arche, b64);
  });
  const assetsMs = Date.now() - tA0;

  // 2. Détecter tome saga (pure func)
  const tomeBadge = detectTomeBadge(opts.story, opts.allStories);

  // 3. Construire HTML (renderBookHtml throw si scenes.length !== 6)
  const tR0 = Date.now();
  const html = renderBookHtml({
    story: opts.story,
    scenes: opts.story.scenes?.scenes ?? null,
    illustrations,
    fonts,
    palette: BOOK_PALETTE,
    tomeBadge,
    qrSvg,
  });
  const renderMs = Date.now() - tR0;

  // 4. Hash SHA-256 du HTML source (PDF-07 — déterminisme)
  const tH0 = Date.now();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    html,
  );
  const hashMs = Date.now() - tH0;

  // 5. expo-print → PDF (Pitfall 2 mitigation : width/height en POINTS, margins 0)
  const tP0 = Date.now();
  const result = await Print.printToFileAsync({
    html,
    width: PAGE_SIZE_PT,
    height: PAGE_SIZE_PT,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  // PDF couverture séparé pour publication Lulu (1 page recto, mêmes assets)
  const coverHtml = renderCoverOnlyHtml({
    story: opts.story,
    coverImageBase64: illustrations.get('paysage') ?? null,
    fonts,
  });
  const coverResult = await Print.printToFileAsync({
    html: coverHtml,
    width: PAGE_SIZE_PT,
    height: PAGE_SIZE_PT,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  const printMs = Date.now() - tP0;

  const totalMs = Date.now() - t0;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      `[generateBookPdf] ${opts.story.id} — ${totalMs}ms — ` +
        `assets:${assetsMs}ms render:${renderMs}ms hash:${hashMs}ms print:${printMs}ms`,
    );
    if (totalMs > 5000) {
      // eslint-disable-next-line no-console
      console.warn(
        `[generateBookPdf] PERF BUDGET DÉPASSÉ : ${totalMs}ms > 5000ms — ` +
          `assets:${assetsMs}ms render:${renderMs}ms hash:${hashMs}ms print:${printMs}ms — ` +
          `story=${opts.story.id} — inspecter le bottleneck dominant.`,
      );
    }
  }

  const entry: Omit<BookManifestEntry, 'chemin'> = {
    id: opts.story.id,
    hash,
    date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD UTC
    format: LULU_FORMAT_LABEL,
  };

  return {
    uri: result.uri,
    coverUri: coverResult.uri,
    hash,
    entry,
    html,
    perf: { totalMs, assetsMs, renderMs, hashMs, printMs },
  };
}

/** HTML autonome contenant uniquement la couverture (1 page recto). */
function renderCoverOnlyHtml(opts: {
  story: import('../types').BedtimeStory;
  coverImageBase64: string | null;
  fonts: { andikaRegular: string; andikaBold: string };
}): string {
  const css = renderCss(BOOK_PALETTE, opts.fonts);
  const page = renderCoverPage({
    story: opts.story,
    coverImageBase64: opts.coverImageBase64,
    palette: BOOK_PALETTE,
  });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${opts.story.titre}</title>
<style>${css}</style>
</head>
<body>
${page}
</body>
</html>`;
}

// Exposer constantes utilitaires pour tests / debug
export { TRIM_SIZE_CM, BLEED_CM };
