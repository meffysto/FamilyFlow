// components/village/VillageAvatar.tsx
// Phase 29 — Sprite compagnon pixel art sur la carte village avec halo actif/inactif.
// Per D-01, D-02, D-10 — VILL-01 + VILL-02.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { getCompanionStage } from '../../lib/mascot/companion-engine';
import { COMPANION_SPRITES } from '../../lib/mascot/companion-sprites';
import type { Profile } from '../../lib/types';

// ── Constantes geometrie et animation ────────────────
// Phase 30-04 : avatars 48 → 72 pour remplir la nouvelle plaza dirt.
const AVATAR_SIZE = 72;
const HALO_PAD = 20; // diametre halo = AVATAR_SIZE + HALO_PAD
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const FRAME_MS = 500;
const INACTIVE_OPACITY = 0.55;
const HALO_MIN = 0.5;
const HALO_MAX = 0.8;
const HALO_DURATION = 2000;

interface VillageAvatarProps {
  profile: Profile;
  /** Position centree en pixels (deja convertie depuis slot fractionnel) */
  slotX: number;
  /** Position centree en pixels (deja convertie depuis slot fractionnel) */
  slotY: number;
  /** true si profil a >=1 contribution cette semaine (per D-09) */
  isActive: boolean;
  onPress: () => void;
}

export const VillageAvatar = React.memo(function VillageAvatar({
  profile,
  slotX,
  slotY,
  isActive,
  onPress,
}: VillageAvatarProps) {
  const { colors } = useThemeColors();
  const haloOpacity = useSharedValue(0);
  const [frameIdx, setFrameIdx] = useState<0 | 1>(0);

  // Pulse halo si actif, sinon cancel (per D-10, Pitfall 8 cancelAnimation cleanup)
  useEffect(() => {
    if (isActive) {
      haloOpacity.value = HALO_MIN;
      haloOpacity.value = withRepeat(
        withTiming(HALO_MAX, { duration: HALO_DURATION }),
        -1,
        true,
      );
    } else {
      cancelAnimation(haloOpacity);
      haloOpacity.value = 0;
    }
    return () => cancelAnimation(haloOpacity);
  }, [isActive, haloOpacity]);

  // Alternance respiration idle_1/idle_2 (pattern CompanionSlot.tsx)
  useEffect(() => {
    const timer = setTimeout(() => setFrameIdx(f => (f === 0 ? 1 : 0)), FRAME_MS);
    return () => clearTimeout(timer);
  }, [frameIdx]);

  const haloStyle = useAnimatedStyle(() => ({ opacity: haloOpacity.value }));

  // D-03 : skip silencieux si pas de compagnon
  if (!profile.companion) return null;

  const species = profile.companion.activeSpecies;
  const stage = getCompanionStage(profile.level);
  const sprites = COMPANION_SPRITES[species][stage];
  const currentSprite = frameIdx === 0 ? sprites.idle_1 : sprites.idle_2;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  const containerSize = AVATAR_SIZE + HALO_PAD;

  return (
    <View
      style={[
        styles.slot,
        {
          left: slotX - containerSize / 2,
          top: slotY - containerSize / 2,
          width: containerSize,
          height: containerSize,
        },
      ]}
      pointerEvents="box-none"
    >
      {isActive && (
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: colors.success,
              width: containerSize,
              height: containerSize,
              borderRadius: containerSize / 2,
            },
            haloStyle,
          ]}
          pointerEvents="none"
        />
      )}
      <Pressable
        onPress={handlePress}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${profile.name}, ${isActive ? 'actif' : 'inactif'} cette semaine`}
        style={styles.press}
      >
        <Animated.Image
          source={currentSprite}
          style={[styles.sprite, !isActive && styles.inactive]}
          resizeMode="contain"
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  press: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sprite: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  inactive: {
    opacity: INACTIVE_OPACITY,
  },
});
