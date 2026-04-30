/**
 * anniversaires.tsx — Écran gestion des anniversaires
 *
 * SectionList groupée par mois prochain (le prochain anniversaire en premier).
 * Swipe-to-delete, tap pour éditer, import depuis contacts iCloud.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '../../components/ui/ScreenHeader';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Cake, PartyPopper, Contact, Calendar } from 'lucide-react-native';
import { Shadows } from '../../constants/shadows';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateLocale } from '../../lib/date-locale';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { AnniversaryEditor } from '../../components/AnniversaryEditor';
import { ContactImporter } from '../../components/ContactImporter';
import { CalendarImporter } from '../../components/CalendarImporter';
import { EmptyState } from '../../components/EmptyState';
import type { Anniversary } from '../../lib/types';

/** Retourne le nom du mois localisé (index 0-based) */
function getMonthName(monthIndex: number): string {
  return format(new Date(2024, monthIndex, 1), 'MMMM', { locale: getDateLocale() });
}

/** Calcule le nombre de jours avant le prochain anniversaire */
function daysUntilBirthday(dateStr: string): number {
  const [mm, dd] = dateStr.split('-').map(Number);
  const today = new Date();
  const thisYear = today.getFullYear();
  let next = new Date(thisYear, mm - 1, dd);
  // Si la date est passée cette année, prendre l'année prochaine
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next = new Date(thisYear + 1, mm - 1, dd);
  }
  const diff = next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/** Calcule l'âge à venir (ou actuel si l'anniversaire n'est pas encore passé) */
function computeAge(dateStr: string, birthYear?: number): number | undefined {
  if (!birthYear) return undefined;
  const [mm, dd] = dateStr.split('-').map(Number);
  const today = new Date();
  const thisYear = today.getFullYear();
  const birthdayThisYear = new Date(thisYear, mm - 1, dd);
  // Si l'anniversaire n'est pas encore passé cette année, l'âge qu'il/elle va avoir
  if (birthdayThisYear >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    return thisYear - birthYear;
  }
  // Anniversaire déjà passé cette année → âge actuel
  return thisYear - birthYear;
}

/** Format le countdown de manière lisible */
function formatCountdown(days: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (days === 0) return t('anniversairesScreen.countdown.today');
  if (days === 1) return t('anniversairesScreen.countdown.tomorrow');
  if (days <= 7) return t('anniversairesScreen.countdown.days', { count: days });
  if (days <= 30) {
    const weeks = Math.floor(days / 7);
    return t('anniversairesScreen.countdown.weeks', { count: weeks });
  }
  const months = Math.floor(days / 30);
  return t('anniversairesScreen.countdown.months', { count: months });
}

interface SectionData {
  title: string;
  data: (Anniversary & { daysUntil: number; age?: number })[];
}

