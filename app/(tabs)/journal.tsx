/**
 * journal.tsx — Baby journal screen
 *
 * View journal for any date. Mini calendar for navigation.
 * Quick-add buttons for all entry types.
 * Tap any row to edit inline. Long-press to delete.
 * Enfants/ados: lecture seule.
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
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday as isTodayFn } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../contexts/VaultContext';
import { todayJournalPath, journalPathForDate, generateJournalTemplate, todayAdultJournalPath, adultJournalPathForDate, generateAdultJournalTemplate } from '../../lib/parser';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { useThemeColors } from '../../contexts/ThemeContext';
import { parseJournalStats, calculerDuree } from '../../lib/journal-stats';
import { MarkdownText } from '../../components/ui/MarkdownText';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { FontSize, FontWeight } from '../../constants/typography';

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

/** Formate une saisie d'heure : "7" → "7h00", "18" → "18h00", "7h" → "7h00", "14:30" → "14h30", "7h30" → "7h30" */
function formatTime(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  // Déjà au format complet HHhMM ou HH:MM
  if (/^\d{1,2}h\d{2}$/.test(s)) return s;
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.replace(':', 'h');
  // Juste un nombre (ex: "7", "18")
  if (/^\d{1,2}$/.test(s)) return `${s}h00`;
  // "7h" sans minutes
  if (/^\d{1,2}h$/.test(s)) return `${s}00`;
  return s;
}

