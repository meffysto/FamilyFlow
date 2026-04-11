// components/village/BuildingSprite.tsx
// Phase 30 — Sprite bâtiment village positionné fractionnel sur la carte.
// Per D-12 CONTEXT.md (72×72), UI-SPEC.md Animation Specifications (fade-in 300ms).
// VILL-04 — apparition des bâtiments sur la place du village.

import React, { useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, type ImageSourcePropType } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BUILDINGS_CATALOG } from '../../lib/village';

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
  onPress: () => void;
}

export const BuildingSprite = React.memo(function BuildingSprite({
  buildingId,
  slotX,
  slotY,
  onPress,
}: BuildingSpriteProps) {
  const entry = useMemo(
    () => BUILDINGS_CATALOG.find(b => b.id === buildingId),
    [buildingId],
  );
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: APPEAR_MS });
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
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
});
