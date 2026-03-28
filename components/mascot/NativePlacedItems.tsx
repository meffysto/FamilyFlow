/**
 * NativePlacedItems.tsx — Rendu natif RN des items places sur la scene
 *
 * Remplace le SVG PlacedItems. Positionne les items (Image ou emoji Text)
 * aux coordonnees SCENE_SLOTS converties en pixels ecran.
 */

import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { SCENE_SLOTS, DECORATIONS, INHABITANTS, ITEM_ILLUSTRATIONS } from '../../lib/mascot/types';

const VIEWBOX_W = 200;
const VIEWBOX_H = 240;
const ITEM_SIZE = 32;

function getItemEmoji(itemId: string): string | null {
  const deco = DECORATIONS.find(d => d.id === itemId);
  if (deco) return deco.emoji;
  const hab = INHABITANTS.find(h => h.id === itemId);
  if (hab) return hab.emoji;
  return null;
}

interface Props {
  placements: Record<string, string>;
  containerWidth: number;
  containerHeight: number;
  skipIds?: Set<string>; // IDs a ignorer (animaux pixel geres separement)
}

export function NativePlacedItems({ placements, containerWidth, containerHeight, skipIds }: Props) {
  return (
    <>
      {Object.entries(placements).map(([slotId, itemId]) => {
        if (skipIds?.has(itemId)) return null;
        const slot = SCENE_SLOTS.find(s => s.id === slotId);
        if (!slot) return null;
        const emoji = getItemEmoji(itemId);
        if (!emoji) return null;

        const x = (slot.cx / VIEWBOX_W) * containerWidth;
        const y = (slot.cy / VIEWBOX_H) * containerHeight;
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
              left: x - 12,
              top: y - 12,
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
    fontSize: 20,
    textAlign: 'center',
    width: 24,
    height: 24,
  },
});
