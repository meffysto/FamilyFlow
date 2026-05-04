import { detectTomeBadge } from '../pdf/saga-detection';
import type { BedtimeStory } from '../types';

const baseStory = (over: Partial<BedtimeStory>): BedtimeStory =>
  ({
    id: 'foret-x',
    titre: 'Histoire X',
    enfant: 'Lucas',
    enfantId: 'lucas',
    univers: 'foret',
    texte: 't',
    date: '2026-05-04',
    duree_lecture: 300,
    voice: { engine: 'expo-speech', language: 'fr' },
    version: 1,
    sourceFile: '09 - Histoires/Lucas/2026-05-04-foret.md',
    ...over,
  }) as BedtimeStory;

describe('detectTomeBadge', () => {
  it('returns null when story has no livreId', () => {
    const s = baseStory({});
    expect(detectTomeBadge(s, [s])).toBeNull();
  });

  it('returns null when story has no chapitre', () => {
    const s = baseStory({ livreId: 'royaume', livreTitre: 'Le Royaume' });
    expect(detectTomeBadge(s, [s])).toBeNull();
  });

  it('returns null when chapitre < 1', () => {
    const s = baseStory({ livreId: 'r', livreTitre: 'R', chapitre: 0 });
    expect(detectTomeBadge(s, [s])).toBeNull();
  });

  it('returns null when allStories is empty', () => {
    const s = baseStory({ livreId: 'r', livreTitre: 'R', chapitre: 1 });
    expect(detectTomeBadge(s, [])).toBeNull();
  });

  it('returns badge with total = max(chapitre) on same livreId', () => {
    const s1 = baseStory({ id: 's1', livreId: 'r', livreTitre: 'Royaume Endormi', chapitre: 1 });
    const s2 = baseStory({ id: 's2', livreId: 'r', livreTitre: 'Royaume Endormi', chapitre: 2 });
    const s3 = baseStory({ id: 's3', livreId: 'r', livreTitre: 'Royaume Endormi', chapitre: 3 });
    expect(detectTomeBadge(s2, [s1, s2, s3])).toEqual({
      current: 2,
      total: 3,
      livreTitre: 'Royaume Endormi',
    });
  });

  it('filters out stories from other livreId', () => {
    const sA = baseStory({ id: 'a', livreId: 'A', chapitre: 1 });
    const sB1 = baseStory({ id: 'b1', livreId: 'B', chapitre: 1 });
    const sB2 = baseStory({ id: 'b2', livreId: 'B', chapitre: 5 });
    const result = detectTomeBadge(sA, [sA, sB1, sB2]);
    expect(result).toEqual({ current: 1, total: 1, livreTitre: 'Histoire X' });
  });

  it('falls back to story.titre when livreTitre absent', () => {
    const s = baseStory({ titre: 'Mon Histoire', livreId: 'x', chapitre: 1 });
    const result = detectTomeBadge(s, [s]);
    expect(result?.livreTitre).toBe('Mon Histoire');
  });

  it('is pure (does not mutate inputs)', () => {
    const s1 = baseStory({ id: 's1', livreId: 'r', chapitre: 1 });
    const s2 = baseStory({ id: 's2', livreId: 'r', chapitre: 2 });
    const arr = [s1, s2];
    const before = JSON.stringify(arr);
    detectTomeBadge(s1, arr);
    expect(JSON.stringify(arr)).toBe(before);
  });
});
