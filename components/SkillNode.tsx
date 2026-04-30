/**
 * SkillNode.tsx — Noeud de compétence RPG pour l'arbre de compétences
 *
 * Layout horizontal : cercle (56px) + texte à droite
 * 3 états visuels : verrouillé, débloquable (glow pulse), débloqué (check badge + glow)
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Lock, Zap, Check } from 'lucide-react-native';
import { FontSize } from '../constants/typography';
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

interface SkillNodeProps {
  skillId: string;
  label: string;
  emoji: string;
  categoryColor: string;
  state: 'locked' | 'unlockable' | 'unlocked';
  xp: number;
  onPress: (skillId: string) => void;
}

const CIRCLE_SIZE = 56;
const BADGE_SIZE = 20;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SkillNodeInner({ skillId, label, emoji, categoryColor, state, xp, onPress }: SkillNodeProps) {
  const handlePress = React.useCallback(() => onPress(skillId), [onPress, skillId]);
  const { colors } = useThemeColors();
  const { t } = useTranslation('skills');

  const scale = useSharedValue(1);
  const glowPulse = useSharedValue(0);
  const prevStateRef = useRef(state);

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
    if (prevStateRef.current !== 'unlocked' && state === 'unlocked') {
      scale.value = 0.6;
      scale.value = withSpring(1, { damping: 8, stiffness: 300 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevStateRef.current = state;
  }, [state]);

  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
          borderColor: colors.separator,
          opacity: 0.5,
        };
    }
  };

  const renderIcon = () => {
    if (state === 'locked') {
      return <Lock size={22} color={colors.textMuted} strokeWidth={2.2} />;
    }
    return <Text style={styles.emoji}>{emoji}</Text>;
  };

  const renderXpLine = () => {
    switch (state) {
      case 'unlocked':
        return (
          <View style={styles.xpRow}>
            <Zap size={12} color={colors.success} strokeWidth={2.5} fill={colors.success} />
            <Text style={[styles.xpText, { color: colors.success }]}>
              {`+${xp} XP · ${t('node.unlocked', { defaultValue: 'Débloqué' })}`}
            </Text>
          </View>
        );
      case 'unlockable':
        return (
          <View style={styles.xpRow}>
            <Zap size={12} color={categoryColor} strokeWidth={2.5} fill={categoryColor} />
            <Text style={[styles.xpText, { color: categoryColor }]}>
              {`+${xp} XP`}
            </Text>
          </View>
        );
      case 'locked':
        return (
          <Text style={[styles.xpText, { color: colors.textMuted }]}>
            {`+${xp} XP`}
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
        return colors.textMuted;
    }
  };

  const stateLabel = () => {
    switch (state) {
      case 'locked':
        return t('node.state.locked', { defaultValue: 'verrouillé' });
      case 'unlockable':
        return t('node.state.unlockable', { defaultValue: 'débloquable' });
      case 'unlocked':
        return t('node.state.unlocked', { defaultValue: 'débloqué' });
    }
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[styles.row, animatedScaleStyle]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${stateLabel()}, ${t('node.xpPoints', { count: xp, defaultValue: `${xp} points d'expérience` })}`}
      accessibilityState={{ disabled: state === 'locked' }}
    >
      {/* Cercle avec icône */}
      <Animated.View
        style={[
          styles.circle,
          circleStyle(),
          state === 'unlockable' && animatedGlowStyle,
        ]}
      >
        {renderIcon()}

        {/* Badge check pour l'état débloqué */}
        {state === 'unlocked' && (
          <View style={[styles.checkBadge, { backgroundColor: colors.success }]}>
            <Check size={12} color={colors.onPrimary} strokeWidth={3} />
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

export const SkillNode = React.memo(SkillNodeInner);

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
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
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
