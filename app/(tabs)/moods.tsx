/**
 * moods.tsx — Météo des humeurs familiales
 *
 * Chaque membre note son humeur du jour (1-5).
 * Historique sur 30 jours.
 * Fichier vault : 05 - Famille/Humeurs.md
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { format, subDays } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useRefresh } from '../../hooks/useRefresh';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { useTranslation } from 'react-i18next';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { MOOD_EMOJIS, type MoodLevel } from '../../lib/types';

type TabId = 'aujourdhui' | 'historique';
const MOOD_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];
const HISTORY_DAYS = 30;

export default function MoodsScreen() {
  const { t } = useTranslation();
  const { primary, colors } = useThemeColors();
  const { showToast } = useToast();
  const { profiles, activeProfile, moods, addMood, refresh } = useVault();
  const { refreshing, onRefresh } = useRefresh(refresh);

  const [activeTab, setActiveTab] = useState<TabId>('aujourdhui');
  const [noteModal, setNoteModal] = useState<{ visible: boolean; level: MoodLevel | null; profileId: string | null; profileName: string | null }>({ visible: false, level: null, profileId: null, profileName: null });
  const [noteText, setNoteText] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);

  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const moodableProfiles = useMemo(
    () => profiles.filter(p => p.statut !== 'grossesse'),
    [profiles],
  );

  // Enfants ne peuvent modifier que leur propre humeur
  const editableProfileIds = useMemo(
    () => isChildMode
      ? new Set([activeProfile?.id].filter(Boolean))
      : new Set(moodableProfiles.map(p => p.id)),
    [moodableProfiles, isChildMode, activeProfile],
  );

  const todayMoods = useMemo(
    () => moods.filter(m => m.date === todayStr),
    [moods, todayStr],
  );

  const myMoodToday = useMemo(
    () => todayMoods.find(m => m.profileId === activeProfile?.id),
    [todayMoods, activeProfile],
  );

  // Historique : grille 30 jours × profils
  const historyGrid = useMemo(() => {
    const days: { date: string; label: string; entries: Map<string, MoodLevel> }[] = [];
    const now = new Date();
    for (let i = 0; i < HISTORY_DAYS; i++) {
      const d = subDays(now, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const label = format(d, 'dd/MM', { locale: getDateLocale() });
      const entries = new Map<string, MoodLevel>();
      for (const m of moods) {
        if (m.date === dateStr) entries.set(m.profileId, m.level);
      }
      days.push({ date: dateStr, label, entries });
    }
    return days;
  }, [moods]);

  const handleSelectMood = useCallback((level: MoodLevel, profileId?: string, profileName?: string) => {
    setNoteText('');
    setNoteModal({ visible: true, level, profileId: profileId || activeProfile?.id || null, profileName: profileName || activeProfile?.name || null });
  }, [activeProfile]);

  const handleSaveMood = useCallback(async () => {
    if (!noteModal.profileId || !noteModal.profileName || !noteModal.level) return;
    try {
      await addMood(noteModal.profileId, noteModal.profileName, noteModal.level, noteText.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('moodsScreen.toast.saved', { emoji: MOOD_EMOJIS[noteModal.level] }), 'success');
      setNoteModal({ visible: false, level: null, profileId: null, profileName: null });
    } catch {
      showToast(t('moodsScreen.toast.error'), 'error');
    }
  }, [noteModal.profileId, noteModal.profileName, noteModal.level, noteText, addMood, showToast]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'aujourdhui', label: t('moodsScreen.tabs.today') },
    { id: 'historique', label: t('moodsScreen.tabs.history') },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('moodsScreen.title')}</Text>
      </View>

      <View style={styles.tabBar}>
        <SegmentedControl segments={tabs} value={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, Layout.contentContainer]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {activeTab === 'aujourdhui' ? (
          <>
            {/* Mon humeur */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('moodsScreen.sectionTitle')}
            </Text>

            <View style={styles.moodRow}>
              {MOOD_LEVELS.map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.moodBtn,
                    { backgroundColor: myMoodToday?.level === level ? primary + '20' : colors.card, borderColor: myMoodToday?.level === level ? primary : colors.border },
                    Shadows.sm,
                  ]}
                  onPress={() => handleSelectMood(level)}
                  accessibilityLabel={t('moodsScreen.a11y.moodLevel', { level })}
                  accessibilityRole="button"
                >
                  <Text style={styles.moodEmoji}>{MOOD_EMOJIS[level]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {myMoodToday && (
              <Text style={[styles.myMoodLabel, { color: colors.textSub }]}>
                {t('moodsScreen.yourMood', { emoji: MOOD_EMOJIS[myMoodToday.level] })}
                {myMoodToday.note ? ` — ${myMoodToday.note}` : ''}
              </Text>
            )}

            {/* Humeurs de la famille */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.xl }]}>
              {t('moodsScreen.familyToday')}
            </Text>

            {moodableProfiles.map(p => {
              const entry = todayMoods.find(m => m.profileId === p.id);
              const canEdit = editableProfileIds.has(p.id);
              return (
                <View key={p.id} style={[styles.familyCard, { backgroundColor: colors.card, borderColor: colors.border }, !canEdit && { opacity: 0.6 }]}>
                  <View style={styles.familyCardHeader}>
                    <Text style={[styles.familyName, { color: colors.text }]}>
                      {p.avatar} {p.name}
                    </Text>
                    {entry && (
                      <Text style={[styles.familyNote, { color: colors.textMuted }]} numberOfLines={1}>
                        {entry.note || ''}
                      </Text>
                    )}
                  </View>
                  {canEdit ? (
                    <View style={styles.familyMoodRow}>
                      {MOOD_LEVELS.map(level => (
                        <TouchableOpacity
                          key={level}
                          style={[
                            styles.familyMoodBtn,
                            { backgroundColor: entry?.level === level ? primary + '20' : colors.cardAlt, borderColor: entry?.level === level ? primary : 'transparent' },
                          ]}
                          onPress={() => handleSelectMood(level, p.id, p.name)}
                          accessibilityLabel={t('moodsScreen.a11y.moodLevelFor', { level, name: p.name })}
                        >
                          <Text style={styles.familyMoodEmoji}>{MOOD_EMOJIS[level]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.familyMoodReadonly, { color: colors.textMuted }]}>
                      {entry ? MOOD_EMOJIS[entry.level] : '—'}
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <>
            {/* Grille historique */}
            <View style={styles.gridHeader}>
              <View style={styles.gridDateCol} />
              {moodableProfiles.map(p => (
                <Text key={p.id} style={[styles.gridProfileName, { color: colors.textSub }]} numberOfLines={1}>
                  {p.avatar}
                </Text>
              ))}
            </View>

            {historyGrid.map(day => (
              <View key={day.date} style={[styles.gridRow, { borderBottomColor: colors.separator }]}>
                <Text style={[styles.gridDate, { color: colors.textMuted }]}>{day.label}</Text>
                {moodableProfiles.map(p => (
                  <Text key={p.id} style={styles.gridCell}>
                    {day.entries.has(p.id) ? MOOD_EMOJIS[day.entries.get(p.id)!] : '·'}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Modal note */}
      <Modal visible={noteModal.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNoteModal({ visible: false, level: null, profileId: null, profileName: null })}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          <ModalHeader title={noteModal.level ? t('moodsScreen.moodOf', { emoji: MOOD_EMOJIS[noteModal.level], name: noteModal.profileName || '' }) : t('moodsScreen.mood')} onClose={() => setNoteModal({ visible: false, level: null, profileId: null, profileName: null })} />
          <View style={styles.modalContent}>
            <Text style={[styles.label, { color: colors.textSub }]}>{t('moodsScreen.addNote')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              placeholder={t('moodsScreen.placeholder')}
              placeholderTextColor={colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
            />
            <View style={styles.saveBtn}>
              <Button label={t('moodsScreen.save')} onPress={handleSaveMood} variant="primary" />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  tabBar: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  moodBtn: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 64,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  moodEmoji: {
    fontSize: 28,
  },
  myMoodLabel: {
    fontSize: FontSize.caption,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  familyCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  familyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  familyName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  familyMoodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  familyMoodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  familyMoodEmoji: {
    fontSize: FontSize.heading,
  },
  familyMood: {
    fontSize: 20,
  },
  familyMoodReadonly: {
    fontSize: FontSize.heading,
    textAlign: 'center',
    paddingVertical: Spacing.xs,
  },
  familyNote: {
    fontSize: FontSize.caption,
    flex: 1,
  },
  // Grille historique
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  gridDateCol: {
    width: 48,
  },
  gridProfileName: {
    flex: 1,
    fontSize: FontSize.body,
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gridDate: {
    width: 48,
    fontSize: FontSize.micro,
  },
  gridCell: {
    flex: 1,
    fontSize: 16,
    textAlign: 'center',
  },
  // Modal
  modalContainer: { flex: 1 },
  modalContent: { padding: Spacing.lg },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
  },
  saveBtn: {
    marginTop: Spacing.xl,
  },
});
