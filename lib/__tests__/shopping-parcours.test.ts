import { computeObservedShoppingOrder } from '../shopping-parcours';
import type { CourseItem } from '../types';

const item = (id: string, section: string): CourseItem => ({
  id,
  text: id,
  completed: false,
  lineIndex: 0,
  section,
});

describe('computeObservedShoppingOrder', () => {
  it('garde les rayons cochés même si tous les items ont été retirés de itemsBySection', () => {
    const order = computeObservedShoppingOrder(
      ['Fruits', 'Frais', 'Épicerie'],
      { Fruits: [], Frais: [], Épicerie: [] },
      [
        { section: 'Frais', checkedAt: 20 },
        { section: 'Fruits', checkedAt: 10 },
        { section: 'Frais', checkedAt: 30 },
      ],
    );

    expect(order).toEqual(['Fruits', 'Frais']);
  });

  it('ajoute en queue les rayons restants non cochés', () => {
    const order = computeObservedShoppingOrder(
      ['Fruits', 'Frais', 'Épicerie'],
      {
        Fruits: [],
        Frais: [],
        Épicerie: [item('pates', 'Épicerie')],
      },
      [{ section: 'Frais', checkedAt: 10 }],
    );

    expect(order).toEqual(['Frais', 'Épicerie']);
  });
});
