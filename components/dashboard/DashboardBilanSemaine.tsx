/**
 * DashboardBilanSemaine.tsx — Section dashboard « Bilan de semaine »
 *
 * Visible le dimanche ou samedi après 18h.
 * Génère un récapitulatif IA à partir des données de la semaine.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { useAI } from '../../contexts/AIContext';
import { DashboardCard } from '../DashboardCard';
import { BilanSemaineCard } from '../BilanSemaineCard';
import { buildWeeklyRecapData, formatRecapForAI, WeeklyRecapData } from '../../lib/weekly-recap';
import { generateWeeklyBilan } from '../../lib/ai-service';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';

// ─── Types internes ──────────────────────────────────────────────────────────

type BilanState = 'idle' | 'loading' | 'generated' | 'error';

interface GeneratedBilan {
  narrative: string;
  weekLabel: string;
  tasksCompleted: number;
  mealsCookedCount: number;
  moodsAverage: number | null;
  quote?: { citation: string; enfant: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Vérifie si on doit afficher le bilan (dimanche, ou samedi après 18h) */
function shouldShowBilan(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0) return true; // Dimanche
  if (day === 6 && now.getHours() >= 18) return true; // Samedi après 18h
  return false;
}

/** Formatte le label de la semaine : "Semaine du 16 au 22 mars" */
function formatWeekLabel(start: Date, end: Date, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = t(`dashboard.bilanSemaine.months.${start.getMonth()}`);
  const endMonth = t(`dashboard.bilanSemaine.months.${end.getMonth()}`);

  if (start.getMonth() === end.getMonth()) {
    return t('dashboard.bilanSemaine.weekLabel', { startDay, endDay, month: endMonth });
  }
  return t('dashboard.bilanSemaine.weekLabelCrossMonth', { startDay, startMonth, endDay, endMonth });
}

// ─── Composant ───────────────────────────────────────────────────────────────

function DashboardBilanSemaineInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const { tasks, meals, moods, quotes, profiles, stock, defis } = useVault();
  const { primary, colors } = useThemeColors();
  const { config, isConfigured } = useAI();

  const [state, setState] = useState<BilanState>('idle');
  const [bilan, setBilan] = useState<GeneratedBilan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);

  // Ne pas afficher en dehors des créneaux
  const visible = useMemo(() => shouldShowBilan(), []);
  if (!visible) return null;

  // Calculer les stats de la semaine pour l'aperçu
  const weekStats = useMemo(() => {
    const now = new Date();
    // Début de semaine = lundi
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Tâches complétées cette semaine (par date de complétion, cohérent avec buildWeeklyRecapData)
    const completedTasks = tasks.filter((t) => {
      if (!t.completed || !t.completedDate) return false;
      const d = new Date(t.completedDate);
      return d >= weekStart && d <= weekEnd;
    }).length;

    // Repas planifiés cette semaine (MealItem n'a pas de date, juste day)
    const weekMeals = meals.filter((m) => m.text.trim().length > 0).length;

    // Moyenne humeurs de la semaine
    const weekMoods = moods.filter((m) => {
      const d = new Date(m.date);
      return d >= weekStart && d <= weekEnd;
    });
    const moodsAvg = weekMoods.length > 0
      ? weekMoods.reduce((sum, m) => sum + m.level, 0) / weekMoods.length
      : null;

    // Meilleure citation de la semaine
    const weekQuotes = quotes.filter((q) => {
      const d = new Date(q.date);
      return d >= weekStart && d <= weekEnd;
    });
    const bestQuote = weekQuotes.length > 0
      ? { citation: weekQuotes[0].citation, enfant: weekQuotes[0].enfant }
      : undefined;

    return {
      weekStart,
      weekEnd,
      weekLabel: formatWeekLabel(weekStart, weekEnd, t),
      tasksCompleted: completedTasks,
      mealsCookedCount: weekMeals,
      moodsAverage: moodsAvg,
      quote: bestQuote,
    };
  }, [tasks, meals, moods, quotes]);

  // Génération du bilan IA
  const handleGenerate = useCallback(async () => {
    if (!config) return;

    setState('loading');
    setError(null);

    try {
      // Construire les données de la semaine
      const recapData: WeeklyRecapData = buildWeeklyRecapData(
        tasks,
        tasks.filter(t => t.section != null && t.section.toLowerCase().includes('ménage')),
        meals,
        moods,
        quotes,
        defis,
        profiles,
        stock,
      );

      // Formater pour l'IA
      const prompt = formatRecapForAI(recapData);

      // Appeler l'IA
      const result = await generateWeeklyBilan(config, prompt);

      if (result.error) {
        setState('error');
        setError(result.error);
        return;
      }

      setBilan({
        narrative: result.text,
        weekLabel: weekStats.weekLabel,
        tasksCompleted: weekStats.tasksCompleted,
        mealsCookedCount: weekStats.mealsCookedCount,
        moodsAverage: weekStats.moodsAverage,
        quote: weekStats.quote,
      });
      setState('generated');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : t('dashboard.bilanSemaine.unknownError'));
    }
  }, [config, tasks, meals, moods, quotes, defis, profiles, stock, weekStats]);

  // Partage du bilan
  const handleShare = useCallback(async () => {
    if (!bilan) return;
    const lines = [
      `📊 ${bilan.weekLabel}`,
      '',
      `✅ ${bilan.tasksCompleted} ${t('dashboard.bilanSemaine.tasks')}`,
      `🍽️ ${bilan.mealsCookedCount} ${t('dashboard.bilanSemaine.meals')}`,
      bilan.moodsAverage ? `🌤️ ${t('dashboard.bilanSemaine.mood')}: ${bilan.moodsAverage.toFixed(1)}/5` : '',
      bilan.quote ? `💬 "${bilan.quote.citation}" — ${bilan.quote.enfant}` : '',
      bilan.narrative ? `\n${bilan.narrative}` : '',
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') });
  }, [bilan, t]);

  // ── Rendu état "généré" avec la carte complète ──
  if (state === 'generated' && bilan) {
    if (showFull) {
      return (
        <BilanSemaineCard
          weekLabel={bilan.weekLabel}
          tasksCompleted={bilan.tasksCompleted}
          mealsCookedCount={bilan.mealsCookedCount}
          moodsAverage={bilan.moodsAverage}
          aiNarrative={bilan.narrative}
          quote={bilan.quote}
          onShare={handleShare}
        />
      );
    }

    // Aperçu compact dans la DashboardCard
    return (
      <DashboardCard
        title={t('dashboard.bilanSemaine.title')}

        color={colors.catSouvenirs}
        tinted
      >
        <Text style={[styles.previewText, { color: colors.text }]} numberOfLines={3}>
          {bilan.narrative.slice(0, 100)}…
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => setShowFull(true)}
            style={[styles.actionButton, { backgroundColor: primary }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.bilanSemaine.seeMoreA11y')}
          >
            <Text style={[styles.actionButtonText, { color: colors.onPrimary }]}>
              {t('dashboard.bilanSemaine.seeMore')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.actionButtonOutline, { borderColor: primary }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.bilanSemaine.shareA11y')}
          >
            <Text style={[styles.actionButtonOutlineText, { color: primary }]}>
              {t('dashboard.bilanSemaine.share')}
            </Text>
          </TouchableOpacity>
        </View>
      </DashboardCard>
    );
  }

  // ── Rendu état par défaut (idle / loading / error) ──
  return (
    <DashboardCard
      title={t('dashboard.bilanSemaine.title')}

      color={colors.catSouvenirs}
      tinted
    >
      {/* Aperçu des stats */}
      <View style={styles.previewStats}>
        <View style={styles.previewStat}>
          <Text style={styles.previewStatEmoji}>✅</Text>
          <Text style={[styles.previewStatValue, { color: colors.text }]}>
            {weekStats.tasksCompleted}
          </Text>
          <Text style={[styles.previewStatLabel, { color: colors.textMuted }]}>
            {t('dashboard.bilanSemaine.tasks')}
          </Text>
        </View>
        <View style={styles.previewStat}>
          <Text style={styles.previewStatEmoji}>🍽️</Text>
          <Text style={[styles.previewStatValue, { color: colors.text }]}>
            {weekStats.mealsCookedCount}
          </Text>
          <Text style={[styles.previewStatLabel, { color: colors.textMuted }]}>
            {t('dashboard.bilanSemaine.meals')}
          </Text>
        </View>
        <View style={styles.previewStat}>
          <Text style={styles.previewStatEmoji}>🌤️</Text>
          <Text style={[styles.previewStatValue, { color: colors.text }]}>
            {weekStats.moodsAverage !== null ? weekStats.moodsAverage.toFixed(1) : '—'}
          </Text>
          <Text style={[styles.previewStatLabel, { color: colors.textMuted }]}>
            {t('dashboard.bilanSemaine.mood')}
          </Text>
        </View>
      </View>

      {/* Erreur */}
      {state === 'error' && error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}

      {/* Bouton de génération */}
      {isConfigured ? (
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={state === 'loading'}
          style={[
            styles.generateButton,
            { backgroundColor: state === 'loading' ? colors.border : primary },
          ]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.bilanSemaine.generateA11y')}
        >
          {state === 'loading' ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.onPrimary} />
              <Text style={[styles.generateButtonText, { color: colors.onPrimary }]}>
                {t('dashboard.bilanSemaine.generating')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.generateButtonText, { color: colors.onPrimary }]}>
              {t('dashboard.bilanSemaine.generateBtn')}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={[styles.configHint, { color: colors.textMuted }]}>
          {t('dashboard.bilanSemaine.configHint')}
        </Text>
      )}
    </DashboardCard>
  );
}

export const DashboardBilanSemaine = React.memo(DashboardBilanSemaineInner);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Aperçu des stats
  previewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing['2xl'],
  },
  previewStat: {
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  previewStatEmoji: {
    fontSize: FontSize.title,
  },
  previewStatValue: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.titleLg,
    letterSpacing: -0.3,
  },
  previewStatLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },

  // Texte aperçu
  previewText: {
    fontSize: FontSize.body,
    marginBottom: Spacing.xl,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  actionButtonOutline: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  actionButtonOutlineText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Bouton génération
  generateButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },

  // Erreur
  errorText: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },

  // Hint config IA
  configHint: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
