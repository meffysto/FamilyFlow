// components/village/TradeReceiptModal.tsx
// Modal animée de réception d'un colis inter-familles (Q49).
// Clone simplifié de GiftReceiptModal — spring bounce + confetti + haptic.
// Utilise react-native-reanimated (per CLAUDE.md — pas RN Animated).

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
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

let ConfettiCannon: any = null;
try {
  ConfettiCannon = require('react-native-confetti-cannon').default;
} catch {
  // Dépendance optionnelle
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface TradeReceiptModalProps {
  visible: boolean;
  itemEmoji: string;
  itemLabel: string;
  quantity: number;
  onDone: () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function TradeReceiptModal({
  visible,
  itemEmoji,
  itemLabel,
  quantity,
  onDone,
}: TradeReceiptModalProps) {
  const { primary, tint, colors } = useThemeColors();

  const confettiRef = useRef<any>(null);

  // Valeurs d'animation (pattern identique GiftReceiptModal)
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

    // Réinitialiser
    translateY.value = -300;
    scale.value = 0.3;
    opacity.value = 0;
    packageScale.value = 1;

    // Animation d'entrée : le colis tombe avec spring bounce
    translateY.value = withSpring(0, { damping: 12, stiffness: 180 });
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 300 });

    // Après atterrissage : pulse + confetti + haptic
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDone}
    >
      <View style={styles.overlay}>
        {/* Colis animé */}
        <Animated.View style={[styles.packageContainer, packageAnimStyle]}>
          <Text style={styles.packageEmoji}>{'📦'}</Text>
        </Animated.View>

        {/* Carte contenu */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card },
            Shadows.xl,
            { opacity: opacity },
          ]}
        >
          <Text style={[styles.title, { color: primary }]}>
            Colis reçu !
          </Text>

          <View style={styles.itemRow}>
            <Text style={styles.itemEmoji}>{itemEmoji}</Text>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemLabel, { color: colors.text }]}>{itemLabel}</Text>
              <Text style={[styles.itemQty, { color: primary }]}>
                +{quantity} ajouté{quantity > 1 ? 's' : ''} à votre inventaire
              </Text>
            </View>
          </View>

          <View style={[styles.tagRow, { backgroundColor: tint }]}>
            <Text style={[styles.tagText, { color: primary }]}>
              ⚓ Via le Port du village
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: primary }]}
            onPress={onDone}
            activeOpacity={0.7}
          >
            <Text style={[styles.doneBtnText, { color: '#FFFFFF' }]}>
              Super !
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2xl'],
    width: '100%',
    paddingVertical: Spacing.md,
  },
  itemEmoji: {
    fontSize: 48,
  },
  itemInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  itemLabel: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
  },
  itemQty: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  tagRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
  },
  tagText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
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
