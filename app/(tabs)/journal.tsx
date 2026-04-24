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
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday as isTodayFn, isFuture } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { todayJournalPath, journalPathForDate, generateJournalTemplate, todayAdultJournalPath, adultJournalPathForDate, generateAdultJournalTemplate } from '../../lib/parser';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';
import { useThemeColors } from '../../contexts/ThemeContext';
import { parseJournalStats, calculerDuree } from '../../lib/journal-stats';
import { MarkdownText } from '../../components/ui/MarkdownText';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Layout } from '../../constants/spacing';
import { useTranslation } from 'react-i18next';

// ─── Types ───────────────────────────────────────────────────────────────────

type EntryType = 'Biberon' | 'Couche' | 'Sieste' | 'Observation' | 'Médicament' | 'SommeilAdulte' | 'SymptomeAdulte';

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

function getFieldConfigs(t: (key: string) => string): Record<EntryType, FieldConfig[]> {
  return {
    Biberon: [
      { key: 'heure', label: t('journal.fields.hour'), placeholder: t('journal.fields.hourPlaceholder') },
      { key: 'ml', label: t('journal.fields.quantityMl'), placeholder: t('journal.fields.quantityMlPlaceholder'), keyboard: 'numeric' },
      { key: 'notes', label: t('journal.fields.notes'), placeholder: t('journal.fields.notesPlaceholder') },
    ],
    Couche: [
      { key: 'heure', label: t('journal.fields.hour'), placeholder: t('journal.fields.hourPlaceholder') },
      { key: 'type', label: t('journal.fields.type'), placeholder: t('journal.fields.typePlaceholder') },
      { key: 'notes', label: t('journal.fields.notes'), placeholder: t('journal.fields.notesPlaceholder') },
    ],
    Sieste: [
      { key: 'debut', label: t('journal.fields.start'), placeholder: t('journal.fields.startPlaceholder') },
      { key: 'fin', label: t('journal.fields.end'), placeholder: t('journal.fields.endPlaceholder') },
      { key: 'duree', label: t('journal.fields.duration'), placeholder: t('journal.fields.durationPlaceholder') },
      { key: 'notes', label: t('journal.fields.notes'), placeholder: t('journal.fields.notesPlaceholder') },
    ],
    Observation: [
      { key: 'text', label: t('journal.fields.observation'), placeholder: t('journal.fields.observationPlaceholder') },
    ],
    'Médicament': [
      { key: 'heure', label: t('journal.fields.hour'), placeholder: t('journal.fields.hourPlaceholder') },
      { key: 'medicament', label: t('journal.fields.medication'), placeholder: t('journal.fields.medicationPlaceholder') },
      { key: 'dose', label: t('journal.fields.dose'), placeholder: t('journal.fields.dosePlaceholder') },
      { key: 'notes', label: t('journal.fields.notes'), placeholder: t('journal.fields.notesPlaceholder') },
    ],
    SommeilAdulte: [
      { key: 'coucher', label: 'Coucher', placeholder: 'ex: 22h30' },
      { key: 'lever', label: 'Lever', placeholder: 'ex: 7h00' },
      { key: 'qualite', label: 'Qualité (1-5)', placeholder: 'ex: 4', keyboard: 'numeric' as const },
      { key: 'notes', label: t('journal.fields.notes'), placeholder: t('journal.fields.notesPlaceholder') },
    ],
    SymptomeAdulte: [
      { key: 'text', label: 'Symptôme', placeholder: 'Décrire le symptôme...' },
    ],
  };
}

