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
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

// ─── Constantes module — palette cire rouge réaliste ───────────────────────
const PULSE_DURATION = 1200;
const PULSE_MAX = 1.06;
const DEFAULT_SIZE = 72;
// Radial-gradient CSS impossible en RN → on simule via LinearGradient diagonal
// + ring foncé en overlay pour l'effet "cire coulée"
const WAX_LIGHT = '#e84c3d';    // highlight haut-gauche
const WAX_MID = '#b3261b';      // base
const WAX_DARK = '#6e1208';     // ombre bas-droit
const WAX_RING = 'rgba(30,3,0,0.55)'; // anneau externe cire écrasée
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
          { overflow: 'hidden' },
        ]}
      >
        {/* Base cire : gradient diagonal light -> dark */}
        <LinearGradient
          colors={[WAX_LIGHT, WAX_MID, WAX_DARK]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.25, y: 0.2 }}
          end={{ x: 0.85, y: 0.9 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Highlight tache lumière haut-gauche (cire fondue) */}
        <View
          style={[
            styles.highlight,
            {
              width: size * 0.45,
              height: size * 0.3,
              borderRadius: size * 0.3,
              top: size * 0.12,
              left: size * 0.18,
            },
          ]}
        />
        {/* Ombre profonde bas-droit (creux cire écrasée) */}
        <View
          style={[
            styles.innerShadow,
            {
              width: size * 0.5,
              height: size * 0.35,
              borderRadius: size * 0.3,
              bottom: size * 0.08,
              right: size * 0.1,
            },
          ]}
        />
        {/* Anneau externe cire écrasée autour du tampon */}
        <View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: size * 0.04,
            },
          ]}
        />
        {/* Initiale embossée */}
        <Text
          style={[
            styles.initial,
            {
              fontSize: size * 0.55,
              lineHeight: size * 0.62,
              textShadowOffset: { width: 0, height: size * 0.025 },
              textShadowRadius: size * 0.05,
            },
          ]}
        >
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
    // Ombre cire — profondeur marquée, feel fondu sur papier
    shadowColor: '#4a0a02',
    shadowOffset: { width: 2, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 10,
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,200,180,0.45)',
    transform: [{ rotate: '-25deg' }],
  },
  innerShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(40,5,0,0.35)',
    transform: [{ rotate: '20deg' }],
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: WAX_RING,
  },
  initial: {
    // Police serif italique type cachet royal
    fontFamily: Platform.select({
      ios: 'Snell Roundhand',
      default: undefined,
    }),
    color: 'rgba(255,230,210,0.95)',
    fontWeight: '700',
    fontStyle: 'italic',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
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
