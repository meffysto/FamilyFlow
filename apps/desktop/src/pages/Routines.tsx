import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useVault } from '../contexts/VaultContext';
import type { Routine, RoutineStep } from '@family-vault/core';
import './Routines.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoutineProgress {
  [stepIdx: number]: boolean;
}

// ---------------------------------------------------------------------------
// Timer hook — setInterval-based countdown per step
// ---------------------------------------------------------------------------

function useStepTimer(durationSeconds: number, running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= durationSeconds) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return durationSeconds;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, durationSeconds]);

  const percent = durationSeconds > 0 ? Math.min(100, (elapsed / durationSeconds) * 100) : 0;
  const done = elapsed >= durationSeconds && durationSeconds > 0;

  const reset = useCallback(() => setElapsed(0), []);

  return { elapsed, percent, done, reset };
}

// ---------------------------------------------------------------------------
// StepTimer component
// ---------------------------------------------------------------------------

interface StepTimerProps {
  durationMinutes: number;
  stepIdx: number;
  activeStepIdx: number | null;
  onActivate: (idx: number | null) => void;
}

function StepTimer({ durationMinutes, stepIdx, activeStepIdx, onActivate }: StepTimerProps) {
  const { t } = useTranslation('common');
  const durationSec = durationMinutes * 60;
  const isActive = activeStepIdx === stepIdx;
  const { elapsed, percent, done, reset } = useStepTimer(durationSec, isActive);

  const remaining = durationSec - elapsed;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = `${mins}:${String(secs).padStart(2, '0')}`;

  const handleToggle = () => {
    if (done) {
      reset();
      onActivate(null);
    } else if (isActive) {
      onActivate(null); // pause
    } else {
      onActivate(stepIdx); // start/resume
    }
  };

  return (
    <div className="routine-step-timer">
      <div className="routine-timer-bar-wrap">
        <div
          className="routine-timer-bar-fill"
          style={{
            width: `${percent}%`,
            transition: isActive ? `width 1s linear` : 'none',
          }}
        />
      </div>
      <button
        type="button"
        className={`routine-timer-btn ${done ? 'routine-timer-btn--done' : ''}`}
        onClick={handleToggle}
        title={done ? t('routines.timer.done', 'Terminé') : isActive ? t('routines.timer.pause', 'Pause') : t('routines.timer.start', 'Démarrer')}
        aria-label={done ? 'Terminé' : isActive ? 'Pause timer' : 'Démarrer timer'}
      >
        {done ? '✓' : isActive ? '⏸' : '▶'}
      </button>
      <span className={`routine-timer-label ${done ? 'routine-timer-label--done' : ''}`}>
        {done ? t('routines.timer.done', 'Terminé') : label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step row — draggable per D-02
// ---------------------------------------------------------------------------

interface StepRowProps {
  step: RoutineStep;
  stepIdx: number;
  completed: boolean;
  activeTimerIdx: number | null;
  onToggle: (idx: number) => void;
  onActivateTimer: (idx: number | null) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (idx: number) => void;
  onDrop: () => void;
}

const StepRow = memo(function StepRow({
  step,
  stepIdx,
  completed,
  activeTimerIdx,
  onToggle,
  onActivateTimer,
  onDragStart,
  onDragOver,
  onDrop,
}: StepRowProps) {
  return (
    <div
      className={`routine-step ${completed ? 'routine-step--done' : ''}`}
      draggable
      onDragStart={() => onDragStart(stepIdx)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(stepIdx); }}
      onDrop={onDrop}
    >
      {/* Drag handle */}
      <span className="routine-drag-handle" aria-hidden="true">⠿</span>

      {/* Checkbox */}
      <button
        type="button"
        className={`routine-step-check ${completed ? 'routine-step-check--done' : ''}`}
        onClick={() => onToggle(stepIdx)}
        aria-checked={completed}
        role="checkbox"
        aria-label={`Étape ${stepIdx + 1}`}
      >
        {completed && <span aria-hidden="true">✓</span>}
      </button>

      {/* Text */}
      <span className={`routine-step-text ${completed ? 'routine-step-text--done' : ''}`}>
        {step.text}
      </span>

      {/* Timer (if duration defined) */}
      {step.durationMinutes != null && step.durationMinutes > 0 && (
        <StepTimer
          durationMinutes={step.durationMinutes}
          stepIdx={stepIdx}
          activeStepIdx={activeTimerIdx}
          onActivate={onActivateTimer}
        />
      )}

      {step.durationMinutes != null && step.durationMinutes > 0 && (
        <span className="routine-step-duration">
          {step.durationMinutes} min
        </span>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// RoutineDetail panel
// ---------------------------------------------------------------------------

interface RoutineDetailProps {
  routine: Routine;
  progress: RoutineProgress;
  onToggleStep: (stepIdx: number) => void;
  onClose: () => void;
  onEdit: () => void;
  onReorderSteps: (steps: RoutineStep[]) => void;
}

function RoutineDetail({
  routine,
  progress,
  onToggleStep,
  onClose,
  onEdit,
  onReorderSteps,
}: RoutineDetailProps) {
  const { t } = useTranslation('common');
  const [activeTimerIdx, setActiveTimerIdx] = useState<number | null>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragToIdx, setDragToIdx] = useState<number | null>(null);

  const completedCount = Object.values(progress).filter(Boolean).length;
  const totalSteps = routine.steps.length;
  const allDone = completedCount === totalSteps && totalSteps > 0;

  const handleDrop = () => {
    if (dragFromIdx === null || dragToIdx === null || dragFromIdx === dragToIdx) return;
    const reordered = [...routine.steps];
    const [moved] = reordered.splice(dragFromIdx, 1);
    reordered.splice(dragToIdx, 0, moved);
    onReorderSteps(reordered);
    setDragFromIdx(null);
    setDragToIdx(null);
  };

  return (
    <div className="routine-detail">
      {/* Detail header */}
      <div className="routine-detail-header">
        <div className="routine-detail-title">
          <span className="routine-emoji" aria-hidden="true">{routine.emoji}</span>
          <div>
            <h2 className="routine-detail-name">{routine.label}</h2>
            <span className="routine-detail-progress">
              {completedCount} / {totalSteps} {t('routines.steps', 'étapes')}
            </span>
          </div>
        </div>
        <div className="routine-detail-actions">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            ✏️ {t('routines.edit', 'Modifier')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="routine-overall-progress-wrap">
        <div
          className={`routine-overall-progress-fill ${allDone ? 'routine-overall-progress-fill--done' : ''}`}
          style={{
            width: `${totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0}%`,
            transition: 'width 300ms ease',
          }}
        />
      </div>

      {/* Steps */}
      {routine.steps.length === 0 ? (
        <div className="routine-empty-steps">
          <p>{t('routines.noSteps', 'Aucune étape configurée')}</p>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            {t('routines.addSteps', 'Ajouter des étapes')}
          </Button>
        </div>
      ) : (
        <div className="routine-steps-list">
          {routine.steps.map((step, idx) => (
            <StepRow
              key={idx}
              step={step}
              stepIdx={idx}
              completed={!!progress[idx]}
              activeTimerIdx={activeTimerIdx}
              onToggle={onToggleStep}
              onActivateTimer={setActiveTimerIdx}
              onDragStart={setDragFromIdx}
              onDragOver={setDragToIdx}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {allDone && (
        <div className="routine-complete-banner">
          🎉 {t('routines.complete', 'Routine complétée !')}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoutineForm — creation / edition
// ---------------------------------------------------------------------------

interface RoutineFormProps {
  initial?: Routine;
  onSave: (routine: Omit<Routine, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

function RoutineForm({ initial, onSave, onClose }: RoutineFormProps) {
  const { t } = useTranslation('common');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '⭐');
  const [steps, setSteps] = useState<RoutineStep[]>(initial?.steps ?? []);
  const [newStepText, setNewStepText] = useState('');
  const [newStepDuration, setNewStepDuration] = useState('');

  const canSave = label.trim().length > 0;

  const handleAddStep = () => {
    if (!newStepText.trim()) return;
    const dur = newStepDuration ? parseInt(newStepDuration, 10) : undefined;
    setSteps((prev) => [
      ...prev,
      { text: newStepText.trim(), durationMinutes: dur },
    ]);
    setNewStepText('');
    setNewStepDuration('');
  };

  const handleRemoveStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({
      id: initial?.id,
      label: label.trim(),
      emoji,
      steps,
    });
  };

  return (
    <div className="health-form">
      <div className="health-form-row">
        <div className="health-form-field" style={{ flex: '0 0 80px' }}>
          <label className="health-form-label">{t('routines.form.emoji', 'Icône')}</label>
          <input
            type="text"
            className="health-form-input"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            style={{ textAlign: 'center', fontSize: '1.4em' }}
          />
        </div>
        <div className="health-form-field" style={{ flex: 1 }}>
          <label className="health-form-label">{t('routines.form.name', 'Nom de la routine')}</label>
          <input
            type="text"
            className="health-form-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('routines.form.namePlaceholder', 'ex: Routine du matin')}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="health-form-field">
        <label className="health-form-label">
          {t('routines.form.steps', 'Étapes')} ({steps.length})
        </label>
        <div className="routine-form-steps">
          {steps.map((s, i) => (
            <div key={i} className="routine-form-step-row">
              <span className="routine-form-step-num">{i + 1}</span>
              <span className="routine-form-step-text">{s.text}</span>
              {s.durationMinutes != null && (
                <span className="routine-form-step-dur">{s.durationMinutes} min</span>
              )}
              <button
                type="button"
                className="health-row-delete"
                onClick={() => handleRemoveStep(i)}
                aria-label="Supprimer cette étape"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add step */}
      <div className="routine-add-step-row">
        <input
          type="text"
          className="health-form-input"
          style={{ flex: 1 }}
          value={newStepText}
          onChange={(e) => setNewStepText(e.target.value)}
          placeholder={t('routines.form.stepPlaceholder', 'Nouvelle étape…')}
          onKeyDown={(e) => e.key === 'Enter' && handleAddStep()}
        />
        <input
          type="number"
          className="health-form-input"
          style={{ width: 90 }}
          value={newStepDuration}
          onChange={(e) => setNewStepDuration(e.target.value)}
          placeholder={t('routines.form.durationPlaceholder', 'min')}
          min={1}
          title="Durée en minutes (optionnel)"
        />
        <Button variant="secondary" size="sm" onClick={handleAddStep} disabled={!newStepText.trim()}>
          {t('routines.form.addStep', 'Ajouter')}
        </Button>
      </div>

      <div className="health-form-actions">
        <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Annuler')}</Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          {t('common.save', 'Enregistrer')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoutineCard
// ---------------------------------------------------------------------------

interface RoutineCardProps {
  routine: Routine;
  progress: RoutineProgress;
  onSelect: () => void;
}

const RoutineCard = memo(function RoutineCard({ routine, progress, onSelect }: RoutineCardProps) {
  const { t } = useTranslation('common');
  const completedCount = Object.values(progress).filter(Boolean).length;
  const total = routine.steps.length;
  const pct = total > 0 ? (completedCount / total) * 100 : 0;

  return (
    <div className="routine-card" onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}>
      <div className="routine-card-header">
        <span className="routine-emoji" aria-hidden="true">{routine.emoji}</span>
        <div className="routine-card-info">
          <span className="routine-card-name">{routine.label}</span>
          <span className="routine-card-steps">
            {completedCount}/{total} {t('routines.steps', 'étapes')}
          </span>
        </div>
        <span className="routine-card-arrow" aria-hidden="true">›</span>
      </div>
      {total > 0 && (
        <div className="routine-card-progress-wrap">
          <div
            className="routine-card-progress-fill"
            style={{ width: `${pct}%`, transition: 'width 300ms ease' }}
          />
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Routines() {
  const { t } = useTranslation('common');
  const { routines, saveRoutines, completeRoutineStep } = useVault();

  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  // Session-only progress per routine
  const [progressMap, setProgressMap] = useState<Record<string, RoutineProgress>>({});

  const selectedRoutine = useMemo(
    () => routines.find((r) => r.id === selectedRoutineId) ?? null,
    [routines, selectedRoutineId],
  );

  const selectedProgress = useMemo(
    () => (selectedRoutineId ? progressMap[selectedRoutineId] ?? {} : {}),
    [progressMap, selectedRoutineId],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleStep = useCallback((stepIdx: number) => {
    if (!selectedRoutineId) return;
    setProgressMap((prev) => {
      const cur = prev[selectedRoutineId] ?? {};
      return {
        ...prev,
        [selectedRoutineId]: {
          ...cur,
          [stepIdx]: !cur[stepIdx],
        },
      };
    });
    // Also notify vault context (session-only, as per design decision)
    completeRoutineStep(selectedRoutineId, stepIdx);
  }, [selectedRoutineId, completeRoutineStep]);

  const handleReorderSteps = useCallback(async (steps: RoutineStep[]) => {
    if (!selectedRoutine) return;
    const updated = routines.map((r) =>
      r.id === selectedRoutine.id ? { ...r, steps } : r,
    );
    await saveRoutines(updated);
  }, [routines, selectedRoutine, saveRoutines]);

  const handleCreate = useCallback(async (data: Omit<Routine, 'id'> & { id?: string }) => {
    const newRoutine: Routine = {
      id: `routine-${Date.now()}`,
      label: data.label,
      emoji: data.emoji,
      steps: data.steps,
    };
    await saveRoutines([...routines, newRoutine]);
    setShowCreateModal(false);
  }, [routines, saveRoutines]);

  const handleEdit = useCallback(async (data: Omit<Routine, 'id'> & { id?: string }) => {
    if (!selectedRoutine) return;
    const updated = routines.map((r) =>
      r.id === selectedRoutine.id
        ? { ...selectedRoutine, label: data.label, emoji: data.emoji, steps: data.steps }
        : r,
    );
    await saveRoutines(updated);
    setShowEditModal(false);
  }, [routines, selectedRoutine, saveRoutines]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page routines-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🔄 {t('routines.title', 'Routines')}</h1>
          <p className="page-subtitle">
            {routines.length === 0
              ? t('routines.noRoutines', 'Aucune routine configurée')
              : `${routines.length} routine${routines.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)} icon="＋">
          {t('routines.create', 'Créer une routine')}
        </Button>
      </div>

      {/* Content: list + detail panel side-by-side */}
      <div className="routines-layout">
        {/* Routine cards list */}
        <div className="routines-list">
          {routines.length === 0 ? (
            <GlassCard>
              <div className="health-empty">
                <span className="health-empty-icon">🔄</span>
                <p className="health-empty-text">
                  {t('routines.noRoutinesHint', 'Créez des routines pour organiser les séquences quotidiennes')}
                </p>
                <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)} icon="＋">
                  {t('routines.create', 'Créer une routine')}
                </Button>
              </div>
            </GlassCard>
          ) : (
            <GlassCard
              title={t('routines.myRoutines', 'Mes routines')}
              icon="🔄"
              count={routines.length}
            >
              <div className="routine-card-list">
                {routines.map((routine) => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    progress={progressMap[routine.id] ?? {}}
                    onSelect={() => setSelectedRoutineId(
                      selectedRoutineId === routine.id ? null : routine.id,
                    )}
                  />
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Detail panel */}
        {selectedRoutine && (
          <div className="routines-detail-panel">
            <GlassCard accentColor="var(--primary)">
              <RoutineDetail
                routine={selectedRoutine}
                progress={selectedProgress}
                onToggleStep={handleToggleStep}
                onClose={() => setSelectedRoutineId(null)}
                onEdit={() => setShowEditModal(true)}
                onReorderSteps={handleReorderSteps}
              />
            </GlassCard>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('routines.create', 'Créer une routine')}
        width="md"
      >
        <RoutineForm
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('routines.edit', 'Modifier la routine')}
        width="md"
      >
        {selectedRoutine && (
          <RoutineForm
            initial={selectedRoutine}
            onSave={handleEdit}
            onClose={() => setShowEditModal(false)}
          />
        )}
      </Modal>
    </div>
  );
}
