import { useMemo, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { SearchInput } from '../components/ui/SearchInput';
import { AccentRow } from '../components/ui/AccentRow';
import { useVault } from '../contexts/VaultContext';
import type { Anniversary } from '@family-vault/core';
import './Birthdays.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateDisplay(mmdd: string): string {
  const [m, d] = mmdd.split('-');
  return `${d}/${m}`;
}

interface AnniversaryWithCountdown extends Anniversary {
  daysUntil: number;
  nextAge: number | null;
}

function computeCountdowns(anniversaries: Anniversary[]): AnniversaryWithCountdown[] {
  const now = new Date();
  const todayMs = now.getTime();

  return anniversaries
    .map((a): AnniversaryWithCountdown | null => {
      const [m, d] = (a.date ?? '').split('-').map(Number);
      if (!m || !d) return null;

      const thisYear = new Date(now.getFullYear(), m - 1, d);
      // If already passed today (strictly), move to next year
      if (thisYear.getTime() < todayMs - 86400000) {
        thisYear.setFullYear(now.getFullYear() + 1);
      }
      const daysUntil = Math.ceil((thisYear.getTime() - todayMs) / 86400000);
      const nextAge = a.birthYear ? thisYear.getFullYear() - a.birthYear : null;
      return { ...a, daysUntil, nextAge };
    })
    .filter((a): a is AnniversaryWithCountdown => a !== null);
}

// ---------------------------------------------------------------------------
// Upcoming row
// ---------------------------------------------------------------------------

interface UpcomingRowProps {
  a: AnniversaryWithCountdown;
}

function UpcomingRow({ a }: UpcomingRowProps) {
  const isToday = a.daysUntil === 0;
  const isThisWeek = a.daysUntil > 0 && a.daysUntil <= 7;

  const badgeVariant = isToday ? 'success' : isThisWeek ? 'warning' : 'default';
  const badgeLabel = isToday ? "Aujourd'hui !" : `J-${a.daysUntil}`;

  return (
    <AccentRow accentColor={isToday ? 'var(--success)' : isThisWeek ? 'var(--warning)' : 'var(--cat-famille)'}>
      <div className="birthday-upcoming-row">
        <div className="birthday-upcoming-info">
          <span className="birthday-upcoming-name">{a.name}</span>
          <div className="birthday-upcoming-meta">
            <span className="birthday-upcoming-date">{formatDateDisplay(a.date)}</span>
            {a.nextAge != null && (
              <span className="birthday-upcoming-age">{a.nextAge} ans</span>
            )}
            {a.category && (
              <span className="birthday-upcoming-cat">{a.category}</span>
            )}
          </div>
        </div>
        <Badge variant={badgeVariant} size="md">{badgeLabel}</Badge>
      </div>
    </AccentRow>
  );
}

// ---------------------------------------------------------------------------
// Category group (collapsible)
// ---------------------------------------------------------------------------

interface CategoryGroupProps {
  category: string;
  items: AnniversaryWithCountdown[];
}

