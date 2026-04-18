/**
 * EnvelopeUnfoldModal.tsx — Animation unfold full-screen (Phase 36 Plan 04 + v2 visuel)
 *
 * Visuel aligné sur EnvelopeCard du dashboard : papier kraft + gradient,
 * vignette, timbre cœur, postmark circulaire, cachet de cire avec initiale
 * calligraphiée, destinataire en Snell Roundhand.
 *
 * Modal full-screen transparent. Au mount (visible=true) :
 *  1. Entree : scale 0.85 -> 1 (spring)
 *  2. Floating continu (translateY/rotateZ léger)
 *  3. Cachet : wiggle -> saut 1.4x + spin 360° -> envol -260px + fade
 *  4. Rabat unfold — rotateX 0° -> 175° (PAS de perspective — CLAUDE.md)
 *  5. Lettre cream : slide-up + fade + haptic Success
 */

import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring,
  withDelay, withRepeat, runOnJS, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { EnvelopeFlap } from './EnvelopeFlap';
import { WaxSeal } from './WaxSeal';

// ─── Timings ───────────────────────────────────────────────────────────────
const SPRING_ENTRANCE = { damping: 9, stiffness: 140 } as const;
const SPRING_FLAP = { damping: 10, stiffness: 90 } as const;
const SPRING_CONTENT = { damping: 14, stiffness: 120 } as const;
const SEAL_WIGGLE_MS = 90;
const SEAL_JUMP_MS = 180;
const CONTENT_REVEAL_MS = 450;
const FLOAT_MS = 3200;

// ─── Palette kraft (alignée EnvelopeCard) ──────────────────────────────────
const PAPER_HIGHLIGHT = '#d4b388';
const PAPER_MID = '#b89163';
const PAPER_DARK = '#96703f';
const PAPER_EDGE = '#6f4e2a';
const VIGNETTE = 'rgba(52,28,12,0.45)';
const INK = '#2a1708';
const INK_SOFT = '#5a3820';
// Timbre
const STAMP_RED = '#a8384a';
const STAMP_RED_DARK = '#7a1e2a';
const STAMP_BORDER = 'rgba(248,236,206,0.7)';
const POSTMARK_INK = 'rgba(61,36,24,0.45)';
const POSTMARK_TEXT = 'rgba(61,36,24,0.7)';
// Lettre interieure (cream, contraste kraft)
const LETTER_LIGHT = '#fdfaf1';
const LETTER_MID = '#f5ecd5';
const LETTER_INK = '#3d2418';

interface EnvelopeUnfoldModalProps {
  visible: boolean;
  fromName: string;
  /** Nom du destinataire (affiché en "POUR / {toName}" calligraphié). */
  toName?: string;
  body: string;
  onClose: () => void;
  /** Appelé à la fin de la séquence (avant que le parent patche 'read'). */
  onUnfoldComplete: () => void;
}

const SEAL_SIZE = 72;

function triggerHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function formatPostmarkDate(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `·${dd}·${mm}·`;
}

