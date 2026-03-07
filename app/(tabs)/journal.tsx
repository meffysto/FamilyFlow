/**
 * journal.tsx — Baby journal screen
 *
 * View today's journal for Maxence or Enfant 2.
 * If journal doesn't exist: create from template.
 * Quick-add buttons for all entry types.
 * Tap any row to edit inline. Long-press to delete.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../hooks/useVault';
import { todayJournalPath, generateJournalTemplate } from '../../lib/parser';
import { useThemeColors } from '../../contexts/ThemeContext';
import { parseJournalStats, calculerDuree } from '../../lib/journal-stats';

// ─── Types ───────────────────────────────────────────────────────────────────

type EntryType = 'Biberon' | 'Couche' | 'Sieste' | 'Observation' | 'Médicament';

interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
  keyboard?: 'numeric' | 'default';
}

interface JournalModal {
  visible: boolean;
  type: EntryType;
  mode: 'add' | 'edit';
  lineIndex?: number; // line index in the file content (for edit/delete)
  fields: Record<string, string>;
}

// ─── Field configs per type ──────────────────────────────────────────────────

const FIELD_CONFIGS: Record<EntryType, FieldConfig[]> = {
  Biberon: [
    { key: 'heure', label: 'Heure', placeholder: 'HH:mm (auto si vide)' },
    { key: 'ml', label: 'Quantité (ml)', placeholder: 'ex: 180', keyboard: 'numeric' },
    { key: 'notes', label: 'Notes', placeholder: 'Optionnel' },
  ],
  Couche: [
    { key: 'heure', label: 'Heure', placeholder: 'HH:mm (auto si vide)' },
    { key: 'type', label: 'Type', placeholder: 'Mouillée / Souillée / Mixte' },
    { key: 'notes', label: 'Notes', placeholder: 'Optionnel' },
  ],
  Sieste: [
    { key: 'debut', label: 'Début', placeholder: 'HH:mm' },
    { key: 'fin', label: 'Fin', placeholder: 'HH:mm (vide si en cours)' },
    { key: 'duree', label: 'Durée', placeholder: 'Auto-calculée si début+fin' },
    { key: 'notes', label: 'Notes', placeholder: 'Optionnel' },
  ],
  Observation: [
    { key: 'text', label: 'Observation', placeholder: 'ex: Très joyeux ce matin, gazouille beaucoup' },
  ],
  'Médicament': [
    { key: 'heure', label: 'Heure', placeholder: 'HH:mm (auto si vide)' },
    { key: 'medicament', label: 'Médicament', placeholder: 'ex: Doliprane' },
    { key: 'dose', label: 'Dose', placeholder: 'ex: 2.5 ml' },
    { key: 'notes', label: 'Notes', placeholder: 'Optionnel' },
  ],
};

const ENTRY_META: Record<EntryType, { emoji: string; label: string }> = {
  Biberon: { emoji: '🍼', label: 'Biberon' },
  Couche: { emoji: '🚼', label: 'Couche' },
  Sieste: { emoji: '😴', label: 'Sieste' },
  Observation: { emoji: '💬', label: 'Note' },
  'Médicament': { emoji: '💊', label: 'Médic.' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRowFromFields(type: EntryType, fields: Record<string, string>, autoTime: string): string {
  const h = fields.heure?.trim() || autoTime;

  switch (type) {
    case 'Biberon': {
      const ml = fields.ml?.trim() ? `${fields.ml.trim()} ml` : '';
      return `| ${h} | Biberon | ${ml} | ${fields.notes?.trim() || ''} |`;
    }
    case 'Couche':
      return `| ${h} | ${fields.type?.trim() || 'Mouillée'} | ${fields.notes?.trim() || ''} |`;
    case 'Sieste': {
      const debut = fields.debut?.trim() || h;
      const fin = fields.fin?.trim() || '';
      // Auto-calculate duration if start + end provided but no manual duration
      let duree = fields.duree?.trim() || '';
      if (!duree && debut && fin) {
        duree = calculerDuree(debut, fin) || '';
      }
      return `| ${debut} | ${fin} | ${duree} | ${fields.notes?.trim() || ''} |`;
    }
    case 'Médicament':
      return `| ${h} | ${fields.medicament?.trim() || ''} | ${fields.dose?.trim() || ''} | ${fields.notes?.trim() || ''} |`;
    case 'Observation':
      return fields.text?.trim() || '';
    default:
      return '';
  }
}

function sectionNameForType(type: EntryType): string {
  switch (type) {
    case 'Biberon': return 'Alimentation';
    case 'Couche': return 'Couches';
    case 'Sieste': return 'Sommeil';
    case 'Observation': return 'Humeur';
    case 'Médicament': return 'dicaments';
    default: return '';
  }
}

/** Parse a table row back into field values for editing */
function parseRowToFields(type: EntryType, row: string): Record<string, string> {
  // Table row: | cell1 | cell2 | ... |
  const cells = row.split('|').filter(Boolean).map((c) => c.trim());

  switch (type) {
    case 'Biberon':
      return {
        heure: cells[0] || '',
        ml: (cells[2] || '').replace(/\s*ml\s*/i, ''),
        notes: cells[3] || '',
      };
    case 'Couche':
      return {
        heure: cells[0] || '',
        type: cells[1] || '',
        notes: cells[2] || '',
      };
    case 'Sieste':
      return {
        debut: cells[0] || '',
        fin: cells[1] || '',
        duree: cells[2] || '',
        notes: cells[3] || '',
      };
    case 'Médicament':
      return {
        heure: cells[0] || '',
        medicament: cells[1] || '',
        dose: cells[2] || '',
        notes: cells[3] || '',
      };
    case 'Observation':
      return { text: row.replace(/^\d+\.\s*/, '').trim() };
    default:
      return {};
  }
}

