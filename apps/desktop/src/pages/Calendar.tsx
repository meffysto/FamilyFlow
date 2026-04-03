import { useState, useMemo, useCallback, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SearchInput } from '../components/ui/SearchInput';
import { Modal } from '../components/ui/Modal';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { AccentRow } from '../components/ui/AccentRow';
import { useVault } from '../contexts/VaultContext';
import type { RDV } from '@family-vault/core';
import './Calendar.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10);

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const RDV_TYPE_EMOJI: Record<string, string> = {
  pédiatre:      '👨‍⚕️',
  vaccin:        '💉',
  pmi:           '🏥',
  dentiste:      '🦷',
  urgences:      '🚑',
  école:         '🏫',
  activité:      '⚽',
  administratif: '🏛️',
  social:        '👥',
  autre:         '📋',
};

const RDV_TYPES = [
  'pédiatre', 'vaccin', 'pmi', 'dentiste', 'urgences',
  'école', 'activité', 'administratif', 'social', 'autre',
];

const ACCENT_VIOLET = 'var(--cat-sante)';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateFR(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTimeFR(isoDate: string, heure?: string): string {
  const base = formatDateFR(isoDate);
  return heure ? `${base} · ${heure}` : base;
}

function getRDVEmoji(type: string): string {
  return RDV_TYPE_EMOJI[type] ?? '📋';
}

function getDotClass(statut: string): string {
  if (statut === 'fait') return 'calendar-dot--fait';
  if (statut === 'annulé') return 'calendar-dot--annule';
  return 'calendar-dot--planifie';
}

/**
 * Build an ISO date string (YYYY-MM-DD) from year + month (0-based) + day.
 */
function buildISODate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Returns an array of day cells for the calendar grid.
 * Cells include `{ date: string | null, dayOfMonth: number }`.
 * null date means padding cell from previous/next month.
 */
function buildCalendarCells(year: number, month: number): Array<{ date: string | null; day: number }> {
  const firstDay = new Date(year, month, 1);
  // JS: 0=Sun…6=Sat → we want Mon=0…Sun=6
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: string | null; day: number }> = [];

  // Pad start
  for (let i = 0; i < startDow; i++) {
    const prevDay = new Date(year, month, -startDow + i + 1).getDate();
    cells.push({ date: null, day: prevDay });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: buildISODate(year, month, d), day: d });
  }

  // Pad end to fill last week
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const toAdd = 7 - remainder;
    for (let i = 1; i <= toAdd; i++) {
      cells.push({ date: null, day: i });
    }
  }

  return cells;
}

function buildRDVFileName(title: string, type: string, enfant: string, date: string): string {
  const safeName = [date, type, enfant].filter(Boolean).join(' ');
  return `04 - Rendez-vous/${safeName}.md`;
}

