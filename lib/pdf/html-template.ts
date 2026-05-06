// lib/pdf/html-template.ts — Assembleur HTML principal du livre (squelette + CSS).
// Composants page (cover/title/scene/back-cover) seront détaillés Plan 49-02 et 49-04.
// Contraintes WKWebView : DOCTYPE HTML5 obligatoire, tout inline base64
// (RESEARCH.md §307-368 + §351-365 + Pitfall 3 §756 + Pitfall 5).

import type { BedtimeStory, SceneSpec, SceneArchetype } from '../types';
import type { BookPalette } from './types';
// Composants page (Plan 49-02). Imports placés après l'export de escapeHtml ci-dessous —
// les composants importent escapeHtml depuis ce module (cycle géré : escapeHtml est une
// fonction pure définie en hoist statique, pas de dépendance d'initialisation).
import { renderCoverPage } from './components/cover';
import { renderTitlePage } from './components/title';
import { renderSceneDoublePage } from './components/scene-double-page';
import { renderBackCoverPage } from './components/back-cover';
import { renderFallbackDoublePage } from './components/fallback-double-page';
import { splitTextIntoSections } from './text-splitter';

/** Spec d'entrée pour `renderBookHtml`. Mode A = scenes != null + illustrations remplies, Mode B sinon. */
export interface BookHtmlSpec {
  story: BedtimeStory;
  scenes: SceneSpec[] | null;
  /** Map `archetype → data:image/jpeg;base64,...` (mode A). Vide en mode B. */
  illustrations: Map<SceneArchetype, string>;
  fonts: { andikaRegular: string; andikaBold: string };
  palette: BookPalette;
  /** Badge tome saga (ex: tome 2/4). null si histoire standalone. */
  tomeBadge: { current: number; total: number; livreTitre: string } | null;
  /** SVG inline du QR code 4ème de couverture (Phase 50, QR-04). Encode `family-vault://story/<id>`. */
  qrSvg: string;
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
 * Mode A — Picture-book illustré (univers forêt MVP).
 * Produit 16 sections : cover (1) + title (1) + 6×scene-double-page (12) + end (1) + back-cover (1).
 * Strict 6 scènes (CONTEXT.md D-Q2) — throw si scenes.length !== 6.
 */
function renderModeAPages(spec: BookHtmlSpec): string {
  const scenes = spec.scenes!;
  if (scenes.length !== 6) {
    throw new Error(
      `Cette histoire contient ${scenes.length} scène${scenes.length > 1 ? 's' : ''} au lieu des 6 requises pour le format livre illustré. Régénère-la avec une longueur « Longue » ou « Très longue » pour obtenir 6 scènes.`,
    );
  }

  const coverImg = spec.illustrations.get('paysage') ?? null;
  const pages: string[] = [];

  // Folio 1 — Cover
  pages.push(renderCoverPage({ story: spec.story, coverImageBase64: coverImg, palette: spec.palette }));

  // Folio 2 — Page de titre
  pages.push(renderTitlePage({ story: spec.story, palette: spec.palette, tomeBadge: spec.tomeBadge }));

  // Folios 3-14 — 6 doubles-pages scènes
  let pageNum = 3;
  for (const scene of scenes) {
    const illu = spec.illustrations.get(scene.archetype) ?? null;
    pages.push(renderSceneDoublePage({
      scene,
      story: spec.story,
      illustrationBase64: illu,
      palette: spec.palette,
      pageNumLeft: pageNum,
      pageNumRight: pageNum + 1,
    }));
    pageNum += 2;
  }

  // Folio 15 — Page Fin / dédicace
  pages.push(renderEndPage(spec));

  // Folio 16 — 4ème de couverture
  pages.push(renderBackCoverPage({ story: spec.story, palette: spec.palette, qrSvg: spec.qrSvg }));

  return pages.join('\n');
}

/** Folio 15 mode A — page "Fin." + memorySummary optionnel.
 *  Tout le contenu DOIT tenir sur une seule page (21.64×21.64cm, safe-area 20×20cm).
 *  - memorySummary tronqué à 220 chars max (sinon bord overflow → coupe sur 2 pages)
 *  - Tailles dimensionnées pour que Fin. + summary tiennent dans 20cm de haut
 *  - `overflow:hidden` sur la safe-area = garde-fou si le texte AI dépasse quand même
 */
function renderEndPage(spec: BookHtmlSpec): string {
  const { palette, story } = spec;
  const rawSummary = story.memorySummary?.trim() ?? '';
  const summary = rawSummary.length > 220
    ? rawSummary.slice(0, 219).trimEnd() + '…'
    : rawSummary;
  const memory = summary
    ? `<div style="font-family:'Andika', serif; font-size:11pt; line-height:1.55; color:${palette.ink}; max-width:14cm; text-align:center; margin-top:1cm;">${escapeHtml(summary)}</div>`
    : '';
  return `<section class="page end-page">
    <div class="safe-area" style="display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
      <div style="font-family:'DM Serif Display', serif; font-size:54pt; line-height:1; color:${palette.terracotta};">Fin.</div>
      ${memory}
    </div>
  </section>`;
}

/**
 * Mode B — Fallback texte-seul ornemental (CONTEXT.md §85-138).
 * Produit 16 sections : cover (1) + title (1) + 6 doubles-pages fallback (12) + end (1) + back-cover (1).
 * Drop caps + bordures botaniques + pull quotes + vignettes + numéros cartouchés.
 */
function renderModeBPages(spec: BookHtmlSpec): string {
  const sections = splitTextIntoSections(spec.story.texte, 6);
  const pages: string[] = [];

  // Folio 1 — Cover (réutilise renderCoverPage ; coverImageBase64 null si univers non-forêt → fallback paperShadow)
  pages.push(
    renderCoverPage({
      story: spec.story,
      coverImageBase64: spec.illustrations.get('paysage') ?? null,
      palette: spec.palette,
    }),
  );

  // Folio 2 — Page de titre (avec tomeBadge si saga)
  pages.push(
    renderTitlePage({
      story: spec.story,
      palette: spec.palette,
      tomeBadge: spec.tomeBadge,
    }),
  );

  // Folios 3-14 — 6 doubles-pages fallback ornementales
  let pageNum = 3;
  for (let i = 0; i < 6; i++) {
    pages.push(
      renderFallbackDoublePage({
        pageIndex: i + 1,
        text: sections[i] ?? '',
        pageNumLeft: pageNum,
        pageNumRight: pageNum + 1,
      }),
    );
    pageNum += 2;
  }

  // Folio 15 — Page Fin
  pages.push(renderEndPage(spec));

  // Folio 16 — Back cover
  pages.push(renderBackCoverPage({ story: spec.story, palette: spec.palette, qrSvg: spec.qrSvg }));

  return pages.join('\n');
}

/**
 * Assemble le HTML complet du livre.
 * Squelette : DOCTYPE + html lang fr + head (meta + title + style) + body (16 .page sections).
 * Mitigation Pitfall 3 RESEARCH.md §756 : DOCTYPE en tête, sinon WKWebView rend page blanche.
 *
 * - `spec.scenes` non-null → mode A (picture-book) — strict 6 scènes
 * - `spec.scenes` null → mode B placeholder (Plan 49-04 implémentera fallback ornemental)
 */
export function renderBookHtml(spec: BookHtmlSpec): string {
  const css = renderCss(spec.palette, spec.fonts);
  const pages = spec.scenes ? renderModeAPages(spec) : renderModeBPages(spec);
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
