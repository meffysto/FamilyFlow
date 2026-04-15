// components/village/VillageBuildingModal.tsx
// Modal bâtiment village — production collective déclenchée par l'effort (tâches + récoltes).
// Esthétique "cozy farm game" : cadre bois, auvent rayé, fond parchemin,
// boutons glossy vert/bois, sprite hero, barre de progression chaleureuse.

import React, { useMemo } from 'react';
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
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { BUILDINGS_CATALOG } from '../../lib/village';
import type { UnlockedBuilding, VillageInventory, BuildingProductionState } from '../../lib/village/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';
import type { ImageSourcePropType } from 'react-native';

// ── Constantes farm game ────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Props ────────────────────────────────────────────────────────

interface VillageBuildingModalProps {
  visible: boolean;
  building: UnlockedBuilding;
  lifetimeContributions: number;
  productionState: BuildingProductionState;
  inventory: VillageInventory;
  onCollect: (buildingId: string) => void;
  onClose: () => void;
  /** Port uniquement — ouvre la modal d'échange inter-familles */
  onOpenTrade?: () => void;
  /** Multiplicateur tech (villageTechBonuses.productionRateMultiplier[buildingId]) — default 1 */
  techMultiplier?: number;
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
  variant: 'green' | 'wood';
  onPress?: () => void;
}

