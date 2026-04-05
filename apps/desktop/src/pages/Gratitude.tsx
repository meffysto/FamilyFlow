import { useState, useMemo, useCallback, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useVault } from '../contexts/VaultContext';
import type { GratitudeDay, GratitudeEntry } from '@family-vault/core';
import './Gratitude.css';

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

function formatDateLong(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Get the first day of each of the last N months (YYYY-MM format)
function getLast3Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// All days in a YYYY-MM month
function getDaysInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return `${yearMonth}-${day}`;
  });
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Calendar heatmap
// ---------------------------------------------------------------------------

interface HeatmapProps {
  countByDate: Map<string, number>;
  maxCount: number;
}

function CalendarHeatmap({ countByDate, maxCount }: HeatmapProps) {
  const months = getLast3Months();
  const today = todayISO();

  return (
    <div className="gratitude-heatmap">
      {months.map((month) => {
        const days = getDaysInMonth(month);
        // Get the day of week for the first day (0=Sun, 1=Mon…)
        const [y, m] = month.split('-').map(Number);
        const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
        // Adjust for Mon-first grid (0=Mon, 6=Sun)
        const offset = (firstDayOfWeek + 6) % 7;

        return (
          <div key={month} className="gratitude-heatmap-month">
            <div className="gratitude-heatmap-month-label">{getMonthLabel(month)}</div>
            <div className="gratitude-heatmap-weekdays">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <span key={i} className="gratitude-heatmap-weekday">{d}</span>
              ))}
            </div>
            <div className="gratitude-heatmap-grid">
              {/* Empty cells for offset */}
              {Array.from({ length: offset }).map((_, i) => (
                <div key={`empty-${i}`} className="gratitude-heatmap-cell gratitude-heatmap-cell--empty" />
              ))}
              {days.map((date) => {
                const count = countByDate.get(date) ?? 0;
                const intensity = maxCount > 0 ? count / maxCount : 0;
                const isToday = date === today;
                return (
                  <div
                    key={date}
                    className={`gratitude-heatmap-cell ${isToday ? 'gratitude-heatmap-cell--today' : ''}`}
                    style={{
                      background: count > 0
                        ? `color-mix(in srgb, var(--cat-souvenirs) ${Math.round(20 + intensity * 65)}%, transparent)`
                        : undefined,
                    }}
                    title={count > 0 ? `${formatDateDisplay(date)} — ${count} entrée${count > 1 ? 's' : ''}` : formatDateDisplay(date)}
                    aria-label={count > 0 ? `${formatDateDisplay(date)}: ${count} entrée${count > 1 ? 's' : ''}` : formatDateDisplay(date)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gratitude entry badge
// ---------------------------------------------------------------------------

interface ProfileBadgeProps {
  name: string;
}

function ProfileBadge({ name }: ProfileBadgeProps) {
  return <span className="gratitude-profile-badge">{name}</span>;
}

// ---------------------------------------------------------------------------
// Add gratitude modal
// ---------------------------------------------------------------------------

interface AddGratitudeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: { id: string; name: string }[];
  onAdd: (profileId: string, profileName: string, text: string, date: string) => Promise<void>;
}

function AddGratitudeModal({ isOpen, onClose, profiles, onAdd }: AddGratitudeModalProps) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setProfileId(profiles[0]?.id ?? '');
    setText('');
    setDate(todayISO());
    setError('');
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  const profileOptions = useMemo(
    () => profiles.map((p) => ({ label: p.name, value: p.id })),
    [profiles],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Le texte est requis.');
      return;
    }
    if (!profileId) {
      setError('Sélectionne un profil.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) throw new Error('Profil introuvable.');
      await onAdd(profile.id, profile.name, trimmed, date);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une gratitude" width="md">
      <form onSubmit={handleSubmit} className="gratitude-form">
        {profileOptions.length > 0 && (
          <div className="form-field">
            <label className="form-label">
              Qui est reconnaissant ? <span className="form-required">*</span>
            </label>
            <SegmentedControl
              options={profileOptions}
              value={profileId}
              onChange={setProfileId}
            />
          </div>
        )}

        <div className="form-field">
          <label className="form-label" htmlFor="gratitude-text">
            Pour quoi es-tu reconnaissant(e) ? <span className="form-required">*</span>
          </label>
          <textarea
            id="gratitude-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Je suis reconnaissant(e) pour..."
            className="form-input gratitude-textarea"
            rows={4}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="gratitude-date">
            Date
          </label>
          <input
            id="gratitude-date"
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
          <Button variant="primary" type="submit" disabled={submitting || !text.trim()}>
            {submitting ? 'Enregistrement...' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Gratitude day block
// ---------------------------------------------------------------------------

interface GratitudeDayBlockProps {
  day: GratitudeDay;
}

function GratitudeDayBlock({ day }: GratitudeDayBlockProps) {
  return (
    <div className="gratitude-day">
      <div className="gratitude-day-header">
        <span className="gratitude-day-date">{formatDateLong(day.date)}</span>
        <span className="gratitude-day-count">{day.entries.length}</span>
      </div>
      <div className="gratitude-entry-list">
        {day.entries.map((entry: GratitudeEntry, idx: number) => (
          <div key={idx} className="gratitude-entry">
            <ProfileBadge name={entry.profileName} />
            <span className="gratitude-entry-text">{entry.text}</span>

            {/* Hover-to-reveal actions */}
            <div className="item-actions" role="group" aria-label="Actions">
              <button
                type="button"
                className="item-action-btn item-action-btn--edit"
                aria-label="Options"
                title="Options"
              >
                ✏️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Gratitude() {
  const { gratitude, profiles, readFile, writeFile, refresh } = useVault();

  const [addModalOpen, setAddModalOpen] = useState(false);

  // Keyboard shortcut: Ctrl/Cmd+R = refresh
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refresh();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refresh]);

  // Count entries by date for the heatmap
  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of gratitude) {
      map.set(day.date, day.entries.length);
    }
    return map;
  }, [gratitude]);

  const maxCount = useMemo(
    () => Math.max(0, ...Array.from(countByDate.values())),
    [countByDate],
  );

  // Last 14 days of data, sorted newest first
  const recentDays = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    return [...gratitude]
      .filter((d) => d.date >= cutoffISO)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [gratitude]);

  const totalDays = gratitude.length;
  const totalEntries = useMemo(
    () => gratitude.reduce((acc, d) => acc + d.entries.length, 0),
    [gratitude],
  );

  const profileOptions = useMemo(
    () => profiles.map((p) => ({ id: p.id, name: p.name })),
    [profiles],
  );

  // ---------------------------------------------------------------------------
  // Add handler
  // ---------------------------------------------------------------------------

  const handleAdd = useCallback(
    async (_profileId: string, profileName: string, text: string, date: string) => {
      const sourceFile = '06 - Mémoires/Gratitude familiale.md';
      let existing = '';
      try {
        existing = await readFile(sourceFile);
      } catch {
        existing = '# Gratitude familiale\n\n';
      }

      const sectionHeader = `## ${date}`;
      const newLine = `- **${profileName}** : ${text}`;

      let content = existing;
      const sectionIdx = content.indexOf(sectionHeader);

      if (sectionIdx !== -1) {
        // Find the end of this section (next ## or end of file)
        const afterHeader = content.indexOf('\n', sectionIdx) + 1;
        // Find next section or EOF
        const nextSection = content.indexOf('\n## ', afterHeader);
        const insertAt = nextSection !== -1 ? nextSection : content.length;
        const block = content.slice(afterHeader, insertAt).replace(/\n+$/, '');
        content =
          content.slice(0, afterHeader) +
          block +
          '\n' +
          newLine +
          '\n' +
          content.slice(insertAt);
      } else {
        // Prepend a new section right after the first line (title)
        const firstNewline = content.indexOf('\n');
        const insertAt = firstNewline !== -1 ? firstNewline + 1 : content.length;
        const before = content.slice(0, insertAt);
        const after = content.slice(insertAt).replace(/^\n+/, '');
        content = `${before}\n${sectionHeader}\n${newLine}\n\n${after}`;
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
    <div className="page gratitude-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Gratitude familiale
            {totalDays > 0 && (
              <span className="gratitude-days-badge">{totalDays}</span>
            )}
          </h1>
          <p className="page-subtitle">
            {totalEntries === 0
              ? 'Aucune gratitude enregistrée'
              : `${totalEntries} entrée${totalEntries > 1 ? 's' : ''} sur ${totalDays} jour${totalDays > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="primary"
          icon="+"
          onClick={() => setAddModalOpen(true)}
        >
          Ajouter
        </Button>
      </div>

      {/* Heatmap */}
      <GlassCard title="3 derniers mois" icon="🗓️" accentColor="var(--cat-souvenirs)" tinted>
        <CalendarHeatmap countByDate={countByDate} maxCount={maxCount} />
        <div className="gratitude-heatmap-legend">
          <span className="gratitude-heatmap-legend-label">Moins</span>
          {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
            <div
              key={i}
              className="gratitude-heatmap-legend-cell"
              style={{
                background: intensity > 0
                  ? `color-mix(in srgb, var(--cat-souvenirs) ${Math.round(20 + intensity * 65)}%, transparent)`
                  : 'var(--border)',
              }}
            />
          ))}
          <span className="gratitude-heatmap-legend-label">Plus</span>
        </div>
      </GlassCard>

      {/* Recent gratitude entries */}
      <GlassCard
        title="14 derniers jours"
        icon="🙏"
        accentColor="var(--cat-souvenirs)"
        count={recentDays.reduce((acc, d) => acc + d.entries.length, 0)}
      >
        {recentDays.length === 0 ? (
          <div className="gratitude-empty">
            <span className="gratitude-empty-icon">🙏</span>
            <p className="gratitude-empty-text">Aucune gratitude récente</p>
            <p className="gratitude-empty-hint">Commence à noter ce pour quoi tu es reconnaissant(e)</p>
          </div>
        ) : (
          <div className="gratitude-day-list">
            {recentDays.map((day) => (
              <GratitudeDayBlock key={day.date} day={day} />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Add modal */}
      <AddGratitudeModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        profiles={profileOptions}
        onAdd={handleAdd}
      />
    </div>
  );
}
