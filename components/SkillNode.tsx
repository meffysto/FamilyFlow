/**
 * SkillNode.tsx — Noeud de compétence RPG pour l'arbre de compétences
 *
 * Layout horizontal : cercle (56px) + texte à droite
 * 3 états visuels : verrouillé, débloquable (glow pulse), débloqué (check badge + glow)
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontSize, FontWeight } from '../constants/typography';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { Shadows } from '../constants/shadows';

interface SkillNodeProps {
  label: string;
  emoji: string;
  categoryColor: string;
  state: 'locked' | 'unlockable' | 'unlocked';
  xp: number;
  onPress: () => void;
}

const CIRCLE_SIZE = 56;
const BADGE_SIZE = 20;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SkillNode({ label, emoji, categoryColor, state, xp, onPress }: SkillNodeProps) {
  const { colors } = useThemeColors();

  const scale = useSharedValue(1);
  const glowPulse = useSharedValue(0);
  const prevState = useSharedValue(state);

  // Pulsation du glow pour l'état débloquable
  useEffect(() => {
    if (state === 'unlockable') {
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0, { duration: 1000 }),
        ),
        -1,
        false,
      );
    } else {
      glowPulse.value = withTiming(0, { duration: 200 });
    }
  }, [state]);

  // Animation spring + haptics lors du déblocage
  useEffect(() => {
    if (prevState.value !== 'unlocked' && state === 'unlocked') {
      scale.value = 0.6;
      scale.value = withSpring(1, { damping: 8, stiffness: 300 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevState.value = state;
  }, [state]);

  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const categoryRgb = hexToRgbValues(categoryColor);
  const lighterBorder = lightenHex(categoryColor, 0.3);

  // Glow animé pour l'état débloquable
  const animatedGlowStyle = useAnimatedStyle(() => {
    if (state !== 'unlockable') return {};
    const opacity = 0.15 + glowPulse.value * 0.25;
    return {
      shadowColor: categoryColor,
      shadowOpacity: opacity,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    };
  });

  const circleStyle = (): object => {
    switch (state) {
      case 'unlocked':
        return {
          backgroundColor: categoryColor,
          borderWidth: 3,
          borderColor: lighterBorder,
          shadowColor: categoryColor,
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        };
      case 'unlockable':
        return {
          backgroundColor: colors.bg,
          borderWidth: 2.5,
          borderColor: categoryColor,
        };
      case 'locked':
        return {
          backgroundColor: colors.cardAlt,
          borderWidth: 2,
          borderColor: '#475569',
          opacity: 0.5,
        };
    }
  };

  const renderEmoji = () => {
    if (state === 'locked') {
      return <Text style={styles.emoji}>{'🔒'}</Text>;
    }
    return <Text style={styles.emoji}>{emoji}</Text>;
  };

  const renderXpLine = () => {
    switch (state) {
      case 'unlocked':
        return (
          <Text style={[styles.xpText, { color: '#10B981' }]}>
            {'⚡ +'}{xp}{' XP · Débloqué'}
          </Text>
        );
      case 'unlockable':
        return (
          <Text style={[styles.xpText, { color: categoryColor }]}>
            {'⚡ +'}{xp}{' XP'}
          </Text>
        );
      case 'locked':
        return (
          <Text style={[styles.xpText, { color: '#475569' }]}>
            {'+'}{xp}{' XP'}
          </Text>
        );
    }
  };

  const labelColor = () => {
    switch (state) {
      case 'unlocked':
        return colors.text;
      case 'unlockable':
        return colors.text;
      case 'locked':
        return '#475569';
    }
  };

  const stateLabel = () => {
    switch (state) {
      case 'locked':
        return 'verrouillé';
      case 'unlockable':
        return 'débloquable';
      case 'unlocked':
        return 'débloqué';
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.row, animatedScaleStyle]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${stateLabel()}, ${xp} points d'expérience`}
      accessibilityState={{ disabled: state === 'locked' }}
    >
      {/* Cercle avec emoji */}
      <Animated.View
        style={[
          styles.circle,
          circleStyle(),
          state === 'unlockable' && animatedGlowStyle,
        ]}
      >
        {renderEmoji()}

        {/* Badge check vert pour l'état débloqué */}
        {state === 'unlocked' && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>{'✓'}</Text>
          </View>
        )}
      </Animated.View>

      {/* Texte à droite */}
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.label,
            {
              color: labelColor(),
              fontWeight: state === 'unlocked' ? '600' : '500',
            },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {renderXpLine()}
      </View>
    </AnimatedPressable>
  );
}

/**
 * Convertit un hex (#RRGGBB) en string "R, G, B" pour rgba()
 */
function hexToRgbValues(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/**
 * Éclaircit une couleur hex d'un facteur donné (0-1)
 */
function lightenHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * factor));
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(lighten(r))}${toHex(lighten(g))}${toHex(lighten(b))}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: FontSize.display,
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    lineHeight: 14,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  xpText: {
    fontSize: FontSize.code,
    lineHeight: 14,
    marginTop: 2,
  },
});
