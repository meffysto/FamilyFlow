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
} from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import { WaxSeal } from './WaxSeal';
import { EnvelopeFlap } from './EnvelopeFlap';
import { Spacing } from '../../constants/spacing';
import { FontSize } from '../../constants/typography';

// ─── Constantes module — cosmétiques inline ────────────────────────────────
const PAPER = '#f5ecd5';
const PAPER_LIGHT = '#f8ecce';
const PAPER_MID = '#e8d5a8';
const PAPER_SHADOW = '#c9b98a';
const INK = '#442434';
const INK_SOFT = '#6b5040';
const STACK_BACK_1 = '#e8d5a8';
const STACK_BACK_2 = '#dfc898';
const TILT_DEG = '-1.5deg';
const SEAL_SIZE = 72;

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
    backgroundColor: PAPER_LIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    // Multi-couche shadow simulant l'inset paper
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: PAPER_SHADOW,
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
    fontSize: FontSize.titleLg,
    color: INK,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 24,
  },
  stackBack: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: '100%',
    borderRadius: 8,
    // Ombre légère sur les enveloppes empilées
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
});

export const EnvelopeCard = React.memo(EnvelopeCardBase);
