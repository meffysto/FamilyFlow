/**
 * GiftReceiptModal.tsx — Modal animee de reception de cadeaux
 *
 * Anime un paquet cadeau avec spring bounce, confetti, haptic feedback,
 * et affiche le message de l'expediteur.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '../../contexts/ThemeContext';
import { AvatarIcon } from '../ui/AvatarIcon';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import type { GiftEntry } from '../../lib/mascot/gift-engine';

let ConfettiCannon: any = null;
try {
  ConfettiCannon = require('react-native-confetti-cannon').default;
} catch {
  // Optional dependency
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface GiftReceiptModalProps {
  visible: boolean;
  gifts: GiftEntry[];
  onDone: () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function GiftReceiptModal({ visible, gifts, onDone }: GiftReceiptModalProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();

  const confettiRef = useRef<any>(null);

  // Valeurs d'animation pour le paquet
  const translateY = useSharedValue(-300);
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const packageScale = useSharedValue(1);

  const triggerConfettiAndHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    confettiRef.current?.start();
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Reinitialiser
    translateY.value = -300;
    scale.value = 0.3;
    opacity.value = 0;
    packageScale.value = 1;

    // Animation d'entree : le paquet tombe avec spring bounce
    translateY.value = withSpring(0, { damping: 12, stiffness: 180 });
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 300 });

    // Apres l'atterrissage, pulse + confetti + haptic
    packageScale.value = withDelay(
      400,
      withSequence(
        withSpring(1.2, { damping: 8, stiffness: 200 }, (finished) => {
          if (finished) {
            runOnJS(triggerConfettiAndHaptic)();
          }
        }),
        withSpring(1, { damping: 12, stiffness: 180 }),
      ),
    );
  }, [visible]);

  const packageAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value * packageScale.value },
    ],
    opacity: opacity.value,
  }));

  if (gifts.length === 0) return null;

  // Premier cadeau pour le message principal
  const firstGift = gifts[0];
  const totalGifts = gifts.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDone}
    >
      <View style={styles.overlay}>
        {/* Paquet cadeau anime */}
        <Animated.View style={[styles.packageContainer, packageAnimStyle]}>
          <Text style={styles.packageEmoji}>{'🎁'}</Text>
        </Animated.View>

        {/* Carte de contenu */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card },
            Shadows.xl,
            { opacity: opacity },
          ]}
        >
          <Text style={[styles.title, { color: primary }]}>
            {t('gamification:gift_received_title')}
          </Text>

          {gifts.map((gift, idx) => (
            <View key={idx} style={[styles.giftRow, idx > 0 && { marginTop: Spacing.sm }]}>
              <Text style={[styles.giftText, { color: colors.text }]}>
                {t('gamification:gift_received_message', {
                  sender: gift.sender_name,
                  quantity: gift.quantity,
                  item: gift.item_id,
                })}
              </Text>
            </View>
          ))}

          {totalGifts > 1 && (
            <Text style={[styles.totalText, { color: colors.textMuted }]}>
              {totalGifts}{' cadeaux recus !'}
            </Text>
          )}

          {/* Expediteur */}
          <View style={[styles.senderRow, { backgroundColor: tint }]}>
            <AvatarIcon name={firstGift.sender_avatar} color={primary} size={32} />
            <Text style={[styles.senderName, { color: primary }]} numberOfLines={1}>
              {firstGift.sender_name}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: primary }]}
            onPress={onDone}
            activeOpacity={0.7}
          >
            <Text style={[styles.doneBtnText, { color: colors.onPrimary }]}>
              {'Super !'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Confetti */}
        {ConfettiCannon && (
          <ConfettiCannon
            ref={confettiRef}
            count={50}
            origin={{ x: -10, y: 0 }}
            autoStart={false}
            fadeOut
            explosionSpeed={300}
            fallSpeed={3000}
          />
        )}
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  packageContainer: {
    marginBottom: Spacing.lg,
  },
  packageEmoji: {
    fontSize: 64,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  giftRow: {
    width: '100%',
  },
  giftText: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: FontSize.body * 1.5,
  },
  totalText: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    gap: Spacing.sm,
  },
  senderAvatar: {
    fontSize: 20,
  },
  senderName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    maxWidth: 180,
  },
  doneBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
  },
  doneBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
