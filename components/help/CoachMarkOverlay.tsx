/**
 * CoachMarkOverlay.tsx — Overlay plein écran avec découpe autour de l'élément cible
 *
 * Technique : 4 Views rectangulaires autour de la cible (pas de SVG).
 * Performant, zéro dépendance.
 *
 * Option `borderRadius` : quand > 0, bascule sur la technique "borderWidth géant"
 * (une seule View avec borderRadius + borderWidth = max(screen) pour obtenir un
 * cutout aux coins arrondis sans SVG — respecte D-05bis, ARCH-05).
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { TargetRect } from './CoachMark';

interface CoachMarkOverlayProps {
  /** Zone cible à laisser visible */
  targetRect: TargetRect;
  /** Callback quand on tap sur l'overlay (hors cible) */
  onPress: () => void;
  /** Padding autour de la zone cible */
  padding?: number;
  /** Rayon des coins du cutout (défaut 0 = rectangle droit, rétrocompat) */
  borderRadius?: number;
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';

export const CoachMarkOverlay = React.memo(function CoachMarkOverlay({
  targetRect,
  onPress,
  padding = 8,
  borderRadius = 0,
}: CoachMarkOverlayProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Zone cible avec padding
  const cutout = {
    x: Math.max(0, targetRect.x - padding),
    y: Math.max(0, targetRect.y - padding),
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  // Variante coins arrondis : une seule View avec borderWidth géant.
  // CRITIQUE : en RN, borderWidth est dessiné À L'INTÉRIEUR de la box (border-box sizing).
  // Si on positionne la View à (cutout.x, cutout.y) avec width=cw et borderWidth>cw/2,
  // le border consomme toute la box et aucun trou transparent ne reste → darkening cassé.
  //
  // Fix : on décale la View de -borderThickness dans les deux dimensions et on agrandit
  // sa taille de +2*borderThickness. Le résultat :
  // - Box effective : de (cx - bt, cy - bt) à (cx + cw + bt, cy + ch + bt)
  // - Border width bt → épaisseur bt tout autour
  // - Zone intérieure transparente (content area) : (cx, cy, cw, ch) = le cutout ✓
  // - Zone extérieure : du bord de l'écran jusqu'au cutout, remplie par le borderColor ✓
  //
  // Le borderRadius extérieur doit être scaled : l'inner edge doit avoir le radius voulu,
  // donc outerRadius = borderRadius + borderThickness.
  if (borderRadius > 0) {
    const borderThickness = Math.max(screenWidth, screenHeight);
    return (
      <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
        <TouchableWithoutFeedback onPress={onPress}>
          <View style={styles.touchArea}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: cutout.x - borderThickness,
                top: cutout.y - borderThickness,
                width: cutout.width + borderThickness * 2,
                height: cutout.height + borderThickness * 2,
                borderRadius: borderRadius + borderThickness,
                borderWidth: borderThickness,
                borderColor: OVERLAY_COLOR,
              }}
            />
            {/* Ring d'illumination autour du cutout (subtil, sans bloquer les taps) */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: cutout.x - 3,
                top: cutout.y - 3,
                width: cutout.width + 6,
                height: cutout.height + 6,
                borderRadius: borderRadius + 3,
                borderWidth: 3,
                borderColor: 'rgba(255, 220, 120, 0.9)',
              }}
            />
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    );
  }

  // Variante historique 4-Views rectangulaires (rétrocompat dashboard/tasks)
  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onPress}>
        <View style={styles.touchArea}>
          {/* Vue HAUT */}
          <View
            style={[
              styles.overlay,
              {
                top: 0,
                left: 0,
                right: 0,
                height: cutout.y,
              },
            ]}
          />
          {/* Vue GAUCHE */}
          <View
            style={[
              styles.overlay,
              {
                top: cutout.y,
                left: 0,
                width: cutout.x,
                height: cutout.height,
              },
            ]}
          />
          {/* Vue DROITE */}
          <View
            style={[
              styles.overlay,
              {
                top: cutout.y,
                left: cutout.x + cutout.width,
                right: 0,
                height: cutout.height,
              },
            ]}
          />
          {/* Vue BAS */}
          <View
            style={[
              styles.overlay,
              {
                top: cutout.y + cutout.height,
                left: 0,
                right: 0,
                bottom: 0,
              },
            ]}
          />
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  touchArea: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
});
