/**
 * LootBoxOpener.tsx — Animated loot box opening UI
 *
 * Phases:
 * 1. Idle — big chest emoji, tap to open
 * 2. Spinning — chest rotates + shakes (Animated)
 * 3. Reveal — reward card appears with confetti
 * 4. Done — reward shown, close button
 *
 * Mythique tier gets extra shake, longer delay, golden confetti, screen flash
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LootBox } from '../lib/types';
import { RARITY_COLORS, RARITY_LABELS, RARITY_EMOJIS } from '../constants/rewards';

// react-native-confetti-cannon
let ConfettiCannon: any = null;
try {
  ConfettiCannon = require('react-native-confetti-cannon').default;
} catch {
  // Optional dependency
}

interface LootBoxOpenerProps {
  visible: boolean;
  profileName: string;
  profileAvatar: string;
  lootCount: number;
  onOpen: () => Promise<LootBox | null>;
  onClose: () => void;
}

type Phase = 'idle' | 'spinning' | 'reveal' | 'done';

export function LootBoxOpener({
  visible,
  profileName,
  profileAvatar,
  lootCount,
  onOpen,
  onClose,
}: LootBoxOpenerProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<LootBox | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const confettiRef = useRef<any>(null);
  const confettiRef2 = useRef<any>(null);

  const isMythique = result?.rarity === 'mythique';
  const isLegendaire = result?.rarity === 'légendaire';
  const isHighTier = isMythique || isLegendaire;

  const handleOpen = useCallback(async () => {
    if (phase !== 'idle' || lootCount <= 0) return;

    setPhase('spinning');

    // Haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Base spin duration — longer for high tiers (determined after open)
    const spinDuration = 1200;

    // Spin + shake animation
    Animated.parallel([
      Animated.timing(spinAnim, {
        toValue: 4,
        duration: spinDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Intensive shake
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
        ]),
        { iterations: 10 }
      ),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.4, duration: 400, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 300, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 250, useNativeDriver: true }),
      ]),
    ]).start();

    // Open the box
    await new Promise((r) => setTimeout(r, 700));
    const box = await onOpen();
    await new Promise((r) => setTimeout(r, 600));

    if (box) {
      setResult(box);

      const boxIsMythique = box.rarity === 'mythique';
      const boxIsLegendaire = box.rarity === 'légendaire';

      if (boxIsMythique) {
        // Extra dramatic delay + haptic burst for mythique
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await new Promise((r) => setTimeout(r, 400));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await new Promise((r) => setTimeout(r, 300));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        // Screen flash
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();

        // Pulsing glow
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          ])
        ).start();
      } else if (boxIsLegendaire) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await new Promise((r) => setTimeout(r, 200));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      setPhase('reveal');

      // Haptic burst for reveal
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);

      // Fire confetti
      if (confettiRef.current) {
        confettiRef.current.start();
      }
      // Second confetti for mythique
      if (boxIsMythique && confettiRef2.current) {
        setTimeout(() => confettiRef2.current?.start(), 500);
      }
    } else {
      setPhase('idle');
    }
  }, [phase, lootCount, onOpen, spinAnim, shakeAnim, scaleAnim, flashAnim, glowAnim]);

  const handleClose = useCallback(() => {
    setPhase('idle');
    setResult(null);
    spinAnim.setValue(0);
    shakeAnim.setValue(0);
    scaleAnim.setValue(1);
    flashAnim.setValue(0);
    glowAnim.setValue(0);
    onClose();
  }, [onClose, spinAnim, shakeAnim, scaleAnim, flashAnim, glowAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: ['0deg', '90deg', '180deg', '270deg', '360deg'],
  });

  const rarityColor = result ? RARITY_COLORS[result.rarity] : '#7C3AED';
  const rarityEmoji = result ? RARITY_EMOJIS[result.rarity] : '';

  // Background color shifts for high rarity
  const bgColor = result?.rarity === 'mythique'
    ? '#2D0A0A'
    : result?.rarity === 'légendaire'
    ? '#1F1500'
    : '#1F1035';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Screen flash for mythique */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#EF4444',
              opacity: flashAnim,
              zIndex: 100,
              pointerEvents: 'none',
            },
          ]}
        />

        {/* Confetti */}
        {ConfettiCannon && (
          <>
            <ConfettiCannon
              ref={confettiRef}
              count={isMythique ? 200 : isLegendaire ? 150 : 120}
              origin={{ x: -10, y: 0 }}
              autoStart={false}
              fadeOut
              colors={isMythique ? ['#EF4444', '#FFD700', '#FF6B6B', '#FFFFFF', '#FFA500'] : undefined}
            />
            {isMythique && (
              <ConfettiCannon
                ref={confettiRef2}
                count={150}
                origin={{ x: 400, y: 0 }}
                autoStart={false}
                fadeOut
                colors={['#FFD700', '#EF4444', '#FF4500', '#FFFFFF']}
              />
            )}
          </>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.profileInfo}>
            {profileAvatar} {profileName}
          </Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {phase === 'idle' && (
            <>
              <Text style={styles.title}>Loot Box</Text>
              <Text style={styles.subtitle}>{lootCount} disponible{lootCount > 1 ? 's' : ''}</Text>
              <TouchableOpacity onPress={handleOpen} style={styles.chestButton} activeOpacity={0.8}>
                <Text style={styles.chestEmoji}>🎁</Text>
                <Text style={styles.openText}>Appuyer pour ouvrir !</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'spinning' && (
            <View style={styles.spinContainer}>
              <Animated.Text
                style={[
                  styles.chestEmoji,
                  {
                    transform: [
                      { rotate: spin },
                      { translateX: shakeAnim },
                      { scale: scaleAnim },
                    ],
                  },
                ]}
              >
                🎁
              </Animated.Text>
              <Text style={styles.spinText}>Ouverture en cours...</Text>
            </View>
          )}

          {(phase === 'reveal' || phase === 'done') && result && (
            <View style={styles.revealContainer}>
              {/* Rarity badge */}
              <View
                style={[
                  styles.rarityBadge,
                  { backgroundColor: rarityColor },
                  result.rarity === 'mythique' && styles.mythiqueBadge,
                ]}
              >
                <Text style={styles.rarityText}>
                  {rarityEmoji} {RARITY_LABELS[result.rarity]}
                </Text>
              </View>

              {/* Reward emoji with glow for mythique */}
              {result.rarity === 'mythique' ? (
                <Animated.Text
                  style={[
                    styles.rewardEmoji,
                    styles.rewardEmojiLarge,
                    {
                      opacity: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                      transform: [
                        {
                          scale: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1.1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {result.emoji}
                </Animated.Text>
              ) : (
                <Text style={styles.rewardEmoji}>{result.emoji}</Text>
              )}

              <Text style={[
                styles.rewardText,
                result.rarity === 'mythique' && styles.rewardTextMythique,
              ]}>
                {result.reward}
              </Text>

              {result.bonusPoints > 0 && (
                <View style={[styles.bonusPill, result.rarity === 'mythique' && { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.bonusText}>+{result.bonusPoints} pts bonus !</Text>
                </View>
              )}

              {result.requiresParent && (
                <View style={styles.parentNote}>
                  <Text style={styles.parentNoteText}>
                    👨‍👩‍👧 À valider par un parent !
                  </Text>
                </View>
              )}

              {result.multiplier && result.multiplier > 1 && (
                <View style={[styles.multiplierNote, result.rarity === 'mythique' && { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <Text style={styles.multiplierText}>
                    ⚡ Multiplicateur ×{result.multiplier} activé pour {result.multiplierTasks ?? 10} tâches !
                  </Text>
                </View>
              )}

              {result.rewardType === 'double_loot' && (
                <View style={[styles.multiplierNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <Text style={styles.multiplierText}>
                    🎁🎁 +2 loot boxes ajoutées !
                  </Text>
                </View>
              )}

              {result.rewardType === 'vacation' && (
                <View style={[styles.multiplierNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <Text style={styles.multiplierText}>
                    🏖️ 2 jours sans tâches activés !
                  </Text>
                </View>
              )}

              {result.rewardType === 'crown' && (
                <View style={[styles.multiplierNote, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <Text style={styles.multiplierText}>
                    👑 Tu choisis le menu toute la semaine !
                  </Text>
                </View>
              )}

              {result.rewardType === 'skip_all' && (
                <View style={[styles.multiplierNote, { backgroundColor: 'rgba(245, 158, 11, 0.3)' }]}>
                  <Text style={styles.multiplierText}>
                    🧹✨ Toutes les tâches de demain sont annulées !
                  </Text>
                </View>
              )}

              {result.rewardType === 'family_bonus' && (
                <View style={[styles.multiplierNote, { backgroundColor: 'rgba(245, 158, 11, 0.3)' }]}>
                  <Text style={styles.multiplierText}>
                    🌈✨ Toute la famille reçoit +{result.bonusPoints} pts !
                  </Text>
                </View>
              )}

              <TouchableOpacity style={[styles.closeRewardBtn, result.rarity === 'mythique' && { backgroundColor: '#EF4444' }]} onPress={handleClose}>
                <Text style={styles.closeRewardText}>
                  {result.rarity === 'mythique' ? '🔥 Incroyable ! Fermer' : 'Super ! Fermer'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F1035',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  profileInfo: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  closeBtn: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#A78BFA',
    marginBottom: 48,
  },
  chestButton: {
    alignItems: 'center',
    gap: 16,
  },
  chestEmoji: {
    fontSize: 100,
  },
  openText: {
    fontSize: 18,
    color: '#C4B5FD',
    fontWeight: '600',
  },
  spinContainer: {
    alignItems: 'center',
    gap: 24,
  },
  spinText: {
    fontSize: 18,
    color: '#C4B5FD',
  },
  revealContainer: {
    alignItems: 'center',
    gap: 16,
  },
  rarityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  mythiqueBadge: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },
  rarityText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rewardEmoji: {
    fontSize: 80,
  },
  rewardEmojiLarge: {
    fontSize: 100,
  },
  rewardText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 280,
  },
  rewardTextMythique: {
    fontSize: 26,
    fontWeight: '900',
    textShadowColor: '#EF4444',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  bonusPill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bonusText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  parentNote: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  parentNoteText: {
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '600',
  },
  multiplierNote: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  multiplierText: {
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeRewardBtn: {
    marginTop: 24,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  closeRewardText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
