import { useState, useMemo, useCallback, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Modal } from '../components/ui/Modal';
import { useVault } from '../contexts/VaultContext';
import type { WishlistItem, WishOccasion, WishBudget } from '@family-vault/core';
import './Wishlist.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OCCASION_LABELS: Record<WishOccasion, string> = {
  '':   'Sans occasion',
  '🎂': 'Anniversaire',
  '🎄': 'Noël',
};

const BUDGET_LABELS: Record<WishBudget, string> = {
  '':       'Non renseigné',
  '💰':     'Petit budget',
  '💰💰':   'Budget moyen',
  '💰💰💰': 'Grand budget',
};

// ---------------------------------------------------------------------------
// Wishlist row
// ---------------------------------------------------------------------------

interface WishRowProps {
  item: WishlistItem;
  onToggle: (item: WishlistItem) => void;
  toggling: boolean;
}

const WishRow = memo(function WishRow({ item, onToggle, toggling }: WishRowProps) {
  return (
    <div className={`wish-row ${item.bought ? 'wish-row--done' : ''}`}>
      {/* Checkbox */}
      <button
        type="button"
        className={`wish-checkbox ${item.bought ? 'wish-checkbox--checked' : ''}`}
        onClick={() => onToggle(item)}
        disabled={toggling}
        aria-checked={item.bought}
        role="checkbox"
        aria-label={item.bought ? 'Marquer non acheté' : 'Marquer acheté'}
      >
        {item.bought && <span className="wish-checkbox-mark" aria-hidden="true">✓</span>}
      </button>

      {/* Main content */}
      <div className="wish-row-body">
        <span className={`wish-row-text ${item.bought ? 'wish-row-text--done' : ''}`}>
          {item.text}
        </span>

        <div className="wish-row-meta">
          {item.profileName && (
            <span className="wish-enfant-pill">{item.profileName}</span>
          )}

          {!!item.occasion && (
            <span className="wish-occasion-tag" aria-label={OCCASION_LABELS[item.occasion]}>
              {item.occasion}
            </span>
          )}

          {!!item.budget && (
            <span className="wish-budget-tag" aria-label={BUDGET_LABELS[item.budget]}>
              {item.budget}
            </span>
          )}

          {item.notes && (
            <span className="wish-notes" title={item.notes}>
              {item.notes}
            </span>
          )}

          {item.bought && item.boughtBy && (
            <span className="wish-bought-by">acheté par {item.boughtBy}</span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="wish-row-right">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="wish-link-btn"
            title="Ouvrir le lien"
            onClick={(e) => e.stopPropagation()}
            aria-label="Ouvrir le lien externe"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

interface StatsBarProps {
  total: number;
  purchased: number;
  byOccasion: Record<string, number>;
}

function StatsBar({ total, purchased, byOccasion }: StatsBarProps) {
  const noel = byOccasion['🎄'] ?? 0;
  const anniversaire = byOccasion['🎂'] ?? 0;

  return (
    <div className="wish-stats-bar">
      <div className="wish-stat">
        <span className="wish-stat-value">{total}</span>
        <span className="wish-stat-label">souhaits</span>
      </div>
      <div className="wish-stat-divider" />
      <div className="wish-stat">
        <span className="wish-stat-value">{purchased}</span>
        <span className="wish-stat-label">achetés</span>
      </div>
      <div className="wish-stat-divider" />
      <div className="wish-stat">
        <span className="wish-stat-value">{noel}</span>
        <span className="wish-stat-label">🎄 Noël</span>
      </div>
      <div className="wish-stat-divider" />
      <div className="wish-stat">
        <span className="wish-stat-value">{anniversaire}</span>
        <span className="wish-stat-label">🎂 Anniversaire</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add wishlist item modal
// ---------------------------------------------------------------------------

interface AddWishModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileNames: string[];
  onAdd: (data: AddWishData) => Promise<void>;
}

interface AddWishData {
  text: string;
  profileName: string;
  budget: WishBudget;
  occasion: WishOccasion;
  url: string;
  notes: string;
}

function AddWishModal({ isOpen, onClose, profileNames, onAdd }: AddWishModalProps) {
  const [text, setText] = useState('');
  const [profileName, setProfileName] = useState('');
  const [budget, setBudget] = useState<WishBudget>('');
  const [occasion, setOccasion] = useState<WishOccasion>('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setText('');
    setProfileName('');
    setBudget('');
    setOccasion('');
    setUrl('');
    setNotes('');
    setError('');
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Le nom du souhait est requis.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onAdd({ text: trimmed, profileName, budget, occasion, url: url.trim(), notes: notes.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau souhait" width="md">
      <form onSubmit={handleSubmit} className="wish-form">
        <div className="form-field">
          <label className="form-label" htmlFor="wish-text">
            Souhait <span className="form-required">*</span>
          </label>
          <input
            id="wish-text"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nom de l'article..."
            className="form-input"
            autoFocus
          />
        </div>

        <div className="wish-form-row">
          <div className="form-field">
            <label className="form-label" htmlFor="wish-profile">
              Pour
            </label>
            <select
              id="wish-profile"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="form-select"
            >
              <option value="">Toute la famille</option>
              {profileNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="wish-budget">
              Budget
            </label>
            <select
              id="wish-budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value as WishBudget)}
              className="form-select"
            >
              <option value="">Non renseigné</option>
              <option value="💰">💰 Petit budget</option>
              <option value="💰💰">💰💰 Budget moyen</option>
              <option value="💰💰💰">💰💰💰 Grand budget</option>
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="wish-occasion">
            Occasion
          </label>
          <select
            id="wish-occasion"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value as WishOccasion)}
            className="form-select"
          >
            <option value="">Sans occasion</option>
            <option value="🎂">🎂 Anniversaire</option>
            <option value="🎄">🎄 Noël</option>
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="wish-url">
            Lien URL
          </label>
          <input
            id="wish-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="form-input"
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="wish-notes">
            Notes
          </label>
          <textarea
            id="wish-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informations supplémentaires..."
            className="form-input form-textarea"
            rows={3}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <Button variant="secondary" onClick={onClose} type="button">
            Annuler
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={submitting || !text.trim()}
          >
            {submitting ? 'Ajout...' : 'Ajouter le souhait'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Filter type: 'tous' | 'achetes' | profileName
// ---------------------------------------------------------------------------

type WishFilter = 'tous' | 'achetes' | string;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Wishlist() {
  const { wishlist, profiles, readFile, writeFile, refresh } = useVault();

  const [filter, setFilter] = useState<WishFilter>('tous');
  const [groupByOccasion, setGroupByOccasion] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Profile names for filter chips and modal
  const profileNames = useMemo(() => profiles.map((p) => p.name), [profiles]);

  // Child/ado profiles for filter chips (dedicated section in sidebar uses enfant/ado roles)
  const childProfiles = useMemo(
    () => profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles],
  );

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------

  const filteredItems = useMemo(() => {
    let items = [...wishlist];

    if (filter === 'achetes') {
      items = items.filter((i) => i.bought);
    } else if (filter !== 'tous') {
      items = items.filter((i) => i.profileName === filter);
    }

    // Purchased items at bottom
    const pending = items.filter((i) => !i.bought);
    const done = items.filter((i) => i.bought);
    // Sort each group alphabetically
    pending.sort((a, b) => a.text.localeCompare(b.text, 'fr'));
    done.sort((a, b) => a.text.localeCompare(b.text, 'fr'));
    return [...pending, ...done];
  }, [wishlist, filter]);

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    const total = wishlist.length;
    const purchased = wishlist.filter((i) => i.bought).length;
    const byOccasion: Record<string, number> = {};
    for (const item of wishlist) {
      if (item.occasion) {
        byOccasion[item.occasion] = (byOccasion[item.occasion] ?? 0) + 1;
      }
    }
    return { total, purchased, byOccasion };
  }, [wishlist]);

  // ---------------------------------------------------------------------------
  // Grouped by occasion
  // ---------------------------------------------------------------------------

  const groupedItems = useMemo(() => {
    if (!groupByOccasion) return null;

    const groups: Map<string, WishlistItem[]> = new Map([
      ['🎄 Noël', []],
      ['🎂 Anniversaire', []],
      ['Sans occasion', []],
    ]);

    for (const item of filteredItems) {
      if (item.occasion === '🎄') {
        groups.get('🎄 Noël')!.push(item);
      } else if (item.occasion === '🎂') {
        groups.get('🎂 Anniversaire')!.push(item);
      } else {
        groups.get('Sans occasion')!.push(item);
      }
    }

    return Array.from(groups.entries())
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }));
  }, [filteredItems, groupByOccasion]);

  // ---------------------------------------------------------------------------
  // Toggle bought
  // ---------------------------------------------------------------------------

  const handleToggle = useCallback(
    async (item: WishlistItem) => {
      if (togglingIds.has(item.id)) return;
      setTogglingIds((prev) => new Set(prev).add(item.id));

      try {
        const content = await readFile(item.sourceFile);
        const lines = content.split('\n');
        const line = lines[item.lineIndex];
        if (line === undefined) return;

        let updatedLine: string;
        if (item.bought) {
          updatedLine = line.replace(/bought:\s*true/i, 'bought: false');
        } else {
          updatedLine = line.replace(/bought:\s*false/i, 'bought: true');
        }

        if (updatedLine === line) return;

        lines[item.lineIndex] = updatedLine;
        await writeFile(item.sourceFile, lines.join('\n'));
        await refresh();
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[Wishlist] toggle error', err);
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [togglingIds, readFile, writeFile, refresh],
  );

  // ---------------------------------------------------------------------------
  // Add wishlist item
  // ---------------------------------------------------------------------------

  const handleAdd = useCallback(
    async (data: AddWishData) => {
      const sourceFile = '05 - Famille/Souhaits.md';
      let existing = '';
      try {
        existing = await readFile(sourceFile);
      } catch {
        existing = '# Souhaits\n\n';
      }

      // Append a YAML-style bullet for consistency with parseWishlist
      const lines: string[] = [`- text: "${data.text}"`];
      if (data.profileName) lines.push(`  profileName: "${data.profileName}"`);
      if (data.budget) lines.push(`  budget: "${data.budget}"`);
      if (data.occasion) lines.push(`  occasion: "${data.occasion}"`);
      if (data.url) lines.push(`  url: "${data.url}"`);
      if (data.notes) lines.push(`  notes: "${data.notes}"`);
      lines.push('  bought: false');
      lines.push('  boughtBy: ""');

      const newEntry = lines.join('\n');
      const trimmed = existing.replace(/\n+$/, '');
      await writeFile(sourceFile, `${trimmed}\n${newEntry}\n`);
      await refresh();
    },
    [readFile, writeFile, refresh],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const pendingCount = useMemo(() => filteredItems.filter((i) => !i.bought).length, [filteredItems]);

  return (
    <div className="page wishlist-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Liste de souhaits</h1>
          <p className="page-subtitle">
            {stats.total === 0
              ? 'Aucun souhait pour le moment'
              : `${stats.total} souhait${stats.total > 1 ? 's' : ''} · ${stats.purchased} acheté${stats.purchased > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="primary" icon="+" onClick={() => setAddModalOpen(true)}>
          Nouveau souhait
        </Button>
      </div>

      {/* Stats bar */}
      {stats.total > 0 && (
        <StatsBar
          total={stats.total}
          purchased={stats.purchased}
          byOccasion={stats.byOccasion}
        />
      )}

      {/* Filter + group controls */}
      <div className="wishlist-filter-bar">
        <div className="wishlist-chip-row">
          <Chip label="Tous" selected={filter === 'tous'} onClick={() => setFilter('tous')} />

          {childProfiles.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              selected={filter === p.name}
              onClick={() => setFilter((prev) => prev === p.name ? 'tous' : p.name)}
            />
          ))}

          <span className="wishlist-chip-divider" aria-hidden="true" />

          <Chip
            label="Achetés"
            selected={filter === 'achetes'}
            onClick={() => setFilter((prev) => prev === 'achetes' ? 'tous' : 'achetes')}
          />
        </div>

        <button
          type="button"
          className={`wish-group-toggle ${groupByOccasion ? 'wish-group-toggle--active' : ''}`}
          onClick={() => setGroupByOccasion((v) => !v)}
          aria-pressed={groupByOccasion}
        >
          Par occasion
        </button>
      </div>

      {/* Content */}
      {filteredItems.length === 0 ? (
        <GlassCard>
          <div className="wish-empty">
            <span className="wish-empty-icon">🎁</span>
            <p className="wish-empty-text">Aucun souhait dans cette catégorie</p>
          </div>
        </GlassCard>
      ) : groupByOccasion && groupedItems ? (
        groupedItems.map(({ label, items }) => (
          <GlassCard key={label} title={label} count={items.filter((i) => !i.bought).length}>
            <div className="wish-list">
              {items.map((item) => (
                <WishRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  toggling={togglingIds.has(item.id)}
                />
              ))}
            </div>
          </GlassCard>
        ))
      ) : (
        <GlassCard title="Souhaits" icon="🎁" count={pendingCount}>
          <div className="wish-list">
            {filteredItems.map((item, idx) => {
              const prev = filteredItems[idx - 1];
              const showDivider = item.bought && prev && !prev.bought;
              return (
                <div key={item.id}>
                  {showDivider && (
                    <div className="wish-section-divider">
                      <span>Achetés</span>
                    </div>
                  )}
                  <WishRow
                    item={item}
                    onToggle={handleToggle}
                    toggling={togglingIds.has(item.id)}
                  />
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Add modal */}
      <AddWishModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        profileNames={profileNames}
        onAdd={handleAdd}
      />
    </div>
  );
}
