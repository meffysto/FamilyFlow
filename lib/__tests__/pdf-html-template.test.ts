// lib/__tests__/pdf-html-template.test.ts — Tests structurels du squelette HTML livre.
// Pure JS / string concat → pas de mock natif requis. Plan 49-01.

import { renderBookHtml, renderCss } from '../pdf/html-template';
import { BOOK_PALETTE } from '../pdf/constants';
import type { BedtimeStory, SceneSpec, SceneArchetype } from '../types';

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

  it('produces 16 pages structure in mode B (Plan 49-04)', () => {
    const html = renderBookHtml({
      story: FAKE_STORY,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const pageMatches = html.match(/<section class="page/g) || [];
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

// ─── Mode A — Picture-book illustré (Plan 49-02) ─────────────────────────────

const ARCHETYPES: SceneArchetype[] = [
  'paysage', 'rencontre', 'decouverte', 'vulnerable', 'echange', 'etreinte',
];

const FAKE_SCENES: SceneSpec[] = ARCHETYPES.map((archetype, i) => ({
  panelIndex: i + 1,
  archetype,
  textStart: i * 100,
  textEnd: (i + 1) * 100,
  highlights: [],
}));

const FAKE_ILLUS = new Map<SceneArchetype, string>([
  ['paysage', 'PAYSAGE_B64'],
  ['rencontre', 'RENCONTRE_B64'],
  ['decouverte', 'DECOUVERTE_B64'],
  ['vulnerable', 'VULNERABLE_B64'],
  ['echange', 'ECHANGE_B64'],
  ['etreinte', 'ETREINTE_B64'],
]);

const STORY_LONG = { ...FAKE_STORY, texte: 'x'.repeat(700) };

describe('renderBookHtml mode A (6 scenes)', () => {
  it('produces exactly 16 page sections', () => {
    const html = renderBookHtml({
      story: STORY_LONG,
      scenes: FAKE_SCENES,
      illustrations: FAKE_ILLUS,
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const matches = html.match(/<section class="page/g) || [];
    expect(matches.length).toBe(16);
  });

  it('cover uses paysage illustration full-bleed', () => {
    const html = renderBookHtml({
      story: STORY_LONG,
      scenes: FAKE_SCENES,
      illustrations: FAKE_ILLUS,
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html).toContain('data:image/png;base64,PAYSAGE_B64');
    expect(html).toMatch(/class="page cover"/);
  });

  it('title page shows tome badge when tomeBadge provided', () => {
    const html = renderBookHtml({
      story: STORY_LONG,
      scenes: FAKE_SCENES,
      illustrations: FAKE_ILLUS,
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: { current: 2, total: 3, livreTitre: 'Le Royaume Endormi' },
    });
    expect(html).toContain('Tome 2 sur 3');
    expect(html).toContain('Le Royaume Endormi');
  });

  it('title page omits tome badge when null', () => {
    const html = renderBookHtml({
      story: STORY_LONG,
      scenes: FAKE_SCENES,
      illustrations: FAKE_ILLUS,
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html).not.toMatch(/Tome\s+\d+\s+sur/);
  });

  it('renders 6 scene double-pages with their archetypes', () => {
    const html = renderBookHtml({
      story: STORY_LONG,
      scenes: FAKE_SCENES,
      illustrations: FAKE_ILLUS,
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    for (const arche of ARCHETYPES) {
      expect(html).toContain(`data-archetype="${arche}"`);
    }
  });

  it('back cover contains QR placeholder + FamilyVault label', () => {
    const html = renderBookHtml({
      story: STORY_LONG,
      scenes: FAKE_SCENES,
      illustrations: FAKE_ILLUS,
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html).toContain('data-phase50');
    expect(html).toContain('FamilyVault');
  });

  it('throws on scenes.length !== 6 (strict per CONTEXT D-Q2)', () => {
    expect(() => renderBookHtml({
      story: STORY_LONG,
      scenes: FAKE_SCENES.slice(0, 5),
      illustrations: FAKE_ILLUS,
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    })).toThrow(/exactement 6 scènes/);
  });

  it('mode B fallback when scenes null (Plan 49-04 — drop caps + ornements)', () => {
    const html = renderBookHtml({
      story: FAKE_STORY,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html).toContain('data-mode="fallback"');
  });
});

// ─── Mode B — Fallback texte-seul ornemental (Plan 49-04) ───────────────────

describe('renderBookHtml mode B (fallback, no scenes)', () => {
  const STORY_LONG_TEXT = {
    ...FAKE_STORY,
    texte:
      'Il était une fois. Le héros marche. Il rencontre. Il découvre. Il aide. Il revient. '.repeat(
        10,
      ),
  };

  it('produces exactly 16 page sections', () => {
    const html = renderBookHtml({
      story: STORY_LONG_TEXT,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const matches = html.match(/<section class="page/g) || [];
    expect(matches.length).toBe(16);
  });

  it('contains 12 fallback page sections (6 doubles-pages × 2)', () => {
    const html = renderBookHtml({
      story: STORY_LONG_TEXT,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const fallbackMatches = html.match(/class="page fallback-page"/g) || [];
    expect(fallbackMatches.length).toBe(12);
  });

  it('uses ornamental palette (terracotta + sage + ivoire mode B + encre)', () => {
    const html = renderBookHtml({
      story: STORY_LONG_TEXT,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html).toContain('#B8593F'); // terracotta
    expect(html).toContain('#7A8F6B'); // sauge
    expect(html).toContain('#F4EDE2'); // ivoire ornemental (override en mode B)
    expect(html).toContain('#2E2A26'); // encre
  });

  it('contains exactly 6 drop-cap-block (one per fallback double-page)', () => {
    const html = renderBookHtml({
      story: STORY_LONG_TEXT,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html.match(/drop-cap-block/g)?.length).toBe(6);
  });

  it('does not produce empty placeholder stubs anymore (Plan 49-04 replaces)', () => {
    const html = renderBookHtml({
      story: STORY_LONG_TEXT,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    // Le stub vide ressemblait à : <section class="page" data-mode="fallback" data-page-index="N">
    // Le rendu réel utilise class="page fallback-page" data-page-index="X-left|right"
    expect(html).not.toMatch(/<section class="page" data-mode="fallback" data-page-index="\d+"/);
  });

  it('mode A still works after Plan 49-04 (regression — no drop cap in mode A)', () => {
    const SCENES: SceneSpec[] = (
      ['paysage', 'rencontre', 'decouverte', 'vulnerable', 'echange', 'etreinte'] as SceneArchetype[]
    ).map((a, i) => ({
      panelIndex: i + 1,
      archetype: a,
      textStart: i * 10,
      textEnd: (i + 1) * 10,
      highlights: [],
    }));
    const ILLUS = new Map<SceneArchetype, string>(
      SCENES.map((s) => [s.archetype, `B64_${s.archetype}`]),
    );
    const html = renderBookHtml({
      story: { ...FAKE_STORY, texte: 'x'.repeat(700) },
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(html).toContain('data-archetype="paysage"');
    expect(html).not.toContain('drop-cap-block');
  });

  it('passes tomeBadge to title page in mode B (saga wiring)', () => {
    const html = renderBookHtml({
      story: STORY_LONG_TEXT,
      scenes: null,
      illustrations: new Map(),
      fonts: FAKE_FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: { current: 2, total: 4, livreTitre: 'La Saga des Loups' },
    });
    expect(html).toContain('Tome 2 sur 4');
    expect(html).toContain('La Saga des Loups');
  });
});
