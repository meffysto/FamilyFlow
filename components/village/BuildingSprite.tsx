// components/village/BuildingSprite.tsx
// Phase 30 — Sprite bâtiment village positionné fractionnel sur la carte.
// Per D-12 CONTEXT.md (72×72), UI-SPEC.md Animation Specifications (fade-in 300ms).
// VILL-04 — apparition des bâtiments sur la place du village.

import React, { useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, Text, type ImageSourcePropType } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BUILDINGS_CATALOG } from '../../lib/village';
import { Spacing } from '../../constants/spacing';

// ── Constantes geometrie et animation ──────────────────
const SPRITE_SIZE = 72;
const APPEAR_MS = 300;
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

interface BuildingSpriteProps {
  buildingId: string;
  /** Position centree px sur la carte (slot.x * mapSize.width) */
  slotX: number;
  /** Position centree px sur la carte (slot.y * mapSize.height) */
  slotY: number;
  /** Nombre de ressources en attente de collecte */
  pendingCount?: number;
  onPress: () => void;
  paused?: boolean;
}

export const BuildingSprite = React.memo(function BuildingSprite({
  buildingId,
  slotX,
  slotY,
  pendingCount = 0,
  onPress,
  paused = false,
}: BuildingSpriteProps) {
  const entry = useMemo(
    () => BUILDINGS_CATALOG.find(b => b.id === buildingId),
    [buildingId],
  );
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const emojiOpacity = useSharedValue(0.7);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: APPEAR_MS });
  }, [opacity]);

  // Scintillement emoji ressource
  useEffect(() => {
    if (!reducedMotion && pendingCount > 0 && !paused) {
      emojiOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.5, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    } else {
      emojiOpacity.value = 0.7;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, pendingCount > 0, paused]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    opacity: emojiOpacity.value,
  }));

  if (!entry) return null;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: slotX - SPRITE_SIZE / 2,
          top: slotY - SPRITE_SIZE / 2,
        },
        animStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={entry.labelFR}
        style={styles.press}
      >
        <Image
          source={entry.sprite as ImageSourcePropType}
          style={styles.sprite}
          resizeMode="contain"
        />
      </Pressable>

      {/* Badge ressource en attente — même pattern que BuildingCell (ferme) */}
      {pendingCount > 0 && (
        <>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
          </View>
          <Animated.Text style={[styles.pendingEmoji, emojiStyle]}>
            {entry.production?.itemEmoji ?? '📦'}
          </Animated.Text>
        </>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
  },
  press: {
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sprite: {
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
  },
  pendingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pendingEmoji: {
    position: 'absolute',
    bottom: -Spacing.xs,
    alignSelf: 'center',
    fontSize: 16,
    textAlign: 'center',
    zIndex: 10,
  },
});