function getEntryMeta(t: (key: string) => string): Record<EntryType, { emoji: string; label: string }> {
  return {
    Biberon: { emoji: '🍼', label: t('journal.entryTypes.bottle') },
    Couche: { emoji: '🚼', label: t('journal.entryTypes.diaper') },
    Sieste: { emoji: '😴', label: t('journal.entryTypes.nap') },
    Observation: { emoji: '💬', label: t('journal.entryTypes.note') },
    'Médicament': { emoji: '💊', label: t('journal.entryTypes.medication') },
    SommeilAdulte: { emoji: '😴', label: 'Sommeil' },
    SymptomeAdulte: { emoji: '🤒', label: 'Symptôme' },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formate une saisie d'heure : "7" → "7h00", "18" → "18h00", "7h" → "7h00", "14:30" → "14h30", "7h30" → "7h30" */
function formatTime(raw: string | undefined): string {
  if (!raw) return '';
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
    case 'SommeilAdulte':
      return [
        `> **Coucher**: ${fields.coucher?.trim() || ''}`,
        `> **Lever**: ${fields.lever?.trim() || ''}`,
        `> **Qualité** (1-5): ${fields.qualite?.trim() || ''}`,
        `> **Notes**: ${fields.notes?.trim() || ''}`,
      ].join('\n');
    case 'SymptomeAdulte':
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
    case 'Médicament': return 'Médicaments';
    case 'SommeilAdulte': return 'Suivi Sommeil';
    case 'SymptomeAdulte': return 'Symptômes';
    default: return '';
  }
}

function parseRowToFields(type: EntryType, row: string): Record<string, string> {
  const cells = row.split('|').slice(1, -1).map((c) => c.trim());

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
    case 'SommeilAdulte': {
      const coucher = row.match(/\*\*Coucher\*\*:\s*(.*)/)?.[1]?.trim() || '';
      const lever = row.match(/\*\*Lever\*\*:\s*(.*)/)?.[1]?.trim() || '';
      const qualite = row.match(/\*\*Qualité\*\*\s*\(1-5\):\s*(.*)/)?.[1]?.trim() || '';
      const notes = row.match(/\*\*Notes\*\*:\s*(.*)/)?.[1]?.trim() || '';
      return { coucher, lever, qualite, notes };
    }
    case 'SymptomeAdulte':
      return { text: row.replace(/^\d+\.\s*/, '').trim() };
    default:
      return {};
  }
}

