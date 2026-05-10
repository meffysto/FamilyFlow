/**
 * SunriseReport.tsx — Modal "rapport du matin"
 *
 * Affiche les ressources produites par les batiments pendant l'absence (8h+).
 * Bonus x1.5 si la veille le profil avait complete 3+ taches.
 * Tap n'importe ou pour fermer.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Pressable, Modal } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm, FarmDarkPalette, useFarmTheme, type FarmPalette } from '../../constants/farm-theme';

type Styles = ReturnType<typeof makeStyles>;

// ── Constantes ──────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

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

// ── Sous-composant : auvent rayé ────────────────

function AwningStripes({ farm, styles }: { farm: FarmPalette; styles: Styles }) {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? farm.awningGreen : farm.awningCream },
            ]}
          />
        ))}
      </View>
      <View style={styles.awningShadow} />
      <View style={styles.awningScallop}>
        {Array.from({ length: farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningScallopDot,
              { backgroundColor: i % 2 === 0 ? farm.awningGreen : farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Sous-composant : bouton farm 3D ─────────────

function FarmButton({ label, enabled, onPress, farm, styles }: { label: string; enabled: boolean; onPress?: () => void; farm: FarmPalette; styles: Styles }) {
  const pressedY = useSharedValue(0);

  const bg = enabled ? farm.greenBtn : farm.parchmentDark;
  const shadow = enabled ? farm.greenBtnShadow : '#D0CBC3';
  const highlight = enabled ? farm.greenBtnHighlight : farm.parchment;

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressedY.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressedY.value / 4,
  }));

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      onPressIn={() => {
        if (enabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          pressedY.value = withSpring(4, SPRING_CONFIG);
        }
      }}
      onPressOut={() => { pressedY.value = withSpring(0, SPRING_CONFIG); }}
      style={styles.btnFullWidth}
    >
      <Animated.View style={[styles.farmBtnShadow, { backgroundColor: shadow }, shadowStyle]} />
      <Animated.View style={[styles.farmBtnBody, { backgroundColor: bg }, btnStyle]}>
        <View style={[styles.farmBtnGloss, { backgroundColor: highlight }]} />
        <Text style={[styles.farmBtnText, { color: enabled ? '#FFFFFF' : farm.brownTextSub, textShadowColor: enabled ? 'rgba(0,0,0,0.25)' : 'transparent' }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
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
  const { farm, isDark } = useFarmTheme();
  const styles = isDark ? stylesDark : stylesLight;
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
            <View style={styles.woodFrame}>
              <View style={styles.woodFrameInner}>
                <AwningStripes farm={farm} styles={styles} />

                <View style={styles.parchment}>
                  {/* Soleil */}
                  <Animated.Text entering={FadeInUp.delay(200).duration(400)} style={styles.sunEmoji}>
                    {'☀️'}
                  </Animated.Text>

                  {/* Salutation */}
                  <Animated.Text entering={FadeIn.delay(300).duration(300)} style={styles.greeting}>
                    {`Bonjour ${profileName} !`}
                  </Animated.Text>

                  <Animated.Text entering={FadeIn.delay(450).duration(300)} style={styles.subtitle}>
                    {'Pendant ton absence, ta ferme a accumulé :'}
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
                      {`${totalCollected} ressource${totalCollected > 1 ? 's' : ''} à récuperer`}
                    </Text>
                  </Animated.View>

                  {/* Deal du jour au village */}
                  {dailyDeal && (
                    <Animated.View
                      entering={FadeIn.delay(600 + filteredResources.length * 150 + 350).duration(400)}
                      style={styles.dealBox}
                    >
                      <Text style={styles.dealTitle}>{'🏷️ Deal du jour au village'}</Text>
                      <Text style={styles.dealItem}>
                        {`${dailyDeal.emoji} ${dailyDeal.label}`}
                      </Text>
                      <Text style={styles.dealPrice}>
                        {`${dailyDeal.discountedPrice} 🍃 `}
                        <Text style={styles.dealPriceOriginal}>{`au lieu de ${dailyDeal.originalPrice}`}</Text>
                      </Text>
                    </Animated.View>
                  )}

                  {/* Bouton continuer */}
                  <Animated.View
                    entering={FadeIn.delay(600 + filteredResources.length * 150 + 500).duration(300)}
                    style={styles.actionSection}
                  >
                    <FarmButton label="Continuer" enabled={true} onPress={onDismiss} farm={farm} styles={styles} />
                  </Animated.View>
                </View>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────

const makeStyles = (farm: FarmPalette) => StyleSheet.create({
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

  // ── Cadre bois ──
  woodFrame: {
    borderRadius: Radius['2xl'],
    backgroundColor: farm.woodDark,
    padding: 5,
    ...Shadows.xl,
  },
  woodFrameInner: {
    borderRadius: Radius['2xl'] - 3,
    overflow: 'hidden',
    backgroundColor: farm.woodLight,
  },

  // ── Auvent ──
  awning: {
    height: 36,
    overflow: 'hidden',
  },
  awningStripes: {
    flexDirection: 'row',
    height: 28,
  },
  awningStripe: {
    flex: 1,
  },
  awningShadow: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  awningScallop: {
    flexDirection: 'row',
    height: 8,
    marginTop: -4,
  },
  awningScallopDot: {
    flex: 1,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  // ── Parchemin ──
  parchment: {
    backgroundColor: farm.parchmentDark,
    paddingVertical: Spacing['2xl'],
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
    color: farm.brownText,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: farm.brownTextSub,
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
    backgroundColor: farm.parchment,
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
    color: farm.brownText,
  },
  resourceQty: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: farm.brownText,
  },
  bonusBox: {
    backgroundColor: farm.awningGreen + '33',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  bonusText: {
    fontSize: FontSize.sm,
    color: farm.awningGreen,
  },
  bonusHighlight: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: farm.awningGreen,
  },
  totalBox: {
    marginBottom: Spacing.xl,
  },
  totalText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: farm.brownText,
  },
  dealBox: {
    width: '100%',
    backgroundColor: farm.gold + '22',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: farm.gold,
  },
  dealTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: farm.brownText,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  dealItem: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: farm.brownText,
    marginBottom: 2,
  },
  dealPrice: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: farm.goldText,
  },
  dealPriceOriginal: {
    fontWeight: FontWeight.normal,
    color: farm.goldText,
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },

  // ── Action ──
  actionSection: {
    width: '100%',
    paddingTop: Spacing.sm,
  },

  // ── Bouton farm 3D ──
  btnFullWidth: {
    width: '100%',
  },
  farmBtnShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
    borderRadius: Radius.lg,
  },
  farmBtnBody: {
    height: 44,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  farmBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    opacity: 0.35,
  },
  farmBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

const stylesLight = makeStyles(Farm);
const stylesDark = makeStyles(FarmDarkPalette);
