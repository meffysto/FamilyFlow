/**
 * NativePlacedItems.tsx — Rendu natif RN des items places sur la scene
 *
 * Positionne les items (Image, emoji, ou animal anime) aux coordonnees
 * SCENE_SLOTS en fractions du conteneur diorama.
 *
 * Perf : 1 seul setInterval partagé pour tous les animaux (au lieu de N timers).
 */

import React, { memo, useEffect, useState } from 'react';
import { Image, Text, StyleSheet } from 'react-native';
import { SCENE_SLOTS, DECORATIONS, INHABITANTS, ITEM_ILLUSTRATIONS } from '../../lib/mascot/types';
import { ANIMAL_IDLE_FRAMES } from './TreeView';

const ITEM_SIZE = 48;
const INHABITANT_SIZE = 36;
const ANIMAL_SIZE = 32;

function getItemEmoji(itemId: string): string | null {
  const deco = DECORATIONS.find(d => d.id === itemId);
  if (deco) return deco.emoji;
  const hab = INHABITANTS.find(h => h.id === itemId);
  if (hab) return hab.emoji;
  return null;
}

function isInhabitant(itemId: string): boolean {
  return INHABITANTS.some(h => h.id === itemId);
}

/** Animal pixel anime — frame pilotée par timer global partagé */
const PlacedAnimal = memo(function PlacedAnimal({
  frames, x, y, frameIdx,
}: { frames: [any, any]; x: number; y: number; frameIdx: 0 | 1 }) {
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
});

interface Props {
  placements: Record<string, string>;
  containerWidth: number;
  containerHeight: number;
  paused?: boolean;
}

export function NativePlacedItems({ placements, containerWidth, containerHeight, paused = false }: Props) {
  // Timer global frame swap — 1 seul setInterval pour tous les animaux
  const [sharedFrameIdx, setSharedFrameIdx] = useState<0 | 1>(0);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setSharedFrameIdx(i => (i === 0 ? 1 : 0)), 500);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <>
      {Object.entries(placements).map(([slotId, itemId]) => {
        const slot = SCENE_SLOTS.find(s => s.id === slotId);
        if (!slot) return null;

        const x = slot.x * containerWidth;
        const y = slot.y * containerHeight;

        // Animal pixel — rendu anime (frame partagée)
        const animalFrames = ANIMAL_IDLE_FRAMES[itemId];
        if (animalFrames) {
          return (
            <PlacedAnimal
              key={slotId}
              frames={animalFrames}
              x={x}
              y={y}
              frameIdx={sharedFrameIdx}
            />
          );
        }

        const emoji = getItemEmoji(itemId);
        if (!emoji) return null;

        const isHab = isInhabitant(itemId);
        const size = isHab ? INHABITANT_SIZE : ITEM_SIZE;

        const illustration = ITEM_ILLUSTRATIONS[itemId];
        if (illustration) {
          return (
            <Image
              key={slotId}
              source={illustration}
              style={[styles.item, {
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
              }] as any}
            />
          );
        }

        const emojiSize = isHab ? 22 : 26;
        const emojiBox = isHab ? 28 : 32;
        return (
          <Text
            key={slotId}
            style={[styles.emoji, {
              left: x - emojiBox / 2,
              top: y - emojiBox / 2,
              fontSize: emojiSize,
              width: emojiBox,
              height: emojiBox,
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
    textAlign: 'center',
  },
});
