/**
 * budget.test.ts — Tests unitaires pour lib/budget.ts
 * Couvre : parseBudgetConfig, parseBudgetMonth, serializeBudgetMonth, helpers
 */

import {
  parseBudgetConfig,
  parseBudgetMonth,
  serializeBudgetMonth,
  serializeBudgetEntry,
  formatAmount,
  sumByCategory,
  totalSpent,
  totalBudget,
  DEFAULT_BUDGET_CONFIG,
  type BudgetEntry,
} from '../budget';

// ─── parseBudgetConfig ───────────────────────────────────────────────────────

describe('parseBudgetConfig', () => {
  it('parse les catégories avec emoji, nom et limite', () => {
    const content = `## Catégories\n- 🛒 Courses: 600\n- 👶 Bébé: 200\n`;
    const result = parseBudgetConfig(content);
    expect(result.categories).toHaveLength(2);
    expect(result.categories[0]).toEqual({ emoji: '🛒', name: 'Courses', limit: 600 });
    expect(result.categories[1]).toEqual({ emoji: '👶', name: 'Bébé', limit: 200 });
  });

  it('parse les limites avec décimale (virgule → point)', () => {
    const content = `## Catégories\n- 🏠 Maison: 150,50\n`;
    const result = parseBudgetConfig(content);
    expect(result.categories[0].limit).toBe(150.5);
  });

  it('retourne la config par défaut si le contenu est vide', () => {
    const result = parseBudgetConfig('');
    expect(result.categories).toEqual(DEFAULT_BUDGET_CONFIG.categories);
  });

  it('retourne la config par défaut si aucune section Catégories', () => {
    const result = parseBudgetConfig('# Budget\n\nPas de catégories ici.\n');
    expect(result.categories).toEqual(DEFAULT_BUDGET_CONFIG.categories);
  });

  it('ignore les lignes après une autre section ##', () => {
    const content = `## Catégories\n- 🛒 Courses: 600\n## Autres\n- 💰 Extra: 999\n`;
    const result = parseBudgetConfig(content);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe('Courses');
  });
});

// ─── parseBudgetMonth ────────────────────────────────────────────────────────

