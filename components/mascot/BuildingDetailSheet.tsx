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
  FadeIn,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { BUILDING_CATALOG, type PlacedBuilding } from '../../lib/mascot/types';
import { BUILDING_SPRITES } from '../../lib/mascot/building-sprites';
import {
  getPendingResources,
  getUpgradeCost,
  canUpgrade,
  getMinutesUntilNext,
  getMaxPending,
} from '../../lib/mascot/building-engine';
import type { TechBonuses } from '../../lib/mascot/tech-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

function formatHours(hours: number): string {
  if (hours <= 0) return '0min';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('fr-FR');
}

function deltaPercent(from: number, to: number): string {
  if (from <= 0) return '';
  const ratio = (to - from) / from;
  const pct = Math.round(ratio * 100);
  if (pct === 0) return '';
  const sign = pct > 0 ? '+' : '−';
  return `${sign}${Math.abs(pct)} %`;
}

const RESOURCE_LABELS: Record<string, {
  name: string;
  produced: string;
  nextLabel: string;
  cycleLabel: string;
  subtitle: string;
}> = {
  oeuf:   { name: 'Œuf',    produced: 'Œufs produits',   nextLabel: 'Prochain œuf dans',     cycleLabel: '1 œuf toutes les',    subtitle: "Production d'œufs"    },
  lait:   { name: 'Lait',   produced: 'Lait produit',    nextLabel: 'Prochain lait dans',    cycleLabel: '1 lait toutes les',   subtitle: 'Production de lait'   },
  miel:   { name: 'Miel',   produced: 'Miel produit',    nextLabel: 'Prochain miel dans',    cycleLabel: '1 miel toutes les',   subtitle: 'Production de miel'   },
  farine: { name: 'Farine', produced: 'Farine produite', nextLabel: 'Prochaine farine dans', cycleLabel: '1 farine toutes les', subtitle: 'Production de farine' },
};

function pluralizeResource(resourceType: string, count: number): string {
  const base = (RESOURCE_LABELS[resourceType]?.name ?? resourceType).toLowerCase();
  if (count <= 1) return base;
  if (resourceType === 'lait' || resourceType === 'farine') return base;
  return `${base}s`;
}

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
      <View style={styles.awningShadow} />
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

interface FarmButtonProps {
  label: string;
  emoji?: string;
  enabled: boolean;
  variant?: 'primary' | 'warning';
  onPress?: () => void;
}

