/**
 * budget.ts — Parser/serializer pour le suivi budget familial
 *
 * Vault format:
 * - 05 - Budget/config.md   → catégories + limites mensuelles
 * - 05 - Budget/YYYY-MM.md  → dépenses du mois
 */

export interface BudgetCategory {
  emoji: string;
  name: string;
  limit: number;
}

export interface BudgetConfig {
  categories: BudgetCategory[];
}

export interface BudgetEntry {
  date: string;       // YYYY-MM-DD
  category: string;   // "🛒 Courses"
  amount: number;
  label: string;
  lineIndex: number;  // 0-based line index in file
}

// ─── Default config ─────────────────────────────────────────────────────────

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  categories: [
    { emoji: '🛒', name: 'Courses', limit: 600 },
    { emoji: '👶', name: 'Bébé', limit: 200 },
    { emoji: '🏠', name: 'Maison', limit: 300 },
    { emoji: '🚗', name: 'Transport', limit: 150 },
    { emoji: '🎉', name: 'Loisirs', limit: 200 },
    { emoji: '🏥', name: 'Santé', limit: 100 },
    { emoji: '📱', name: 'Abonnements', limit: 80 },
    { emoji: '🎁', name: 'Divers', limit: 150 },
  ],
};

// ─── Parsers ────────────────────────────────────────────────────────────────

const CATEGORY_REGEX = /^-\s+(.+?):\s+(\d+(?:[.,]\d+)?)$/;

export function parseBudgetConfig(content: string): BudgetConfig {
  const lines = content.split('\n');
  const categories: BudgetCategory[] = [];

  let inCategories = false;
  for (const line of lines) {
    if (line.trim() === '## Catégories') {
      inCategories = true;
      continue;
    }
    if (line.startsWith('## ') && inCategories) break;
    if (!inCategories) continue;

    const match = line.match(CATEGORY_REGEX);
    if (match) {
      const full = match[1].trim();
      const limit = parseFloat(match[2].replace(',', '.'));
      // Split emoji from name: first char(s) are emoji, rest is name
      const emojiMatch = full.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*(.+)$/u);
      if (emojiMatch) {
        categories.push({ emoji: emojiMatch[1], name: emojiMatch[2].trim(), limit });
      } else {
        categories.push({ emoji: '💰', name: full, limit });
      }
    }
  }

  return { categories: categories.length > 0 ? categories : DEFAULT_BUDGET_CONFIG.categories };
}

const ENTRY_REGEX = /^-\s+(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*(\d+(?:[.,]\d+)?)\s*\|\s*(.+)$/;

export function parseBudgetMonth(content: string): BudgetEntry[] {
  const lines = content.split('\n');
  const entries: BudgetEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(ENTRY_REGEX);
    if (match) {
      entries.push({
        date: match[1],
        category: match[2].trim(),
        amount: parseFloat(match[3].replace(',', '.')),
        label: match[4].trim(),
        lineIndex: i,
      });
    }
  }

  return entries;
}

// ─── Serializers ────────────────────────────────────────────────────────────

export function serializeBudgetEntry(entry: Omit<BudgetEntry, 'lineIndex'>): string {
  return `- ${entry.date} | ${entry.category} | ${entry.amount.toFixed(2)} | ${entry.label}`;
}

export function serializeBudgetConfig(config: BudgetConfig): string {
  const lines = [
    '---',
    'tags:',
    '  - budget',
    '---',
    '# Budget — Configuration',
    '',
    '## Catégories',
    ...config.categories.map((c) => `- ${c.emoji} ${c.name}: ${c.limit}`),
  ];
  return lines.join('\n') + '\n';
}

export function serializeBudgetMonth(month: string, entries: BudgetEntry[]): string {
  const [year, mm] = month.split('-');
  const monthName = MONTH_NAMES_FR[parseInt(mm, 10) - 1] || mm;

  const lines = [
    '---',
    'tags:',
    '  - budget',
    `  - ${month}`,
    '---',
    `# Budget — ${monthName} ${year}`,
    '',
    '## Dépenses',
    ...entries
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => serializeBudgetEntry(e)),
  ];
  return lines.join('\n') + '\n';
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Format "2026-03" → "Mars 2026" */
export function formatMonthLabel(month: string): string {
  const [year, mm] = month.split('-');
  return `${MONTH_NAMES_FR[parseInt(mm, 10) - 1]} ${year}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format amount: 85.50 → "85,50 €" */
export function formatAmount(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €';
}

/** Get category display string: "🛒 Courses" */
export function categoryDisplay(cat: BudgetCategory): string {
  return `${cat.emoji} ${cat.name}`;
}

/** Sum entries for a given category display string */
export function sumByCategory(entries: BudgetEntry[], categoryStr: string): number {
  return entries
    .filter((e) => e.category === categoryStr)
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Total of all entries */
export function totalSpent(entries: BudgetEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

/** Total budget limit */
export function totalBudget(config: BudgetConfig): number {
  return config.categories.reduce((sum, c) => sum + c.limit, 0);
}
