/**
 * SunriseReport.tsx — Modal "rapport du matin"
 *
 * Affiche les ressources produites par les batiments pendant l'absence (8h+).
 * Bonus x1.5 si la veille le profil avait complete 3+ taches.
 * Tap n'importe ou pour fermer.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Modal } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

// ── Types ──────────────────────────────────────

export interface SunriseResource {
  emoji: string;
  label: string;
  quantity: number;
}

export interface SunriseDailyDeal {
  label: string;
  emoji: string;
  discountedPrice: number;
  originalPrice: number;
}

interface SunriseReportProps {
  visible: boolean;
  profileName: string;
  resources: SunriseResource[];
  totalCollected: number;
  yesterdayTasks: number;
  hasBonus: boolean;
  dailyDeal?: SunriseDailyDeal | null;
  onDismiss: () => void;
}

// ── Composant ──────────────────────────────────

export function SunriseReport({
  visible,
  profileName,
  resources,
  totalCollected,
  yesterdayTasks,
  hasBonus,
  dailyDeal,
  onDismiss,
}: SunriseReportProps) {
  const filteredResources = useMemo(
    () => resources.filter(r => r.quantity > 0),
    [resources],
  );

  if (totalCollected === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.overlay}>
          <Animated.View entering={ZoomIn.duration(400).springify().damping(16).stiffness(120)} style={styles.cardWrapper}>
            <LinearGradient
              colors={['#FFF7ED', '#FEF3C7', '#FFFBEB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              {/* Soleil */}
              <Animated.Text entering={FadeInUp.delay(200).duration(400)} style={styles.sunEmoji}>
                {'☀️'}
              </Animated.Text>

              {/* Salutation */}
              <Animated.Text entering={FadeIn.delay(300).duration(300)} style={styles.greeting}>
                {`Bonjour ${profileName} !`}
              </Animated.Text>

              <Animated.Text entering={FadeIn.delay(450).duration(300)} style={styles.subtitle}>
                {'Pendant ton absence, ta ferme a accumul\u00E9\u00A0:'}
              </Animated.Text>

              {/* Ressources */}
              <View style={styles.resourceList}>
                {filteredResources.map((res, idx) => (
                  <Animated.View
                    key={res.label}
                    entering={FadeInLeft.delay(600 + idx * 150).duration(300)}
                    style={styles.resourceRow}
                  >
                    <Text style={styles.resourceEmoji}>{res.emoji}</Text>
                    <Text style={styles.resourceLabel}>{res.label}</Text>
                    <Text style={styles.resourceQty}>{`x${res.quantity}`}</Text>
                  </Animated.View>
                ))}
              </View>

              {/* Total en attente */}
              <Animated.View
                entering={FadeIn.delay(600 + filteredResources.length * 150 + 300).duration(400)}
                style={styles.totalBox}
              >
                <Text style={styles.totalText}>
                  {`${totalCollected} ressource${totalCollected > 1 ? 's' : ''} \u00E0 r\u00E9cuperer`}
                </Text>
              </Animated.View>

              {/* Deal du jour au village */}
              {dailyDeal && (
                <Animated.View
                  entering={FadeIn.delay(600 + filteredResources.length * 150 + 350).duration(400)}
                  style={styles.dealBox}
                >
                  <Text style={styles.dealTitle}>{'\uD83C\uDFF7\uFE0F Deal du jour au village'}</Text>
                  <Text style={styles.dealItem}>
                    {`${dailyDeal.emoji} ${dailyDeal.label}`}
                  </Text>
                  <Text style={styles.dealPrice}>
                    {`${dailyDeal.discountedPrice} \uD83C\uDF43 `}
                    <Text style={styles.dealPriceOriginal}>{`au lieu de ${dailyDeal.originalPrice}`}</Text>
                  </Text>
                </Animated.View>
              )}

              {/* Hint fermer */}
              <Animated.Text
                entering={FadeIn.delay(600 + filteredResources.length * 150 + 500).duration(300)}
                style={styles.dismissHint}
              >
                {'Touche pour continuer'}
              </Animated.Text>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 340,
    ...Shadows.lg,
  },
  card: {
    borderRadius: Radius.xl,
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
  },
  sunEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  greeting: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
    color: '#92400E',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: '#A16207',
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  resourceList: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
  },
  resourceEmoji: {
    fontSize: 24,
    width: 36,
  },
  resourceLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: '#78350F',
  },
  resourceQty: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#92400E',
  },
  bonusBox: {
    backgroundColor: 'rgba(74,222,128,0.2)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  bonusText: {
    fontSize: FontSize.sm,
    color: '#065F46',
  },
  bonusHighlight: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: '#059669',
  },
  totalBox: {
    marginBottom: Spacing.xl,
  },
  totalText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: '#92400E',
  },
  dealBox: {
    width: '100%',
    backgroundColor: 'rgba(217,119,6,0.12)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.35)',
  },
  dealTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: '#92400E',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  dealItem: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: '#78350F',
    marginBottom: 2,
  },
  dealPrice: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#B45309',
  },
  dealPriceOriginal: {
    fontWeight: FontWeight.normal,
    color: '#B45309',
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  dismissHint: {
    fontSize: FontSize.caption,
    color: '#B45309',
    opacity: 0.6,
  },
});
