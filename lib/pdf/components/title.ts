// lib/pdf/components/title.ts — Folio 2 mode A picture-book (Plan 49-02).
// Page de titre : titre + dédicace + date FR + badge tome conditionnel.

import type { BedtimeStory } from '../../types';
import type { BookPalette } from '../types';
import { escapeHtml } from '../html-template';
import { separatorTriple } from '../ornaments';

export interface TitlePageOpts {
  story: BedtimeStory;
  palette: BookPalette;
  /** Badge saga si l'histoire fait partie d'un livre multi-tome. null sinon. */
  tomeBadge: { current: number; total: number; livreTitre: string } | null;
}

/**
 * Rend une UNIQUE `<section class="page title-page">`.
 * - Séparateur ornemental triple (terracotta puis sauge en bas)
 * - Titre principal DM Serif Display 42pt
 * - "Pour {enfant}" Caveat 22pt
 * - Date FR JJ/MM/AAAA Andika 12pt opacity 0.7
 * - Si tomeBadge non null : "Tome X sur Y du livre {livreTitre}" (Caveat italic 18pt terracotta)
 */
export function renderTitlePage(opts: TitlePageOpts): string {
  const { story, palette, tomeBadge } = opts;
  const dateFr = formatDateFr(story.date);
  const tomeBlock = tomeBadge
    ? `<div class="tome-badge" style="font-family:'Caveat', cursive; font-style:italic; font-size:18pt; color:${palette.terracotta}; margin-top:1.5cm;">Tome ${tomeBadge.current} sur ${tomeBadge.total} du livre ${escapeHtml(tomeBadge.livreTitre)}</div>`
    : '';

  return `<section class="page title-page">
    <div class="safe-area" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
      <div style="margin-bottom:1cm;">${separatorTriple({ color: palette.terracotta, size: 28 })}</div>
      <h1 style="font-family:'DM Serif Display', serif; font-size:42pt; color:${palette.ink}; line-height:1.1; margin-bottom:0.8cm;">${escapeHtml(story.titre)}</h1>
      <div style="font-family:'Caveat', cursive; font-size:22pt; color:${palette.ink};">Pour ${escapeHtml(story.enfant)}</div>
      <div style="font-family:'Andika', serif; font-size:12pt; color:${palette.ink}; opacity:0.7; margin-top:0.6cm;">${escapeHtml(dateFr)}</div>
      ${tomeBlock}
      <div style="margin-top:2cm;">${separatorTriple({ color: palette.sage, size: 22 })}</div>
    </div>
  </section>`;
}

/** YYYY-MM-DD → JJ/MM/AAAA (CLAUDE.md convention). */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