/** Determine entry type from section heading */
function typeFromHeading(heading: string): EntryType | null {
  const h = heading.toLowerCase();
  if (h.includes('alimentation')) return 'Biberon';
  if (h.includes('couche')) return 'Couche';
  if (h.includes('sommeil')) return 'Sieste';
  if (h.includes('humeur') || h.includes('observation')) return 'Observation';
  if (h.includes('dicament') || h.includes('soins')) return 'Médicament';
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function JournalScreen() {
  const { vault, profiles } = useVault();
  const { primary, tint } = useThemeColors();

  const enfants = useMemo(
    () => profiles.filter((p) => p.role === 'enfant'),
    [profiles]
  );
  const [selectedEnfantId, setSelectedEnfantId] = useState<string | null>(null);
  const selectedEnfant = useMemo(
    () => enfants.find((e) => e.id === selectedEnfantId) ?? enfants[0] ?? null,
    [enfants, selectedEnfantId]
  );
  const selectedEnfantName = selectedEnfant?.name ?? '';
  const [journalContent, setJournalContent] = useState<string | null>(null);
  const [journalExists, setJournalExists] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Modal state
  const [modal, setModal] = useState<JournalModal>({
    visible: false,
    type: 'Biberon',
    mode: 'add',
    fields: {},
  });

  const today = format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr });
  const todayPath = selectedEnfantName ? todayJournalPath(selectedEnfantName) : '';

  // ─── Load journal ────────────────────────────────────────────────────────

  const loadJournal = useCallback(async () => {
    if (!vault || !todayPath) return;
    try {
      const exists = await vault.exists(todayPath);
      setJournalExists(exists);
      if (exists) {
        const content = await vault.readFile(todayPath);
        setJournalContent(content);
      } else {
        setJournalContent(null);
      }
    } catch {
      setJournalContent(null);
      setJournalExists(false);
    }
  }, [vault, todayPath]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const createJournal = useCallback(async () => {
    if (!vault || !selectedEnfantName || !todayPath) return;
    setIsCreating(true);
    try {
      const template = generateJournalTemplate(selectedEnfantName);
      await vault.writeFile(todayPath, template);
      setJournalContent(template);
      setJournalExists(true);
    } catch (e) {
      Alert.alert('Erreur', `Impossible de créer le journal : ${e}`);
    } finally {
      setIsCreating(false);
    }
  }, [vault, selectedEnfantName, todayPath]);

  // ─── Quick add / edit / delete ───────────────────────────────────────────

  const openAddModal = (type: EntryType) => {
    const defaultFields: Record<string, string> = {};
    FIELD_CONFIGS[type].forEach((f) => { defaultFields[f.key] = ''; });
    setModal({ visible: true, type, mode: 'add', fields: defaultFields });
  };

  const openEditModal = (type: EntryType, lineIndex: number, row: string) => {
    const fields = parseRowToFields(type, row);
    setModal({ visible: true, type, mode: 'edit', lineIndex, fields });
  };

  const closeModal = () => setModal((m) => ({ ...m, visible: false }));

  const updateField = (key: string, value: string) => {
    setModal((m) => ({ ...m, fields: { ...m.fields, [key]: value } }));
  };

  const confirmModal = async () => {
    if (!vault || !journalExists) return;
    closeModal();

    const now = format(new Date(), 'HH:mm');

    try {
      const content = await vault.readFile(todayPath);
      const lines = content.split('\n');

      if (modal.mode === 'edit' && modal.lineIndex !== undefined) {
        // ─── Edit existing line ──────────────────────────────────────
        if (modal.type === 'Observation') {
          // Find the observation line number and replace it
          const text = modal.fields.text?.trim();
          if (text) {
            // Preserve the numbering prefix
            const existingLine = lines[modal.lineIndex];
            const numMatch = existingLine.match(/^(\d+)\.\s*/);
            lines[modal.lineIndex] = numMatch ? `${numMatch[1]}. ${text}` : text;
          }
        } else {
          const newRow = buildRowFromFields(modal.type, modal.fields, now);
          lines[modal.lineIndex] = newRow;
        }
      } else {
        // ─── Add new entry ───────────────────────────────────────────
        const sectionKey = sectionNameForType(modal.type);
        const sectionIdx = lines.findIndex(
          (l) => l.startsWith('## ') && l.includes(sectionKey)
        );

        if (sectionIdx === -1) {
          Alert.alert('Section introuvable', `Section contenant "${sectionKey}" non trouvée.`);
          return;
        }

        if (modal.type === 'Observation') {
          // Find the last numbered item in the section
          let insertAt = sectionIdx + 1;
          let lastNum = 0;
          for (let i = sectionIdx + 1; i < lines.length; i++) {
            if (lines[i].startsWith('## ') || lines[i].startsWith('### ')) break;
            const numMatch = lines[i].match(/^(\d+)\./);
            if (numMatch) {
              lastNum = parseInt(numMatch[1], 10);
              insertAt = i + 1;
            }
          }
          const text = modal.fields.text?.trim();
          if (text) {
            lines.splice(insertAt, 0, `${lastNum + 1}. ${text}`);
          }
        } else {
          const newRow = buildRowFromFields(modal.type, modal.fields, now);
          // Find last table row in section
          let insertAt = sectionIdx + 1;
          for (let i = sectionIdx + 1; i < lines.length; i++) {
            if (lines[i].startsWith('## ') || lines[i].startsWith('### ')) break;
            if (lines[i].startsWith('|')) insertAt = i + 1;
          }
          lines.splice(insertAt, 0, newRow);
        }
      }

      const newContent = lines.join('\n');
      await vault.writeFile(todayPath, newContent);
      setJournalContent(newContent);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    }
  };

  const deleteEntry = async () => {
    if (!vault || modal.lineIndex === undefined) return;
    closeModal();

    Alert.alert(
      'Supprimer cette entrée ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const content = await vault.readFile(todayPath);
              const lines = content.split('\n');
              lines.splice(modal.lineIndex!, 1);
              const newContent = lines.join('\n');
              await vault.writeFile(todayPath, newContent);
              setJournalContent(newContent);
            } catch (e) {
              Alert.alert('Erreur', String(e));
            }
          },
        },
      ]
    );
  };

  // ─── Stats ───────────────────────────────────────────────────────────────

  const journalStats = useMemo(
    () => (journalContent ? parseJournalStats(journalContent) : null),
    [journalContent]
  );

  const hasStats =
    journalStats &&
    (journalStats.biberons > 0 ||
      journalStats.tetees > 0 ||
      journalStats.couches > 0 ||
      journalStats.siestes.length > 0);

  // ─── Render sections ─────────────────────────────────────────────────────

  const renderSections = (content: string) => {
    if (!content) return null;
    const allLines = content.split('\n');

    // Find all ## sections
    const sectionStarts: { heading: string; startIdx: number }[] = [];
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].startsWith('## ')) {
        sectionStarts.push({ heading: allLines[i].slice(3).trim(), startIdx: i });
      }
    }

    return sectionStarts.map((sec, si) => {
      const endIdx = si + 1 < sectionStarts.length ? sectionStarts[si + 1].startIdx : allLines.length;
      const sectionLines = allLines.slice(sec.startIdx + 1, endIdx);
      const entryType = typeFromHeading(sec.heading);

      if (!entryType) return null;

      // ─── Observation section (numbered list) ───────────────────────
      if (entryType === 'Observation') {
        const observations: { text: string; lineIdx: number }[] = [];
        for (let i = 0; i < sectionLines.length; i++) {
          const line = sectionLines[i];
          const numMatch = line.match(/^(\d+)\.\s*(.*)/);
          if (numMatch && numMatch[2].trim()) {
            observations.push({
              text: numMatch[2].trim(),
              lineIdx: sec.startIdx + 1 + i,
            });
          }
        }

        return (
          <View key={si} style={styles.tableSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.tableSectionTitle}>{sec.heading}</Text>
              <TouchableOpacity
                style={[styles.sectionAddBtn, { backgroundColor: tint }]}
                onPress={() => openAddModal('Observation')}
              >
                <Text style={[styles.sectionAddText, { color: primary }]}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>
            {observations.length > 0 ? (
              observations.map((obs, oi) => (
                <TouchableOpacity
                  key={oi}
                  style={[styles.obsRow, oi % 2 === 1 && styles.tableRowAlt]}
                  onPress={() => openEditModal('Observation', obs.lineIdx, allLines[obs.lineIdx])}
                  activeOpacity={0.6}
                >
                  <Text style={styles.obsNumber}>{oi + 1}.</Text>
                  <Text style={styles.obsText}>{obs.text}</Text>
                  <Text style={styles.editHint}>✏️</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>Aucune observation</Text>
              </View>
            )}
          </View>
        );
      }

      // ─── Table sections (Alimentation, Couches, Sommeil, Médicaments) ─
      const tableLines = sectionLines.filter((l) => l.trim().startsWith('|'));
      if (tableLines.length === 0) return null;

      const [header, _separator, ...rows] = tableLines;
      const cols = header.split('|').filter(Boolean).map((c) => c.trim());

      // Map each row back to its absolute line index
      let tableLineIndices: number[] = [];
      for (let i = 0; i < sectionLines.length; i++) {
        if (sectionLines[i].trim().startsWith('|')) {
          tableLineIndices.push(sec.startIdx + 1 + i);
        }
      }
      // Skip header + separator (first 2 table lines)
      const dataLineIndices = tableLineIndices.slice(2);

      const dataRows = rows
        .filter((r) => r.trim() && !r.includes('---'))
        .map((row, idx) => {
          const cells = row.split('|').filter(Boolean).map((c) => c.trim());
          const hasContent = cells.some((c) => c);
          return { cells, hasContent, lineIdx: dataLineIndices[idx], raw: row };
        })
        .filter((r) => r.hasContent);

      return (
        <View key={si} style={styles.tableSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.tableSectionTitle}>{sec.heading}</Text>
            <TouchableOpacity
              style={[styles.sectionAddBtn, { backgroundColor: tint }]}
              onPress={() => openAddModal(entryType)}
            >
              <Text style={[styles.sectionAddText, { color: primary }]}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header */}
              <View style={[styles.tableRow, { backgroundColor: tint }]}>
                {cols.map((col, ci) => (
                  <Text key={ci} style={styles.tableHeader}>{col}</Text>
                ))}
              </View>
              {/* Data rows — tap to edit */}
              {dataRows.map((row, ri) => (
                <TouchableOpacity
                  key={ri}
                  style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}
                  onPress={() => openEditModal(entryType, row.lineIdx, row.raw)}
                  activeOpacity={0.6}
                >
                  {row.cells.map((cell, ci) => (
                    <Text key={ci} style={styles.tableCell}>{cell}</Text>
                  ))}
                  <Text style={styles.editHintCell}>✏️</Text>
                </TouchableOpacity>
              ))}
              {dataRows.length === 0 && (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>Aucune entrée</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      );
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const meta = ENTRY_META[modal.type];
  const fieldConfigs = FIELD_CONFIGS[modal.type];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📖 Journal bébé</Text>
        <Text style={styles.dateText}>{today}</Text>
      </View>

      {/* Enfant selector */}
      <View style={styles.tabs}>
        {enfants.map((enfant) => (
          <TouchableOpacity
            key={enfant.id}
            style={[styles.tab, selectedEnfant?.id === enfant.id && { borderBottomColor: primary }]}
            onPress={() => setSelectedEnfantId(enfant.id)}
          >
            <Text style={styles.tabEmoji}>{enfant.avatar}</Text>
            <Text style={[styles.tabText, selectedEnfant?.id === enfant.id && { color: primary }]}>
              {enfant.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick add buttons — 2 rows */}
      {journalExists && (
        <View style={styles.quickAddContainer}>
          <View style={styles.quickAddRow}>
            {(['Biberon', 'Couche', 'Sieste'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.quickBtn, { backgroundColor: tint }]}
                onPress={() => openAddModal(type)}
              >
                <Text style={styles.quickBtnEmoji}>{ENTRY_META[type].emoji}</Text>
                <Text style={[styles.quickBtnText, { color: primary }]}>+ {ENTRY_META[type].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.quickAddRow}>
            {(['Observation', 'Médicament'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.quickBtn, { backgroundColor: tint }]}
                onPress={() => openAddModal(type)}
              >
                <Text style={styles.quickBtnEmoji}>{ENTRY_META[type].emoji}</Text>
                <Text style={[styles.quickBtnText, { color: primary }]}>+ {ENTRY_META[type].label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: tint }]} onPress={loadJournal}>
              <Text style={styles.quickBtnEmoji}>🔄</Text>
              <Text style={[styles.quickBtnText, { color: primary }]}>Rafraîchir</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!journalExists ? (
          <View style={styles.createContainer}>
            <Text style={styles.createEmoji}>{selectedEnfant?.avatar ?? '👶'}</Text>
            <Text style={styles.createTitle}>
              Pas encore de journal pour {selectedEnfantName} aujourd'hui
            </Text>
            <Text style={styles.createSubtitle}>
              Créez le journal du {format(new Date(), 'dd/MM/yyyy')} pour commencer à suivre
              l'alimentation, les couches et le sommeil.
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: primary }, isCreating && styles.createBtnDisabled]}
              onPress={createJournal}
              disabled={isCreating}
            >
              <Text style={styles.createBtnText}>
                {isCreating ? 'Création...' : '📝 Créer le journal du jour'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : journalContent ? (
          <View style={styles.journalContent}>
            {/* Live stats banner */}
            {hasStats && journalStats && (
              <View style={styles.statsBanner}>
                <Text style={styles.statsBannerTitle}>📊 Résumé du jour</Text>
                <View style={styles.statsGrid}>
                  {journalStats.biberons > 0 && (
                    <View style={styles.statItem}>
                      <Text style={styles.statEmoji}>🍼</Text>
                      <Text style={styles.statValue}>{journalStats.biberons}</Text>
                      <Text style={styles.statLabel}>
                        biberon{journalStats.biberons > 1 ? 's' : ''}
                        {journalStats.totalMl > 0 ? ` (${journalStats.totalMl} ml)` : ''}
                      </Text>
                    </View>
                  )}
                  {journalStats.tetees > 0 && (
                    <View style={styles.statItem}>
                      <Text style={styles.statEmoji}>🤱</Text>
                      <Text style={styles.statValue}>{journalStats.tetees}</Text>
                      <Text style={styles.statLabel}>tétée{journalStats.tetees > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {journalStats.couches > 0 && (
                    <View style={styles.statItem}>
                      <Text style={styles.statEmoji}>🚼</Text>
                      <Text style={styles.statValue}>{journalStats.couches}</Text>
                      <Text style={styles.statLabel}>couche{journalStats.couches > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {journalStats.sommeilTotal && (
                    <View style={styles.statItem}>
                      <Text style={styles.statEmoji}>😴</Text>
                      <Text style={styles.statValue}>{journalStats.sommeilTotal}</Text>
                      <Text style={styles.statLabel}>
                        {journalStats.sommeilNuit ? `🌙 ${journalStats.sommeilNuit}` : ''}
                        {journalStats.sommeilNuit && journalStats.sommeilJour ? ' · ' : ''}
                        {journalStats.sommeilJour ? `☀️ ${journalStats.sommeilJour}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            {renderSections(journalContent)}
          </View>
        ) : null}
      </ScrollView>

      {/* Unified Add/Edit Modal */}
      <Modal
        visible={modal.visible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {meta.emoji}{' '}
              {modal.mode === 'edit' ? `Modifier — ${meta.label}` : `Ajouter — ${meta.label}`}
            </Text>

            {fieldConfigs.map((field) => (
              <View key={field.key} style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={field.placeholder}
                  placeholderTextColor="#9CA3AF"
                  value={modal.fields[field.key] || ''}
                  onChangeText={(v) => updateField(field.key, v)}
                  keyboardType={field.keyboard === 'numeric' ? 'numeric' : 'default'}
                  autoFocus={field === fieldConfigs[0]}
                  returnKeyType={field === fieldConfigs[fieldConfigs.length - 1] ? 'done' : 'next'}
                  onSubmitEditing={
                    field === fieldConfigs[fieldConfigs.length - 1] ? confirmModal : undefined
                  }
                  multiline={field.key === 'text'}
                  numberOfLines={field.key === 'text' ? 3 : 1}
                />
              </View>
            ))}

            <View style={styles.modalActions}>
              {modal.mode === 'edit' && (
                <TouchableOpacity style={styles.modalDelete} onPress={deleteEntry}>
                  <Text style={styles.modalDeleteText}>🗑</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalCancel} onPress={closeModal}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: primary }]}
                onPress={confirmModal}
              >
                <Text style={styles.modalConfirmText}>
                  {modal.mode === 'edit' ? 'Modifier' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const COL_WIDTH = 110;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  dateText: { fontSize: 13, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabEmoji: { fontSize: 18 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },

  // Quick add
  quickAddContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 6,
    gap: 4,
  },
  quickAddRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 8,
    gap: 2,
  },
  quickBtnEmoji: { fontSize: 18 },
  quickBtnText: { fontSize: 11, fontWeight: '600' },

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // Create journal
  createContainer: { alignItems: 'center', paddingVertical: 48, gap: 16 },
  createEmoji: { fontSize: 64 },
  createTitle: { fontSize: 18, fontWeight: '700', color: '#374151', textAlign: 'center' },
  createSubtitle: {
    fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, maxWidth: 300,
  },
  createBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  createBtnDisabled: { backgroundColor: '#A78BFA' },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  journalContent: { gap: 16 },

  // Stats
  statsBanner: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: '#8B5CF6',
  },
  statsBannerTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F9FAFB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  statEmoji: { fontSize: 16 },
  statValue: { fontSize: 15, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // Table sections
  tableSection: {
    backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingRight: 8,
  },
  tableSectionTitle: {
    fontSize: 15, fontWeight: '700', color: '#111827', padding: 12,
  },
  sectionAddBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  sectionAddText: { fontSize: 12, fontWeight: '700' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableHeader: {
    width: COL_WIDTH, padding: 8, fontSize: 12, fontWeight: '700', color: '#5B21B6',
  },
  tableCell: { width: COL_WIDTH, padding: 8, fontSize: 13, color: '#374151' },
  editHintCell: { padding: 8, fontSize: 12, opacity: 0.3 },

  // Observations
  obsRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8,
  },
  obsNumber: { fontSize: 14, fontWeight: '700', color: '#8B5CF6', width: 24 },
  obsText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  editHint: { fontSize: 12, opacity: 0.3 },

  emptySection: { padding: 16, alignItems: 'center' },
  emptySectionText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalDismiss: { flex: 1 },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  modalInput: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#111827',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalDelete: {
    padding: 14, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center',
    justifyContent: 'center', width: 48,
  },
  modalDeleteText: { fontSize: 18 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalConfirm: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