function FarmButton({ label, emoji, enabled, variant = 'primary', onPress }: FarmButtonProps) {
  const pressedY = useSharedValue(0);

  const palette = variant === 'warning'
    ? { bg: Farm.orange, shadow: Farm.orangeShadow, highlight: '#F2B36A' }
    : { bg: Farm.greenBtn, shadow: Farm.greenBtnShadow, highlight: Farm.greenBtnHighlight };

  const bg = enabled ? palette.bg : Farm.parchmentDark;
  const shadow = enabled ? palette.shadow : '#D0CBC3';
  const highlight = enabled ? palette.highlight : Farm.parchment;

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
        <View style={styles.farmBtnContent}>
          {emoji ? <Text style={styles.farmBtnEmoji}>{emoji}</Text> : null}
          <Text style={[
            styles.farmBtnText,
            {
              color: enabled ? '#FFFFFF' : Farm.brownTextSub,
              textShadowColor: enabled ? 'rgba(0,0,0,0.25)' : 'transparent',
            },
          ]}>
            {label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

interface UpgradeLineProps {
  icon: string;
  description: string;
  fromText: string;
  toText: string;
  delta: string;
}

function UpgradeLine({ icon, description, fromText, toText, delta }: UpgradeLineProps) {
  return (
    <View style={styles.upgradeLine}>
      <View style={styles.upgradeLineIcon}>
        <Text style={styles.upgradeLineIconText}>{icon}</Text>
      </View>
      <View style={styles.upgradeLineBody}>
        <Text style={styles.upgradeLineDesc}>{description}</Text>
        <View style={styles.upgradeLineRow}>
          <Text style={styles.upgradeFrom}>{fromText}</Text>
          <Text style={styles.upgradeArrow}>→</Text>
          <Text style={styles.upgradeTo}>{toText}</Text>
          {delta ? (
            <View style={styles.deltaBadge}>
              <Text style={styles.deltaBadgeText}>{delta}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

interface HeroProgressProps {
  ratio: number;
  isFull: boolean;
}

function HeroProgress({ ratio, isFull }: HeroProgressProps) {
  const widthPercent = useSharedValue(0);

  useEffect(() => {
    widthPercent.value = withTiming(ratio, { duration: 700, easing: Easing.out(Easing.quad) });
  }, [ratio]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(widthPercent.value * 100)}%` as any,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle, isFull && styles.progressFillFull]} />
    </View>
  );
}

interface BuildingDetailSheetProps {
  visible: boolean;
  building: PlacedBuilding;
  coins: number;
  techBonuses?: TechBonuses;
  isDamaged?: boolean;
  questSpeedMultiplier?: number;
  onCollect: (cellId: string) => void;
  onUpgrade: (cellId: string) => void;
  onRepairRoof?: () => void;
  onClose: () => void;
  onOpenAuberge?: () => void;
}

export function BuildingDetailSheet({
  visible,
  building,
  coins,
  techBonuses,
  isDamaged,
  questSpeedMultiplier = 1,
  onCollect,
  onUpgrade,
  onRepairRoof,
  onClose,
  onOpenAuberge,
}: BuildingDetailSheetProps) {
  const { t } = useTranslation();

  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return null;

  const isProductive = def.producesResource !== false;
  const isAuberge = def.id === 'auberge';

  const tier = def.tiers[building.level - 1];
  const nextTier = def.tiers[building.level] ?? null;
  const upgradable = canUpgrade(building);
  const upgradeCost = getUpgradeCost(building);
  const sprite = BUILDING_SPRITES[building.buildingId]?.[building.level];

  const techRateMul = techBonuses?.productionIntervalMultiplier ?? 1.0;
  const techCapMul = techBonuses?.buildingCapacityMultiplier ?? 1;
  const wearMul = isDamaged ? 2 : 1;

  const currentCycleHours = (tier?.productionRateHours ?? 1) * techRateMul * wearMul / questSpeedMultiplier;
  const nextCycleHours = nextTier ? nextTier.productionRateHours * techRateMul / questSpeedMultiplier : 0;

  const currentMaxPending = Math.floor(getMaxPending(building.level) * techCapMul);
  const nextMaxPending = nextTier
    ? Math.floor(getMaxPending(building.level + 1) * techCapMul)
    : currentMaxPending;

  const pendingCount = getPendingResources(building, new Date(), techBonuses, undefined, questSpeedMultiplier);
  const isFull = pendingCount >= currentMaxPending;
  const minutesUntilNext = getMinutesUntilNext(building, new Date(), techBonuses, undefined, questSpeedMultiplier);
  const totalMinutes = currentCycleHours * 60;
  const elapsedMinutes = totalMinutes - minutesUntilNext;
  const progressRatio = isFull
    ? 1
    : Math.max(0, Math.min(1, elapsedMinutes / Math.max(1, totalMinutes)));

  const labels = RESOURCE_LABELS[def.resourceType] ?? {
    name: def.resourceType,
    produced: def.resourceType,
    nextLabel: 'Prochaine ressource dans',
    cycleLabel: '1 unité toutes les',
    subtitle: 'Production',
  };
  const titleSubtitle = isProductive ? labels.subtitle : t('auberge.building.subtitle');
  const resourceEmoji =
    def.resourceType === 'oeuf' ? '🥚' :
    def.resourceType === 'lait' ? '🥛' :
    def.resourceType === 'miel' ? '🍯' :
    '🫓';

  const handleCollect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCollect(building.cellId);
  };

  const canAffordUpgrade = upgradable && coins >= upgradeCost;
  const missingCoins = Math.max(0, upgradeCost - coins);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

        <View style={styles.woodFrame}>
          <View style={styles.woodFrameInner}>
            <AwningStripes />

            <View style={styles.parchment}>
              <View style={styles.handle} />

              <View style={styles.header}>
                <Text style={styles.breadcrumb}>Bâtiment de la ferme</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>{'✕'}</Text>
                </TouchableOpacity>
              </View>

              <Animated.View
                entering={FadeIn.springify().damping(14).stiffness(200)}
                style={styles.titleBlock}
              >
                <View style={styles.spriteWrap}>
                  {sprite ? (
                    <Image source={sprite} style={styles.spriteImg} />
                  ) : (
                    <Text style={styles.spriteEmoji}>{def.emoji}</Text>
                  )}
                  <View
                    style={[
                      styles.levelChip,
                      building.level >= def.tiers.length && styles.levelChipMax,
                    ]}
                  >
                    <Text style={styles.levelChipText}>NIV. {building.level}</Text>
                  </View>
                </View>
                <View style={styles.titleText}>
                  <Text style={styles.titleH1}>{t(def.labelKey)}</Text>
                  <Text style={styles.titleSub}>{titleSubtitle}</Text>
                </View>
              </Animated.View>

              <ScrollView
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
              >
                {isProductive && isDamaged && onRepairRoof && (
                  <Animated.View
                    entering={FadeIn.delay(60).springify().damping(12).stiffness(180)}
                  >
                    <View style={styles.banner}>
                      <View style={styles.bannerIcon}>
                        <Text style={styles.bannerIconText}>🔨</Text>
                      </View>
                      <View style={styles.bannerText}>
                        <Text style={styles.bannerT1}>Toit endommagé</Text>
                        <Text style={styles.bannerT2}>
                          La production est divisée par 2 jusqu'à réparation
                        </Text>
                      </View>
                    </View>
                    <View style={{ height: Spacing.md }} />
                    <FarmButton
                      label={`Réparer le toit · 25 🍃`}
                      emoji="🔨"
                      variant="warning"
                      enabled
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onRepairRoof();
                      }}
                    />
                  </Animated.View>
                )}

                {isProductive ? (
                  <>
                    <Animated.View
                      entering={FadeIn.delay(100).springify().damping(12).stiffness(180)}
                      style={styles.heroCard}
                    >
                      <View style={styles.heroRow}>
                        <View style={styles.heroResource}>
                          <View style={styles.heroIconWrap}>
                            <Text style={styles.heroIconText}>{resourceEmoji}</Text>
                          </View>
                          <Text style={styles.heroName}>{labels.produced}</Text>
                        </View>
                        <View style={styles.heroStock}>
                          <Text style={[styles.heroStockNow, isFull && styles.heroStockNowFull]}>
                            {pendingCount}
                          </Text>
                          <Text style={styles.heroStockMax}> / {currentMaxPending}</Text>
                        </View>
                      </View>

                      <HeroProgress ratio={progressRatio} isFull={isFull} />

                      <View style={styles.progressMeta}>
                        {isFull ? (
                          <>
                            <Text style={[styles.progressMetaLeft, { color: Farm.orange }]}>
                              ⚠ Stockage plein
                            </Text>
                            <Text style={styles.progressMetaRight}>
                              <Text style={styles.progressMetaRightBold}>Production en pause</Text>
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.progressMetaLeft}>{labels.nextLabel}</Text>
                            <Text style={styles.progressMetaRight}>
                              <Text style={styles.progressMetaRightBold}>
                                {minutesUntilNext > 0 ? formatHours(minutesUntilNext / 60) : '—'}
                              </Text>
                            </Text>
                          </>
                        )}
                      </View>
                    </Animated.View>

                    <Animated.View
                      entering={FadeIn.delay(160).springify().damping(12).stiffness(180)}
                    >
                      <FarmButton
                        label={pendingCount > 0
                          ? `Collecter ${pendingCount} ${pluralizeResource(def.resourceType, pendingCount)}`
                          : `Rien à collecter pour l'instant`}
                        emoji={pendingCount > 0 ? resourceEmoji : undefined}
                        enabled={pendingCount > 0}
                        onPress={handleCollect}
                      />
                    </Animated.View>
                  </>
                ) : (
                  <Animated.View
                    entering={FadeIn.delay(100).springify().damping(12).stiffness(180)}
                    style={styles.nonProductiveCard}
                  >
                    <Text style={styles.nonProductiveIcon}>🛖</Text>
                    <Text style={styles.nonProductiveTitle}>{isAuberge ? t('auberge.building.title') : t('auberge.building.subtitle')}</Text>
                    {isAuberge ? (
                      <>
                        <Text style={styles.nonProductiveBody}>
                          {t('auberge.building.description')}
                        </Text>
                        <View style={{ height: Spacing.md }} />
                        <FarmButton
                          label={t('auberge.cta.see_inn')}
                          emoji="🛖"
                          enabled
                          onPress={() => onOpenAuberge?.()}
                        />
                      </>
                    ) : (
                      <Text style={styles.nonProductiveBody}>
                        {t('auberge.building.non_productive_fallback')}
                      </Text>
                    )}
                  </Animated.View>
                )}

                <Animated.View
                  entering={FadeIn.delay(220).springify().damping(12).stiffness(180)}
                >
                  {upgradable && nextTier ? (
                    <View style={styles.upgradeSection}>
                      <View style={styles.upgradeHeader}>
                        <Text style={styles.upgradeHeaderLabel}>NIVEAU SUIVANT</Text>
                        <View style={styles.upgradeTarget}>
                          <Text style={styles.upgradeTargetText}>Niv. {building.level + 1}</Text>
                        </View>
                      </View>

                      <View style={styles.upgradeLines}>
                        {isProductive ? (
                          <>
                            <UpgradeLine
                              icon="⏱"
                              description={labels.cycleLabel}
                              fromText={formatHours(currentCycleHours / wearMul)}
                              toText={formatHours(nextCycleHours)}
                              delta={deltaPercent(currentCycleHours / wearMul, nextCycleHours)}
                            />
                            <UpgradeLine
                              icon="📦"
                              description="Stockage maximum"
                              fromText={`${currentMaxPending}`}
                              toText={`${nextMaxPending} ${pluralizeResource(def.resourceType, nextMaxPending)}`}
                              delta={`+${nextMaxPending - currentMaxPending}`}
                            />
                          </>
                        ) : isAuberge ? (
                          <UpgradeLine
                            icon="⏱"
                            description="Délai entre deux visiteurs"
                            fromText={formatHours(Math.max(2, 6 - (building.level - 1) * (20 / 60)))}
                            toText={formatHours(Math.max(2, 6 - building.level * (20 / 60)))}
                            delta={building.level < 10 ? '−20 min' : ''}
                          />
                        ) : (
                          <UpgradeLine
                            icon="✨"
                            description={t('auberge.building.upgrade_label')}
                            fromText={`Niv. ${building.level}`}
                            toText={`Niv. ${building.level + 1}`}
                            delta=""
                          />
                        )}
                      </View>

                      <View style={styles.upgradeFooter}>
                        <View style={styles.upgradeCost}>
                          <Text style={styles.upgradeCostLbl}>Coût d'amélioration</Text>
                          <Text style={styles.upgradeCostVal}>
                            {fmtNum(upgradeCost)} 🍃
                          </Text>
                        </View>
                        <FarmButton
                          label={canAffordUpgrade
                            ? `Améliorer ${t(def.labelKey).toLowerCase()}`
                            : `Il manque ${fmtNum(missingCoins)} 🍃`}
                          enabled={canAffordUpgrade}
                          onPress={() => onUpgrade(building.cellId)}
                        />
                        <View style={styles.balanceLine}>
                          <Text style={styles.balanceLbl}>Solde disponible</Text>
                          <Text style={styles.balanceVal}>{fmtNum(coins)} 🍃</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.maxCard}>
                      <Text style={styles.maxCardIcon}>✨</Text>
                      <Text style={styles.maxCardT1}>Niveau maximum atteint</Text>
                      <Text style={styles.maxCardT2}>
                        {`Cette ${t(def.labelKey).toLowerCase()} est à son apogée. Continue à investir dans tes autres bâtiments.`}
                      </Text>
                    </View>
                  )}
                </Animated.View>
              </ScrollView>
            </View>
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

  woodFrame: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    borderRadius: Radius['2xl'],
    backgroundColor: Farm.woodDark,
    padding: 5,
    ...Shadows.xl,
    maxHeight: '90%',
  },
  woodFrameInner: {
    borderRadius: Radius['2xl'] - 3,
    overflow: 'hidden',
    backgroundColor: Farm.woodLight,
  },

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

  parchment: {
    backgroundColor: Farm.parchmentDark,
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

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.sm,
  },
  breadcrumb: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Farm.brownTextSub,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Farm.parchment,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Farm.brownText,
  },

  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  spriteWrap: {
    width: 88,
    height: 88,
    borderRadius: Radius.lg,
    backgroundColor: Farm.parchment,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  spriteImg: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },
  spriteEmoji: {
    fontSize: 50,
  },
  levelChip: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: Farm.gold,
    borderWidth: 2,
    borderColor: Farm.parchment,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    ...Shadows.sm,
  },
  levelChipMax: {
    backgroundColor: '#FFD700',
  },
  levelChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: Farm.goldText,
    letterSpacing: 0.3,
  },
  titleText: {
    flex: 1,
    gap: 4,
  },
  titleH1: {
    fontSize: 24,
    fontWeight: '800',
    color: Farm.brownText,
    letterSpacing: -0.3,
  },
  titleSub: {
    fontSize: 13,
    color: Farm.brownTextSub,
    fontWeight: '500',
  },

  body: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    gap: Spacing.lg,
  },

  heroCard: {
    backgroundColor: Farm.parchment,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    padding: Spacing.xl,
    ...Shadows.sm,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  heroResource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Farm.gold + '33',
    borderWidth: 1,
    borderColor: Farm.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconText: {
    fontSize: 17,
  },
  heroName: {
    fontSize: 15,
    fontWeight: '700',
    color: Farm.brownText,
  },
  heroStock: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroStockNow: {
    fontSize: 20,
    fontWeight: '800',
    color: Farm.brownText,
  },
  heroStockNowFull: {
    color: Farm.orange,
  },
  heroStockMax: {
    fontSize: 14,
    fontWeight: '600',
    color: Farm.brownTextSub,
  },

  progressTrack: {
    height: 8,
    backgroundColor: Farm.progressBg,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Farm.progressGold,
    borderRadius: 999,
  },
  progressFillFull: {
    backgroundColor: Farm.orange,
  },

  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressMetaLeft: {
    fontSize: 12,
    color: Farm.brownTextSub,
    fontWeight: '500',
  },
  progressMetaRight: {
    fontSize: 12,
    color: Farm.brownText,
  },
  progressMetaRightBold: {
    fontWeight: '800',
    color: Farm.brownText,
  },

  btnFullWidth: {
    width: '100%',
  },
  farmBtnShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 52,
    borderRadius: Radius.lg,
  },
  farmBtnBody: {
    minHeight: 52,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
    paddingHorizontal: Spacing.xl,
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
  farmBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  farmBtnEmoji: {
    fontSize: 18,
  },
  farmBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Farm.parchment,
    borderWidth: 1,
    borderColor: Farm.orange,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Farm.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerIconText: {
    fontSize: 16,
    color: '#fff',
  },
  bannerText: {
    flex: 1,
  },
  bannerT1: {
    fontSize: 13,
    fontWeight: '800',
    color: Farm.orangeShadow,
  },
  bannerT2: {
    fontSize: 11,
    color: Farm.brownTextSub,
    marginTop: 2,
  },

  upgradeSection: {
    backgroundColor: Farm.parchment,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  upgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Farm.parchmentDark,
    borderBottomWidth: 1,
    borderBottomColor: Farm.woodHighlight,
  },
  upgradeHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: Farm.brownTextSub,
  },
  upgradeTarget: {
    backgroundColor: Farm.awningGreen + '22',
    borderWidth: 1,
    borderColor: Farm.awningGreen,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  upgradeTargetText: {
    fontSize: 13,
    fontWeight: '800',
    color: Farm.awningGreen,
  },

  upgradeLines: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  upgradeLine: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  upgradeLineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeLineIconText: {
    fontSize: 18,
  },
  upgradeLineBody: {
    flex: 1,
    gap: 3,
  },
  upgradeLineDesc: {
    fontSize: 13,
    color: Farm.brownTextSub,
    fontWeight: '500',
  },
  upgradeLineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  upgradeFrom: {
    fontSize: 15,
    color: Farm.brownTextSub,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  upgradeArrow: {
    fontSize: 14,
    color: Farm.awningGreen,
    fontWeight: '800',
  },
  upgradeTo: {
    fontSize: 17,
    fontWeight: '800',
    color: Farm.brownText,
    letterSpacing: -0.3,
  },
  deltaBadge: {
    marginLeft: 'auto',
    backgroundColor: Farm.awningGreen + '22',
    borderWidth: 1,
    borderColor: Farm.awningGreen,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deltaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Farm.awningGreen,
  },

  upgradeFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    gap: Spacing.sm,
  },
  upgradeCost: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  upgradeCostLbl: {
    fontSize: 13,
    color: Farm.brownTextSub,
    fontWeight: '600',
  },
  upgradeCostVal: {
    fontSize: 18,
    fontWeight: '800',
    color: Farm.brownText,
  },
  balanceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  balanceLbl: {
    fontSize: 12,
    color: Farm.brownTextSub,
  },
  balanceVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Farm.brownText,
  },

  maxCard: {
    backgroundColor: Farm.gold + '22',
    borderWidth: 1.5,
    borderColor: Farm.gold,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  maxCardIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  maxCardT1: {
    fontSize: 14,
    fontWeight: '800',
    color: Farm.goldText,
    letterSpacing: 0.2,
  },
  maxCardT2: {
    fontSize: 11,
    color: Farm.brownTextSub,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },

  nonProductiveCard: {
    backgroundColor: Farm.parchment,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  nonProductiveIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  nonProductiveTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Farm.brownText,
    marginBottom: 4,
  },
  nonProductiveBody: {
    fontSize: 13,
    color: Farm.brownTextSub,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
});
