/**
 * DotChart.tsx — Points connectés avec axe Y (ex: sommeil bébé)
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import type { DataPoint } from '../../lib/stats';

interface DotChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  /** Fonction de formatage pour l'axe Y (ex: minutes → "2h30") */
  formatValue?: (v: number) => string;
}

const DOT_SIZE = 8;
const LABEL_STEP = 5;
const Y_AXIS_WIDTH = 40;

function defaultFormat(v: number): string {
  return String(Math.round(v));
}

export function DotChart({ data, height = 120, color, formatValue = defaultFormat }: DotChartProps) {
  const { primary, colors } = useThemeColors();
  const dotColor = color ?? primary;
  const opacity = useSharedValue(0);

  const values = data.filter((d) => d.value > 0).map((d) => d.value);
  const maxValue = values.length > 0 ? Math.max(...values) : 1;
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const range = maxValue - minValue || 1;
  const midValue = minValue + range / 2;

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withDelay(200, withTiming(1, { duration: 600 }));
  }, [data.length]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (data.length === 0) return null;

  const pointWidth = 100 / data.length;

  // 3 niveaux de grille (bas=min, milieu, haut=max)
  const gridLines = [
    { value: minValue, ratio: 0 },
    { value: midValue, ratio: 0.5 },
    { value: maxValue, ratio: 1 },
  ];

  return (
    <Animated.View style={animStyle}>
      <View style={styles.chartRow}>
        {/* Axe Y — 3 labels espacés avec flex */}
        <View style={[styles.yAxis, { height }]}>
          <Text style={[styles.yLabel, { color: colors.textFaint }]}>
            {formatValue(maxValue)}
          </Text>
          <Text style={[styles.yLabel, { color: colors.textFaint }]}>
            {formatValue(midValue)}
          </Text>
          <Text style={[styles.yLabel, { color: colors.textFaint }]}>
            {formatValue(minValue)}
          </Text>
        </View>

        {/* Zone graphique */}
        <View style={{ flex: 1 }}>
          <View style={[styles.chart, { height }]}>
            {/* Lignes de grille horizontales */}
            {gridLines.map((g, i) => {
              const bottom = g.ratio * (height - DOT_SIZE - 4) + 2;
              return (
                <View
                  key={`grid-${i}`}
                  style={[
                    styles.gridLine,
                    { bottom, backgroundColor: colors.borderLight },
                  ]}
                />
              );
            })}

            {data.map((d, i) => {
              if (d.value <= 0) return null;
              const y = ((d.value - minValue) / range) * (height - DOT_SIZE - 4);
              const bottomPos = y + 2;

              return (
                <React.Fragment key={i}>
                  {i < data.length - 1 && data[i + 1].value > 0 && (
                    <ConnectingLine
                      x1={(i + 0.5) * pointWidth}
                      y1={bottomPos}
                      x2={(i + 1.5) * pointWidth}
                      y2={((data[i + 1].value - minValue) / range) * (height - DOT_SIZE - 4) + 2}
                      color={dotColor}
                    />
                  )}
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: dotColor,
                        left: `${(i + 0.5) * pointWidth - 1}%`,
                        bottom: bottomPos,
                      },
                    ]}
                  />
                </React.Fragment>
              );
            })}
          </View>

          {/* Labels X */}
          <View style={styles.labelsRow}>
            {data.map((d, i) => (
              <Text
                key={i}
                style={[
                  styles.label,
                  { color: colors.textMuted, width: `${pointWidth}%` },
                  i % LABEL_STEP !== 0 && data.length > 10 && styles.hidden,
                ]}
              >
                {d.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function ConnectingLine({
  x1,
  y1,
  x2,
  y2,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}) {
  const dx = (x2 - x1) * 3;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(-dy, dx) * (180 / Math.PI);

  return (
    <View
      style={[
        styles.line,
        {
          backgroundColor: color,
          width: length,
          left: `${x1}%`,
          bottom: y1 + DOT_SIZE / 2 - 1,
          transform: [{ rotate: `${angle}deg` }],
          opacity: 0.4,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: 'row',
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: Spacing.xs,
  },
  yLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
  },
  chart: {
    position: 'relative',
    width: '100%',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  line: {
    position: 'absolute',
    height: 2,
    transformOrigin: 'left center',
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  label: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  hidden: {
    opacity: 0,
  },
});