function buildRowFromFields(type: EntryType, fields: Record<string, string>, autoTime: string): string {
  const h = formatTime(fields.heure?.trim()) || autoTime;

  switch (type) {
    case 'Biberon': {
      const ml = fields.ml?.trim() ? `${fields.ml.trim()} ml` : '';
      return `| ${h} | Biberon | ${ml} | ${fields.notes?.trim() || ''} |`;
    }
    case 'Couche':
      return `| ${h} | ${fields.type?.trim() || 'Mouillée'} | ${fields.notes?.trim() || ''} |`;
    case 'Sieste': {
      const debut = formatTime(fields.debut?.trim()) || h;
      const fin = formatTime(fields.fin?.trim());
      let duree = fields.duree?.trim() || '';
      if (!duree && debut && fin) {
        duree = calculerDuree(debut, fin) || '';
      }
      return `| ${debut} | ${fin} | ${duree} | ${fields.notes?.trim() || ''} |`;
    }
    case 'Médicament':
      return `| ${formatTime(fields.heure?.trim()) || h} | ${fields.medicament?.trim() || ''} | ${fields.dose?.trim() || ''} | ${fields.notes?.trim() || ''} |`;
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

// ─── Mini Calendar ───────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate,
  onSelectDate,
  availableDates,
  colors,
  primary,
  tint,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  availableDates: Set<string>;
  colors: any;
  primary: string;
  tint: string;
}) {
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate));

  const days = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const allDays = eachDayOfInterval({ start, end });
    const startDay = getDay(start); // 0=Sun
    // Padding pour aligner au lundi (1=lundi, on décale)
    const mondayOffset = startDay === 0 ? 6 : startDay - 1;
    const padding: (Date | null)[] = Array(mondayOffset).fill(null);
    return [...padding, ...allDays];
  }, [viewMonth]);

  const monthLabel = format(viewMonth, 'MMMM yyyy', { locale: fr });

  return (
    <View style={[calStyles.container, { backgroundColor: colors.card }]}>
      <View style={calStyles.nav}>
        <TouchableOpacity onPress={() => setViewMonth(subMonths(viewMonth, 1))} style={calStyles.navBtn} accessibilityLabel="Mois précédent" accessibilityRole="button">
          <Text style={[calStyles.navArrow, { color: colors.textMuted }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewMonth(startOfMonth(new Date()))} style={calStyles.monthBtn} accessibilityLabel={`${monthLabel}, appuyez pour revenir au mois courant`} accessibilityRole="button">
          <Text style={[calStyles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewMonth(addMonths(viewMonth, 1))} style={calStyles.navBtn} accessibilityLabel="Mois suivant" accessibilityRole="button">
          <Text style={[calStyles.navArrow, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={calStyles.weekdays}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <Text key={i} style={[calStyles.weekday, { color: colors.textFaint }]}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {days.map((day, i) => {
          if (!day) return <View key={`pad-${i}`} style={calStyles.dayCell} />;
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasJournal = availableDates.has(dateStr);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isTodayFn(day);
          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                calStyles.dayCell,
                isSelected && { backgroundColor: primary },
                !isSelected && isToday && { backgroundColor: tint },
              ]}
              onPress={() => hasJournal && onSelectDate(day)}
              disabled={!hasJournal}
              activeOpacity={0.6}
              accessibilityLabel={`${day.getDate()} ${format(day, 'MMMM', { locale: fr })}${hasJournal ? ', journal disponible' : ''}${isToday ? ", aujourd'hui" : ''}${isSelected ? ', sélectionné' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: !hasJournal }}
            >
              <Text
                style={[
                  calStyles.dayText,
                  { color: hasJournal ? colors.text : colors.textFaint },
                  isSelected && { color: '#FFFFFF', fontWeight: FontWeight.heavy },
                  !isSelected && isToday && { color: primary, fontWeight: FontWeight.heavy },
                ]}
              >
                {day.getDate()}
              </Text>
              {hasJournal && !isSelected && (
                <View style={[calStyles.dot, { backgroundColor: primary }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function JournalScreen() {
  const { vault, profiles, activeProfile } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const { enfant: enfantParam } = useLocalSearchParams<{ enfant?: string }>();

  const childSelectorRef = useRef<View>(null);
  const firstSectionRef = useRef<View>(null);

  const enfants = useMemo(
    () => profiles.filter((p) => p.role === 'enfant'),
    [profiles]
  );

  const isAdultMode = activeProfile?.role === 'adulte' || activeProfile?.role === 'ado';
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
  const canEdit = !isChildMode;

  // Tab can be 'adulte' (personal journal) or an enfant ID
  const [selectedTab, setSelectedTab] = useState<string>(
    enfantParam && enfants.some((e) => e.id === enfantParam)
      ? enfantParam
      : isAdultMode ? 'adulte' : (enfants[0]?.id ?? '')
  );
  const isViewingAdultTab = selectedTab === 'adulte';
  const selectedEnfant = useMemo(
    () => (isViewingAdultTab ? null : enfants.find((e) => e.id === selectedTab) ?? enfants[0] ?? null),
    [enfants, selectedTab, isViewingAdultTab]
  );
  const selectedEnfantName = selectedEnfant?.name ?? '';

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());

  const isToday = isTodayFn(selectedDate);
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateDisplay = format(selectedDate, 'EEEE dd MMMM yyyy', { locale: fr });

  const [journalContent, setJournalContent] = useState<string | null>(null);
  const [journalExists, setJournalExists] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [modal, setModal] = useState<JournalModal>({
    visible: false,
    type: 'Biberon',
    mode: 'add',
    fields: {},
  });

  // Chemin du journal pour la date sélectionnée
  const journalPath = useMemo(() => {
    if (isViewingAdultTab && activeProfile) {
      return adultJournalPathForDate(activeProfile.name, selectedDateStr);
    }
    if (!selectedEnfantName) return '';
    return journalPathForDate(selectedEnfantName, selectedDateStr);
  }, [isViewingAdultTab, activeProfile, selectedEnfantName, selectedDateStr]);

  // Charger les dates disponibles
  const loadAvailableDates = useCallback(async () => {
    if (!vault) {
      setAvailableDates(new Set());
      return;
    }
    try {
      const dir = isViewingAdultTab && activeProfile
        ? `01 - Adultes/${activeProfile.name}/Journal`
        : `03 - Journal/${selectedEnfantName}`;
      if (!isViewingAdultTab && !selectedEnfantName) {
        setAvailableDates(new Set());
        return;
      }
      const files = await vault.listDir(dir);
      const dates = new Set(
        files
          .filter((f: string) => f.endsWith('.md'))
          .map((f: string) => f.split(' ')[0])
          .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      );
      setAvailableDates(dates);
    } catch {
      setAvailableDates(new Set());
    }
  }, [vault, isViewingAdultTab, activeProfile, selectedEnfantName]);

  useEffect(() => { loadAvailableDates(); }, [loadAvailableDates]);

  const loadJournal = useCallback(async () => {
    if (!vault || !journalPath) return;
    try {
      const exists = await vault.exists(journalPath);
      setJournalExists(exists);
      if (exists) {
        const content = await vault.readFile(journalPath);
        setJournalContent(content);
      } else {
        setJournalContent(null);
      }
    } catch {
      setJournalContent(null);
      setJournalExists(false);
    }
  }, [vault, journalPath]);

  useEffect(() => { loadJournal(); }, [loadJournal]);

  // Recharger quand l'écran gagne le focus (sync iCloud depuis un autre appareil)
  useFocusEffect(useCallback(() => { loadJournal(); }, [loadJournal]));

  // Naviguer vers une date depuis le calendrier
  const navigateToDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  }, []);

  // Navigation rapide : jour précédent/suivant avec journal
  const navigatePrev = useCallback(() => {
    const sorted = [...availableDates].sort().reverse();
    const next = sorted.find((d) => d < selectedDateStr);
    if (next) setSelectedDate(new Date(next + 'T12:00:00'));
  }, [availableDates, selectedDateStr]);

  const navigateNext = useCallback(() => {
    const sorted = [...availableDates].sort();
    const next = sorted.find((d) => d > selectedDateStr);
    if (next) setSelectedDate(new Date(next + 'T12:00:00'));
  }, [availableDates, selectedDateStr]);

  const hasPrev = useMemo(() => [...availableDates].some((d) => d < selectedDateStr), [availableDates, selectedDateStr]);
  const hasNext = useMemo(() => [...availableDates].some((d) => d > selectedDateStr), [availableDates, selectedDateStr]);

  const createJournal = useCallback(async () => {
    if (!vault || !journalPath) return;
    if (!isViewingAdultTab && !selectedEnfantName) return;
    setIsCreating(true);
    try {
      const template = isViewingAdultTab && activeProfile
        ? generateAdultJournalTemplate(activeProfile.name)
        : generateJournalTemplate(selectedEnfantName, { propre: selectedEnfant?.propre });
      await vault.writeFile(journalPath, template);
      setJournalContent(template);
      setJournalExists(true);
      // Ajouter la date aux dates disponibles
      setAvailableDates((prev) => new Set([...prev, selectedDateStr]));
    } catch (e) {
      Alert.alert('Erreur', `Impossible de créer le journal : ${e}`);
    } finally {
      setIsCreating(false);
    }
  }, [vault, selectedEnfantName, journalPath, selectedDateStr]);

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
      const content = await vault.readFile(journalPath);
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
      await vault.writeFile(journalPath, newContent);
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
              const content = await vault.readFile(journalPath);
              const lines = content.split('\n');
              lines.splice(modal.lineIndex!, 1);
              await vault.writeFile(journalPath, lines.join('\n'));
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
            </View>
            {observations.length > 0 ? (
              observations.map((obs, oi) => (
                <TouchableOpacity
                  key={oi}
                  style={[styles.obsRow, { borderBottomColor: colors.borderLight }, oi % 2 === 1 && { backgroundColor: colors.cardAlt }]}
                  onPress={() => canEdit && openEditModal('Observation', obs.lineIdx, allLines[obs.lineIdx])}
                  activeOpacity={canEdit ? 0.6 : 1}
                  disabled={!canEdit}
                >
                  <Text style={styles.obsNumber}>{oi + 1}.</Text>
                  <MarkdownText style={{ color: colors.textSub }}>{obs.text}</MarkdownText>
                  {canEdit && <Text style={styles.editHint}>✏️</Text>}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textFaint }]}>Aucune observation</Text>
              </View>
            )}
            {canEdit && (
              <TouchableOpacity
                style={[styles.sectionEmojiBtn, { borderTopColor: colors.borderLight }]}
                onPress={() => openAddModal('Observation')}
                accessibilityLabel="Ajouter une observation"
                accessibilityRole="button"
              >
                <Text style={styles.sectionEmojiBtnIcon}>{ENTRY_META.Observation.emoji}</Text>
                <Text style={[styles.sectionEmojiBtnText, { color: primary }]}>Ajouter</Text>
              </TouchableOpacity>
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
          </View>
          <View>
            <View style={[styles.tableRow, { backgroundColor: tint, borderBottomColor: colors.border }]}>
              {cols.map((col, ci) => (
                <Text key={ci} style={[ci === cols.length - 1 ? styles.tableHeaderFlex : styles.tableHeader, { color: primary }]}>{col}</Text>
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
                onPress={() => canEdit && openEditModal(entryType, row.lineIdx, row.raw)}
                activeOpacity={canEdit ? 0.6 : 1}
                disabled={!canEdit}
              >
                {row.cells.map((cell, ci) => (
                  <Text key={ci} style={[ci === row.cells.length - 1 ? styles.tableCellFlex : styles.tableCell, { color: colors.textSub }]} numberOfLines={2}>{cell}</Text>
                ))}
                {canEdit && <Text style={styles.editHintCell}>✏️</Text>}
              </TouchableOpacity>
            ))}
            {dataRows.length === 0 && (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textFaint }]}>Aucune entrée</Text>
              </View>
            )}
          </View>
          {canEdit && (
            <TouchableOpacity
              style={[styles.sectionEmojiBtn, { borderTopColor: colors.borderLight }]}
              onPress={() => openAddModal(entryType)}
              accessibilityLabel={`Ajouter dans ${sec.heading}`}
              accessibilityRole="button"
            >
              <Text style={styles.sectionEmojiBtnIcon}>{ENTRY_META[entryType].emoji}</Text>
              <Text style={[styles.sectionEmojiBtnText, { color: primary }]}>Ajouter</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    });
  };

  const meta = ENTRY_META[modal.type];
  const fieldConfigs = FIELD_CONFIGS[modal.type];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>📖 Journal</Text>
      </View>

      {/* Onglets enfant / adulte */}
      <View ref={childSelectorRef} style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SegmentedControl
          segments={[
            ...(isAdultMode ? [{ id: 'adulte', label: `${activeProfile?.avatar ?? '📖'} Mon journal` }] : []),
            ...enfants.map((e) => ({ id: e.id, label: `${e.avatar} ${e.name}` })),
          ]}
          value={selectedTab}
          onChange={setSelectedTab}
        />
      </View>

      {/* Navigation date */}
      <View style={[styles.dateNav, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={navigatePrev} disabled={!hasPrev} style={styles.dateNavBtn} accessibilityLabel="Jour précédent" accessibilityRole="button" accessibilityState={{ disabled: !hasPrev }}>
          <Text style={[styles.dateNavArrow, { color: hasPrev ? colors.text : colors.textFaint }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)} style={styles.dateNavCenter} accessibilityLabel={`${selectedDateDisplay}, appuyez pour ouvrir le calendrier`} accessibilityRole="button">
          <Text style={[styles.dateNavText, { color: colors.text }]}>
            {isToday ? "Aujourd'hui" : format(selectedDate, 'dd/MM/yyyy')}
          </Text>
          <Text style={[styles.dateNavSub, { color: colors.textMuted }]}>
            {isToday ? format(selectedDate, 'dd MMMM', { locale: fr }) : format(selectedDate, 'EEEE', { locale: fr })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={navigateNext} disabled={!hasNext} style={styles.dateNavBtn} accessibilityLabel="Jour suivant" accessibilityRole="button" accessibilityState={{ disabled: !hasNext }}>
          <Text style={[styles.dateNavArrow, { color: hasNext ? colors.text : colors.textFaint }]}>›</Text>
        </TouchableOpacity>
        {!isToday && (
          <TouchableOpacity onPress={() => setSelectedDate(new Date())} style={[styles.todayBtn, { backgroundColor: tint }]} accessibilityLabel="Revenir à aujourd'hui" accessibilityRole="button">
            <Text style={[styles.todayBtnText, { color: primary }]}>Aujourd'hui</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Calendrier mini */}
      {showCalendar && (
        <MiniCalendar
          selectedDate={selectedDate}
          onSelectDate={navigateToDate}
          availableDates={availableDates}
          colors={colors}
          primary={primary}
          tint={tint}
        />
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!journalExists ? (
          <View style={styles.createContainer}>
            <Text style={styles.createEmoji}>{isViewingAdultTab ? (activeProfile?.avatar ?? '📖') : (selectedEnfant?.avatar ?? '👶')}</Text>
            <Text style={[styles.createTitle, { color: colors.textSub }]}>
              {isViewingAdultTab
                ? `Pas encore de journal pour ${activeProfile?.name}`
                : isToday
                  ? `Pas encore de journal pour ${selectedEnfantName} aujourd'hui`
                  : `Pas de journal le ${format(selectedDate, 'dd/MM/yyyy')}`}
            </Text>
            {isToday && canEdit && (
              <>
                <Text style={[styles.createSubtitle, { color: colors.textMuted }]}>
                  {isViewingAdultTab
                    ? 'Créez votre journal personnel pour noter vos pensées, humeur et objectifs.'
                    : `Créez le journal du ${format(new Date(), 'dd/MM/yyyy')} pour commencer à suivre l'alimentation, les couches et le sommeil.`}
                </Text>
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: primary }, isCreating && styles.createBtnDisabled]}
                  onPress={createJournal}
                  disabled={isCreating}
                  accessibilityLabel="Créer le journal du jour"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isCreating }}
                >
                  <Text style={styles.createBtnText}>
                    {isCreating ? 'Création...' : '📝 Créer le journal du jour'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : journalContent ? (
          <View ref={firstSectionRef} style={styles.journalContent}>
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
                <TouchableOpacity style={styles.modalDelete} onPress={deleteEntry} accessibilityLabel="Supprimer cette entrée" accessibilityRole="button">
                  <Text style={styles.modalDeleteText}>🗑</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={closeModal} accessibilityLabel="Annuler" accessibilityRole="button">
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: primary }]}
                onPress={confirmModal}
                accessibilityLabel={modal.mode === 'edit' ? 'Modifier' : 'Ajouter'}
                accessibilityRole="button"
              >
                <Text style={styles.modalConfirmText}>
                  {modal.mode === 'edit' ? 'Modifier' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScreenGuide
        screenId="journal"
        targets={[
          { ref: childSelectorRef, ...HELP_CONTENT.journal[0] },
          { ref: firstSectionRef, ...HELP_CONTENT.journal[1] },
        ]}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const COL_WIDTH = 86;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.heavy },
  tabs: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dateNavBtn: { padding: 8 },
  dateNavArrow: { fontSize: FontSize.display, fontWeight: FontWeight.semibold },
  dateNavCenter: { flex: 1, alignItems: 'center' },
  dateNavText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  dateNavSub: { fontSize: FontSize.caption, textTransform: 'capitalize', marginTop: 1 },
  todayBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  todayBtnText: { fontSize: FontSize.caption, fontWeight: FontWeight.bold },

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 90 },

  createContainer: { alignItems: 'center', paddingVertical: 48, gap: 16 },
  createEmoji: { fontSize: 64 },
  createTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, textAlign: 'center' },
  createSubtitle: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  createBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.bold },

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
  statsBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  statEmoji: { fontSize: FontSize.lg },
  statValue: { fontSize: FontSize.body, fontWeight: FontWeight.heavy },
  statLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.medium },

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
  tableSectionTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, padding: 12 },
  sectionEmojiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  sectionEmojiBtnIcon: { fontSize: FontSize.heading },
  sectionEmojiBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tableHeader: { width: COL_WIDTH, paddingHorizontal: 6, paddingVertical: 7, fontSize: FontSize.caption, fontWeight: FontWeight.bold },
  tableHeaderFlex: { flex: 1, paddingHorizontal: 6, paddingVertical: 7, fontSize: FontSize.caption, fontWeight: FontWeight.bold },
  tableCell: { width: COL_WIDTH, paddingHorizontal: 6, paddingVertical: 7, fontSize: FontSize.label },
  tableCellFlex: { flex: 1, paddingHorizontal: 6, paddingVertical: 7, fontSize: FontSize.label },
  editHintCell: { paddingHorizontal: 4, paddingVertical: 7, fontSize: FontSize.caption, opacity: 0.3 },

  obsRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, gap: 8,
  },
  obsNumber: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#8B5CF6', width: 24 },
  obsText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  editHint: { fontSize: FontSize.caption, opacity: 0.3 },

  emptySection: { padding: 16, alignItems: 'center' },
  emptySectionText: { fontSize: FontSize.label, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContent: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: FontSize.label, fontWeight: FontWeight.semibold },
  modalInput: {
    borderWidth: 1.5, borderRadius: 10,
    padding: 12, fontSize: FontSize.body,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalDelete: {
    padding: 14, borderRadius: 10, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', width: 48,
  },
  modalDeleteText: { fontSize: FontSize.heading },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  modalConfirm: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  modalConfirmText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: '#FFFFFF' },
});

const calStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: FontSize.titleLg, fontWeight: FontWeight.bold },
  monthBtn: { flex: 1, alignItems: 'center' },
  monthLabel: { fontSize: FontSize.body, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  weekdays: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  dayText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
