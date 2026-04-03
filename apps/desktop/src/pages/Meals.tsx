import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useVault } from '../contexts/VaultContext';
import type { MealItem, CourseItem } from '@family-vault/core';
import './Meals.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const MEAL_EMOJI: Record<string, string> = {
  'Petit-déj': '🥐',
  'Petit-déjeuner': '🥐',
  'Déjeuner': '🍽️',
  'Dîner': '🌙',
  'Goûter': '🍪',
};

const MEAL_ORDER = ['Petit-déj', 'Petit-déjeuner', 'Déjeuner', 'Dîner', 'Goûter'];

const COURSES_FILE = '02 - Maison/Liste de courses.md';

const TABS = [
  { label: 'Repas', value: 'repas' },
  { label: 'Courses', value: 'courses' },
  { label: 'Recettes', value: 'recettes' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayJour(): string {
  // Returns French day name for today
  const day = new Date().getDay(); // 0=Sunday, 1=Monday...
  // Shift: Sunday (0) → index 6, Monday (1) → index 0
  const idx = day === 0 ? 6 : day - 1;
  return JOURS[idx] ?? 'Lundi';
}

function getMealEmoji(mealType: string): string {
  return MEAL_EMOJI[mealType] ?? '🍴';
}

function sortMealTypes(meals: MealItem[]): MealItem[] {
  return [...meals].sort((a, b) => {
    const ai = MEAL_ORDER.indexOf(a.mealType);
    const bi = MEAL_ORDER.indexOf(b.mealType);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function getWeekLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------------------
// MealCheckbox (course checkbox)
// ---------------------------------------------------------------------------

interface CourseCheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

const CourseCheckbox = memo(function CourseCheckbox({ checked, onChange, disabled }: CourseCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      disabled={disabled}
      aria-checked={checked}
      role="checkbox"
      className={`meals-course-checkbox ${checked ? 'meals-course-checkbox--checked' : ''}`}
    >
      {checked && (
        <span className="meals-course-checkbox-mark" aria-hidden="true">✓</span>
      )}
    </button>
  );
});

// ---------------------------------------------------------------------------
// MealRow — single meal slot with inline edit
// ---------------------------------------------------------------------------

interface MealRowProps {
  meal: MealItem | null;
  mealType: string;
  onSave: (mealType: string, text: string) => Promise<void>;
}

const MealRow = memo(function MealRow({ meal, mealType, onSave }: MealRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentText = meal?.text ?? '';

  function startEdit() {
    setDraft(currentText);
    setEditing(true);
    // Focus after paint
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function commitEdit() {
    if (saving) return;
    const trimmed = draft.trim();
    setSaving(true);
    try {
      await onSave(mealType, trimmed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setDraft('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  return (
    <div
      className={`meals-meal-row ${editing ? 'meals-meal-row--editing' : ''}`}
      onClick={editing ? undefined : startEdit}
      role={editing ? undefined : 'button'}
      tabIndex={editing ? undefined : 0}
      onKeyDown={editing ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') startEdit(); }}
      aria-label={editing ? undefined : `Modifier ${mealType}`}
    >
      <span className="meals-meal-emoji" aria-hidden="true">
        {getMealEmoji(mealType)}
      </span>

      <span className="meals-meal-type">{mealType}</span>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="meals-meal-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          disabled={saving}
          placeholder="Nom du repas..."
          aria-label={`Repas ${mealType}`}
        />
      ) : (
        <span
          className={`meals-meal-text ${currentText === '' ? 'meals-meal-text--empty' : ''}`}
        >
          {currentText || 'Non planifié'}
        </span>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// DayCard
// ---------------------------------------------------------------------------

interface DayCardProps {
  jour: string;
  isToday: boolean;
  meals: MealItem[];
  onSaveMeal: (jour: string, mealType: string, text: string) => Promise<void>;
}

const DayCard = memo(function DayCard({ jour, isToday, meals, onSaveMeal }: DayCardProps) {
  // Build a complete set of meal types for this day
  const presentTypes = new Set(meals.map((m) => m.mealType));
  const defaultTypes = ['Petit-déj', 'Déjeuner', 'Dîner'];
  // Merge present types with defaults, maintaining order
  const allTypes = Array.from(new Set([...defaultTypes, ...presentTypes])).sort(
    (a, b) => {
      const ai = MEAL_ORDER.indexOf(a);
      const bi = MEAL_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
  );

  const mealsByType = useMemo(() => {
    const map: Record<string, MealItem> = {};
    meals.forEach((m) => { map[m.mealType] = m; });
    return map;
  }, [meals]);

  const handleSave = useCallback(
    (mealType: string, text: string) => onSaveMeal(jour, mealType, text),
    [jour, onSaveMeal],
  );

  return (
    <GlassCard
      tinted={isToday}
      accentColor="var(--primary)"
    >
      <div className="meals-day-header">
        <span className="meals-day-name">{jour}</span>
        {isToday && (
          <Badge variant="info" size="sm">Aujourd'hui</Badge>
        )}
      </div>

      <div className="meals-meal-list" style={{ marginTop: 8 }}>
        {allTypes.map((mealType) => (
          <MealRow
            key={mealType}
            meal={mealsByType[mealType] ?? null}
            mealType={mealType}
            onSave={handleSave}
          />
        ))}
      </div>
    </GlassCard>
  );
});

// ---------------------------------------------------------------------------
// Tab: Repas
// ---------------------------------------------------------------------------

interface RepasTabProps {
  meals: MealItem[];
  onSaveMeal: (jour: string, mealType: string, text: string) => Promise<void>;
}

function RepasTab({ meals, onSaveMeal }: RepasTabProps) {
  const today = getTodayJour();

  const mealsByJour = useMemo(() => {
    const map: Record<string, MealItem[]> = {};
    meals.forEach((m) => {
      const jour = m.day;
      if (!map[jour]) map[jour] = [];
      map[jour].push(m);
    });
    // Sort meals within each day
    Object.keys(map).forEach((jour) => {
      map[jour] = sortMealTypes(map[jour]);
    });
    return map;
  }, [meals]);

  return (
    <>
      {/* Week navigator */}
      <div className="meals-week-nav">
        <button
          type="button"
          className="meals-week-nav-btn"
          disabled
          aria-label="Semaine précédente"
        >
          ‹
        </button>
        <span className="meals-week-label">Cette semaine</span>
        <button
          type="button"
          className="meals-week-nav-btn"
          disabled
          aria-label="Semaine suivante"
        >
          ›
        </button>
      </div>

      {/* Day cards */}
      <div className="meals-day-grid">
        {JOURS.map((jour) => (
          <DayCard
            key={jour}
            jour={jour}
            isToday={jour === today}
            meals={mealsByJour[jour] ?? []}
            onSaveMeal={onSaveMeal}
          />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CourseSection — collapsible group
// ---------------------------------------------------------------------------

interface CourseSectionProps {
  sectionLabel: string;
  items: CourseItem[];
  togglingIds: Set<string>;
  onToggle: (item: CourseItem) => void;
}

function CourseSection({ sectionLabel, items, togglingIds, onToggle }: CourseSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const pendingItems = items.filter((i) => !i.completed);
  const doneItems = items.filter((i) => i.completed);
  // Show pending first, then done
  const sorted = [...pendingItems, ...doneItems];

  return (
    <div className="meals-course-section">
      <div
        className="meals-course-section-header"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed((c) => !c); }}
      >
        <span className="meals-course-section-label">{sectionLabel}</span>
        <span className="meals-course-section-count">{pendingItems.length}/{items.length}</span>
        <span
          className={`meals-course-section-chevron ${collapsed ? 'meals-course-section-chevron--collapsed' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </div>

      {!collapsed && (
        <div className="meals-course-items">
          {sorted.map((item) => (
            <div
              key={item.id}
              className="meals-course-item"
              onClick={() => onToggle(item)}
            >
              <CourseCheckbox
                checked={item.completed}
                onChange={() => onToggle(item)}
                disabled={togglingIds.has(item.id)}
              />
              <span className={`meals-course-text ${item.completed ? 'meals-course-text--done' : ''}`}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Courses
// ---------------------------------------------------------------------------

interface CoursesTabProps {
  courses: CourseItem[];
  onToggle: (item: CourseItem) => Promise<void>;
  onAdd: (text: string) => Promise<void>;
}

function CoursesTab({ courses, onToggle, onAdd }: CoursesTabProps) {
  const [addText, setAddText] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const totalCount = courses.length;
  const remainingCount = courses.filter((c) => !c.completed).length;

  // Group by section
  const sections = useMemo(() => {
    const map = new Map<string, CourseItem[]>();
    courses.forEach((item) => {
      const key = item.section ?? 'Divers';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return map;
  }, [courses]);

  const handleToggle = useCallback(async (item: CourseItem) => {
    setTogglingIds((prev) => new Set(prev).add(item.id));
    try {
      await onToggle(item);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [onToggle]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = addText.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      setAddText('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      {/* Stats header */}
      <div className="meals-courses-header">
        <p className="meals-courses-stat">
          <strong>{remainingCount}</strong> article{remainingCount !== 1 ? 's' : ''} restant{remainingCount !== 1 ? 's' : ''} sur <strong>{totalCount}</strong>
        </p>
      </div>

      {/* Grouped items */}
      {totalCount === 0 ? (
        <EmptyState icon="🛒" message="La liste de courses est vide" />
      ) : (
        <GlassCard>
          {Array.from(sections.entries()).map(([label, items]) => (
            <CourseSection
              key={label}
              sectionLabel={label}
              items={items}
              togglingIds={togglingIds}
              onToggle={handleToggle}
            />
          ))}

          {/* Add bar */}
          <form className="meals-add-bar" onSubmit={handleAdd}>
            <input
              type="text"
              className="meals-add-input"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="Ajouter un article..."
              disabled={adding}
              aria-label="Nouvel article"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={adding || !addText.trim()}
            >
              {adding ? 'Ajout...' : 'Ajouter'}
            </Button>
          </form>
        </GlassCard>
      )}

      {totalCount === 0 && (
        <GlassCard>
          <form className="meals-add-bar" onSubmit={handleAdd} style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <input
              type="text"
              className="meals-add-input"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="Ajouter un article..."
              disabled={adding}
              aria-label="Nouvel article"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={adding || !addText.trim()}
            >
              {adding ? 'Ajout...' : 'Ajouter'}
            </Button>
          </form>
        </GlassCard>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab: Recettes (placeholder)
// ---------------------------------------------------------------------------

function RecettesTab() {
  return (
    <EmptyState icon="📖" message="Les recettes seront disponibles bientôt" />
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Meals() {
  const { meals, courses, readFile, writeFile, refresh, loading } = useVault();
  const [activeTab, setActiveTab] = useState('repas');

  // -------------------------------------------------------------------------
  // Meal save handler
  // -------------------------------------------------------------------------

  const handleSaveMeal = useCallback(
    async (jour: string, mealType: string, text: string) => {
      // Find the source file from any existing meal item
      const sourceFile = meals[0]?.sourceFile;
      if (!sourceFile) return;

      try {
        const content = await readFile(sourceFile);
        const lines = content.split('\n');

        // Find the line for this meal
        const target = meals.find(
          (m) => m.day.toLowerCase() === jour.toLowerCase() && m.mealType === mealType,
        );

        if (target) {
          // Replace the line at lineIndex
          const line = lines[target.lineIndex];
          if (line !== undefined) {
            // Preserve the line structure: typically "- **Type** : Texte" or similar
            // Replace only the text portion after the colon/dash
            const updated = line.replace(
              /^(.*?:\s*)(.*)$/,
              (_, prefix) => `${prefix}${text}`,
            );
            lines[target.lineIndex] = updated !== line ? updated : line.replace(/:\s*.*$/, `: ${text}`);
          }
        } else {
          // No existing line for this meal type; can't insert without full parser
          // Silently return — future enhancement
          return;
        }

        await writeFile(sourceFile, lines.join('\n'));
        await refresh();
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur sauvegarde repas:', e);
      }
    },
    [meals, readFile, writeFile, refresh],
  );

  // -------------------------------------------------------------------------
  // Course toggle handler
  // -------------------------------------------------------------------------

  const handleToggleCourse = useCallback(
    async (item: CourseItem) => {
      try {
        const content = await readFile(COURSES_FILE);
        const lines = content.split('\n');
        const line = lines[item.lineIndex];
        if (line === undefined) return;

        let newLine: string;
        if (item.completed) {
          newLine = line.replace(/^(\s*-\s*)\[x\]/i, '$1[ ]');
        } else {
          newLine = line.replace(/^(\s*-\s*)\[ \]/, '$1[x]');
        }

        if (newLine === line) return;
        lines[item.lineIndex] = newLine;
        await writeFile(COURSES_FILE, lines.join('\n'));
        await refresh();
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur toggle course:', e);
      }
    },
    [readFile, writeFile, refresh],
  );

  // -------------------------------------------------------------------------
  // Add course handler
  // -------------------------------------------------------------------------

  const handleAddCourse = useCallback(
    async (text: string) => {
      try {
        let content: string;
        try {
          content = await readFile(COURSES_FILE);
        } catch {
          content = '# Liste de courses\n\n';
        }

        // Append to end of file (trim trailing newlines, then add one)
        const trimmed = content.trimEnd();
        const newContent = `${trimmed}\n- [ ] ${text}\n`;
        await writeFile(COURSES_FILE, newContent);
        await refresh();
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erreur ajout course:', e);
      }
    },
    [readFile, writeFile, refresh],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="page meals-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Repas & Courses</h1>
          <p className="page-subtitle">
            {activeTab === 'repas'
              ? `${JOURS.length} jours planifiés — semaine du ${getWeekLabel()}`
              : activeTab === 'courses'
              ? `${courses.filter((c) => !c.completed).length} article${courses.filter((c) => !c.completed).length !== 1 ? 's' : ''} restant${courses.filter((c) => !c.completed).length !== 1 ? 's' : ''}`
              : 'Collection de recettes'}
          </p>
        </div>
      </div>

      {/* Tab toolbar */}
      <div className="meals-toolbar">
        <SegmentedControl
          options={TABS}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="meals-loading">
          <span>Chargement...</span>
        </div>
      ) : activeTab === 'repas' ? (
        <RepasTab meals={meals} onSaveMeal={handleSaveMeal} />
      ) : activeTab === 'courses' ? (
        <CoursesTab
          courses={courses}
          onToggle={handleToggleCourse}
          onAdd={handleAddCourse}
        />
      ) : (
        <RecettesTab />
      )}
    </div>
  );
}
