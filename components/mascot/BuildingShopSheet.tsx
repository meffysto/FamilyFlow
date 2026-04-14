/**
 * BuildingShopSheet.tsx — Boutique de construction farm-game
 *
 * S'ouvre quand l'utilisateur tape sur une cellule batiment vide.
 * Esthétique "cozy farm game" : cadre bois, auvent rayé, fond parchemin,
 * cartes avec sprite circulaire, boutons glossy vert.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { BUILDING_CATALOG, TREE_STAGES, type TreeStage, type PlacedBuilding } from '../../lib/mascot/types';
import { TECH_TREE } from '../../lib/mascot/tech-engine';
const SHOP_SPRITES: Record<string, any> = {
  poulailler: require('../../assets/buildings/poulailler_lv1.png'),
  grange: require('../../assets/buildings/grange_lv1.png'),
  moulin: require('../../assets/buildings/moulin_lv1.png'),
  ruche: require('../../assets/buildings/ruche_lv1.png'),
};
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import { Farm } from '../../constants/farm-theme';

// ── Constantes farm game ────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ── Props ────────────────────────────────────────────────────────

interface BuildingShopSheetProps {
  visible: boolean;
  cellId: string;
  treeStage: TreeStage;
  coins: number;
  ownedBuildings: PlacedBuilding[];
  unlockedTechs: string[];
  onBuild: (buildingId: string) => void;
  onClose: () => void;
}

// ── Utilitaire ──────────────────────────────────────────────────

const STAGE_ORDER = TREE_STAGES.map(s => s.stage);
function stageIndex(stage: TreeStage): number {
  return STAGE_ORDER.indexOf(stage);
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

// ── Sous-composant : bouton farm 3D ─────────────────────────────

interface FarmButtonProps {
  label: string;
  enabled: boolean;
  onPress?: () => void;
}

function FarmButton({ label, enabled, onPress }: FarmButtonProps) {
  const pressedY = useSharedValue(0);

  const bg = enabled ? Farm.greenBtn : Farm.parchmentDark;
  const shadow = enabled ? Farm.greenBtnShadow : '#D0CBC3';
  const highlight = enabled ? Farm.greenBtnHighlight : Farm.parchment;

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
    >
      <Animated.View
        style={[styles.farmBtnShadow, { backgroundColor: shadow }, shadowStyle]}
      />
      <Animated.View style={[styles.farmBtnBody, { backgroundColor: bg }, btnStyle]}>
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

export function BuildingShopSheet({
  visible,
  cellId,
  treeStage,
  coins,
  ownedBuildings,
  unlockedTechs,
  onBuild,
  onClose,
}: BuildingShopSheetProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const currentStageIdx = stageIndex(treeStage);

  const availableBuildings = useMemo(() => {
    const ownedIds = new Set(ownedBuildings.map(b => b.buildingId));
    return BUILDING_CATALOG.filter(def => {
      const minIdx = stageIndex(def.minTreeStage);
      const stageOk = minIdx <= currentStageIdx;
      const techOk = !def.techRequired || unlockedTechs.includes(def.techRequired);
      return stageOk && techOk && !ownedIds.has(def.id);
    });
  }, [ownedBuildings, currentStageIdx, unlockedTechs]);

  const lockedBuildings = useMemo(() => {
    const ownedIds = new Set(ownedBuildings.map(b => b.buildingId));
    return BUILDING_CATALOG.filter(def => {
      const minIdx = stageIndex(def.minTreeStage);
      const stageOk = minIdx <= currentStageIdx;
      const techOk = !def.techRequired || unlockedTechs.includes(def.techRequired);
      return (!stageOk || !techOk) && !ownedIds.has(def.id);
    });
  }, [ownedBuildings, currentStageIdx, unlockedTechs]);

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
            {/* Auvent rayé */}
            <AwningStripes />

            {/* Fond parchemin */}
            <View style={styles.parchment}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Titre + solde */}
              <Animated.View
                entering={FadeIn.springify().damping(14).stiffness(200)}
                style={styles.farmTitle}
              >
                <Text style={styles.farmTitleText}>
                  {t('farm.building.constructTitle')}
                </Text>
                <View style={styles.coinsBadge}>
                  <Text style={styles.coinsText}>{'🍃 '}{coins}</Text>
                </View>
              </Animated.View>

              <ScrollView
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
              >
                {availableBuildings.length === 0 && lockedBuildings.length === 0 && (
                  <Text style={styles.emptyText}>
                    {t('farm.building.noAvailable')}
                  </Text>
                )}

                {availableBuildings.map((def, index) => {
                  const tier0 = def.tiers[0];
                  const canAfford = coins >= def.cost;
                  const sprite = SHOP_SPRITES[def.id];

                  return (
                    <Animated.View
                      key={def.id}
                      entering={FadeIn.delay(index * 80).springify().damping(12).stiffness(180)}
                    >
                      <View style={styles.buildingCard}>
                        {/* Sprite rond */}
                        <View style={styles.spriteCircle}>
                          {sprite ? (
                            <Image source={sprite} style={styles.sprite} />
                          ) : (
                            <Text style={styles.spriteEmoji}>{def.emoji}</Text>
                          )}
                        </View>

                        {/* Infos */}
                        <View style={styles.infoBox}>
                          <Text style={styles.buildingName}>
                            {t(def.labelKey)}
                          </Text>
                          <Text style={styles.buildingDetail}>
                            {t('farm.building.frequency', {
                              resource: t(`farm.building.resource.${def.resourceType}`),
                              hours: tier0.productionRateHours,
                            })}
                          </Text>
                          <Text style={[
                            styles.buildingCost,
                            { color: canAfford ? Farm.greenBtn : Farm.brownTextSub },
                          ]}>
                            {t('farm.building.cost', { cost: def.cost })}
                          </Text>
                        </View>

                        {/* Bouton */}
                        <FarmButton
                          label={t('farm.building.construct')}
                          enabled={canAfford}
                          onPress={() => onBuild(def.id)}
                        />
                      </View>
                    </Animated.View>
                  );
                })}

                {/* Bâtiments verrouillés */}
                {lockedBuildings.map((def, index) => {
                  const tier0 = def.tiers[0];
                  const techNode = def.techRequired ? TECH_TREE.find(n => n.id === def.techRequired) : null;
                  const lockReason = def.techRequired && !unlockedTechs.includes(def.techRequired) && techNode
                    ? t('farm.building.unlockedByTech', { tech: t(`tech.${techNode.id}`) })
                    : t('farm.building.unlockedAt', { stage: t(`mascot.stages.${def.minTreeStage}`) });
                  return (
                    <Animated.View
                      key={def.id}
                      entering={FadeIn.delay(availableBuildings.length * 80 + 60 + index * 80).springify().damping(12).stiffness(180)}
                    >
                      <View style={[styles.buildingCard, styles.lockedCard]}>
                        <View style={[styles.spriteCircle, { opacity: 0.4 }]}>
                          {SHOP_SPRITES[def.id] ? (
                            <Image source={SHOP_SPRITES[def.id]} style={styles.sprite} />
                          ) : (
                            <Text style={styles.spriteEmoji}>{def.emoji}</Text>
                          )}
                        </View>
                        <View style={styles.infoBox}>
                          <Text style={[styles.buildingName, { opacity: 0.6 }]}>
                            {t(def.labelKey)}
                          </Text>
                          <Text style={styles.buildingDetail}>
                            {t('farm.building.frequency', {
                              resource: t(`farm.building.resource.${def.resourceType}`),
                              hours: tier0.productionRateHours,
                            })}
                          </Text>
                          <Text style={styles.buildingCost}>
                            {def.cost} 🍃
                          </Text>
                          <Text style={styles.lockReason}>
                            {'🔒 '}{lockReason}
                          </Text>
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}
              </ScrollView>
            </View>

            {/* Bouton fermer */}
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
    maxHeight: '80%',
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
  coinsBadge: {
    backgroundColor: Farm.parchmentDark,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxs,
    borderWidth: 1,
    borderColor: Farm.woodHighlight,
  },
  coinsText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },

  // ── Liste ───────────────────────────────────────
  list: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.md,
    gap: Spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginTop: Spacing['3xl'],
    color: Farm.brownTextSub,
  },

  // ── Carte bâtiment ──────────────────────────────
  buildingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  lockedCard: {
    opacity: 0.5,
  },
  spriteCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchment,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sprite: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  spriteEmoji: {
    fontSize: FontSize.icon,
  },
  infoBox: {
    flex: 1,
    gap: Spacing.xxs,
  },
  buildingName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  buildingDetail: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
  },
  buildingCost: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
  },
  lockReason: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
    fontStyle: 'italic',
  },

  // ── Bouton farm 3D ──────────────────────────────
  farmBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  farmBtnBody: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
    fontSize: FontSize.sm,
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
