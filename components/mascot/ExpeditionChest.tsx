/**
 * ExpeditionChest.tsx — Coffre animé tap-to-open pour les résultats d'expéditions
 * Phase 33 — Système d'expéditions à risque
 *
 * Overlay fullscreen transparent avec :
 * - Coffre fermé : "Appuie pour ouvrir !"
 * - Tap : spring scale 1→1.3→1 + haptic selon outcome
 * - Ouvert : reveal animé (opacity) + outcome badge + loot + stars si rare
 * - Bouton "Fermer le coffre"
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Farm } from '../../constants/farm-theme';
import type { ExpeditionOutcome } from '../../lib/types';
import type { ExpeditionLoot } from '../../lib/mascot/expedition-engine';

// ── Constantes module ─────────────────────────────────────────────────────────

const SPRING_CHEST = { damping: 8, stiffness: 160 } as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  outcome: ExpeditionOutcome;
  loot?: ExpeditionLoot;
  missionName: string;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function outcomeTitle(outcome: ExpeditionOutcome): string {
  if (outcome === 'success') return 'Expédition réussie !';
  if (outcome === 'partial') return 'Retour partiel';
  if (outcome === 'failure') return 'Expédition échouée — mise perdue.';
  return 'Découverte rare !';
}

function outcomeColor(outcome: ExpeditionOutcome, colors: any): string {
  if (outcome === 'success') return colors.success;
  if (outcome === 'partial') return colors.warning;
  if (outcome === 'failure') return colors.error;
  return Farm.gold;
}

function outcomeEmoji(outcome: ExpeditionOutcome): string {
  if (outcome === 'success') return '✅';
  if (outcome === 'partial') return '↩️';
  if (outcome === 'failure') return '💀';
  return '⭐';
}

// ── Composant étoile (rare) ───────────────────────────────────────────────────

interface StarProps {
  delay: number;
  offsetX: number;
}

function Star({ delay, offsetX }: StarProps) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }));
    translateY.value = withDelay(delay, withTiming(-40, { duration: 600, easing: Easing.out(Easing.ease) }));
  }, [delay, offsetX, opacity, translateY]);

  const starStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { translateX: offsetX }],
  }));

  return (
    <Animated.View style={[styles.star, starStyle]}>
      <Text style={styles.starText}>{'⭐'}</Text>
    </Animated.View>
  );
}

// ── ExpeditionChest ───────────────────────────────────────────────────────────

export function ExpeditionChest({ visible, outcome, loot, missionName, onClose }: Props) {
  const { colors } = useThemeColors();
  const [opened, setOpened] = useState(false);

  // Reset quand le coffre devient visible
  useEffect(() => {
    if (visible) {
      setOpened(false);
      chestScale.value = 1;
      revealOpacity.value = 0;
      starsKey.value += 1;
    }
  }, [visible]);

  // Animations
  const chestScale = useSharedValue(1);
  const revealOpacity = useSharedValue(0);
  const starsKey = useSharedValue(0);

  const chestAnim = useAnimatedStyle(() => ({
    transform: [{ scale: chestScale.value }],
  }));

  const revealAnim = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
  }));

  const handleChestTap = async () => {
    if (opened) return;

    // Animation coffre
    chestScale.value = withSpring(1.3, SPRING_CHEST, () => {
      chestScale.value = withSpring(1, SPRING_CHEST);
    });

    // Haptics selon outcome
    if (outcome === 'rare_discovery') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 200);
    } else if (outcome === 'failure') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Reveal du contenu
    setOpened(true);
    revealOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
  };

  const outColor = outcomeColor(outcome, colors);
  const isRare = outcome === 'rare_discovery';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.bg + '99' }]}>
        <View style={styles.content}>
          {/* Nom de la mission */}
          <Text style={[styles.missionName, { color: colors.textMuted }]}>
            {missionName}
          </Text>

          {/* Coffre — tapable si pas encore ouvert */}
          <TouchableOpacity
            onPress={handleChestTap}
            disabled={opened}
            activeOpacity={0.85}
            style={styles.chestTouchable}
          >
            <View style={styles.chestContainer}>
              <Animated.View style={chestAnim}>
                <MaterialCommunityIcons
                  name="treasure-chest"
                  size={96}
                  color={opened ? (isRare ? Farm.gold : Farm.woodMed) : Farm.woodDark}
                />
              </Animated.View>

              {/* Étoiles rare — entourent le coffre */}
              {opened && isRare && (
                <View style={styles.starsContainer} pointerEvents="none">
                  <Star delay={0} offsetX={-30} />
                  <Star delay={80} offsetX={30} />
                  <Star delay={160} offsetX={-15} />
                  <Star delay={240} offsetX={15} />
                </View>
              )}
            </View>

            {/* Prompt avant ouverture */}
            {!opened && (
              <Text style={[styles.promptText, { color: colors.textMuted }]}>
                {'Appuie pour ouvrir !'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Contenu révélé */}
          <Animated.View style={[styles.reveal, revealAnim]}>
            {/* Badge outcome */}
            <View
              style={[
                styles.outcomeBadge,
                {
                  backgroundColor: isRare ? Farm.parchmentDark : outColor + '22',
                  borderColor: outColor,
                },
              ]}
            >
              <Text style={styles.outcomeEmoji}>{outcomeEmoji(outcome)}</Text>
              <Text style={[styles.outcomeTitle, { color: isRare ? Farm.goldText : outColor }]}>
                {outcomeTitle(outcome)}
              </Text>
            </View>

            {/* Loot si disponible */}
            {loot && (
              <View style={[styles.lootCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                <Text style={styles.lootEmoji}>{loot.emoji}</Text>
                <View>
                  <Text style={[styles.lootLabel, { color: colors.text }]}>{loot.label}</Text>
                  <Text style={[styles.lootType, { color: colors.textMuted }]}>
                    {loot.type === 'inhabitant' ? 'Habitant' : loot.type === 'seed' ? 'Graine' : 'Boost'}
                  </Text>
                </View>
              </View>
            )}

            {/* Bouton fermer */}
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: colors.borderLight, backgroundColor: colors.card }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.closeBtnText, { color: colors.text }]}>
                {'Fermer le coffre'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['4xl'],
  },
  content: {
    alignItems: 'center',
    gap: Spacing['2xl'],
    width: '100%',
  },
  missionName: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  chestTouchable: {
    alignItems: 'center',
    gap: Spacing.md,
    minWidth: 96,
    minHeight: 96,
  },
  chestContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  starsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
  },
  starText: {
    fontSize: 18,
  },
  promptText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.md,
  },
  reveal: {
    alignItems: 'center',
    gap: Spacing['2xl'],
    width: '100%',
  },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    width: '100%',
  },
  outcomeEmoji: {
    fontSize: FontSize.icon,
  },
  outcomeTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  lootCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2xl'],
    padding: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
    width: '100%',
  },
  lootEmoji: {
    fontSize: 36,
  },
  lootLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
  },
  lootType: {
    fontSize: FontSize.label,
    marginTop: Spacing.xs,
  },
  closeBtn: {
    height: 44,
    paddingHorizontal: Spacing['4xl'],
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    width: '100%',
  },
  closeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
