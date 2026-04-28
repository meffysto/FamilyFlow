/**
 * Tests parseVoiceCourses — segmentation transcript vocal en items courses.
 *
 * Cas critique : Apple Speech-to-Text n'insère pas toujours de virgule entre items
 * dictés. Le parser doit alors compenser via split sur déterminants (du/de la/des).
 */

import { parseVoiceCourses } from '../parse-voice-courses';

jest.mock('../cooklang', () => ({
  categorizeIngredient: () => '',
}));

describe('parseVoiceCourses', () => {
  it('renvoie [] sur transcript vide', () => {
    expect(parseVoiceCourses('')).toEqual([]);
    expect(parseVoiceCourses('   ')).toEqual([]);
  });

  it('split sur "et" et virgules (cas nominal)', () => {
    const items = parseVoiceCourses('3 pommes, du lait et 2 paquets de pates');
    expect(items.map(i => i.name)).toEqual(['pommes', 'lait', 'pates']);
    expect(items[0].quantity).toBe(3);
    expect(items[2].quantity).toBe(2);
  });

  it('split sur déterminant inline quand STT omet la virgule (régression réelle)', () => {
    // Apple Speech a transcrit sans virgule après "pommes"
    const items = parseVoiceCourses('3 pommes du lait et 2 paquets de pates');
    expect(items.map(i => i.name)).toEqual(['pommes', 'lait', 'pates']);
    expect(items[0].quantity).toBe(3);
    expect(items[1].quantity).toBeNull();
    expect(items[2].quantity).toBe(2);
  });

  it('ne casse pas "500g de farine" (le "de" seul ne déclenche pas de split)', () => {
    const items = parseVoiceCourses('500g de farine');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('farine');
    expect(items[0].quantity).toBe(500);
  });

  it('ne casse pas "2 paquets de pates" (idem)', () => {
    const items = parseVoiceCourses('2 paquets de pates');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('pates');
  });

  it('résout les nombres en lettres', () => {
    const items = parseVoiceCourses('cinq oeufs et trois tomates');
    expect(items).toHaveLength(2);
    expect(items[0].quantity).toBe(5);
    expect(items[1].quantity).toBe(3);
  });

  it('split inline qty+unit sur segments collés', () => {
    const items = parseVoiceCourses('une quiche 500g de farine');
    expect(items.map(i => i.name)).toEqual(['quiche', 'farine']);
  });

  it('combine split déterminant + split sur "et"', () => {
    const items = parseVoiceCourses('du pain du fromage et des oeufs');
    expect(items.map(i => i.name)).toEqual(['pain', 'fromage', 'oeufs']);
  });
});
