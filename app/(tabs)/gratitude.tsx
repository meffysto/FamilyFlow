/**
 * gratitude.tsx — Écran Gratitude familiale
 *
 * 2 onglets : Aujourd'hui (écriture) + Livre d'or (historique)
 * Fichier vault : 06 - Mémoires/Gratitude familiale.md
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SectionList,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { format, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Shadows } from '../../constants/shadows';
import type { GratitudeEntry, GratitudeDay } from '../../lib/types';

type TabId = 'aujourdhui' | 'livre';

const LOAD_BATCH = 30;

/** Calcule le streak de jours consécutifs où tous les profils ont contribué */
export function computeGratitudeStreak(days: GratitudeDay[], totalProfiles: number): number {
  if (totalProfiles === 0) return 0;
  // Build a Set for O(1) date lookups
  const daysByDate = new Map<string, GratitudeDay>();
  for (const d of days) daysByDate.set(d.date, d);

  let count = 0;
  const checkDate = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    const day = daysByDate.get(dateStr);
    if (day && day.entries.length >= totalProfiles) {
      count++;
    } else {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return count;
}

export default function GratitudeScreen() {
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const { profiles, activeProfile, gratitudeDays, addGratitudeEntry, deleteGratitudeEntry } = useVault();

  const [activeTab, setActiveTab] = useState<TabId>('aujourdhui');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [writeModal, setWriteModal] = useState<{ visible: boolean; existing?: GratitudeEntry }>({ visible: false });
  const [writeText, setWriteText] = useState('');
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH);

  // Navigation entre jours
  const goToDay = (offset: number) => {
    const d = offset > 0
      ? addDays(new Date(selectedDate + 'T12:00:00'), offset)
      : subDays(new Date(selectedDate + 'T12:00:00'), Math.abs(offset));
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = selectedDate === todayStr;

  // Jour sélectionné
  const dayData = useMemo(() => {
    return gratitudeDays.find((d) => d.date === selectedDate);
  }, [gratitudeDays, selectedDate]);

  const streak = useMemo(
    () => computeGratitudeStreak(gratitudeDays, profiles.length),
    [gratitudeDays, profiles.length],
  );

  // Livre d'or : sections pour SectionList (gratitudeDays already sorted desc)
  const bookSections = useMemo(() => {
    return gratitudeDays.slice(0, visibleCount).map((day) => {
      const [yyyy, mm, dd] = day.date.split('-');
      return {
        title: `${dd}/${mm}/${yyyy}`,
        date: day.date,
        data: day.entries,
      };
    });
  }, [gratitudeDays, visibleCount]);

  const handleOpenWrite = useCallback((existing?: GratitudeEntry) => {
    setWriteText(existing?.text ?? '');
    setWriteModal({ visible: true, existing });
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeProfile || !writeText.trim()) return;
    await addGratitudeEntry(selectedDate, activeProfile.id, activeProfile.name, writeText.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Gratitude enregistrée 🙏');
    setWriteModal({ visible: false });
    setWriteText('');
  }, [activeProfile, selectedDate, writeText, addGratitudeEntry, showToast]);

  const dateDisplay = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (isToday) return "Aujourd'hui";
    return format(d, 'EEEE d MMMM yyyy', { locale: fr });
  }, [selectedDate, isToday]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'aujourdhui', label: "Aujourd'hui" },
    { id: 'livre', label: 'Livre d\'or' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Gratitude</Text>
        {streak > 0 && (
          <View style={[styles.streakBadge, { backgroundColor: colors.info + '20' }]}>
            <Text style={[styles.streakText, { color: colors.info }]}>{streak}j 🔥</Text>
          </View>
        )}
      </View>

      {/* Onglets */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { borderBottomColor: primary }]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? primary : colors.textMuted }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'aujourdhui' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Navigation date */}
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => goToDay(-1)} activeOpacity={0.7} style={styles.dateArrow}>
              <Text style={[styles.dateArrowText, { color: primary }]}>←</Text>
            </TouchableOpacity>
            <View style={styles.dateCenter}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>{dateDisplay}</Text>
              {!isToday && (
                <TouchableOpacity onPress={() => setSelectedDate(todayStr)} activeOpacity={0.7}>
                  <Text style={[styles.todayLink, { color: primary }]}>Aujourd'hui</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => goToDay(1)}
              activeOpacity={0.7}
              style={styles.dateArrow}
              disabled={selectedDate >= todayStr}
            >
              <Text style={[styles.dateArrowText, { color: selectedDate >= todayStr ? colors.textFaint : primary }]}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Liste profils */}
          {profiles.map((profile) => {
            const entry = dayData?.entries.find((e) => e.profileId === profile.id);
            const isActiveUser = activeProfile?.id === profile.id;

            return (
              <View key={profile.id} style={[styles.profileCard, { backgroundColor: colors.card }]}>
                <View style={styles.profileHeader}>
                  <Text style={styles.profileAvatar}>{profile.avatar}</Text>
                  <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                  {isActiveUser && !entry && (
                    <TouchableOpacity
                      style={[styles.writeBtn, { backgroundColor: primary }]}
                      onPress={() => handleOpenWrite()}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.writeBtnText, { color: colors.onPrimary }]}>Écrire</Text>
                    </TouchableOpacity>
                  )}
                  {isActiveUser && entry && (
                    <TouchableOpacity
                      style={[styles.editBtn, { borderColor: primary }]}
                      onPress={() => handleOpenWrite(entry)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.editBtnText, { color: primary }]}>Modifier</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {entry ? (
                  <Text style={[styles.entryText, { color: colors.textSub }]}>{entry.text}</Text>
                ) : (
                  <Text style={[styles.emptyText, { color: colors.textFaint }]}>Pas encore écrit</Text>
                )}
              </View>
            );
          })}

          {profiles.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Text style={styles.emptyEmoji}>🙏</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun profil</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                Configurez des profils familiaux pour commencer.
              </Text>
            </View>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      {activeTab === 'livre' && (
        <>
          {bookSections.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card, margin: Spacing['2xl'] }]}>
              <Text style={styles.emptyEmoji}>📖</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Livre d'or vide</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                Les gratitudes écrites apparaîtront ici.
              </Text>
            </View>
          ) : (
            <SectionList
              sections={bookSections}
              keyExtractor={(item, index) => `${item.date}-${item.profileId}-${index}`}
              contentContainerStyle={styles.content}
              renderSectionHeader={({ section }) => (
                <Text style={[styles.sectionDate, { color: colors.textMuted }]}>{section.title}</Text>
              )}
              renderItem={({ item }) => (
                <View style={[styles.bookEntry, { backgroundColor: colors.card }]}>
                  <View style={styles.bookEntryHeader}>
                    <Text style={styles.bookAvatar}>
                      {profiles.find((p) => p.id === item.profileId)?.avatar ?? '🙏'}
                    </Text>
                    <Text style={[styles.bookName, { color: colors.text }]}>{item.profileName}</Text>
                  </View>
                  <Text style={[styles.bookText, { color: colors.textSub }]}>{item.text}</Text>
                </View>
              )}
              renderSectionFooter={() => <View style={styles.sectionSep} />}
              ListFooterComponent={
                visibleCount < gratitudeDays.length ? (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, { borderColor: primary }]}
                    onPress={() => setVisibleCount((c) => c + LOAD_BATCH)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.loadMoreText, { color: primary }]}>Charger plus</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </>
      )}

      {/* Modal écriture */}
      <Modal
        visible={writeModal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWriteModal({ visible: false })}
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
          <ModalHeader
            title={writeModal.existing ? 'Modifier' : 'Écrire'}
            onClose={() => setWriteModal({ visible: false })}
            rightLabel="Enregistrer"
            onRight={handleSave}
          />
          <View style={styles.writeContent}>
            <Text style={[styles.writePrompt, { color: colors.textMuted }]}>
              Qu'est-ce qui vous rend reconnaissant(e) aujourd'hui ?
            </Text>
            <TextInput
              style={[styles.writeInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={writeText}
              onChangeText={setWriteText}
              placeholder="Une chose positive de la journée..."
              placeholderTextColor={colors.textFaint}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
  },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  streakBadge: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  streakText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], gap: Spacing.xl, paddingBottom: 40 },
  // Date navigation
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateArrow: {
    padding: Spacing.lg,
  },
  dateArrowText: { fontSize: FontSize.titleLg, fontWeight: FontWeight.bold },
  dateCenter: { alignItems: 'center', gap: Spacing.xs },
  dateLabel: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy },
  todayLink: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  // Profile cards
  profileCard: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    ...Shadows.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  profileAvatar: { fontSize: 28 },
  profileName: { fontSize: FontSize.body, fontWeight: FontWeight.bold, flex: 1 },
  writeBtn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  writeBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  editBtn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  editBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  entryText: { fontSize: FontSize.body, lineHeight: 22 },
  emptyText: { fontSize: FontSize.body, fontStyle: 'italic' },
  // Empty state
  emptyState: {
    padding: Spacing['3xl'],
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.heavy },
  emptyDesc: { fontSize: FontSize.body, textAlign: 'center' },
  // Book (Livre d'or)
  sectionDate: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  bookEntry: {
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    gap: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.xs,
  },
  bookEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  bookAvatar: { fontSize: 22 },
  bookName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  bookText: { fontSize: FontSize.body, lineHeight: 22 },
  sectionSep: { height: Spacing.md },
  loadMoreBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  loadMoreText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  bottomPad: { height: 40 },
  // Write modal
  writeContent: {
    flex: 1,
    padding: Spacing['2xl'],
    gap: Spacing.xl,
  },
  writePrompt: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  writeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing['2xl'],
    fontSize: FontSize.body,
    lineHeight: 24,
    minHeight: 120,
  },
});
