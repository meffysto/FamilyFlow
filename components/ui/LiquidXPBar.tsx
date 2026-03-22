/**
 * LiquidXPBar.tsx — Barre XP avec effet vague/liquide
 *
 * Remplace la barre statique par un remplissage animé avec
 * des vagues SVG au sommet et un reflet brillant.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontWeight } from '../../constants/typography';

const AnimatedView = Animated.createAnimatedComponent(View);

interface LiquidXPBarProps {
  current: number;
  total: number;
  label?: string;
  color?: string;
  height?: number;
}

function WaveSVG({ color, opacity }: { color: string; opacity: number }) {
  return (
    <Svg
      width="120%"
      height={10}
      viewBox="0 0 200 10"
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: -4, left: '-10%', opacity }}
    >
      <Path
        d="M0,6 C30,2 50,10 80,6 C110,2 130,10 160,6 C190,2 200,8 200,6 L200,10 L0,10 Z"
        fill={color}
      />
    </Svg>
  );
}

export function LiquidXPBar({ current, total, label, color, height = 22 }: LiquidXPBarProps) {
  const { primary, colors } = useThemeColors();
  const barColor = color ?? primary;
  const pct = Math.min((current / Math.max(total, 1)) * 100, 100);

  // Animated fill width
  const fillWidth = useSharedValue(0);

  // Wave movement
  const waveX = useSharedValue(0);

  useEffect(() => {
    fillWidth.value = withSpring(pct, { damping: 15, stiffness: 80 });
  }, [pct]);

  useEffect(() => {
    waveX.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, true,
    );
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%` as any,
  }));

  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: waveX.value }],
  }));

  return (
    <View>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textFaint }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.textMuted }]}>{current} / {total}</Text>
        </View>
      )}
      <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.border }]}>
        <AnimatedView style={[styles.fill, { borderRadius: height / 2 }, fillStyle]}>
          {/* Gradient solide */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: barColor, borderRadius: height / 2 }]} />

          {/* Vagues */}
          <Animated.View style={[styles.waveContainer, waveStyle]}>
            <WaveSVG color={barColor} opacity={0.5} />
          </Animated.View>

          {/* Reflet brillant */}
          <View style={[styles.shine, { borderRadius: height / 4 }]} />
        </AnimatedView>

        {/* Texte centré */}
        <View style={styles.textContainer}>
          <Text style={[styles.barText, { fontSize: height * 0.5 }]}>
            {current} / {total}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  value: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  track: {
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  waveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  shine: {
    position: 'absolute',
    top: 3,
    left: 6,
    right: 6,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  textContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barText: {
    color: '#fff',
    fontWeight: FontWeight.heavy,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
