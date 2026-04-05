import { useState, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useVault } from '../contexts/VaultContext';
import type { HealthRecord, GrowthEntry, VaccineEntry, Profile } from '@family-vault/core';
import './Health.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'croissance' | 'vaccins' | 'historique';

interface MedicalEvent {
  id: string;
  date: string;
  type: string;
  description: string;
  medecin?: string;
}

// ---------------------------------------------------------------------------
// GrowthForm modal
// ---------------------------------------------------------------------------

interface GrowthFormProps {
  onSave: (entry: GrowthEntry) => void;
  onClose: () => void;
}

function GrowthForm({ onSave, onClose }: GrowthFormProps) {
  const { t } = useTranslation('common');
  const [date, setDate] = useState(today());
  const [poids, setPoids] = useState('');
  const [taille, setTaille] = useState('');
  const [note, setNote] = useState('');

  const canSave = date && (poids || taille);

  const handleSave = () => {
    onSave({
      date,
      poids: poids ? parseFloat(poids.replace(',', '.')) : undefined,
      taille: taille ? parseFloat(taille.replace(',', '.')) : undefined,
      note: note || undefined,
    });
  };

  return (
    <div className="health-form">
      <div className="health-form-field">
        <label className="health-form-label">{t('health.growthForm.date', 'Date')}</label>
        <input
          type="date"
          className="health-form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="health-form-row">
        <div className="health-form-field">
          <label className="health-form-label">{t('health.growthForm.height', 'Taille (cm)')}</label>
          <input
            type="number"
            step="0.1"
            className="health-form-input"
            value={taille}
            onChange={(e) => setTaille(e.target.value)}
            placeholder="ex: 85.0"
          />
        </div>
        <div className="health-form-field">
          <label className="health-form-label">{t('health.growthForm.weight', 'Poids (kg)')}</label>
          <input
            type="number"
            step="0.1"
            className="health-form-input"
            value={poids}
            onChange={(e) => setPoids(e.target.value)}
            placeholder="ex: 12.5"
          />
        </div>
      </div>
      <div className="health-form-field">
        <label className="health-form-label">{t('health.growthForm.notes', 'Notes')}</label>
        <input
          type="text"
          className="health-form-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('health.growthForm.notesPlaceholder', 'Remarque optionnelle')}
        />
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
// VaccineForm modal
// ---------------------------------------------------------------------------

const COMMON_VACCINES = [
  'DTP (Diphtérie-Tétanos-Polio)',
  'Coqueluche',
  'Haemophilus influenzae b',
  'Hépatite B',
  'Pneumocoque',
  'Méningocoque C',
  'ROR (Rougeole-Oreillons-Rubéole)',
  'BCG',
  'Varicelle',
  'Grippe',
  'HPV',
];

interface VaccineFormProps {
  onSave: (entry: VaccineEntry) => void;
  onClose: () => void;
}

function VaccineForm({ onSave, onClose }: VaccineFormProps) {
  const { t } = useTranslation('common');
  const [nom, setNom] = useState('');
  const [date, setDate] = useState(today());
  const [dose, setDose] = useState('');
  const [note, setNote] = useState('');

  const canSave = nom && date;

  const handleSave = () => {
    onSave({
      nom,
      date,
      dose: dose || undefined,
      note: note || undefined,
    });
  };

  return (
    <div className="health-form">
      <div className="health-form-field">
        <label className="health-form-label">{t('health.vaccineForm.vaccine', 'Vaccin')}</label>
        <input
          type="text"
          className="health-form-input"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder={t('health.vaccineForm.vaccinePlaceholder', 'Nom du vaccin')}
        />
        <div className="health-vaccine-chips">
          {COMMON_VACCINES.map((v) => (
            <button
              key={v}
              type="button"
              className={`health-vaccine-chip ${nom === v ? 'health-vaccine-chip--active' : ''}`}
              onClick={() => setNom(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="health-form-field">
        <label className="health-form-label">{t('health.vaccineForm.date', 'Date')}</label>
        <input
          type="date"
          className="health-form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="health-form-field">
        <label className="health-form-label">{t('health.vaccineForm.dose', 'Dose')}</label>
        <input
          type="text"
          className="health-form-input"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder={t('health.vaccineForm.dosePlaceholder', 'ex: 1ère dose, Rappel')}
        />
      </div>
      <div className="health-form-field">
        <label className="health-form-label">{t('health.vaccineForm.notes', 'Notes')}</label>
        <input
          type="text"
          className="health-form-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('health.vaccineForm.notesPlaceholder', 'Remarque optionnelle')}
        />
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
// MedicalEventForm modal
// ---------------------------------------------------------------------------

const EVENT_TYPES = ['Consultation', 'Maladie', 'Traitement', 'Urgence', 'Contrôle', 'Autre'];

interface MedicalEventFormProps {
  onSave: (event: MedicalEvent) => void;
  onClose: () => void;
}

function MedicalEventForm({ onSave, onClose }: MedicalEventFormProps) {
  const { t } = useTranslation('common');
  const [date, setDate] = useState(today());
  const [type, setType] = useState('Consultation');
  const [description, setDescription] = useState('');
  const [medecin, setMedecin] = useState('');

  const canSave = date && description;

  const handleSave = () => {
    onSave({
      id: `${date}-${Date.now()}`,
      date,
      type,
      description,
      medecin: medecin || undefined,
    });
  };

  return (
    <div className="health-form">
      <div className="health-form-field">
        <label className="health-form-label">{t('health.eventForm.date', 'Date')}</label>
        <input
          type="date"
          className="health-form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="health-form-field">
        <label className="health-form-label">{t('health.eventForm.type', 'Type')}</label>
        <select
          className="health-form-input"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {EVENT_TYPES.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </select>
      </div>
      <div className="health-form-field">
        <label className="health-form-label">{t('health.eventForm.description', 'Description')}</label>
        <textarea
          className="health-form-input health-form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('health.eventForm.descriptionPlaceholder', "Décrivez l'événement médical")}
          rows={3}
        />
      </div>
      <div className="health-form-field">
        <label className="health-form-label">{t('health.eventForm.doctor', 'Médecin')}</label>
        <input
          type="text"
          className="health-form-input"
          value={medecin}
          onChange={(e) => setMedecin(e.target.value)}
          placeholder={t('health.eventForm.doctorPlaceholder', 'Nom du médecin (optionnel)')}
        />
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
// GrowthRow — hover-to-reveal delete per D-02
// ---------------------------------------------------------------------------

interface GrowthRowProps {
  entry: GrowthEntry;
  onDelete: () => void;
}

const GrowthRow = memo(function GrowthRow({ entry, onDelete }: GrowthRowProps) {
  return (
    <tr className="health-table-row health-hover-row">
      <td className="health-table-cell">{formatDate(entry.date)}</td>
      <td className="health-table-cell health-table-cell--num">
        {entry.taille != null ? `${entry.taille} cm` : '—'}
      </td>
      <td className="health-table-cell health-table-cell--num">
        {entry.poids != null ? `${entry.poids} kg` : '—'}
      </td>
      <td className="health-table-cell health-table-cell--note">{entry.note ?? '—'}</td>
      <td className="health-table-cell health-table-cell--actions">
        <button
          type="button"
          className="health-row-delete"
          onClick={onDelete}
          aria-label="Supprimer cette mesure"
          title="Supprimer"
        >
          ✕
        </button>
      </td>
    </tr>
  );
});

// ---------------------------------------------------------------------------
// VaccineRow — hover-to-reveal delete per D-02
// ---------------------------------------------------------------------------

interface VaccineRowProps {
  entry: VaccineEntry;
  onDelete: () => void;
}

const VaccineRow = memo(function VaccineRow({ entry, onDelete }: VaccineRowProps) {
  return (
    <tr className="health-table-row health-hover-row">
      <td className="health-table-cell">{entry.nom}</td>
      <td className="health-table-cell">{formatDate(entry.date)}</td>
      <td className="health-table-cell">{entry.dose ?? '—'}</td>
      <td className="health-table-cell health-table-cell--note">{entry.note ?? '—'}</td>
      <td className="health-table-cell health-table-cell--actions">
        <button
          type="button"
          className="health-row-delete"
          onClick={onDelete}
          aria-label="Supprimer ce vaccin"
          title="Supprimer"
        >
          ✕
        </button>
      </td>
    </tr>
  );
});

// ---------------------------------------------------------------------------
// EventRow — hover-to-reveal delete per D-02
// ---------------------------------------------------------------------------

interface EventRowProps {
  event: MedicalEvent;
  onDelete: () => void;
}

const EventRow = memo(function EventRow({ event, onDelete }: EventRowProps) {
  return (
    <div className="health-event-row health-hover-row">
      <div className="health-event-header">
        <span className="health-event-date">{formatDate(event.date)}</span>
        <span className="health-event-type-badge">{event.type}</span>
        {event.medecin && (
          <span className="health-event-doctor">Dr {event.medecin}</span>
        )}
        <button
          type="button"
          className="health-row-delete health-event-delete"
          onClick={onDelete}
          aria-label="Supprimer cet événement"
          title="Supprimer"
        >
          ✕
        </button>
      </div>
      <p className="health-event-desc">{event.description}</p>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Child selector
// ---------------------------------------------------------------------------

interface ChildSelectorProps {
  profiles: Profile[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

function ChildSelector({ profiles, selectedId, onChange }: ChildSelectorProps) {
  const children = profiles.filter((p) => p.role === 'enfant' || p.role === 'ado');
  if (children.length <= 1) return null;
  return (
    <div className="health-child-selector">
      {children.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`health-child-pill ${selectedId === p.id ? 'health-child-pill--active' : ''}`}
          onClick={() => onChange(p.id)}
        >
          {p.avatar} {p.name}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Health() {
  const { t } = useTranslation('common');
  const { healthRecords, profiles, saveHealthRecord, addGrowthEntry, addVaccineEntry } = useVault();

  const children = useMemo(
    () => profiles.filter((p) => p.role === 'enfant' || p.role === 'ado'),
    [profiles],
  );

  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    () => children[0]?.id ?? null,
  );
  const [tab, setTab] = useState<TabId>('croissance');
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  // Medical events are session-local (HealthRecord type doesn't include historique array)
  const [medicalEvents, setMedicalEvents] = useState<MedicalEvent[]>([]);

  const record = useMemo(
    () => healthRecords.find((r) => r.enfantId === selectedChildId) ?? null,
    [healthRecords, selectedChildId],
  );

  const selectedChild = useMemo(
    () => children.find((p) => p.id === selectedChildId) ?? children[0] ?? null,
    [children, selectedChildId],
  );

  const tabOptions = [
    {
      label: `📏 ${t('health.tabs.growth', 'Croissance')}`,
      value: 'croissance',
      badge: record?.croissance.length,
    },
    {
      label: `💉 ${t('health.tabs.vaccines', 'Vaccins')}`,
      value: 'vaccins',
      badge: record?.vaccins.length,
    },
    {
      label: `📋 ${t('health.tabs.history', 'Historique')}`,
      value: 'historique',
      badge: medicalEvents.length > 0 ? medicalEvents.length : undefined,
    },
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddGrowth = useCallback(async (entry: GrowthEntry) => {
    if (!selectedChildId) return;
    await addGrowthEntry(selectedChildId, entry);
    setShowGrowthModal(false);
  }, [selectedChildId, addGrowthEntry]);

  const handleDeleteGrowth = useCallback(async (index: number) => {
    if (!record || !selectedChildId) return;
    const updated: HealthRecord = {
      ...record,
      croissance: record.croissance.filter((_, i) => i !== index),
    };
    await saveHealthRecord(updated);
  }, [record, selectedChildId, saveHealthRecord]);

  const handleAddVaccine = useCallback(async (entry: VaccineEntry) => {
    if (!selectedChildId) return;
    await addVaccineEntry(selectedChildId, entry);
    setShowVaccineModal(false);
  }, [selectedChildId, addVaccineEntry]);

  const handleDeleteVaccine = useCallback(async (index: number) => {
    if (!record || !selectedChildId) return;
    const updated: HealthRecord = {
      ...record,
      vaccins: record.vaccins.filter((_, i) => i !== index),
    };
    await saveHealthRecord(updated);
  }, [record, selectedChildId, saveHealthRecord]);

  const handleAddEvent = useCallback((event: MedicalEvent) => {
    setMedicalEvents((prev) =>
      [event, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
    );
    setShowEventModal(false);
  }, []);

  const handleDeleteEvent = useCallback((id: string) => {
    setMedicalEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ── Empty / no children state ──────────────────────────────────────────────

  if (children.length === 0) {
    return (
      <div className="page health-page">
        <div className="page-header">
          <h1 className="page-title">🏥 {t('health.title', 'Santé')}</h1>
        </div>
        <GlassCard>
          <div className="health-empty">
            <span className="health-empty-icon">👶</span>
            <p className="health-empty-text">
              {t('health.noChildren', 'Aucun profil enfant configuré')}
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  const growthSorted = [...(record?.croissance ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const vaccinsSorted = [...(record?.vaccins ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page health-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            🏥 {t('health.title', 'Santé')}
            {selectedChild && (
              <span className="health-child-badge">
                {selectedChild.avatar} {selectedChild.name}
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            {t('health.subtitle', 'Suivi médical et croissance')}
          </p>
        </div>

        {/* Context-sensitive add button */}
        {tab === 'croissance' && (
          <Button variant="primary" onClick={() => setShowGrowthModal(true)} icon="📏">
            {t('health.addMeasure', 'Ajouter une mesure')}
          </Button>
        )}
        {tab === 'vaccins' && (
          <Button variant="primary" onClick={() => setShowVaccineModal(true)} icon="💉">
            {t('health.addVaccine', 'Ajouter un vaccin')}
          </Button>
        )}
        {tab === 'historique' && (
          <Button variant="primary" onClick={() => setShowEventModal(true)} icon="📋">
            {t('health.addEvent', 'Ajouter un événement')}
          </Button>
        )}
      </div>

      {/* Child selector (only shown if multiple children) */}
      <ChildSelector
        profiles={profiles}
        selectedId={selectedChildId}
        onChange={setSelectedChildId}
      />

      {/* Tabs */}
      <div className="health-tabs">
        <SegmentedControl
          options={tabOptions}
          value={tab}
          onChange={(v) => setTab(v as TabId)}
        />
      </div>

      {/* ── Tab: Croissance ── */}
      {tab === 'croissance' && (
        <GlassCard
          title={t('health.tabs.growth', 'Croissance')}
          icon="📏"
          count={growthSorted.length}
          accentColor="#10B981"
        >
          {growthSorted.length === 0 ? (
            <div className="health-empty">
              <span className="health-empty-icon">📏</span>
              <p className="health-empty-text">
                {t('health.noGrowth', 'Aucune mesure enregistrée')}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowGrowthModal(true)}
                icon="＋"
              >
                {t('health.addMeasure', 'Ajouter une mesure')}
              </Button>
            </div>
          ) : (
            <div className="health-table-wrap">
              <table className="health-table">
                <thead>
                  <tr>
                    <th className="health-table-th">
                      {t('health.growthForm.date', 'Date')}
                    </th>
                    <th className="health-table-th health-table-th--num">
                      {t('health.growthForm.height', 'Taille')}
                    </th>
                    <th className="health-table-th health-table-th--num">
                      {t('health.growthForm.weight', 'Poids')}
                    </th>
                    <th className="health-table-th">
                      {t('health.growthForm.notes', 'Notes')}
                    </th>
                    <th className="health-table-th health-table-th--actions" />
                  </tr>
                </thead>
                <tbody>
                  {growthSorted.map((entry, i) => (
                    <GrowthRow
                      key={`${entry.date}-${i}`}
                      entry={entry}
                      onDelete={() => {
                        // Find original index in unsorted array
                        const orig = record!.croissance.indexOf(entry);
                        handleDeleteGrowth(orig);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Tab: Vaccins ── */}
      {tab === 'vaccins' && (
        <GlassCard
          title={t('health.tabs.vaccines', 'Vaccins')}
          icon="💉"
          count={vaccinsSorted.length}
          accentColor="#10B981"
        >
          {vaccinsSorted.length === 0 ? (
            <div className="health-empty">
              <span className="health-empty-icon">💉</span>
              <p className="health-empty-text">
                {t('health.noVaccines', 'Aucun vaccin enregistré')}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowVaccineModal(true)}
                icon="＋"
              >
                {t('health.addVaccine', 'Ajouter un vaccin')}
              </Button>
            </div>
          ) : (
            <div className="health-table-wrap">
              <table className="health-table">
                <thead>
                  <tr>
                    <th className="health-table-th">
                      {t('health.vaccineForm.vaccine', 'Vaccin')}
                    </th>
                    <th className="health-table-th">
                      {t('health.vaccineForm.date', 'Date')}
                    </th>
                    <th className="health-table-th">
                      {t('health.vaccineForm.dose', 'Dose')}
                    </th>
                    <th className="health-table-th">
                      {t('health.vaccineForm.notes', 'Notes')}
                    </th>
                    <th className="health-table-th health-table-th--actions" />
                  </tr>
                </thead>
                <tbody>
                  {vaccinsSorted.map((entry, i) => (
                    <VaccineRow
                      key={`${entry.nom}-${entry.date}-${i}`}
                      entry={entry}
                      onDelete={() => {
                        const orig = record!.vaccins.indexOf(entry);
                        handleDeleteVaccine(orig);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Tab: Historique ── */}
      {tab === 'historique' && (
        <GlassCard
          title={t('health.tabs.history', 'Historique médical')}
          icon="📋"
          count={medicalEvents.length}
          accentColor="#10B981"
        >
          {medicalEvents.length === 0 ? (
            <div className="health-empty">
              <span className="health-empty-icon">📋</span>
              <p className="health-empty-text">
                {t('health.noEvents', 'Aucun événement médical enregistré')}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEventModal(true)}
                icon="＋"
              >
                {t('health.addEvent', 'Ajouter un événement')}
              </Button>
            </div>
          ) : (
            <div className="health-event-list">
              {medicalEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onDelete={() => handleDeleteEvent(event.id)}
                />
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Modals ── */}
      <Modal
        isOpen={showGrowthModal}
        onClose={() => setShowGrowthModal(false)}
        title={t('health.addMeasure', 'Ajouter une mesure')}
        width="sm"
      >
        <GrowthForm
          onSave={handleAddGrowth}
          onClose={() => setShowGrowthModal(false)}
        />
      </Modal>

      <Modal
        isOpen={showVaccineModal}
        onClose={() => setShowVaccineModal(false)}
        title={t('health.addVaccine', 'Ajouter un vaccin')}
        width="md"
      >
        <VaccineForm
          onSave={handleAddVaccine}
          onClose={() => setShowVaccineModal(false)}
        />
      </Modal>

      <Modal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        title={t('health.addEvent', 'Ajouter un événement médical')}
        width="sm"
      >
        <MedicalEventForm
          onSave={handleAddEvent}
          onClose={() => setShowEventModal(false)}
        />
      </Modal>
    </div>
  );
}
