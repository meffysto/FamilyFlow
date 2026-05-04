// lib/__tests__/pdf-scene-double-page.test.ts — tests dédiés au composant
// scene-double-page (Plan 49-02). Couverture isolée, indépendamment du test
// d'intégration `pdf-html-template.test.ts`.

import { renderSceneDoublePage } from '../pdf/components/scene-double-page';
import { BOOK_PALETTE } from '../pdf/constants';
import type { BedtimeStory, SceneSpec } from '../types';

const FAKE_STORY: BedtimeStory = {
  id: 'foret-test',
  titre: 'Le Loup',
  enfant: 'Lucas',
  enfantId: 'lucas',
  univers: 'foret',
  texte:
    "Il était une fois un loup. Il rencontra un renard. Ensemble, ils découvrirent une clairière. Soudain, un orage éclata. Ils s'entraidèrent. Ils rentrèrent à la maison.",
  date: '2026-05-04',
  duree_lecture: 300,
  voice: { engine: 'expo-speech', language: 'fr' },
  version: 1,
  sourceFile: '09 - Histoires/Lucas/2026-05-04-foret.md',
};

const SCENE_PAYSAGE: SceneSpec = {
  panelIndex: 1,
  archetype: 'paysage',
  textStart: 0,
  textEnd: 30,
  highlights: [],
};

describe('renderSceneDoublePage', () => {
  it('produces exactly 2 page sections (gauche illustration + droite texte)', () => {
    const html = renderSceneDoublePage({
      scene: SCENE_PAYSAGE,
      story: FAKE_STORY,
      illustrationBase64: 'PAYSAGE_B64',
      palette: BOOK_PALETTE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    const matches = html.match(/<section class="page/g) || [];
    expect(matches.length).toBe(2);
    expect(html).toContain('scene-illustration-page');
    expect(html).toContain('scene-text-page');
  });

  it('slices texte exactement entre textStart et textEnd', () => {
    const scene: SceneSpec = {
      panelIndex: 2,
      archetype: 'rencontre',
      textStart: 27,
      textEnd: 51,
      highlights: [],
    };
    const html = renderSceneDoublePage({
      scene,
      story: FAKE_STORY,
      illustrationBase64: 'RENCONTRE_B64',
      palette: BOOK_PALETTE,
      pageNumLeft: 5,
      pageNumRight: 6,
    });
    const expected = FAKE_STORY.texte.slice(27, 51);
    expect(html).toContain(expected);
    // Ne doit PAS contenir le début (slice 0..30)
    expect(html).not.toContain('Il était une fois un loup');
  });

  it('rend les highlights teal #0F8B8D avec font-weight bold', () => {
    const scene: SceneSpec = {
      panelIndex: 3,
      archetype: 'decouverte',
      textStart: 0,
      textEnd: 30,
      highlights: [{ startChar: 16, endChar: 20, kind: 'keyword' as const }],
    };
    const html = renderSceneDoublePage({
      scene,
      story: FAKE_STORY,
      illustrationBase64: 'DECOUVERTE_B64',
      palette: BOOK_PALETTE,
      pageNumLeft: 7,
      pageNumRight: 8,
    });
    expect(html).toContain('class="highlight"');
    expect(html).toContain('#0F8B8D');
    expect(html).toContain('font-weight:700');
  });

  it("utilise paperShadow comme fallback si pas d'illustration (univers non-forêt)", () => {
    const html = renderSceneDoublePage({
      scene: SCENE_PAYSAGE,
      story: FAKE_STORY,
      illustrationBase64: null,
      palette: BOOK_PALETTE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    expect(html).toContain(BOOK_PALETTE.paperShadow); // #E8E0D0
    expect(html).not.toContain('data:image/png;base64');
  });

  it('injecte data-archetype sur les 2 pages', () => {
    const html = renderSceneDoublePage({
      scene: { ...SCENE_PAYSAGE, archetype: 'etreinte' },
      story: FAKE_STORY,
      illustrationBase64: 'ETREINTE_B64',
      palette: BOOK_PALETTE,
      pageNumLeft: 13,
      pageNumRight: 14,
    });
    const archetypeMatches = html.match(/data-archetype="etreinte"/g) || [];
    expect(archetypeMatches.length).toBe(2); // un par page de la double-page
  });

  it('place numéro page gauche à gauche et droit à droite', () => {
    const html = renderSceneDoublePage({
      scene: SCENE_PAYSAGE,
      story: FAKE_STORY,
      illustrationBase64: 'PAYSAGE_B64',
      palette: BOOK_PALETTE,
      pageNumLeft: 9,
      pageNumRight: 10,
    });
    expect(html).toContain('page-num left');
    expect(html).toContain('page-num right');
    expect(html).toContain('>9<');
    expect(html).toContain('>10<');
  });

  it('ignore highlights dégénérés (endChar <= startChar) sans crash', () => {
    const scene: SceneSpec = {
      panelIndex: 1,
      archetype: 'paysage',
      textStart: 0,
      textEnd: 30,
      highlights: [{ startChar: 10, endChar: 5, kind: 'keyword' as const }],
    };
    const html = renderSceneDoublePage({
      scene,
      story: FAKE_STORY,
      illustrationBase64: null,
      palette: BOOK_PALETTE,
      pageNumLeft: 3,
      pageNumRight: 4,
    });
    expect(html).not.toContain('class="highlight"');
  });
});
