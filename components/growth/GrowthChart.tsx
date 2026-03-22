/**
 * GrowthChart.tsx — Courbes de croissance WHO (carnet de sante)
 *
 * Affiche les bandes de percentiles (P3-P97), la mediane P50,
 * les points de mesure de l'enfant, et un tooltip interactif.
 * Utilise react-native-svg pour un rendu net et performant.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
  G,
  Defs,
  ClipPath,
  Rect,
} from 'react-native-svg';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { formatDateLocalized } from '../../lib/date-locale';
import {
  getGrowthReference,
  estimatePercentile,
  type GrowthPercentiles,
} from '../../lib/growth-data';
import type { GrowthEntry } from '../../lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GrowthChartProps {
  entries: GrowthEntry[];
  sex: 'garçon' | 'fille';
  dateNaissance: string; // YYYY-MM-DD
  metric: 'weight' | 'height' | 'head';
  height?: number;
}

// ---------------------------------------------------------------------------
// Constantes de mise en page
// ---------------------------------------------------------------------------

const CHART_HEIGHT = 280;
const Y_AXIS_WIDTH = 36;
const X_AXIS_HEIGHT = 20;
const PADDING_TOP = 8;
const PADDING_RIGHT = 4;

// ---------------------------------------------------------------------------
// Couleurs des bandes par sexe
// ---------------------------------------------------------------------------

const BAND_COLORS = {
  'garçon': {
    outer: '#DBEAFE',
    inner: '#93C5FD',
    median: '#1D4ED8',
    border: '#60A5FA',
  },
  fille: {
    outer: '#FCE7F3',
    inner: '#F9A8D4',
    median: '#BE185D',
    border: '#F472B6',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calcule l'age en mois (decimale) entre deux dates YYYY-MM-DD */
function ageInMonths(birthDate: string, measureDate: string): number {
  const b = new Date(birthDate);
  const m = new Date(measureDate);
  return (
    (m.getFullYear() - b.getFullYear()) * 12 +
    (m.getMonth() - b.getMonth()) +
    (m.getDate() - b.getDate()) / 30.44
  );
}

/** Extrait la valeur de la metrique depuis un GrowthEntry */
function getMetricValue(entry: GrowthEntry, metric: 'weight' | 'height' | 'head'): number | undefined {
  switch (metric) {
    case 'weight':
      return entry.poids;
    case 'height':
      return entry.taille;
    case 'head':
      return entry.perimetre;
  }
}

/** Unite de la metrique */
function getUnit(metric: 'weight' | 'height' | 'head'): string {
  return metric === 'weight' ? 'kg' : 'cm';
}

/** Calcule des valeurs de grille Y jolies (multiples ronds) */
function niceYGridLines(min: number, max: number, targetCount: number): number[] {
  const range = max - min;
  if (range <= 0) return [];

  const rough = range / targetCount;
  // Arrondir a un step lisible : 0.5, 1, 2, 5, 10, 20...
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  let step: number;
  if (rough / mag < 1.5) step = mag;
  else if (rough / mag < 3.5) step = mag * 2;
  else if (rough / mag < 7.5) step = mag * 5;
  else step = mag * 10;

  const start = Math.ceil(min / step) * step;
  const lines: number[] = [];
  for (let v = start; v <= max; v += step) {
    lines.push(Math.round(v * 100) / 100);
  }
  return lines;
}

/** Formate un label d'axe X en mois ou annees */
function formatAgeLabel(months: number): string {
  if (months < 24) return `${months}m`;
  const years = months / 12;
  return Number.isInteger(years) ? `${years}a` : `${months}m`;
}

/** Construit un chemin SVG pour un polygone ferme entre deux courbes */
function buildBandPath(
  months: number[],
  lower: number[],
  upper: number[],
  xScale: (m: number) => number,
  yScale: (v: number) => number,
): string {
  let d = `M ${xScale(months[0])} ${yScale(upper[0])}`;
  for (let i = 1; i < months.length; i++) {
    d += ` L ${xScale(months[i])} ${yScale(upper[i])}`;
  }
  for (let i = months.length - 1; i >= 0; i--) {
    d += ` L ${xScale(months[i])} ${yScale(lower[i])}`;
  }
  d += ' Z';
  return d;
}

