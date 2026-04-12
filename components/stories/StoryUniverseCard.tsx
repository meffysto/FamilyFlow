import React, { useEffect } from 'react';
import { Text, StyleSheet, Pressable, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { StoryUniverse } from '../../lib/types';
import { STORY_UNIVERSE_SPRITES } from '../../lib/stories';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface Props {
  universe: StoryUniverse;
  selected: boolean;
  onPress: () => void;
}

function StoryUniverseCard({ universe, selected, onPress }: Props) {
  const { colors } = useThemeColors();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.04 : 1, { damping: 12, stiffness: 200 });
    glowOpacity.value = withTiming(selected ? 1 : 0, { duration: 250 });
  }, [selected, scale, glowOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={universe.titre}>
      <Animated.View style={[styles.card, { backgroundColor: colors.card }, animatedStyle]}>
        {/* Bordure glow sélectionné */}
        <Animated.View
          style={[
            styles.glowBorder,
            { borderColor: universe.couleurAccent, shadowColor: universe.couleurAccent },
            glowStyle,
          ]}
        />
        {STORY_UNIVERSE_SPRITES[universe.id] ? (
          <Image
            source={STORY_UNIVERSE_SPRITES[universe.id]!}
            style={styles.sprite}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.bgEmoji}>{universe.emoji}</Text>
        )}
        <Text style={[styles.title, { color: colors.text }]}>{universe.titre}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
          {universe.description}
        </Text>
        {selected && (
          <Animated.View style={[styles.checkBadge, { backgroundColor: universe.couleurAccent }]}>
            <Text style={styles.checkText}>✓</Text>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default React.memo(StoryUniverseCard);

const styles = StyleSheet.create({
  card: {
    width: 160,
    height: 180,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    margin: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  glowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.xl,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  bgEmoji: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  sprite: {
    width: 64,
    height: 64,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: FontSize.micro,
    textAlign: 'center',
    opacity: 0.7,
  },
  checkBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#fff',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
});
