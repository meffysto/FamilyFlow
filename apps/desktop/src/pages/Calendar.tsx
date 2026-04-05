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
import {
  aggregateCalendarEvents,
  indexByDate,
  EVENT_CONFIG,
  type CalendarEvent,
  type CalendarColorKey,
  type AggregatorInput,
} from '@family-vault/core';
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

const COLOR_KEY_TO_VAR: Record<CalendarColorKey, string> = {
  info: 'var(--info)',
  warning: 'var(--warning)',
  success: 'var(--success)',
  error: 'var(--error)',
  primary: 'var(--primary)',
  accentPink: 'var(--cat-famille)',
};

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

function getDotColor(event: CalendarEvent): string {
  return COLOR_KEY_TO_VAR[event.colorKey] ?? 'var(--primary)';
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

/** Ligne d'événement générique (tous types) */
const EventRow = memo(function EventRow({ event, showDate }: { event: CalendarEvent; showDate?: boolean }) {
  const accentColor = COLOR_KEY_TO_VAR[event.colorKey] ?? 'var(--primary)';

  return (
    <AccentRow accentColor={accentColor}>
      <div className="rdv-row-inner">
        <div className="rdv-row-top">
          {showDate && (
            <span className="rdv-date" style={{ color: accentColor }}>
              {formatDateFR(event.date)}
            </span>
          )}
          {event.time && (
            <span className="rdv-date" style={{ color: accentColor }}>
              {event.time}
            </span>
          )}
          <span className="rdv-title">
            {event.emoji} {event.label}
          </span>
          <Badge
            variant={event.colorKey === 'error' ? 'error' : event.colorKey === 'warning' ? 'warning' : event.colorKey === 'success' ? 'success' : 'info'}
            size="sm"
          >
            {EVENT_CONFIG[event.type].label}
          </Badge>
        </div>
        {event.sublabel && (
          <div className="rdv-row-meta">
            <span className="rdv-meta-item">{event.sublabel}</span>
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
  events: CalendarEvent[];
}

function ListView({ events }: ListViewProps) {
  const [search, setSearch] = useState('');
  const [pastExpanded, setPastExpanded] = useState(false);

  const normalized = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!normalized) return events;
    return events.filter((e) => {
      const haystack = [e.label, e.sublabel, EVENT_CONFIG[e.type].label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [events, normalized]);

  const upcoming = useMemo(
    () => filtered.filter((e) => e.date >= TODAY),
    [filtered],
  );

  const past = useMemo(
    () => filtered.filter((e) => e.date < TODAY).sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  return (
    <div>
      <div className="calendar-search">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher..."
        />
      </div>

      {/* A venir */}
      <GlassCard
        title="À venir"
        icon="📅"
        count={upcoming.length}
        accentColor={ACCENT_VIOLET}
        tinted
      >
        {upcoming.length === 0 ? (
          <div className="calendar-empty">
            <span className="calendar-empty-icon">🎉</span>
            <span className="calendar-empty-text">
              {search ? 'Aucun résultat' : 'Aucun événement à venir'}
            </span>
          </div>
        ) : (
          <div className="calendar-section">
            {upcoming.map((event) => (
              <EventRow key={event.id} event={event} showDate />
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
                {past.map((event) => (
                  <EventRow key={event.id} event={event} showDate />
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {pastExpanded && past.length === 0 && (
          <div className="calendar-empty" style={{ marginTop: 8 }}>
            <span className="calendar-empty-text">Aucun événement passé</span>
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
  events: CalendarEvent[];
  aggregatorInput: AggregatorInput;
}

function CalendarView({ events: _allEvents, aggregatorInput }: CalendarViewProps) {
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

  // Aggregate events for the displayed month
  const monthRange = useMemo(() => ({
    start: buildISODate(year, month, 1),
    end: buildISODate(year, month, new Date(year, month + 1, 0).getDate()),
  }), [year, month]);

  const monthEvents = useMemo(
    () => aggregateCalendarEvents(aggregatorInput, monthRange),
    [aggregatorInput, monthRange],
  );

  const eventsByDate = useMemo(() => indexByDate(monthEvents), [monthEvents]);

  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  const selectedEvents = useMemo(
    () => (selectedDate ? (eventsByDate[selectedDate] ?? []) : []),
    [selectedDate, eventsByDate],
  );

  const handleCellClick = useCallback(
    (date: string | null) => {
      if (!date) return;
      const hasEvents = (eventsByDate[date]?.length ?? 0) > 0;
      if (!hasEvents) return;
      setSelectedDate((prev) => (prev === date ? null : date));
    },
    [eventsByDate],
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
          const dayEvents = cell.date ? (eventsByDate[cell.date] ?? []) : [];
          const hasEvents = dayEvents.length > 0;

          const classNames = [
            'calendar-cell',
            !isCurrentMonth && 'calendar-cell--other-month',
            isToday && 'calendar-cell--today',
            hasEvents && 'calendar-cell--has-rdv',
            isSelected && 'calendar-cell--selected',
          ]
            .filter(Boolean)
            .join(' ');

          // Up to 4 dots with event-type colors
          const dots = dayEvents.slice(0, 4);

          return (
            <div
              key={`${cell.date ?? 'pad'}-${idx}`}
              className={classNames}
              onClick={() => handleCellClick(cell.date)}
              role={hasEvents ? 'button' : undefined}
              tabIndex={hasEvents ? 0 : undefined}
              onKeyDown={(e) => {
                if (hasEvents && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleCellClick(cell.date);
                }
              }}
              aria-label={
                cell.date
                  ? `${cell.day} ${MONTH_NAMES[month]}${hasEvents ? ` — ${dayEvents.length} événement(s)` : ''}`
                  : undefined
              }
            >
              <span className="calendar-day-number">{cell.day}</span>

              {dots.length > 0 && (
                <div className="calendar-dots">
                  {dots.map((event, di) => (
                    <span
                      key={di}
                      className="calendar-dot"
                      style={{ background: getDotColor(event) }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && selectedEvents.length > 0 && (
        <div className="calendar-day-detail">
          <div className="calendar-day-detail-title">
            {formatDateFR(selectedDate)} — {selectedEvents.length} événement{selectedEvents.length > 1 ? 's' : ''}
          </div>
          {selectedEvents.map((event) => (
            <EventRow key={event.id} event={event} />
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
  const {
    rdvs, tasks, meals, anniversaries, defis, moods, quotes,
    profiles, writeFile, refresh, loading,
  } = useVault();
  const [view, setView] = useState<'liste' | 'calendrier'>('liste');
  const [addOpen, setAddOpen] = useState(false);

  // Build aggregator input (no vacations/memories on desktop yet)
  const aggregatorInput = useMemo<AggregatorInput>(() => ({
    rdvs,
    tasks,
    anniversaries,
    resolvedMeals: [], // meals are weekly-based, skip for now
    vacationConfig: null,
    defis,
    memories: [],
    moods,
    quotes,
  }), [rdvs, tasks, anniversaries, defis, moods, quotes]);

  // Aggregate events for the list view (3 months window)
  const listRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }, []);

  const allEvents = useMemo(
    () => aggregateCalendarEvents(aggregatorInput, listRange),
    [aggregatorInput, listRange],
  );

  const upcomingCount = useMemo(
    () => allEvents.filter((e) => e.date >= TODAY).length,
    [allEvents],
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
                ? 'Aucun événement à venir'
                : `${upcomingCount} événement${upcomingCount > 1 ? 's' : ''} à venir`}
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
        <div className="page-loader">Chargement du calendrier...</div>
      )}

      {/* Views */}
      {!loading && view === 'liste' && (
        <ListView events={allEvents} />
      )}
      {!loading && view === 'calendrier' && (
        <CalendarView events={allEvents} aggregatorInput={aggregatorInput} />
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
