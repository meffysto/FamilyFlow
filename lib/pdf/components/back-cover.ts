// lib/pdf/components/back-cover.ts — Folio 16 mode A picture-book (Plan 49-02).
// 4ème de couverture : résumé + QR code scannable (Phase 50 QR-04) + label FamilyVault.

import type { BedtimeStory } from '../../types';
import type { BookPalette } from '../types';
import { escapeHtml } from '../html-template';

export interface BackCoverOpts {
  story: BedtimeStory;
  palette: BookPalette;
  /** SVG QR inline généré par `lib/pdf/qr-generator.ts` (Phase 50, QR-04). */
  qrSvg: string;
}

/**
 * Rend une UNIQUE `<section class="page back-cover">`.
 * - Résumé court : `memorySummary` tronqué 280 chars, ou texte par défaut
 * - QR code 3×3cm scannable (Phase 50 QR-04) → `family-vault://story/<id>`
 * - Légende FR « Scanne pour écouter l'histoire » sous le QR
 * - Label "FamilyVault — Histoires du soir" en Caveat terracotta
 *
 * ⚠️ `qrSvg` est injecté tel quel (sans escapeHtml) — c'est du SVG inline interprété
 * par WKWebView, pas du texte utilisateur.
 */
export function renderBackCoverPage(opts: BackCoverOpts): string {
  const { story, palette, qrSvg } = opts;
  const summary = (story.memorySummary && story.memorySummary.trim().length > 0)
    ? truncate(story.memorySummary, 280)
    : 'Une histoire du soir, à relire ensemble, encore et encore.';

  return `<section class="page back-cover">
    <div class="safe-area" style="display:flex; flex-direction:column; justify-content:space-between;">
      <div class="back-summary" style="font-family:'Andika', serif; font-size:13pt; line-height:1.55; color:${palette.ink}; padding:2cm 1cm 0 1cm; text-align:center;">${escapeHtml(summary)}</div>
      <div style="display:flex; flex-direction:column; align-items:center; padding-bottom:1cm;">
        <div class="qr-block" style="width:3cm; height:3cm; margin-bottom:0.4cm; display:flex; align-items:center; justify-content:center;">${qrSvg}</div>
        <div class="qr-legend" style="font-family:'Caveat', cursive; font-size:11pt; color:${palette.sage}; margin-bottom:0.6cm; text-align:center;">Scanne pour écouter l'histoire</div>
        <div style="font-family:'Caveat', cursive; font-size:14pt; color:${palette.terracotta};">FamilyVault — Histoires du soir</div>
      </div>
    </div>
  </section>`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
