/**
 * stats.tsx — Écran Statistiques & Insights
 *
 * 6 sections :
 * 1. Tâches complétées / semaine (BarChart vertical)
 * 2. Calendrier — jours les plus chargés (BarChart vertical)
 * 3. Humeurs — tendance 30 jours (DotChart)
 * 4. Fréquence repas (BarChart horizontal)
 * 5. Stock — produits à réapprovisionner (BarChart horizontal)
 * 6. Sommeil bébé 30 jours (DotChart)
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRefresh } from '../../hooks/useRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useStatsData } from '../../hooks/useStatsData';
import { BarChart, DotChart } from '../../components/charts';
import {
  aggregateTasksByWeek,
  aggregateMealFrequency,
  aggregateSleepByDays,
  aggregateBusiestDays,
  aggregateMoodTrend,
  aggregateStockTurnover,
  moodAvgEmoji,
  getWeekStart,
  formatMinutes,
} from '../../lib/stats';

import { Spacing, Radius, Layout } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { useTranslation } from 'react-i18next';

export default function StatsScreen() {
  const { t } = useTranslation();
  const { primary, colors, isDark } = useThemeColors();
  const { tasks, meals, profiles, refresh, rdvs, moods, stock } = useVault();
  const scrollY = useSharedValue(0);
  const onScrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Pas de copie inutile — tasks n'est jamais muté localement
  const allTasks = tasks;

  // Libellés jours localisés pour les graphes
  const daysShort = useMemo(
    () => t('statsScreen.daysShort', { returnObjects: true }) as string[],
    [t],
  );

  const enfantNames = useMemo(
    () => profiles.filter((p) => p.role === 'enfant').map((p) => p.name),
    [profiles],
  );
  const { sleepByChild, isLoading } = useStatsData(enfantNames);

  const { refreshing, onRefresh } = useRefresh(refresh);

  // Navigation semaine
  const [weekOffset, setWeekOffset] = useState(0);
  const currentWeekStart = useMemo(() => {
    const ws = getWeekStart(new Date());
    ws.setDate(ws.getDate() + weekOffset * 7);
    return ws;
  }, [weekOffset]);

  // Section 1 : Tâches / semaine
  const taskData = useMemo(
    () => aggregateTasksByWeek(allTasks, currentWeekStart, daysShort),
    [allTasks, currentWeekStart, daysShort],
  );
  const totalTasks = useMemo(
    () => taskData.reduce((sum, d) => sum + d.value, 0),
    [taskData],
  );
  const weekLabel = useMemo(() => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    return `${fmt(currentWeekStart)} — ${fmt(end)}`;
  }, [currentWeekStart]);

  // Section 2 : Calendrier chargé
  const calendarData = useMemo(
    () => aggregateBusiestDays(allTasks, rdvs),
    [allTasks, rdvs],
  );
  const busiestDay = useMemo(
    () => calendarData.length > 0
      ? calendarData.reduce((max, d) => d.value > max.value ? d : max, calendarData[0])
      : null,
    [calendarData],
  );

  // Section 3 : Humeurs
  const moodData = useMemo(() => aggregateMoodTrend(moods), [moods]);
  const moodValid = useMemo(() => moodData.filter((d) => d.value > 0), [moodData]);
  const moodAvg = useMemo(
    () => moodValid.length > 0
      ? Math.round((moodValid.reduce((s, d) => s + d.value, 0) / moodValid.length) * 10) / 10
      : 0,
    [moodValid],
  );

  // Section 4 : Repas
  const mealData = useMemo(() => aggregateMealFrequency(meals), [meals]);
  const topMeal = useMemo(() => mealData.length > 0 ? mealData[0] : null, [mealData]);

  // Section 5 : Stock
  const stockData = useMemo(() => aggregateStockTurnover(stock), [stock]);

  // Section 6 : Sommeil
  const sleepPerChild = useMemo(() => {
    return Object.keys(sleepByChild).map((name) => {
      const data = aggregateSleepByDays(sleepByChild[name]);
      const valid = data.filter((d) => d.value > 0);
      const avg = valid.length > 0
        ? Math.round(valid.reduce((s, d) => s + d.value, 0) / valid.length)
        : 0;
      return { name, data, avg };
    });
  }, [sleepByChild]);

  const hasData = totalTasks > 0 || calendarData.length > 0 || moodValid.length > 0 || mealData.length > 0 || stockData.length > 0 || sleepPerChild.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <ScreenHeader
        title={t('statsScreen.title')}
        subtitle={t('statsScreen.subtitle')}
        scrollY={scrollY}
      />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, Layout.contentContainer]}
        onScroll={onScrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {isLoading && (
          <ActivityIndicator size="small" color={primary} style={{ marginVertical: Spacing['2xl'] }} />
        )}

        {/* Tâches complétées / semaine */}
        <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('statsScreen.tasksTitle')}</Text>
          </View>
          <View style={styles.weekNav}>
            <TouchableOpacity onPress={() => setWeekOffset((o) => o - 1)} hitSlop={8} accessibilityLabel={t('statsScreen.a11y.prevWeek')} accessibilityRole="button">
              <Text style={[styles.navBtn, { color: primary }]}>◀</Text>
            </TouchableOpacity>
            <Text style={[styles.weekLabel, { color: colors.textSub }]}>{weekLabel}</Text>
            <TouchableOpacity
              onPress={() => setWeekOffset((o) => Math.min(o + 1, 0))}
              hitSlop={8}
              disabled={weekOffset >= 0}
              accessibilityLabel={t('statsScreen.a11y.nextWeek')}
              accessibilityRole="button"
            >
              <Text style={[styles.navBtn, { color: weekOffset >= 0 ? colors.textFaint : primary }]}>▶</Text>
            </TouchableOpacity>
          </View>
          <BarChart data={taskData} height={100} barColor={colors.success} />
          <Text style={[styles.summary, { color: colors.textMuted }]}>
            {t('statsScreen.tasksSummary', { count: totalTasks })}
          </Text>
        </View>

        {/* Calendrier — jours chargés */}
        {calendarData.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('statsScreen.calendarTitle')}</Text>
            <BarChart data={calendarData} height={100} barColor={colors.warning} />
            {busiestDay && (
              <Text style={[styles.summary, { color: colors.textMuted }]}>
                {t('statsScreen.busiestDay', { day: busiestDay.label, count: busiestDay.value })}
              </Text>
            )}
          </View>
        )}

        {/* Humeurs — tendance 30 jours */}
        {moodValid.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('statsScreen.moodTitle')}</Text>
            <DotChart data={moodData} height={80} color={colors.warning} formatValue={(v) => v > 0 ? moodAvgEmoji(v) : ''} />
            <Text style={[styles.summary, { color: colors.textMuted }]}>
              {t('statsScreen.moodAvg', { avg: moodAvg, emoji: moodAvgEmoji(moodAvg) })}
            </Text>
          </View>
        )}

        {/* Fréquence repas */}
        {mealData.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('statsScreen.mealsTitle')}</Text>
            <BarChart data={mealData} horizontal barColor={colors.info} />
            {topMeal && (
              <Text style={[styles.summary, { color: colors.textMuted }]}>
                {t('statsScreen.topMeal', { name: topMeal.label, count: topMeal.value })}
              </Text>
            )}
          </View>
        )}

        {/* Stock — à réapprovisionner */}
        {stockData.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('statsScreen.stockTitle')}</Text>
            <BarChart data={stockData} horizontal barColor={colors.error} />
            <Text style={[styles.summary, { color: colors.textMuted }]}>
              {t('statsScreen.stockSummary', { count: stockData.length })}
            </Text>
          </View>
        )}

        {/* Sommeil bébé */}
        {sleepPerChild.map(({ name, data, avg }) => (
          <View key={name} style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('statsScreen.sleepTitle', { name })}</Text>
            <DotChart data={data} height={100} color={primary} formatValue={formatMinutes} />
            <Text style={[styles.summary, { color: colors.textMuted }]}>
              {t('statsScreen.sleepAvg', { avg: formatMinutes(avg) })}
            </Text>
          </View>
        ))}

        {/* État vide */}
        {!isLoading && !hasData && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyEmoji]}>📊</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('statsScreen.empty')}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: Spacing['2xl'],
    paddingBottom: 90,
    gap: Spacing['2xl'],
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    gap: Spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['2xl'],
  },
  navBtn: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.md,
  },
  weekLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  summary: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
    gap: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});
