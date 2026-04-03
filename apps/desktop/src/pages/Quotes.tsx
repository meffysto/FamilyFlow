import { useState, useMemo, useCallback, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Modal } from '../components/ui/Modal';
import { SearchInput } from '../components/ui/SearchInput';
import { useVault } from '../contexts/VaultContext';
import type { ChildQuote, Profile } from '@family-vault/core';
import './Quotes.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function normalizeText(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// Quote card
// ---------------------------------------------------------------------------

interface QuoteCardProps {
  quote: ChildQuote;
}

const QuoteCard = memo(function QuoteCard({ quote }: QuoteCardProps) {
  return (
    <div className="quote-card">
      <div className="quote-card-accent" aria-hidden="true" />
      <div className="quote-card-body">
        <p className="quote-card-text">&ldquo;{quote.citation}&rdquo;</p>
        <div className="quote-card-footer">
          <div className="quote-card-meta">
            <span className="quote-card-child">{quote.enfant}</span>
            <span className="quote-card-date">{formatDateDisplay(quote.date)}</span>
          </div>
          {quote.contexte && (
            <span className="quote-card-context">{quote.contexte}</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Add quote modal
// ---------------------------------------------------------------------------

interface AddQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  childProfiles: Profile[];
  onAdd: (enfant: string, citation: string, contexte: string, date: string) => Promise<void>;
}

function AddQuoteModal({ isOpen, onClose, childProfiles, onAdd }: AddQuoteModalProps) {
  const [enfant, setEnfant] = useState(childProfiles[0]?.name ?? '');
  const [citation, setCitation] = useState('');
  const [contexte, setContexte] = useState('');
  const [date, setDate] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setEnfant(childProfiles[0]?.name ?? '');
    setCitation('');
    setContexte('');
    setDate(todayISO());
    setError('');
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCitation = citation.trim();
    if (!trimmedCitation) {
      setError('La citation est requise.');
      return;
    }
    if (!enfant.trim()) {
      setError('Le prénom de l\'enfant est requis.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onAdd(enfant.trim(), trimmedCitation, contexte.trim(), date);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau mot d'enfant" width="md">
      <form onSubmit={handleSubmit} className="quote-form">
        <div className="form-field">
          <label className="form-label" htmlFor="quote-enfant">
            Enfant <span className="form-required">*</span>
          </label>
          {childProfiles.length > 0 ? (
            <select
              id="quote-enfant"
              value={enfant}
              onChange={(e) => setEnfant(e.target.value)}
              className="form-select"
            >
              {childProfiles.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          ) : (
            <input
              id="quote-enfant"
              type="text"
              value={enfant}
              onChange={(e) => setEnfant(e.target.value)}
              placeholder="Prénom de l'enfant..."
              className="form-input"
            />
          )}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="quote-citation">
            La citation <span className="form-required">*</span>
          </label>
          <textarea
            id="quote-citation"
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            placeholder={'"Papa c\'est le plus grand du monde !"'}
            className="form-input quote-textarea"
            rows={4}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="quote-contexte">
            Contexte (optionnel)
          </label>
          <input
            id="quote-contexte"
            type="text"
            value={contexte}
            onChange={(e) => setContexte(e.target.value)}
            placeholder="Au parc, Avant de dormir, À table..."
            className="form-input"
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="quote-date">
            Date
          </label>
          <input
            id="quote-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <Button variant="secondary" onClick={onClose} type="button">
            Annuler
          </Button>
          <Button variant="primary" type="submit" disabled={submitting || !citation.trim()}>
            {submitting ? 'Enregistrement...' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Quotes() {
  const { quotes, profiles, readFile, writeFile, refresh } = useVault();

  const [search, setSearch] = useState('');
  const [selectedChild, setSelectedChild] = useState<string>('tous');
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Child profiles (enfant + ado roles)
  const childProfiles = useMemo(
    () => profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles],
  );

  // Unique child names from quotes data (as fallback if no child profiles)
  const childNames = useMemo(() => {
    const names = new Set<string>();
    for (const q of quotes) names.add(q.enfant);
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [quotes]);

  // Chip items: "Tous" + one per child
  const filterNames = useMemo(() => {
    const fromProfiles = childProfiles.map((p) => p.name);
    if (fromProfiles.length > 0) return fromProfiles;
    return childNames;
  }, [childProfiles, childNames]);

  // Filtered + sorted quotes
  const filteredQuotes = useMemo(() => {
    let list = [...quotes];

    // Filter by child
    if (selectedChild !== 'tous') {
      list = list.filter((q) => q.enfant === selectedChild);
    }

    // Filter by search
    if (search.trim()) {
      const normalized = normalizeText(search);
      list = list.filter(
        (q) =>
          normalizeText(q.citation).includes(normalized) ||
          normalizeText(q.enfant).includes(normalized) ||
          (q.contexte && normalizeText(q.contexte).includes(normalized)),
      );
    }

    // Sort by date descending
    list.sort((a, b) => b.date.localeCompare(a.date));

    return list;
  }, [quotes, selectedChild, search]);

  // ---------------------------------------------------------------------------
  // Add handler
  // ---------------------------------------------------------------------------

  const handleAdd = useCallback(
    async (enfant: string, citation: string, contexte: string, date: string) => {
      const sourceFile = "06 - Mémoires/Mots d'enfants.md";
      let existing = '';
      try {
        existing = await readFile(sourceFile);
      } catch {
        existing = "# Mots d'enfants\n\n";
      }

      const sectionHeader = `## ${enfant}`;
      const contexteStr = contexte ? ` | ${contexte}` : ' |';
      const newLine = `- ${date} | "${citation}"${contexteStr}`;

      let content = existing;
      const sectionIdx = content.indexOf(sectionHeader + '\n');

      if (sectionIdx !== -1) {
        // Insert as first line in the section
        const afterHeader = content.indexOf('\n', sectionIdx) + 1;
        content = content.slice(0, afterHeader) + newLine + '\n' + content.slice(afterHeader);
      } else {
        // Append a new section at the end
        const trimmed = content.replace(/\n+$/, '');
        content = `${trimmed}\n\n${sectionHeader}\n${newLine}\n`;
      }

      await writeFile(sourceFile, content);
      await refresh();
    },
    [readFile, writeFile, refresh],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="page quotes-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Mots d&apos;enfants
            {quotes.length > 0 && (
              <span className="quotes-count-badge">{quotes.length}</span>
            )}
          </h1>
          <p className="page-subtitle">
            {quotes.length === 0
              ? 'Aucun mot d\'enfant enregistré'
              : `${quotes.length} citation${quotes.length > 1 ? 's' : ''} de ${childNames.length} enfant${childNames.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="primary" icon="+" onClick={() => setAddModalOpen(true)}>
          Nouveau mot
        </Button>
      </div>

      {/* Filter chips + search */}
      <div className="quotes-toolbar">
        <div className="quotes-chips">
          <Chip
            label="Tous"
            selected={selectedChild === 'tous'}
            onClick={() => setSelectedChild('tous')}
          />
          {filterNames.map((name) => (
            <Chip
              key={name}
              label={name}
              selected={selectedChild === name}
              onClick={() => setSelectedChild((prev) => prev === name ? 'tous' : name)}
            />
          ))}
        </div>
        <div className="quotes-search">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher dans les citations..."
          />
        </div>
      </div>

      {/* Quote cards */}
      <GlassCard
        title={selectedChild === 'tous' ? 'Toutes les citations' : selectedChild}
        icon="💬"
        count={filteredQuotes.length}
        accentColor="var(--cat-famille)"
      >
        {filteredQuotes.length === 0 ? (
          <div className="quotes-empty">
            <span className="quotes-empty-icon">💬</span>
            <p className="quotes-empty-text">
              {search.trim() || selectedChild !== 'tous'
                ? 'Aucune citation pour ce filtre'
                : 'Aucun mot d\'enfant enregistré'}
            </p>
            {!search.trim() && selectedChild === 'tous' && (
              <p className="quotes-empty-hint">
                Note les petites phrases drôles ou touchantes de tes enfants
              </p>
            )}
          </div>
        ) : (
          <div className="quotes-grid">
            {filteredQuotes.map((quote, idx) => (
              <QuoteCard key={`${quote.date}-${quote.enfant}-${idx}`} quote={quote} />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Add modal */}
      <AddQuoteModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        childProfiles={childProfiles}
        onAdd={handleAdd}
      />
    </div>
  );
}
