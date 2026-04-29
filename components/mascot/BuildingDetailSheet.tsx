/**
 * BuildingDetailSheet.tsx — Modal détail bâtiment, refonte v4
 *
 * Architecture descriptive :
 *  - Header compact (sprite + niveau attaché + titre)
 *  - Hero card production (état actuel + progression + temps)
 *  - CTA primaire (collecte)
 *  - Banner + bouton réparation si endommagé
 *  - Upgrade section avec lignes descriptives ("1 miel toutes les 7h37 → 7h00")
 *  - Max card si niveau plafond atteint
 *
 * Toutes les durées affichées sont **effectives** (avec bonus tech & wear appliqués).
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

// ── Tokens design (v4 refonte) ──────────────────────────────────

const T = {
  bg: '#FFF8EC',
  surface: '#FFFFFF',
  surface2: '#FAF3E2',
  surface3: '#F1E6CA',
  accent: '#8B5A2B',
  accentSoft: '#EFE0CC',
  accentLine: '#E5D2B5',
  primary: '#4F8A3A',
  primaryStrong: '#3A6B2C',
  primarySoft: '#E5F0DD',
  warning: '#C57A1F',
  warningStrong: '#8B5614',
  warningSoft: '#FCEBD3',
  warningBorder: '#E8C28A',
  warningInk: '#7A4A14',
  warningInkSub: '#8A5A24',
  ink: '#2C1F10',
  ink2: '#5C4A33',
  ink3: '#8A7656',
  inkInverse: '#FFFFFF',
  gold: '#E4B23A',
  goldStrong: '#8C6B1A',
  goldSoft: '#FCF1CF',
  goldInk: '#A88420',
  progressGold: '#E8C858',
} as const;

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Helpers formatage ───────────────────────────────────────────

/** Formatte une durée en heures décimales en "Xh" / "XhYY" / "Xmin". */
function formatHours(hours: number): string {
  if (hours <= 0) return '0min';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** Formatte un entier avec séparateur français de milliers. */
function fmtNum(n: number): string {
  return n.toLocaleString('fr-FR');
}

/** Calcule le delta en pourcentage (ex: −8 %) entre deux durées. */
function deltaPercent(from: number, to: number): string {
  if (from <= 0) return '';
  const ratio = (to - from) / from;
  const pct = Math.round(ratio * 100);
  if (pct === 0) return '';
  const sign = pct > 0 ? '+' : '−';
  return `${sign}${Math.abs(pct)} %`;
}

/**
 * Étiquettes par ressource — accord en genre/nombre.
 * - `name` : forme singulière capitalisée ("Œuf", "Miel"…)
 * - `produced` : phrase d'état stock ("Œufs produits", "Lait produit"…)
 * - `nextLabel` : phrase pour le timer ("Prochain œuf dans", "Prochaine farine dans"…)
 * - `cycleLabel` : phrase pour la ligne d'upgrade ("1 œuf toutes les"…)
 * - `subtitle` : phrase pour le sous-titre du bâtiment ("Production d'œufs"…)
 */
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

/** Pluralise un mot ressource pour les boutons / lignes upgrade ("1 miel" / "2 miels"). */
function pluralizeResource(resourceType: string, count: number): string {
  const base = (RESOURCE_LABELS[resourceType]?.name ?? resourceType).toLowerCase();
  if (count <= 1) return base;
  // Lait & farine restent invariables au pluriel dans l'usage courant
  if (resourceType === 'lait' || resourceType === 'farine') return base;
  return `${base}s`;
}

// ── Sous-composant : CTA bouton lift ────────────────────────────

interface CTAProps {
  label: string;
  emoji?: string;
  variant: 'primary' | 'secondary' | 'warning' | 'disabled';
  onPress?: () => void;
}

function CTA({ label, emoji, variant, onPress }: CTAProps) {
  const pressedY = useSharedValue(0);
  const enabled = variant !== 'disabled';

  const colors = {
    primary: { bg: T.primary, shadow: T.primaryStrong, text: T.inkInverse },
    secondary: { bg: T.surface, shadow: T.accentLine, text: T.ink },
    warning: { bg: T.warning, shadow: T.warningStrong, text: T.inkInverse },
    disabled: { bg: T.surface3, shadow: '#D0CBC3', text: T.ink3 },
  }[variant];

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
          pressedY.value = withSpring(3, SPRING_CONFIG);
        }
      }}
      onPressOut={() => {
        pressedY.value = withSpring(0, SPRING_CONFIG);
      }}
    >
      <Animated.View
        style={[styles.ctaShadow, { backgroundColor: colors.shadow }, shadowStyle]}
      />
      <Animated.View
        style={[
          styles.ctaBody,
          {
            backgroundColor: colors.bg,
            borderWidth: variant === 'secondary' ? 1.5 : 0,
            borderColor: T.accentLine,
          },
          btnStyle,
        ]}
      >
        {emoji && <Text style={styles.ctaEmoji}>{emoji}</Text>}
        <Text style={[styles.ctaText, { color: colors.text }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Sous-composant : ligne d'upgrade descriptive ────────────────

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

// ── Sous-composant : barre de progression hero ──────────────────

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
  onOpenAuberge?: () => void;
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
  onOpenAuberge,
}: BuildingDetailSheetProps) {
  const { t } = useTranslation();

  const def = BUILDING_CATALOG.find(d => d.id === building.buildingId);
  if (!def) return null;

  // Phase 44 — Bâtiment non-productif (Auberge & co.) : affichage gracieux
  const isProductive = def.producesResource !== false;
  const isAuberge = def.id === 'auberge';

  const tier = def.tiers[building.level - 1];
  const nextTier = def.tiers[building.level] ?? null;
  const upgradable = canUpgrade(building);
  const upgradeCost = getUpgradeCost(building);
  const sprite = BUILDING_SPRITES[building.buildingId]?.[building.level];

  // Multiplicateurs effectifs
  const techRateMul = techBonuses?.productionIntervalMultiplier ?? 1.0;
  const techCapMul = techBonuses?.buildingCapacityMultiplier ?? 1;
  const wearMul = isDamaged ? 2 : 1;

  // Cycle effectif (avec wear)
  const currentCycleHours = (tier?.productionRateHours ?? 1) * techRateMul * wearMul;
  const nextCycleHours = nextTier ? nextTier.productionRateHours * techRateMul : 0;

  // Cap effectif
  const currentMaxPending = Math.floor(getMaxPending(building.level) * techCapMul);
  const nextMaxPending = nextTier
    ? Math.floor(getMaxPending(building.level + 1) * techCapMul)
    : currentMaxPending;

  // État pending + progression
  const pendingCount = getPendingResources(building, new Date(), techBonuses);
  const isFull = pendingCount >= currentMaxPending;
  const minutesUntilNext = getMinutesUntilNext(building, new Date(), techBonuses);
  const totalMinutes = currentCycleHours * 60;
  const elapsedMinutes = totalMinutes - minutesUntilNext;
  const progressRatio = isFull
    ? 1
    : Math.max(0, Math.min(1, elapsedMinutes / Math.max(1, totalMinutes)));

  // Labels & emoji ressource
  const labels = RESOURCE_LABELS[def.resourceType] ?? {
    name: def.resourceType,
    produced: def.resourceType,
    nextLabel: 'Prochaine ressource dans',
    cycleLabel: '1 unité toutes les',
    subtitle: 'Production',
  };
  // Phase 44 — override subtitle pour les bâtiments non-productifs
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
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

        {/* Sheet principal */}
        <View style={styles.sheet}>
          {/* Bordure d'accent en haut */}
          <View style={styles.accentLine} />

          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.breadcrumb}>Bâtiment de la ferme</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          {/* Title block (sprite + niveau attaché + titre) */}
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

          {/* Body scrollable */}
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Banner toit endommagé en priorité — uniquement si productif */}
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
                <CTA
                  label={`Réparer le toit · 25 🍃`}
                  emoji="🔨"
                  variant="warning"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onRepairRoof();
                  }}
                />
              </Animated.View>
            )}

            {isProductive ? (
              <>
            {/* Hero card — production actuelle */}
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
                    <Text style={[styles.progressMetaLeft, { color: T.warning }]}>
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

            {/* CTA collecte */}
            <Animated.View
              entering={FadeIn.delay(160).springify().damping(12).stiffness(180)}
            >
              <CTA
                label={pendingCount > 0
                  ? `Collecter ${pendingCount} ${pluralizeResource(def.resourceType, pendingCount)}`
                  : `Rien à collecter pour l'instant`}
                emoji={pendingCount > 0 ? resourceEmoji : undefined}
                variant={pendingCount > 0 ? 'primary' : 'disabled'}
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
                    <CTA
                      label={t('auberge.cta.see_inn')}
                      emoji="🛖"
                      variant="primary"
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

            {/* Section upgrade */}
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
                    <CTA
                      label={canAffordUpgrade
                        ? `Améliorer ${t(def.labelKey).toLowerCase()}`
                        : `Il manque ${fmtNum(missingCoins)} 🍃`}
                      variant={canAffordUpgrade ? 'secondary' : 'disabled'}
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
    </Modal>
    </>
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

  // ── Sheet ───────────────────────────────────────
  sheet: {
    height: '90%',
    backgroundColor: T.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  accentLine: {
    height: 4,
    backgroundColor: T.accent,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: T.accentLine,
    alignSelf: 'center',
    marginTop: 10,
  },

  // ── Header ──────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
  },
  breadcrumb: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: T.ink3,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.surface2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: T.ink2,
  },

  // ── Title block ─────────────────────────────────
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  spriteWrap: {
    width: 88,
    height: 88,
    borderRadius: Radius.lg,
    backgroundColor: T.surface2,
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
    backgroundColor: T.gold,
    borderWidth: 2,
    borderColor: T.bg,
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
    color: T.goldStrong,
    letterSpacing: 0.3,
  },
  titleText: {
    flex: 1,
    gap: 4,
  },
  titleH1: {
    fontSize: 24,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.3,
  },
  titleSub: {
    fontSize: 13,
    color: T.ink3,
    fontWeight: '500',
  },

  // ── Body ────────────────────────────────────────
  body: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    gap: Spacing.lg,
  },

  // ── Hero card ───────────────────────────────────
  heroCard: {
    backgroundColor: T.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: T.accentLine,
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
    backgroundColor: T.goldSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconText: {
    fontSize: 17,
  },
  heroName: {
    fontSize: 15,
    fontWeight: '700',
    color: T.ink,
  },
  heroStock: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroStockNow: {
    fontSize: 20,
    fontWeight: '800',
    color: T.ink,
  },
  heroStockNowFull: {
    color: T.warning,
  },
  heroStockMax: {
    fontSize: 14,
    fontWeight: '600',
    color: T.ink3,
  },

  progressTrack: {
    height: 8,
    backgroundColor: T.surface3,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: T.progressGold,
    borderRadius: 999,
  },
  progressFillFull: {
    backgroundColor: T.warning,
  },

  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressMetaLeft: {
    fontSize: 12,
    color: T.ink3,
    fontWeight: '500',
  },
  progressMetaRight: {
    fontSize: 12,
    color: T.ink2,
  },
  progressMetaRightBold: {
    fontWeight: '800',
    color: T.ink,
  },

  // ── CTA ─────────────────────────────────────────
  ctaShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    borderRadius: Radius.md,
  },
  ctaBody: {
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    minHeight: 52,
  },
  ctaEmoji: {
    fontSize: 18,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // ── Banner ──────────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: T.warningSoft,
    borderWidth: 1,
    borderColor: T.warningBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: T.warning,
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
    color: T.warningInk,
  },
  bannerT2: {
    fontSize: 11,
    color: T.warningInkSub,
    marginTop: 2,
  },

  // ── Upgrade section ─────────────────────────────
  upgradeSection: {
    backgroundColor: T.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: T.accentLine,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  upgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: T.surface2,
    borderBottomWidth: 1,
    borderBottomColor: T.accentLine,
  },
  upgradeHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: T.ink3,
  },
  upgradeTarget: {
    backgroundColor: T.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  upgradeTargetText: {
    fontSize: 13,
    fontWeight: '800',
    color: T.primaryStrong,
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
    backgroundColor: T.surface2,
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
    color: T.ink3,
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
    color: T.ink3,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  upgradeArrow: {
    fontSize: 14,
    color: T.primary,
    fontWeight: '800',
  },
  upgradeTo: {
    fontSize: 17,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.3,
  },
  deltaBadge: {
    marginLeft: 'auto',
    backgroundColor: T.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deltaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: T.primaryStrong,
  },

  upgradeFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: T.accentLine,
    backgroundColor: T.surface2,
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
    color: T.ink3,
    fontWeight: '600',
  },
  upgradeCostVal: {
    fontSize: 18,
    fontWeight: '800',
    color: T.ink,
  },
  balanceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  balanceLbl: {
    fontSize: 12,
    color: T.ink3,
  },
  balanceVal: {
    fontSize: 12,
    fontWeight: '700',
    color: T.ink2,
  },

  // ── Max card ────────────────────────────────────
  maxCard: {
    backgroundColor: T.goldSoft,
    borderWidth: 1.5,
    borderColor: T.gold,
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
    color: T.goldStrong,
    letterSpacing: 0.2,
  },
  maxCardT2: {
    fontSize: 11,
    color: T.goldInk,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Non-productif (Phase 44) ─────────────────────
  nonProductiveCard: {
    backgroundColor: T.surface2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: T.accentLine,
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
    color: T.ink,
    marginBottom: 4,
  },
  nonProductiveBody: {
    fontSize: 13,
    color: T.ink3,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
});
