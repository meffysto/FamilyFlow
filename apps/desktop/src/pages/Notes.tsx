import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { SearchInput } from '../components/ui/SearchInput';
import { useVault } from '../contexts/VaultContext';
import {
  type Note,
  NOTE_CATEGORIES,
} from '@family-vault/core';
import './Notes.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateFr(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function getExcerpt(content: string, maxLen = 120): string {
  const stripped = content.replace(/^#{1,6}\s+/gm, '').replace(/[*_`[\]]/g, '').trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen).trimEnd() + '…';
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildEmptyNote(): Omit<Note, 'sourceFile'> {
  return {
    title: '',
    category: NOTE_CATEGORIES[0],
    created: getTodayIso(),
    tags: [],
    content: '',
  };
}

// ---------------------------------------------------------------------------
// Note list item
// ---------------------------------------------------------------------------

interface NoteListItemProps {
  note: Note;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const NoteListItem = memo(function NoteListItem({ note, isSelected, onSelect, onDelete }: NoteListItemProps) {
  return (
    <div
      className={`notes-list-item${isSelected ? ' notes-list-item--selected' : ''}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      role="button"
      aria-pressed={isSelected}
    >
      <div className="notes-list-item-header">
        <span className="notes-list-item-title">{note.title || '—'}</span>
        <div className="notes-list-item-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="notes-action-btn notes-action-btn--delete"
            onClick={onDelete}
            aria-label="Supprimer"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      </div>
      <div className="notes-list-item-category">{note.category}</div>
      {note.content && (
        <div className="notes-list-item-excerpt">{getExcerpt(note.content)}</div>
      )}
      <div className="notes-list-item-date">{formatDateFr(note.created)}</div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Note editor panel
// ---------------------------------------------------------------------------

interface NoteEditorProps {
  note: Note | Omit<Note, 'sourceFile'>;
  isNew: boolean;
  onSave: (data: Omit<Note, 'sourceFile'>) => Promise<void>;
  onCancel: () => void;
}

function NoteEditor({ note, isNew, onSave, onCancel }: NoteEditorProps) {
  const { t } = useTranslation('common');
  const [title, setTitle] = useState(note.title);
  const [category, setCategory] = useState(note.category);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sync if note changes (another note selected)
  useEffect(() => {
    setTitle(note.title);
    setCategory(note.category);
    setContent(note.content);
    setTags(note.tags.join(', '));
    setError('');
  }, [(note as Note).sourceFile ?? '__new__', note.title]);

  async function handleSave() {
    setError('');
    if (!title.trim()) {
      setError(t('notesPage.errorTitleRequired', 'Le titre est requis.'));
      return;
    }

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        category,
        created: (note as Note).created ?? getTodayIso(),
        tags: tagList,
        content,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="notes-editor">
      <div className="notes-editor-titlebar">
        <input
          type="text"
          className="notes-editor-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('notesPage.titlePlaceholder', 'Titre de la note...')}
        />
        <div className="notes-editor-actions">
          {isNew && (
            <Button variant="secondary" size="sm" onClick={onCancel}>
              {t('common.cancel', 'Annuler')}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving', 'Sauvegarde...') : t('common.save', 'Sauvegarder')}
          </Button>
        </div>
      </div>

      <div className="notes-editor-meta">
        <select
          className="form-select notes-editor-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {NOTE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <input
          type="text"
          className="form-input notes-editor-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t('notesPage.tagsPlaceholder', 'Tags séparés par des virgules...')}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <textarea
        className="notes-editor-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('notesPage.contentPlaceholder', 'Contenu de la note en Markdown...')}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Notes page
// ---------------------------------------------------------------------------

export default function Notes() {
  const { t } = useTranslation('common');
  const { notes, addNote, updateNote, deleteNote } = useVault();

  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteData, setNewNoteData] = useState<Omit<Note, 'sourceFile'> | null>(null);

  // ── Keyboard shortcut — Delete selected note ──────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' && selectedNote && !isCreating) {
        const target = e.target as HTMLElement;
        // Don't trigger if focus is inside an input/textarea
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
        const ok = window.confirm(
          t('notesPage.confirmDelete', `Supprimer la note "${selectedNote.title}" ?`)
        );
        if (ok) {
          deleteNote(selectedNote);
          setSelectedNote(null);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNote, isCreating, deleteNote, t]);

  // ── Filtered notes ────────────────────────────────────────────────────────

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes;
    const q = normalize(search);
    return notes.filter(
      (n) =>
        normalize(n.title).includes(q) ||
        normalize(n.content).includes(q) ||
        normalize(n.category).includes(q) ||
        n.tags.some((tag) => normalize(tag).includes(q)),
    );
  }, [notes, search]);

  const sortedNotes = useMemo(
    () => [...filteredNotes].sort((a, b) => b.created.localeCompare(a.created)),
    [filteredNotes],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setNewNoteData(buildEmptyNote());
    setIsCreating(true);
    setSelectedNote(null);
  }, []);

  const handleDelete = useCallback((note: Note) => {
    const ok = window.confirm(
      t('notesPage.confirmDelete', `Supprimer la note "${note.title}" ?`)
    );
    if (ok) {
      deleteNote(note);
      if (selectedNote?.sourceFile === note.sourceFile) setSelectedNote(null);
    }
  }, [deleteNote, selectedNote, t]);

  const handleSaveExisting = useCallback(async (data: Omit<Note, 'sourceFile'>) => {
    if (!selectedNote) return;
    await updateNote({ ...data, sourceFile: selectedNote.sourceFile });
    // Update the selected note with new data
    setSelectedNote((prev) => prev ? { ...data, sourceFile: prev.sourceFile } : null);
  }, [selectedNote, updateNote]);

  const handleSaveNew = useCallback(async (data: Omit<Note, 'sourceFile'>) => {
    await addNote(data);
    setIsCreating(false);
    setNewNoteData(null);
    // Find and select the newly created note
    // It will appear in notes after next re-render
  }, [addNote]);

  const handleCancelNew = useCallback(() => {
    setIsCreating(false);
    setNewNoteData(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const showEditor = isCreating || selectedNote !== null;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="notes-header-row">
          <h1 className="page-title">{t('notesPage.title', 'Notes')}</h1>
          <Button variant="primary" size="sm" icon="+" onClick={openCreate}>
            {t('notesPage.addButton', 'Nouvelle note')}
          </Button>
        </div>
        <div className="notes-search-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('notesPage.searchPlaceholder', 'Rechercher dans les notes...')}
          />
        </div>
      </div>

      {/* Master-detail layout */}
      <div className={`notes-layout${showEditor ? ' notes-layout--detail-open' : ''}`}>
        {/* Left panel — note list */}
        <div className="notes-list-panel">
          {notes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty-icon">📝</div>
              <p className="notes-empty-title">{t('notesPage.emptyTitle', 'Aucune note')}</p>
              <p className="notes-empty-hint">
                {t('notesPage.emptyHint', 'Créez votre première note pour commencer.')}
              </p>
              <Button variant="primary" icon="+" onClick={openCreate}>
                {t('notesPage.addFirst', 'Créer une note')}
              </Button>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="notes-empty">
              <p className="notes-empty-title">{t('notesPage.noResults', 'Aucun résultat.')}</p>
            </div>
          ) : (
            <GlassCard>
              {sortedNotes.map((note) => (
                <NoteListItem
                  key={note.sourceFile}
                  note={note}
                  isSelected={selectedNote?.sourceFile === note.sourceFile}
                  onSelect={() => {
                    setIsCreating(false);
                    setNewNoteData(null);
                    setSelectedNote((prev) =>
                      prev?.sourceFile === note.sourceFile ? null : note
                    );
                  }}
                  onDelete={() => handleDelete(note)}
                />
              ))}
            </GlassCard>
          )}
        </div>

        {/* Right panel — editor */}
        {showEditor && (
          <div className="notes-detail-panel">
            {isCreating && newNoteData ? (
              <NoteEditor
                note={newNoteData}
                isNew={true}
                onSave={handleSaveNew}
                onCancel={handleCancelNew}
              />
            ) : selectedNote ? (
              <NoteEditor
                key={selectedNote.sourceFile}
                note={selectedNote}
                isNew={false}
                onSave={handleSaveExisting}
                onCancel={() => setSelectedNote(null)}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
