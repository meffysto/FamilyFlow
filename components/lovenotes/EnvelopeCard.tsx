/**
 * EnvelopeCard.tsx — Carte enveloppe hero (Phase 35 Plan 02)
 *
 * Posée pinned en tête du dashboard quand au moins une love note est à
 * révéler ou non lue. Composition :
 *  - 2 enveloppes empilées en fond si count >= 2 (rotation -3° / +2°,
 *    opacity 0.55 / 0.70)
 *  - rabat triangulaire SVG (EnvelopeFlap)
 *  - cachet cire central animé (WaxSeal, count badge >= 2)
 *  - étiquette "POUR / {recipientName}" en bas à gauche
 *  - tilt -1.5° "posée sur la table"
 *
 * Pitfall 8 : le Pressable est EXTERNE au transform rotate pour ne pas
 * faire dériver la hit-box ; hitSlop généreux.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '../ui/PressableScale';
import { WaxSeal } from './WaxSeal';
import { EnvelopeFlap } from './EnvelopeFlap';
import { Spacing } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';

// ─── Constantes module — cosmétiques inline ────────────────────────────────
// Palette kraft — papier recyclé brun chaud, grain naturel sans rayures
const PAPER_HIGHLIGHT = '#d4b388';
const PAPER_MID = '#b89163';
const PAPER_DARK = '#96703f';
const PAPER_EDGE = '#6f4e2a';
const VIGNETTE = 'rgba(52,28,12,0.45)';
const INK = '#2a1708';
const INK_SOFT = '#5a3820';
const STACK_BACK_1 = '#a0814f';
const STACK_BACK_2 = '#8a6b3e';
const TILT_DEG = '-1.5deg';
const SEAL_SIZE = 72;
// Timbre cœur — rouge carmin vintage desature
const STAMP_RED = '#a8384a';
const STAMP_RED_DARK = '#7a1e2a';
const STAMP_BORDER = 'rgba(248,236,206,0.7)';
const POSTMARK_INK = 'rgba(61,36,24,0.45)';
const POSTMARK_TEXT = 'rgba(61,36,24,0.7)';

/** Format postmark date `·DD·MM·` */
function formatPostmarkDate(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `·${dd}·${mm}·`;
}

interface EnvelopeCardProps {
  count: number;
  recipientName: string;
  onPress: () => void;
}

function EnvelopeCardBase({ count, recipientName, onPress }: EnvelopeCardProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const flapHeight = size.height * 0.55;

  return (
    <View style={styles.wrapper}>
      <PressableScale
        onPress={onPress}
        style={styles.pressable}
        scaleValue={0.97}
      >
        {/* Stack effect derrière (si >= 2 notes) */}
        {count >= 2 && (
          <>
            <View
              style={[
                styles.stackBack,
                {
                  backgroundColor: STACK_BACK_1,
                  top: 4,
                  transform: [{ rotate: '2deg' }],
                  opacity: 0.7,
                },
              ]}
            />
            <View
              style={[
                styles.stackBack,
                {
                  backgroundColor: STACK_BACK_2,
                  top: 8,
                  transform: [{ rotate: '-3deg' }],
                  opacity: 0.55,
                },
              ]}
            />
          </>
        )}

        {/* Enveloppe principale tournée -1.5° */}
        <View
          style={[styles.envelope, { transform: [{ rotate: TILT_DEG }] }]}
          onLayout={handleLayout}
        >
          {/* Gradient papier kraft (brun chaud, clair haut-gauche → foncé bas-droit) */}
          <LinearGradient
            colors={[PAPER_HIGHLIGHT, PAPER_MID, PAPER_DARK]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Vignette bas-droit — papier foncé sur les bords */}
          <LinearGradient
            colors={['transparent', VIGNETTE]}
            start={{ x: 0.25, y: 0.3 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.7 }]}
            pointerEvents="none"
          />
          {/* Highlight diffus haut-gauche — lumière sur le papier kraft */}
          <LinearGradient
            colors={['rgba(255,230,190,0.22)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 0.6 }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.9 }]}
            pointerEvents="none"
          />
          {/* Rabat SVG (rendu seulement quand on connaît la taille) */}
          {size.width > 0 && (
            <View
              style={[
                styles.flapContainer,
                { width: size.width, height: flapHeight },
              ]}
            >
              <EnvelopeFlap width={size.width} height={flapHeight} />
            </View>
          )}

          {/* Cachet cire centré (au croisement du rabat et de la base) */}
          <View
            style={[
              styles.sealContainer,
              {
                left: '50%',
                top: '55%',
                marginLeft: -SEAL_SIZE / 2,
                marginTop: -SEAL_SIZE / 2,
              },
            ]}
          >
            <WaxSeal count={count} size={SEAL_SIZE} />
          </View>

          {/* Étiquette destinataire (bas-gauche) */}
          <View style={styles.recipient}>
            <Text style={styles.recipientLabel}>POUR</Text>
            <Text style={styles.recipientName} numberOfLines={1}>
              {recipientName}
            </Text>
          </View>

          {/* Timbre cœur (haut-droit, légère rotation) */}
          <View style={styles.stamp}>
            <Text style={styles.stampEmoji}>💕</Text>
          </View>

          {/* Postmark circulaire "POUR TOI" + date (gauche du timbre) */}
          <View style={styles.postmark}>
            <Text style={styles.postmarkText}>POUR</Text>
            <Text style={styles.postmarkText}>TOI</Text>
            <Text style={styles.postmarkDate}>{formatPostmarkDate()}</Text>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  pressable: {
    // Pressable EXTERNE au rotate (Pitfall 8) — hit-box reste rectangulaire
    position: 'relative',
  },
  envelope: {
    width: '100%',
    aspectRatio: 2 / 1.15,
    backgroundColor: PAPER_MID,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 16,
    borderWidth: 1,
    borderColor: PAPER_EDGE,
  },
  flapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 2,
  },
  sealContainer: {
    position: 'absolute',
    width: SEAL_SIZE,
    height: SEAL_SIZE,
    zIndex: 3,
  },
  recipient: {
    position: 'absolute',
    left: Spacing.xl,
    bottom: Spacing.xl,
    zIndex: 2,
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
    // Police calligraphique iOS (fallback italique sur Android)
    fontFamily: Platform.select({ ios: 'Snell Roundhand', default: undefined }),
    fontSize: 32,
    color: INK,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 34,
    letterSpacing: 0.3,
  },
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
    zIndex: 2,
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
    zIndex: 2,
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
  stackBack: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: '100%',
    borderRadius: 8,
    // Ombre moyenne sur les enveloppes empilées (renforcée pour relief stack)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
});

export const EnvelopeCard = React.memo(EnvelopeCardBase);
