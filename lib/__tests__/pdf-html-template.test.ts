// lib/__tests__/pdf-html-template.test.ts — Tests structurels du squelette HTML livre.
// Pure JS / string concat → pas de mock natif requis. Plan 49-01.

import { renderBookHtml, renderCss } from '../pdf/html-template';
import { BOOK_PALETTE } from '../pdf/constants';
import type { BedtimeStory } from '../types';

const FAKE_FONTS = { andikaRegular: 'AAAA', andikaBold: 'BBBB' };

const FAKE_STORY: BedtimeStory = {
  id: 'foret-test',
  titre: "Le Loup d'Argent",
  enfant: 'Lucas',
  enfantId: 'lucas',
  univers: 'foret',
  texte: 'Il était une fois...',
  date: '2026-05-04',
  duree_lecture: 300,
  voice: { engine: 'expo-speech', language: 'fr' },
  version: 1,
  sourceFile: '09 - Histoires/Lucas/2026-05-04-foret.md',
};

describe('renderCss', () => {
  it('contains @page 21.64cm with margin 0', () => {
    const css = renderCss(BOOK_PALETTE, FAKE_FONTS);
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*21\.64cm\s+21\.64cm/);
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*0/);
  });

  it('contains two @font-face Andika base64 truetype', () => {
    const css = renderCss(BOOK_PALETTE, FAKE_FONTS);
    const matches = css.match(/@font-face/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(css).toContain('data:font/ttf;base64,AAAA');
    expect(css).toContain('data:font/ttf;base64,BBBB');
    expect(css).toContain("format('truetype')");
  });

  it('uses unified Andika font-family alias (not -Regular/-Bold)', () => {
    const css = renderCss(BOOK_PALETTE, FAKE_FONTS);
    expect(css).toMatch(/font-family:\s*'Andika'/);
    expect(css).not.toMatch(/font-family:\s*'Andika-Regular'/);
  });

  it('injects palette ivory and ink', () => {
    const css = renderCss(BOOK_PALETTE, FAKE_FONTS);
    expect(css).toContain(BOOK_PALETTE.ivory);
    expect(css).toContain(BOOK_PALETTE.ink);
  });

  it('contains page-break-after auto on last child (Pitfall 3)', () => {
    const css = renderCss(BOOK_PALETTE, FAKE_FONTS);
    expect(css).toMatch(/\.page:last-child[^{]*\{[^}]*page-break-after:\s*auto/);
  });
});

describe('renderBookHtml', () => {
  it('starts with <!DOCTYPE html> (Pitfall 3 mitigation)', () => {
    const html = renderBookHtml({
      story: FAKE_STORY,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('places <style> in <head> before <body>', () => {
    const html = renderBookHtml({
      story: FAKE_STORY,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const styleIdx = html.indexOf('<style>');
    const bodyIdx = html.indexOf('<body>');
    expect(styleIdx).toBeGreaterThan(0);
    expect(bodyIdx).toBeGreaterThan(styleIdx);
  });

  it('produces stub 16 pages structure (Plan 49-02 will refine)', () => {
    const html = renderBookHtml({
      story: FAKE_STORY,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const pageMatches = html.match(/<section class="page"/g) || [];
    expect(pageMatches.length).toBe(16);
  });

  it('escapes story title HTML special chars', () => {
    const story = { ...FAKE_STORY, titre: '<script>&"alert"' };
    const html = renderBookHtml({
      story,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
