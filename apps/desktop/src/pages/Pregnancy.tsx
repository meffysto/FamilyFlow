import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useVault } from '../contexts/VaultContext';
import type { PregnancyWeekEntry } from '@family-vault/core';
import './Pregnancy.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_WEEKS = 41;

/** Brief developmental milestone text for key weeks */
const WEEK_MILESTONES: Record<number, string> = {
  4:  "Embryon implanté — taille d'un grain de pavot",
  6:  "Cœur qui bat — taille d'un petit pois",
  8:  "Bras et jambes visibles — taille d'une framboise",
  10: "Tous les organes formés — taille d'une fraise",
  12: "Fin du 1er trimestre — taille d'une prune",
  16: "Mouvements perceptibles — taille d'une poire",
  20: "Mi-parcours ! Échographie morphologique — taille d'une banane",
  24: "Viabilité possible hors du ventre — taille d'un épi de maïs",
  28: "Début du 3e trimestre — taille d'une aubergine",
  32: "Position tête en bas — taille d'un chou-fleur",
  36: "Poumons quasi matures — taille d'une papaye",
  38: "Bébé à terme — taille d'un melon",
  40: "Date prévue d'accouchement",
  41: "Post-terme — surveillance renforcée",
};

function getWeekLabel(week: number): string {
  return WEEK_MILESTONES[week] ?? `Semaine ${week} SA`;
}

