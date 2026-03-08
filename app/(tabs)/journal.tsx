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
import { todayJournalPath, generateJournalTemplate, todayAdultJournalPath, generateAdultJournalTemplate } from '../../lib/parser';
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
  lineIndex?: number;
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

function parseRowToFields(type: EntryType, row: string): Record<string, string> {
  const cells = row.split('|').filter(Boolean).map((c) => c.trim());

  switch (type) {
    case 'Biberon':
      return { heure: cells[0] || '', ml: (cells[2] || '').replace(/\s*ml\s*/i, ''), notes: cells[3] || '' };
    case 'Couche':
      return { heure: cells[0] || '', type: cells[1] || '', notes: cells[2] || '' };
    case 'Sieste':
      return { debut: cells[0] || '', fin: cells[1] || '', duree: cells[2] || '', notes: cells[3] || '' };
    case 'Médicament':
      return { heure: cells[0] || '', medicament: cells[1] || '', dose: cells[2] || '', notes: cells[3] || '' };
    case 'Observation':
      return { text: row.replace(/^\d+\.\s*/, '').trim() };
    default:
      return {};
  }
}

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
  const { vault, profiles, activeProfile } = useVault();
  const { primary, tint, colors } = useThemeColors();

  const enfants = useMemo(
    () => profiles.filter((p) => p.role === 'enfant'),
    [profiles]
  );

  const isAdultMode = activeProfile?.role === 'adulte' || activeProfile?.role === 'ado';

  // Tab can be 'adulte' (personal journal) or an enfant ID
  const [selectedTab, setSelectedTab] = useState<string>(
    isAdultMode ? 'adulte' : (enfants[0]?.id ?? '')
  );
  const isViewingAdultTab = selectedTab === 'adulte';
  const selectedEnfant = useMemo(
    () => (isViewingAdultTab ? null : enfants.find((e) => e.id === selectedTab) ?? enfants[0] ?? null),
    [enfants, selectedTab, isViewingAdultTab]
  );
  const selectedEnfantName = selectedEnfant?.name ?? '';

  const [journalContent, setJournalContent] = useState<string | null>(null);
  const [journalExists, setJournalExists] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [modal, setModal] = useState<JournalModal>({
    visible: false,
    type: 'Biberon',
    mode: 'add',
    fields: {},
  });

  const today = format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr });
  const todayPath = isViewingAdultTab && activeProfile
    ? todayAdultJournalPath(activeProfile.name)
    : selectedEnfantName ? todayJournalPath(selectedEnfantName) : '';

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

  useEffect(() => { loadJournal(); }, [loadJournal]);

  const createJournal = useCallback(async () => {
    if (!vault || !todayPath) return;
    if (!isViewingAdultTab && !selectedEnfantName) return;
    setIsCreating(true);
    try {
      const template = isViewingAdultTab && activeProfile
        ? generateAdultJournalTemplate(activeProfile.name)
        : generateJournalTemplate(selectedEnfantName);
      await vault.writeFile(todayPath, template);
      setJournalContent(template);
      setJournalExists(true);
    } catch (e) {
      Alert.alert('Erreur', `Impossible de créer le journal : ${e}`);
    } finally {
      setIsCreating(false);
    }
  }, [vault, selectedEnfantName, todayPath]);

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
        if (modal.type === 'Observation') {
          const text = modal.fields.text?.trim();
          if (text) {
            const existingLine = lines[modal.lineIndex];
            const numMatch = existingLine.match(/^(\d+)\.\s*/);
            lines[modal.lineIndex] = numMatch ? `${numMatch[1]}. ${text}` : text;
          }
        } else {
          const newRow = buildRowFromFields(modal.type, modal.fields, now);
          lines[modal.lineIndex] = newRow;
        }
      } else {
        const sectionKey = sectionNameForType(modal.type);
        const sectionIdx = lines.findIndex(
          (l) => l.startsWith('## ') && l.includes(sectionKey)
        );

        if (sectionIdx === -1) {
          Alert.alert('Oups !', `Impossible d'ajouter cette entrée. Le journal du jour semble incomplet.`);
          return;
        }

        if (modal.type === 'Observation') {
          let insertAt = sectionIdx + 1;
          let lastNum = 0;
          for (let i = sectionIdx + 1; i < lines.length; i++) {
            if (lines[i].startsWith('## ') || lines[i].startsWith('### ')) break;
            const numMatch = lines[i].match(/^(\d+)\./);
            if (numMatch) { lastNum = parseInt(numMatch[1], 10); insertAt = i + 1; }
          }
          const text = modal.fields.text?.trim();
          if (text) lines.splice(insertAt, 0, `${lastNum + 1}. ${text}`);
        } else {
          const newRow = buildRowFromFields(modal.type, modal.fields, now);
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
              await vault.writeFile(todayPath, lines.join('\n'));
              setJournalContent(lines.join('\n'));
            } catch (e) {
              Alert.alert('Erreur', String(e));
            }
          },
        },
      ]
    );
  };

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

  const renderSections = (content: string) => {
    if (!content) return null;
    const allLines = content.split('\n');

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

      if (entryType === 'Observation') {
        const observations: { text: string; lineIdx: number }[] = [];
        for (let i = 0; i < sectionLines.length; i++) {
          const line = sectionLines[i];
          const numMatch = line.match(/^(\d+)\.\s*(.*)/);
          if (numMatch && numMatch[2].trim()) {
            observations.push({ text: numMatch[2].trim(), lineIdx: sec.startIdx + 1 + i });
          }
        }

        return (
          <View key={si} style={[styles.tableSection, { backgroundColor: colors.card }]}>
            <View style={[styles.sectionHeader, { backgroundColor: colors.cardAlt, borderBottomColor: colors.border }]}>
              <Text style={[styles.tableSectionTitle, { color: colors.text }]}>{sec.heading}</Text>
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
                  style={[styles.obsRow, { borderBottomColor: colors.borderLight }, oi % 2 === 1 && { backgroundColor: colors.cardAlt }]}
                  onPress={() => openEditModal('Observation', obs.lineIdx, allLines[obs.lineIdx])}
                  activeOpacity={0.6}
                >
                  <Text style={styles.obsNumber}>{oi + 1}.</Text>
                  <Text style={[styles.obsText, { color: colors.textSub }]}>{obs.text}</Text>
                  <Text style={styles.editHint}>✏️</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textFaint }]}>Aucune observation</Text>
              </View>
            )}
          </View>
        );
      }

      const tableLines = sectionLines.filter((l) => l.trim().startsWith('|'));
      if (tableLines.length === 0) return null;

      const [header, _separator, ...rows] = tableLines;
      const cols = header.split('|').filter(Boolean).map((c) => c.trim());

      let tableLineIndices: number[] = [];
      for (let i = 0; i < sectionLines.length; i++) {
        if (sectionLines[i].trim().startsWith('|')) {
          tableLineIndices.push(sec.startIdx + 1 + i);
        }
      }
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
        <View key={si} style={[styles.tableSection, { backgroundColor: colors.card }]}>
          <View style={[styles.sectionHeader, { backgroundColor: colors.cardAlt, borderBottomColor: colors.border }]}>
            <Text style={[styles.tableSectionTitle, { color: colors.text }]}>{sec.heading}</Text>
            <TouchableOpacity
              style={[styles.sectionAddBtn, { backgroundColor: tint }]}
              onPress={() => openAddModal(entryType)}
            >
              <Text style={[styles.sectionAddText, { color: primary }]}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[styles.tableRow, { backgroundColor: tint, borderBottomColor: colors.border }]}>
                {cols.map((col, ci) => (
                  <Text key={ci} style={[styles.tableHeader, { color: primary }]}>{col}</Text>
                ))}
              </View>
              {dataRows.map((row, ri) => (
                <TouchableOpacity
                  key={ri}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: colors.borderLight },
                    ri % 2 === 1 && { backgroundColor: colors.cardAlt },
                  ]}
                  onPress={() => openEditModal(entryType, row.lineIdx, row.raw)}
                  activeOpacity={0.6}
                >
                  {row.cells.map((cell, ci) => (
                    <Text key={ci} style={[styles.tableCell, { color: colors.textSub }]}>{cell}</Text>
                  ))}
                  <Text style={styles.editHintCell}>✏️</Text>
                </TouchableOpacity>
              ))}
              {dataRows.length === 0 && (
                <View style={styles.emptySection}>
                  <Text style={[styles.emptySectionText, { color: colors.textFaint }]}>Aucune entrée</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      );
    });
  };

  const meta = ENTRY_META[modal.type];
  const fieldConfigs = FIELD_CONFIGS[modal.type];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>📖 Journal</Text>
        <Text style={[styles.dateText, { color: colors.textMuted }]}>{today}</Text>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {isAdultMode && (
          <TouchableOpacity
            style={[styles.tab, isViewingAdultTab && { borderBottomColor: primary }]}
            onPress={() => setSelectedTab('adulte')}
          >
            <Text style={styles.tabEmoji}>{activeProfile?.avatar ?? '📖'}</Text>
            <Text style={[styles.tabText, { color: colors.textFaint }, isViewingAdultTab && { color: primary }]}>
              Mon journal
            </Text>
          </TouchableOpacity>
        )}
        {enfants.map((enfant) => (
          <TouchableOpacity
            key={enfant.id}
            style={[styles.tab, selectedTab === enfant.id && { borderBottomColor: primary }]}
            onPress={() => setSelectedTab(enfant.id)}
          >
            <Text style={styles.tabEmoji}>{enfant.avatar}</Text>
            <Text style={[styles.tabText, { color: colors.textFaint }, selectedTab === enfant.id && { color: primary }]}>
              {enfant.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {journalExists && !isViewingAdultTab && (
        <View style={[styles.quickAddContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
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
            <Text style={styles.createEmoji}>{isViewingAdultTab ? (activeProfile?.avatar ?? '📖') : (selectedEnfant?.avatar ?? '👶')}</Text>
            <Text style={[styles.createTitle, { color: colors.textSub }]}>
              {isViewingAdultTab
                ? `Pas encore de journal pour ${activeProfile?.name}`
                : `Pas encore de journal pour ${selectedEnfantName} aujourd'hui`}
            </Text>
            <Text style={[styles.createSubtitle, { color: colors.textMuted }]}>
              {isViewingAdultTab
                ? 'Créez votre journal personnel pour noter vos pensées, humeur et objectifs.'
                : `Créez le journal du ${format(new Date(), 'dd/MM/yyyy')} pour commencer à suivre l'alimentation, les couches et le sommeil.`}
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
            {!isViewingAdultTab && hasStats && journalStats && (
              <View style={[styles.statsBanner, { backgroundColor: colors.card }]}>
                <Text style={[styles.statsBannerTitle, { color: colors.text }]}>📊 Résumé du jour</Text>
                <View style={styles.statsGrid}>
                  {journalStats.biberons > 0 && (
                    <View style={[styles.statItem, { backgroundColor: colors.cardAlt }]}>
                      <Text style={styles.statEmoji}>🍼</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{journalStats.biberons}</Text>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                        biberon{journalStats.biberons > 1 ? 's' : ''}
                        {journalStats.totalMl > 0 ? ` (${journalStats.totalMl} ml)` : ''}
                      </Text>
                    </View>
                  )}
                  {journalStats.tetees > 0 && (
                    <View style={[styles.statItem, { backgroundColor: colors.cardAlt }]}>
                      <Text style={styles.statEmoji}>🤱</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{journalStats.tetees}</Text>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>tétée{journalStats.tetees > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {journalStats.couches > 0 && (
                    <View style={[styles.statItem, { backgroundColor: colors.cardAlt }]}>
                      <Text style={styles.statEmoji}>🚼</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{journalStats.couches}</Text>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>couche{journalStats.couches > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {journalStats.sommeilTotal && (
                    <View style={[styles.statItem, { backgroundColor: colors.cardAlt }]}>
                      <Text style={styles.statEmoji}>😴</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{journalStats.sommeilTotal}</Text>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
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
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {meta.emoji}{' '}
              {modal.mode === 'edit' ? `Modifier ${meta.label}` : `Ajouter ${meta.label}`}
            </Text>

            {fieldConfigs.map((field) => (
              <View key={field.key} style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textFaint}
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
              <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={closeModal}>
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Annuler</Text>
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
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '800' },
  dateText: { fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
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
  tabText: { fontSize: 14, fontWeight: '600' },

  quickAddContainer: {
    borderBottomWidth: 1,
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

  createContainer: { alignItems: 'center', paddingVertical: 48, gap: 16 },
  createEmoji: { fontSize: 64 },
  createTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  createSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  createBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  journalContent: { gap: 16 },

  statsBanner: {
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  statsBannerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  statEmoji: { fontSize: 16 },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '500' },

  tableSection: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingRight: 8,
  },
  tableSectionTitle: { fontSize: 15, fontWeight: '700', padding: 12 },
  sectionAddBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sectionAddText: { fontSize: 12, fontWeight: '700' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tableHeader: { width: COL_WIDTH, padding: 8, fontSize: 12, fontWeight: '700' },
  tableCell: { width: COL_WIDTH, padding: 8, fontSize: 13 },
  editHintCell: { padding: 8, fontSize: 12, opacity: 0.3 },

  obsRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, gap: 8,
  },
  obsNumber: { fontSize: 14, fontWeight: '700', color: '#8B5CF6', width: 24 },
  obsText: { flex: 1, fontSize: 14, lineHeight: 20 },
  editHint: { fontSize: 12, opacity: 0.3 },

  emptySection: { padding: 16, alignItems: 'center' },
  emptySectionText: { fontSize: 13, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContent: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  modalInput: {
    borderWidth: 1.5, borderRadius: 10,
    padding: 12, fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalDelete: {
    padding: 14, borderRadius: 10, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', width: 48,
  },
  modalDeleteText: { fontSize: 18 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
  modalConfirm: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
