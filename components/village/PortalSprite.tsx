// components/village/PortalSprite.tsx
// Phase 29 — Composant partagé : portail pixel art animé.
// Extraction de app/(tabs)/tree.tsx:303-361 pour consommation double
// (ferme → village + village → ferme). Symétrie visuelle per D-16, D-17.
// Couvre VILL-11 (portail retour visuel symétrique), CD-04 (mutualisation).

import React, { useCallback, useEffect } from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';

// Spring config constante module (convention CLAUDE.md)
const SPRING_PORTAL = { damping: 12, stiffness: 200 } as const;

// Dimensions sprite pixel art (per UI-SPEC 48–56px, CD-05)
const PORTAL_SIZE = 48;
const CONTAINER_SIZE = 56; // conserve la hitbox 56×56 de la déclaration tree.tsx originale

// Glow loop values (per RESEARCH.md pattern 4)
const GLOW_MIN = 0.4;
const GLOW_MAX = 0.8;
const GLOW_DURATION = 1200;
const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

interface PortalSpriteProps {
  onPress: () => void;
  /**
   * Si fourni (mode village overlay) : positionné en absolute centré sur (x, y).
   * Si absent (mode ferme diorama) : positionné en absolute bottom-right —
   * reproduit le comportement historique de tree.tsx (anciens styles.portalContainer).
   */
  x?: number;
  y?: number;
  accessibilityLabel?: string;
}

export function PortalSprite({
  onPress,
  x,
  y,
  accessibilityLabel = 'Portail vers le village',
}: PortalSpriteProps) {
  const { colors } = useThemeColors();
  const glowOpacity = useSharedValue(GLOW_MIN);
  const scaleAnim = useSharedValue(1);

  // Démarrer le glow loop au montage (pattern identique tree.tsx:315-317)
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(GLOW_MAX, { duration: GLOW_DURATION }),
      -1,
      true,
    );
  }, [glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    scaleAnim.value = withSpring(0.92, SPRING_PORTAL, () => {
      scaleAnim.value = withSpring(1, SPRING_PORTAL);
    });
    onPress();
  }, [scaleAnim, onPress]);

  // Positionnement : deux modes (village overlay vs ferme diorama).
  const positionStyle =
    x !== undefined && y !== undefined
      ? {
          // Mode village overlay : centre du container aligné sur (x, y)
          left: x - CONTAINER_SIZE / 2,
          top: y - CONTAINER_SIZE / 2,
        }
      : {
          // Mode ferme diorama : bottom-right (reproduit styles.portalContainer original)
          bottom: Spacing['4xl'],
          right: Spacing['2xl'],
        };

  return (
    <Animated.View
      style={[styles.container, positionStyle, containerStyle]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {/* Glow overlay — pattern tree.tsx:342-350 */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.glow,
          { backgroundColor: colors.catJeux },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        hitSlop={HIT_SLOP}
        accessibilityLabel={accessibilityLabel}
      >
        <Image
          source={require('../../assets/items/portail.png')}
          style={styles.sprite}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  glow: {
    borderRadius: Radius.xl,
  },
  sprite: {
    width: PORTAL_SIZE,
    height: PORTAL_SIZE,
  },
});
