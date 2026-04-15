// components/village/PortalSprite.tsx
// Phase 29 — Composant partagé : portail pixel art animé.
// Extraction de app/(tabs)/tree.tsx:303-361 pour consommation double
// (ferme → village + village → ferme). Symétrie visuelle per D-16, D-17.
// Couvre VILL-11 (portail retour visuel symétrique), CD-04 (mutualisation).

import React, { useCallback } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Spacing, Radius } from '../../constants/spacing';

const { width: SCREEN_W } = Dimensions.get('window');
// Même calcul que tree.tsx pour aligner le portail au-dessus du sommet de l'arbre
const TREE_SIZE = Math.min(SCREEN_W * 0.65, 280);

// Spring config constante module (convention CLAUDE.md)
const SPRING_PORTAL = { damping: 12, stiffness: 200 } as const;

// Dimensions sprite pixel art (Phase 29.1 : 48 → 64 pour meilleure presence visuelle)
const PORTAL_SIZE = 64;
const CONTAINER_SIZE = 72; // hitbox = sprite + 8px padding

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
  /** Nombre d'objets à récupérer dans le village — affiche un badge rouge si > 0 */
  badgeCount?: number;
}

export function PortalSprite({
  onPress,
  x,
  y,
  accessibilityLabel = 'Portail vers le village',
  badgeCount = 0,
}: PortalSpriteProps) {
  const scaleAnim = useSharedValue(1);

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
          // Mode ferme diorama : gauche, au-dessus du sommet de l'arbre
          bottom: TREE_SIZE + Spacing['3xl'] + 16,
          right: Spacing['6xl'] + 16,
        };

  return (
    <Animated.View
      style={[styles.container, positionStyle, containerStyle]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        hitSlop={HIT_SLOP}
        accessibilityLabel={accessibilityLabel}
      >
        <Image
          source={require('../../assets/items/portail-v2.png')}
          style={styles.sprite}
          resizeMode="contain"
        />
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sprite: {
    width: PORTAL_SIZE,
    height: PORTAL_SIZE,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
});
