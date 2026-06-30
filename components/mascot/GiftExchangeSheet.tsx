/**
 * GiftExchangeSheet.tsx — FAM-49 : échanger ses feuilles 🍃 contre un cadeau €.
 *
 * Esthétique "cozy farm game" miroir de PlotUpgradeSheet (cadre bois, auvent rayé,
 * fond parchemin, bouton 3D glossy). L'enfant convertit ses feuilles en crédit
 * cadeau ; la demande entre dans la file d'attente parentale.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm, FarmDarkPalette, useFarmTheme, type FarmPalette } from '../../constants/farm-theme';

type Styles = ReturnType<typeof makeStyles>;

// ── Constantes ───────────────────────────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Sous-composant : auvent rayé ─────────────────────────────────────────────

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

// ── Sous-composant : bouton farm 3D ──────────────────────────────────────────

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

// ── Props ────────────────────────────────────────────────────────────────────

interface GiftExchangeSheetProps {
  visible: boolean;
  onClose: () => void;
  coins: number;
  leavesCost: number;
  euroValue: number;
  onConfirm: () => Promise<void>;
  onMessage?: (text: string, type?: 'success' | 'error') => void;
}

// ── Composant principal ──────────────────────────────────────────────────────

export function GiftExchangeSheet({
  visible,
  onClose,
  coins,
  leavesCost,
  euroValue,
  onConfirm,
  onMessage,
}: GiftExchangeSheetProps) {
  const { farm, isDark } = useFarmTheme();
  const styles = isDark ? stylesDark : stylesLight;
  const canAfford = coins >= leavesCost;
  const missing = Math.max(0, leavesCost - coins);

  const handleConfirm = useCallback(async () => {
    try {
      await onConfirm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onMessage?.('Cadeau demandé ! En attente de validation 🎁', 'success');
      onClose();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg =
        e?.message === 'insufficient_coins' ? 'Feuilles insuffisantes'
          : e?.message === 'disabled' ? 'Échange désactivé'
            : 'Échange impossible';
      onMessage?.(msg, 'error');
    }
  }, [onConfirm, onMessage, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

        {/* Panneau farm game */}
        <View style={styles.woodFrame}>
          <View style={styles.woodFrameInner}>
            <AwningStripes farm={farm} styles={styles} />

            <View style={styles.parchment}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Titre */}
              <Animated.View
                entering={FadeIn.springify().damping(14).stiffness(200)}
                style={styles.farmTitle}
              >
                <Text style={styles.farmTitleText}>Échanger mes feuilles</Text>
              </Animated.View>

              {/* Conversion 🍃 → € */}
              <Animated.View
                entering={FadeIn.delay(80).springify().damping(12).stiffness(180)}
                style={styles.conversionRow}
              >
                <Text style={styles.conversionText}>
                  {leavesCost.toLocaleString('fr-FR')} 🍃
                </Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={[styles.conversionText, { color: farm.awningGreen }]}>
                  {euroValue.toLocaleString('fr-FR')} €
                </Text>
              </Animated.View>

              {/* Bouton échanger */}
              <Animated.View
                entering={FadeIn.delay(160).springify().damping(12).stiffness(180)}
                style={styles.actionSection}
              >
                <FarmButton
                  label={`Échanger — ${leavesCost.toLocaleString('fr-FR')} 🍃`}
                  enabled={canAfford}
                  onPress={handleConfirm}
                  farm={farm}
                  styles={styles}
                />
                {!canAfford && (
                  <Text style={styles.insufficientText}>
                    Il te manque {missing.toLocaleString('fr-FR')} 🍃
                  </Text>
                )}

                <Text style={styles.balanceText}>
                  Solde : {coins.toLocaleString('fr-FR')} 🍃
                </Text>
              </Animated.View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (farm: FarmPalette) => StyleSheet.create({
  // ── Overlay ──
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // ── Cadre bois ──
  woodFrame: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    borderRadius: Radius['2xl'],
    backgroundColor: farm.woodDark,
    padding: 5,
    ...Shadows.xl,
    maxHeight: '82%',
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
    paddingBottom: Spacing['3xl'],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: farm.woodHighlight,
  },

  // ── Titre ──
  farmTitle: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  farmTitleText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: farm.brownText,
  },

  // ── Conversion ──
  conversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  conversionText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: farm.brownText,
  },
  arrow: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: farm.brownTextSub,
  },

  // ── Actions ──
  actionSection: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
  },
  insufficientText: {
    fontSize: FontSize.caption,
    color: '#B44',
  },
  balanceText: {
    fontSize: FontSize.caption,
    color: farm.brownTextSub,
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