function CategoryGroup({ category, items }: CategoryGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [items],
  );

  return (
    <GlassCard
      title={category}
      icon="🎂"
      count={sorted.length}
      accentColor="var(--cat-famille)"
      collapsed={collapsed}
      onToggle={() => setCollapsed((c) => !c)}
    >
      <div className="birthday-category-list">
        {sorted.map((a, i) => (
          <div key={`${a.sourceFile}-${a.name}-${i}`} className="birthday-category-row">
            <div className="birthday-category-info">
              <span className="birthday-category-name">{a.name}</span>
              {a.birthYear && (
                <span className="birthday-category-year">né{a.category === 'famille' ? '' : ''} en {a.birthYear}</span>
              )}
              {a.notes && (
                <span className="birthday-category-notes">{a.notes}</span>
              )}
            </div>
            <div className="birthday-category-right">
              <span className="birthday-category-date">{formatDateDisplay(a.date)}</span>
              {a.daysUntil <= 30 && (
                <Badge
                  variant={a.daysUntil === 0 ? 'success' : a.daysUntil <= 7 ? 'warning' : 'info'}
                  size="sm"
                >
                  {a.daysUntil === 0 ? "Aujourd'hui" : `J-${a.daysUntil}`}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Add birthday form
// ---------------------------------------------------------------------------

interface AddBirthdayFormData {
  name: string;
  date: string;       // MM-DD
  birthYear: string;
  category: string;
  notes: string;
}

const EMPTY_FORM: AddBirthdayFormData = {
  name: '',
  date: '',
  birthYear: '',
  category: '',
  notes: '',
};

const CATEGORIES = ['famille', 'ami', 'collègue', 'autre'];

function serializeNewAnniversary(data: AddBirthdayFormData): string {
  let line = `- **${data.name}** — ${data.date}`;
  if (data.birthYear) line += ` (${data.birthYear})`;
  if (data.category) line += ` #${data.category}`;
  if (data.notes) line += ` — ${data.notes}`;
  return line;
}

interface AddBirthdayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddBirthdayFormData) => Promise<void>;
}

function AddBirthdayModal({ isOpen, onClose, onSubmit }: AddBirthdayModalProps) {
  const [form, setForm] = useState<AddBirthdayFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof AddBirthdayFormData) => (
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      setError(null);
    }
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.name.trim()) { setError('Le nom est requis.'); return; }
      if (!form.date.trim()) { setError('La date (MM-JJ) est requise.'); return; }
      // Basic MM-DD validation
      const dateOk = /^\d{2}-\d{2}$/.test(form.date.trim());
      if (!dateOk) { setError('Format date invalide. Utilisez MM-JJ (ex: 03-15).'); return; }

      setSaving(true);
      try {
        await onSubmit(form);
        setForm(EMPTY_FORM);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
      } finally {
        setSaving(false);
      }
    },
    [form, onSubmit, onClose],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un anniversaire" width="sm">
      <form onSubmit={handleSubmit} className="birthday-form">

        <div className="birthday-form-field">
          <label className="birthday-form-label">
            Nom <span className="birthday-form-required">*</span>
          </label>
          <input
            className="birthday-form-input"
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder="Prénom Nom"
            autoFocus
          />
        </div>

        <div className="birthday-form-field">
          <label className="birthday-form-label">
            Date <span className="birthday-form-required">*</span>
          </label>
          <input
            className="birthday-form-input birthday-form-input--date"
            type="text"
            value={form.date}
            onChange={set('date')}
            placeholder="MM-JJ (ex: 03-15)"
            maxLength={5}
          />
          <span className="birthday-form-hint">Format : mois-jour, ex. 03-15 pour le 15 mars</span>
        </div>

        <div className="birthday-form-field">
          <label className="birthday-form-label">Année de naissance</label>
          <input
            className="birthday-form-input birthday-form-input--year"
            type="number"
            value={form.birthYear}
            onChange={set('birthYear')}
            placeholder="Ex: 1990"
            min={1900}
            max={new Date().getFullYear()}
          />
        </div>

        <div className="birthday-form-field">
          <label className="birthday-form-label">Catégorie</label>
          <select
            className="birthday-form-select"
            value={form.category}
            onChange={set('category')}
          >
            <option value="">— Sans catégorie —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="birthday-form-field">
          <label className="birthday-form-label">Notes</label>
          <input
            className="birthday-form-input"
            type="text"
            value={form.notes}
            onChange={set('notes')}
            placeholder="Notes optionnelles"
          />
        </div>

        {error && <p className="birthday-form-error">{error}</p>}

        <div className="birthday-form-actions">
          <Button variant="secondary" onClick={onClose} type="button">
            Annuler
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ANNIVERSARIES_FILE = '01 - Enfants/Commun/Anniversaires.md';

export default function Birthdays() {
  const { anniversaries, readFile, writeFile, refresh } = useVault();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Compute countdown info for all anniversaries
  const withCountdown = useMemo(() => computeCountdowns(anniversaries), [anniversaries]);

  // Upcoming: next 10, sorted by days until
  const upcoming = useMemo(
    () =>
      [...withCountdown]
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 10),
    [withCountdown],
  );

  // Filter by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withCountdown;
    return withCountdown.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.category ?? '').toLowerCase().includes(q) ||
        (a.notes ?? '').toLowerCase().includes(q),
    );
  }, [withCountdown, search]);

  // Group filtered results by category
  const grouped = useMemo(() => {
    const map = new Map<string, AnniversaryWithCountdown[]>();
    for (const a of filtered) {
      const cat = a.category?.trim() || 'Sans catégorie';
      const group = map.get(cat) ?? [];
      group.push(a);
      map.set(cat, group);
    }
    // Sort categories: known ones first, then alphabetically
    const ORDER = ['famille', 'ami', 'collègue', 'autre', 'Sans catégorie'];
    return [...map.entries()].sort(([a], [b]) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'fr');
    });
  }, [filtered]);

  // Add anniversary handler
  const handleAddAnniversary = useCallback(
    async (data: AddBirthdayFormData) => {
      let content = '';
      try {
        content = await readFile(ANNIVERSARIES_FILE);
      } catch {
        // File doesn't exist yet — create minimal header
        content = '# Anniversaires\n\n';
      }
      const newLine = serializeNewAnniversary(data);
      // Append before end — add newline if file doesn't end with one
      const trimmed = content.trimEnd();
      const updated = `${trimmed}\n${newLine}\n`;
      await writeFile(ANNIVERSARIES_FILE, updated);
      await refresh();
    },
    [readFile, writeFile, refresh],
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Anniversaires</h1>
          <p className="page-subtitle">
            {anniversaries.length} anniversaire{anniversaries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="page-header-actions">
          <Button
            variant="primary"
            icon="+"
            onClick={() => setModalOpen(true)}
          >
            Ajouter
          </Button>
        </div>
      </div>

      {/* Upcoming section */}
      {upcoming.length > 0 && (
        <div className="birthdays-section">
          <GlassCard
            title="Prochains anniversaires"
            icon="🎉"
            count={upcoming.length}
            accentColor="var(--cat-famille)"
          >
            <div className="birthday-upcoming-list">
              {upcoming.map((a, i) => (
                <UpcomingRow key={`${a.sourceFile}-${a.name}-${i}`} a={a} />
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* All anniversaries */}
      <div className="birthdays-section">
        <div className="birthdays-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un anniversaire…"
          />
          {search && (
            <span className="birthdays-search-count">
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="birthdays-empty">
            <span className="birthdays-empty-icon">🎂</span>
            <p className="birthdays-empty-text">
              {search ? 'Aucun résultat pour cette recherche.' : 'Aucun anniversaire enregistré.'}
            </p>
          </div>
        ) : (
          <div className="birthdays-groups">
            {grouped.map(([cat, items]) => (
              <CategoryGroup key={cat} category={cat} items={items} />
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      <AddBirthdayModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddAnniversary}
      />
    </div>
  );
}