function buildRDVMarkdown(fields: AddRDVFormState): string {
  const lines: string[] = ['---'];
  lines.push(`titre: "${fields.title}"`);
  lines.push(`date_rdv: ${fields.date}`);
  if (fields.heure) lines.push(`heure: "${fields.heure}"`);
  lines.push(`type_rdv: ${fields.type}`);
  if (fields.enfant) lines.push(`enfant: "${fields.enfant}"`);
  if (fields.médecin) lines.push(`médecin: "${fields.médecin}"`);
  if (fields.lieu) lines.push(`lieu: "${fields.lieu}"`);
  lines.push(`statut: planifié`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${fields.title}`);
  lines.push('');
  if (fields.médecin) lines.push(`👨‍⚕️ **Médecin :** ${fields.médecin}`);
  if (fields.lieu) lines.push(`📍 **Lieu :** ${fields.lieu}`);
  lines.push('');
  lines.push('## Questions à poser');
  lines.push('');
  lines.push('## Réponses / Notes');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RDVRowProps {
  rdv: RDV;
  muted?: boolean;
}

const RDVRow = memo(function RDVRow({ rdv, muted }: RDVRowProps) {
  const emoji = getRDVEmoji(rdv.type_rdv);
  const dateLabel = formatDateTimeFR(rdv.date_rdv, rdv.heure);

  return (
    <AccentRow accentColor={muted ? 'var(--border)' : ACCENT_VIOLET}>
      <div className={`rdv-row-inner ${muted ? 'rdv-row--past' : ''}`}>
        <div className="rdv-row-top">
          <span className={muted ? 'rdv-date rdv-date--muted' : 'rdv-date'}>
            {dateLabel}
          </span>
          <span className={muted ? 'rdv-title rdv-title--muted' : 'rdv-title'}>
            {emoji} {rdv.title}
          </span>
          {rdv.enfant && (
            <Badge variant="info" size="sm">{rdv.enfant}</Badge>
          )}
          {rdv.statut !== 'planifié' && (
            <Badge variant={rdv.statut === 'fait' ? 'success' : 'error'} size="sm">
              {rdv.statut === 'fait' ? 'Fait' : 'Annulé'}
            </Badge>
          )}
        </div>

        {(rdv.médecin || rdv.lieu) && (
          <div className="rdv-row-meta">
            {rdv.médecin && (
              <span className="rdv-meta-item">
                <span>👨‍⚕️</span>
                {rdv.médecin}
              </span>
            )}
            {rdv.lieu && (
              <span className="rdv-meta-item">
                <span>📍</span>
                {rdv.lieu}
              </span>
            )}
          </div>
        )}
      </div>
    </AccentRow>
  );
});

// ---------------------------------------------------------------------------
// Add RDV form state
// ---------------------------------------------------------------------------

interface AddRDVFormState {
  title: string;
  date: string;
  heure: string;
  type: string;
  enfant: string;
  médecin: string;
  lieu: string;
}

const EMPTY_FORM: AddRDVFormState = {
  title: '',
  date: TODAY,
  heure: '',
  type: 'pédiatre',
  enfant: '',
  médecin: '',
  lieu: '',
};

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

interface ListViewProps {
  rdvs: RDV[];
  profiles: Array<{ name: string }>;
}

function ListView({ rdvs, profiles: _profiles }: ListViewProps) {
  const [search, setSearch] = useState('');
  const [pastExpanded, setPastExpanded] = useState(false);

  const normalized = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!normalized) return rdvs;
    return rdvs.filter((r) => {
      const haystack = [r.title, r.type_rdv, r.enfant, r.médecin, r.lieu]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [rdvs, normalized]);

  const upcoming = useMemo(
    () =>
      filtered
        .filter((r) => r.date_rdv >= TODAY && r.statut !== 'annulé')
        .sort((a, b) => {
          if (a.date_rdv !== b.date_rdv) return a.date_rdv < b.date_rdv ? -1 : 1;
          return (a.heure ?? '') < (b.heure ?? '') ? -1 : 1;
        }),
    [filtered],
  );

  const past = useMemo(
    () =>
      filtered
        .filter((r) => r.date_rdv < TODAY || r.statut === 'annulé')
        .sort((a, b) => (a.date_rdv < b.date_rdv ? 1 : -1)),
    [filtered],
  );

  return (
    <div>
      <div className="calendar-search">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un RDV..."
        />
      </div>

      {/* A venir */}
      <GlassCard
        title="A venir"
        icon="📅"
        count={upcoming.length}
        accentColor={ACCENT_VIOLET}
        tinted
      >
        {upcoming.length === 0 ? (
          <div className="calendar-empty">
            <span className="calendar-empty-icon">🎉</span>
            <span className="calendar-empty-text">
              {search ? 'Aucun résultat' : 'Aucun rendez-vous à venir'}
            </span>
          </div>
        ) : (
          <div className="calendar-section">
            {upcoming.map((rdv) => (
              <RDVRow key={rdv.sourceFile} rdv={rdv} />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Passés */}
      <div style={{ marginTop: 12 }}>
        <button
          className="calendar-past-toggle"
          onClick={() => setPastExpanded((v) => !v)}
        >
          <span>{pastExpanded ? '▾' : '▸'}</span>
          {pastExpanded ? `Masquer (${past.length})` : `Passés (${past.length})`}
        </button>

        {pastExpanded && past.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <GlassCard>
              <div className="calendar-section">
                {past.map((rdv) => (
                  <RDVRow key={rdv.sourceFile} rdv={rdv} muted />
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {pastExpanded && past.length === 0 && (
          <div className="calendar-empty" style={{ marginTop: 8 }}>
            <span className="calendar-empty-text">Aucun rendez-vous passé</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar View
// ---------------------------------------------------------------------------

interface CalendarViewProps {
  rdvs: RDV[];
}

function CalendarView({ rdvs }: CalendarViewProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const goToPrev = useCallback(() => {
    setSelectedDate(null);
    setMonth((m) => {
      if (m === 0) { setYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const goToNext = useCallback(() => {
    setSelectedDate(null);
    setMonth((m) => {
      if (m === 11) { setYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // Map: ISO date → RDVs on that day
  const rdvByDate = useMemo(() => {
    const map = new Map<string, RDV[]>();
    for (const rdv of rdvs) {
      const list = map.get(rdv.date_rdv) ?? [];
      list.push(rdv);
      map.set(rdv.date_rdv, list);
    }
    return map;
  }, [rdvs]);

  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  const selectedRDVs = useMemo(
    () => (selectedDate ? (rdvByDate.get(selectedDate) ?? []) : []),
    [selectedDate, rdvByDate],
  );

  const handleCellClick = useCallback(
    (date: string | null) => {
      if (!date) return;
      const hasRDVs = (rdvByDate.get(date)?.length ?? 0) > 0;
      if (!hasRDVs) return;
      setSelectedDate((prev) => (prev === date ? null : date));
    },
    [rdvByDate],
  );

  return (
    <GlassCard>
      {/* Month navigator */}
      <div className="calendar-nav">
        <button
          className="calendar-nav-btn"
          onClick={goToPrev}
          aria-label="Mois précédent"
        >
          ‹
        </button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button
          className="calendar-nav-btn"
          onClick={goToNext}
          aria-label="Mois suivant"
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday">{label}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="calendar-grid">
        {cells.map((cell, idx) => {
          const isCurrentMonth = cell.date !== null;
          const isToday = cell.date === TODAY;
          const isSelected = cell.date === selectedDate;
          const dayRDVs = cell.date ? (rdvByDate.get(cell.date) ?? []) : [];
          const hasRDVs = dayRDVs.length > 0;

          const classNames = [
            'calendar-cell',
            !isCurrentMonth && 'calendar-cell--other-month',
            isToday && 'calendar-cell--today',
            hasRDVs && 'calendar-cell--has-rdv',
            isSelected && 'calendar-cell--selected',
          ]
            .filter(Boolean)
            .join(' ');

          // Up to 3 dots
          const dots = dayRDVs.slice(0, 3);

          return (
            <div
              key={`${cell.date ?? 'pad'}-${idx}`}
              className={classNames}
              onClick={() => handleCellClick(cell.date)}
              role={hasRDVs ? 'button' : undefined}
              tabIndex={hasRDVs ? 0 : undefined}
              onKeyDown={(e) => {
                if (hasRDVs && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleCellClick(cell.date);
                }
              }}
              aria-label={
                cell.date
                  ? `${cell.day} ${MONTH_NAMES[month]}${hasRDVs ? ` — ${dayRDVs.length} RDV` : ''}`
                  : undefined
              }
            >
              <span className="calendar-day-number">{cell.day}</span>

              {dots.length > 0 && (
                <div className="calendar-dots">
                  {dots.map((rdv, di) => (
                    <span
                      key={di}
                      className={`calendar-dot ${getDotClass(rdv.statut)}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && selectedRDVs.length > 0 && (
        <div className="calendar-day-detail">
          <div className="calendar-day-detail-title">
            {formatDateFR(selectedDate)} — {selectedRDVs.length} rendez-vous
          </div>
          {selectedRDVs.map((rdv) => (
            <RDVRow key={rdv.sourceFile} rdv={rdv} />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Add RDV Modal
// ---------------------------------------------------------------------------

interface AddRDVModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Array<{ name: string }>;
  onSaved: () => void;
  writeFile: (path: string, content: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function AddRDVModal({ isOpen, onClose, profiles, writeFile, refresh }: AddRDVModalProps) {
  const [form, setForm] = useState<AddRDVFormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = useCallback(() => {
    setForm(EMPTY_FORM);
    setError('');
    onClose();
  }, [onClose]);

  const handleChange = useCallback(
    (field: keyof AddRDVFormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) {
      setError('Le titre est requis.');
      return;
    }
    if (!form.date) {
      setError('La date est requise.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const path = buildRDVFileName(form.title, form.type, form.enfant, form.date);
      const content = buildRDVMarkdown(form);
      await writeFile(path, content);
      await refresh();
      handleClose();
    } catch (e) {
      setError('Erreur lors de l\'enregistrement. Vérifiez que le vault est accessible.');
      if (import.meta.env.DEV) console.error(e);
    } finally {
      setSaving(false);
    }
  }, [form, writeFile, refresh, handleClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nouveau rendez-vous" width="md">
      <div className="add-rdv-form">
        {/* Title */}
        <div className="form-field">
          <label className="form-label">
            Titre <span className="form-required">*</span>
          </label>
          <input
            className="form-input"
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Ex : Consultation pédiatre"
            autoFocus
          />
        </div>

        <div className="form-row">
          {/* Date */}
          <div className="form-field">
            <label className="form-label">
              Date <span className="form-required">*</span>
            </label>
            <input
              className="form-input"
              type="date"
              value={form.date}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </div>

          {/* Heure */}
          <div className="form-field">
            <label className="form-label">Heure</label>
            <input
              className="form-input"
              type="time"
              value={form.heure}
              onChange={(e) => handleChange('heure', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          {/* Type */}
          <div className="form-field">
            <label className="form-label">Type</label>
            <select
              className="form-select"
              value={form.type}
              onChange={(e) => handleChange('type', e.target.value)}
            >
              {RDV_TYPES.map((t) => (
                <option key={t} value={t}>
                  {getRDVEmoji(t)} {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Enfant */}
          <div className="form-field">
            <label className="form-label">Enfant</label>
            {profiles.length > 0 ? (
              <select
                className="form-select"
                value={form.enfant}
                onChange={(e) => handleChange('enfant', e.target.value)}
              >
                <option value="">— Aucun —</option>
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="form-input"
                type="text"
                value={form.enfant}
                onChange={(e) => handleChange('enfant', e.target.value)}
                placeholder="Prénom"
              />
            )}
          </div>
        </div>

        {/* Médecin */}
        <div className="form-field">
          <label className="form-label">Médecin</label>
          <input
            className="form-input"
            type="text"
            value={form.médecin}
            onChange={(e) => handleChange('médecin', e.target.value)}
            placeholder="Dr. Dupont"
          />
        </div>

        {/* Lieu */}
        <div className="form-field">
          <label className="form-label">Lieu</label>
          <input
            className="form-input"
            type="text"
            value={form.lieu}
            onChange={(e) => handleChange('lieu', e.target.value)}
            placeholder="Cabinet médical, hôpital..."
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Ajouter'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Calendar Page
// ---------------------------------------------------------------------------

const SEGMENT_OPTIONS = [
  { label: '📋 Liste', value: 'liste' },
  { label: '🗓 Calendrier', value: 'calendrier' },
];

export default function CalendarPage() {
  const { rdvs, profiles, writeFile, refresh, loading } = useVault();
  const [view, setView] = useState<'liste' | 'calendrier'>('liste');
  const [addOpen, setAddOpen] = useState(false);

  const upcomingCount = useMemo(
    () => rdvs.filter((r) => r.date_rdv >= TODAY && r.statut !== 'annulé').length,
    [rdvs],
  );

  // Child profiles only (for the select in add form)
  const childProfiles = useMemo(
    () => profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles],
  );

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendrier</h1>
          {!loading && (
            <p className="page-subtitle">
              {upcomingCount === 0
                ? 'Aucun rendez-vous à venir'
                : `${upcomingCount} rendez-vous à venir`}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="primary"
            icon="+"
            onClick={() => setAddOpen(true)}
          >
            Nouveau RDV
          </Button>
        </div>
      </div>

      {/* View switcher */}
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-left">
          <SegmentedControl
            options={SEGMENT_OPTIONS}
            value={view}
            onChange={(v) => setView(v as 'liste' | 'calendrier')}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="page-loader">Chargement des rendez-vous...</div>
      )}

      {/* Views */}
      {!loading && view === 'liste' && (
        <ListView rdvs={rdvs} profiles={childProfiles} />
      )}
      {!loading && view === 'calendrier' && (
        <CalendarView rdvs={rdvs} />
      )}

      {/* Add RDV modal */}
      <AddRDVModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        profiles={childProfiles}
        onSaved={() => setAddOpen(false)}
        writeFile={writeFile}
        refresh={refresh}
      />
    </div>
  );
}
