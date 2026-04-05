import { useState, useMemo, useEffect, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Chip } from '../components/ui/Chip';
import { useVault } from '../contexts/VaultContext';
import type { Defi, DefiType, DefiStatus } from '@family-vault/core';
import './Challenges.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<DefiType, string> = {
  daily:       'Quotidien',
  abstinence:  'Abstinence',
  cumulative:  'Cumulatif',
};

const TYPE_COLORS: Record<DefiType, string> = {
  daily:      '#DB2777', // pink
  abstinence: '#9333EA', // purple
  cumulative: '#0D9488', // teal
};

const DIFFICULTY_LABELS = {
  facile:   'Facile',
  moyen:    'Moyen',
  difficile: 'Difficile',
} as const;

const DIFFICULTY_COLORS = {
  facile:   '#16A34A',
  moyen:    '#F59E0B',
  difficile: '#EF4444',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function progressPercent(defi: Defi): number {
  if (!defi.targetDays || defi.targetDays === 0) return 0;
  const done = defi.progress.filter((e) => e.completed).length;
  return Math.min(100, Math.round((done / defi.targetDays) * 100));
}

function completedDaysCount(defi: Defi): number {
  return defi.progress.filter((e) => e.completed).length;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  percent: number;
  color: string;
}

const ProgressBar = memo(function ProgressBar({ percent, color }: ProgressBarProps) {
  return (
    <div className="defi-progress-wrap">
      <div className="defi-progress-track">
        <div
          className="defi-progress-fill"
          style={{ width: `${percent}%`, background: color }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <span className="defi-progress-pct">{percent}%</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Défi card
// ---------------------------------------------------------------------------

interface DefiCardProps {
  defi: Defi;
  muted?: boolean;
  profiles: import('@family-vault/core').Profile[];
}

const DefiCard = memo(function DefiCard({ defi, muted, profiles }: DefiCardProps) {
  const color = TYPE_COLORS[defi.type];
  const pct = progressPercent(defi);
  const doneDays = completedDaysCount(defi);

  // Resolve participant IDs to names
  const participantNames = useMemo(() => {
    if (!defi.participants || defi.participants.length === 0) return [];
    return defi.participants.map((id) => {
      const profile = profiles.find((p) => p.id === id);
      return profile?.name ?? id;
    });
  }, [defi.participants, profiles]);

  const difficultyColor = DIFFICULTY_COLORS[defi.difficulty] ?? '#6B7280';

  return (
    <div
      className={`defi-card ${muted ? 'defi-card--muted' : ''}`}
      style={{ borderLeftColor: color }}
      role="article"
    >
      {/* Header row */}
      <div className="defi-card-header">
        <div className="defi-card-title-row">
          <span className="defi-card-emoji" aria-hidden="true">{defi.emoji}</span>
          <span className="defi-card-title">{defi.title}</span>

          <div className="defi-card-badges">
            {/* Type badge */}
            <span
              className="defi-type-badge"
              style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
            >
              {TYPE_LABELS[defi.type]}
            </span>

            {/* Difficulty badge */}
            <span
              className="defi-type-badge"
              style={{
                color: difficultyColor,
                background: `color-mix(in srgb, ${difficultyColor} 12%, transparent)`,
              }}
            >
              {DIFFICULTY_LABELS[defi.difficulty] ?? defi.difficulty}
            </span>

            {/* Status indicator */}
            <span
              className={`defi-status-dot defi-status-dot--${defi.status}`}
              title={defi.status}
              aria-label={defi.status}
            />
          </div>
        </div>

        {defi.description && (
          <p className="defi-card-desc">{defi.description}</p>
        )}
      </div>

      {/* Progress */}
      <div className="defi-card-progress">
        <ProgressBar percent={pct} color={color} />
        <span className="defi-days-label">
          {doneDays} / {defi.targetDays} jours
        </span>
      </div>

      {/* Footer */}
      <div className="defi-card-footer">
        {/* Participants */}
        {participantNames.length > 0 && (
          <div className="defi-participants">
            {participantNames.map((name) => (
              <span key={name} className="defi-participant-pill">{name}</span>
            ))}
          </div>
        )}

        {/* Reward */}
        {(defi.rewardPoints > 0 || defi.rewardLootBoxes > 0) && (
          <div className="defi-rewards">
            {defi.rewardPoints > 0 && (
              <span className="defi-reward">⭐ {defi.rewardPoints} pts</span>
            )}
            {defi.rewardLootBoxes > 0 && (
              <span className="defi-reward">🎰 {defi.rewardLootBoxes} coffre{defi.rewardLootBoxes > 1 ? 's' : ''}</span>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="defi-dates">
          {defi.startDate && (
            <span className="defi-date">Début: {formatDate(defi.startDate)}</span>
          )}
          {defi.endDate && (
            <span className="defi-date">Fin: {formatDate(defi.endDate)}</span>
          )}
        </div>

        {/* Hover-to-reveal actions */}
        <div className="item-actions defi-card-actions" role="group" aria-label="Actions">
          <button
            type="button"
            className="item-action-btn"
            aria-label="Modifier le défi"
            title="Modifier"
          >
            ✏️
          </button>
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Stats row
// ---------------------------------------------------------------------------

interface ChallengeStatsProps {
  active: number;
  completed: number;
  bestDays: number;
}

function ChallengeStats({ active, completed, bestDays }: ChallengeStatsProps) {
  return (
    <div className="challenge-stats">
      <div className="challenge-stat">
        <span className="challenge-stat-value">{active}</span>
        <span className="challenge-stat-label">défis actifs</span>
      </div>
      <div className="challenge-stat-divider" />
      <div className="challenge-stat">
        <span className="challenge-stat-value">{completed}</span>
        <span className="challenge-stat-label">terminés</span>
      </div>
      <div className="challenge-stat-divider" />
      <div className="challenge-stat">
        <span className="challenge-stat-value">{bestDays}</span>
        <span className="challenge-stat-label">meilleur score (jours)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter type
// ---------------------------------------------------------------------------

type TypeFilter = 'tous' | DefiType;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Challenges() {
  const { defis, profiles, refresh } = useVault();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('tous');
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [archivedCollapsed, setArchivedCollapsed] = useState(true);

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

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeDefis = useMemo(
    () => defis.filter((d) => d.status === 'active'),
    [defis],
  );

  const completedDefis = useMemo(
    () => defis.filter((d) => d.status === 'completed'),
    [defis],
  );

  const failedDefis = useMemo(
    () => defis.filter((d: Defi) => (d.status as DefiStatus) === 'failed'),
    [defis],
  );

  const archivedDefis = useMemo(
    () => defis.filter((d: Defi) => (d.status as DefiStatus) === 'archived'),
    [defis],
  );

  const filteredActive = useMemo(() => {
    if (typeFilter === 'tous') return activeDefis;
    return activeDefis.filter((d) => d.type === typeFilter);
  }, [activeDefis, typeFilter]);

  const filteredCompleted = useMemo(() => {
    if (typeFilter === 'tous') return completedDefis;
    return completedDefis.filter((d) => d.type === typeFilter);
  }, [completedDefis, typeFilter]);

  // Best score = highest completedDays across all défis
  const bestDays = useMemo(
    () => Math.max(0, ...defis.map((d) => completedDaysCount(d))),
    [defis],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="page challenges-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Défis familiaux
            {activeDefis.length > 0 && (
              <span className="challenges-active-badge">{activeDefis.length}</span>
            )}
          </h1>
          <p className="page-subtitle">
            {defis.length === 0
              ? 'Aucun défi pour le moment'
              : `${activeDefis.length} actif${activeDefis.length > 1 ? 's' : ''} · ${completedDefis.length} terminé${completedDefis.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Stats */}
      {defis.length > 0 && (
        <ChallengeStats
          active={activeDefis.length}
          completed={completedDefis.length}
          bestDays={bestDays}
        />
      )}

      {/* Type filter */}
      {defis.length > 0 && (
        <div className="challenges-filter-bar">
          <Chip label="Tous" selected={typeFilter === 'tous'} onClick={() => setTypeFilter('tous')} />
          <Chip
            label="Quotidien"
            selected={typeFilter === 'daily'}
            onClick={() => setTypeFilter((p) => p === 'daily' ? 'tous' : 'daily')}
          />
          <Chip
            label="Abstinence"
            selected={typeFilter === 'abstinence'}
            onClick={() => setTypeFilter((p) => p === 'abstinence' ? 'tous' : 'abstinence')}
          />
          <Chip
            label="Cumulatif"
            selected={typeFilter === 'cumulative'}
            onClick={() => setTypeFilter((p) => p === 'cumulative' ? 'tous' : 'cumulative')}
          />
        </div>
      )}

      {/* Empty state */}
      {defis.length === 0 && (
        <GlassCard>
          <div className="challenges-empty">
            <span className="challenges-empty-icon">🏆</span>
            <p className="challenges-empty-text">Aucun défi enregistré</p>
            <p className="challenges-empty-hint">
              Ajoute des défis dans ton vault Obsidian (defis.md)
            </p>
          </div>
        </GlassCard>
      )}

      {/* Active défis */}
      {filteredActive.length > 0 && (
        <GlassCard
          title="Défis actifs"
          icon="🔥"
          count={filteredActive.length}
          accentColor="var(--cat-jeux)"
          tinted
        >
          <div className="defi-list">
            {filteredActive.map((defi) => (
              <DefiCard key={defi.id} defi={defi} profiles={profiles} />
            ))}
          </div>
        </GlassCard>
      )}

      {filteredActive.length === 0 && typeFilter !== 'tous' && activeDefis.length > 0 && (
        <GlassCard>
          <div className="challenges-empty">
            <span className="challenges-empty-icon">🔍</span>
            <p className="challenges-empty-text">Aucun défi actif dans cette catégorie</p>
          </div>
        </GlassCard>
      )}

      {/* Completed défis — collapsible */}
      {filteredCompleted.length > 0 && (
        <GlassCard
          title={`Terminés (${filteredCompleted.length})`}
          icon="✅"
          accentColor="#22c55e"
          collapsed={completedCollapsed}
          onToggle={() => setCompletedCollapsed((c) => !c)}
        >
          <div className="defi-list">
            {filteredCompleted.map((defi) => (
              <DefiCard key={defi.id} defi={defi} muted profiles={profiles} />
            ))}
          </div>
        </GlassCard>
      )}

      {/* Failed défis */}
      {failedDefis.length > 0 && (
        <GlassCard
          title={`Échoués (${failedDefis.length})`}
          icon="❌"
          accentColor="#ef4444"
          collapsed
          onToggle={() => { /* noop — stays collapsed */ }}
        >
          <div className="defi-list">
            {failedDefis.map((defi) => (
              <DefiCard key={defi.id} defi={defi} muted profiles={profiles} />
            ))}
          </div>
        </GlassCard>
      )}

      {/* Archived défis */}
      {archivedDefis.length > 0 && (
        <GlassCard
          title={`Archivés (${archivedDefis.length})`}
          icon="📦"
          collapsed={archivedCollapsed}
          onToggle={() => setArchivedCollapsed((c) => !c)}
        >
          <div className="defi-list">
            {archivedDefis.map((defi) => (
              <DefiCard key={defi.id} defi={defi} muted profiles={profiles} />
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
