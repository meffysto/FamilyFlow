/**
 * rdv.tsx — Dedicated RDV (appointments) screen
 *
 * Shows upcoming and past appointments with full details.
 * Reuses the existing RDVEditor component for create/edit.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useVault } from '../../hooks/useVault';
import { useThemeColors } from '../../contexts/ThemeContext';
import { RDVEditor } from '../../components/RDVEditor';
import { formatDateForDisplay, isRdvUpcoming } from '../../lib/parser';
import { RDV } from '../../lib/types';

const TYPE_EMOJI: Record<string, string> = {
  pédiatre: '👨‍⚕️',
  vaccin: '💉',
  pmi: '🏥',
  dentiste: '🦷',
  urgences: '🚑',
  autre: '📋',
};

export default function RDVScreen() {
  const { rdvs, addRDV, updateRDV, deleteRDV } = useVault();
  const { primary, tint, colors } = useThemeColors();

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | undefined>(undefined);
  const [showPast, setShowPast] = useState(false);

  const upcoming = useMemo(
    () => rdvs.filter((r) => isRdvUpcoming(r)),
    [rdvs]
  );

  const past = useMemo(
    () => rdvs.filter((r) => !isRdvUpcoming(r))
      .sort((a, b) => b.date_rdv.localeCompare(a.date_rdv)), // most recent first
    [rdvs]
  );

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
          { label: 'Fait', emoji: '✅', statut: 'fait', color: '#10B981' },
          { label: 'Annulé', emoji: '❌', statut: 'annulé', color: '#EF4444' },
        ];
      case 'fait':
        return [
          { label: 'Planifié', emoji: '📅', statut: 'planifié', color: '#8B5CF6' },
          { label: 'Annulé', emoji: '❌', statut: 'annulé', color: '#EF4444' },
        ];
      case 'annulé':
        return [
          { label: 'Planifié', emoji: '📅', statut: 'planifié', color: '#8B5CF6' },
          { label: 'Fait', emoji: '✅', statut: 'fait', color: '#10B981' },
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
            <Text style={styles.swipeActionLabel}>{action.label}</Text>
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
              <View style={[styles.badge, rdv.statut === 'fait' ? styles.badgeDone : styles.badgeCancelled]}>
                <Text style={styles.badgeText}>
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
            <View style={styles.reponsesBlock}>
              <Text style={styles.reponsesTitle}>💬 Réponses du médecin</Text>
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Upcoming */}
        <Text style={[styles.sectionTitle, { color: colors.textSub }]}>
          À venir ({upcoming.length})
        </Text>
        {upcoming.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyText, { color: colors.textFaint }]}>Aucun rendez-vous à venir</Text>
          </View>
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
  badgeDone: { backgroundColor: '#D1FAE5' },
  badgeCancelled: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
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
    color: '#FFFFFF',
  },
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
    borderTopColor: '#F3F4F6',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 10,
    marginLeft: -4,
    marginRight: -4,
  },
  reponsesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  reponsesText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