function FarmButton({ label, enabled, variant, onPress }: FarmButtonProps) {
  const pressedY = useSharedValue(0);

  const btnColors = variant === 'green'
    ? { bg: Farm.greenBtn, shadow: Farm.greenBtnShadow, highlight: Farm.greenBtnHighlight }
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
      style={styles.btnFullWidth}
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

// ── Composant principal ──────────────────────────────────────────

export function VillageBuildingModal({
  visible,
  building,
  lifetimeContributions,
  productionState,
  inventory,
  onCollect,
  onClose,
  onOpenTrade,
  techMultiplier = 1,
}: VillageBuildingModalProps) {
  // kept for potential theme-aware overrides in future
  const { colors } = useThemeColors();

  const entry = useMemo(
    () => BUILDINGS_CATALOG.find(b => b.id === building.buildingId),
    [building.buildingId],
  );

  if (!entry || !entry.production) return null;

  const { production } = entry;
  const consumed = productionState[building.buildingId] ?? 0;
  const available = Math.max(0, lifetimeContributions - consumed);
  const effectiveRate = Math.max(1, Math.floor(production.ratePerItem * techMultiplier));
  const pendingItems = Math.floor(available / effectiveRate);
  const progressInCycle = available % effectiveRate;
  const progressRatio = effectiveRate > 0 ? progressInCycle / effectiveRate : 0;
  const contribsUntilNext = effectiveRate - progressInCycle;
  const currentStock = inventory[production.itemId] ?? 0;

  const handleCollect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCollect(building.buildingId);
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

              {/* Titre du bâtiment */}
              <Animated.View
                entering={FadeIn.springify().damping(14).stiffness(200)}
                style={styles.farmTitle}
              >
                <Text style={styles.farmTitleText}>
                  {entry.labelFR}
                </Text>
              </Animated.View>

              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {/* Sprite bâtiment */}
                <Animated.View
                  style={styles.spriteHero}
                  entering={FadeIn.springify().damping(12).stiffness(180)}
                >
                  <Image
                    source={entry.sprite as ImageSourcePropType}
                    style={styles.spriteImg}
                    resizeMode="contain"
                  />
                </Animated.View>

                {/* Section production — rythme effort collectif */}
                <Animated.View
                  entering={FadeIn.delay(80).springify().damping(12).stiffness(180)}
                  style={styles.section}
                >
                  <Text style={styles.sectionTitle}>Production</Text>
                  <Text style={styles.sectionDetail}>
                    {production.itemEmoji} {production.itemLabel} — 1 par {production.ratePerItem} contribution{production.ratePerItem > 1 ? 's' : ''}
                  </Text>
                  {pendingItems === 0 && (
                    <>
                      {/* Barre de progression farm */}
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.round(progressRatio * 100)}%` as any },
                          ]}
                        >
                          <View style={styles.progressGloss} />
                        </View>
                      </View>
                      <Text style={styles.sectionDetailMuted}>
                        {'⏳ '}{contribsUntilNext} contribution{contribsUntilNext > 1 ? 's' : ''} avant le prochain {production.itemLabel.toLowerCase()}
                      </Text>
                    </>
                  )}
                </Animated.View>

                {/* Section collecte */}
                <Animated.View
                  entering={FadeIn.delay(140).springify().damping(12).stiffness(180)}
                  style={[
                    styles.section,
                    pendingItems > 0 && styles.sectionHighlighted,
                  ]}
                >
                  <Text style={styles.sectionTitle}>
                    {pendingItems > 0
                      ? `${pendingItems} ${production.itemEmoji} ${pendingItems === 1 ? production.itemLabel : production.itemLabel + 's'} prêt${pendingItems > 1 ? 's' : ''}`
                      : 'Rien à collecter'}
                  </Text>
                  <FarmButton
                    label={pendingItems > 0
                      ? `Collecter ${pendingItems} ${production.itemEmoji}`
                      : 'Aucun item disponible'}
                    enabled={pendingItems > 0}
                    variant="green"
                    onPress={handleCollect}
                  />
                </Animated.View>

                {/* Section inventaire collectif */}
                <Animated.View
                  entering={FadeIn.delay(200).springify().damping(12).stiffness(180)}
                  style={styles.section}
                >
                  <Text style={styles.sectionTitle}>Inventaire collectif</Text>
                  <View style={styles.inventoryRow}>
                    <Text style={styles.inventoryEmoji}>{production.itemEmoji}</Text>
                    <View style={styles.inventoryInfo}>
                      <Text style={styles.sectionDetail}>{production.itemLabel}</Text>
                      <Text style={[
                        styles.inventoryQty,
                        { color: currentStock > 0 ? Farm.greenBtn : Farm.brownTextSub },
                      ]}>
                        {currentStock} en stock
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Port — bouton échange inter-familles */}
                {building.buildingId === 'port' && onOpenTrade && (
                  <Animated.View entering={FadeIn.delay(260).springify().damping(12).stiffness(180)}>
                    <FarmButton
                      label="📦 Échange inter-familles"
                      enabled={true}
                      variant="wood"
                      onPress={onOpenTrade}
                    />
                  </Animated.View>
                )}

                {/* Palier de déblocage */}
                <View style={styles.palierRow}>
                  <Text style={styles.palierText}>
                    Débloqué à {entry.palier.toLocaleString('fr-FR')} feuilles familiales
                  </Text>
                </View>
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
    backgroundColor: Farm.woodLight,
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
    backgroundColor: Farm.parchment,
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
  },
  farmTitleText: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
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

  // ── Contenu ─────────────────────────────────────
  content: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.md,
    gap: Spacing.xl,
  },

  // ── Sections ────────────────────────────────────
  section: {
    backgroundColor: Farm.parchmentDark,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  sectionHighlighted: {
    borderColor: Farm.greenBtn,
  },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
  },
  sectionDetail: {
    fontSize: FontSize.sm,
    color: Farm.brownTextSub,
  },
  sectionDetailMuted: {
    fontSize: FontSize.sm,
    color: Farm.brownTextSub,
    opacity: 0.8,
  },

  // ── Barre de progression ────────────────────────
  progressTrack: {
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

  // ── Inventaire ──────────────────────────────────
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  inventoryEmoji: {
    fontSize: 32,
  },
  inventoryInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  inventoryQty: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // ── Palier ──────────────────────────────────────
  palierRow: {
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  palierText: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
    opacity: 0.75,
  },

  // ── Bouton farm 3D ──────────────────────────────
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
});
