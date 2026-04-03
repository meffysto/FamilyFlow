import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useVault } from '../contexts/VaultContext';
import { parseJournalStats } from '@family-vault/core';
import type { JournalStats } from '@family-vault/core';
import './Journal.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = DAYS_FR[date.getDay()];
  const monthName = MONTHS_FR[m - 1];
  return `${dayName} ${d} ${monthName} ${y}`;
}

function offsetDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return date.toISOString().slice(0, 10);
}

function getCurrentTime(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  return `${h}h${min}`;
}

// ---------------------------------------------------------------------------
// Journal file helpers
// ---------------------------------------------------------------------------

function journalPath(childName: string, date: string): string {
  return `03 - Journal/${childName}/${date} ${childName}.md`;
}

function generateJournalTemplate(childName: string, date: string): string {
  const [y, m, d] = date.split('-');
  return `---
date: ${date}
enfant: ${childName}
tags:
  - journal-bebe
---

# Journal bébé — ${d}/${m}/${y}

## Alimentation
| Heure | Type | Détail (ml) | Notes |
| ----- | ---- | ----------- | ----- |

## Couches
| Heure | Type | Notes |
| ----- | ---- | ----- |

## Sommeil
| Début | Fin | Durée | Notes |
| ----- | --- | ----- | ----- |

## Humeur & observations
> Notez ici les moments marquants de la journée

## Médicaments / Soins
| Heure | Médicament | Dose | Notes |
| ----- | ---------- | ---- | ----- |
`;
}

// ---------------------------------------------------------------------------
// Markdown table manipulation helpers
// ---------------------------------------------------------------------------

/**
 * Find the start index of a section by its heading keyword.
 * Returns -1 if not found.
 */
function findSectionStart(lines: string[], keyword: string): number {
  const lcKw = keyword.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('## ') && trimmed.toLowerCase().includes(lcKw)) {
      return i;
    }
  }
  return -1;
}

/**
 * Find the end of a section (start of next ## heading or end of file).
 */
function findSectionEnd(lines: string[], startIdx: number): number {
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('## ')) return i;
  }
  return lines.length;
}

/**
 * Find the last table row index within a section.
 * Returns -1 if no table row found.
 */
function findLastTableRow(lines: string[], sectionStart: number, sectionEnd: number): number {
  let lastRow = -1;
  for (let i = sectionStart; i < sectionEnd; i++) {
    const t = lines[i].trim();
    if (t.startsWith('|') && !t.includes('---')) {
      lastRow = i;
    }
  }
  return lastRow;
}

/**
 * Insert a new table row after the last existing row in a section.
 * Returns the updated lines array.
 */
function appendTableRow(lines: string[], sectionKeyword: string, newRow: string): string[] {
  const sectionStart = findSectionStart(lines, sectionKeyword);
  if (sectionStart === -1) return lines;
  const sectionEnd = findSectionEnd(lines, sectionStart);
  const lastRow = findLastTableRow(lines, sectionStart, sectionEnd);

  const updated = [...lines];
  if (lastRow === -1) {
    // No table rows found — insert after the separator line
    const sepIdx = lines.findIndex((l, i) => i > sectionStart && i < sectionEnd && l.trim().includes('---'));
    const insertAt = sepIdx !== -1 ? sepIdx + 1 : sectionStart + 1;
    updated.splice(insertAt, 0, newRow);
  } else {
    updated.splice(lastRow + 1, 0, newRow);
  }
  return updated;
}

/**
 * Find the observations section and append a new line.
 */
function appendObservation(lines: string[], text: string): string[] {
  const sectionStart = findSectionStart(lines, 'humeur');
  if (sectionStart === -1) return lines;
  const sectionEnd = findSectionEnd(lines, sectionStart);

  // Find last non-empty, non-heading content in that section
  let lastContent = sectionStart;
  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    if (lines[i].trim().length > 0) lastContent = i;
  }
  const updated = [...lines];
  updated.splice(lastContent + 1, 0, text);
  return updated;
}

