/**
 * PlotUpgradeSheet.tsx — Bottom sheet d'amélioration de parcelle
 *
 * Esthétique "cozy farm game" : cadre bois, auvent rayé, fond parchemin,
 * bouton glossy vert, sprites hero. Même design que BuildingDetailSheet.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  MAX_PLOT_LEVEL,
  getPlotLevel,
  getPlotUpgradeCost,
} from '../../lib/mascot/farm-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm, FarmDarkPalette, useFarmTheme, type FarmPalette } from '../../constants/farm-theme';

type Styles = ReturnType<typeof makeStyles>;

// ── Constantes ───────────────────────────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

const DIRT_SPRITES: Record<number, number> = {
  1: require('../../assets/garden/ground/dirt_patch.png'),
  2: require('../../assets/garden/ground/dirt_enriched.png'),
  3: require('../../assets/garden/ground/dirt_fertile.png'),
  4: require('../../assets/garden/ground/dirt_golden.png'),
  5: require('../../assets/garden/ground/dirt_crystal.png'),
};

const LEVEL_NAMES: Record<number, string> = {
  1: 'Terre simple',
  2: 'Terre enrichie',
  3: 'Terre fertile',
  4: 'Terre dorée',
  5: 'Terre cristalline',
};

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'Parcelle de base',
  2: 'Pousse -1 tâche par stade',
  3: 'Pousse -1 tâche + chance doré ×2',
  4: 'Pousse -2 tâches + chance doré ×3',
  5: 'Pousse -2 tâches + double récolte garantie',
};

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

interface PlotUpgradeSheetProps {
  visible: boolean;
  onClose: () => void;
  plotIndex: number;
  plotLevels?: number[];
  coins: number;
  onUpgrade: (plotIndex: number) => Promise<boolean>;
  onMessage?: (text: string, type?: 'success' | 'error') => void;
}

// ── Composant principal ──────────────────────────────────────────────────────

export function PlotUpgradeSheet({
  visible,
  onClose,
  plotIndex,
  plotLevels,
  coins,
  onUpgrade,
  onMessage,
}: PlotUpgradeSheetProps) {
  const { farm, isDark } = useFarmTheme();
  const styles = isDark ? stylesDark : stylesLight;
  const currentLevel = getPlotLevel(plotLevels, plotIndex);
  const isMax = currentLevel >= MAX_PLOT_LEVEL;
  const upgradeCost = getPlotUpgradeCost(currentLevel);
  const canAfford = upgradeCost !== null && coins >= upgradeCost;
  const nextLevel = Math.min(currentLevel + 1, MAX_PLOT_LEVEL);

  const handleUpgrade = useCallback(async () => {
    if (!upgradeCost) return;
    try {
      await onUpgrade(plotIndex);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onMessage?.(`Parcelle ${plotIndex + 1} améliorée au niveau ${nextLevel} !`, 'success');
      onClose();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      onMessage?.(e.message ?? 'Erreur', 'error');
    }
  }, [upgradeCost, nextLevel, plotIndex, onUpgrade, onMessage, onClose]);

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
                <Text style={styles.farmTitleText}>
                  Parcelle {plotIndex + 1}
                </Text>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>
                    Niv. {currentLevel}
                  </Text>
                </View>
              </Animated.View>

              {/* Sprites avant → après */}
              <Animated.View
                entering={FadeIn.delay(80).springify().damping(12).stiffness(180)}
                style={styles.previewRow}
              >
                <View style={styles.previewCard}>
                  <Image source={DIRT_SPRITES[currentLevel] ?? DIRT_SPRITES[1]} style={styles.spriteImg} />
                  <Text style={styles.spriteName}>{LEVEL_NAMES[currentLevel]}</Text>
                </View>

                {!isMax && (
                  <>
                    <Text style={styles.arrow}>→</Text>
                    <View style={styles.previewCard}>
                      <Image source={DIRT_SPRITES[nextLevel] ?? DIRT_SPRITES[1]} style={styles.spriteImg} />
                      <Text style={[styles.spriteName, { color: farm.awningGreen }]}>{LEVEL_NAMES[nextLevel]}</Text>
                    </View>
                  </>
                )}
              </Animated.View>

              {/* Barre de progression */}
              <Animated.View
                entering={FadeIn.delay(160).springify().damping(12).stiffness(180)}
                style={styles.progressSection}
              >
                <View style={styles.progressTrack}>
                  {Array.from({ length: MAX_PLOT_LEVEL }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.progressSegment,
                        {
                          backgroundColor: i < currentLevel ? farm.progressGold : farm.progressBg,
                          borderColor: i < currentLevel ? farm.gold : farm.parchmentDark,
                        },
                      ]}
                    />
                  ))}
                </View>
              </Animated.View>

              {/* Info bonus */}
              <Animated.View
                entering={FadeIn.delay(240).springify().damping(12).stiffness(180)}
                style={styles.infoSection}
              >
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Bonus actuel</Text>
                  <Text style={styles.infoValue}>{LEVEL_DESCRIPTIONS[currentLevel]}</Text>
                </View>
                {!isMax && (
                  <View style={[styles.infoRow, styles.nextBonusRow]}>
                    <Text style={[styles.infoLabel, { color: farm.awningGreen }]}>Prochain</Text>
                    <Text style={[styles.infoValue, { color: farm.awningGreen }]}>{LEVEL_DESCRIPTIONS[nextLevel]}</Text>
                  </View>
                )}
              </Animated.View>

              {/* Bouton / Max */}
              <Animated.View
                entering={FadeIn.delay(320).springify().damping(12).stiffness(180)}
                style={styles.actionSection}
              >
                {isMax ? (
                  <View style={styles.maxBadge}>
                    <Text style={styles.maxText}>Niveau maximum ✨</Text>
                  </View>
                ) : (
                  <>
                    <FarmButton
                      label={`Améliorer — ${upgradeCost?.toLocaleString('fr-FR')} 🍃`}
                      enabled={canAfford}
                      onPress={handleUpgrade}
                      farm={farm}
                      styles={styles}
                    />
                    {!canAfford && (
                      <Text style={styles.insufficientText}>
                        Il te manque {((upgradeCost ?? 0) - coins).toLocaleString('fr-FR')} 🍃
                      </Text>
                    )}
                  </>
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
  levelBadge: {
    backgroundColor: farm.gold + '33',
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: farm.gold,
  },
  levelBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: farm.goldText,
  },

  // ── Preview sprites ──
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  previewCard: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  spriteImg: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: farm.woodHighlight,
  },
  spriteName: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: farm.brownText,
  },
  arrow: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: farm.brownTextSub,
  },

  // ── Barre progression ──
  progressSection: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.sm,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },

  // ── Info bonus ──
  infoSection: {
    marginHorizontal: Spacing['2xl'],
    backgroundColor: farm.parchment,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  infoRow: {
    gap: 2,
  },
  nextBonusRow: {
    borderTopWidth: 1,
    borderTopColor: farm.parchmentDark,
    paddingTop: Spacing.md,
  },
  infoLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: farm.brownTextSub,
  },
  infoValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: farm.brownText,
  },

  // ── Actions ──
  actionSection: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  maxBadge: {
    backgroundColor: farm.gold + '22',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: farm.gold,
  },
  maxText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: farm.goldText,
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
