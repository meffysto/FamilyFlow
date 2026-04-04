/**
 * NativePlacementSlots.tsx — Slots de placement interactifs en RN natif
 *
 * Remplace le SVG PlacementSlots. Affiche des cercles pulsants
 * aux positions SCENE_SLOTS avec TouchableOpacity pour le tap.
 */

import React, { useEffect } from 'react';
import { Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SCENE_SLOTS, ITEM_ILLUSTRATIONS, DECORATIONS, INHABITANTS } from '../../lib/mascot/types';

const SLOT_SIZE = 32;

function getItemEmoji(itemId: string): string | null {
  const deco = DECORATIONS.find(d => d.id === itemId);
  if (deco) return deco.emoji;
  const hab = INHABITANTS.find(h => h.id === itemId);
  if (hab) return hab.emoji;
  return null;
}

interface Props {
  placements: Record<string, string>;
  placingItemId: string;
  containerWidth: number;
  containerHeight: number;
  onSelect?: (slotId: string) => void;
}

function PulsingSlot({ x, y, isEmpty, emoji, illustration, onPress }: {
  x: number;
  y: number;
  isEmpty: boolean;
  emoji: string | null;
  illustration: number | null;
  onPress: () => void;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isEmpty) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }
  }, [isEmpty]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isEmpty ? pulse.value : 1 }],
  }));

  return (
    <Animated.View
      style={[styles.slot, animStyle, {
        left: x - SLOT_SIZE / 2,
        top: y - SLOT_SIZE / 2,
        width: SLOT_SIZE,
        height: SLOT_SIZE,
        borderRadius: SLOT_SIZE / 2,
        backgroundColor: isEmpty ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
        borderColor: isEmpty ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.8)',
        borderWidth: 1.5,
        borderStyle: isEmpty ? 'dashed' : 'solid',
      }]}
    >
      <Animated.View
        style={styles.slotTouchable}
        onTouchEnd={onPress}
      >
        {isEmpty ? (
          <Text style={styles.plusText}>+</Text>
        ) : illustration ? (
          <Image source={illustration} style={styles.slotImage as any} />
        ) : (
          <Text style={styles.slotEmoji}>{emoji}</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

export function NativePlacementSlots({ placements, placingItemId, containerWidth, containerHeight, onSelect }: Props) {
  return (
    <>
      {SCENE_SLOTS.map(slot => {
        const occupiedItemId = placements[slot.id];
        const emoji = occupiedItemId ? getItemEmoji(occupiedItemId) : null;
        const isEmpty = !emoji;
        const illustration = occupiedItemId ? (ITEM_ILLUSTRATIONS[occupiedItemId] ?? null) : null;

        const x = slot.x * containerWidth;
        const y = slot.y * containerHeight;

        return (
          <PulsingSlot
            key={slot.id}
            x={x}
            y={y}
            isEmpty={isEmpty}
            emoji={emoji}
            illustration={illustration}
            onPress={() => onSelect?.(slot.id)}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: 'bold',
  },
  slotImage: {
    width: 22,
    height: 22,
  },
  slotEmoji: {
    fontSize: 16,
    textAlign: 'center',
  },
});
