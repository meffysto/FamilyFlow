/**
 * grade-engine.test.ts — Tests du moteur de grades de récolte (Phase A)
 *
 * Couvre :
 *  - rollHarvestGrade avec RNG déterministe (limites 0.69/0.70/0.89/0.90/0.97/0.98/0.999)
 *  - Distribution statistique sur 10 000 rolls (Math.random) avec tolérance ±2%
 *  - getGradeMultiplier : ×1 / ×1.5 / ×2.5 / ×4
 *  - getGradeLabelKey : clé i18n `farm.grade.*`
 *  - getGradeEmoji : emoji attendu
 */

import {
  rollHarvestGrade,
  getGradeMultiplier,
  getGradeLabelKey,
  getGradeEmoji,
  GRADE_MULTIPLIERS,
  GRADE_THRESHOLDS,
  type HarvestGrade,
} from '../mascot/grade-engine';

describe('grade-engine — rollHarvestGrade (RNG déterministe)', () => {
  it('rng=0.00 → ordinaire', () => {
    expect(rollHarvestGrade(() => 0.0)).toBe('ordinaire');
  });

  it('rng=0.69 → ordinaire (borne haute ordinaire)', () => {
    expect(rollHarvestGrade(() => 0.69)).toBe('ordinaire');
  });

  it('rng=0.70 → beau (borne basse beau)', () => {
    expect(rollHarvestGrade(() => 0.7)).toBe('beau');
  });

  it('rng=0.89 → beau (borne haute beau)', () => {
    expect(rollHarvestGrade(() => 0.89)).toBe('beau');
  });

  it('rng=0.90 → superbe (borne basse superbe)', () => {
    expect(rollHarvestGrade(() => 0.9)).toBe('superbe');
  });

  it('rng=0.97 → superbe (borne haute superbe)', () => {
    expect(rollHarvestGrade(() => 0.97)).toBe('superbe');
  });

  it('rng=0.98 → parfait (borne basse parfait)', () => {
    expect(rollHarvestGrade(() => 0.98)).toBe('parfait');
  });

  it('rng=0.999 → parfait (borne très haute)', () => {
    expect(rollHarvestGrade(() => 0.999)).toBe('parfait');
  });

  it('fallback rng=1.0 → parfait', () => {
    expect(rollHarvestGrade(() => 1.0)).toBe('parfait');
  });
});

describe('grade-engine — distribution statistique (10 000 rolls)', () => {
  it('respecte les probas 70/20/8/2 avec tolérance ±2%', () => {
    const counts: Record<HarvestGrade, number> = {
      ordinaire: 0,
      beau: 0,
      superbe: 0,
      parfait: 0,
    };
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const g = rollHarvestGrade();
      counts[g]++;
    }
    const pct = (n: number) => (n / N) * 100;
    expect(pct(counts.ordinaire)).toBeGreaterThanOrEqual(68);
    expect(pct(counts.ordinaire)).toBeLessThanOrEqual(72);
    expect(pct(counts.beau)).toBeGreaterThanOrEqual(18);
    expect(pct(counts.beau)).toBeLessThanOrEqual(22);
    expect(pct(counts.superbe)).toBeGreaterThanOrEqual(6);
    expect(pct(counts.superbe)).toBeLessThanOrEqual(10);
    expect(pct(counts.parfait)).toBeGreaterThanOrEqual(1);
    expect(pct(counts.parfait)).toBeLessThanOrEqual(3);
  });
});

describe('grade-engine — getGradeMultiplier', () => {
  it('ordinaire → ×1', () => {
    expect(getGradeMultiplier('ordinaire')).toBe(1);
  });
  it('beau → ×1.5', () => {
    expect(getGradeMultiplier('beau')).toBe(1.5);
  });
  it('superbe → ×2.5', () => {
    expect(getGradeMultiplier('superbe')).toBe(2.5);
  });
  it('parfait → ×4', () => {
    expect(getGradeMultiplier('parfait')).toBe(4);
  });

  it('table GRADE_MULTIPLIERS cohérente', () => {
    expect(GRADE_MULTIPLIERS.ordinaire).toBe(1);
    expect(GRADE_MULTIPLIERS.beau).toBe(1.5);
    expect(GRADE_MULTIPLIERS.superbe).toBe(2.5);
    expect(GRADE_MULTIPLIERS.parfait).toBe(4);
  });
});

describe('grade-engine — getGradeLabelKey / getGradeEmoji', () => {
  it('getGradeLabelKey retourne la clé i18n `farm.grade.*`', () => {
    expect(getGradeLabelKey('ordinaire')).toBe('farm.grade.ordinaire');
    expect(getGradeLabelKey('beau')).toBe('farm.grade.beau');
    expect(getGradeLabelKey('superbe')).toBe('farm.grade.superbe');
    expect(getGradeLabelKey('parfait')).toBe('farm.grade.parfait');
  });

  it('getGradeEmoji retourne un emoji non vide pour chaque grade', () => {
    const grades: HarvestGrade[] = ['ordinaire', 'beau', 'superbe', 'parfait'];
    for (const g of grades) {
      const emoji = getGradeEmoji(g);
      expect(typeof emoji).toBe('string');
      expect(emoji.length).toBeGreaterThan(0);
    }
  });
});

describe('grade-engine — GRADE_THRESHOLDS', () => {
  it('seuils cumulatifs cohérents (somme = 1.0)', () => {
    const lastUpper = GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1][1];
    expect(lastUpper).toBe(1.0);
  });

  it('seuils ordonnés croissants', () => {
    for (let i = 1; i < GRADE_THRESHOLDS.length; i++) {
      expect(GRADE_THRESHOLDS[i][1]).toBeGreaterThan(GRADE_THRESHOLDS[i - 1][1]);
    }
  });
});

describe('tech-engine — noeud culture-5', () => {
  it('TECH_TREE contient culture-5 avec cost 10000 et requires culture-4', () => {
    const { TECH_TREE } = require('../mascot/tech-engine');
    const node = TECH_TREE.find((n: any) => n.id === 'culture-5');
    expect(node).toBeDefined();
    expect(node.branch).toBe('culture');
    expect(node.order).toBe(5);
    expect(node.cost).toBe(10000);
    expect(node.requires).toBe('culture-4');
    expect(node.labelKey).toBe('tech.culture-5');
    expect(node.descriptionKey).toBe('tech.culture-5_desc');
    expect(typeof node.emoji).toBe('string');
    expect(node.emoji.length).toBeGreaterThan(0);
  });
});
