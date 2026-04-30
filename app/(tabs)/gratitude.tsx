/**
 * gratitude.tsx — Écran Gratitude familiale
 *
 * 2 onglets : Aujourd'hui (écriture) + Livre d'or (historique)
 * Fichier vault : 06 - Mémoires/Gratitude familiale.md
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  SectionList,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ChevronLeft, ChevronRight, Flame, Mic } from 'lucide-react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AvatarIcon } from '../../components/ui/AvatarIcon';
import { getTheme } from '../../constants/themes';
import * as Haptics from 'expo-haptics';
import { format, addDays, subDays } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { withAlpha } from '../../lib/colors';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';
import { ModalHeader } from '../../components/ui/ModalHeader';
import { Shadows } from '../../constants/shadows';
import type { GratitudeEntry, GratitudeDay } from '../../lib/types';
import { isBabyProfile } from '../../lib/types';
import { MarkdownText } from '../../components/ui/MarkdownText';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { DictaphoneRecorder } from '../../components/DictaphoneRecorder';
import { EmptyState } from '../../components/EmptyState';
import { useTranslation } from 'react-i18next';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

type TabId = 'aujourdhui' | 'livre';

interface GratitudeSection {
  title: string;
  date: string;
  data: GratitudeEntry[];
}

// ─── Constantes animation ────────────────────────────────────────────────────

const TAB_SPRING = { damping: 32, stiffness: 200 };

// ─── TabSwitcher pilule animée ───────────────────────────────────────────────

interface TabSwitcherProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  primary: string;
  colors: ReturnType<typeof useThemeColors>['colors'];
}

function TabSwitcher({ activeTab, onTabChange, primary, colors }: TabSwitcherProps) {
  const [tabWidth, setTabWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const handlePress = useCallback((tab: TabId) => {
    const toIndex = tab === 'aujourdhui' ? 0 : 1;
    indicatorX.value = withSpring(toIndex * tabWidth, TAB_SPRING);
    onTabChange(tab);
  }, [tabWidth, onTabChange, indicatorX]);

  React.useEffect(() => {
    if (tabWidth === 0) return;
    const idx = activeTab === 'aujourdhui' ? 0 : 1;
    indicatorX.value = withSpring(idx * tabWidth, TAB_SPRING);
  }, [tabWidth, activeTab, indicatorX]);

  const DRAG_THRESHOLD = 30;
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const base = activeTab === 'aujourdhui' ? 0 : tabWidth;
      indicatorX.value = Math.max(0, Math.min(tabWidth, base + e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > DRAG_THRESHOLD && activeTab === 'aujourdhui') {
        indicatorX.value = withSpring(tabWidth, TAB_SPRING);
        runOnJS(Haptics.selectionAsync)();
        runOnJS(onTabChange)('livre');
      } else if (e.translationX < -DRAG_THRESHOLD && activeTab === 'livre') {
        indicatorX.value = withSpring(0, TAB_SPRING);
        runOnJS(Haptics.selectionAsync)();
        runOnJS(onTabChange)('aujourdhui');
      } else {
        const snap = activeTab === 'aujourdhui' ? 0 : tabWidth;
        indicatorX.value = withSpring(snap, TAB_SPRING);
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={[tabSwitcherStyles.container, { backgroundColor: colors.brand.wash, borderColor: colors.brand.bark }]}
        onLayout={e => setTabWidth(e.nativeEvent.layout.width / 2)}
      >
        <Animated.View
          style={[tabSwitcherStyles.indicator, indicatorStyle, { backgroundColor: primary, width: tabWidth }]}
        />
        <Pressable
          style={tabSwitcherStyles.tab}
          onPress={() => handlePress('aujourdhui')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'aujourdhui' }}
        >
          <Text style={[tabSwitcherStyles.tabText, { color: activeTab === 'aujourdhui' ? colors.brand.parchment : colors.textSub }]}>
            Aujourd'hui
          </Text>
        </Pressable>
        <Pressable
          style={tabSwitcherStyles.tab}
          onPress={() => handlePress('livre')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'livre' }}
        >
          <Text style={[tabSwitcherStyles.tabText, { color: activeTab === 'livre' ? colors.brand.parchment : colors.textSub }]}>
            Livre d'or
          </Text>
        </Pressable>
      </View>
    </GestureDetector>
  );
}

const tabSwitcherStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: Spacing['4xl'],
    marginVertical: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    height: 44,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: Radius.full,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.lg,
  },
});

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
  const { primary, colors, isDark } = useThemeColors();
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

  // Header collapsible : scrollY partagé entre les deux onglets, reset au switch.
  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  React.useEffect(() => {
    scrollY.value = 0;
  }, [activeTab, scrollY]);

  // Navigation entre jours
  const goToDay = useCallback((offset: number) => {
    const d = offset > 0
      ? addDays(new Date(selectedDate + 'T12:00:00'), offset)
      : subDays(new Date(selectedDate + 'T12:00:00'), Math.abs(offset));
    setSelectedDate(d.toISOString().slice(0, 10));
  }, [selectedDate]);

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
  const bookSections = useMemo<GratitudeSection[]>(() => {
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
  }, [deleteGratitudeEntry, showToast, t]);

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
  }, [activeProfile, selectedDate, writeText, addGratitudeEntry, showToast, t]);

  const dateDisplay = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (isToday) return t('gratitude.today');
    return format(d, 'EEEE d MMMM yyyy', { locale: getDateLocale() });
  }, [selectedDate, isToday, t]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={t('gratitude.title')}
        subtitle={t('gratitude.subtitle')}
        actions={
          streak > 0 ? (
            <View
              style={[styles.streakBadge, { backgroundColor: withAlpha(colors.info, 0.12) }]}
              accessibilityLabel={t('gratitude.a11y.streak', { count: streak, defaultValue: `${streak} jours de suite` })}
            >
              <Flame size={14} color={colors.info} strokeWidth={2.5} fill={colors.info} />
              <Text style={[styles.streakText, { color: colors.info }]}>{streak}</Text>
            </View>
          ) : undefined
        }
        bottom={
          <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} primary={primary} colors={colors} />
        }
        scrollY={scrollY}
      />

      {activeTab === 'aujourdhui' && (
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, Layout.contentContainer]}
          onScroll={onScrollHandler}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {/* Navigation date */}
          <View style={styles.dateNav}>
            <TouchableOpacity
              onPress={() => goToDay(-1)}
              activeOpacity={0.7}
              style={styles.dateArrow}
              accessibilityRole="button"
              accessibilityLabel={t('gratitude.a11y.prevDay')}
            >
              <ChevronLeft size={28} color={primary} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.dateCenter}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>{dateDisplay}</Text>
              {!isToday && (
                <TouchableOpacity
                  onPress={() => setSelectedDate(todayStr)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('gratitude.a11y.today')}
                >
                  <Text style={[styles.todayLink, { color: primary }]}>{t('gratitude.today')}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => goToDay(1)}
              activeOpacity={0.7}
              style={styles.dateArrow}
              disabled={selectedDate >= todayStr}
              accessibilityRole="button"
              accessibilityLabel={t('gratitude.a11y.nextDay')}
              accessibilityState={{ disabled: selectedDate >= todayStr }}
            >
              <ChevronRight size={28} color={selectedDate >= todayStr ? colors.textFaint : primary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Liste profils (exclut grossesse + bébés < 2 ans) */}
          {gratitudeProfiles.map((profile) => {
            const entry = dayData?.entries.find((e) => e.profileId === profile.id);
            const isActiveUser = activeProfile?.id === profile.id;

            return (
              <View key={profile.id} style={[styles.profileCard, { backgroundColor: colors.card }]}>
                <View style={styles.profileHeader}>
                  <AvatarIcon name={profile.avatar} color={getTheme(profile.theme).primary} size={32} />
                  <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                  {isActiveUser && !entry && (
                    <TouchableOpacity
                      style={[styles.writeBtn, { backgroundColor: primary }]}
                      onPress={() => handleOpenWrite()}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t('gratitude.a11y.write')}
                    >
                      <Text style={[styles.writeBtnText, { color: colors.onPrimary }]}>{t('gratitude.writeBtn')}</Text>
                    </TouchableOpacity>
                  )}
                  {isActiveUser && entry && (
                    <TouchableOpacity
                      style={[styles.editBtn, { borderColor: primary }]}
                      onPress={() => handleOpenWrite(entry)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t('gratitude.a11y.edit')}
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
        </Animated.ScrollView>
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
            <AnimatedSectionList
              // AnimatedSectionList perd les génériques de SectionList → cast sections + handlers typés via section/item
              sections={bookSections as unknown as readonly GratitudeSection[]}
              keyExtractor={((item: GratitudeEntry, index: number) => `${item.date}-${item.profileId}-${index}`) as (item: unknown, index: number) => string}
              contentContainerStyle={[styles.content, Layout.contentContainer]}
              onScroll={onScrollHandler}
              scrollEventThrottle={16}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
              renderSectionHeader={(({ section }: { section: GratitudeSection }) => (
                <Text style={[styles.sectionDate, { color: colors.textMuted }]}>{section.title}</Text>
              )) as unknown as (info: { section: unknown }) => React.ReactElement}
              renderItem={(({ item }: { item: GratitudeEntry }) => (
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
              )) as unknown as (info: { item: unknown; index: number }) => React.ReactElement}
              renderSectionFooter={() => <View style={styles.sectionSep} />}
              ListFooterComponent={
                visibleCount < gratitudeDays.length ? (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, { borderColor: primary }]}
                    onPress={() => setVisibleCount((c) => c + LOAD_BATCH)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('gratitude.a11y.loadMore')}
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
                <Mic size={14} color={primary} strokeWidth={2.5} />
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
          {/* TODO(a11y/ux) : modal imbriquée dans une autre modal pageSheet — comportement OK iOS 16+, mais à refondre en bottom sheet partagé si l'on étend le pattern à d'autres écrans. */}
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  streakText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  scroll: { flex: 1 },
  content: { padding: Spacing['2xl'], gap: Spacing.xl, paddingBottom: Layout.fabBottomOffset },
  // Date navigation
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateArrow: {
    padding: Spacing.lg,
  },
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
  bottomPad: { height: Spacing['6xl'] },
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
    // minHeight 120 : hauteur minimale ergonomique pour zone de saisie multiline (~5 lignes)
    minHeight: 120,
  },
});