function formatDateFr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function computeCurrentWeek(dateTerme: string): number {
  const terme = new Date(dateTerme);
  const now = new Date();
  const diffMs = terme.getTime() - now.getTime();
  const weeksLeft = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  const currentWeek = TOTAL_WEEKS - weeksLeft;
  return Math.max(1, Math.min(TOTAL_WEEKS, currentWeek));
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Week row
// ---------------------------------------------------------------------------

interface WeekRowProps {
  week: number;
  isCurrent: boolean;
  hasEntry: boolean;
  entry?: PregnancyWeekEntry;
}

function WeekRow({ week, isCurrent, hasEntry, entry }: WeekRowProps) {
  const milestone = getWeekLabel(week);

  return (
    <div className={`pregnancy-week-row ${isCurrent ? 'pregnancy-week-row--current' : ''} ${hasEntry ? 'pregnancy-week-row--has-entry' : ''}`}>
      <div className="pregnancy-week-dot" />
      <div className="pregnancy-week-content">
        <div className="pregnancy-week-header">
          <span className="pregnancy-week-number">SA {week}</span>
          {isCurrent && <span className="pregnancy-week-badge">Aujourd'hui</span>}
          {entry && <span className="pregnancy-week-date">{formatDateFr(entry.date)}</span>}
        </div>
        <p className="pregnancy-week-milestone">{milestone}</p>
        {entry && (
          <div className="pregnancy-week-entry">
            {entry.poids != null && (
              <span className="pregnancy-entry-chip">⚖️ {entry.poids} kg</span>
            )}
            {entry.symptomes && (
              <span className="pregnancy-entry-chip">🩺 {entry.symptomes}</span>
            )}
            {entry.notes && (
              <p className="pregnancy-entry-notes">{entry.notes}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add entry form
// ---------------------------------------------------------------------------

interface AddEntryFormProps {
  currentWeek: number;
  onSubmit: (entry: Omit<PregnancyWeekEntry, 'sourceFile' | 'lineIndex'>) => Promise<void>;
  onCancel: () => void;
}

function AddEntryForm({ currentWeek, onSubmit, onCancel }: AddEntryFormProps) {
  const { t } = useTranslation('common');
  const [week, setWeek] = useState(String(currentWeek));
  const [date, setDate] = useState(getToday());
  const [poids, setPoids] = useState('');
  const [symptomes, setSymptomes] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const weekNum = parseInt(week, 10);
    if (isNaN(weekNum) || weekNum < 1 || weekNum > TOTAL_WEEKS) {
      setError(`La semaine doit être entre 1 et ${TOTAL_WEEKS}.`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        week: weekNum,
        date,
        poids: poids ? parseFloat(poids.replace(',', '.')) : undefined,
        symptomes: symptomes.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="add-entry-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Semaine (SA)</label>
          <input
            type="number"
            className="form-input"
            value={week}
            min={1}
            max={TOTAL_WEEKS}
            onChange={(e) => setWeek(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-input form-input--date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">Poids (kg)</label>
        <input
          type="text"
          inputMode="decimal"
          className="form-input"
          value={poids}
          onChange={(e) => setPoids(e.target.value)}
          placeholder="ex: 65,4"
        />
      </div>

      <div className="form-field">
        <label className="form-label">Symptômes</label>
        <input
          type="text"
          className="form-input"
          value={symptomes}
          onChange={(e) => setSymptomes(e.target.value)}
          placeholder="ex: nausées légères, fatigue"
        />
      </div>

      <div className="form-field">
        <label className="form-label">Notes</label>
        <textarea
          className="form-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notes libres..."
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          {t('common.cancel', 'Annuler')}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Ajout...' : 'Ajouter'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Pregnancy page
// ---------------------------------------------------------------------------

export default function Pregnancy() {
  const { t } = useTranslation('common');
  const { profiles, pregnancyEntries, addPregnancyEntry } = useVault();

  const [showModal, setShowModal] = useState(false);

  // Profils en grossesse
  const pregnantProfiles = useMemo(
    () => profiles.filter((p) => p.statut === 'grossesse' && p.dateTerme),
    [profiles],
  );

  const activePregnancy = pregnantProfiles[0] ?? null;

  const currentWeek = useMemo(
    () => activePregnancy?.dateTerme ? computeCurrentWeek(activePregnancy.dateTerme) : 0,
    [activePregnancy],
  );

  // Index entries by week
  const entriesByWeek = useMemo(() => {
    const map = new Map<number, PregnancyWeekEntry>();
    for (const e of pregnancyEntries) {
      map.set(e.week, e);
    }
    return map;
  }, [pregnancyEntries]);

  // Weeks to render: all 41 weeks, scroll to current
  const weeks = useMemo(() => {
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
  }, []);

  const handleAddEntry = useCallback(
    async (entry: Omit<PregnancyWeekEntry, 'sourceFile' | 'lineIndex'>) => {
      if (!activePregnancy) return;
      await addPregnancyEntry(entry as PregnancyWeekEntry, activePregnancy.name);
      setShowModal(false);
    },
    [activePregnancy, addPregnancyEntry],
  );

  // ── Render — no active pregnancy ──────────────────────────────────────────

  if (!activePregnancy) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{t('nav.pregnancy', 'Grossesse')}</h1>
        </div>
        <div className="pregnancy-empty">
          <div className="pregnancy-empty-icon">🤰</div>
          <p className="pregnancy-empty-title">Aucun suivi de grossesse en cours</p>
          <p className="pregnancy-empty-hint">
            Pour démarrer le suivi, configurez un profil avec le statut "grossesse" et une date de terme dans les paramètres.
          </p>
          <Button variant="primary" onClick={() => {}}>
            Voir les paramètres
          </Button>
        </div>
      </div>
    );
  }

  // ── Render — active pregnancy ─────────────────────────────────────────────

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{t('nav.pregnancy', 'Grossesse')}</h1>
          <Button
            variant="primary"
            size="sm"
            icon="+"
            onClick={() => setShowModal(true)}
          >
            Ajouter une entrée
          </Button>
        </div>
        {currentWeek > 0 && (
          <p className="pregnancy-current-week">
            Semaine actuelle : <strong>SA {currentWeek}</strong>
            {activePregnancy.dateTerme && (
              <span className="pregnancy-terme"> · Terme le {formatDateFr(activePregnancy.dateTerme)}</span>
            )}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {currentWeek > 0 && (
        <div className="pregnancy-progress-card">
          <div className="pregnancy-progress-label">
            <span>{currentWeek} / {TOTAL_WEEKS} semaines</span>
            <span>{Math.round((currentWeek / TOTAL_WEEKS) * 100)}%</span>
          </div>
          <div className="pregnancy-progress-bar">
            <div
              className="pregnancy-progress-fill"
              style={{ width: `${(currentWeek / TOTAL_WEEKS) * 100}%` }}
            />
          </div>
          <div className="pregnancy-trimestres">
            <span>1er trimestre</span>
            <span>2e trimestre</span>
            <span>3e trimestre</span>
          </div>
        </div>
      )}

      {/* Notes section */}
      {pregnancyEntries.length > 0 && (
        <div className="pregnancy-section">
          <div className="pregnancy-section-title">Mes notes ({pregnancyEntries.length})</div>
          <div className="pregnancy-notes-grid">
            {[...pregnancyEntries]
              .sort((a, b) => b.week - a.week)
              .map((entry) => (
                <div key={`${entry.week}-${entry.date}`} className="pregnancy-note-card">
                  <div className="pregnancy-note-header">
                    <span className="pregnancy-note-week">SA {entry.week}</span>
                    <span className="pregnancy-note-date">{formatDateFr(entry.date)}</span>
                  </div>
                  {entry.poids != null && (
                    <p className="pregnancy-note-detail">⚖️ {entry.poids} kg</p>
                  )}
                  {entry.symptomes && (
                    <p className="pregnancy-note-detail">🩺 {entry.symptomes}</p>
                  )}
                  {entry.notes && (
                    <p className="pregnancy-note-text">{entry.notes}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="pregnancy-section">
        <div className="pregnancy-section-title">Timeline semaine par semaine</div>
        <div className="pregnancy-timeline">
          {weeks.map((week) => (
            <WeekRow
              key={week}
              week={week}
              isCurrent={week === currentWeek}
              hasEntry={entriesByWeek.has(week)}
              entry={entriesByWeek.get(week)}
            />
          ))}
        </div>
      </div>

      {/* Add entry modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nouvelle entrée grossesse"
        width="sm"
      >
        <AddEntryForm
          currentWeek={currentWeek || 1}
          onSubmit={handleAddEntry}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </div>
  );
}
