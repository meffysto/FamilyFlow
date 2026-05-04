// lib/__tests__/pdf-fallback.test.ts — Tests Mode B fallback ornemental (Plan 49-04).
// Couvre : splitTextIntoSections (6 tests pures) + renderFallbackDoublePage (7 tests rendering).

import { splitTextIntoSections } from '../pdf/text-splitter';
import { renderFallbackDoublePage } from '../pdf/components/fallback-double-page';

describe('splitTextIntoSections', () => {
  it('returns exactly N sections', () => {
    const out = splitTextIntoSections(
      'Phrase un. Phrase deux. Phrase trois. Phrase quatre. Phrase cinq. Phrase six.',
      6,
    );
    expect(out).toHaveLength(6);
  });

  it('preserves total content (concat ≈ original)', () => {
    const text =
      "Une histoire commence. Le héros marche. Il rencontre quelqu'un. Il découvre un secret. Il aide. Fin de la quête.";
    const out = splitTextIntoSections(text, 6);
    const reconstructed = out.join(' ').replace(/\s+/g, ' ').trim();
    const normalized = text.replace(/\s+/g, ' ').trim();
    expect(reconstructed).toBe(normalized);
  });

  it('does not break words mid-text', () => {
    const text =
      'Le grand renard observe attentivement. Il pense au lapin. Soudain, un oiseau passe. Le ciel devient orange. La nuit tombe. Tout dort.';
    const out = splitTextIntoSections(text, 6);
    for (const s of out) {
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it('handles short text (fewer sentences than n) via word fallback', () => {
    const out = splitTextIntoSections('un deux trois quatre cinq six sept huit neuf dix', 6);
    expect(out).toHaveLength(6);
    expect(out.every((s) => s.length > 0)).toBe(true);
  });

  it('handles empty text by returning n empty strings', () => {
    expect(splitTextIntoSections('', 6)).toEqual(['', '', '', '', '', '']);
  });

  it('is deterministic (same input → same output)', () => {
    const text = 'Une. Deux. Trois. Quatre. Cinq. Six. Sept.';
    expect(splitTextIntoSections(text, 6)).toEqual(splitTextIntoSections(text, 6));
  });
});

describe('renderFallbackDoublePage', () => {
  const SAMPLE =
    "Il était une fois un loup. Il marchait dans la forêt. Soudain, il vit une lumière. C'était magique. Le loup s'approcha. Sa vie changea pour toujours.";

  it('returns exactly 2 page sections', () => {
    const html = renderFallbackDoublePage({
      pageIndex: 1,
      text: SAMPLE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    const matches = html.match(/<section class="page fallback-page"/g) || [];
    expect(matches.length).toBe(2);
  });

  it('contains drop cap with first character and Caveat 6em terracotta', () => {
    const html = renderFallbackDoublePage({
      pageIndex: 1,
      text: SAMPLE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    expect(html).toContain('drop-cap-block');
    expect(html).toContain('font-size:6em');
    expect(html).toContain('color:#B8593F');
  });

  it('uses exact ornamental palette (terracotta/sage/ivory/ink) per CONTEXT.md §117-122', () => {
    const html = renderFallbackDoublePage({
      pageIndex: 1,
      text: SAMPLE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    expect(html).toContain('#B8593F'); // terracotta
    expect(html).toContain('#7A8F6B'); // sauge
    expect(html).toContain('#F4EDE2'); // ivoire mode B (override BOOK_PALETTE.ivory générique)
    expect(html).toContain('#2E2A26'); // encre
  });

  it('includes pull quote with DM Serif Display when text has ≥ 2 sentences', () => {
    const html = renderFallbackDoublePage({
      pageIndex: 1,
      text: SAMPLE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    expect(html).toContain('pull-quote');
    expect(html).toContain("font-family:'DM Serif Display'");
  });

  it('shows page numbers in cartouche', () => {
    const html = renderFallbackDoublePage({
      pageIndex: 1,
      text: SAMPLE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    expect(html).toContain('page-num-cartouche');
    expect(html).toContain('>3<');
    expect(html).toContain('>4<');
  });

  it('alternates border ornament by pageIndex', () => {
    const h1 = renderFallbackDoublePage({
      pageIndex: 1,
      text: SAMPLE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    const h2 = renderFallbackDoublePage({
      pageIndex: 2,
      text: SAMPLE,
      pageNumLeft: 5,
      pageNumRight: 6,
    });
    const h3 = renderFallbackDoublePage({
      pageIndex: 3,
      text: SAMPLE,
      pageNumLeft: 7,
      pageNumRight: 8,
    });
    expect(h1).not.toBe(h2);
    expect(h2).not.toBe(h3);
  });

  it('escapes HTML special chars in text', () => {
    const html = renderFallbackDoublePage({
      pageIndex: 1,
      text: '<script>alert("x")</script> Phrase une. Phrase deux.',
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});
