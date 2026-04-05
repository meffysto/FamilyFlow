import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useVault } from '../contexts/VaultContext';
import {
  aggregateTasksByWeek,
  aggregateMealFrequency,
  aggregateMoodTrend,
  aggregateStockTurnover,
  getWeekStart,
} from '@family-vault/core';
import './Stats.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  primary: '#6366f1',
  success: '#10B981',
  warning: '#F59E0B',
  info:    '#0EA5E9',
  error:   '#EF4444',
};

const PIE_COLORS = ['#10B981', '#6366f1', '#EF4444', '#F59E0B'];

const DEFI_STATUS_LABELS: Record<string, string> = {
  en_cours:  'En cours',
  complete:  'Complété',
  abandonne: 'Abandonné',
  pause:     'En pause',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(weekStart)} — ${fmt(end)}`;
}

function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ---------------------------------------------------------------------------
// Shared chart styles
// ---------------------------------------------------------------------------

const axisTick = { fill: 'rgba(255,255,255,0.45)', fontSize: 11 };
const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'rgba(30,30,46,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Stats() {
  const { t } = useTranslation('common');
  const { tasks, meals, defis, moods, stock, gamiData, profiles } = useVault();

  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekStart = useMemo(() => {
    const ws = getWeekStart(new Date());
    ws.setDate(ws.getDate() + weekOffset * 7);
    return ws;
  }, [weekOffset]);

  // ── 1. Tâches complétées par semaine (BarChart) ──────────────────────────

  const taskData = useMemo(
    () => aggregateTasksByWeek(tasks, currentWeekStart),
    [tasks, currentWeekStart],
  );

  const totalTasksWeek = useMemo(
    () => taskData.reduce((sum, d) => sum + d.value, 0),
    [taskData],
  );

  const weekLabel = useMemo(() => formatWeekRange(currentWeekStart), [currentWeekStart]);

  // ── 2. Répartition des défis (PieChart) ─────────────────────────────────

  const defiStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const defi of defis) {
      counts[defi.status] = (counts[defi.status] ?? 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({
      name: DEFI_STATUS_LABELS[status] ?? status,
      value: count,
    }));
  }, [defis]);

  // ── 3. Humeurs sur 30 jours (LineChart) ─────────────────────────────────

  const moodData = useMemo(() => aggregateMoodTrend(moods, 30), [moods]);

  const moodChartData = useMemo(
    () => moodData.filter((d) => d.value > 0).map((d) => ({ label: d.label, value: d.value })),
    [moodData],
  );

  const moodAvg = useMemo(() => {
    if (moodChartData.length === 0) return 0;
    return Math.round((moodChartData.reduce((s, d) => s + d.value, 0) / moodChartData.length) * 10) / 10;
  }, [moodChartData]);

  // ── 4. Repas planifiés par fréquence (BarChart horizontal) ──────────────

  const mealData = useMemo(() => aggregateMealFrequency(meals, 7), [meals]);

  // ── 5. XP gagné par jour (LineChart) ────────────────────────────────────

  const xpData = useMemo(() => {
    if (!gamiData) return [];
    const gamiProfiles = gamiData.profiles ?? [];
    if (gamiProfiles.length === 0) return [];

    const today = new Date();
    const entries: { label: string; xp: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      // Sum XP earned on this day from history entries
      const dayXp = (gamiData.history ?? [])
        .filter((h) => h.timestamp?.slice(0, 10) === iso && h.points > 0)
        .reduce((sum, h) => sum + h.points, 0);
      entries.push({ label: formatDateShort(iso), xp: dayXp });
    }
    return entries;
  }, [gamiData]);

  const hasXpData = xpData.some((d) => d.xp > 0);

  // ── 6. Streak par profil (BarChart) ─────────────────────────────────────

  const streakData = useMemo(() => {
    if (!gamiData) return { current: 0, profileData: [] };

    const profileData = (gamiData.profiles ?? []).map((prof) => {
      const name = profiles.find((p) => p.id === prof.id)?.name ?? prof.name ?? prof.id;
      return { name, streak: prof.streak ?? 0 };
    });

    const current = profileData.reduce((max, p) => Math.max(max, p.streak), 0);
    return { current, profileData };
  }, [gamiData, profiles]);

  // ── Stock à réapprovisionner ─────────────────────────────────────────────

  const stockData = useMemo(() => aggregateStockTurnover(stock, 8), [stock]);

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h1 className="stats-title">{t('statistiques', { defaultValue: 'Statistiques' })}</h1>
      </div>

      <div className="stats-grid">

        {/* ── 1. Tâches par semaine ─────────────────────────── */}
        <div className="stats-card glass-card-wrap">
          <div className="stats-card-header">
            <h2 className="stats-card-title">
              {t('tachesParSemaine', { defaultValue: 'Tâches complétées / semaine' })}
            </h2>
            <div className="stats-week-nav">
              <button
                className="stats-nav-btn"
                onClick={() => setWeekOffset((o) => o - 1)}
                aria-label={t('semainePrecedente', { defaultValue: 'Semaine précédente' })}
              >
                ◀
              </button>
              <span className="stats-week-label">{weekLabel}</span>
              <button
                className="stats-nav-btn"
                onClick={() => setWeekOffset((o) => Math.min(o + 1, 0))}
                disabled={weekOffset >= 0}
                aria-label={t('semaineSuivante', { defaultValue: 'Semaine suivante' })}
              >
                ▶
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={taskData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="value" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} name={t('taches', { defaultValue: 'Tâches' })} />
            </BarChart>
          </ResponsiveContainer>
          <p className="stats-summary">
            {totalTasksWeek} {t('tachesCompletees', { defaultValue: 'tâches complétées cette semaine' })}
          </p>
        </div>

        {/* ── 2. Répartition des défis ──────────────────────── */}
        <div className="stats-card glass-card-wrap">
          <div className="stats-card-header">
            <h2 className="stats-card-title">
              {t('repartitionDefis', { defaultValue: 'Répartition des défis' })}
            </h2>
          </div>
          {defiStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={defiStatusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name ?? ''} ${Math.round(((percent as number | undefined) ?? 0) * 100)}%`
                  }
                  labelLine={false}
                >
                  {defiStatusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="stats-empty-chart">
              {t('aucunDefi', { defaultValue: 'Aucun défi enregistré' })}
            </div>
          )}
          <p className="stats-summary">
            {defis.length} {t('defisTotal', { defaultValue: 'défis au total' })}
          </p>
        </div>

        {/* ── 3. Humeurs 30 jours ────────────────────────────── */}
        <div className="stats-card glass-card-wrap">
          <div className="stats-card-header">
            <h2 className="stats-card-title">
              {t('humeurs30Jours', { defaultValue: 'Humeurs — 30 derniers jours' })}
            </h2>
          </div>
          {moodChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={moodChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_COLORS.warning}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS.warning }}
                  name={t('humeur', { defaultValue: 'Humeur' })}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="stats-empty-chart">
              {t('aucuneHumeur', { defaultValue: 'Aucune humeur enregistrée' })}
            </div>
          )}
          <p className="stats-summary">
            {moodAvg > 0
              ? `${t('moyenneHumeur', { defaultValue: 'Humeur moyenne' })} : ${moodAvg}/5`
              : t('pasDeHumeurs', { defaultValue: "Pas encore de données d'humeur" })}
          </p>
        </div>

        {/* ── 4. Repas planifiés ──────────────────────────────── */}
        <div className="stats-card glass-card-wrap">
          <div className="stats-card-header">
            <h2 className="stats-card-title">
              {t('repasFrequence', { defaultValue: 'Repas planifiés — top fréquence' })}
            </h2>
          </div>
          {mealData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={mealData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
              >
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  dataKey="label"
                  type="category"
                  tick={{ ...axisTick, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" fill={CHART_COLORS.info} radius={[0, 4, 4, 0]} name={t('occurrences', { defaultValue: 'Occurrences' })} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="stats-empty-chart">
              {t('aucunRepas', { defaultValue: 'Aucun repas planifié' })}
            </div>
          )}
          <p className="stats-summary">
            {mealData.length > 0
              ? `${mealData[0].label} — ${mealData[0].value}x`
              : t('pasDeRepas', { defaultValue: 'Ajoutez des repas pour voir les statistiques' })}
          </p>
        </div>

        {/* ── 5. XP gagné par jour ────────────────────────────── */}
        <div className="stats-card glass-card-wrap">
          <div className="stats-card-header">
            <h2 className="stats-card-title">
              {t('xpParJour', { defaultValue: 'XP gagné — 14 derniers jours' })}
            </h2>
          </div>
          {hasXpData ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={xpData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS.primary }}
                  name="XP"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="stats-empty-chart">
              {t('aucunXP', { defaultValue: 'Pas encore de données XP' })}
            </div>
          )}
          <p className="stats-summary">
            {gamiData
              ? `${t('profilsActifs', { defaultValue: 'Profils actifs' })} : ${(gamiData.profiles ?? []).length}`
              : t('gamificationInactive', { defaultValue: 'Gamification non configurée' })}
          </p>
        </div>

        {/* ── 6. Streak de jours consécutifs ──────────────────── */}
        <div className="stats-card glass-card-wrap">
          <div className="stats-card-header">
            <h2 className="stats-card-title">
              {t('streakConsecutif', { defaultValue: 'Streak de jours consécutifs' })}
            </h2>
          </div>
          {streakData.profileData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={streakData.profileData}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar
                    dataKey="streak"
                    radius={[4, 4, 0, 0]}
                    name={t('joursConsecutifs', { defaultValue: 'Jours consécutifs' })}
                  >
                    {streakData.profileData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="stats-streak-info">
                <div className="stats-streak-badge">
                  🔥 {streakData.current} {t('jours', { defaultValue: 'jours' })}
                </div>
                <span className="stats-streak-label">
                  {t('streakActuel', { defaultValue: 'Meilleur streak actuel' })}
                </span>
              </div>
            </>
          ) : (
            <div className="stats-empty-chart">
              {t('aucunStreak', { defaultValue: 'Pas encore de données de streak' })}
            </div>
          )}
          <p className="stats-summary">
            {t('continuerPourStreak', { defaultValue: 'Complétez des tâches chaque jour pour augmenter votre streak !' })}
          </p>
        </div>

      </div>

      {/* Stock à réapprovisionner — section large */}
      {stockData.length > 0 && (
        <div className="stats-card stats-card--full glass-card-wrap">
          <div className="stats-card-header">
            <h2 className="stats-card-title">
              {t('stockAReappro', { defaultValue: 'Stock — produits à réapprovisionner' })}
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={stockData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
            >
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                dataKey="label"
                type="category"
                tick={{ ...axisTick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="value" fill={CHART_COLORS.error} radius={[0, 4, 4, 0]} name={t('quantite', { defaultValue: 'Quantité' })} />
            </BarChart>
          </ResponsiveContainer>
          <p className="stats-summary">
            {stockData.length} {t('produitsAReappro', { defaultValue: 'produits à surveiller' })}
          </p>
        </div>
      )}
    </div>
  );
}
