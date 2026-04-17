/**
 * EnvelopeUnfoldModal.tsx — Animation unfold full-screen (Phase 36 Plan 04)
 *
 * Modal full-screen transparent. Au mount (visible=true) :
 *  1. Seal jump (200ms) — withSequence scale 1 → 1.4 → 0 (disparaît)
 *  2. Rabat unfold (800ms) — rotateX 0° → 175° (PAS de perspective — strict CLAUDE.md)
 *  3. Body reveal (400ms) — opacity 0 → 1
 *  4. Callback final : Haptics.notificationAsync(Success) + onUnfoldComplete()
 *
 * Parent (écran lovenotes.tsx) :
 *  - Sur unfoldComplete → updateLoveNoteStatus(sourceFile, 'read') — patch différé
 *    pour éviter flicker (Pitfall 6).
 *
 * Pitfall 5 : requestAnimationFrame wrap pour garantir le premier frame posé.
 */

import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring,
  runOnJS, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { EnvelopeFlap } from './EnvelopeFlap';
import { WaxSeal } from './WaxSeal';

const SPRING_SEAL_JUMP = { damping: 8, stiffness: 200 } as const;
const UNFOLD_DURATION_MS = 800;
const SEAL_JUMP_MS = 200;
const CONTENT_REVEAL_MS = 400;

// Couleurs identitaires enveloppe — hors thème (cf Phase 35 EnvelopeFlap/WaxSeal)
// Le papier crème + encre brune sont des constantes de design propres au domaine
// Love Notes (lettre manuscrite). NE PAS remplacer par useThemeColors() — perdrait
// l'identité visuelle voulue. Si refonte théming nécessaire en Phase 37+, déplacer
// ces tokens dans constants/colors.ts namespace `envelope.*`.
const PAPER = '#faf4e4';
const INK = '#3d2a1a';

interface EnvelopeUnfoldModalProps {
  visible: boolean;
  fromName: string;
  body: string;
  onClose: () => void;
  /** Appelé à la fin de la séquence (avant que le parent patche 'read'). */
  onUnfoldComplete: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const ENVELOPE_W = Math.min(SCREEN_WIDTH - Spacing['2xl'] * 2, 340);
const ENVELOPE_H = Math.round(ENVELOPE_W / (2 / 1.15));
const FLAP_H = Math.round(ENVELOPE_H * 0.55);

function triggerHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function EnvelopeUnfoldModal({
  visible, fromName, body, onClose, onUnfoldComplete,
}: EnvelopeUnfoldModalProps) {
  const flapRotate = useSharedValue(0);
  const sealScale = useSharedValue(1);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      // Reset quand invisible pour prochaine ouverture
      flapRotate.value = 0;
      sealScale.value = 1;
      contentOpacity.value = 0;
      return;
    }
    // Pitfall 5 : déférer d'un frame pour garantir render initial posé
    const raf = requestAnimationFrame(() => {
      sealScale.value = withSequence(
        withTiming(1.4, { duration: SEAL_JUMP_MS }),
        withSpring(0, SPRING_SEAL_JUMP),
      );
      flapRotate.value = withTiming(175, {
        duration: UNFOLD_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      contentOpacity.value = withTiming(
        1,
        { duration: CONTENT_REVEAL_MS, easing: Easing.linear },
        (finished) => {
          if (finished) {
            runOnJS(triggerHaptic)();
            runOnJS(onUnfoldComplete)();
          }
        },
      );
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const flapStyle = useAnimatedStyle(() => ({
    transform: [{ rotateX: `${flapRotate.value}deg` }],
    // Pas de perspective — conforme strict CLAUDE.md (feel 2D)
    transformOrigin: 'top',
  }));
  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sealScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.envelope, { width: ENVELOPE_W, height: ENVELOPE_H, backgroundColor: PAPER }]} pointerEvents="box-none">
          {/* Rabat animé — top */}
          <Animated.View style={[styles.flap, { width: ENVELOPE_W, height: FLAP_H }, flapStyle]}>
            <EnvelopeFlap width={ENVELOPE_W} height={FLAP_H} />
          </Animated.View>
          {/* Cachet animé — centré */}
          <Animated.View style={[styles.sealSlot, sealStyle]} pointerEvents="none">
            <WaxSeal size={72} count={0} pulse={false} initial="💌" />
          </Animated.View>
          {/* Contenu révélé */}
          <Animated.View style={[styles.content, contentStyle]}>
            <ScrollView contentContainerStyle={{ padding: Spacing.xl }}>
              <Text style={[styles.from, { color: INK }]}>De {fromName}</Text>
              <Text style={[styles.body, { color: INK }]}>{body}</Text>
            </ScrollView>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Backdrop modal standard — pattern universel iOS/Android, pas un token de thème
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelope: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  flap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 3,
  },
  sealSlot: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: -36,
    marginTop: -36,
    zIndex: 4,
  },
  content: {
    flex: 1,
    paddingTop: Spacing['2xl'],
  },
  from: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold as any,
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
});