function typeFromHeading(heading: string): EntryType | null {
  const h = heading.toLowerCase();
  if (h.includes('alimentation')) return 'Biberon';
  if (h.includes('couche')) return 'Couche';
  // Sections adultes grossesse — vérifier avant le mapping générique sommeil
  if (h.includes('suivi sommeil')) return 'SommeilAdulte';
  if (h.includes('symptôme') || h.includes('symptome')) return 'SymptomeAdulte';
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
  const { t } = useTranslation();
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

  const monthLabel = format(viewMonth, 'MMMM yyyy', { locale: getDateLocale() });

  return (
    <View style={[calStyles.container, { backgroundColor: colors.card, borderBottomColor: colors.overlayLight }]}>
      <View style={calStyles.nav}>
        <TouchableOpacity onPress={() => setViewMonth(subMonths(viewMonth, 1))} style={calStyles.navBtn} accessibilityLabel={t('journal.a11y.prevMonth')} accessibilityRole="button">
          <Text style={[calStyles.navArrow, { color: colors.textMuted }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewMonth(startOfMonth(new Date()))} style={calStyles.monthBtn} accessibilityLabel={t('journal.a11y.monthAction', { month: monthLabel })} accessibilityRole="button">
          <Text style={[calStyles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewMonth(addMonths(viewMonth, 1))} style={calStyles.navBtn} accessibilityLabel={t('journal.a11y.nextMonth')} accessibilityRole="button">
          <Text style={[calStyles.navArrow, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={calStyles.weekdays}>
        {[t('journal.weekdays.mon'), t('journal.weekdays.tue'), t('journal.weekdays.wed'), t('journal.weekdays.thu'), t('journal.weekdays.fri'), t('journal.weekdays.sat'), t('journal.weekdays.sun')].map((d, i) => (
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
          const isFutureDay = isFuture(day) && !isToday;
          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                calStyles.dayCell,
                isSelected && { backgroundColor: primary },
                !isSelected && isToday && { backgroundColor: tint },
              ]}
              onPress={() => !isFutureDay && onSelectDate(day)}
              disabled={isFutureDay}
              activeOpacity={0.6}
              accessibilityLabel={`${day.getDate()} ${format(day, 'MMMM', { locale: getDateLocale() })}${hasJournal ? t('journal.a11y.journalAvailable') : ''}${isToday ? t('journal.a11y.today') : ''}${isSelected ? t('journal.a11y.selected') : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: isFutureDay }}
            >
              <Text
                style={[
                  calStyles.dayText,
                  { color: isFutureDay ? colors.textFaint : hasJournal ? colors.text : colors.textMuted },
                  isSelected && { color: colors.onPrimary, fontWeight: FontWeight.heavy },
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
  const { t } = useTranslation();
  const { vault, profiles, activeProfile } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const { enfant: enfantParam } = useLocalSearchParams<{ enfant?: string }>();

  const FIELD_CONFIGS = useMemo(() => getFieldConfigs(t), [t]);
  const ENTRY_META = useMemo(() => getEntryMeta(t), [t]);

  const childSelectorRef = useRef<View>(null);
  const firstSectionRef = useRef<View>(null);
  const loadVersionRef = useRef(0);

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
  const selectedDateDisplay = format(selectedDate, 'EEEE dd MMMM yyyy', { locale: getDateLocale() });

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

  // Reset immédiat quand on change d'onglet ou de date (évite de voir l'ancien contenu)
  useEffect(() => {
    loadVersionRef.current += 1;
    setJournalContent(null);
    setJournalExists(false);
  }, [journalPath]);

  const loadJournal = useCallback(async () => {
    if (!vault || !journalPath) {
      setJournalContent(null);
      setJournalExists(false);
      return;
    }
    const version = loadVersionRef.current;
    try {
      const exists = await vault.exists(journalPath);
      if (loadVersionRef.current !== version) return;
      setJournalExists(exists);
      if (exists) {
        const content = await vault.readFile(journalPath);
        if (loadVersionRef.current !== version) return;
        setJournalContent(content);
      } else {
        setJournalContent(null);
      }
    } catch {
      if (loadVersionRef.current !== version) return;
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
        ? generateAdultJournalTemplate(activeProfile.name, { grossesse: activeProfile.statut === 'grossesse' })
        : generateJournalTemplate(selectedEnfantName, { propre: selectedEnfant?.propre });
      await vault.writeFile(journalPath, template);
      setJournalContent(template);
      setJournalExists(true);
      // Ajouter la date aux dates disponibles
      setAvailableDates((prev) => new Set([...prev, selectedDateStr]));
    } catch (e) {
      if (__DEV__) console.warn(e);
      Alert.alert(t('journal.alert.error'), t('common.errors.generic'));
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
          Alert.alert(t('journal.alert.oops'), t('journal.alert.addEntryError'));
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
      if (__DEV__) console.warn(e);
      Alert.alert(t('journal.alert.error'), t('common.errors.generic'));
    }
  };

  const deleteEntry = async () => {
    if (!vault || modal.lineIndex === undefined) return;
    closeModal();

    Alert.alert(
      t('journal.alert.deleteTitle'),
      t('journal.alert.deleteMsg'),
      [
        { text: t('journal.alert.cancel'), style: 'cancel' },
        {
          text: t('journal.alert.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const content = await vault.readFile(journalPath);
              const lines = content.split('\n');
              lines.splice(modal.lineIndex!, 1);
              await vault.writeFile(journalPath, lines.join('\n'));
              setJournalContent(lines.join('\n'));
            } catch (e) {
              if (__DEV__) console.warn(e);
              Alert.alert(t('journal.alert.error'), t('common.errors.generic'));
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
                  <Text style={[styles.obsNumber, { color: primary }]}>{oi + 1}.</Text>
                  <MarkdownText style={{ color: colors.textSub, flex: 1 }}>{obs.text}</MarkdownText>
                  {canEdit && <Text style={styles.editHint}>✏️</Text>}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textFaint }]}>{t('journal.sections.noObservation')}</Text>
              </View>
            )}
            {canEdit && (
              <TouchableOpacity
                style={[styles.sectionEmojiBtn, { borderTopColor: colors.borderLight }]}
                onPress={() => openAddModal('Observation')}
                accessibilityLabel={t('journal.a11y.addObservation')}
                accessibilityRole="button"
              >
                <Text style={styles.sectionEmojiBtnIcon}>{ENTRY_META.Observation.emoji}</Text>
                <Text style={[styles.sectionEmojiBtnText, { color: primary }]}>{t('journal.sections.add')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      if (entryType === 'SommeilAdulte') {
        const fields: { label: string; value: string }[] = [];
        for (const line of sectionLines) {
          const bqMatch = line.match(/^>\s*\*\*(.+?)\*\*(?:\s*\([^)]*\))?:\s*(.*)/);
          if (bqMatch) {
            fields.push({ label: bqMatch[1].trim(), value: bqMatch[2].trim() });
          }
        }
        return (
          <View key={si} style={[styles.tableSection, { backgroundColor: colors.card }]}>
            <View style={[styles.sectionHeader, { backgroundColor: colors.cardAlt, borderBottomColor: colors.border }]}>
              <Text style={[styles.tableSectionTitle, { color: colors.text }]}>{sec.heading}</Text>
            </View>
            {fields.length > 0 ? fields.map((f, fi) => (
              <View key={fi} style={[styles.obsRow, { borderBottomColor: colors.borderLight }, fi % 2 === 1 && { backgroundColor: colors.cardAlt }]}>
                <Text style={[styles.obsNumber, { color: primary, width: 'auto' as any, minWidth: 70 }]}>{f.label}:</Text>
                <Text style={{ color: colors.textSub, flex: 1 }}>{f.value || '—'}</Text>
              </View>
            )) : (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textFaint }]}>{t('journal.empty.sleep')}</Text>
              </View>
            )}
          </View>
        );
      }

      if (entryType === 'SymptomeAdulte') {
        const symptomes: { text: string; lineIdx: number }[] = [];
        for (let i = 0; i < sectionLines.length; i++) {
          const line = sectionLines[i];
          const numMatch = line.match(/^(\d+)\.\s*(.*)/);
          if (numMatch && numMatch[2].trim()) {
            symptomes.push({ text: numMatch[2].trim(), lineIdx: sec.startIdx + 1 + i });
          }
        }
        return (
          <View key={si} style={[styles.tableSection, { backgroundColor: colors.card }]}>
            <View style={[styles.sectionHeader, { backgroundColor: colors.cardAlt, borderBottomColor: colors.border }]}>
              <Text style={[styles.tableSectionTitle, { color: colors.text }]}>{sec.heading}</Text>
            </View>
            {symptomes.length > 0 ? symptomes.map((s, si2) => (
              <TouchableOpacity
                key={si2}
                style={[styles.obsRow, { borderBottomColor: colors.borderLight }, si2 % 2 === 1 && { backgroundColor: colors.cardAlt }]}
                onPress={() => canEdit && openEditModal('SymptomeAdulte', s.lineIdx, allLines[s.lineIdx])}
                activeOpacity={canEdit ? 0.6 : 1}
                disabled={!canEdit}
              >
                <Text style={[styles.obsNumber, { color: primary }]}>{si2 + 1}.</Text>
                <MarkdownText style={{ color: colors.textSub, flex: 1 }}>{s.text}</MarkdownText>
                {canEdit && <Text style={styles.editHint}>✏️</Text>}
              </TouchableOpacity>
            )) : (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textFaint }]}>{t('journal.empty.symptoms')}</Text>
              </View>
            )}
            {canEdit && (
              <TouchableOpacity
                style={[styles.sectionEmojiBtn, { borderTopColor: colors.borderLight }]}
                onPress={() => openAddModal('SymptomeAdulte')}
                accessibilityRole="button"
              >
                <Text style={styles.sectionEmojiBtnIcon}>{ENTRY_META.SymptomeAdulte.emoji}</Text>
                <Text style={[styles.sectionEmojiBtnText, { color: primary }]}>{t('journal.sections.add')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      const tableLines = sectionLines.filter((l) => l.trim().startsWith('|'));
      if (tableLines.length === 0) return null;

      const [header, _separator, ...rows] = tableLines;
      const SHORT_HEADERS: Record<string, string> = { 'Médicament': 'Médic.' };
      const cols = header.split('|').slice(1, -1).map((c) => {
        const colName = c.trim();
        return SHORT_HEADERS[colName] ?? colName;
      });

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
          const cells = row.split('|').slice(1, -1).map((c) => c.trim());
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
                  <Text key={ci} style={[ci === row.cells.length - 1 ? styles.tableCellFlex : styles.tableCell, { color: colors.textSub }]} numberOfLines={ci === row.cells.length - 1 ? undefined : 2}>{cell}</Text>
                ))}
                {canEdit && <Text style={styles.editHintCell}>✏️</Text>}
              </TouchableOpacity>
            ))}
            {dataRows.length === 0 && (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textFaint }]}>{t('journal.sections.noEntry')}</Text>
              </View>
            )}
          </View>
          {canEdit && (
            <TouchableOpacity
              style={[styles.sectionEmojiBtn, { borderTopColor: colors.borderLight }]}
              onPress={() => openAddModal(entryType)}
              accessibilityLabel={t('journal.a11y.addInSection', { section: sec.heading })}
              accessibilityRole="button"
            >
              <Text style={styles.sectionEmojiBtnIcon}>{ENTRY_META[entryType].emoji}</Text>
              <Text style={[styles.sectionEmojiBtnText, { color: primary }]}>{t('journal.sections.add')}</Text>
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
        <Text style={[styles.title, { color: colors.text }]}>📖 {t('journal.title')}</Text>
      </View>

      {/* Onglets enfant / adulte */}
      <View ref={childSelectorRef} style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SegmentedControl
          segments={[
            ...(isAdultMode ? [{ id: 'adulte', label: `${activeProfile?.avatar ?? '📖'} ${t('journal.myJournal')}` }] : []),
            ...enfants.map((e) => ({ id: e.id, label: `${e.avatar} ${e.name}` })),
          ]}
          value={selectedTab}
          onChange={setSelectedTab}
        />
      </View>

      {/* Navigation date */}
      <View style={[styles.dateNav, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={navigatePrev} disabled={!hasPrev} style={styles.dateNavBtn} accessibilityLabel={t('journal.a11y.prevDay')} accessibilityRole="button" accessibilityState={{ disabled: !hasPrev }}>
          <Text style={[styles.dateNavArrow, { color: hasPrev ? colors.text : colors.textFaint }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)} style={styles.dateNavCenter} accessibilityLabel={t('journal.a11y.dateAction', { date: selectedDateDisplay })} accessibilityRole="button">
          <Text style={[styles.dateNavText, { color: colors.text }]}>
            {isToday ? t('journal.nav.today') : format(selectedDate, 'dd/MM/yyyy')}
          </Text>
          <Text style={[styles.dateNavSub, { color: colors.textMuted }]}>
            {isToday ? format(selectedDate, 'dd MMMM', { locale: getDateLocale() }) : format(selectedDate, 'EEEE', { locale: getDateLocale() })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={navigateNext} disabled={!hasNext} style={styles.dateNavBtn} accessibilityLabel={t('journal.a11y.nextDay')} accessibilityRole="button" accessibilityState={{ disabled: !hasNext }}>
          <Text style={[styles.dateNavArrow, { color: hasNext ? colors.text : colors.textFaint }]}>›</Text>
        </TouchableOpacity>
        {!isToday && (
          <TouchableOpacity onPress={() => setSelectedDate(new Date())} style={[styles.todayBtn, { backgroundColor: tint }]} accessibilityLabel={t('journal.a11y.backToToday')} accessibilityRole="button">
            <Text style={[styles.todayBtnText, { color: primary }]}>{t('journal.nav.today')}</Text>
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

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, Layout.contentContainer]}>
        {!journalExists ? (
          <View style={styles.createContainer}>
            <Text style={styles.createEmoji}>{isViewingAdultTab ? (activeProfile?.avatar ?? '📖') : (selectedEnfant?.avatar ?? '👶')}</Text>
            <Text style={[styles.createTitle, { color: colors.textSub }]}>
              {isViewingAdultTab
                ? t('journal.create.noJournalAdult', { name: activeProfile?.name })
                : isToday
                  ? t('journal.create.noJournalChild', { name: selectedEnfantName })
                  : t('journal.create.noJournalDate', { date: format(selectedDate, 'dd/MM/yyyy') })}
            </Text>
            {canEdit && (
              <>
                <Text style={[styles.createSubtitle, { color: colors.textMuted }]}>
                  {isViewingAdultTab
                    ? t('journal.create.adultSubtitle')
                    : t('journal.create.childSubtitle', { date: format(selectedDate, 'dd/MM/yyyy') })}
                </Text>
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: primary }, isCreating && styles.createBtnDisabled]}
                  onPress={createJournal}
                  disabled={isCreating}
                  accessibilityLabel={t('journal.a11y.createJournal')}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isCreating }}
                >
                  <Text style={[styles.createBtnText, { color: colors.onPrimary }]}>
                    {isCreating ? t('journal.create.creating') : t('journal.create.createBtn')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : journalContent ? (
          <View ref={firstSectionRef} style={styles.journalContent}>
            {!isViewingAdultTab && hasStats && journalStats && (
              <View style={[styles.statsBanner, { backgroundColor: colors.card, borderColor: primary }]}>
                <Text style={[styles.statsBannerTitle, { color: colors.text }]}>{t('journal.stats.title')}</Text>
                <View style={styles.statsGrid}>
                  {journalStats.biberons > 0 && (
                    <View style={[styles.statItem, { backgroundColor: colors.cardAlt }]}>
                      <Text style={styles.statEmoji}>🍼</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{journalStats.biberons}</Text>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                        {t('journal.stats.bottle', { count: journalStats.biberons })}
                        {journalStats.totalMl > 0 ? ` (${journalStats.totalMl} ml)` : ''}
                      </Text>
                    </View>
                  )}
                  {journalStats.tetees > 0 && (
                    <View style={[styles.statItem, { backgroundColor: colors.cardAlt }]}>
                      <Text style={styles.statEmoji}>🤱</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{journalStats.tetees}</Text>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('journal.stats.breastfeed', { count: journalStats.tetees })}</Text>
                    </View>
                  )}
                  {journalStats.couches > 0 && (
                    <View style={[styles.statItem, { backgroundColor: colors.cardAlt }]}>
                      <Text style={styles.statEmoji}>🚼</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{journalStats.couches}</Text>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('journal.stats.diaper', { count: journalStats.couches })}</Text>
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
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {meta.emoji}{' '}
              {modal.mode === 'edit' ? t('journal.modal.editPrefix', { label: meta.label }) : t('journal.modal.addPrefix', { label: meta.label })}
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
                <TouchableOpacity style={[styles.modalDelete, { backgroundColor: colors.errorBg }]} onPress={deleteEntry} accessibilityLabel={t('journal.a11y.deleteEntry')} accessibilityRole="button">
                  <Text style={styles.modalDeleteText}>🗑</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={closeModal} accessibilityLabel={t('journal.a11y.cancelAction')} accessibilityRole="button">
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>{t('journal.modal.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: primary }]}
                onPress={confirmModal}
                accessibilityLabel={modal.mode === 'edit' ? t('journal.a11y.editAction') : t('journal.a11y.addAction')}
                accessibilityRole="button"
              >
                <Text style={[styles.modalConfirmText, { color: colors.onPrimary }]}>
                  {modal.mode === 'edit' ? t('journal.modal.edit') : t('journal.modal.add')}
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
  createBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  journalContent: { gap: 16 },

  statsBanner: {
    borderRadius: 12,
    padding: 14,
    ...Shadows.xs,
    borderWidth: StyleSheet.hairlineWidth,
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
    ...Shadows.xs,
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
    flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, gap: 8,
  },
  obsNumber: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, width: 24 },
  editHint: { fontSize: FontSize.caption, opacity: 0.3 },

  emptySection: { padding: 16, alignItems: 'center' },
  emptySectionText: { fontSize: FontSize.label, fontStyle: 'italic' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
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
    padding: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', width: 48,
  },
  modalDeleteText: { fontSize: FontSize.heading },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  modalConfirm: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  modalConfirmText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
});

const calStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
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
