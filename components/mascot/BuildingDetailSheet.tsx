/**
 * BuildingDetailSheet.tsx — Panneau farm-game detail/collecte/amelioration
 *
 * Esthétique "cozy farm game" : cadre bois, auvent rayé, fond parchemin,
 * boutons glossy vert/bois, sprite hero, barre de progression chaleureuse.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  FadeIn,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { BUILDING_CATALOG, type PlacedBuilding } from '../../lib/mascot/types';
import { BUILDING_SPRITES } from '../../lib/mascot/building-sprites';
import { getPendingResources, getUpgradeCost, canUpgrade, getMinutesUntilNext, MAX_PENDING } from '../../lib/mascot/building-engine';
import type { TechBonuses } from '../../lib/mascot/tech-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

// ── Constantes farm game ────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Props ────────────────────────────────────────────────────────

interface BuildingDetailSheetProps {
  visible: boolean;
  building: PlacedBuilding;
  coins: number;
  techBonuses?: TechBonuses;
  isDamaged?: boolean;
  onCollect: (cellId: string) => void;
  onUpgrade: (cellId: string) => void;
  onRepairRoof?: () => void;
  onClose: () => void;
}

// ── Sous-composant : auvent rayé ────────────────────────────────

function AwningStripes() {
  return (
    <View style={styles.awning}>
      <View style={styles.awningStripes}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningStripe,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
      {/* Ombre sous l'auvent */}
      <View style={styles.awningShadow} />
      {/* Bord scalloped simulé — petits demi-cercles */}
      <View style={styles.awningScallop}>
        {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.awningScallopDot,
              { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Sous-composant : bouton farm 3D ─────────────────────────────

interface FarmButtonProps {
  label: string;
  enabled: boolean;
  variant: 'green' | 'wood' | 'orange';
  onPress?: () => void;
  fullWidth?: boolean;
}

function FarmButton({ label, enabled, variant, onPress, fullWidth }: FarmButtonProps) {
  const pressedY = useSharedValue(0);

  const btnColors = variant === 'green'
    ? { bg: Farm.greenBtn, shadow: Farm.greenBtnShadow, highlight: Farm.greenBtnHighlight }
    : variant === 'orange'
      ? { bg: Farm.orange, shadow: Farm.orangeShadow, highlight: '#F0A855' }
      : { bg: Farm.woodBtn, shadow: Farm.woodBtnShadow, highlight: Farm.woodBtnHighlight };

  const bg = enabled ? btnColors.bg : Farm.parchmentDark;
  const shadow = enabled ? btnColors.shadow : '#D0CBC3';
  const highlight = enabled ? btnColors.highlight : Farm.parchment;

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
      onPressOut={() => {
        pressedY.value = withSpring(0, SPRING_CONFIG);
      }}
      style={fullWidth ? styles.btnFullWidth : undefined}
    >
      {/* Ombre 3D */}
      <Animated.View
        style={[
          styles.farmBtnShadow,
          { backgroundColor: shadow },
          shadowStyle,
        ]}
      />
      {/* Corps du bouton */}
      <Animated.View style={[styles.farmBtnBody, { backgroundColor: bg }, btnStyle]}>
        {/* Reflet glossy en haut */}
        <View style={[styles.farmBtnGloss, { backgroundColor: highlight }]} />
        <Text style={[
          styles.farmBtnText,
          { color: enabled ? '#FFFFFF' : Farm.brownTextSub, textShadowColor: enabled ? 'rgba(0,0,0,0.25)' : 'transparent' },
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Sous-composant : barre de progression farm ──────────────────

interface ProgressBarProps {
  progressRatio: number;
  isFull: boolean;
  resourceEmoji: string;
  elapsedMinutes: number;
  totalMinutes: number;
}

function FarmProgressBar({ progressRatio, isFull, resourceEmoji, elapsedMinutes, totalMinutes }: ProgressBarProps) {
  const widthPercent = useSharedValue(0);
  const glowOpacity = useSharedValue(1);

  useEffect(() => {
    widthPercent.value = withTiming(progressRatio, { duration: 700, easing: Easing.out(Easing.quad) });
  }, [progressRatio]);

  useEffect(() => {
    if (isFull) {
      glowOpacity.value = withRepeat(
        withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      glowOpacity.value = 1;
    }
  }, [isFull]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(widthPercent.value * 100)}%` as any,
    opacity: glowOpacity.value,
  }));

  const hoursLeft = Math.floor((totalMinutes - elapsedMinutes) / 60);
  const minsLeft = Math.round((totalMinutes - elapsedMinutes) % 60);
  const timeLabel = hoursLeft > 0
    ? `${hoursLeft}h${minsLeft > 0 ? String(minsLeft).padStart(2, '0') : ''}`
    : `${minsLeft}min`;

  return (
    <View style={styles.progressContainer}>
      <Text style={styles.progressEmoji}>{resourceEmoji}</Text>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, fillStyle]}>
          <View style={styles.progressGloss} />
        </Animated.View>
      </View>
      <Text style={styles.progressTime}>{isFull ? '!' : timeLabel}</Text>
    </View>
  );
}

// ── Composant principal ──────────────────────────────────────────

export function BuildingDetailSheet({
  visible,
  building,
  coins,
  techBonuses,
  isDamaged,
  onCollect,
  onUpgrade,
  onRepairRoof,
  onClose,
}: BuildingDetailSheetProps) {
  const { t } = useTranslation();
  const { colors, primary } = useThemeColors();

  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return null;

  const tier = def.tiers[building.level - 1];
  const pendingCount = getPendingResources(building, new Date(), techBonuses);
  const effectiveMaxPending = Math.floor(MAX_PENDING * (techBonuses?.buildingCapacityMultiplier ?? 1));
  const isFull = pendingCount >= effectiveMaxPending;
  const upgradable = canUpgrade(building);
  const upgradeCost = getUpgradeCost(building);
  const nextTier = upgradable ? def.tiers[building.level] : null;
  const sprite = BUILDING_SPRITES[building.buildingId]?.[building.level];

  const resourceLabel = t(`farm.building.resource.${def.resourceType}`);
  const resourceEmoji = def.resourceType === 'oeuf' ? '🥚' : def.resourceType === 'lait' ? '🥛' : def.resourceType === 'miel' ? '🍯' : '🫓';
  const effectiveRateHours = (tier?.productionRateHours ?? 1) * (techBonuses?.productionIntervalMultiplier ?? 1.0);
  const minutesUntilNext = getMinutesUntilNext(building, new Date(), techBonuses);
  const totalMinutes = effectiveRateHours * 60;
  const elapsedMinutes = totalMinutes - minutesUntilNext;
  const progressRatio = minutesUntilNext === 0 ? 1 : Math.max(0, Math.min(1, elapsedMinutes / totalMinutes));

  const handleCollect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCollect(building.cellId);
  };

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
          {/* Bordure bois intérieure */}
          <View style={styles.woodFrameInner}>
            {/* Auvent rayé */}
            <AwningStripes />

            {/* Fond parchemin */}
            <View style={styles.parchment}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Titre du bâtiment — style farm */}
              <Animated.View
                entering={FadeIn.springify().damping(14).stiffness(200)}
                style={styles.farmTitle}
              >
                <Text style={styles.farmTitleText}>
                  {t(def.labelKey)}
                </Text>
                {/* Badge capacité */}
                <View style={styles.capacityBadge}>
                  <Text style={styles.capacityText}>
                    {t('farm.building.level', { level: building.level })}
                  </Text>
                </View>
              </Animated.View>

              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {/* Sprite hero */}
                <Animated.View
                  style={styles.spriteHero}
                  entering={FadeIn.springify().damping(12).stiffness(180)}
                >
                  {sprite ? (
                    <Image source={sprite} style={styles.spriteImg} />
                  ) : (
                    <Text style={styles.spriteEmoji}>{def.emoji}</Text>
                  )}
                </Animated.View>

                {/* Section info — resource + timer */}
                <Animated.View
                  entering={FadeIn.delay(100).springify().damping(12).stiffness(180)}
                  style={styles.infoSection}
                >
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{resourceLabel}</Text>
                    <Text style={styles.infoCapacity}>
                      {pendingCount}/{effectiveMaxPending}
                    </Text>
                  </View>

                  <FarmProgressBar
                    progressRatio={progressRatio}
                    isFull={isFull}
                    resourceEmoji={resourceEmoji}
                    elapsedMinutes={elapsedMinutes}
                    totalMinutes={totalMinutes}
                  />

                  {isFull && (
                    <Text style={styles.fullWarning}>
                      {t('farm.building.storageFull')}
                    </Text>
                  )}
                </Animated.View>

                {/* Boutons action — empilés */}
                <Animated.View
                  entering={FadeIn.delay(200).springify().damping(12).stiffness(180)}
                  style={styles.buttonsColumn}
                >
                  <FarmButton
                    label={pendingCount > 0
                      ? `${t('farm.building.collect', { count: pendingCount, resource: resourceLabel })}`
                      : t('farm.building.noPending')}
                    enabled={pendingCount > 0}
                    variant="green"
                    onPress={handleCollect}
                    fullWidth
                  />

                  {upgradable && nextTier ? (
                    <View style={styles.upgradeBlock}>
                      <FarmButton
                        label={`${t('farm.building.upgrade', { level: building.level + 1 })}  ·  ${upgradeCost} 🍃`}
                        enabled={coins >= upgradeCost}
                        variant="wood"
                        onPress={() => onUpgrade(building.cellId)}
                        fullWidth
                      />
                      <Text style={styles.upgradeBonus}>
                        {`${resourceEmoji} ${tier?.productionRateHours ?? '?'}h → ${nextTier.productionRateHours}h par ${resourceLabel.toLowerCase()}`}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.maxLevelBadge}>
                      <Text style={styles.maxLevelText}>
                        {t('farm.building.maxLevel')}
                      </Text>
                    </View>
                  )}
                </Animated.View>

                {/* Bouton réparation si endommagé */}
                {isDamaged && onRepairRoof && (
                  <Animated.View entering={FadeIn.delay(280).springify().damping(12).stiffness(180)}>
                    <FarmButton
                      label={t('farm.wear.repair', { cost: 25 })}
                      enabled={true}
                      variant="orange"
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onRepairRoof();
                      }}
                      fullWidth
                    />
                  </Animated.View>
                )}
              </ScrollView>
            </View>

            {/* Bouton fermer — petit rond bois en haut à droite */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtnFarm}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnFarmText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // ── Cadre bois ──────────────────────────────────
  woodFrame: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    borderRadius: Radius['2xl'],
    backgroundColor: Farm.woodDark,
    padding: 5,
    ...Shadows.xl,
    maxHeight: '82%',
  },
  woodFrameInner: {
    borderRadius: Radius.xl,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    flexShrink: 1,
  },

  // ── Auvent ──────────────────────────────────────
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
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  awningScallop: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
  },
  awningScallopDot: {
    flex: 1,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  // ── Fond parchemin ──────────────────────────────
  parchment: {
    backgroundColor: Farm.parchmentDark,
    flexShrink: 1,
    paddingBottom: Spacing['3xl'],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Farm.woodHighlight,
  },

  // ── Titre farm ──────────────────────────────────
  farmTitle: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  farmTitleText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  capacityBadge: {
    backgroundColor: Farm.gold,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxs,
    borderWidth: 1.5,
    borderColor: Farm.goldText,
  },
  capacityText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    color: Farm.goldText,
  },

  // ── Sprite hero ─────────────────────────────────
  spriteHero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  spriteImg: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  spriteEmoji: {
    fontSize: 80,
  },

  // ── Section info ────────────────────────────────
  infoSection: {
    backgroundColor: Farm.parchmentDark,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  infoCapacity: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
  },
  fullWarning: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.orange,
    textAlign: 'center',
  },

  // ── Barre de progression ────────────────────────
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressEmoji: {
    fontSize: FontSize.heading,
  },
  progressTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: Farm.progressBg,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 7,
    backgroundColor: Farm.progressGold,
    overflow: 'hidden',
  },
  progressGloss: {
    position: 'absolute',
    top: 1,
    left: 2,
    right: 2,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 3,
  },
  progressTime: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    minWidth: 50,
  },

  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.md,
    gap: Spacing.xl,
  },

  // ── Boutons ─────────────────────────────────────
  buttonsColumn: {
    gap: Spacing.xl,
  },
  btnFullWidth: {
    width: '100%',
  },
  farmBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 5,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  farmBtnBody: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    minHeight: 48,
    overflow: 'hidden',
  },
  farmBtnGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    opacity: 0.3,
  },
  farmBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  // ── Bouton fermer ───────────────────────────────
  closeBtnFarm: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnFarmText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
  },

  // ── Upgrade block ──────────────────────────────
  upgradeBlock: {
    gap: Spacing.sm,
  },
  upgradeBonus: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
    textAlign: 'center',
  },

  // ── Max level ───────────────────────────────────
  maxLevelBadge: {
    backgroundColor: Farm.gold,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Farm.goldText,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  maxLevelText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.goldText,
  },
});
