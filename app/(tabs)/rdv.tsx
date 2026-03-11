/**
 * rdv.tsx — Dedicated RDV (appointments) screen
 *
 * Shows upcoming and past appointments with full details.
 * Reuses the existing RDVEditor component for create/edit.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/EmptyState';
import { RDVEditor } from '../../components/RDVEditor';
import { formatDateForDisplay, isRdvUpcoming } from '../../lib/parser';
import { RDV } from '../../lib/types';
import { useParentalControls } from '../../contexts/ParentalControlsContext';
import { ScreenGuide } from '../../components/help/ScreenGuide';
import { HELP_CONTENT } from '../../lib/help-content';

const CAL_PADDING = 16;
const DAY_GAP = 4;
const CELL_SIZE = Math.floor((Dimensions.get('window').width - CAL_PADDING * 2 - DAY_GAP * 6) / 7);
const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type ViewMode = 'liste' | 'calendrier';

const TYPE_EMOJI: Record<string, string> = {
  pédiatre: '👨‍⚕️',
  vaccin: '💉',
  pmi: '🏥',
  dentiste: '🦷',
  urgences: '🚑',
  autre: '📋',
};

export default function RDVScreen() {
  const { rdvs, addRDV, updateRDV, deleteRDV, activeProfile } = useVault();
  const { primary, tint, colors } = useThemeColors();
  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';
  const { isAllowed } = useParentalControls();

  const { addNew } = useLocalSearchParams<{ addNew?: string }>();
  const [search, setSearch] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);

  // FAB: ouvrir l'éditeur si addNew=1
  useEffect(() => {
    if (addNew === '1') { setEditingRDV(undefined); setEditorVisible(true); }
  }, [addNew]);
  const [editingRDV, setEditingRDV] = useState<RDV | undefined>(undefined);
  const [showPast, setShowPast] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('liste');
  const rdvListRef = useRef<View>(null);
  const searchRef = useRef<View>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [calDayRdvs, setCalDayRdvs] = useState<{ date: string; rdvs: RDV[] } | null>(null);

  // Filtrer par profil enfant : un enfant ne voit que ses propres RDV (sauf si autorisé)
  const profileRdvs = useMemo(() => {
    if (!isChildMode || !activeProfile || isAllowed('rdv', activeProfile.role)) return rdvs;
    const nameLower = activeProfile.name.toLowerCase();
    return rdvs.filter((r) => r.enfant.toLowerCase() === nameLower);
  }, [rdvs, isChildMode, activeProfile, isAllowed]);

  // Filter by search
  const filteredRdvs = useMemo(() => {
    if (!search.trim()) return profileRdvs;
    const q = search.toLowerCase();
    return profileRdvs.filter(
      (r) =>
        r.enfant.toLowerCase().includes(q) ||
        r.type_rdv.toLowerCase().includes(q) ||
        (r.médecin ?? '').toLowerCase().includes(q) ||
        (r.lieu ?? '').toLowerCase().includes(q)
    );
  }, [profileRdvs, search]);

  const upcoming = useMemo(
    () => filteredRdvs.filter((r) => isRdvUpcoming(r)),
    [filteredRdvs]
  );

  const past = useMemo(
    () => filteredRdvs.filter((r) => !isRdvUpcoming(r))
      .sort((a, b) => b.date_rdv.localeCompare(a.date_rdv)), // most recent first
    [filteredRdvs]
  );

  const calendarDays = useMemo(() => {
    const start = startOfMonth(calMonth);
    const end = endOfMonth(calMonth);
    const days = eachDayOfInterval({ start, end });
    let startDow = getDay(start) - 1;
    if (startDow < 0) startDow = 6;
    return { padding: Array(startDow).fill(null), days };
  }, [calMonth]);

  const rdvByDate = useMemo(() => {
    const map: Record<string, RDV[]> = {};
    for (const r of rdvs) {
      if (!map[r.date_rdv]) map[r.date_rdv] = [];
      map[r.date_rdv].push(r);
    }
    return map;
  }, [rdvs]);

  const openCreate = () => {
    setEditingRDV(undefined);
    setEditorVisible(true);
  };

  const openEdit = (rdv: RDV) => {
    setEditingRDV(rdv);
    setEditorVisible(true);
  };

  const handleUpdateStatut = useCallback(
    async (rdv: RDV, statut: RDV['statut']) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateRDV(rdv.sourceFile, {
        date_rdv: rdv.date_rdv,
        heure: rdv.heure,
        type_rdv: rdv.type_rdv,
        enfant: rdv.enfant,
        médecin: rdv.médecin,
        lieu: rdv.lieu,
        statut,
        questions: rdv.questions,
        reponses: rdv.reponses,
      });
    },
    [updateRDV]
  );

  /** Actions disponibles selon le statut actuel */
  const getStatutActions = (rdv: RDV): { label: string; emoji: string; statut: RDV['statut']; color: string }[] => {
    switch (rdv.statut) {
      case 'planifié':
        return [
          { label: 'Fait', emoji: '✅', statut: 'fait', color: colors.success },
          { label: 'Annulé', emoji: '❌', statut: 'annulé', color: colors.error },
        ];
      case 'fait':
        return [
          { label: 'Planifié', emoji: '📅', statut: 'planifié', color: colors.info },
          { label: 'Annulé', emoji: '❌', statut: 'annulé', color: colors.error },
        ];
      case 'annulé':
        return [
          { label: 'Planifié', emoji: '📅', statut: 'planifié', color: colors.info },
          { label: 'Fait', emoji: '✅', statut: 'fait', color: colors.success },
        ];
    }
  };

  const renderRDV = (rdv: RDV, isPast: boolean) => {
    const emoji = TYPE_EMOJI[rdv.type_rdv] ?? '📋';
    const hasQuestions = rdv.questions && rdv.questions.length > 0;
    const hasReponses = !!rdv.reponses?.trim();
    const actions = getStatutActions(rdv);

    const renderRightActions = (
      _progress: any,
      _drag: any,
      swipeable: { close: () => void }
    ) => (
      <View style={styles.swipeActions}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.statut}
            style={[styles.swipeAction, { backgroundColor: action.color }]}
            onPress={() => {
              swipeable.close();
              handleUpdateStatut(rdv, action.statut);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.swipeActionEmoji}>{action.emoji}</Text>
            <Text style={[styles.swipeActionLabel, { color: colors.onPrimary }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );

    return (
      <ReanimatedSwipeable
        key={rdv.sourceFile}
        renderRightActions={renderRightActions}
        rightThreshold={60}
        friction={2}
        overshootRight={false}
      >
      <TouchableOpacity
        style={[styles.rdvCard, { backgroundColor: colors.card }, isPast && styles.rdvCardPast]}
        onPress={() => openEdit(rdv)}
        activeOpacity={0.7}
      >
        <View style={[styles.rdvBorder, { backgroundColor: isPast ? colors.separator : primary }]} />
        <View style={styles.rdvContent}>
          <View style={styles.rdvTopRow}>
            <Text style={[styles.rdvDate, { color: colors.text }, isPast && { color: colors.textMuted }]}>
              {formatDateForDisplay(rdv.date_rdv)}
              {rdv.heure ? ` à ${rdv.heure}` : ''}
            </Text>
            {isPast && rdv.statut !== 'planifié' && (
              <View style={[styles.badge, { backgroundColor: rdv.statut === 'fait' ? colors.successBg : colors.errorBg }]}>
                <Text style={[styles.badgeText, { color: colors.textSub }]}>
                  {rdv.statut === 'fait' ? 'Fait' : 'Annulé'}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.rdvType, { color: colors.textSub }, isPast && { color: colors.textMuted }]}>
            {emoji} {rdv.type_rdv} — {rdv.enfant}
          </Text>
          {rdv.médecin ? (
            <Text style={[styles.rdvDetail, { color: colors.textMuted }, isPast && { color: colors.textFaint }]}>
              👨‍⚕️ {rdv.médecin}
            </Text>
          ) : null}
          {rdv.lieu ? (
            <Text style={[styles.rdvDetail, { color: colors.textMuted }, isPast && { color: colors.textFaint }]}>
              📍 {rdv.lieu}
            </Text>
          ) : null}

          {/* Questions à poser */}
          {hasQuestions && (
            <View style={[styles.questionsBlock, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.questionsTitle, { color: colors.textMuted }]}>❓ Questions à poser</Text>
              {rdv.questions!.map((q, i) => (
                <Text key={i} style={[styles.questionItem, { color: colors.textSub }]} numberOfLines={2}>
                  • {q}
                </Text>
              ))}
            </View>
          )}

          {/* Réponses du médecin */}
          {hasReponses && (
            <View style={[styles.reponsesBlock, { borderTopColor: colors.borderLight, backgroundColor: colors.successBg }]}>
              <Text style={[styles.reponsesTitle, { color: colors.successText }]}>💬 Réponses du médecin</Text>
              <Text style={[styles.reponsesText, { color: colors.textSub }]} numberOfLines={4}>
                {rdv.reponses}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      </ReanimatedSwipeable>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>📅 Rendez-vous</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: tint, borderColor: primary }]}
          onPress={openCreate}
        >
          <Text style={[styles.addBtnText, { color: primary }]}>+ Nouveau</Text>
        </TouchableOpacity>
      </View>

      {/* View mode tabs */}
      <View style={[styles.modeTabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['liste', 'calendrier'] as ViewMode[]).map((mode) => (
          <Chip
            key={mode}
            label={mode === 'liste' ? 'Liste' : 'Calendrier'}
            emoji={mode === 'liste' ? '📋' : '🗓'}
            selected={viewMode === mode}
            onPress={() => setViewMode(mode)}
          />
        ))}
      </View>

      {/* Search */}
      <View ref={searchRef} style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="🔍 Rechercher un rendez-vous..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {viewMode === 'calendrier' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: 60 }]}>
          <View style={styles.monthNav}>
            <TouchableOpacity style={[styles.monthArrow, { backgroundColor: colors.card }]} onPress={() => setCalMonth((m) => subMonths(m, 1))}>
              <Text style={[styles.monthArrowText, { color: primary }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: colors.text }]}>
              {(() => { const s = format(calMonth, 'MMMM yyyy', { locale: fr }); return s.charAt(0).toUpperCase() + s.slice(1); })()}
            </Text>
            <TouchableOpacity style={[styles.monthArrow, { backgroundColor: colors.card }]} onPress={() => setCalMonth((m) => addMonths(m, 1))}>
              <Text style={[styles.monthArrowText, { color: primary }]}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((l, i) => (
              <View key={i} style={styles.weekdayCell}><Text style={[styles.weekdayText, { color: colors.textFaint }]}>{l}</Text></View>
            ))}
          </View>
          <View style={styles.calGrid}>
            {calendarDays.padding.map((_, i) => <View key={`p${i}`} style={styles.calCell} />)}
            {calendarDays.days.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayRdvs = rdvByDate[dateStr] ?? [];
              const today = isToday(date);
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.calCell, { backgroundColor: colors.card }, today && { borderWidth: 2, borderColor: primary }]}
                  onPress={() => dayRdvs.length > 0 && setCalDayRdvs({ date: dateStr, rdvs: dayRdvs })}
                  activeOpacity={dayRdvs.length > 0 ? 0.7 : 1}
                >
                  <Text style={[styles.calDayNum, { color: today ? primary : colors.textSub }, today && { fontWeight: '800' }]}>{date.getDate()}</Text>
                  {dayRdvs.length > 0 && (
                    <View style={styles.calDots}>
                      {dayRdvs.slice(0, 3).map((r, i) => (
                        <View key={i} style={[styles.calDot, { backgroundColor: r.statut === 'fait' ? colors.success : r.statut === 'annulé' ? colors.error : primary }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Upcoming */}
        <View ref={rdvListRef}>
        <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
          À venir ({upcoming.length})
        </Text>
        </View>
        {upcoming.length === 0 ? (
          <EmptyState emoji="📅" title="Aucun rendez-vous à venir" subtitle="Votre agenda est libre !" />
        ) : (
          upcoming.map((r) => renderRDV(r, false))
        )}

        {/* Past */}
        {past.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.togglePast}
              onPress={() => setShowPast(!showPast)}
            >
              <Text style={[styles.togglePastText, { color: colors.textMuted }]}>
                {showPast ? '🔼 Masquer les passés' : `🔽 Passés (${past.length})`}
              </Text>
            </TouchableOpacity>
            {showPast && past.map((r) => renderRDV(r, true))}
          </>
        )}
      </ScrollView>
      )}

      {/* Day RDVs Modal (calendar tap) */}
      <Modal visible={calDayRdvs !== null} transparent animationType="slide" onRequestClose={() => setCalDayRdvs(null)}>
        <TouchableOpacity style={[styles.dayModalOverlay, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={() => setCalDayRdvs(null)} />
        <View style={[styles.dayModalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.dayModalTitle, { color: colors.text }]}>
            {calDayRdvs ? formatDateForDisplay(calDayRdvs.date) : ''}
          </Text>
          {calDayRdvs?.rdvs.map((r) => (
            <TouchableOpacity key={r.sourceFile} style={[styles.dayModalRdv, { backgroundColor: colors.cardAlt }]}
              onPress={() => { setCalDayRdvs(null); openEdit(r); }}>
              <Text style={[styles.dayModalRdvText, { color: colors.text }]}>{TYPE_EMOJI[r.type_rdv] ?? '📋'} {r.type_rdv} — {r.enfant}</Text>
              {r.heure ? <Text style={[styles.dayModalRdvTime, { color: colors.textMuted }]}>🕐 {r.heure}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* RDV Editor Modal */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setEditorVisible(false);
          setEditingRDV(undefined);
        }}
      >
        <RDVEditor
          rdv={editingRDV}
          onSave={async (data) => {
            if (editingRDV) {
              await updateRDV(editingRDV.sourceFile, data);
            } else {
              await addRDV(data);
            }
          }}
          onDelete={
            editingRDV
              ? () => {
                  deleteRDV(editingRDV.sourceFile);
                  setEditorVisible(false);
                  setEditingRDV(undefined);
                }
              : undefined
          }
          onClose={() => {
            setEditorVisible(false);
            setEditingRDV(undefined);
          }}
        />
      </Modal>

      <ScreenGuide
        screenId="rdv"
        targets={[
          { ref: rdvListRef, ...HELP_CONTENT.rdv[0] },
          { ref: searchRef, ...HELP_CONTENT.rdv[1] },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: '800' },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  addBtnText: { fontSize: 14, fontWeight: '700' },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },
  rdvCard: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rdvCardPast: { opacity: 0.6 },
  rdvBorder: {
    width: 4,
  },
  rdvContent: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  rdvTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rdvDate: {
    fontSize: 14,
    fontWeight: '700',
  },
  rdvType: {
    fontSize: 15,
    fontWeight: '600',
  },
  rdvDetail: {
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  togglePast: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  togglePastText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    gap: 2,
  },
  swipeAction: {
    width: 76,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  swipeActionEmoji: {
    fontSize: 22,
  },
  swipeActionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  modeTabs: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1,
  },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthArrow: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  monthArrowText: { fontSize: 24, fontWeight: '300' },
  monthLabel: { fontSize: 18, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', gap: DAY_GAP, marginBottom: 8 },
  weekdayCell: { width: CELL_SIZE, alignItems: 'center' },
  weekdayText: { fontSize: 12, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DAY_GAP },
  calCell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  calDayNum: { fontSize: 13, fontWeight: '600' },
  calDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  calDot: { width: 5, height: 5, borderRadius: 3 },
  dayModalOverlay: { flex: 1 },
  dayModalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10, paddingBottom: 40 },
  dayModalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  dayModalRdv: { borderRadius: 12, padding: 14, gap: 4 },
  dayModalRdvText: { fontSize: 15, fontWeight: '600' },
  dayModalRdvTime: { fontSize: 13 },
  questionsBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 4,
  },
  questionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  questionItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  reponsesBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 4,
    borderRadius: 8,
    padding: 10,
    marginLeft: -4,
    marginRight: -4,
  },
  reponsesTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  reponsesText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