describe('parseBudgetMonth', () => {
  it('parse une entrée standard avec montant positif', () => {
    const content = `- 2026-01-15 | 🛒 Courses | 45.50 | Intermarché\n`;
    const entries = parseBudgetMonth(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-01-15');
    expect(entries[0].category).toBe('🛒 Courses');
    expect(entries[0].amount).toBe(45.5);
    expect(entries[0].label).toBe('Intermarché');
  });

  it('parse les montants avec virgule décimale', () => {
    const content = `- 2026-01-20 | 👶 Bébé | 12,99 | Couches\n`;
    const entries = parseBudgetMonth(content);
    expect(entries[0].amount).toBe(12.99);
  });

  it('stocke le numéro de ligne (lineIndex) correct', () => {
    const content = `# Budget\n\n- 2026-01-01 | 🛒 Courses | 10.00 | Test\n`;
    const entries = parseBudgetMonth(content);
    expect(entries[0].lineIndex).toBe(2);
  });

  it('retourne un tableau vide si aucune entrée', () => {
    const entries = parseBudgetMonth('# Budget — Janvier 2026\n\n## Dépenses\n');
    expect(entries).toHaveLength(0);
  });

  it('parse plusieurs entrées dans le bon ordre', () => {
    const content = [
      '- 2026-01-10 | 🛒 Courses | 50.00 | Lidl',
      '- 2026-01-15 | 🏠 Maison | 30.00 | Leroy Merlin',
      '- 2026-01-20 | 🎉 Loisirs | 20.00 | Cinéma',
    ].join('\n');
    const entries = parseBudgetMonth(content);
    expect(entries).toHaveLength(3);
    expect(entries[1].category).toBe('🏠 Maison');
  });
});

// ─── serializeBudgetMonth ────────────────────────────────────────────────────

describe('serializeBudgetMonth', () => {
  it('génère un fichier markdown valide avec en-tête et dépenses', () => {
    const entries: BudgetEntry[] = [
      { date: '2026-01-15', category: '🛒 Courses', amount: 45.5, label: 'Intermarché', lineIndex: 0 },
    ];
    const result = serializeBudgetMonth('2026-01', entries);
    expect(result).toContain('# Budget — Janvier 2026');
    expect(result).toContain('## Dépenses');
    expect(result).toContain('- 2026-01-15 | 🛒 Courses | 45.50 | Intermarché');
  });

  it('trie les entrées par date ascendante', () => {
    const entries: BudgetEntry[] = [
      { date: '2026-01-20', category: '🛒 Courses', amount: 20.0, label: 'B', lineIndex: 0 },
      { date: '2026-01-05', category: '🛒 Courses', amount: 10.0, label: 'A', lineIndex: 1 },
    ];
    const result = serializeBudgetMonth('2026-01', entries);
    // Filtrer seulement les lignes d'entrée (commencent par "- YYYY")
    const entryLines = result.split('\n').filter(l => /^- \d{4}-/.test(l));
    expect(entryLines[0]).toContain('2026-01-05');
    expect(entryLines[1]).toContain('2026-01-20');
  });

  it('round-trip : parseBudgetMonth(serializeBudgetMonth) preserve les données', () => {
    const original: BudgetEntry[] = [
      { date: '2026-01-15', category: '🛒 Courses', amount: 45.5, label: 'Intermarché', lineIndex: 0 },
      { date: '2026-01-20', category: '👶 Bébé', amount: 12.99, label: 'Couches', lineIndex: 1 },
    ];
    const serialized = serializeBudgetMonth('2026-01', original);
    const parsed = parseBudgetMonth(serialized);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].amount).toBe(45.5);
    expect(parsed[0].category).toBe('🛒 Courses');
    expect(parsed[1].amount).toBe(12.99);
    expect(parsed[1].label).toBe('Couches');
  });

  it('génère les mois en français', () => {
    const result = serializeBudgetMonth('2026-03', []);
    expect(result).toContain('Mars 2026');
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

describe('formatAmount', () => {
  it('formate un nombre décimal en euros français', () => {
    expect(formatAmount(45.5)).toBe('45,50 €');
    expect(formatAmount(100)).toBe('100,00 €');
    expect(formatAmount(0)).toBe('0,00 €');
  });
});

describe('sumByCategory', () => {
  it('additionne les montants pour une catégorie donnée', () => {
    const entries: BudgetEntry[] = [
      { date: '2026-01-01', category: '🛒 Courses', amount: 50, label: 'A', lineIndex: 0 },
      { date: '2026-01-02', category: '🛒 Courses', amount: 30, label: 'B', lineIndex: 1 },
      { date: '2026-01-03', category: '👶 Bébé', amount: 20, label: 'C', lineIndex: 2 },
    ];
    expect(sumByCategory(entries, '🛒 Courses')).toBe(80);
    expect(sumByCategory(entries, '👶 Bébé')).toBe(20);
    expect(sumByCategory(entries, '🏠 Maison')).toBe(0);
  });
});

describe('totalSpent', () => {
  it('calcule le total de toutes les entrées', () => {
    const entries: BudgetEntry[] = [
      { date: '2026-01-01', category: '🛒 Courses', amount: 50, label: 'A', lineIndex: 0 },
      { date: '2026-01-02', category: '👶 Bébé', amount: 30, label: 'B', lineIndex: 1 },
    ];
    expect(totalSpent(entries)).toBe(80);
  });

  it('retourne 0 pour une liste vide', () => {
    expect(totalSpent([])).toBe(0);
  });
});

describe('totalBudget', () => {
  it('additionne les limites de toutes les catégories', () => {
    const config = {
      categories: [
        { emoji: '🛒', name: 'Courses', limit: 600 },
        { emoji: '👶', name: 'Bébé', limit: 200 },
      ],
    };
    expect(totalBudget(config)).toBe(800);
  });
});
