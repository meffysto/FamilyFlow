import { useState, useMemo, useCallback, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useVault } from '../contexts/VaultContext';
import type { MoodEntry } from '@family-vault/core';
import './Moods.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOOD_EMOJIS: Record<number, string> = {
  1: '😢',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};

const MOOD_LABELS: Record<number, string> = {
  1: 'Très mal',
  2: 'Pas bien',
  3: 'Neutre',
  4: 'Bien',
  5: 'Super bien',
};

const MOOD_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#16a34a',
};

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

function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function getLast30Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// ---------------------------------------------------------------------------
// Add mood modal
// ---------------------------------------------------------------------------

interface AddMoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onAdd: (date: string, level: number, note: string) => Promise<void>;
}

function AddMoodModal({ isOpen, onClose, initialDate, onAdd }: AddMoodModalProps) {
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [level, setLevel] = useState<number>(3);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset when re-opened
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setDate(initialDate ?? todayISO());
    setLevel(3);
    setNote('');
    setError('');
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!level) {
      setError('Sélectionne un niveau d\'humeur.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onAdd(date, level, note.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une humeur" width="sm">
      <form onSubmit={handleSubmit} className="mood-form">
        <div className="form-field">
          <label className="form-label" htmlFor="mood-date">
            Date
          </label>
          <input
            id="mood-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-field">
          <label className="form-label">
            Humeur <span className="form-required">*</span>
          </label>
          <div className="mood-level-picker">
            {([1, 2, 3, 4, 5] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`mood-level-btn ${level === lvl ? 'mood-level-btn--selected' : ''}`}
                style={{
                  '--mood-color': MOOD_COLORS[lvl],
                } as React.CSSProperties}
                onClick={() => setLevel(lvl)}
                aria-pressed={level === lvl}
                aria-label={MOOD_LABELS[lvl]}
                title={MOOD_LABELS[lvl]}
              >
                <span className="mood-level-emoji">{MOOD_EMOJIS[lvl]}</span>
                <span className="mood-level-label">{MOOD_LABELS[lvl]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="mood-note">
            Note (optionnel)
          </label>
          <textarea
            id="mood-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comment s'est passée ta journée ?"
            className="form-input mood-textarea"
            rows={3}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <Button variant="secondary" onClick={onClose} type="button">
            Annuler
          </Button>
          <Button variant="primary" type="submit" disabled={submitting || !level}>
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Timeline cell
// ---------------------------------------------------------------------------

interface TimelineCellProps {
  date: string;
  entry: MoodEntry | undefined;
  isToday: boolean;
  onClick: (date: string) => void;
}

const TimelineCell = memo(function TimelineCell({ date, entry, isToday, onClick }: TimelineCellProps) {
  return (
    <div
      className={`mood-timeline-cell ${isToday ? 'mood-timeline-cell--today' : ''} ${!entry ? 'mood-timeline-cell--empty' : ''}`}
      onClick={() => onClick(date)}
      role="button"
      tabIndex={0}
      aria-label={entry ? `${formatDateDisplay(date)} — ${MOOD_LABELS[entry.level]}` : `${formatDateDisplay(date)} — Aucune humeur`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(date); }}
    >
      <span className="mood-timeline-date">{formatDayMonth(date)}</span>
      {entry ? (
        <span className="mood-timeline-emoji" aria-hidden="true">{MOOD_EMOJIS[entry.level]}</span>
      ) : (
        <span className="mood-timeline-dot" aria-hidden="true" />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Bar chart
// ---------------------------------------------------------------------------

interface MoodBarChartProps {
  days: string[];
  byDate: Map<string, MoodEntry>;
}

function MoodBarChart({ days, byDate }: MoodBarChartProps) {
  return (
    <div className="mood-chart" role="img" aria-label="Graphique d'humeur des 30 derniers jours">
      <div className="mood-chart-bars">
        {days.map((date) => {
          const entry = byDate.get(date);
          const level = entry?.level ?? 0;
          const color = level ? MOOD_COLORS[level] : 'var(--border)';
          const height = level ? `${(level / 5) * 100}%` : '4px';
          return (
            <div key={date} className="mood-chart-bar-wrap" title={entry ? `${formatDateDisplay(date)}: ${MOOD_LABELS[level]}` : formatDateDisplay(date)}>
              <div className="mood-chart-bar-track">
                <div
                  className="mood-chart-bar-fill"
                  style={{ height, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mood-chart-y-axis">
        {([5, 4, 3, 2, 1] as const).map((lvl) => (
          <span key={lvl} className="mood-chart-y-label">{lvl}</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent entry row
// ---------------------------------------------------------------------------

interface MoodEntryRowProps {
  entry: MoodEntry;
  onClick: (entry: MoodEntry) => void;
}

const MoodEntryRow = memo(function MoodEntryRow({ entry, onClick }: MoodEntryRowProps) {
  return (
    <div
      className="mood-entry-row"
      style={{ borderLeftColor: MOOD_COLORS[entry.level] }}
      onClick={() => onClick(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(entry); }}
    >
      <div className="mood-entry-left">
        <span className="mood-entry-emoji" aria-hidden="true">{MOOD_EMOJIS[entry.level]}</span>
        <div className="mood-entry-info">
          <span className="mood-entry-date">{formatDateDisplay(entry.date)}</span>
          <span className="mood-entry-level">{MOOD_LABELS[entry.level]}</span>
        </div>
      </div>
      {entry.note && (
        <span className="mood-entry-note">{entry.note}</span>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Stats badge
// ---------------------------------------------------------------------------

interface MoodAvgBadgeProps {
  avg: number | null;
}

function MoodAvgBadge({ avg }: MoodAvgBadgeProps) {
  if (avg === null) return null;
  const level = Math.round(avg) as 1 | 2 | 3 | 4 | 5;
  const color = MOOD_COLORS[level] ?? 'var(--text-muted)';
  return (
    <div
      className="mood-avg-badge"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
      title={`Moyenne: ${avg.toFixed(1)}/5`}
    >
      <span className="mood-avg-emoji">{MOOD_EMOJIS[level]}</span>
      <span className="mood-avg-value">{avg.toFixed(1)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Moods() {
  const { moods, readFile, writeFile, refresh } = useVault();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [clickedDate, setClickedDate] = useState<string | undefined>(undefined);

  const last30Days = useMemo(() => getLast30Days(), []);
  const today = todayISO();

  // Build a date → entry map (most recent entry per date)
  const byDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    for (const entry of moods) {
      const existing = map.get(entry.date);
      // Keep the last one for each date
      if (!existing || entry.lineIndex > existing.lineIndex) {
        map.set(entry.date, entry);
      }
    }
    return map;
  }, [moods]);

  // Average mood over the last 30 days
  const avg = useMemo(() => {
    const withEntries = last30Days.filter((d) => byDate.has(d));
    if (withEntries.length === 0) return null;
    const sum = withEntries.reduce((acc, d) => acc + (byDate.get(d)?.level ?? 0), 0);
    return sum / withEntries.length;
  }, [last30Days, byDate]);

  // Recent entries sorted newest first
  const recentEntries = useMemo(
    () => [...moods].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    [moods],
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleTimelineClick = useCallback((date: string) => {
    setClickedDate(date);
    setAddModalOpen(true);
  }, []);

  const handleEntryClick = useCallback((_entry: MoodEntry) => {
    // For now, clicking an entry opens the add modal for that date
    setClickedDate(_entry.date);
    setAddModalOpen(true);
  }, []);

  const handleAdd = useCallback(
    async (date: string, level: number, note: string) => {
      const sourceFile = '05 - Famille/Humeurs.md';
      let existing = '';
      try {
        existing = await readFile(sourceFile);
      } catch {
        existing = '# Humeurs\n\n';
      }

      const [year, month] = date.split('-');
      const monthKey = `${year}-${month}`;
      const sectionHeader = `## ${monthKey}`;
      const noteStr = note ? ` | ${note}` : ' |';
      const newLine = `- ${date} | ${level}${noteStr}`;

      let content = existing;
      const sectionIdx = content.indexOf(sectionHeader);

      if (sectionIdx !== -1) {
        // Insert after the section header line
        const afterHeader = content.indexOf('\n', sectionIdx) + 1;
        content = content.slice(0, afterHeader) + newLine + '\n' + content.slice(afterHeader);
      } else {
        // Append a new section at end
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
    <div className="page moods-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Humeurs
            <MoodAvgBadge avg={avg} />
          </h1>
          <p className="page-subtitle">
            {moods.length === 0
              ? 'Aucune humeur enregistrée'
              : `${moods.length} enregistrement${moods.length > 1 ? 's' : ''} · ${last30Days.filter((d) => byDate.has(d)).length} sur 30 jours`}
          </p>
        </div>
        <Button variant="primary" icon="+" onClick={() => { setClickedDate(undefined); setAddModalOpen(true); }}>
          Ajouter
        </Button>
      </div>

      {/* Timeline — last 30 days */}
      <GlassCard title="30 derniers jours" icon="📅">
        <div className="mood-timeline">
          {last30Days.map((date) => (
            <TimelineCell
              key={date}
              date={date}
              entry={byDate.get(date)}
              isToday={date === today}
              onClick={handleTimelineClick}
            />
          ))}
        </div>
      </GlassCard>

      {/* Bar chart */}
      {moods.length > 0 && (
        <GlassCard title="Évolution" icon="📊">
          <MoodBarChart days={last30Days} byDate={byDate} />
        </GlassCard>
      )}

      {/* Recent entries */}
      <GlassCard
        title="Dernières humeurs"
        icon="🌤️"
        count={recentEntries.length}
      >
        {recentEntries.length === 0 ? (
          <div className="mood-empty">
            <span className="mood-empty-icon">😐</span>
            <p className="mood-empty-text">Aucune humeur enregistrée</p>
            <p className="mood-empty-hint">Clique sur un jour du calendrier pour commencer</p>
          </div>
        ) : (
          <div className="mood-entry-list">
            {recentEntries.map((entry, idx) => (
              <MoodEntryRow key={`${entry.date}-${idx}`} entry={entry} onClick={handleEntryClick} />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Add modal */}
      <AddMoodModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        initialDate={clickedDate}
        onAdd={handleAdd}
      />
    </div>
  );
}
