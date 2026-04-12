import React, { useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { StoryUniverse } from '../../lib/types';
import { STORY_UNIVERSE_SPRITES } from '../../lib/stories';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

export const BOOK_WIDTH = 148;
export const BOOK_HEIGHT = 210;
export const BOOK_GAP = 16;

interface Props {
  universe: StoryUniverse;
  selected: boolean;
  onPress: () => void;
}

function StoryBookCard({ universe, selected, onPress }: Props) {
  const { colors } = useThemeColors();
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.12);

  useEffect(() => {
    scale.value = withTiming(selected ? 1.07 : 1, { duration: 200 });
    shadowOpacity.value = withTiming(selected ? 0.45 : 0.12, { duration: 200 });
  }, [selected, scale, shadowOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: shadowOpacity.value,
  }));

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={universe.titre}
    >
      <Animated.View
        style={[
          styles.book,
          { shadowColor: universe.couleurAccent },
          animStyle,
        ]}
      >
        {/* Spine */}
        <View style={[styles.spine, { backgroundColor: universe.couleurAccent }]} />

        {/* Couverture */}
        <View style={[styles.cover, { backgroundColor: colors.card }]}>
          {/* Sprite ou emoji */}
          {STORY_UNIVERSE_SPRITES[universe.id] ? (
            <Image
              source={STORY_UNIVERSE_SPRITES[universe.id]!}
              style={styles.sprite}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.emoji}>{universe.emoji}</Text>
          )}

          {/* Titre en bas (bandeau coloré) */}
          <View style={[styles.titleBar, { backgroundColor: universe.couleurAccent + 'E6' }]}>
            <Text style={styles.title} numberOfLines={2}>{universe.titre}</Text>
          </View>

          {/* Pastille de sélection */}
          {selected && (
            <View style={[styles.check, { backgroundColor: universe.couleurAccent }]}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default React.memo(StoryBookCard);

const styles = StyleSheet.create({
  book: {
    width: BOOK_WIDTH,
    height: BOOK_HEIGHT,
    flexDirection: 'row',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowOffset: { width: 3, height: 6 },
    shadowRadius: 10,
    elevation: 8,
  },
  spine: {
    width: 11,
  },
  cover: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 44,
  },
  sprite: {
    width: 84,
    height: 84,
  },
  emoji: {
    fontSize: 52,
  },
  titleBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#fff',
    textAlign: 'center',
  },
  check: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
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