/** Construit un chemin SVG pour une ligne simple */
function buildLinePath(
  months: number[],
  values: number[],
  xScale: (m: number) => number,
  yScale: (v: number) => number,
): string {
  let d = `M ${xScale(months[0])} ${yScale(values[0])}`;
  for (let i = 1; i < months.length; i++) {
    d += ` L ${xScale(months[i])} ${yScale(values[i])}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function GrowthChart({ entries, sex, dateNaissance, metric, height: heightProp }: GrowthChartProps) {
  const chartHeight = heightProp ?? CHART_HEIGHT;
  const { primary, colors } = useThemeColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  // Donnees de reference WHO
  const ref = useMemo(
    () => getGrowthReference(sex === 'garçon' ? 'garçon' : 'fille', metric),
    [sex, metric],
  );

  // Points de l'enfant filtres et tries
  const childPoints = useMemo(() => {
    if (!ref) return [];
    return entries
      .map((e) => {
        const value = getMetricValue(e, metric);
        if (value == null) return null;
        const age = ageInMonths(dateNaissance, e.date);
        if (age < 0) return null;
        return { age, value, date: e.date };
      })
      .filter((p): p is { age: number; value: number; date: string } => p !== null)
      .sort((a, b) => a.age - b.age);
  }, [entries, dateNaissance, metric, ref]);

  // Determiner la plage visible d'age : auto-zoom sur l'age de l'enfant
  // plutot que d'afficher toute la reference WHO (0-60 mois)
  const { minMonth, maxMonth, minValue, maxValue, xGridMonths } = useMemo(() => {
    if (!ref) return { minMonth: 0, maxMonth: 36, minValue: 0, maxValue: 20, xGridMonths: [] as number[] };

    const refMin = ref.months[0];
    const refMax = ref.months[ref.months.length - 1];

    // Age max de l'enfant (dernier point de mesure)
    const childMaxAge = childPoints.length > 0 ? childPoints[childPoints.length - 1].age : 0;

    // Auto-zoom : si l'enfant a des mesures, on zoome sur son age + ~30% de marge
    // (minimum 6 mois d'avance) pour voir la trajectoire a venir.
    // Si aucune mesure, on affiche toute la reference.
    let displayMax: number;
    if (childMaxAge > 0) {
      const margin = Math.max(6, Math.ceil(childMaxAge * 0.3));
      displayMax = Math.min(
        Math.ceil((childMaxAge + margin) / 6) * 6,
        refMax,
      );
      // Minimum 12 mois affiches pour que le graphe soit lisible
      displayMax = Math.max(displayMax, 12);
    } else {
      displayMax = refMax;
    }

    // Plage Y : filtrer les ref sur la plage visible pour un Y-range adapte
    const visibleRefIndices = ref.months
      .map((m, i) => (m <= displayMax ? i : -1))
      .filter((i) => i >= 0);
    const visibleP3 = visibleRefIndices.map((i) => ref.p3[i]);
    const visibleP97 = visibleRefIndices.map((i) => ref.p97[i]);

    let yMin = Math.min(...visibleP3);
    let yMax = Math.max(...visibleP97);

    // Inclure les valeurs de l'enfant
    childPoints.forEach((p) => {
      yMin = Math.min(yMin, p.value);
      yMax = Math.max(yMax, p.value);
    });

    const yPadding = (yMax - yMin) * 0.05;
    yMin = Math.max(0, yMin - yPadding);
    yMax = yMax + yPadding;

    // Grille X : tous les 3 mois si <= 24, tous les 6 si <= 60, sinon 12
    const xGrid: number[] = [];
    const step = displayMax <= 24 ? 3 : displayMax <= 60 ? 6 : 12;
    for (let m = refMin; m <= displayMax; m += step) {
      xGrid.push(m);
    }

    return {
      minMonth: refMin,
      maxMonth: displayMax,
      minValue: yMin,
      maxValue: yMax,
      xGridMonths: xGrid,
    };
  }, [ref, childPoints]);

  // Grille Y
  const yGridValues = useMemo(
    () => niceYGridLines(minValue, maxValue, 5),
    [minValue, maxValue],
  );

  // Zone de dessin effective
  const plotWidth = chartWidth - Y_AXIS_WIDTH - PADDING_RIGHT;
  const plotHeight = chartHeight - PADDING_TOP - X_AXIS_HEIGHT;

  // Fonctions de projection
  const xScale = useCallback(
    (m: number) => Y_AXIS_WIDTH + ((m - minMonth) / (maxMonth - minMonth)) * plotWidth,
    [minMonth, maxMonth, plotWidth],
  );
  const yScale = useCallback(
    (v: number) => PADDING_TOP + plotHeight - ((v - minValue) / (maxValue - minValue)) * plotHeight,
    [minValue, maxValue, plotHeight],
  );

  // Couleurs
  const bandColors = BAND_COLORS[sex];
  const unit = getUnit(metric);

  // Coordonnees des points enfant en px
  const childCoords = useMemo(
    () =>
      childPoints.map((p) => ({
        x: xScale(p.age),
        y: yScale(p.value),
        age: p.age,
        value: p.value,
        date: p.date,
      })),
    [childPoints, xScale, yScale],
  );

  // Pas de reference => rien a afficher
  if (!ref) {
    return (
      <View style={[styles.container, { borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Pas de donnees de reference pour cette metrique.
        </Text>
      </View>
    );
  }

  // Filtrer les mois de reference visibles
  const visibleRef = useMemo(() => {
    const indices: number[] = [];
    ref.months.forEach((m, i) => {
      if (m >= minMonth && m <= maxMonth) indices.push(i);
    });
    return {
      months: indices.map((i) => ref.months[i]),
      p3: indices.map((i) => ref.p3[i]),
      p15: indices.map((i) => ref.p15[i]),
      p50: indices.map((i) => ref.p50[i]),
      p85: indices.map((i) => ref.p85[i]),
      p97: indices.map((i) => ref.p97[i]),
    };
  }, [ref, minMonth, maxMonth]);

  const handlePointPress = (index: number) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  const selectedPoint = selectedIndex !== null ? childCoords[selectedIndex] : null;
  const selectedPercentile =
    selectedIndex !== null && ref
      ? estimatePercentile(ref, childPoints[selectedIndex].age, childPoints[selectedIndex].value)
      : null;

  return (
    <View
      style={[styles.container, { height: chartHeight }]}
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
    >
      {chartWidth > 0 && (
        <>
          <Svg width={chartWidth} height={chartHeight}>
            <Defs>
              <ClipPath id="plotClip">
                <Rect
                  x={Y_AXIS_WIDTH}
                  y={PADDING_TOP}
                  width={plotWidth}
                  height={plotHeight}
                />
              </ClipPath>
            </Defs>

            {/* ── Grille Y (lignes horizontales + labels) ── */}
            {yGridValues.map((v) => {
              const y = yScale(v);
              return (
                <G key={`yg-${v}`}>
                  <Line
                    x1={Y_AXIS_WIDTH}
                    y1={y}
                    x2={chartWidth - PADDING_RIGHT}
                    y2={y}
                    stroke={colors.border}
                    strokeOpacity={0.3}
                    strokeWidth={0.5}
                  />
                  <SvgText
                    x={Y_AXIS_WIDTH - 4}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={FontSize.micro}
                    fill={colors.textMuted}
                  >
                    {metric === 'weight' ? v.toFixed(1) : Math.round(v)}
                  </SvgText>
                </G>
              );
            })}

            {/* ── Grille X (lignes verticales + labels age) ── */}
            {xGridMonths.map((m) => {
              const x = xScale(m);
              return (
                <G key={`xg-${m}`}>
                  <Line
                    x1={x}
                    y1={PADDING_TOP}
                    x2={x}
                    y2={PADDING_TOP + plotHeight}
                    stroke={colors.border}
                    strokeOpacity={0.3}
                    strokeWidth={0.5}
                  />
                  <SvgText
                    x={x}
                    y={PADDING_TOP + plotHeight + 14}
                    textAnchor="middle"
                    fontSize={FontSize.micro}
                    fill={colors.textMuted}
                  >
                    {formatAgeLabel(m)}
                  </SvgText>
                </G>
              );
            })}

            {/* ── Bandes de percentiles (clip au plot area) ── */}
            <G clipPath="url(#plotClip)">
              {/* Bande externe P3-P15 / P85-P97 */}
              <Path
                d={buildBandPath(visibleRef.months, visibleRef.p3, visibleRef.p15, xScale, yScale)}
                fill={bandColors.outer}
                opacity={0.7}
              />
              <Path
                d={buildBandPath(visibleRef.months, visibleRef.p85, visibleRef.p97, xScale, yScale)}
                fill={bandColors.outer}
                opacity={0.7}
              />
              {/* Bande interne P15-P50 / P50-P85 */}
              <Path
                d={buildBandPath(visibleRef.months, visibleRef.p15, visibleRef.p50, xScale, yScale)}
                fill={bandColors.inner}
                opacity={0.5}
              />
              <Path
                d={buildBandPath(visibleRef.months, visibleRef.p50, visibleRef.p85, xScale, yScale)}
                fill={bandColors.inner}
                opacity={0.5}
              />

              {/* ── Lignes de percentiles ── */}
              {/* P3 et P97 — pointilles */}
              <Path
                d={buildLinePath(visibleRef.months, visibleRef.p3, xScale, yScale)}
                stroke={bandColors.border}
                strokeWidth={0.8}
                strokeDasharray="4,3"
                fill="none"
              />
              <Path
                d={buildLinePath(visibleRef.months, visibleRef.p97, xScale, yScale)}
                stroke={bandColors.border}
                strokeWidth={0.8}
                strokeDasharray="4,3"
                fill="none"
              />
              {/* P15 et P85 — trait fin continu */}
              <Path
                d={buildLinePath(visibleRef.months, visibleRef.p15, xScale, yScale)}
                stroke={bandColors.border}
                strokeWidth={0.6}
                fill="none"
              />
              <Path
                d={buildLinePath(visibleRef.months, visibleRef.p85, xScale, yScale)}
                stroke={bandColors.border}
                strokeWidth={0.6}
                fill="none"
              />
              {/* P50 — mediane epaisse */}
              <Path
                d={buildLinePath(visibleRef.months, visibleRef.p50, xScale, yScale)}
                stroke={bandColors.median}
                strokeWidth={1.5}
                fill="none"
              />

              {/* ── Ligne de l'enfant ── */}
              {childCoords.length >= 2 && (
                <Path
                  d={
                    `M ${childCoords[0].x} ${childCoords[0].y}` +
                    childCoords
                      .slice(1)
                      .map((p) => ` L ${p.x} ${p.y}`)
                      .join('')
                  }
                  stroke={primary}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* ── Points de l'enfant ── */}
              {childCoords.map((p, i) => (
                <G key={`cp-${i}`}>
                  {/* Cercle blanc de bordure */}
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={8}
                    fill="transparent"
                    onPress={() => handlePointPress(i)}
                  />
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill="white"
                    onPress={() => handlePointPress(i)}
                  />
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={4.5}
                    fill={primary}
                    onPress={() => handlePointPress(i)}
                  />
                </G>
              ))}

              {/* Labels percentiles en bout de courbe */}
              {visibleRef.months.length > 0 && (
                <G>
                  {(['p3', 'p50', 'p97'] as const).map((pKey) => {
                    const lastIdx = visibleRef.months.length - 1;
                    const x = xScale(visibleRef.months[lastIdx]) + 2;
                    const y = yScale(visibleRef[pKey][lastIdx]);
                    const label = pKey === 'p50' ? 'P50' : pKey === 'p3' ? 'P3' : 'P97';
                    return (
                      <SvgText
                        key={pKey}
                        x={x}
                        y={y + 3}
                        fontSize={8}
                        fill={pKey === 'p50' ? bandColors.median : bandColors.border}
                        fontWeight={pKey === 'p50' ? '600' : '400'}
                      >
                        {label}
                      </SvgText>
                    );
                  })}
                </G>
              )}
            </G>

            {/* ── Label unite Y ── */}
            <SvgText
              x={4}
              y={PADDING_TOP + 10}
              fontSize={FontSize.micro}
              fill={colors.textSub}
              fontWeight="600"
            >
              {unit}
            </SvgText>
          </Svg>

          {/* ── Tooltip ── */}
          {selectedPoint && (
            <View
              style={[
                styles.tooltip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  ...Shadows.md,
                },
                {
                  left: Math.min(
                    Math.max(selectedPoint.x - 60, Y_AXIS_WIDTH),
                    chartWidth - 130,
                  ),
                  top: Math.max(selectedPoint.y - 58, 0),
                },
              ]}
            >
              <Pressable onPress={() => setSelectedIndex(null)}>
                <Text style={[styles.tooltipDate, { color: colors.text }]}>
                  {formatDateLocalized(selectedPoint.date)}
                </Text>
                <Text style={[styles.tooltipValue, { color: primary }]}>
                  {selectedPoint.value} {unit}
                </Text>
                {selectedPercentile !== null && (
                  <Text style={[styles.tooltipPct, { color: colors.textSub }]}>
                    ~P{selectedPercentile}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: CHART_HEIGHT,
    position: 'relative',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing['5xl'],
    fontSize: FontSize.sm,
  },
  tooltip: {
    position: 'absolute',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: 100,
  },
  tooltipDate: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  tooltipValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginTop: 1,
  },
  tooltipPct: {
    fontSize: FontSize.caption,
    marginTop: 1,
  },
});
