// lib/pdf/components/scene-double-page.ts — Folios 3-14 mode A (Plan 49-02).
// Une scène = double-page : page paire illustration full-bleed / page impaire texte avec highlights.

import type { BedtimeStory, SceneSpec, HighlightSpan } from '../../types';
import type { BookPalette } from '../types';
import { escapeHtml } from '../html-template';

/** Couleur teal des highlights (cohérent avec lib/types.ts:903 keyword). */
const HIGHLIGHT_COLOR = '#0F8B8D';

export interface SceneDoublePageOpts {
  scene: SceneSpec;
  story: BedtimeStory;
  /** Illustration archetype base64 (mode A). null si univers non-illustré → fallback paperShadow. */
  illustrationBase64: string | null;
  palette: BookPalette;
  /** Numéro de page affiché sur la page paire (illustration). */
  pageNumLeft: number;
  /** Numéro de page affiché sur la page impaire (texte). */
  pageNumRight: number;
}

/**
 * Rend EXACTEMENT 2 sections `.page` concaténées (gauche illustration, droite texte).
 * - Page paire : illustration full-bleed PNG base64, ou fallback paperShadow + archetype label
 * - Page impaire : texte de la scène (slice textStart/textEnd) en safe-area Andika 14pt,
 *   highlights wrappés `<span class="highlight">` en teal #0F8B8D bold
 * - Numéros page en cartouche Caveat terracotta — `.left` page paire, `.right` page impaire
 * - `data-archetype` sur les 2 sections (pour tests + futur ciblage CSS)
 *
 * Pure function : pas de Date.now(), pas de Math.random(), tri stable.
 */
export function renderSceneDoublePage(opts: SceneDoublePageOpts): string {
  const { scene, story, illustrationBase64, palette, pageNumLeft, pageNumRight } = opts;

  // Slicing déterministe — RESEARCH.md §503-509 condition #1 du hash
  const sceneText = story.texte.slice(scene.textStart, scene.textEnd);

  // Page paire — illustration full-bleed ou fallback paperShadow
  const illustrationBlock = illustrationBase64
    ? `<img class="full-bleed scene-illustration" src="data:image/png;base64,${illustrationBase64}" alt="" />`
    : `<div class="full-bleed" style="background:${palette.paperShadow}; display:flex; align-items:center; justify-content:center; font-family:'DM Serif Display', serif; font-size:48pt; color:${palette.sage};">${escapeHtml(scene.archetype)}</div>`;

  const leftPage = `<section class="page scene-illustration-page" data-archetype="${scene.archetype}">
    ${illustrationBlock}
    <div class="page-num left" style="position:absolute; bottom:0.6cm; left:0.82cm; font-family:'Caveat', cursive; font-size:12pt; color:${palette.terracotta}; background:${palette.ivory}; padding:0.1cm 0.3cm; border-radius:0.2cm;">${pageNumLeft}</div>
  </section>`;

  // Page impaire — texte avec highlights teal
  const textHtml = renderTextWithHighlights(sceneText, scene.highlights);

  const rightPage = `<section class="page scene-text-page" data-archetype="${scene.archetype}">
    <div class="safe-area" style="display:flex; align-items:center;">
      <p class="body-text" style="font-family:'Andika', serif; font-size:14pt; line-height:1.7; color:${palette.ink}; text-align:justify;">${textHtml}</p>
    </div>
    <div class="page-num right" style="position:absolute; bottom:0.6cm; right:0.82cm; font-family:'Caveat', cursive; font-size:12pt; color:${palette.terracotta};">${pageNumRight}</div>
  </section>`;

  return leftPage + '\n' + rightPage;
}

/**
 * Découpe `text` en segments {plain, highlight} selon les spans, escape chaque
 * segment, et concatène avec `<span class="highlight">` autour des highlights.
 * Indices RELATIFS au texte de la scène (lib/types.ts:920).
 *
 * Highlights overlapping ou dégénérés (start >= end, hors range) silencieusement ignorés.
 */
function renderTextWithHighlights(text: string, highlights: HighlightSpan[]): string {
  if (!highlights || highlights.length === 0) {
    return escapeHtml(text);
  }

  // Tri stable par startChar (Array.sort stable depuis ES2019, OK Hermes/RN 0.81)
  const sorted = [...highlights]
    .filter(h => h.endChar > h.startChar)
    .sort((a, b) => a.startChar - b.startChar);

  const parts: string[] = [];
  let cursor = 0;
  for (const span of sorted) {
    const start = Math.max(cursor, Math.min(span.startChar, text.length));
    const end = Math.max(start, Math.min(span.endChar, text.length));
    if (start > cursor) parts.push(escapeHtml(text.slice(cursor, start)));
    if (end > start) {
      parts.push(`<span class="highlight" style="color:${HIGHLIGHT_COLOR}; font-weight:700;">${escapeHtml(text.slice(start, end))}</span>`);
    }
    cursor = end;
  }
  if (cursor < text.length) parts.push(escapeHtml(text.slice(cursor)));
  return parts.join('');
}
