/**
 * courses-prices.test.ts — Tests pour parseCanonical, extractQuantityFromLabel,
 * priceFromMatches et getLastPriceFor (algo 2 passes + ordre de grandeur).
 */

import {
  parseCanonical,
  extractQuantityFromLabel,
  priceFromMatches,
  getLastPriceFor,
  getPurchasedPriceForNextTime,
  formatTotalEstimate,
} from '../courses-prices';
import type { BudgetEntry } from '../types';

// ─── parseCanonical ──────────────────────────────────────────────────────────

describe('parseCanonical', () => {
  it('singularise et strip quantité leading', () => {
    expect(parseCanonical('2 yaourts nature')).toEqual(['yaourt', 'nature']);
  });

  it('strip unités et articles ("500g de farine")', () => {
    expect(parseCanonical('500g de farine')).toEqual(['farine']);
  });

  it('singularise -eaux → -eau', () => {
    expect(parseCanonical('poireaux bio')).toEqual(['poireau', 'bio']);
  });

  it('strip "boites de" et singularise', () => {
    expect(parseCanonical('3 boites de thon')).toEqual(['thon']);
  });

  it('respecte les invariants ("pates" reste "pates")', () => {
    expect(parseCanonical('pates')).toEqual(['pates']);
  });

  it('singularise -aux → -al ("chevaux" → "cheval")', () => {
    expect(parseCanonical('chevaux')).toEqual(['cheval']);
  });

  it('"pois chiches" → ["pois", "chiche"] (pois invariant, chiches singulier)', () => {
    expect(parseCanonical('pois chiches')).toEqual(['pois', 'chiche']);
  });

  it('chaîne vide → tableau vide', () => {
    expect(parseCanonical('')).toEqual([]);
  });
});

// ─── extractQuantityFromLabel ────────────────────────────────────────────────

describe('extractQuantityFromLabel', () => {
  it('détecte "6x125g" → 6', () => {
    expect(extractQuantityFromLabel('YAOURTS DANONE 6x125g 4.20€')).toBe(6);
  });

  it('détecte "LOT DE 12" → 12', () => {
    expect(extractQuantityFromLabel('OEUFS LOT DE 12')).toBe(12);
  });

  it('détecte "X4" → 4', () => {
    expect(extractQuantityFromLabel('PATES BARILLA X4')).toBe(4);
  });

  it('aucune quantité → 1', () => {
    expect(extractQuantityFromLabel('TOMAT.GRAP.BIO')).toBe(1);
  });

  it('détecte "6X1L" → 6', () => {
    expect(extractQuantityFromLabel('LAIT DEMI ECREM 6X1L')).toBe(6);
  });

  it('détecte "PACK 4" → 4', () => {
    expect(extractQuantityFromLabel('COCA PACK 4')).toBe(4);
  });

  it('label sans pattern → 1', () => {
    expect(extractQuantityFromLabel('PIZZA SURG.')).toBe(1);
  });

  it('chaîne vide → 1', () => {
    expect(extractQuantityFromLabel('')).toBe(1);
  });
});

// ─── priceFromMatches ────────────────────────────────────────────────────────

describe('priceFromMatches', () => {
  it('1 match → ce prix', () => {
    expect(priceFromMatches([{ unitPrice: 1.5, date: '2026-04-01' }])).toBe(1.5);
  });

  it('2 matches → moyenne', () => {
    const r = priceFromMatches([
      { unitPrice: 1.0, date: '2026-04-01' },
      { unitPrice: 2.0, date: '2026-03-01' },
    ]);
    expect(r).toBeCloseTo(1.5, 5);
  });

  it('3 matches avec outlier → médiane (rejette le 50)', () => {
    const r = priceFromMatches([
      { unitPrice: 1, date: '2026-04-01' },
      { unitPrice: 2, date: '2026-03-01' },
      { unitPrice: 50, date: '2026-02-01' },
    ]);
    expect(r).toBe(2);
  });

  it('5 matches → ne garde que les 3 plus récents avant médiane', () => {
    // Les 3 plus récents : 100 (avr), 110 (mar), 120 (fev). Médiane = 110.
    // Les 2 plus anciens (1, 2) sont volontairement bas pour vérifier qu'on les ignore.
    const r = priceFromMatches([
      { unitPrice: 100, date: '2026-04-01' },
      { unitPrice: 110, date: '2026-03-01' },
      { unitPrice: 120, date: '2026-02-01' },
      { unitPrice: 1, date: '2026-01-01' },
      { unitPrice: 2, date: '2025-12-01' },
    ]);
    expect(r).toBe(110);
  });
});

