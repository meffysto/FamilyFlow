/**
 * stats.tsx — Écran Statistiques & Insights
 *
 * 4 sections :
 * 1. Tâches complétées / semaine (BarChart vertical)
 * 2. Budget tendances 6 mois (BarChart vertical)
 * 3. Fréquence repas (BarChart horizontal)
 * 4. Sommeil bébé 30 jours (DotChart)
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
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useStatsData } from '../../hooks/useStatsData';
import { BarChart, DotChart } from '../../components/charts';
import {
  aggregateTasksByWeek,
  aggregateBudgetByMonths,
  aggregateMealFrequency,
  aggregateSleepByDays,
  getWeekStart,
  formatMinutes,
} from '../../lib/stats';
import { formatAmount } from '../../lib/budget';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

export default function StatsScreen() {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { tasks, menageTasks, meals, profiles, refresh } = useVault();

  // Fusion tâches récurrentes + ménage pour le comptage complet
  const allTasks = useMemo(
    () => [...tasks, ...menageTasks],
    [tasks, menageTasks],
  );

  // Enfants pour le sommeil
  const enfantNames = useMemo(
    () => profiles.filter((p) => p.role === 'enfant').map((p) => p.name),
    [profiles],
  );
  const { sleepByChild, budgetTrend, isLoading } = useStatsData(enfantNames);

  const { refreshing, onRefresh } = useRefresh(refresh);

  // Navigation semaine
  const [weekOffset, setWeekOffset] = useState(0);
  const currentWeekStart = useMemo(() => {
    const ws = getWeekStart(new Date());
    ws.setDate(ws.getDate() + weekOffset * 7);
    return ws;
  }, [weekOffset]);

  // ── Section 1 : Tâches / semaine ──
  const taskData = useMemo(
    () => aggregateTasksByWeek(allTasks, currentWeekStart),
    [allTasks, currentWeekStart],
  );
  const totalTasks = taskData.reduce((sum, d) => sum + d.value, 0);
  const weekLabel = useMemo(() => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    return `${fmt(currentWeekStart)} — ${fmt(end)}`;
  }, [currentWeekStart]);

  // ── Section 2 : Budget ──
  const budgetData = useMemo(
    () => aggregateBudgetByMonths(budgetTrend),
    [budgetTrend],
  );
  const budgetTotal = budgetData.reduce((sum, d) => sum + d.value, 0);
  const budgetEvolution = useMemo(() => {
    if (budgetData.length < 2) return null;
    const last = budgetData[budgetData.length - 1].value;
    const prev = budgetData[budgetData.length - 2].value;
    if (prev === 0) return null;
    const pct = Math.round(((last - prev) / prev) * 100);
    return pct;
  }, [budgetData]);

  // ── Section 3 : Repas ──
  const mealData = useMemo(() => aggregateMealFrequency(meals), [meals]);
  const topMeal = mealData.length > 0 ? mealData[0] : null;

  // ── Section 4 : Sommeil (une courbe par enfant) ──
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: primary }]}>← Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Statistiques</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {isLoading && (
          <ActivityIndicator size="small" color={primary} style={{ marginVertical: Spacing['2xl'] }} />
        )}

        {/* ── Tâches complétées / semaine ── */}
        <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>📋 Tâches complétées</Text>
          </View>
          <View style={styles.weekNav}>
            <TouchableOpacity onPress={() => setWeekOffset((o) => o - 1)} hitSlop={8}>
              <Text style={[styles.navBtn, { color: primary }]}>◀</Text>
            </TouchableOpacity>
            <Text style={[styles.weekLabel, { color: colors.textSub }]}>{weekLabel}</Text>
            <TouchableOpacity
              onPress={() => setWeekOffset((o) => Math.min(o + 1, 0))}
              hitSlop={8}
              disabled={weekOffset >= 0}
            >
              <Text style={[styles.navBtn, { color: weekOffset >= 0 ? colors.textFaint : primary }]}>▶</Text>
            </TouchableOpacity>
          </View>
          <BarChart data={taskData} height={100} barColor={colors.success} />
          <Text style={[styles.summary, { color: colors.textMuted }]}>
            {totalTasks} tâche{totalTasks !== 1 ? 's' : ''} cette semaine
          </Text>
        </View>

        {/* ── Budget tendances ── */}
        {budgetData.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>💰 Budget tendances</Text>
            <BarChart data={budgetData} height={100} barColor={primary} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summary, { color: colors.textMuted }]}>
                Total : {formatAmount(budgetTotal)}
              </Text>
              {budgetEvolution !== null && (
                <Text
                  style={[
                    styles.evolution,
                    { color: budgetEvolution > 0 ? colors.error : colors.success },
                  ]}
                >
                  {budgetEvolution > 0 ? '↑' : '↓'} {Math.abs(budgetEvolution)}%
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Fréquence repas ── */}
        {mealData.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>🍽️ Repas fréquents</Text>
            <BarChart data={mealData} horizontal barColor={colors.info} />
            {topMeal && (
              <Text style={[styles.summary, { color: colors.textMuted }]}>
                Le plus fréquent : {topMeal.label} ({topMeal.value}×)
              </Text>
            )}
          </View>
        )}

        {/* ── Sommeil bébé (une courbe par enfant) ── */}
        {sleepPerChild.map(({ name, data, avg }) => (
          <View key={name} style={[styles.card, { backgroundColor: colors.card }, Shadows.sm]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>😴 Sommeil — {name}</Text>
            <DotChart data={data} height={100} color={primary} formatValue={formatMinutes} />
            <Text style={[styles.summary, { color: colors.textMuted }]}>
              Moyenne : {formatMinutes(avg)} / jour (30 derniers jours)
            </Text>
          </View>
        ))}

        {/* État vide */}
        {!isLoading && budgetData.length === 0 && mealData.length === 0 && sleepPerChild.length === 0 && totalTasks === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyEmoji]}>📊</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Pas encore de données à afficher.{'\n'}Les statistiques apparaîtront au fil de l'utilisation.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  backBtn: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.heavy,
  },
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  evolution: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
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
