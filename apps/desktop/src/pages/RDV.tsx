import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SearchInput } from '../components/ui/SearchInput';
import { useVault } from '../contexts/VaultContext';
import {
  type RDV,
} from '@family-vault/core';
import './RDV.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RDV_TYPES = [
  'pédiatre',
  'vaccin',
  'pmi',
  'dentiste',
  'urgences',
  'école',
  'activité',
  'administratif',
  'social',
  'autre',
];

const RDV_TYPE_EMOJI: Record<string, string> = {
  pédiatre: '👨‍⚕️',
  vaccin: '💉',
  pmi: '🏥',
  dentiste: '🦷',
  urgences: '🚑',
  école: '🏫',
  activité: '⚽',
  administratif: '🏛️',
  social: '👥',
  autre: '📋',
};

const STATUT_COLORS: Record<string, string> = {
  planifié: 'var(--primary)',
  fait: '#34a853',
  annulé: '#ea4335',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateFr(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getMonthKey(isoDate: string): string {
  if (!isoDate) return '';
  return isoDate.slice(0, 7); // "YYYY-MM"
}

function formatMonthLabel(yyyyMm: string): string {
  const MONTHS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  const [y, m] = yyyyMm.split('-').map(Number);
  return `${MONTHS_FR[m - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// RDV Form (create / edit)
// ---------------------------------------------------------------------------

interface RDVFormProps {
  initial?: Partial<RDV>;
  onSubmit: (data: Omit<RDV, 'sourceFile'>) => Promise<void>;
  onCancel: () => void;
}

function RDVForm({ initial, onSubmit, onCancel }: RDVFormProps) {
  const { t } = useTranslation('common');
  const [date, setDate] = useState(initial?.date_rdv ?? getTodayIso());
  const [heure, setHeure] = useState(initial?.heure ?? '');
  const [typeRdv, setTypeRdv] = useState(initial?.type_rdv ?? 'pédiatre');
  const [enfant, setEnfant] = useState(initial?.enfant ?? '');
  const [medecin, setMedecin] = useState(initial?.médecin ?? '');
  const [lieu, setLieu] = useState(initial?.lieu ?? '');
  const [statut, setStatut] = useState<RDV['statut']>(initial?.statut ?? 'planifié');
  const [questions, setQuestions] = useState((initial?.questions ?? []).join('\n'));
  const [reponses, setReponses] = useState(initial?.reponses ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!date) { setError(t('rdvPage.errorDateRequired', 'La date est requise.')); return; }
    if (!enfant.trim()) { setError(t('rdvPage.errorEnfantRequired', 'Le nom (enfant/personne) est requis.')); return; }

    const questionList = questions
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);

    const title = `${date} ${typeRdv} ${enfant.trim()}`;

    setSubmitting(true);
    try {
      await onSubmit({
        title,
        date_rdv: date,
        heure: heure.trim(),
        type_rdv: typeRdv,
        enfant: enfant.trim(),
        médecin: medecin.trim(),
        lieu: lieu.trim(),
        statut,
        questions: questionList,
        reponses: reponses.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="rdv-form" onSubmit={handleSubmit}>
      <div className="form-row-2">
        <div className="form-field">
          <label className="form-label">
            {t('rdvPage.labelDate', 'Date')} <span className="form-required">*</span>
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
            {t('rdvPage.labelHeure', 'Heure')}
          </label>
          <input
            type="time"
            className="form-input form-input--date"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
          />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">
          {t('rdvPage.labelType', 'Type')} <span className="form-required">*</span>
        </label>
        <select
          className="form-select"
          value={typeRdv}
          onChange={(e) => setTypeRdv(e.target.value)}
        >
          {RDV_TYPES.map((type) => (
            <option key={type} value={type}>
              {RDV_TYPE_EMOJI[type] ?? ''} {type}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label className="form-label">
          {t('rdvPage.labelEnfant', 'Personne / Enfant')} <span className="form-required">*</span>
        </label>
        <input
          type="text"
          className="form-input"
          value={enfant}
          onChange={(e) => setEnfant(e.target.value)}
          placeholder={t('rdvPage.placeholderEnfant', 'ex: Lucas')}
          autoFocus
        />
      </div>

      <div className="form-row-2">
        <div className="form-field">
          <label className="form-label">
            {t('rdvPage.labelMedecin', 'Médecin / Intervenant')}
          </label>
          <input
            type="text"
            className="form-input"
            value={medecin}
            onChange={(e) => setMedecin(e.target.value)}
            placeholder={t('rdvPage.placeholderMedecin', 'ex: Dr. Dupont')}
          />
        </div>
        <div className="form-field">
          <label className="form-label">
            {t('rdvPage.labelLieu', 'Lieu')}
          </label>
          <input
            type="text"
            className="form-input"
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder={t('rdvPage.placeholderLieu', 'ex: Cabinet médical')}
          />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">
          {t('rdvPage.labelStatut', 'Statut')}
        </label>
        <select
          className="form-select"
          value={statut}
          onChange={(e) => setStatut(e.target.value as RDV['statut'])}
        >
          <option value="planifié">{t('rdvPage.statutPlanifie', 'Planifié')}</option>
          <option value="fait">{t('rdvPage.statutFait', 'Fait')}</option>
          <option value="annulé">{t('rdvPage.statutAnnule', 'Annulé')}</option>
        </select>
      </div>

      <div className="form-field">
        <label className="form-label">
          {t('rdvPage.labelQuestions', 'Questions à poser')}
        </label>
        <textarea
          className="form-input rdv-textarea"
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          placeholder={t('rdvPage.placeholderQuestions', 'Une question par ligne...')}
          rows={3}
        />
      </div>

      <div className="form-field">
        <label className="form-label">
          {t('rdvPage.labelReponses', 'Notes / Réponses')}
        </label>
        <textarea
          className="form-input rdv-textarea"
          value={reponses}
          onChange={(e) => setReponses(e.target.value)}
          placeholder={t('rdvPage.placeholderReponses', 'Notes post-consultation...')}
          rows={3}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          {t('common.cancel', 'Annuler')}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting
            ? t('common.saving', 'Sauvegarde...')
            : t('common.save', 'Sauvegarder')}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// RDV item row
// ---------------------------------------------------------------------------

interface RDVItemProps {
  rdv: RDV;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const RDVItem = memo(function RDVItem({ rdv, isSelected, onSelect, onEdit, onDelete }: RDVItemProps) {
  const emoji = RDV_TYPE_EMOJI[rdv.type_rdv] ?? '📋';
  const statutColor = STATUT_COLORS[rdv.statut] ?? 'var(--text-muted)';

  return (
    <div
      className={`rdv-item${isSelected ? ' rdv-item--selected' : ''}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      role="button"
      aria-pressed={isSelected}
    >
      <div className="rdv-item-emoji">{emoji}</div>
      <div className="rdv-item-info">
        <div className="rdv-item-title">
          <span className="rdv-item-type">{rdv.type_rdv}</span>
          {rdv.enfant && <span className="rdv-item-enfant">· {rdv.enfant}</span>}
        </div>
        <div className="rdv-item-meta">
          <span className="rdv-item-date">{formatDateFr(rdv.date_rdv)}</span>
          {rdv.heure && <span className="rdv-item-heure">{rdv.heure}</span>}
          {rdv.lieu && <span className="rdv-item-lieu">· {rdv.lieu}</span>}
        </div>
      </div>
      <div className="rdv-item-statut">
        <Badge variant="default" size="sm">
          <span style={{ color: statutColor }}>{rdv.statut}</span>
        </Badge>
      </div>
      <div className="rdv-item-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="rdv-action-btn rdv-action-btn--edit"
          onClick={onEdit}
          aria-label="Modifier"
          title="Modifier"
        >
          ✏️
        </button>
        <button
          className="rdv-action-btn rdv-action-btn--delete"
          onClick={onDelete}
          aria-label="Supprimer"
          title="Supprimer"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main RDV page
// ---------------------------------------------------------------------------

export default function RDV() {
  const { t } = useTranslation('common');
  const { rdvs, addRDV, updateRDV, deleteRDV } = useVault();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | null>(null);
  const [selectedRDV, setSelectedRDV] = useState<RDV | null>(null);

  // ── Keyboard shortcut — Delete selected RDV ──────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' && selectedRDV && !showModal) {
        const ok = window.confirm(
          t('rdvPage.confirmDelete', `Supprimer le rendez-vous "${selectedRDV.type_rdv} — ${selectedRDV.enfant}" ?`)
        );
        if (ok) {
          deleteRDV(selectedRDV);
          setSelectedRDV(null);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRDV, showModal, deleteRDV, t]);

  // ── Filtered & grouped RDVs ───────────────────────────────────────────────

  const filteredRdvs = useMemo(() => {
    if (!search.trim()) return rdvs;
    const q = normalize(search);
    return rdvs.filter(
      (r) =>
        normalize(r.type_rdv).includes(q) ||
        normalize(r.enfant).includes(q) ||
        normalize(r.médecin ?? '').includes(q) ||
        normalize(r.lieu ?? '').includes(q) ||
        normalize(r.date_rdv).includes(q),
    );
  }, [rdvs, search]);

  const groupedByMonth = useMemo(() => {
    const sorted = [...filteredRdvs].sort((a, b) => b.date_rdv.localeCompare(a.date_rdv));
    const groups = new Map<string, RDV[]>();
    for (const rdv of sorted) {
      const key = getMonthKey(rdv.date_rdv);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rdv);
    }
    return Array.from(groups.entries());
  }, [filteredRdvs]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditingRDV(null);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((rdv: RDV) => {
    setEditingRDV(rdv);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback((rdv: RDV) => {
    const ok = window.confirm(
      t('rdvPage.confirmDelete', `Supprimer le rendez-vous "${rdv.type_rdv} — ${rdv.enfant}" ?`)
    );
    if (ok) {
      deleteRDV(rdv);
      if (selectedRDV?.sourceFile === rdv.sourceFile) setSelectedRDV(null);
    }
  }, [deleteRDV, selectedRDV, t]);

  const handleSubmit = useCallback(async (data: Omit<RDV, 'sourceFile'>) => {
    if (editingRDV) {
      await updateRDV({ ...data, sourceFile: editingRDV.sourceFile });
    } else {
      await addRDV(data);
    }
    setShowModal(false);
    setEditingRDV(null);
  }, [editingRDV, addRDV, updateRDV]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="rdv-header-row">
          <h1 className="page-title">{t('rdvPage.title', 'Rendez-vous')}</h1>
          <Button variant="primary" size="sm" icon="+" onClick={openCreate}>
            {t('rdvPage.addButton', 'Ajouter')}
          </Button>
        </div>
        <div className="rdv-search-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('rdvPage.searchPlaceholder', 'Rechercher un rendez-vous...')}
          />
        </div>
      </div>

      {/* Content */}
      {rdvs.length === 0 ? (
        <div className="rdv-empty">
          <div className="rdv-empty-icon">📅</div>
          <p className="rdv-empty-title">{t('rdvPage.emptyTitle', 'Aucun rendez-vous')}</p>
          <p className="rdv-empty-hint">
            {t('rdvPage.emptyHint', 'Ajoutez votre premier rendez-vous pour commencer.')}
          </p>
          <Button variant="primary" icon="+" onClick={openCreate}>
            {t('rdvPage.addFirst', 'Ajouter un rendez-vous')}
          </Button>
        </div>
      ) : filteredRdvs.length === 0 ? (
        <div className="rdv-empty">
          <p className="rdv-empty-title">{t('rdvPage.noResults', 'Aucun résultat pour cette recherche.')}</p>
        </div>
      ) : (
        groupedByMonth.map(([monthKey, monthRdvs]) => (
          <div key={monthKey} className="rdv-section">
            <div className="rdv-section-title">{formatMonthLabel(monthKey)}</div>
            <GlassCard>
              {monthRdvs.map((rdv) => (
                <RDVItem
                  key={rdv.sourceFile}
                  rdv={rdv}
                  isSelected={selectedRDV?.sourceFile === rdv.sourceFile}
                  onSelect={() => setSelectedRDV((prev) =>
                    prev?.sourceFile === rdv.sourceFile ? null : rdv
                  )}
                  onEdit={() => openEdit(rdv)}
                  onDelete={() => handleDelete(rdv)}
                />
              ))}
            </GlassCard>
          </div>
        ))
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingRDV(null); }}
        title={editingRDV
          ? t('rdvPage.editTitle', 'Modifier le rendez-vous')
          : t('rdvPage.createTitle', 'Nouveau rendez-vous')}
        width="md"
      >
        <RDVForm
          initial={editingRDV ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => { setShowModal(false); setEditingRDV(null); }}
        />
      </Modal>
    </div>
  );
}