// ─── getLastPriceFor (intégration) ───────────────────────────────────────────

describe('getLastPriceFor', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('matche un yaourt en lot 6× → unitPrice 0.70 (high confidence)', () => {
    const entries: BudgetEntry[] = [
      { date: today, category: '🛒 Courses', amount: 4.2, label: 'YAOURTS DANONE 6x125g', lineIndex: 0 },
    ];
    const r = getLastPriceFor('yaourt', entries);
    expect(r).not.toBeNull();
    expect(r!.confidence).toBe('high');
    expect(r!.price).toBeCloseTo(0.7, 5);
    expect(r!.sampleSize).toBe(1);
  });

  it('matche "tomate" via abréviation TOMAT.GRAP.BIO (qty=1)', () => {
    const entries: BudgetEntry[] = [
      { date: today, category: '🛒 Courses', amount: 3.2, label: 'TOMAT.GRAP.BIO', lineIndex: 0 },
    ];
    const r = getLastPriceFor('tomate', entries);
    expect(r).not.toBeNull();
    expect(r!.price).toBeCloseTo(3.2, 5);
  });

  it('aucun match → null', () => {
    const entries: BudgetEntry[] = [
      { date: today, category: '🛒 Courses', amount: 3.2, label: 'TOMATES BIO', lineIndex: 0 },
    ];
    expect(getLastPriceFor('quinoa rouge', entries)).toBeNull();
  });

  it('catégorie pas "shopping" → ignorée', () => {
    const entries: BudgetEntry[] = [
      { date: today, category: '🎉 Loisirs', amount: 4.2, label: 'YAOURTS DANONE 6x125g', lineIndex: 0 },
    ];
    expect(getLastPriceFor('yaourt', entries)).toBeNull();
  });

  it('catégorie Bébé → matchée (cas HIPP)', () => {
    const entries: BudgetEntry[] = [
      { date: today, category: '👶 Bébé', amount: 12.5, label: 'HIPP3 FLM BIO', lineIndex: 0 },
    ];
    const info = getLastPriceFor('hipp', entries);
    expect(info).not.toBeNull();
    expect(info?.price).toBe(12.5);
  });

  it('catégorie Maison → matchée', () => {
    const entries: BudgetEntry[] = [
      { date: today, category: '🏠 Maison', amount: 5.9, label: 'LESSIVE LIQUIDE 1.5L', lineIndex: 0 },
    ];
    expect(getLastPriceFor('lessive', entries)).not.toBeNull();
  });

  it('plusieurs matches → sampleSize plafonné à 3 et price = médiane des 3 récents', () => {
    const mk = (date: string, amount: number, label: string): BudgetEntry => ({
      date, category: '🛒 Courses', amount, label, lineIndex: 0,
    });
    const entries: BudgetEntry[] = [
      mk('2026-04-15', 0.7, 'YAOURT NATURE'),
      mk('2026-04-10', 0.8, 'YAOURT NATURE'),
      mk('2026-04-05', 0.9, 'YAOURT NATURE'),
      mk('2026-03-01', 5.0, 'YAOURT NATURE'),
    ];
    const r = getLastPriceFor('yaourt', entries);
    expect(r).not.toBeNull();
    expect(r!.sampleSize).toBe(3);
    expect(r!.price).toBeCloseTo(0.8, 5); // médiane de {0.7, 0.8, 0.9}
  });
});

// ─── getPurchasedPriceForNextTime ───────────────────────────────────────────

describe('getPurchasedPriceForNextTime', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('retourne le prix budget réel sans être masqué par le pricebook manuel approximatif', () => {
    const entries: BudgetEntry[] = [
      { date: today, category: '🛒 Courses', amount: 2.4, label: 'PAIN CAMPAGNE', lineIndex: 0 },
    ];

    expect(getPurchasedPriceForNextTime('pain', entries)).toBeCloseTo(2.4, 5);
  });

  it('retourne null si aucun prix budget ne matche', () => {
    const entries: BudgetEntry[] = [
      { date: today, category: '🎉 Loisirs', amount: 2.4, label: 'PAIN CAMPAGNE', lineIndex: 0 },
    ];

    expect(getPurchasedPriceForNextTime('pain', entries)).toBeNull();
  });
});

// ─── formatTotalEstimate ─────────────────────────────────────────────────────

describe('formatTotalEstimate', () => {
  it('arrondit et préfixe ≈', () => {
    expect(formatTotalEstimate(85.49)).toBe('≈ 85 €');
    expect(formatTotalEstimate(85.5)).toBe('≈ 86 €');
    expect(formatTotalEstimate(0)).toBe('≈ 0 €');
  });
});
