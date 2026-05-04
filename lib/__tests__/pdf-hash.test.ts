// Test déterminisme du hash PDF (PDF-07).
// Le test n'invoque PAS generateBookPdf (qui dépend de expo-print/expo-crypto natifs) :
// il valide la PROPRIÉTÉ déterministe du HTML rendu, qui est l'input du hash SHA-256.
// Combinée à `Crypto.digestStringAsync(SHA256, html)`, cette propriété garantit le déterminisme.
// La validation device viendra Phase 51 wiring (logs perf + ouverture PDF Aperçu macOS).

import { createHash } from 'crypto';
import { renderBookHtml } from '../pdf/html-template';
import { BOOK_PALETTE } from '../pdf/constants';
import type { BedtimeStory, SceneSpec, SceneArchetype } from '../types';

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

const FONTS = { andikaRegular: 'AAAA', andikaBold: 'BBBB' };

const STORY: BedtimeStory = {
  id: 'foret-test',
  titre: 'Le Loup',
  enfant: 'Lucas',
  enfantId: 'lucas',
  univers: 'foret',
  texte: 'x'.repeat(700),
  date: '2026-05-04',
  duree_lecture: 300,
  voice: { engine: 'expo-speech', language: 'fr' },
  version: 1,
  sourceFile: '09 - Histoires/Lucas/2026-05-04-foret.md',
} as BedtimeStory;

const ARCHETYPES: SceneArchetype[] = [
  'paysage',
  'rencontre',
  'decouverte',
  'vulnerable',
  'echange',
  'etreinte',
];

const SCENES: SceneSpec[] = ARCHETYPES.map((a, i) => ({
  panelIndex: i + 1,
  archetype: a,
  textStart: i * 100,
  textEnd: (i + 1) * 100,
  highlights: [],
}));

const ILLUS = new Map<SceneArchetype, string>(
  SCENES.map((s) => [s.archetype, `B64_${s.archetype}`]),
);

describe('PDF hash determinism (PDF-07)', () => {
  it('same input → same HTML → same SHA-256', () => {
    const h1 = renderBookHtml({
      story: STORY,
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const h2 = renderBookHtml({
      story: STORY,
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(h1).toBe(h2);
    expect(sha256(h1)).toBe(sha256(h2));
    expect(sha256(h1)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changing titre changes hash', () => {
    const h1 = renderBookHtml({
      story: STORY,
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const h2 = renderBookHtml({
      story: { ...STORY, titre: 'Le Renard' },
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(sha256(h1)).not.toBe(sha256(h2));
  });

  it('changing scene highlights changes hash', () => {
    const SCENES2: SceneSpec[] = [...SCENES];
    SCENES2[0] = {
      ...SCENES2[0],
      highlights: [{ startChar: 0, endChar: 5, kind: 'keyword' }],
    };
    const h1 = renderBookHtml({
      story: STORY,
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const h2 = renderBookHtml({
      story: STORY,
      scenes: SCENES2,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(sha256(h1)).not.toBe(sha256(h2));
  });

  it('changing tomeBadge changes hash', () => {
    const h1 = renderBookHtml({
      story: STORY,
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    const h2 = renderBookHtml({
      story: STORY,
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: { current: 2, total: 3, livreTitre: 'X' },
    });
    expect(sha256(h1)).not.toBe(sha256(h2));
  });

  it('HTML has no Date.now() / Math.random() residue', () => {
    const h1 = renderBookHtml({
      story: STORY,
      scenes: SCENES,
      illustrations: ILLUS,
      fonts: FONTS,
      palette: BOOK_PALETTE,
      tomeBadge: null,
    });
    expect(h1).not.toMatch(/Date\.now/);
    expect(h1).not.toMatch(/Math\.random/);
  });
});
