import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useVault } from '../contexts/VaultContext';
import {
  parseBudgetMonth,
  parseBudgetConfig,
  serializeBudgetEntry,
  serializeBudgetMonth,
  formatMonthLabel,
  formatAmount,
  DEFAULT_BUDGET_CONFIG,
  MONTH_NAMES_FR,
  type BudgetEntry,
  type BudgetConfig,
} from '@family-vault/core';
import './Budget.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-DD-MM"
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function budgetFilePath(month: string): string {
  return `05 - Budget/${month}.md`;
}

function formatDateFr(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

/** Accent color by category index */
const CATEGORY_ACCENTS = [
  '#4285f4',
  '#34a853',
  '#fbbc05',
  '#ea4335',
  '#9c27b0',
  '#00bcd4',
  '#ff5722',
  '#607d8b',
  '#e91e63',
  '#795548',
];

function accentForCategory(cat: string, allCategories: string[]): string {
  const idx = allCategories.indexOf(cat);
  return CATEGORY_ACCENTS[idx % CATEGORY_ACCENTS.length];
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// Month navigator
// ---------------------------------------------------------------------------

interface MonthNavProps {
  month: string;
  onPrev: () => void;
  onNext: () => void;
}

const MonthNav = memo(function MonthNav({ month, onPrev, onNext }: MonthNavProps) {
  const isCurrentMonth = month === getCurrentMonth();

  return (
    <div className="budget-month-nav">
      <button
        className="budget-nav-btn"
        onClick={onPrev}
        aria-label="Mois précédent"
      >
        ‹
      </button>
      <span className="budget-month-label">{formatMonthLabel(month)}</span>
      <button
        className="budget-nav-btn"
        onClick={onNext}
        disabled={isCurrentMonth}
        aria-label="Mois suivant"
      >
        ›
      </button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Category summary card
// ---------------------------------------------------------------------------

interface CategoryCardProps {
  category: string;
  total: number;
  count: number;
  accent: string;
}

const CategoryCard = memo(function CategoryCard({ category, total, count, accent }: CategoryCardProps) {
  return (
    <div className="budget-cat-card" style={{ borderTopColor: accent }}>
      <div className="budget-cat-name">{category}</div>
      <div className="budget-cat-amount" style={{ color: accent }}>{formatAmount(total)}</div>
      <div className="budget-cat-count">{count} dépense{count !== 1 ? 's' : ''}</div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------

interface TransactionRowProps {
  entry: BudgetEntry;
  accent: string;
}

const TransactionRow = memo(function TransactionRow({ entry, accent }: TransactionRowProps) {
  return (
    <div className="budget-tx-row">
      <span className="budget-tx-date">{formatDateFr(entry.date)}</span>
      <span className="budget-tx-label">{entry.label}</span>
      <span className="budget-tx-category">
        <Badge variant="default" size="sm">
          <span style={{ color: accent }}>{entry.category}</span>
        </Badge>
      </span>
      <span className="budget-tx-amount">{formatAmount(entry.amount)}</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Add expense form inside Modal
// ---------------------------------------------------------------------------

interface AddExpenseFormProps {
  categories: string[];
  onSubmit: (entry: Omit<BudgetEntry, 'lineIndex'>) => Promise<void>;
  onCancel: () => void;
}

function AddExpenseForm({ categories, onSubmit, onCancel }: AddExpenseFormProps) {
  const [date, setDate] = useState(getToday());
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0] ?? '');
  const [customCategory, setCustomCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const effectiveCategory = category === '__custom__' ? customCategory.trim() : category;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!label.trim()) {
      setError('Le libellé est requis.');
      return;
    }
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Montant invalide.');
      return;
    }
    if (!effectiveCategory) {
      setError('La catégorie est requise.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        date,
        label: label.trim(),
        amount: parsedAmount,
        category: effectiveCategory,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="add-expense-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label className="form-label">
          Date
        </label>
        <input
          type="date"
          className="form-input form-input--date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="form-field">
        <label className="form-label">
          Libellé <span className="form-required">*</span>
        </label>
        <input
          type="text"
          className="form-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex: Supermarché Auchan"
          autoFocus
        />
      </div>

      <div className="form-field">
        <label className="form-label">
          Montant (€) <span className="form-required">*</span>
        </label>
        <input
          type="text"
          inputMode="decimal"
          className="form-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="ex: 45,50"
        />
      </div>

      <div className="form-field">
        <label className="form-label">
          Catégorie <span className="form-required">*</span>
        </label>
        <select
          className="form-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value="__custom__">+ Nouvelle catégorie</option>
        </select>
        {category === '__custom__' && (
          <input
            type="text"
            className="form-input"
            style={{ marginTop: 6 }}
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Nom de la catégorie"
          />
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Ajout...' : 'Ajouter'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Budget page
// ---------------------------------------------------------------------------

export default function Budget() {
  const { readFile, writeFile } = useVault();

  const [month, setMonth] = useState(getCurrentMonth());
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [config, setConfig] = useState<BudgetConfig>(DEFAULT_BUDGET_CONFIG);
  const [loading, setLoading] = useState(false);
  const [noFile, setNoFile] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Load budget config once ────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const content = await readFile('05 - Budget/config.md');
        setConfig(parseBudgetConfig(content));
      } catch {
        setConfig(DEFAULT_BUDGET_CONFIG);
      }
    })();
  }, [readFile]);

  // ── Load month file ────────────────────────────────────────────────────────

  const loadMonth = useCallback(
    async (m: string) => {
      setLoading(true);
      setNoFile(false);
      try {
        const content = await readFile(budgetFilePath(m));
        setEntries(parseBudgetMonth(content));
      } catch {
        setEntries([]);
        setNoFile(true);
      } finally {
        setLoading(false);
      }
    },
    [readFile],
  );

  useEffect(() => {
    loadMonth(month);
  }, [month, loadMonth]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handlePrev = useCallback(() => setMonth((m) => prevMonth(m)), []);
  const handleNext = useCallback(() => setMonth((m) => nextMonth(m)), []);

  // ── Derived data ───────────────────────────────────────────────────────────

  // All known categories from config + any found in entries
  const allCategories = useMemo(() => {
    const fromConfig = config.categories.map((c) => `${c.emoji} ${c.name}`);
    const fromEntries = entries.map((e) => e.category).filter(Boolean);
    const unique = Array.from(new Set([...fromConfig, ...fromEntries]));
    return unique;
  }, [config, entries]);

  // Category summaries
  const categorySummaries = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const entry of entries) {
      const cat = entry.category || 'Divers';
      const prev = map.get(cat) ?? { total: 0, count: 0 };
      map.set(cat, { total: prev.total + entry.amount, count: prev.count + 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, stats]) => ({ cat, ...stats }));
  }, [entries]);

  // Transactions sorted newest first
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + e.amount, 0),
    [entries],
  );

  // ── Add expense ────────────────────────────────────────────────────────────

  const handleAddExpense = useCallback(
    async (newEntry: Omit<BudgetEntry, 'lineIndex'>) => {
      const line = serializeBudgetEntry(newEntry);

      try {
        let content: string;
        try {
          content = await readFile(budgetFilePath(month));
        } catch {
          // File doesn't exist yet — create it from scratch
          content = serializeBudgetMonth(month, []);
        }

        // Append after the last non-empty line
        const trimmed = content.trimEnd();
        const updated = trimmed + '\n' + line + '\n';
        await writeFile(budgetFilePath(month), updated);
        await loadMonth(month);
        setShowAddModal(false);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur ajout dépense:', e);
      }
    },
    [month, readFile, writeFile, loadMonth],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">Budget</h1>
          <Button
            variant="primary"
            size="sm"
            icon="+"
            onClick={() => setShowAddModal(true)}
          >
            Dépense
          </Button>
        </div>
        <MonthNav month={month} onPrev={handlePrev} onNext={handleNext} />
      </div>

      {loading ? (
        <div className="budget-loading">Chargement...</div>
      ) : noFile ? (
        <div className="budget-empty">
          <div className="budget-empty-icon">💰</div>
          <p className="budget-empty-title">Aucune donnée pour {formatMonthLabel(month)}</p>
          <p className="budget-empty-hint">
            Ajoutez une première dépense pour créer le fichier du mois.
          </p>
          <Button
            variant="primary"
            icon="+"
            onClick={() => setShowAddModal(true)}
          >
            Ajouter une dépense
          </Button>
        </div>
      ) : (
        <>
          {/* Category summary grid */}
          {categorySummaries.length > 0 && (
            <div className="budget-section">
              <div className="budget-section-title">Répartition</div>
              <div className="budget-cat-grid">
                {categorySummaries.map(({ cat, total: catTotal, count }) => (
                  <CategoryCard
                    key={cat}
                    category={cat}
                    total={catTotal}
                    count={count}
                    accent={accentForCategory(cat, allCategories)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Transaction list */}
          <div className="budget-section">
            <div className="budget-section-title">Toutes les dépenses</div>
            <GlassCard>
              {sortedEntries.length === 0 ? (
                <p className="budget-no-entries">Aucune dépense ce mois-ci.</p>
              ) : (
                <>
                  <div className="budget-tx-list">
                    {sortedEntries.map((entry) => (
                      <TransactionRow
                        key={entry.lineIndex}
                        entry={entry}
                        accent={accentForCategory(entry.category, allCategories)}
                      />
                    ))}
                  </div>
                  <div className="budget-tx-total">
                    <span className="budget-tx-total-label">Total du mois</span>
                    <span className="budget-tx-total-amount">{formatAmount(total)}</span>
                  </div>
                </>
              )}
            </GlassCard>
          </div>
        </>
      )}

      {/* Add expense modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Nouvelle dépense"
        width="sm"
      >
        <AddExpenseForm
          categories={allCategories}
          onSubmit={handleAddExpense}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>
    </div>
  );
}
