// lib/pdf/components/fallback-double-page.ts — Mode B fallback ornemental (Plan 49-04).
// Vision ambitieuse "faire rêver" CONTEXT.md §85-138 :
// - Drop cap manuscrit Caveat 6em terracotta dans cartouche feuillagé SVG
// - Bordures botaniques marge externe (alterner fougère/ramure/lichen, opacité ~0.10)
// - Pull quote DM Serif Display italic 1.4em encadré separatorTriple
// - Vignettes haut/bas (lune+forêt OU lanterne+oiseau selon parité pageIndex)
// - Numéros de page cartouchés Caveat terracotta
// - Palette ornementale exacte : terracotta #B8593F + sauge #7A8F6B + ivoire #F4EDE2 + encre #2E2A26

import { escapeHtml } from '../html-template';
import {
  cartoucheFrame,
  borderFern,
  borderRamage,
  borderLichen,
  vignetteCrescent,
  vignetteForest,
  vignetteLantern,
  vignetteBird,
  separatorTriple,
} from '../ornaments';

// Palette ornementale mode B — exacte CONTEXT.md §117-122
const TERRACOTTA = '#B8593F';
const SAGE = '#7A8F6B';
// Override BOOK_PALETTE.ivory (#FAF6EE) en mode B avec l'ivoire ornemental CONTEXT.md
const IVORY = '#F4EDE2';
const INK = '#2E2A26';

export interface FallbackDoublePageOpts {
  /** Numéro 1..6 — détermine alternance bordures + vignettes */
  pageIndex: number;
  /** Section de texte à afficher sur cette double-page (issue de splitTextIntoSections) */
  text: string;
  /** Numéro folio gauche (paire) */
  pageNumLeft: number;
  /** Numéro folio droite (impaire) */
  pageNumRight: number;
}

