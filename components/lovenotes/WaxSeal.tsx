/**
 * WaxSeal.tsx — Cachet de cire animé (pulse Reanimated)
 *
 * Cachet rouge circulaire avec initiale centrale et badge compteur optionnel.
 * Réutilisable :
 *  - Variante hero (size=72, default) sur EnvelopeCard du dashboard
 *  - Variante mini (size=32) dans LoveNoteCard pour notes révélées non lues
 *
 * Pulse via Reanimated `withRepeat(withTiming, -1, true)` + cleanup
 * `cancelAnimation` au unmount pour éviter les fuites worklet (Pitfall 1).
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

// ─── Constantes module — cosmétiques inline (per RESEARCH Open Question 1) ──
const PULSE_DURATION = 1200;
const PULSE_MAX = 1.06;
const DEFAULT_SIZE = 72;
const WAX = '#c0392b';
// (WAX_DARK / WAX_HIGHLIGHT non utilisés ici — RN ne supporte pas le radial-gradient
//  CSS de la mockup ; on simule via boxShadow inset + couleur unie WAX.)
const PAPER = '#f5ecd5';
const INK = '#442434';

interface WaxSealProps {
  /** Nombre d'éléments — affiche le badge si >= 2 */
  count: number;
  /** Lettre centrale du cachet (default 'M') */
  initial?: string;
  /** Activation du pulse (default true) */
  pulse?: boolean;
  /** Diamètre en px (default 72) — scale width/height/borderRadius/fontSize */
  size?: number;
}

function WaxSealBase({
  count,
  initial = 'M',
  pulse = true,
  size = DEFAULT_SIZE,
}: WaxSealProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (pulse) {
      scale.value = withRepeat(
        withTiming(PULSE_MAX, { duration: PULSE_DURATION }),
        -1,
        true,
      );
    } else {
      scale.value = 1;
    }
    return () => {
      // Cleanup worklet au unmount (Pitfall 1)
      cancelAnimation(scale);
      scale.value = 1;
    };
  }, [pulse, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.sealBase,
          animatedStyle,
          { backgroundColor: WAX },
        ]}
      >
        <Text style={[styles.initial, { fontSize: size * 0.45 }]}>
          {initial}
        </Text>
      </Animated.View>
      {count >= 2 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Conteneur permettant de positionner le badge en absolute hors du seal animé
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealBase: {
    alignItems: 'center',
    justifyContent: 'center',
    // Ombre cire (multi-couche simulant la profondeur)
    shadowColor: '#8b2518',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  initial: {
    color: 'rgba(255,220,200,0.95)',
    fontWeight: '700',
    fontFamily: 'Georgia',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: INK,
    borderWidth: 2,
    borderColor: PAPER,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

export const WaxSeal = React.memo(WaxSealBase);