export default function AnniversairesScreen() {
  const { t } = useTranslation();
  const { primary, tint, colors, isDark } = useThemeColors();
  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { showToast } = useToast();
  const {
    anniversaries,
    addAnniversary,
    updateAnniversary,
    removeAnniversary,
    importAnniversaries,
    refresh,
  } = useVault();

  const { refreshing, onRefresh } = useRefresh(refresh);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingAnniversary, setEditingAnniversary] = useState<Anniversary | undefined>();
  const [importerVisible, setImporterVisible] = useState(false);
  const [calendarImporterVisible, setCalendarImporterVisible] = useState(false);

  // Grouper par mois prochain, trié par nombre de jours restants
  const sections: SectionData[] = useMemo(() => {
    const enriched = anniversaries.map((a) => ({
      ...a,
      daysUntil: daysUntilBirthday(a.date),
      age: computeAge(a.date, a.birthYear),
    }));

    // Trier par jours restants
    enriched.sort((a, b) => a.daysUntil - b.daysUntil);

    // Grouper par mois de l'anniversaire (en commençant par le mois courant)
    const grouped = new Map<string, typeof enriched>();
    for (const item of enriched) {
      const [mm] = item.date.split('-').map(Number);
      const monthLabel = getMonthName(mm - 1);
      if (!grouped.has(monthLabel)) grouped.set(monthLabel, []);
      grouped.get(monthLabel)!.push(item);
    }

    return Array.from(grouped.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [anniversaries]);

  const handleAdd = useCallback(() => {
    setEditingAnniversary(undefined);
    setEditorVisible(true);
    Haptics.selectionAsync();
  }, []);

  const handleEdit = useCallback((anniversary: Anniversary) => {
    setEditingAnniversary(anniversary);
    setEditorVisible(true);
    Haptics.selectionAsync();
  }, []);

  const handleSave = useCallback(
    async (data: Omit<Anniversary, 'sourceFile'>) => {
      if (editingAnniversary) {
        await updateAnniversary(editingAnniversary.name, data);
      } else {
        await addAnniversary(data);
      }
    },
    [editingAnniversary, updateAnniversary, addAnniversary],
  );

  const handleDelete = useCallback(
    async (name: string) => {
      await removeAnniversary(name);
      showToast(t('anniversairesScreen.toast.deleted'));
    },
    [removeAnniversary, showToast],
  );

  const handleImport = useCallback(
    async (items: Omit<Anniversary, 'sourceFile'>[]) => {
      await importAnniversaries(items);
    },
    [importAnniversaries],
  );

  const renderItem = useCallback(
    ({ item }: { item: Anniversary & { daysUntil: number; age?: number } }) => {
      const [mm, dd] = item.date.split('-').map(Number);
      const dateDisplay = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}`;
      const isToday = item.daysUntil === 0;
      const isSoon = item.daysUntil <= 7;

      return (
        <SwipeToDelete
          onDelete={() => handleDelete(item.name)}
          confirmTitle={t('anniversairesScreen.deleteTitle')}
          confirmMessage={t('anniversairesScreen.deleteMessage', { name: item.name })}
          hintId="anniversaires"
        >
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => handleEdit(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('anniversairesScreen.a11y.card', {
              name: item.name,
              date: dateDisplay,
              age: item.age != null ? `, ${item.age} ${t('anniversairesScreen.years')}` : '',
              countdown: formatCountdown(item.daysUntil, t),
            })}
            accessibilityHint={t('anniversairesScreen.a11y.editHint')}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.cardIconBox, { backgroundColor: colors.brand.wash }]}>
                {isToday ? (
                  <PartyPopper size={22} strokeWidth={1.75} color={colors.success} />
                ) : (
                  <Cake size={22} strokeWidth={1.75} color={colors.brand.soil} />
                )}
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={[styles.cardDate, { color: colors.textMuted }]}>
                    {dateDisplay}
                  </Text>
                  {item.age != null && (
                    <Text style={[styles.cardAge, { color: colors.textFaint }]}>
                      {' \u2022 '}{item.age} {t('anniversairesScreen.years')}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.cardRight}>
              {item.category ? (
                <Chip label={item.category} size="sm" />
              ) : null}
              <Text
                style={[
                  styles.countdown,
                  {
                    color: isToday ? colors.success : isSoon ? colors.warning : colors.textMuted,
                    fontWeight: isToday || isSoon ? FontWeight.bold : FontWeight.normal,
                  },
                ]}
              >
                {formatCountdown(item.daysUntil, t)}
              </Text>
            </View>
          </TouchableOpacity>
        </SwipeToDelete>
      );
    },
    [colors, handleDelete, handleEdit, t],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
        {section.title}
      </Text>
    ),
    [colors],
  );

  const renderEmpty = useCallback(
    () => (
      <EmptyState
        emoji="🎂"
        title={t('anniversairesScreen.empty.title')}
        subtitle={t('anniversairesScreen.empty.subtitle')}
        ctaLabel={t('anniversairesScreen.empty.cta')}
        onCta={handleAdd}
      />
    ),
    [handleAdd, t],
  );

  // Prochain anniversaire pour le badge compteur
  const upcomingSoon = useMemo(
    () => anniversaries.filter((a) => daysUntilBirthday(a.date) <= 7).length,
    [anniversaries],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={t('anniversairesScreen.title')}
        subtitle={
          upcomingSoon > 0
            ? `${upcomingSoon} ${t('anniversairesScreen.thisWeek')}`
            : undefined
        }
        actions={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: primary }]}
            onPress={handleAdd}
            activeOpacity={0.7}
            accessibilityLabel={t('anniversairesScreen.a11y.addBirthday')}
            accessibilityRole="button"
          >
            <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+</Text>
          </TouchableOpacity>
        }
        bottom={
          anniversaries.length > 0 ? (
            <View style={styles.importRow}>
              <TouchableOpacity
                style={[styles.importBar, styles.importBarHalf, { backgroundColor: tint, borderColor: primary + '30' }]}
                onPress={() => setImporterVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('anniversairesScreen.a11y.importContacts')}
              >
                <Contact size={18} strokeWidth={1.75} color={primary} />
                <Text style={[styles.importText, { color: primary }]}>
                  {t('anniversairesScreen.importContacts')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importBar, styles.importBarHalf, { backgroundColor: tint, borderColor: primary + '30' }]}
                onPress={() => setCalendarImporterVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('anniversairesScreen.a11y.importCalendar')}
              >
                <Calendar size={18} strokeWidth={1.75} color={primary} />
                <Text style={[styles.importText, { color: primary }]}>
                  {t('anniversairesScreen.importCalendar')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
        scrollY={scrollY}
      />

      {/* Liste */}
      {anniversaries.length === 0 ? (
        renderEmpty()
      ) : (
        <AnimatedSectionList
          sections={sections as any}
          keyExtractor={((item: any) => `${item.name}-${item.date}`) as any}
          renderItem={renderItem as any}
          renderSectionHeader={renderSectionHeader as any}
          contentContainerStyle={[styles.listContent, Layout.contentContainer]}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          stickySectionHeadersEnabled={false}
          onScroll={onScrollHandler}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        />
      )}

      {/* Modal éditeur */}
      <AnniversaryEditor
        visible={editorVisible}
        onClose={() => setEditorVisible(false)}
        onSave={handleSave}
        onDelete={
          editingAnniversary
            ? () => handleDelete(editingAnniversary.name).then(() => setEditorVisible(false))
            : undefined
        }
        existing={editingAnniversary}
      />

      {/* Modal import contacts */}
      <ContactImporter
        visible={importerVisible}
        onClose={() => setImporterVisible(false)}
        onImport={handleImport}
        existingAnniversaries={anniversaries}
      />

      {/* Modal import calendrier */}
      <CalendarImporter
        visible={calendarImporterVisible}
        onClose={() => setCalendarImporterVisible(false)}
        onImport={handleImport}
        existingAnniversaries={anniversaries}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    lineHeight: 18,
  },
  importRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  importBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  importBarHalf: {
    flex: 1,
  },
  importText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  listContent: {
    padding: Spacing['2xl'],
    paddingBottom: 90,
  },
  sectionHeader: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  itemSeparator: { height: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    ...Shadows.sm,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    flex: 1,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  cardName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: FontSize.caption,
  },
  cardAge: {
    fontSize: FontSize.caption,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  countdown: {
    fontSize: FontSize.caption,
  },
});
