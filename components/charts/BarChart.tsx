/**
 * BarChart.tsx — Graphique barres animé avec Reanimated
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
import type { DataPoint } from '../../lib/stats';

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  horizontal?: boolean;
  barColor?: string;
  compact?: boolean;
}

function AnimatedBar({
  value,
  maxValue,
  height,
  color,
  index,
  showValue,
}: {
  value: number;
  maxValue: number;
  height: number;
  color: string;
  index: number;
  showValue: boolean;
}) {
  const { colors } = useThemeColors();
  const progress = useSharedValue(0);
  const targetProgress = maxValue > 0 ? value / maxValue : 0;
  const fullBarHeight = Math.max(height, 2);

  useEffect(() => {
    progress.value = withDelay(
      index * 80,
      withSpring(targetProgress, { damping: 12, stiffness: 100 }),
    );
  }, [targetProgress, index, progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: progress.value }],
  }));

  return (
    <View style={styles.barWrapper}>
      {showValue && value > 0 && (
        <Text style={[styles.barValue, { color: colors.textMuted }]}>{value}</Text>
      )}
      <View style={[styles.barContainer, { height }]}>
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: color,
              borderRadius: Radius.xs,
              height: fullBarHeight,
              transformOrigin: 'bottom',
            },
            animStyle,
          ]}
        />
      </View>
    </View>
  );
}

function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  index,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  index: number;
}) {
  const { colors } = useThemeColors();
  const progress = useSharedValue(0);
  const targetProgress = maxValue > 0 ? value / maxValue : 0;

  useEffect(() => {
    progress.value = withDelay(
      index * 100,
      withSpring(targetProgress, { damping: 12, stiffness: 100 }),
    );
  }, [targetProgress, index, progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View style={styles.hBarRow}>
      <Text style={[styles.hBarLabel, { color: colors.textSub }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.hBarTrack, { backgroundColor: colors.borderLight }]}>
        <Animated.View
          style={[
            styles.hBar,
            {
              backgroundColor: color,
              borderRadius: Radius.xs,
              transformOrigin: 'left',
            },
            animStyle,
          ]}
        />
      </View>
      <Text style={[styles.hBarValue, { color: colors.textMuted }]}>{value}</Text>
    </View>
  );
}

export function BarChart({
  data,
  height = 120,
  showLabels = true,
  showValues = true,
  horizontal = false,
  barColor,
  compact = false,
}: BarChartProps) {
  const { primary, colors } = useThemeColors();
  const color = barColor ?? primary;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    return (
      <View style={styles.hContainer}>
        {data.map((d, i) => (
          <HorizontalBar
            key={d.label + i}
            label={d.label}
            value={d.value}
            maxValue={maxValue}
            color={d.color ?? color}
            index={i}
          />
        ))}
      </View>
    );
  }

  const chartHeight = compact ? 60 : height;

  return (
    <View>
      <View style={[styles.container, { height: chartHeight + (showValues ? 20 : 0) }]}>
        {data.map((d, i) => (
          <AnimatedBar
            key={d.label + i}
            value={d.value}
            maxValue={maxValue}
            height={chartHeight}
            color={d.color ?? color}
            index={i}
            showValue={showValues && !compact}
          />
        ))}
      </View>
      {showLabels && (
        <View style={styles.labelsRow}>
          {data.map((d, i) => (
            <Text
              key={d.label + i}
              style={[styles.label, { color: colors.textMuted }, compact && styles.labelCompact]}
              numberOfLines={1}
            >
              {d.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    width: '60%',
    minHeight: 2,
  },
  barValue: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.xs,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    flex: 1,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: FontSize.micro,
  },
  // Horizontal bars
  hContainer: {
    gap: Spacing.md,
  },
  hBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  hBarLabel: {
    width: 90,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  hBarTrack: {
    flex: 1,
    height: 16,
    borderRadius: Radius.xs,
    overflow: 'hidden',
  },
  hBar: {
    height: '100%',
    width: '100%',
  },
  hBarValue: {
    width: 28,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textAlign: 'right',
  },
});
