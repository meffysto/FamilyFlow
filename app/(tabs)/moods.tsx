/**
 * moods.tsx — Météo des humeurs familiales
 *
 * Chaque membre note son humeur du jour (1-5).
 * Historique sur 30 jours.
 * Fichier vault : 05 - Famille/Humeurs.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PillTabSwitcher, type PillTab } from '../../components/ui/PillTabSwitcher';
import { MOOD_EMOJIS, type MoodLevel } from '../../lib/types';
import { MOOD_ICONS, getMoodIconColor } from '../../lib/mood-ui';

type TabId = 'aujourdhui' | 'historique';
const MOOD_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];
const HISTORY_DAYS = 30;

const BTN_SPRING = { damping: 14, stiffness: 300 };

// Couleurs heatmap humeur (fond cellule historique)
const MOOD_COLORS: Record<MoodLevel, string> = {
  1: '#ef444430',
  2: '#f9731630',
  3: '#eab30830',
  4: '#22c55e30',
  5: '#8b5cf630',
};

// ─── Bouton humeur animé ─────────────────────────────────────────────────────

interface MoodBtnProps {
  level: MoodLevel;
  selected: boolean;
  primary: string;
  colors: ReturnType<typeof useThemeColors>['colors'];
  onPress: () => void;
  size?: 'lg' | 'sm';
  accessibilityLabel?: string;
}

function MoodBtn({ level, selected, primary, colors, onPress, size = 'lg', accessibilityLabel }: MoodBtnProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.82, BTN_SPRING);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, BTN_SPRING);
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress();
  }, [onPress]);

  return (
    <Animated.View style={[animStyle, size === 'lg' ? styles.moodBtnWrapper : styles.familyMoodBtnWrapper]}>
      <Pressable
        style={[
          size === 'lg' ? styles.moodBtn : styles.familyMoodBtn,
          {
            backgroundColor: selected ? primary + '22' : colors.card,
            borderColor: selected ? primary : colors.border,
          },
          size === 'lg' && Shadows.sm,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        {(() => {
          const Icon = MOOD_ICONS[level];
          return <Icon size={size === 'lg' ? 30 : 22} strokeWidth={1.75} color={getMoodIconColor(level, colors)} />;
        })()}
      </Pressable>
    </Animated.View>
  );
}

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function MoodsScreen() {
  const { t } = useTranslation();
  const { primary, colors, isDark } = useThemeColors();
  const { showToast } = useToast();
  const { profiles, activeProfile, moods, addMood, refresh } = useVault();
  const { refreshing, onRefresh } = useRefresh(refresh);

  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const [activeTab, setActiveTab] = useState<TabId>('aujourdhui');

  useEffect(() => {
    scrollY.value = 0;
  }, [activeTab]);

  const moodTabs: ReadonlyArray<PillTab<TabId>> = useMemo(() => ([
    { id: 'aujourdhui', label: "Aujourd'hui" },
    { id: 'historique', label: 'Historique' },
  ]), []);
  const [noteModal, setNoteModal] = useState<{ visible: boolean; level: MoodLevel | null; profileId: string | null; profileName: string | null }>({ visible: false, level: null, profileId: null, profileName: null });
  const [noteText, setNoteText] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);

  const isChildMode = activeProfile?.role === 'enfant' || activeProfile?.role === 'ado';

  const moodableProfiles = useMemo(
    () => profiles.filter(p => p.statut !== 'grossesse'),
    [profiles],
  );

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={t('moodsScreen.title')}
        subtitle={t('moodsScreen.subtitle')}
        bottom={
          <View style={styles.tabsWrap}>
            <PillTabSwitcher
              tabs={moodTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              primary={primary}
              colors={colors}
              marginHorizontal={0}
            />
          </View>
        }
        scrollY={scrollY}
      />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, Layout.contentContainer]}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {activeTab === 'aujourdhui' ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('moodsScreen.sectionTitle')}
            </Text>

            <View style={styles.moodRow}>
              {MOOD_LEVELS.map(level => (
                <MoodBtn
                  key={level}
                  level={level}
                  selected={myMoodToday?.level === level}
                  primary={primary}
                  colors={colors}
                  onPress={() => handleSelectMood(level)}
                  size="lg"
                  accessibilityLabel={t('moodsScreen.a11y.moodLevel', { level })}
                />
              ))}
            </View>

            {myMoodToday && (
              <Text style={[styles.myMoodLabel, { color: colors.textSub }]}>
                {t('moodsScreen.yourMood', { emoji: MOOD_EMOJIS[myMoodToday.level] })}
                {myMoodToday.note ? ` — ${myMoodToday.note}` : ''}
              </Text>
            )}

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
                        <MoodBtn
                          key={level}
                          level={level}
                          selected={entry?.level === level}
                          primary={primary}
                          colors={colors}
                          onPress={() => handleSelectMood(level, p.id, p.name)}
                          size="sm"
                          accessibilityLabel={t('moodsScreen.a11y.moodLevelFor', { level, name: p.name })}
                        />
                      ))}
                    </View>
                  ) : (
                    entry ? (
                      (() => {
                        const Icon = MOOD_ICONS[entry.level];
                        return (
                          <View style={styles.familyMoodReadonlyWrap}>
                            <Icon size={22} strokeWidth={1.75} color={getMoodIconColor(entry.level, colors)} />
                          </View>
                        );
                      })()
                    ) : (
                      <Text style={[styles.familyMoodReadonly, { color: colors.textMuted }]}>—</Text>
                    )
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <>
            {/* En-tête grille */}
            <View style={styles.gridHeader}>
              <View style={styles.gridDateCol} />
              {moodableProfiles.map(p => (
                <Text key={p.id} style={[styles.gridProfileName, { color: colors.textSub }]} numberOfLines={1}>
                  {p.avatar}
                </Text>
              ))}
            </View>

            {historyGrid.map((day, i) => (
              <View
                key={day.date}
                style={[
                  styles.gridRow,
                  { borderBottomColor: colors.separator },
                  i === 0 && styles.gridRowFirst,
                ]}
              >
                <Text style={[styles.gridDate, { color: i === 0 ? primary : colors.textMuted, fontWeight: i === 0 ? FontWeight.semibold : FontWeight.normal }]}>
                  {i === 0 ? 'auj.' : day.label}
                </Text>
                {moodableProfiles.map(p => {
                  const level = day.entries.get(p.id);
                  return (
                    <View key={p.id} style={styles.gridCellWrapper}>
                      {level ? (
                        <View style={[styles.gridCellBubble, { backgroundColor: MOOD_COLORS[level] }]}>
                          {(() => {
                            const Icon = MOOD_ICONS[level];
                            return <Icon size={16} strokeWidth={2} color={getMoodIconColor(level, colors)} />;
                          })()}
                        </View>
                      ) : (
                        <Text style={[styles.gridCellEmpty, { color: colors.separator }]}>·</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </Animated.ScrollView>

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
  tabsWrap: {
    paddingVertical: Spacing.xs,
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
  // Boutons humeur grand format
  moodBtnWrapper: {
    flex: 1,
    maxWidth: 64,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  moodBtn: {
    aspectRatio: 1,
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
  // Cards famille
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
  familyMoodBtnWrapper: {
    flex: 1,
  },
  familyMoodBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  familyMoodEmoji: {
    fontSize: FontSize.heading,
  },
  familyMoodReadonly: {
    fontSize: FontSize.heading,
    textAlign: 'center',
    paddingVertical: Spacing.xs,
  },
  familyMoodReadonlyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  gridDateCol: {
    width: 44,
  },
  gridProfileName: {
    flex: 1,
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs,
  },
  gridRowFirst: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  gridDate: {
    width: 44,
    fontSize: FontSize.micro,
  },
  gridCellWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  gridCellBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellEmoji: {
    fontSize: 16,
  },
  gridCellEmpty: {
    fontSize: 14,
    lineHeight: 28,
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
