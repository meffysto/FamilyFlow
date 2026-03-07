/**
 * rdv.tsx — Dedicated RDV (appointments) screen
 *
 * Shows upcoming and past appointments with full details.
 * Reuses the existing RDVEditor component for create/edit.
 */

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const { primary, tint } = useThemeColors();

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | undefined>(undefined);
  const [showPast, setShowPast] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

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

  const renderRDV = (rdv: RDV, isPast: boolean) => {
    const emoji = TYPE_EMOJI[rdv.type_rdv] ?? '📋';
    return (
      <TouchableOpacity
        key={rdv.sourceFile}
        style={[styles.rdvCard, isPast && styles.rdvCardPast]}
        onPress={() => openEdit(rdv)}
        activeOpacity={0.7}
      >
        <View style={[styles.rdvBorder, { backgroundColor: isPast ? '#D1D5DB' : primary }]} />
        <View style={styles.rdvContent}>
          <View style={styles.rdvTopRow}>
            <Text style={[styles.rdvDate, isPast && styles.textPast]}>
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
          <Text style={[styles.rdvType, isPast && styles.textPast]}>
            {emoji} {rdv.type_rdv} — {rdv.enfant}
          </Text>
          {rdv.médecin ? (
            <Text style={[styles.rdvDetail, isPast && styles.textPast]}>
              👨‍⚕️ {rdv.médecin}
            </Text>
          ) : null}
          {rdv.lieu ? (
            <Text style={[styles.rdvDetail, isPast && styles.textPast]}>
              📍 {rdv.lieu}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Rendez-vous</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: tint, borderColor: primary }]}
          onPress={openCreate}
        >
          <Text style={[styles.addBtnText, { color: primary }]}>+ Nouveau</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Upcoming */}
        <Text style={styles.sectionTitle}>
          À venir ({upcoming.length})
        </Text>
        {upcoming.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Aucun rendez-vous à venir</Text>
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
              <Text style={styles.togglePastText}>
                {showPast ? '🔼 Masquer les passés' : `🔽 Passés (${past.length})`}
              </Text>
            </TouchableOpacity>
            {showPast && past.map((r) => renderRDV(r, true))}
          </>
        )}
      </ScrollView>

      {/* RDV Editor Modal */}
      <Modal visible={editorVisible} animationType="slide" presentationStyle="pageSheet">
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
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
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
    color: '#374151',
    marginTop: 4,
    marginBottom: 4,
  },
  rdvCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
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
    color: '#111827',
  },
  rdvType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  rdvDetail: {
    fontSize: 13,
    color: '#6B7280',
  },
  textPast: { color: '#9CA3AF' },
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
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
