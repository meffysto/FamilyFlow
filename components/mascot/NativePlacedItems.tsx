/**
 * NativePlacedItems.tsx — Rendu natif RN des items places sur la scene
 *
 * Positionne les items (Image, emoji, ou animal anime) aux coordonnees
 * SCENE_SLOTS en fractions du conteneur diorama.
 */

import React, { useEffect, useState } from 'react';
import { Image, Text, StyleSheet } from 'react-native';
import { SCENE_SLOTS, DECORATIONS, INHABITANTS, ITEM_ILLUSTRATIONS } from '../../lib/mascot/types';
import { ANIMAL_IDLE_FRAMES } from './TreeView';

const ITEM_SIZE = 48;
const ANIMAL_SIZE = 40;

function getItemEmoji(itemId: string): string | null {
  const deco = DECORATIONS.find(d => d.id === itemId);
  if (deco) return deco.emoji;
  const hab = INHABITANTS.find(h => h.id === itemId);
  if (hab) return hab.emoji;
  return null;
}

/** Animal pixel anime — alterne 2 frames idle */
function PlacedAnimal({ frames, x, y }: { frames: [any, any]; x: number; y: number }) {
  const [frameIdx, setFrameIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setFrameIdx(f => (f + 1) % 2), 500);
    return () => clearInterval(interval);
  }, []);
  return (
    <Image
      source={frames[frameIdx]}
      style={[styles.item, {
        left: x - ANIMAL_SIZE / 2,
        top: y - ANIMAL_SIZE / 2,
        width: ANIMAL_SIZE,
        height: ANIMAL_SIZE,
      }] as any}
    />
  );
}

interface Props {
  placements: Record<string, string>;
  containerWidth: number;
  containerHeight: number;
}

export function NativePlacedItems({ placements, containerWidth, containerHeight }: Props) {
  return (
    <>
      {Object.entries(placements).map(([slotId, itemId]) => {
        const slot = SCENE_SLOTS.find(s => s.id === slotId);
        if (!slot) return null;

        const x = slot.x * containerWidth;
        const y = slot.y * containerHeight;

        // Animal pixel — rendu anime
        const animalFrames = ANIMAL_IDLE_FRAMES[itemId];
        if (animalFrames) {
          return <PlacedAnimal key={slotId} frames={animalFrames} x={x} y={y} />;
        }

        const emoji = getItemEmoji(itemId);
        if (!emoji) return null;

        const illustration = ITEM_ILLUSTRATIONS[itemId];
        if (illustration) {
          return (
            <Image
              key={slotId}
              source={illustration}
              style={[styles.item, {
                left: x - ITEM_SIZE / 2,
                top: y - ITEM_SIZE / 2,
                width: ITEM_SIZE,
                height: ITEM_SIZE,
              }] as any}
            />
          );
        }

        return (
          <Text
            key={slotId}
            style={[styles.emoji, {
              left: x - 16,
              top: y - 16,
            }]}
          >
            {emoji}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
  },
  emoji: {
    position: 'absolute',
    fontSize: 26,
    textAlign: 'center',
    width: 32,
    height: 32,
  },
});
