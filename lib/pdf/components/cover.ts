// lib/pdf/components/cover.ts — Folio 1 mode A picture-book (Plan 49-02).
// Couverture full-bleed avec illustration paysage + overlay titre + univers.

import type { BedtimeStory } from '../../types';
import type { BookPalette } from '../types';
import { escapeHtml } from '../html-template';

export interface CoverPageOpts {
  story: BedtimeStory;
  /** Illustration paysage base64 (mode A). null si univers non-illustré → fallback paperShadow. */
  coverImageBase64: string | null;
  palette: BookPalette;
}

/**
 * Rend une UNIQUE `<section class="page cover">`.
 * - Si `coverImageBase64` fourni : `<img class="full-bleed">` avec data: URL
 * - Sinon : bloc plein paperShadow (cover reste visuellement valide)
 * - Overlay : titre 48pt DM Serif Display ivoire ombré + univers Caveat 22pt
 * - Toutes les chaînes user passent par escapeHtml.
 */
export function renderCoverPage(opts: CoverPageOpts): string {
  const { story, coverImageBase64, palette } = opts;
  const universLabel = capitalizeFirst(story.univers);

  const fullBleedImg = coverImageBase64
    ? `<img class="full-bleed scene-illustration" src="data:image/jpeg;base64,${coverImageBase64}" alt="" />`
    : `<div class="full-bleed" style="background:${palette.paperShadow};"></div>`;

  return `<section class="page cover">
    ${fullBleedImg}
    <div class="cover-overlay" style="position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end; padding:1.5cm;">
      <h1 class="cover-title" style="font-family:'DM Serif Display', serif; font-size:48pt; color:${palette.ivory}; text-shadow:0 2px 8px rgba(0,0,0,0.6); line-height:1.05; margin-bottom:0.3cm;">${escapeHtml(story.titre)}</h1>
      <div class="cover-univers" style="font-family:'Caveat', cursive; font-size:22pt; color:${palette.ivory}; opacity:0.9;">${escapeHtml(universLabel)}</div>
    </div>
  </section>`;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
