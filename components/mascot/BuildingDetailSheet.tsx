/**
 * BuildingDetailSheet.tsx — Bottom sheet detail/collecte/amelioration d'un batiment
 *
 * S'ouvre quand l'utilisateur tape sur un batiment place sur la grille.
 * Look cozy farm game : sprite avec fond decoratif, barre de progression animée avec
 * effet glossy, boutons 3D avec spring au press, sections terre/bois.
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

// ── Constantes animations ────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// Couleurs cosmétiques (décision Phase 4 — constantes locales StyleSheet)
const GOLD_COLOR = '#FFD700';
const GOLD_TEXT = '#7B5300';
const REPAIR_COLOR = '#FF9800';
const PROGRESS_BG = 'rgba(0,0,0,0.06)';
const PROGRESS_BORDER = 'rgba(0,0,0,0.04)';

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

// ── Sous-composant : bouton 3D avec spring au press ──────────────

interface Button3DProps {
  label: string;
  enabled: boolean;
  backgroundColor: string;
  shadowColor: string;
  textColor: string;
  onPress?: () => void;
  style?: object;
}

function Button3D({ label, enabled, backgroundColor, shadowColor, textColor, onPress, style }: Button3DProps) {
  const pressedY = useSharedValue(0);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressedY.value }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressedY.value / 3,
  }));

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      onPressIn={() => {
        if (enabled) pressedY.value = withSpring(3, SPRING_CONFIG);
      }}
      onPressOut={() => {
        pressedY.value = withSpring(0, SPRING_CONFIG);
      }}
    >
      {/* Ombre 3D inférieure */}
      <Animated.View
        style={[
          styles.btn3DShadow,
          { backgroundColor: shadowColor },
          shadowStyle,
        ]}
      />
      {/* Corps du bouton */}
      <Animated.View
        style={[
          styles.btn3DBody,
          { backgroundColor },
          style,
          btnStyle,
        ]}
      >
        <Text style={[styles.btnText, { color: textColor }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Sous-composant : barre de progression animée ─────────────────

interface ProgressBarProps {
  progressRatio: number;
  isFull: boolean;
  primaryColor: string;
  successColor: string;
  elapsedMinutes: number;
  totalMinutes: number;
}

function AnimatedProgressBar({ progressRatio, isFull, primaryColor, successColor, elapsedMinutes, totalMinutes }: ProgressBarProps) {
  const widthPercent = useSharedValue(0);
  const glowOpacity = useSharedValue(1);

  useEffect(() => {
    widthPercent.value = withTiming(progressRatio, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [progressRatio]);

  useEffect(() => {
    if (isFull) {
      glowOpacity.value = withRepeat(
        withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.sin) }),
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

  const fillColor = isFull ? successColor : primaryColor;

  return (
    <View>
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, { backgroundColor: fillColor }, fillStyle]}>
          {/* Effet glossy */}
          <View style={styles.progressGloss} />
        </Animated.View>
      </View>
      <Text style={[styles.progressLabel, { color: 'rgba(0,0,0,0.35)' }]}>
        {Math.round(elapsedMinutes)}/{Math.round(totalMinutes)} min
      </Text>
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
  const hoursLeft = Math.floor(minutesUntilNext / 60);
  const minsLeft = minutesUntilNext % 60;
  const timerLabel = minutesUntilNext === 0
    ? null
    : hoursLeft > 0
      ? `${hoursLeft}h${minsLeft > 0 ? `${String(minsLeft).padStart(2, '0')}` : ''}`
      : `${minsLeft}min`;

  const primaryShadow = primary + 'AA';
  const successShadow = colors.success + 'AA';

  const handleCollect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCollect(building.cellId);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.cardAlt }]}>

          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header décoratif */}
          <View style={styles.header}>
            {/* Cercle emoji décoratif */}
            <View style={[styles.headerEmojiCircle, { backgroundColor: colors.card }]}>
              <Text style={styles.headerEmojiText}>{def.emoji}</Text>
            </View>

            {/* Nom + badge niveau */}
            <View style={styles.headerTextBlock}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {t(def.labelKey)}
              </Text>
              <View style={styles.levelBadge}>
                <Text style={[styles.levelBadgeText, { color: GOLD_TEXT }]}>
                  {t('farm.building.level', { level: building.level })}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeBtnText, { color: colors.textSub }]}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Sprite avec fond décoratif */}
            <Animated.View
              style={styles.spriteContainer}
              entering={FadeIn.springify().damping(12).stiffness(180)}
            >
              <View style={[styles.spriteBackdrop, { backgroundColor: colors.card }, Shadows.sm]}>
                {sprite ? (
                  <Image source={sprite} style={styles.sprite} />
                ) : (
                  <Text style={styles.spriteEmoji}>{def.emoji}</Text>
                )}
              </View>
            </Animated.View>

            {/* Section production */}
            <Animated.View
              entering={FadeIn.delay(100).springify().damping(12).stiffness(180)}
              style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.md]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {'⚙️ '}Production
              </Text>
              <Text style={[styles.sectionDetail, { color: colors.textSub }]}>
                {resourceEmoji}{' '}{t('farm.building.frequency', {
                  resource: resourceLabel,
                  hours: Math.round(effectiveRateHours * 10) / 10,
                })}
              </Text>
              {timerLabel ? (
                <>
                  <AnimatedProgressBar
                    progressRatio={progressRatio}
                    isFull={false}
                    primaryColor={primary}
                    successColor={colors.success}
                    elapsedMinutes={elapsedMinutes}
                    totalMinutes={totalMinutes}
                  />
                  <Text style={[styles.sectionDetail, { color: primary }]}>
                    {'⏳ '}{t('farm.building.nextIn', { time: timerLabel, defaultValue: `Prochain ${resourceLabel} dans ${timerLabel}` })}
                  </Text>
                </>
              ) : pendingCount > 0 ? null : (
                <AnimatedProgressBar
                  progressRatio={1}
                  isFull={true}
                  primaryColor={primary}
                  successColor={colors.success}
                  elapsedMinutes={totalMinutes}
                  totalMinutes={totalMinutes}
                />
              )}
            </Animated.View>

            {/* Section collecte */}
            <Animated.View
              entering={FadeIn.delay(200).springify().damping(12).stiffness(180)}
              style={[
                styles.section,
                {
                  backgroundColor: colors.card,
                  borderColor: isFull ? colors.warning : colors.border,
                },
                Shadows.md,
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {'📦 '}{t('farm.building.pendingOf', { count: pendingCount, max: effectiveMaxPending, resource: resourceLabel })}
              </Text>
              {isFull && (
                <Text style={[styles.sectionDetail, { color: colors.warning, fontWeight: FontWeight.semibold }]}>
                  {t('farm.building.storageFull')}
                </Text>
              )}
              <Button3D
                label={pendingCount > 0
                  ? t('farm.building.collect', { count: pendingCount, resource: resourceLabel })
                  : t('farm.building.noPending')}
                enabled={pendingCount > 0}
                backgroundColor={pendingCount > 0 ? colors.success : colors.borderLight}
                shadowColor={pendingCount > 0 ? successShadow : colors.border}
                textColor={pendingCount > 0 ? colors.bg : colors.textMuted}
                onPress={handleCollect}
                style={styles.fullWidthBtn}
              />
            </Animated.View>

            {/* Section réparation toit — visible uniquement si endommagé */}
            {isDamaged && onRepairRoof && (
              <Animated.View entering={FadeIn.delay(280).springify().damping(12).stiffness(180)}>
                <Button3D
                  label={t('farm.wear.repair', { cost: 25 })}
                  enabled={true}
                  backgroundColor={REPAIR_COLOR}
                  shadowColor={'#C0600080'}
                  textColor={colors.bg}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onRepairRoof();
                  }}
                  style={styles.fullWidthBtn}
                />
              </Animated.View>
            )}

            {/* Section amélioration */}
            <Animated.View
              entering={FadeIn.delay(300).springify().damping(12).stiffness(180)}
              style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.md]}
            >
              {upgradable && nextTier ? (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {'⬆️ '}Amélioration
                  </Text>
                  <Text style={[styles.sectionDetail, { color: colors.textSub }]}>
                    {t('farm.building.frequency', {
                      resource: resourceLabel,
                      hours: Math.round(nextTier.productionRateHours * (techBonuses?.productionIntervalMultiplier ?? 1.0) * 10) / 10,
                    })}
                  </Text>
                  <Text style={[styles.sectionDetail, { color: coins >= upgradeCost ? colors.success : colors.textMuted }]}>
                    {t('farm.building.upgradeCost', { cost: upgradeCost })}
                  </Text>
                  <Button3D
                    label={t('farm.building.upgrade', { level: building.level + 1 })}
                    enabled={coins >= upgradeCost}
                    backgroundColor={coins >= upgradeCost ? primary : colors.borderLight}
                    shadowColor={coins >= upgradeCost ? primaryShadow : colors.border}
                    textColor={coins >= upgradeCost ? colors.bg : colors.textMuted}
                    onPress={() => onUpgrade(building.cellId)}
                    style={styles.fullWidthBtn}
                  />
                </>
              ) : (
                <View style={styles.maxLevelRow}>
                  <Text style={[styles.maxLevelBadge, { backgroundColor: GOLD_COLOR, color: GOLD_TEXT }]}>
                    {t('farm.building.maxLevel')}
                  </Text>
                  <Text style={[styles.sectionDetail, { color: colors.textSub }]}>
                    {t('farm.building.frequency', {
                      resource: resourceLabel,
                      hours: Math.round(effectiveRateHours * 10) / 10,
                    })}
                  </Text>
                </View>
              )}
            </Animated.View>
          </ScrollView>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing['5xl'],
    maxHeight: '80%',
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  headerEmojiCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEmojiText: {
    fontSize: FontSize.heading,
  },
  headerTextBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: GOLD_COLOR,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxs,
  },
  levelBadgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  closeBtn: {
    padding: Spacing.md,
  },
  closeBtnText: {
    fontSize: FontSize.lg,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    gap: Spacing.xl,
  },
  // Sprite display
  spriteContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  spriteBackdrop: {
    width: 96,
    height: 96,
    borderRadius: Radius['3xl'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sprite: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },
  spriteEmoji: {
    fontSize: FontSize.hero,
  },
  // Sections carte style terre/bois
  section: {
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  sectionDetail: {
    fontSize: FontSize.sm,
  },
  // Barre de progression améliorée
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: PROGRESS_BG,
    borderWidth: 0.5,
    borderColor: PROGRESS_BORDER,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressGloss: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: FontSize.caption,
    marginTop: Spacing.xs,
  },
  // Bouton 3D
  btn3DShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
  },
  btn3DBody: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: 3,
  },
  fullWidthBtn: {
    width: '100%',
  },
  btnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Max level
  maxLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  maxLevelBadge: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
    overflow: 'hidden',
  },
});
