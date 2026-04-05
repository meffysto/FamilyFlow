import { useMemo, useCallback, useState, useRef, type DragEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { AccentRow } from '../components/ui/AccentRow';
import { Badge } from '../components/ui/Badge';
import { useVault } from '../contexts/VaultContext';
import type { Task, RDV, MealItem, Anniversary } from '@family-vault/core';

// ─── Drag-and-drop card ordering ──────────────────────────────────────────

const STORAGE_KEY = 'dashboard-card-order';

function loadCardOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCardOrder(order: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

function DraggableCard({
  id, children, onDragStart, onDragOver, onDrop, draggingId,
}: {
  id: string;
  children: ReactNode;
  onDragStart: (id: string) => void;
  onDragOver: (e: DragEvent, id: string) => void;
  onDrop: (id: string) => void;
  draggingId: string | null;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`dashboard-card-wrapper${draggingId === id ? ' dragging' : ''}${over ? ' drag-over' : ''}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); onDragStart(id); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); onDragOver(e, id); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(id); }}
      onDragEnd={() => setOver(false)}
    >
      {children}
    </div>
  );
}

// ─── French date formatting ────────────────────────────────────────────────

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function formatDateFr(date: Date): string {
  return `${JOURS[date.getDay()]} ${date.getDate()} ${MOIS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const RDV_TYPE_EMOJI: Record<string, string> = {
  pédiatre: '👨‍⚕️', vaccin: '💉', pmi: '🏥', dentiste: '🦷', urgences: '🚑',
  école: '🏫', activité: '⚽', administratif: '🏛️', social: '👥', autre: '📋',
};

function labelFromPath(path: string): string {
  const parts = path.split('/');
  const segment = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  return segment.replace(/^\d+\s*-\s*/, '').trim() || segment;
}

function getNextAnniversaries(anniversaries: Anniversary[], count: number): (Anniversary & { daysUntil: number; nextAge?: number })[] {
  const now = new Date();
  const todayMs = now.getTime();

  return anniversaries
    .map((a) => {
      // date format is "MM-DD"
      const [m, d] = (a.date || '').split('-').map(Number);
      if (!m || !d) return null;
      const thisYear = new Date(now.getFullYear(), m - 1, d);
      if (thisYear.getTime() < todayMs - 86400000) {
        thisYear.setFullYear(now.getFullYear() + 1);
      }
      const daysUntil = Math.ceil((thisYear.getTime() - todayMs) / 86400000);
      const nextAge = a.birthYear ? thisYear.getFullYear() - a.birthYear : undefined;
      return { ...a, daysUntil, nextAge };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, count);
}

function getTodayMeals(meals: MealItem[]): MealItem[] {
  const today = JOURS_SEMAINE[new Date().getDay()];
  return meals.filter((m) => {
    const day = (m.day || '').toLowerCase();
    return day === today || day.startsWith(today);
  });
}

const MEAL_EMOJI: Record<string, string> = {
  'petit-déjeuner': '🥐', 'petit-dej': '🥐', 'petit-déj': '🥐', 'pdj': '🥐',
  'déjeuner': '🍽️', 'midi': '🍽️',
  'dîner': '🌙', 'soir': '🌙', 'dinner': '🌙',
  'goûter': '🍪', 'gouter': '🍪',
};

function getMealEmoji(type: string): string {
  const lower = type.toLowerCase();
  for (const [key, emoji] of Object.entries(MEAL_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '🍽️';
}

// ─── Checkbox component ────────────────────────────────────────────────────

function TaskCheck({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const [toggling, setToggling] = useState(false);

  const handleClick = useCallback(async () => {
    setToggling(true);
    await onToggle(task);
    setToggling(false);
  }, [task, onToggle]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggling}
      className={`dash-checkbox ${task.completed ? 'dash-checkbox--done' : ''}`}
      aria-checked={task.completed}
      role="checkbox"
    >
      {task.completed && <span className="dash-checkbox-mark">✓</span>}
    </button>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    files, tasks, rdvs, meals, courses, anniversaries, profiles,
    activeProfile, loading, toggleTask,
  } = useVault();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => formatDateFr(today), [today]);
  const todayStr = today.toISOString().slice(0, 10);

  // ── Derived data ───────────────────────────────────────────────────────

  const pendingTasks = useMemo(
    () => tasks.filter((t) => !t.completed),
    [tasks],
  );

  const overdueTasks = useMemo(
    () => pendingTasks.filter((t) => t.dueDate && t.dueDate < todayStr),
    [pendingTasks, todayStr],
  );

  const todayRdvs = useMemo(
    () => rdvs.filter((r) => r.date_rdv === todayStr),
    [rdvs, todayStr],
  );

  const upcomingRdvs = useMemo(
    () => rdvs
      .filter((r) => r.date_rdv > todayStr && r.statut !== 'annulé')
      .sort((a, b) => a.date_rdv.localeCompare(b.date_rdv))
      .slice(0, 3),
    [rdvs, todayStr],
  );

  const todayMeals = useMemo(() => getTodayMeals(meals), [meals]);

  const pendingCourses = useMemo(
    () => courses.filter((c) => !c.completed),
    [courses],
  );

  const nextAnniversaries = useMemo(
    () => getNextAnniversaries(anniversaries, 3),
    [anniversaries],
  );

  const completedToday = useMemo(
    () => tasks.filter((t) => t.completed).length,
    [tasks],
  );

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    async (task: Task) => {
      try {
        await toggleTask(task);
      } catch { /* silent */ }
    },
    [toggleTask],
  );

  // ── Drag-and-drop ───────────────────────────────────────────────────

  const draggingRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const DEFAULT_ORDER = ['overdue', 'tasks', 'rdv', 'meals', 'courses', 'anniversaires', 'stats'];

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    return loadCardOrder() ?? DEFAULT_ORDER;
  });

  const handleDragStart = useCallback((id: string) => {
    draggingRef.current = id;
    setDraggingId(id);
  }, []);

  const handleDragOver = useCallback((_e: DragEvent, _id: string) => {
    // just prevent default (done in DraggableCard)
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    const sourceId = draggingRef.current;
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      return;
    }
    setCardOrder((prev) => {
      const next = [...prev];
      const srcIdx = next.indexOf(sourceId);
      const tgtIdx = next.indexOf(targetId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, sourceId);
      saveCardOrder(next);
      return next;
    });
    draggingRef.current = null;
    setDraggingId(null);
  }, []);

  // ── Card definitions ──────────────────────────────────────────────

  const cardMap = useMemo(() => {
    const map: Record<string, { visible: boolean; node: ReactNode }> = {
      overdue: {
        visible: overdueTasks.length > 0,
        node: (
          <GlassCard title="En retard" icon="⚠️" count={overdueTasks.length} accentColor="var(--error)" tinted>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {overdueTasks.slice(0, 5).map((task, i) => (
                <AccentRow key={`${task.sourceFile}-${task.lineIndex}-${i}`} accentColor="var(--error)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TaskCheck task={task} onToggle={handleToggle} />
                    <div>
                      <div style={{ fontSize: 'var(--font-size-body)', fontWeight: 500, color: 'var(--text)' }}>
                        {task.text}
                      </div>
                      {task.dueDate && (
                        <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--error)' }}>
                          📅 {formatShortDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </AccentRow>
              ))}
            </div>
          </GlassCard>
        ),
      },
      tasks: {
        visible: true,
        node: (
          <GlassCard title="Tâches du jour" icon="📋" count={pendingTasks.length} accentColor="var(--cat-organisation)" linkText="Voir tout →" onLinkClick={() => navigate('/tasks')}>
            {pendingTasks.length === 0 ? (
              <div className="empty-section">
                <span style={{ fontSize: 28, opacity: 0.6 }}>✅</span>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 4 }}>Aucune tâche en attente</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {pendingTasks.slice(0, 8).map((task, i) => (
                  <div key={`${task.sourceFile}-${task.lineIndex}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                    <TaskCheck task={task} onToggle={handleToggle} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--font-size-body)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.text}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        {task.dueDate && (
                          <Badge variant={task.dueDate === todayStr ? 'warning' : task.dueDate < todayStr ? 'error' : 'default'} size="sm">
                            📅 {formatShortDate(task.dueDate)}
                          </Badge>
                        )}
                        {task.mentions?.map((a) => (
                          <Badge key={a} variant="info" size="sm">@{a}</Badge>
                        ))}
                        <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-faint)' }}>
                          {labelFromPath(task.sourceFile)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingTasks.length > 8 && (
                  <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-muted)', paddingLeft: 30 }}>
                    +{pendingTasks.length - 8} autres tâches
                  </p>
                )}
              </div>
            )}
          </GlassCard>
        ),
      },
      rdv: {
        visible: true,
        node: (
          <GlassCard title="Rendez-vous" icon="📆" count={todayRdvs.length + upcomingRdvs.length} accentColor="var(--cat-sante)" linkText="Voir tout →" onLinkClick={() => navigate('/calendar')}>
            {todayRdvs.length === 0 && upcomingRdvs.length === 0 ? (
              <div className="empty-section">
                <span style={{ fontSize: 28, opacity: 0.6 }}>📅</span>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 4 }}>Pas de rendez-vous à venir</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {todayRdvs.length > 0 && (
                  <p style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--cat-sante)', marginBottom: 2 }}>Aujourd'hui</p>
                )}
                {todayRdvs.map((rdv) => (
                  <AccentRow key={rdv.sourceFile} accentColor="var(--cat-sante)">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{RDV_TYPE_EMOJI[rdv.type_rdv] || '📋'}</span>
                        <strong style={{ fontSize: 'var(--font-size-body)' }}>{rdv.heure && `${rdv.heure} — `}{rdv.title}</strong>
                        {rdv.enfant && <Badge variant="info" size="sm">{rdv.enfant}</Badge>}
                      </div>
                      {rdv.médecin && (
                        <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-muted)', marginTop: 2 }}>👨‍⚕️ {rdv.médecin}</p>
                      )}
                    </div>
                  </AccentRow>
                ))}
                {upcomingRdvs.length > 0 && (
                  <>
                    <p style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--text-muted)', marginTop: 8, marginBottom: 2 }}>À venir</p>
                    {upcomingRdvs.map((rdv) => (
                      <AccentRow key={rdv.sourceFile} accentColor="var(--info)">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--info)' }}>{formatShortDate(rdv.date_rdv)}</span>
                            <span>{RDV_TYPE_EMOJI[rdv.type_rdv] || '📋'}</span>
                            <span style={{ fontSize: 'var(--font-size-body)' }}>{rdv.title}</span>
                            {rdv.enfant && <Badge variant="info" size="sm">{rdv.enfant}</Badge>}
                          </div>
                        </div>
                      </AccentRow>
                    ))}
                  </>
                )}
              </div>
            )}
          </GlassCard>
        ),
      },
      meals: {
        visible: true,
        node: (
          <GlassCard title="Repas du jour" icon="🍽️" accentColor="var(--cat-organisation)" linkText="Voir tout →" onLinkClick={() => navigate('/meals')}>
            {todayMeals.length === 0 ? (
              <div className="empty-section">
                <span style={{ fontSize: 28, opacity: 0.6 }}>🍳</span>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 4 }}>Menu non planifié</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {todayMeals.map((meal, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{getMealEmoji(meal.mealType || '')}</span>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-caption)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{meal.mealType}</div>
                      <div style={{ fontSize: 'var(--font-size-body)', fontWeight: 500, color: 'var(--text)' }}>{meal.text || 'Non planifié'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        ),
      },
      courses: {
        visible: pendingCourses.length > 0,
        node: (
          <GlassCard title="Courses" icon="🛒" count={pendingCourses.length} accentColor="var(--cat-organisation)" linkText="Voir tout →" onLinkClick={() => navigate('/shopping')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {pendingCourses.slice(0, 5).map((item, i) => (
                <div key={i} style={{ fontSize: 'var(--font-size-body)', color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid var(--border-light)' }}>
                  • {item.text}
                  {item.section && <span style={{ fontSize: 'var(--font-size-micro)', color: 'var(--text-faint)', marginLeft: 6 }}>{item.section}</span>}
                </div>
              ))}
              {pendingCourses.length > 5 && (
                <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-muted)' }}>+{pendingCourses.length - 5} autres articles</p>
              )}
            </div>
          </GlassCard>
        ),
      },
      anniversaires: {
        visible: nextAnniversaries.length > 0,
        node: (
          <GlassCard title="Anniversaires" icon="🎂" accentColor="var(--cat-famille)" linkText="Voir tout →" onLinkClick={() => navigate('/birthdays')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {nextAnniversaries.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-body)', fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                    <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-muted)' }}>{a.date}{a.nextAge != null && ` — ${a.nextAge} ans`}</div>
                  </div>
                  <Badge variant={a.daysUntil === 0 ? 'success' : a.daysUntil <= 7 ? 'warning' : 'default'} size="sm">
                    {a.daysUntil === 0 ? "Aujourd'hui !" : `J-${a.daysUntil}`}
                  </Badge>
                </div>
              ))}
            </div>
          </GlassCard>
        ),
      },
      stats: {
        visible: true,
        node: (
          <GlassCard title="Vue d'ensemble" icon="📊" accentColor="var(--info)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { value: pendingTasks.length, label: 'En attente', color: 'var(--cat-organisation)' },
                { value: completedToday, label: 'Terminées', color: 'var(--success)' },
                { value: rdvs.length, label: 'Rendez-vous', color: 'var(--cat-sante)' },
                { value: meals.length, label: 'Repas planifiés', color: 'var(--cat-organisation)' },
                { value: profiles.length, label: 'Profils', color: 'var(--cat-famille)' },
                { value: files.length, label: 'Fichiers', color: 'var(--info)' },
              ].map((stat) => (
                <div key={stat.label} style={{ textAlign: 'center', padding: 12, background: 'var(--card-alt)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-size-display)', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        ),
      },
    };
    return map;
  }, [overdueTasks, pendingTasks, todayRdvs, upcomingRdvs, todayMeals, pendingCourses, nextAnniversaries, completedToday, rdvs, meals, profiles, files, todayStr, navigate, handleToggle]);

  // Ensure order includes all known cards (handles new cards added later)
  const orderedCards = useMemo(() => {
    const known = Object.keys(cardMap);
    const ordered = cardOrder.filter((id) => known.includes(id));
    const missing = known.filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [cardOrder, cardMap]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {activeProfile
              ? `Bonjour ${activeProfile.name} 👋`
              : 'Aujourd\'hui'}
          </h1>
          <p className="page-subtitle">{dateLabel}</p>
        </div>
        {!loading && (
          <span className="vault-badge">{files.length} fichiers</span>
        )}
      </div>

      {/* Dashboard grid — masonry + drag-and-drop */}
      <div className="dashboard-grid" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
        {orderedCards.map((id) => {
          const card = cardMap[id];
          if (!card || !card.visible) return null;
          return (
            <DraggableCard
              key={id}
              id={id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              draggingId={draggingId}
            >
              {card.node}
            </DraggableCard>
          );
        })}
      </div>
    </div>
  );
}