export function EnvelopeUnfoldModal({
  visible, fromName, toName, body, onClose, onUnfoldComplete,
}: EnvelopeUnfoldModalProps) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const ENVELOPE_W = Math.min(SCREEN_WIDTH - Spacing['2xl'] * 2, 340);
  const ENVELOPE_H = Math.round(ENVELOPE_W / (2 / 1.15));
  const FLAP_H = Math.round(ENVELOPE_H * 0.55);
  // Anim shared values
  const envelopeScale = useSharedValue(0.85);
  const envelopeFloat = useSharedValue(0);
  const flapRotate = useSharedValue(0);
  const sealScale = useSharedValue(1);
  const sealRotate = useSharedValue(0);
  const sealTranslateY = useSharedValue(0);
  const sealOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const contentTranslate = useSharedValue(24);

  useEffect(() => {
    if (!visible) {
      envelopeScale.value = 0.85;
      envelopeFloat.value = 0;
      flapRotate.value = 0;
      sealScale.value = 1;
      sealRotate.value = 0;
      sealTranslateY.value = 0;
      sealOpacity.value = 1;
      contentOpacity.value = 0;
      contentTranslate.value = 24;
      return;
    }
    const raf = requestAnimationFrame(() => {
      envelopeScale.value = withSpring(1, SPRING_ENTRANCE);
      envelopeFloat.value = withDelay(
        500,
        withRepeat(
          withSequence(
            withTiming(1, { duration: FLOAT_MS, easing: Easing.inOut(Easing.sin) }),
            withTiming(-1, { duration: FLOAT_MS, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
      sealRotate.value = withDelay(
        200,
        withSequence(
          withTiming(-12, { duration: SEAL_WIGGLE_MS }),
          withTiming(12, { duration: SEAL_WIGGLE_MS }),
          withTiming(-8, { duration: SEAL_WIGGLE_MS }),
          withTiming(0, { duration: SEAL_WIGGLE_MS }),
          withTiming(360, { duration: SEAL_JUMP_MS + 100, easing: Easing.out(Easing.cubic) }),
        ),
      );
      sealScale.value = withDelay(
        200 + SEAL_WIGGLE_MS * 4,
        withSequence(
          withTiming(1.4, { duration: SEAL_JUMP_MS, easing: Easing.out(Easing.back(2)) }),
          withTiming(1.1, { duration: 600, easing: Easing.out(Easing.quad) }),
        ),
      );
      sealTranslateY.value = withDelay(
        200 + SEAL_WIGGLE_MS * 4,
        withSequence(
          withTiming(-20, { duration: SEAL_JUMP_MS, easing: Easing.out(Easing.back(2)) }),
          withTiming(-260, { duration: 700, easing: Easing.out(Easing.cubic) }),
        ),
      );
      sealOpacity.value = withDelay(
        200 + SEAL_WIGGLE_MS * 4 + SEAL_JUMP_MS + 300,
        withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }),
      );
      flapRotate.value = withDelay(
        200 + SEAL_WIGGLE_MS * 4 + SEAL_JUMP_MS,
        withSpring(175, SPRING_FLAP),
      );
      contentTranslate.value = withDelay(
        200 + SEAL_WIGGLE_MS * 4 + SEAL_JUMP_MS + 200,
        withSpring(0, SPRING_CONTENT),
      );
      contentOpacity.value = withDelay(
        200 + SEAL_WIGGLE_MS * 4 + SEAL_JUMP_MS + 200,
        withTiming(
          1,
          { duration: CONTENT_REVEAL_MS, easing: Easing.out(Easing.quad) },
          (finished) => {
            if (finished) {
              runOnJS(triggerHaptic)();
              runOnJS(onUnfoldComplete)();
            }
          },
        ),
      );
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const envelopeStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: envelopeScale.value },
      { translateY: envelopeFloat.value * 4 },
      { rotateZ: `${-1.5 + envelopeFloat.value * 0.8}deg` },
    ],
  }));
  const flapStyle = useAnimatedStyle(() => ({
    transform: [{ rotateX: `${flapRotate.value}deg` }],
    transformOrigin: 'top',
  }));
  const sealStyle = useAnimatedStyle(() => ({
    opacity: sealOpacity.value,
    transform: [
      { translateY: sealTranslateY.value },
      { rotateZ: `${sealRotate.value}deg` },
      { scale: sealScale.value },
    ],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslate.value }],
  }));
  // Décors exterieur (timbre, postmark, destinataire) s'estompent quand la lettre arrive
  const exteriorStyle = useAnimatedStyle(() => ({
    opacity: 1 - contentOpacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.envelope, { width: ENVELOPE_W, height: ENVELOPE_H }, envelopeStyle]}
          pointerEvents="box-none"
        >
          {/* Gradient papier kraft */}
          <LinearGradient
            colors={[PAPER_HIGHLIGHT, PAPER_MID, PAPER_DARK]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Vignette bas-droit */}
          <LinearGradient
            colors={['transparent', VIGNETTE]}
            start={{ x: 0.25, y: 0.3 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.7 }]}
            pointerEvents="none"
          />
          {/* Highlight haut-gauche */}
          <LinearGradient
            colors={['rgba(255,230,190,0.22)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 0.6 }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.9 }]}
            pointerEvents="none"
          />

          {/* Lettre interieure (cream) — revelee apres unfold */}
          <Animated.View style={[styles.letter, contentStyle]}>
            <LinearGradient
              colors={[LETTER_LIGHT, LETTER_MID]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <ScrollView contentContainerStyle={[styles.letterInner, { paddingTop: FLAP_H + Spacing.md }]}>
              <Text style={styles.letterFrom}>De {fromName}</Text>
              <Text style={styles.letterBody}>{body}</Text>
            </ScrollView>
          </Animated.View>

          {/* Rabat animé — top (kraft cohérent) */}
          <Animated.View style={[styles.flap, { width: ENVELOPE_W, height: FLAP_H }, flapStyle]}>
            <EnvelopeFlap
              width={ENVELOPE_W}
              height={FLAP_H}
              colors={[PAPER_HIGHLIGHT, PAPER_MID, PAPER_DARK]}
            />
          </Animated.View>

          {/* Timbre cœur haut-droit */}
          <Animated.View style={[styles.stamp, exteriorStyle]}>
            <Text style={styles.stampEmoji}>💕</Text>
          </Animated.View>

          {/* Postmark "POUR TOI · DD · MM ·" */}
          <Animated.View style={[styles.postmark, exteriorStyle]}>
            <Text style={styles.postmarkText}>POUR</Text>
            <Text style={styles.postmarkText}>TOI</Text>
            <Text style={styles.postmarkDate}>{formatPostmarkDate()}</Text>
          </Animated.View>

          {/* Destinataire bas-gauche (calligraphié) */}
          {toName && (
            <Animated.View style={[styles.recipient, exteriorStyle]}>
              <Text style={styles.recipientLabel}>POUR</Text>
              <Text style={styles.recipientName} numberOfLines={1}>
                {toName}
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Cachet de cire avec initiale calligraphique — hors overflow pour s'envoler */}
        <Animated.View style={[styles.sealSlot, { marginTop: -SEAL_SIZE / 2 + ENVELOPE_H * 0.05 }, sealStyle]} pointerEvents="none">
          <WaxSeal
            size={SEAL_SIZE}
            count={0}
            pulse={false}
            initial={(fromName?.[0] ?? 'M').toUpperCase()}
          />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelope: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: PAPER_EDGE,
    // Relief marqué façon carte posée
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 36,
    elevation: 18,
  },
  flap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 3,
  },
  sealSlot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -SEAL_SIZE / 2,
    zIndex: 10,
  },
  // ─── Lettre intérieure (cream) ─────────────────────────────
  letter: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    overflow: 'hidden',
  },
  letterInner: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  letterFrom: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold as any,
    color: INK_SOFT,
    marginBottom: Spacing.md,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  letterBody: {
    fontSize: 17,
    lineHeight: 24,
    color: LETTER_INK,
    fontStyle: 'italic',
  },
  // ─── Timbre cœur ───────────────────────────────────────────
  stamp: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 46,
    height: 52,
    backgroundColor: STAMP_RED,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: STAMP_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '4deg' }],
    zIndex: 4,
    shadowColor: STAMP_RED_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  stampEmoji: {
    fontSize: 22,
  },
  postmark: {
    position: 'absolute',
    top: 28,
    right: 68,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: POSTMARK_INK,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    zIndex: 4,
  },
  postmarkText: {
    fontSize: 8,
    color: POSTMARK_TEXT,
    letterSpacing: 0.5,
    lineHeight: 10,
    fontWeight: '700',
  },
  postmarkDate: {
    fontSize: 8,
    color: POSTMARK_TEXT,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  recipient: {
    position: 'absolute',
    left: Spacing.xl,
    bottom: Spacing.xl,
    zIndex: 4,
  },
  recipientLabel: {
    fontSize: FontSize.micro,
    color: INK_SOFT,
    opacity: 0.7,
    letterSpacing: 2,
    marginBottom: 2,
    fontWeight: '500',
  },
  recipientName: {
    fontFamily: Platform.select({ ios: 'Snell Roundhand', default: undefined }),
    fontSize: 32,
    color: INK,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 34,
    letterSpacing: 0.3,
  },
});
