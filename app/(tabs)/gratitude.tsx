/**
 * gratitude.tsx — Écran Gratitude familiale
 *
 * 2 onglets : Aujourd'hui (écriture) + Livre d'or (historique)
 * Fichier vault : 06 - Mémoires/Gratitude familiale.md
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SectionList,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { format, addDays, subDays } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Shadows } from '../../constants/shadows';
import type { GratitudeEntry, GratitudeDay } from '../../lib/types';
import { isBabyProfile } from '../../lib/types';
import { MarkdownText } from '../../components/ui/MarkdownText';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { DictaphoneRecorder } from '../../components/DictaphoneRecorder';
import { EmptyState } from '../../components/EmptyState';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const { profiles, activeProfile, gratitudeDays, addGratitudeEntry, deleteGratitudeEntry, refresh } = useVault();

  const [activeTab, setActiveTab] = useState<TabId>('aujourdhui');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [writeModal, setWriteModal] = useState<{ visible: boolean; existing?: GratitudeEntry }>({ visible: false });
  const [writeText, setWriteText] = useState('');
  const [dictaphoneVisible, setDictaphoneVisible] = useState(false);
  const dictaphoneResultRef = useRef<string>('');
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH);
  const { refreshing, onRefresh } = useRefresh(refresh);

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

  // Exclure les profils grossesse + bébés < 2 ans (ne peuvent pas écrire de gratitude)
  const gratitudeProfiles = useMemo(
    () => profiles.filter((p) => p.statut !== 'grossesse' && !isBabyProfile(p)),
    [profiles],
  );

  const streak = useMemo(
    () => computeGratitudeStreak(gratitudeDays, gratitudeProfiles.length),
    [gratitudeDays, gratitudeProfiles.length],
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

  const handleDeleteEntry = useCallback(async (entry: GratitudeEntry) => {
    await deleteGratitudeEntry(entry.date, entry.profileId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t('gratitude.toast.deleted'));
  }, [deleteGratitudeEntry, showToast]);

  const handleOpenWrite = useCallback((existing?: GratitudeEntry) => {
    setWriteText(existing?.text ?? '');
    setWriteModal({ visible: true, existing });
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeProfile || !writeText.trim()) return;
    await addGratitudeEntry(selectedDate, activeProfile.id, activeProfile.name, writeText.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t('gratitude.toast.saved'));
    setWriteModal({ visible: false });
    setWriteText('');
  }, [activeProfile, selectedDate, writeText, addGratitudeEntry, showToast]);

  const dateDisplay = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (isToday) return t('gratitude.today');
    return format(d, 'EEEE d MMMM yyyy', { locale: getDateLocale() });
  }, [selectedDate, isToday]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'aujourdhui', label: t('gratitude.tabs.today') },
    { id: 'livre', label: t('gratitude.tabs.goldenBook') },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('gratitude.title')}</Text>
        {streak > 0 && (
          <View style={[styles.streakBadge, { backgroundColor: colors.info + '20' }]}>
            <Text style={[styles.streakText, { color: colors.info }]}>{t('gratitude.streak', { count: streak })}</Text>
          </View>
        )}
      </View>

      {/* Onglets */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SegmentedControl
          segments={tabs}
          value={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />
      </View>

      {activeTab === 'aujourdhui' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, Layout.contentContainer]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {/* Navigation date */}
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => goToDay(-1)} activeOpacity={0.7} style={styles.dateArrow}>
              <Text style={[styles.dateArrowText, { color: primary }]}>←</Text>
            </TouchableOpacity>
            <View style={styles.dateCenter}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>{dateDisplay}</Text>
              {!isToday && (
                <TouchableOpacity onPress={() => setSelectedDate(todayStr)} activeOpacity={0.7}>
                  <Text style={[styles.todayLink, { color: primary }]}>{t('gratitude.today')}</Text>
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

          {/* Liste profils (exclut grossesse + bébés < 2 ans) */}
          {gratitudeProfiles.map((profile) => {
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
                      <Text style={[styles.writeBtnText, { color: colors.onPrimary }]}>{t('gratitude.writeBtn')}</Text>
                    </TouchableOpacity>
                  )}
                  {isActiveUser && entry && (
                    <TouchableOpacity
                      style={[styles.editBtn, { borderColor: primary }]}
                      onPress={() => handleOpenWrite(entry)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.editBtnText, { color: primary }]}>{t('gratitude.editBtn')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {entry ? (
                  <Text style={[styles.entryText, { color: colors.textSub }]}>{entry.text}</Text>
                ) : (
                  <Text style={[styles.emptyText, { color: colors.textFaint }]}>{t('gratitude.notWritten')}</Text>
                )}
              </View>
            );
          })}

          {gratitudeProfiles.length === 0 && (
            <EmptyState
              emoji="🙏"
              title={t('gratitude.empty.title')}
              subtitle={t('gratitude.empty.subtitle')}
              ctaLabel={t('gratitude.empty.cta')}
              onCta={() => handleOpenWrite()}
            />
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      {activeTab === 'livre' && (
        <>
          {bookSections.length === 0 ? (
            <EmptyState
              emoji="🙏"
              title={t('gratitude.empty.title')}
              subtitle={t('gratitude.empty.subtitle')}
              ctaLabel={t('gratitude.empty.cta')}
              onCta={() => { setActiveTab('aujourdhui'); handleOpenWrite(); }}
            />
          ) : (
            <SectionList
              sections={bookSections}
              keyExtractor={(item, index) => `${item.date}-${item.profileId}-${index}`}
              contentContainerStyle={[styles.content, Layout.contentContainer]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
              renderSectionHeader={({ section }) => (
                <Text style={[styles.sectionDate, { color: colors.textMuted }]}>{section.title}</Text>
              )}
              renderItem={({ item }) => (
                <SwipeToDelete
                  onDelete={() => handleDeleteEntry(item)}
                  confirmTitle={t('gratitude.deleteTitle')}
                  confirmMessage={t('gratitude.deleteMessage', { name: item.profileName })}
                  hintId="gratitude"
                >
                  <View style={[styles.bookEntry, { backgroundColor: colors.card }]}>
                    <View style={styles.bookEntryHeader}>
                      <Text style={styles.bookAvatar}>
                        {profiles.find((p) => p.id === item.profileId)?.avatar ?? '🙏'}
                      </Text>
                      <Text style={[styles.bookName, { color: colors.text }]}>{item.profileName}</Text>
                    </View>
                    <MarkdownText style={{ color: colors.textSub }}>{item.text}</MarkdownText>
                  </View>
                </SwipeToDelete>
              )}
              renderSectionFooter={() => <View style={styles.sectionSep} />}
              ListFooterComponent={
                visibleCount < gratitudeDays.length ? (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, { borderColor: primary }]}
                    onPress={() => setVisibleCount((c) => c + LOAD_BATCH)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.loadMoreText, { color: primary }]}>{t('gratitude.loadMore')}</Text>
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
            title={writeModal.existing ? t('gratitude.write.editTitle') : t('gratitude.write.writeTitle')}
            onClose={() => setWriteModal({ visible: false })}
            rightLabel={t('gratitude.write.save')}
            onRight={handleSave}
          />
          <View style={styles.writeContent}>
            <View style={styles.promptRow}>
              <Text style={[styles.writePrompt, { color: colors.textMuted, flex: 1 }]}>
                {t('gratitude.write.prompt')}
              </Text>
              <TouchableOpacity
                style={[styles.dictaphoneBtn, { backgroundColor: colors.cardAlt, borderColor: primary }]}
                onPress={() => setDictaphoneVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel={t('gratitude.a11y.dictate')}
                accessibilityRole="button"
              >
                <Text style={styles.dictaphoneBtnEmoji}>🎙️</Text>
                <Text style={[styles.dictaphoneBtnText, { color: primary }]}>{t('gratitude.dictateLabel')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.writeInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={writeText}
              onChangeText={setWriteText}
              placeholder={t('gratitude.write.placeholder')}
              placeholderTextColor={colors.textFaint}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </View>

          {/* Dictaphone Modal */}
          <Modal
            visible={dictaphoneVisible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => {
              const pending = dictaphoneResultRef.current;
              if (pending) {
                setWriteText((prev) => prev.trim() ? `${prev}\n\n${pending}` : pending);
                dictaphoneResultRef.current = '';
              }
              setDictaphoneVisible(false);
            }}
          >
            <DictaphoneRecorder
              context={{
                title: 'Gratitude',
                subtitle: activeProfile?.name ?? '',
              }}
              onResult={(text) => {
                dictaphoneResultRef.current = text;
                setWriteText((prev) => prev.trim() ? `${prev}\n\n${text}` : text);
              }}
              onClose={() => {
                dictaphoneResultRef.current = '';
                setDictaphoneVisible(false);
              }}
            />
          </Modal>
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
  },
  title: { fontSize: FontSize.titleLg, fontWeight: FontWeight.heavy },
  streakBadge: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  streakText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  tabBar: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], gap: Spacing.xl, paddingBottom: 90 },
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
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  writePrompt: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  dictaphoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  dictaphoneBtnEmoji: {
    fontSize: FontSize.sm,
  },
  dictaphoneBtnText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
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
