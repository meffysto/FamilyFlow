// lib/pdf/html-template.ts — Assembleur HTML principal du livre (squelette + CSS).
// Composants page (cover/title/scene/back-cover) seront détaillés Plan 49-02 et 49-04.
// Contraintes WKWebView : DOCTYPE HTML5 obligatoire, tout inline base64
// (RESEARCH.md §307-368 + §351-365 + Pitfall 3 §756 + Pitfall 5).

import type { BedtimeStory, SceneSpec, SceneArchetype } from '../types';
import type { BookPalette } from './types';

/** Spec d'entrée pour `renderBookHtml`. Mode A = scenes != null + illustrations remplies, Mode B sinon. */
export interface BookHtmlSpec {
  story: BedtimeStory;
  scenes: SceneSpec[] | null;
  /** Map `archetype → data:image/png;base64,...` (mode A). Vide en mode B. */
  illustrations: Map<SceneArchetype, string>;
  fonts: { andikaRegular: string; andikaBold: string };
  palette: BookPalette;
  /** Badge tome saga (ex: tome 2/4). null si histoire standalone. */
  tomeBadge: { current: number; total: number; livreTitre: string } | null;
}

/**
 * Échappe les caractères HTML spéciaux (sécurité injection titre/texte histoire).
 * Exporté car les composants Plan 49-02 / 49-04 en auront besoin.
 */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

/**
 * Génère le CSS du livre (RESEARCH.md §225-285 + §351-365 + CONTEXT.md §117-125).
 * - `@page 21.64cm` (21cm trim + 0.32cm bleed × 2)
 * - Deux `@font-face` Andika base64 truetype, alias unifié `font-family: 'Andika'`
 *   avec `font-weight: 400 | 700` (PAS Andika-Regular/-Bold séparés — Pitfall 5)
 * - Palette livre injectée via interpolation
 */
export function renderCss(
  palette: BookPalette,
  fonts: { andikaRegular: string; andikaBold: string },
): string {
  return `
@page {
  size: 21.64cm 21.64cm;
  margin: 0;
}

@font-face {
  font-family: 'Andika';
  src: url('data:font/ttf;base64,${fonts.andikaRegular}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Andika';
  src: url('data:font/ttf;base64,${fonts.andikaBold}') format('truetype');
  font-weight: 700;
  font-style: normal;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 21.64cm;
  font-family: 'Andika', serif;
  color: ${palette.ink};
  background: ${palette.ivory};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page {
  width: 21.64cm;
  height: 21.64cm;
  page-break-after: always;
  page-break-inside: avoid;
  position: relative;
  overflow: hidden;
  background: ${palette.ivory};
}

.page:last-child { page-break-after: auto; }

.safe-area { position: absolute; inset: 0.82cm; }
.full-bleed { position: absolute; inset: 0; width: 100%; height: 100%; }

.scene-illustration { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Stubs typographie ornementale (mode B) — détails Plan 49-04 */
.drop-cap {
  font-family: 'Caveat', cursive;
  font-size: 6em;
  color: #B8593F;
  float: left;
  line-height: 0.85;
  padding-right: 0.15em;
}
.pull-quote {
  font-family: 'DM Serif Display', serif;
  font-style: italic;
  font-size: 1.4em;
  text-align: center;
  color: ${palette.ink};
  padding: 2em 0;
}
.page-num {
  font-family: 'Caveat', cursive;
  font-size: 1em;
  color: #B8593F;
  position: absolute;
  bottom: 0.6cm;
}
.page-num.left { left: 0.82cm; }
.page-num.right { right: 0.82cm; }
.body-text {
  font-family: 'Andika', serif;
  font-size: 14pt;
  line-height: 1.6;
  color: ${palette.ink};
}
`;
}

/**
 * Stub structurel des 16 sections .page.
 * Plan 49-02 remplacera par cover/title/scene-double-page/back-cover
 * (mode A : 1 cover + 1 title + 6 doubles-pages illustrées + 1 fin + 1 back).
 */
function renderPagesStub(_spec: BookHtmlSpec): string {
  const arr: string[] = [];
  for (let i = 0; i < 16; i++) {
    arr.push(`<section class="page" data-page-index="${i + 1}"><div class="safe-area"></div></section>`);
  }
  return arr.join('\n');
}

/**
 * Assemble le HTML complet du livre.
 * Squelette : DOCTYPE + html lang fr + head (meta + title + style) + body (16 .page sections).
 * Mitigation Pitfall 3 RESEARCH.md §756 : DOCTYPE en tête, sinon WKWebView rend page blanche.
 */
export function renderBookHtml(spec: BookHtmlSpec): string {
  const css = renderCss(spec.palette, spec.fonts);
  const pages = renderPagesStub(spec);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(spec.story.titre)}</title>
<style>${css}</style>
</head>
<body>
${pages}
</body>
</html>`;
}
