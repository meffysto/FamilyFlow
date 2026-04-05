import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Badge } from '../components/ui/Badge';
import { SearchInput } from '../components/ui/SearchInput';
import { Modal } from '../components/ui/Modal';
import { useVault } from '../contexts/VaultContext';
import type { Task } from '@family-vault/core';
import './Tasks.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10);

/** Extract a readable label from a vault relative path.
 *  "02 - Maison/Tâches récurrentes.md" → "Maison"
 *  "02 - Quotidien/Tâches.md"          → "Quotidien"
 */
function labelFromPath(path: string): string {
  const parts = path.split('/');
  // Use the folder name if there are multiple parts, else the file stem
  const segment = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  // Strip leading number prefix like "02 - "
  const cleaned = segment.replace(/^\d+\s*-\s*/, '').trim();
  return cleaned || segment;
}

function compareDateStatus(dueDate: string): 'overdue' | 'today' | 'upcoming' {
  if (dueDate < TODAY) return 'overdue';
  if (dueDate === TODAY) return 'today';
  return 'upcoming';
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Checkbox — styled circle with animated fill
// ---------------------------------------------------------------------------

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

const TaskCheckbox = memo(function TaskCheckbox({ checked, onChange, disabled }: CheckboxProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-checked={checked}
      role="checkbox"
      className={`task-checkbox ${checked ? 'task-checkbox--checked' : ''}`}
    >
      {checked && (
        <span className="task-checkbox-mark" aria-hidden="true">✓</span>
      )}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Due date badge
// ---------------------------------------------------------------------------

interface DueDateBadgeProps {
  dueDate: string;
}

const DueDateBadge = memo(function DueDateBadge({ dueDate }: DueDateBadgeProps) {
  const status = compareDateStatus(dueDate);
  const variant = status === 'overdue' ? 'error' : status === 'today' ? 'warning' : 'default';
  return (
    <Badge variant={variant} size="sm">
      {formatDate(dueDate)}
    </Badge>
  );
});

// ---------------------------------------------------------------------------
// Single task row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: Task;
  toggling: boolean;
  onToggle: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

const TaskRow = memo(function TaskRow({ task, toggling, onToggle, onDelete }: TaskRowProps) {
  return (
    <div className={`task-row ${task.completed ? 'task-row--completed' : ''} ${toggling ? 'task-row--toggling' : ''}`}>
      <TaskCheckbox
        checked={task.completed}
        onChange={() => onToggle(task)}
        disabled={toggling}
      />

      <span className={`task-row-text ${task.completed ? 'task-row-text--done' : ''}`}>
        {task.text}
      </span>

      <div className="task-row-meta">
        {task.dueDate && !task.completed && (
          <DueDateBadge dueDate={task.dueDate} />
        )}

        {task.recurrence && (
          <span className="task-row-recurrence" title={task.recurrence} aria-label={`Récurrence : ${task.recurrence}`}>
            🔄
          </span>
        )}

        {task.mentions && task.mentions.length > 0 && (
          <div className="task-row-assignees">
            {task.mentions.map((mention) => (
              <span key={mention} className="task-assignee-pill">
                @{mention}
              </span>
            ))}
          </div>
        )}

        {/* Points badge — shown from tags or a hypothetical points field */}
        {(task as Task & { points?: number }).points != null && (
          <span className="task-points-badge">
            ⭐ {(task as Task & { points?: number }).points} pts
          </span>
        )}
      </div>

      {/* Hover-to-reveal actions */}
      {onDelete && (
        <div className="item-actions" role="group" aria-label="Actions">
          <button
            type="button"
            className="item-action-btn item-action-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(task); }}
            aria-label="Supprimer la tâche"
            title="Supprimer"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Group header (per source file)
// ---------------------------------------------------------------------------

interface GroupHeaderProps {
  label: string;
  pendingCount: number;
}

function GroupHeader({ label, pendingCount }: GroupHeaderProps) {
  return (
    <div className="task-group-header">
      <span className="task-group-label">{label}</span>
      {pendingCount > 0 && (
        <span className="task-group-count">{pendingCount}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overdue warning card
// ---------------------------------------------------------------------------

interface OverdueSectionProps {
  tasks: Task[];
  togglingIds: Set<string>;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function OverdueSection({ tasks, togglingIds, onToggle, onDelete }: OverdueSectionProps) {
  if (tasks.length === 0) return null;
  return (
    <GlassCard
      title={`En retard (${tasks.length})`}
      icon="⚠️"
      accentColor="#ef4444"
      tinted
    >
      <div className="overdue-list">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            toggling={togglingIds.has(task.id)}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Add-task modal
// ---------------------------------------------------------------------------

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceFiles: string[];
  profileNames: string[];
  onAdd: (
    text: string,
    sourceFile: string,
    dueDate: string,
    assignees: string[],
  ) => Promise<void>;
}

function AddTaskModal({ isOpen, onClose, sourceFiles, profileNames, onAdd }: AddTaskModalProps) {
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(sourceFiles[0] ?? '');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  const handleOpen = useCallback(() => {
    setText('');
    setDueDate('');
    setSelectedFile(sourceFiles[0] ?? '');
    setSelectedAssignees([]);
    setError('');
  }, [sourceFiles]);

  // Track open state to reset form
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    handleOpen();
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  function toggleAssignee(name: string) {
    setSelectedAssignees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Le texte de la tâche est requis.');
      return;
    }
    if (!selectedFile) {
      setError('Sélectionne un fichier de destination.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onAdd(trimmed, selectedFile, dueDate, selectedAssignees);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout de la tâche.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle tâche" width="md">
      <form onSubmit={handleSubmit} className="add-task-form">
        {/* Task text */}
        <div className="form-field">
          <label className="form-label" htmlFor="task-text">
            Tâche <span className="form-required">*</span>
          </label>
          <input
            id="task-text"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Description de la tâche..."
            className="form-input"
            autoFocus
          />
        </div>

        {/* Due date */}
        <div className="form-field">
          <label className="form-label" htmlFor="task-due-date">
            Date d'échéance
          </label>
          <input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="form-input form-input--date"
          />
        </div>

        {/* Source file */}
        <div className="form-field">
          <label className="form-label" htmlFor="task-source-file">
            Fichier de destination
          </label>
          {sourceFiles.length > 0 ? (
            <select
              id="task-source-file"
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="form-select"
            >
              {sourceFiles.map((f) => (
                <option key={f} value={f}>
                  {labelFromPath(f)}
                </option>
              ))}
            </select>
          ) : (
            <p className="form-hint">Aucun fichier de tâches trouvé dans le vault.</p>
          )}
        </div>

        {/* Assignees */}
        {profileNames.length > 0 && (
          <div className="form-field">
            <label className="form-label">Assigner à</label>
            <div className="form-assignees">
              {profileNames.map((name) => (
                <label key={name} className="form-assignee-option">
                  <input
                    type="checkbox"
                    checked={selectedAssignees.includes(name)}
                    onChange={() => toggleAssignee(name)}
                    className="form-assignee-checkbox"
                  />
                  <span className="form-assignee-name">{name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
            {submitting ? 'Ajout...' : 'Ajouter la tâche'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'pending' | 'completed';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Tasks() {
  const { tasks, profiles, readFile, writeFile, refresh, files } = useVault();

  // UI state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Toggling state — tracks task IDs being toggled to prevent double-clicks
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  /** All unique source files from tasks */
  const sourceFiles = useMemo(() => {
    const seen = new Set<string>();
    tasks.forEach((t) => {
      if (t.sourceFile) seen.add(t.sourceFile);
    });
    return Array.from(seen).sort();
  }, [tasks]);

  /** Profile names for assignee picker */
  const profileNames = useMemo(
    () => profiles.map((p) => p.name).filter(Boolean),
    [profiles],
  );

  /** All vault task files discovered from the file listing (for the modal picker) */
  const taskFilePaths = useMemo(() => {
    if (sourceFiles.length > 0) return sourceFiles;
    // Fallback: scan file listing for likely task files
    return files
      .filter((f) => f.name.toLowerCase().includes('tâche') || f.name.toLowerCase().includes('tache'))
      .map((f) => f.relative_path);
  }, [sourceFiles, files]);

  /** Filtered + searched tasks */
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (sourceFilter) {
      result = result.filter((t) => t.sourceFile === sourceFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => t.text.toLowerCase().includes(q));
    }

    if (statusFilter === 'pending') {
      result = result.filter((t) => !t.completed);
    } else if (statusFilter === 'completed') {
      result = result.filter((t) => t.completed);
    }

    return result;
  }, [tasks, search, statusFilter, sourceFilter]);

  const pendingTasks = useMemo(
    () => filteredTasks.filter((t) => !t.completed),
    [filteredTasks],
  );

  const completedTasks = useMemo(
    () => filteredTasks.filter((t) => t.completed),
    [filteredTasks],
  );

  const overdueTasks = useMemo(
    () =>
      pendingTasks.filter(
        (t) => t.dueDate && compareDateStatus(t.dueDate) === 'overdue',
      ),
    [pendingTasks],
  );

  /** Group pending tasks by sourceFile */
  const groupedPending = useMemo(() => {
    const map = new Map<string, Task[]>();
    pendingTasks.forEach((t) => {
      const key = t.sourceFile || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).map(([file, taskList]) => ({
      file,
      label: file ? labelFromPath(file) : 'Sans fichier',
      tasks: taskList,
      pendingCount: taskList.filter((t) => !t.completed).length,
    }));
  }, [pendingTasks]);

  // ---------------------------------------------------------------------------
  // Toggle task (inline implementation — reads & writes file back)
  // ---------------------------------------------------------------------------

  const handleToggle = useCallback(
    async (task: Task) => {
      if (togglingIds.has(task.id)) return;
      setTogglingIds((prev) => new Set(prev).add(task.id));
      try {
        const content = await readFile(task.sourceFile);
        const lines = content.split('\n');
        const line = lines[task.lineIndex];
        if (line === undefined) return;

        let updatedLine: string;
        if (task.completed) {
          // Uncheck: replace "- [x]" with "- [ ]", remove ✅ date
          updatedLine = line
            .replace(/^(\s*- \[)[xX](\])/, '$1 $2')
            .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
        } else {
          // Check: replace "- [ ]" with "- [x]", append ✅ date
          updatedLine = line
            .replace(/^(\s*- \[)\s(\])/, `$1x$2`)
            .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
          updatedLine = `${updatedLine} ✅ ${TODAY}`;
        }

        lines[task.lineIndex] = updatedLine;
        await writeFile(task.sourceFile, lines.join('\n'));
        await refresh();
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[Tasks] toggle error', err);
        }
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }
    },
    [togglingIds, readFile, writeFile, refresh],
  );

  // ---------------------------------------------------------------------------
  // Add task
  // ---------------------------------------------------------------------------

  const handleAddTask = useCallback(
    async (
      text: string,
      sourceFile: string,
      dueDate: string,
      assignees: string[],
    ) => {
      // Build the markdown line
      let line = `- [ ] ${text}`;
      if (dueDate) line += ` 📅 ${dueDate}`;
      if (assignees.length > 0) {
        line += ' ' + assignees.map((a) => `@${a}`).join(' ');
      }

      const existing = await readFile(sourceFile);
      // Append before any trailing newlines, then re-add newline
      const trimmed = existing.replace(/\n+$/, '');
      await writeFile(sourceFile, `${trimmed}\n${line}\n`);
      await refresh();
    },
    [readFile, writeFile, refresh],
  );

  // ---------------------------------------------------------------------------
  // Delete task (removes the line from the source file)
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(
    async (task: Task) => {
      if (!task.sourceFile) return;
      try {
        const content = await readFile(task.sourceFile);
        const lines = content.split('\n');
        lines.splice(task.lineIndex, 1);
        await writeFile(task.sourceFile, lines.join('\n'));
        await refresh();
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[Tasks] delete error', err);
        }
      }
    },
    [readFile, writeFile, refresh],
  );

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts: Ctrl/Cmd+R = refresh
  // ---------------------------------------------------------------------------

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
  // Pending count for subtitle (ignores filters to always show real count)
  // ---------------------------------------------------------------------------

  const globalPendingCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="page tasks-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tâches</h1>
          <p className="page-subtitle">
            {globalPendingCount === 0
              ? 'Toutes les tâches sont terminées'
              : `${globalPendingCount} tâche${globalPendingCount > 1 ? 's' : ''} en attente`}
          </p>
        </div>
        <Button
          variant="primary"
          icon="+"
          onClick={() => setAddModalOpen(true)}
        >
          Nouvelle tâche
        </Button>
      </div>

      {/* Filter bar */}
      <div className="tasks-filter-bar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une tâche..."
        />

        <div className="tasks-chip-row">
          {/* Status chips */}
          <Chip
            label="Toutes"
            selected={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <Chip
            label="En attente"
            selected={statusFilter === 'pending'}
            onClick={() => setStatusFilter('pending')}
          />
          <Chip
            label="Terminées"
            selected={statusFilter === 'completed'}
            onClick={() => setStatusFilter('completed')}
          />

          {/* Source file chips — only when multiple source files exist */}
          {sourceFiles.length > 1 && (
            <>
              <span className="tasks-chip-divider" aria-hidden="true" />
              <Chip
                label="Tous les fichiers"
                selected={sourceFilter === null}
                onClick={() => setSourceFilter(null)}
              />
              {sourceFiles.map((file) => (
                <Chip
                  key={file}
                  label={labelFromPath(file)}
                  selected={sourceFilter === file}
                  onClick={() =>
                    setSourceFilter((prev) => (prev === file ? null : file))
                  }
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Overdue warning card */}
      {overdueTasks.length > 0 && statusFilter !== 'completed' && (
        <OverdueSection
          tasks={overdueTasks}
          togglingIds={togglingIds}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      )}

      {/* Pending tasks grouped by file */}
      {statusFilter !== 'completed' && (
        <>
          {groupedPending.length === 0 && pendingTasks.length === 0 && (
            <div className="tasks-empty-state">
              {search ? (
                <>
                  <span className="tasks-empty-icon">🔍</span>
                  <p className="tasks-empty-text">Aucune tâche ne correspond à "{search}"</p>
                </>
              ) : (
                <>
                  <span className="tasks-empty-icon">✅</span>
                  <p className="tasks-empty-text">Aucune tâche en attente</p>
                  <p className="tasks-empty-hint">Ajoute une tâche pour commencer</p>
                </>
              )}
            </div>
          )}

          {groupedPending.map(({ file, label, tasks: groupTasks, pendingCount }) => (
            <div key={file} className="task-group">
              <GroupHeader label={label} pendingCount={pendingCount} />
              <div className="task-group-body">
                {groupTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    toggling={togglingIds.has(task.id)}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Completed tasks — collapsible */}
      {(statusFilter === 'all' || statusFilter === 'completed') &&
        completedTasks.length > 0 && (
          <GlassCard
            title={`Terminées (${completedTasks.length})`}
            icon="✅"
            accentColor="#22c55e"
            collapsed={statusFilter === 'all' ? completedCollapsed : false}
            onToggle={
              statusFilter === 'all'
                ? () => setCompletedCollapsed((c) => !c)
                : undefined
            }
          >
            <div className="task-group-body">
              {completedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  toggling={togglingIds.has(task.id)}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </GlassCard>
        )}

      {/* Add task modal */}
      <AddTaskModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        sourceFiles={taskFilePaths}
        profileNames={profileNames}
        onAdd={handleAddTask}
      />
    </div>
  );
}