// ---------------------------------------------------------------------------
// Stats banner
// ---------------------------------------------------------------------------

interface StatsBannerProps {
  stats: JournalStats;
}

const StatsBanner = memo(function StatsBanner({ stats }: StatsBannerProps) {
  const items: { icon: string; label: string; value: string | number }[] = [];

  if (stats.biberons > 0) {
    items.push({
      icon: '🍼',
      label: 'biberon' + (stats.biberons > 1 ? 's' : ''),
      value: stats.totalMl > 0 ? `${stats.biberons} (${stats.totalMl} ml)` : stats.biberons,
    });
  }
  if (stats.tetees > 0) {
    items.push({ icon: '🤱', label: 'tétée' + (stats.tetees > 1 ? 's' : ''), value: stats.tetees });
  }
  if (stats.couches > 0) {
    items.push({ icon: '🚼', label: 'couche' + (stats.couches > 1 ? 's' : ''), value: stats.couches });
  }
  if (stats.sommeilTotal) {
    items.push({ icon: '😴', label: 'sommeil', value: stats.sommeilTotal });
  }

  if (items.length === 0) return null;

  return (
    <div className="journal-stats-banner">
      {items.map((item, i) => (
        <div key={i} className="journal-stat-item">
          <span className="journal-stat-icon">{item.icon}</span>
          <span className="journal-stat-value">{item.value}</span>
          <span className="journal-stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Generic table section
// ---------------------------------------------------------------------------

interface TableSectionProps {
  rows: string[][];
  columns: string[];
  accentColor: string;
  emptyText: string;
}

const TableSection = memo(function TableSection({ rows, columns, accentColor, emptyText }: TableSectionProps) {
  if (rows.length === 0) {
    return (
      <div className="journal-empty">
        <span className="journal-empty-text">{emptyText}</span>
      </div>
    );
  }

  return (
    <div className="journal-table-wrapper">
      <table className="journal-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={{ color: accentColor }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((_, j) => (
                <td key={j}>{row[j] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Observations section
// ---------------------------------------------------------------------------

interface ObservationsSectionProps {
  lines: string[];
  onSave: (text: string) => void;
}

const ObservationsSection = memo(function ObservationsSection({ lines, onSave }: ObservationsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const displayLines = lines.filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('>') && !t.startsWith('#');
  });

  function handleEdit() {
    setDraft(displayLines.join('\n'));
    setEditing(true);
  }

  function handleSave() {
    if (draft.trim()) {
      onSave(draft.trim());
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="journal-obs-editor">
        <textarea
          className="journal-obs-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Notes libres sur la journée..."
          autoFocus
        />
        <div className="journal-obs-actions">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>Enregistrer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="journal-obs-content">
      {displayLines.length === 0 ? (
        <p className="journal-empty-text">Aucune observation</p>
      ) : (
        <ol className="journal-obs-list">
          {displayLines.map((line, i) => (
            <li key={i}>{line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '')}</li>
          ))}
        </ol>
      )}
      <Button variant="ghost" size="sm" onClick={handleEdit} icon="✏️">
        Modifier
      </Button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Add entry modal
// ---------------------------------------------------------------------------

type SectionType = 'alimentation' | 'couches' | 'sommeil' | 'medicaments';

interface AddEntryModalProps {
  isOpen: boolean;
  section: SectionType | null;
  onClose: () => void;
  onSubmit: (section: SectionType, row: string) => void;
}

function buildModalTitle(section: SectionType | null): string {
  switch (section) {
    case 'alimentation': return 'Ajouter une alimentation';
    case 'couches': return 'Ajouter une couche';
    case 'sommeil': return 'Ajouter un sommeil';
    case 'medicaments': return 'Ajouter un médicament';
    default: return 'Ajouter';
  }
}

function AddEntryModal({ isOpen, section, onClose, onSubmit }: AddEntryModalProps) {
  const now = getCurrentTime();

  // Alimentation fields
  const [alimHeure, setAlimHeure] = useState(now);
  const [alimType, setAlimType] = useState('Biberon');
  const [alimDetail, setAlimDetail] = useState('');
  const [alimNotes, setAlimNotes] = useState('');

  // Couche fields
  const [coucheHeure, setCoucheHeure] = useState(now);
  const [coucheType, setCoucheType] = useState('Pipi');
  const [coucheNotes, setCoucheNotes] = useState('');

  // Sommeil fields
  const [somDebut, setSomDebut] = useState(now);
  const [somFin, setSomFin] = useState('');
  const [somDuree, setSomDuree] = useState('');
  const [somNotes, setSomNotes] = useState('');

  // Medicament fields
  const [medHeure, setMedHeure] = useState(now);
  const [medNom, setMedNom] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medNotes, setMedNotes] = useState('');

  // Reset fields when modal opens
  useEffect(() => {
    if (isOpen) {
      const t = getCurrentTime();
      setAlimHeure(t); setAlimType('Biberon'); setAlimDetail(''); setAlimNotes('');
      setCoucheHeure(t); setCoucheType('Pipi'); setCoucheNotes('');
      setSomDebut(t); setSomFin(''); setSomDuree(''); setSomNotes('');
      setMedHeure(t); setMedNom(''); setMedDose(''); setMedNotes('');
    }
  }, [isOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!section) return;

    let row = '';
    switch (section) {
      case 'alimentation':
        row = `| ${alimHeure} | ${alimType} | ${alimDetail} | ${alimNotes} |`;
        break;
      case 'couches':
        row = `| ${coucheHeure} | ${coucheType} | ${coucheNotes} |`;
        break;
      case 'sommeil':
        row = `| ${somDebut} | ${somFin} | ${somDuree} | ${somNotes} |`;
        break;
      case 'medicaments':
        row = `| ${medHeure} | ${medNom} | ${medDose} | ${medNotes} |`;
        break;
    }
    onSubmit(section, row);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={buildModalTitle(section)} width="sm">
      <form onSubmit={handleSubmit} className="journal-modal-form">
        {section === 'alimentation' && (
          <>
            <div className="journal-form-row">
              <label>Heure</label>
              <input className="journal-input" value={alimHeure} onChange={(e) => setAlimHeure(e.target.value)} placeholder="7h30" />
            </div>
            <div className="journal-form-row">
              <label>Type</label>
              <select className="journal-select" value={alimType} onChange={(e) => setAlimType(e.target.value)}>
                <option>Biberon</option>
                <option>Tétée</option>
              </select>
            </div>
            <div className="journal-form-row">
              <label>Détail (ml)</label>
              <input className="journal-input" value={alimDetail} onChange={(e) => setAlimDetail(e.target.value)} placeholder="150 ml" />
            </div>
            <div className="journal-form-row">
              <label>Notes</label>
              <input className="journal-input" value={alimNotes} onChange={(e) => setAlimNotes(e.target.value)} placeholder="Optionnel" />
            </div>
          </>
        )}

        {section === 'couches' && (
          <>
            <div className="journal-form-row">
              <label>Heure</label>
              <input className="journal-input" value={coucheHeure} onChange={(e) => setCoucheHeure(e.target.value)} placeholder="7h30" />
            </div>
            <div className="journal-form-row">
              <label>Type</label>
              <select className="journal-select" value={coucheType} onChange={(e) => setCoucheType(e.target.value)}>
                <option>Pipi</option>
                <option>Selle</option>
                <option>Mixte</option>
              </select>
            </div>
            <div className="journal-form-row">
              <label>Notes</label>
              <input className="journal-input" value={coucheNotes} onChange={(e) => setCoucheNotes(e.target.value)} placeholder="Optionnel" />
            </div>
          </>
        )}

        {section === 'sommeil' && (
          <>
            <div className="journal-form-row">
              <label>Début</label>
              <input className="journal-input" value={somDebut} onChange={(e) => setSomDebut(e.target.value)} placeholder="19h30" />
            </div>
            <div className="journal-form-row">
              <label>Fin</label>
              <input className="journal-input" value={somFin} onChange={(e) => setSomFin(e.target.value)} placeholder="7h00" />
            </div>
            <div className="journal-form-row">
              <label>Durée</label>
              <input className="journal-input" value={somDuree} onChange={(e) => setSomDuree(e.target.value)} placeholder="11h30" />
            </div>
            <div className="journal-form-row">
              <label>Notes</label>
              <input className="journal-input" value={somNotes} onChange={(e) => setSomNotes(e.target.value)} placeholder="Optionnel" />
            </div>
          </>
        )}

        {section === 'medicaments' && (
          <>
            <div className="journal-form-row">
              <label>Heure</label>
              <input className="journal-input" value={medHeure} onChange={(e) => setMedHeure(e.target.value)} placeholder="8h00" />
            </div>
            <div className="journal-form-row">
              <label>Médicament</label>
              <input className="journal-input" value={medNom} onChange={(e) => setMedNom(e.target.value)} placeholder="Doliprane" autoFocus />
            </div>
            <div className="journal-form-row">
              <label>Dose</label>
              <input className="journal-input" value={medDose} onChange={(e) => setMedDose(e.target.value)} placeholder="2.5 ml" />
            </div>
            <div className="journal-form-row">
              <label>Notes</label>
              <input className="journal-input" value={medNotes} onChange={(e) => setMedNotes(e.target.value)} placeholder="Optionnel" />
            </div>
          </>
        )}

        <div className="journal-modal-footer">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Annuler</Button>
          <Button variant="primary" size="sm" type="submit">Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Parse markdown table rows into string arrays
// ---------------------------------------------------------------------------

function parseMarkdownTable(content: string, sectionKeyword: string): string[][] {
  const lines = content.split('\n');
  const sectionStart = findSectionStart(lines, sectionKeyword);
  if (sectionStart === -1) return [];
  const sectionEnd = findSectionEnd(lines, sectionStart);

  const rows: string[][] = [];
  let headerParsed = false;

  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.includes('---')) continue;

    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (!headerParsed) {
      headerParsed = true;
      continue; // skip header row
    }
    // Skip completely empty rows
    if (cells.every((c) => c === '')) continue;
    rows.push(cells);
  }

  return rows;
}

function parseObservationLines(content: string): string[] {
  const lines = content.split('\n');
  const sectionStart = findSectionStart(lines, 'humeur');
  if (sectionStart === -1) return [];
  const sectionEnd = findSectionEnd(lines, sectionStart);

  const result: string[] = [];
  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    const t = lines[i].trim();
    if (t.length === 0 || t.startsWith('#')) continue;
    result.push(t);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Section card with add button header action
// ---------------------------------------------------------------------------

interface SectionCardProps {
  title: string;
  icon: string;
  accentColor: string;
  count?: number;
  onAdd: () => void;
  children: React.ReactNode;
}

function SectionCard({ title, icon, accentColor, count, onAdd, children }: SectionCardProps) {
  return (
    <div className="journal-section-card" style={{ borderTop: `2px solid ${accentColor}` }}>
      <div className="journal-section-header">
        <div className="journal-section-title-row">
          <span className="journal-section-icon">{icon}</span>
          <span className="journal-section-title" style={{ color: accentColor }}>{title}</span>
          {count !== undefined && count > 0 && (
            <span className="journal-section-badge" style={{ background: accentColor }}>{count}</span>
          )}
        </div>
        <button
          className="journal-add-btn"
          onClick={onAdd}
          style={{ color: accentColor, borderColor: accentColor }}
          aria-label={`Ajouter — ${title}`}
        >
          + Ajouter
        </button>
      </div>
      <div className="journal-section-body">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Journal() {
  const { profiles, readFile, writeFile } = useVault();

  // Child profiles only
  const children = useMemo(
    () => profiles.filter((p) => p.role === 'enfant'),
    [profiles],
  );

  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [modalSection, setModalSection] = useState<SectionType | null>(null);

  // Derived: selected child profile
  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? children[0] ?? null,
    [children, selectedChildId],
  );

  // Auto-select first child on load
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  // Load journal file whenever child or date changes
  const loadJournal = useCallback(async () => {
    if (!selectedChild) { setContent(null); return; }
    setLoading(true);
    try {
      const path = journalPath(selectedChild.name, selectedDate);
      const text = await readFile(path);
      setContent(text);
    } catch {
      setContent(null); // file doesn't exist
    } finally {
      setLoading(false);
    }
  }, [selectedChild, selectedDate, readFile]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  // Create today's journal
  const handleCreate = useCallback(async () => {
    if (!selectedChild) return;
    const template = generateJournalTemplate(selectedChild.name, selectedDate);
    const path = journalPath(selectedChild.name, selectedDate);
    await writeFile(path, template);
    setContent(template);
  }, [selectedChild, selectedDate, writeFile]);

  // Append a row to a table section
  const handleAddEntry = useCallback(async (section: SectionType, row: string) => {
    if (!selectedChild || content === null) return;

    const sectionKeywords: Record<SectionType, string> = {
      alimentation: 'alimentation',
      couches: 'couche',
      sommeil: 'sommeil',
      medicaments: 'médicaments',
    };

    const lines = content.split('\n');
    const updated = appendTableRow(lines, sectionKeywords[section], row);
    const newContent = updated.join('\n');

    const path = journalPath(selectedChild.name, selectedDate);
    await writeFile(path, newContent);
    setContent(newContent);
  }, [selectedChild, selectedDate, content, writeFile]);

  // Save observation edit
  const handleSaveObservation = useCallback(async (text: string) => {
    if (!selectedChild || content === null) return;
    const lines = content.split('\n');
    const obsLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    // Rebuild observations section: replace existing content between heading and next ##
    const sectionStart = findSectionStart(lines, 'humeur');
    if (sectionStart === -1) return;
    const sectionEnd = findSectionEnd(lines, sectionStart);

    const before = lines.slice(0, sectionStart + 1);
    const after = lines.slice(sectionEnd);
    const obsContent = obsLines.map((l, i) => `${i + 1}. ${l}`);
    const updated = [...before, '', ...obsContent, '', ...after];
    const newContent = updated.join('\n');

    const path = journalPath(selectedChild.name, selectedDate);
    await writeFile(path, newContent);
    setContent(newContent);
  }, [selectedChild, selectedDate, content, writeFile]);

  // Parsed data from content
  const stats: JournalStats | null = useMemo(
    () => (content ? parseJournalStats(content) : null),
    [content],
  );

  const alimRows = useMemo(() => content ? parseMarkdownTable(content, 'alimentation') : [], [content]);
  const coucheRows = useMemo(() => content ? parseMarkdownTable(content, 'couche') : [], [content]);
  const sommeilRows = useMemo(() => content ? parseMarkdownTable(content, 'sommeil') : [], [content]);
  const medRows = useMemo(() => content ? parseMarkdownTable(content, 'médicaments') : [], [content]);
  const obsLines = useMemo(() => content ? parseObservationLines(content) : [], [content]);

  const isToday = selectedDate === todayIso();

  // Segment options for child selector
  const childOptions = useMemo(
    () => children.map((c) => ({ label: c.name, value: c.id })),
    [children],
  );

  // ---------------------------------------------------------------------------
  // Render: no children configured
  // ---------------------------------------------------------------------------

  if (children.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">Journal bébé</h1>
          </div>
        </div>
        <div className="journal-no-children">
          <span className="journal-no-children-icon">👶</span>
          <p className="journal-no-children-text">Aucun profil enfant configuré</p>
          <p className="journal-no-children-hint">Ajoutez un profil avec le rôle "enfant" dans Famille pour accéder au journal bébé.</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: main page
  // ---------------------------------------------------------------------------

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Journal bébé</h1>
          {childOptions.length > 1 && (
            <SegmentedControl
              options={childOptions}
              value={selectedChildId || (children[0]?.id ?? '')}
              onChange={setSelectedChildId}
            />
          )}
          {childOptions.length === 1 && (
            <span className="journal-single-child">{children[0]?.name}</span>
          )}
        </div>
      </div>

      {/* Date navigation */}
      <div className="journal-date-nav">
        <button
          className="journal-nav-btn"
          onClick={() => setSelectedDate((d) => offsetDate(d, -1))}
          aria-label="Jour précédent"
        >
          ‹
        </button>

        <div className="journal-date-center">
          <span className="journal-date-label">{formatDateLong(selectedDate)}</span>
          {!isToday && (
            <button
              className="journal-today-btn"
              onClick={() => setSelectedDate(todayIso())}
            >
              Aujourd'hui
            </button>
          )}
        </div>

        <button
          className="journal-nav-btn"
          onClick={() => setSelectedDate((d) => offsetDate(d, 1))}
          disabled={isToday}
          aria-label="Jour suivant"
        >
          ›
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="journal-loading">Chargement...</div>
      )}

      {/* No journal file */}
      {!loading && content === null && (
        <div className="journal-empty-day">
          <div className="journal-empty-avatar">
            {selectedChild?.avatar ?? '👶'}
          </div>
          <p className="journal-empty-day-name">{selectedChild?.name}</p>
          <p className="journal-empty-day-text">Pas de journal pour cette date</p>
          {isToday && (
            <Button variant="primary" size="md" icon="📋" onClick={handleCreate}>
              Créer le journal
            </Button>
          )}
        </div>
      )}

      {/* Journal content */}
      {!loading && content !== null && (
        <div className="journal-content">
          {/* Stats banner */}
          {stats && <StatsBanner stats={stats} />}

          {/* Alimentation */}
          <SectionCard
            title="Alimentation"
            icon="🍼"
            accentColor="var(--cat-organisation)"
            count={alimRows.length}
            onAdd={() => setModalSection('alimentation')}
          >
            <TableSection
              rows={alimRows}
              columns={['Heure', 'Type', 'Détail', 'Notes']}
              accentColor="var(--cat-organisation)"
              emptyText="Aucune alimentation enregistrée"
            />
          </SectionCard>

          {/* Couches */}
          <SectionCard
            title="Couches"
            icon="🚼"
            accentColor="var(--cat-sante)"
            count={coucheRows.length}
            onAdd={() => setModalSection('couches')}
          >
            <TableSection
              rows={coucheRows}
              columns={['Heure', 'Type', 'Notes']}
              accentColor="var(--cat-sante)"
              emptyText="Aucune couche enregistrée"
            />
          </SectionCard>

          {/* Sommeil */}
          <SectionCard
            title="Sommeil"
            icon="😴"
            accentColor="var(--info)"
            count={sommeilRows.length}
            onAdd={() => setModalSection('sommeil')}
          >
            <TableSection
              rows={sommeilRows}
              columns={['Début', 'Fin', 'Durée', 'Notes']}
              accentColor="var(--info)"
              emptyText="Aucune sieste ou nuit enregistrée"
            />
          </SectionCard>

          {/* Observations */}
          <GlassCard
            title="Observations"
            icon="📝"
            accentColor="var(--cat-souvenirs)"
          >
            <ObservationsSection
              lines={obsLines}
              onSave={handleSaveObservation}
            />
          </GlassCard>

          {/* Médicaments */}
          <SectionCard
            title="Médicaments / Soins"
            icon="💊"
            accentColor="var(--cat-sante)"
            count={medRows.length}
            onAdd={() => setModalSection('medicaments')}
          >
            <TableSection
              rows={medRows}
              columns={['Heure', 'Médicament', 'Dose', 'Notes']}
              accentColor="var(--cat-sante)"
              emptyText="Aucun médicament enregistré"
            />
          </SectionCard>
        </div>
      )}

      {/* Add entry modal */}
      <AddEntryModal
        isOpen={modalSection !== null}
        section={modalSection}
        onClose={() => setModalSection(null)}
        onSubmit={handleAddEntry}
      />
    </div>
  );
}