export function renderFallbackDoublePage(opts: FallbackDoublePageOpts): string {
  const { pageIndex, text, pageNumLeft, pageNumRight } = opts;
  const trimmed = text.trim();

  // Drop cap = première lettre, reste = corps
  const firstChar = trimmed.charAt(0) || ' ';
  const restText = trimmed.slice(1);

  // Découper restText : 60% page gauche, 40% page droite + pull quote
  const splitIdx = findWordBoundary(restText, Math.round(restText.length * 0.6));
  const leftBody = restText.slice(0, splitIdx).trim();
  const rightBody = restText.slice(splitIdx).trim();

  // Pull quote (heuristique CONTEXT.md §101)
  const pullQuote = extractPullQuote(trimmed);

  // Bordure alternée + vignettes
  const borderSvg = pickBorder(pageIndex);
  const { vignetteTop, vignetteBottom } = pickVignettes(pageIndex);

  const pageLeft = `<section class="page fallback-page" data-mode="fallback" data-page-index="${pageIndex}-left" style="background:${IVORY};">
    <div class="border-outer" style="position:absolute; left:0; top:0.82cm; bottom:0.82cm; width:1.5cm; opacity:0.10;">${borderSvg}</div>
    <div class="vignette-top" style="position:absolute; top:0.6cm; left:50%; transform:translateX(-50%);">${vignetteTop}</div>
    <div class="safe-area" style="padding-left:2.2cm; padding-top:2.4cm; padding-right:1.4cm; padding-bottom:2.4cm;">
      <div class="drop-cap-block" style="float:left; width:3cm; height:3cm; position:relative; margin:0.2em 0.4em 0 0;">
        <div style="position:absolute; inset:0;">${cartoucheFrame({ color: SAGE, size: 100 })}</div>
        <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:'Caveat', cursive; font-size:6em; line-height:1; color:${TERRACOTTA};">${escapeHtml(firstChar)}</div>
      </div>
      <p class="body-text" style="font-family:'Andika', serif; font-size:14pt; line-height:1.7; color:${INK}; text-align:justify;">${escapeHtml(leftBody)}</p>
    </div>
    <div class="page-num-cartouche" style="position:absolute; bottom:0.5cm; left:50%; transform:translateX(-50%); width:1.6cm; height:1.6cm; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; inset:0; opacity:0.6;">${cartoucheFrame({ color: SAGE, size: 60 })}</div>
      <span style="font-family:'Caveat', cursive; font-size:14pt; color:${TERRACOTTA}; position:relative;">${pageNumLeft}</span>
    </div>
  </section>`;

  const pullQuoteBlock = pullQuote
    ? `<div class="pull-quote-wrap" style="text-align:center; padding:1.2em 0;">
        <div style="margin-bottom:0.4em;">${separatorTriple({ color: TERRACOTTA, size: 22 })}</div>
        <div class="pull-quote" style="font-family:'DM Serif Display', serif; font-style:italic; font-size:1.4em; color:${INK}; line-height:1.4;">${escapeHtml(pullQuote)}</div>
        <div style="margin-top:0.4em;">${separatorTriple({ color: TERRACOTTA, size: 22 })}</div>
      </div>`
    : '';

  const pageRight = `<section class="page fallback-page" data-mode="fallback" data-page-index="${pageIndex}-right" style="background:${IVORY};">
    <div class="border-outer" style="position:absolute; right:0; top:0.82cm; bottom:0.82cm; width:1.5cm; opacity:0.10;">${borderSvg}</div>
    <div class="safe-area" style="padding-right:2.2cm; padding-top:2.4cm; padding-left:1.4cm; padding-bottom:2.4cm;">
      <p class="body-text" style="font-family:'Andika', serif; font-size:14pt; line-height:1.7; color:${INK}; text-align:justify;">${escapeHtml(rightBody)}</p>
      ${pullQuoteBlock}
    </div>
    <div class="vignette-bottom" style="position:absolute; bottom:1.6cm; left:50%; transform:translateX(-50%);">${vignetteBottom}</div>
    <div class="page-num-cartouche" style="position:absolute; bottom:0.5cm; left:50%; transform:translateX(-50%); width:1.6cm; height:1.6cm; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; inset:0; opacity:0.6;">${cartoucheFrame({ color: SAGE, size: 60 })}</div>
      <span style="font-family:'Caveat', cursive; font-size:14pt; color:${TERRACOTTA}; position:relative;">${pageNumRight}</span>
    </div>
  </section>`;

  return pageLeft + '\n' + pageRight;
}

function findWordBoundary(text: string, target: number): number {
  if (target <= 0) return 0;
  if (target >= text.length) return text.length;
  const next = text.indexOf(' ', target);
  if (next === -1) return text.length;
  return next;
}

/** Extrait l'avant-dernière phrase comme pull quote (CONTEXT.md §101). */
function extractPullQuote(text: string): string | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length < 2) return null;
  const candidate = sentences[sentences.length - 2] ?? sentences[1];
  if (!candidate) return null;
  return candidate.length > 180 ? candidate.slice(0, 177).trimEnd() + '…' : candidate;
}

function pickBorder(pageIndex: number): string {
  const i = (((pageIndex - 1) % 3) + 3) % 3;
  if (i === 0) return borderFern({ color: SAGE, size: 60 });
  if (i === 1) return borderRamage({ color: SAGE, size: 60 });
  return borderLichen({ color: SAGE, size: 60 });
}

function pickVignettes(pageIndex: number): { vignetteTop: string; vignetteBottom: string } {
  if (pageIndex % 2 === 0) {
    return {
      vignetteTop: vignetteCrescent({ color: TERRACOTTA, size: 30 }),
      vignetteBottom: vignetteForest({ color: SAGE, size: 30 }),
    };
  }
  return {
    vignetteTop: vignetteLantern({ color: TERRACOTTA, size: 30 }),
    vignetteBottom: vignetteBird({ color: SAGE, size: 30 }),
  };
}
