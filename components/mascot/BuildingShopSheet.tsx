/**
 * BuildingShopSheet.tsx — Bottom sheet construction d'un batiment
 *
 * S'ouvre quand l'utilisateur tape sur une cellule batiment vide.
 * Affiche les batiments constructibles filtres par stade d'arbre et possession.
 * Look cozy farm game : cartes terre/bois, boutons 3D, animations spring d'entree.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { BUILDING_CATALOG, TREE_STAGES, type TreeStage, type PlacedBuilding } from '../../lib/mascot/types';
import { TECH_TREE } from '../../lib/mascot/tech-engine';
// Sprites inline pour garantir resolution Metro (niveau 1 pour l'aperçu boutique)
const SHOP_SPRITES: Record<string, any> = {
  poulailler: require('../../assets/buildings/poulailler_lv1.png'),
  grange: require('../../assets/buildings/grange_lv1.png'),
  moulin: require('../../assets/buildings/moulin_lv1.png'),
  ruche: require('../../assets/buildings/ruche_lv1.png'),
};
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

// ── Constantes animations ────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// Couleurs cosmétiques dorées (décision Phase 4 — constantes locales StyleSheet)
const GOLD_COLOR = '#FFD700';
const GOLD_OVERLAY = 'rgba(255,215,0,0.10)';
const GOLD_BORDER = 'rgba(255,215,0,0.18)';

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

// ── Utilitaire : index stade pour comparaison ────────────────────

const STAGE_ORDER = TREE_STAGES.map(s => s.stage);

function stageIndex(stage: TreeStage): number {
  return STAGE_ORDER.indexOf(stage);
}

// ── Sous-composant : ligne batiment animée ───────────────────────

interface BuildingRowProps {
  children: React.ReactNode;
  index: number;
  delay?: number;
}

function AnimatedBuildingRow({ children, index, delay = 0 }: BuildingRowProps) {
  return (
    <Animated.View
      entering={FadeIn.delay(index * 80 + delay).springify().damping(12).stiffness(180)}
    >
      {children}
    </Animated.View>
  );
}

// ── Sous-composant : bouton 3D ───────────────────────────────────

interface Button3DProps {
  label: string;
  enabled: boolean;
  backgroundColor: string;
  shadowColor: string;
  textColor: string;
  onPress?: () => void;
}

function Button3D({ label, enabled, backgroundColor, shadowColor, textColor, onPress }: Button3DProps) {
  const pressedY = useSharedValue(0);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressedY.value }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressedY.value / 3,
  }));

  return (
    <TouchableOpacity
      onPress={enabled ? onPress : undefined}
      activeOpacity={enabled ? 0.85 : 1}
      onPressIn={() => {
        pressedY.value = withSpring(3, SPRING_CONFIG);
      }}
      onPressOut={() => {
        pressedY.value = withSpring(0, SPRING_CONFIG);
      }}
    >
      {/* Ombre 3D (bande inférieure) */}
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
          btnStyle,
        ]}
      >
        <Text style={[styles.buildBtnText, { color: textColor }]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
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
  const { colors, primary } = useThemeColors();

  const currentStageIdx = stageIndex(treeStage);

  // Calculer la couleur d'ombre du bouton primaire (version plus sombre du primary)
  const primaryShadow = primary + 'AA';

  // Filtrer les batiments disponibles
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
        <View style={[styles.sheet, { backgroundColor: colors.cardAlt }]}>

          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header décoratif avec bannière */}
          <View style={[styles.headerBanner, { borderBottomColor: GOLD_BORDER }]}>
            {/* Overlay doré subtil */}
            <View style={[styles.headerGoldOverlay, { backgroundColor: GOLD_OVERLAY }]} />

            <View style={styles.headerInner}>
              <Text style={styles.headerEmoji}>🏗️</Text>
              <View style={styles.headerTextBlock}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {t('farm.building.constructTitle')}
                </Text>
                <Text style={[styles.headerCoins, { color: colors.textSub }]}>
                  {'🍃 '}{coins}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Text style={[styles.closeBtnText, { color: colors.textSub }]}>{'✕'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {availableBuildings.length === 0 && lockedBuildings.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('farm.building.noAvailable')}
              </Text>
            )}

            {availableBuildings.map((def, index) => {
              const tier0 = def.tiers[0];
              const canAfford = coins >= def.cost;
              const sprite = SHOP_SPRITES[def.id];

              return (
                <AnimatedBuildingRow key={def.id} index={index}>
                  <View
                    style={[
                      styles.buildingRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                      Shadows.md,
                    ]}
                  >
                    {/* Sprite avec fond circulaire */}
                    <View style={[styles.spriteCircle, { backgroundColor: colors.cardAlt }]}>
                      {sprite ? (
                        <Image source={sprite} style={styles.sprite} />
                      ) : (
                        <Text style={styles.spriteEmoji}>{def.emoji}</Text>
                      )}
                    </View>

                    {/* Infos */}
                    <View style={styles.infoBox}>
                      <Text style={[styles.buildingName, { color: colors.text }]}>
                        {t(def.labelKey)}
                      </Text>
                      <Text style={[styles.buildingDetail, { color: colors.textSub }]}>
                        {t('farm.building.frequency', {
                          resource: t(`farm.building.resource.${def.resourceType}`),
                          hours: tier0.productionRateHours,
                        })}
                      </Text>
                      <Text style={[styles.buildingCost, { color: canAfford ? colors.success : colors.textMuted }]}>
                        {t('farm.building.cost', { cost: def.cost })}
                      </Text>
                    </View>

                    {/* Bouton 3D */}
                    <Button3D
                      label={t('farm.building.construct')}
                      enabled={canAfford}
                      backgroundColor={canAfford ? primary : colors.borderLight}
                      shadowColor={canAfford ? primaryShadow : colors.border}
                      textColor={canAfford ? colors.bg : colors.textMuted}
                      onPress={() => onBuild(def.id)}
                    />
                  </View>
                </AnimatedBuildingRow>
              );
            })}

            {/* Batiments verrouillés */}
            {lockedBuildings.map((def, index) => {
              const tier0 = def.tiers[0];
              const techNode = def.techRequired ? TECH_TREE.find(n => n.id === def.techRequired) : null;
              const lockReason = def.techRequired && !unlockedTechs.includes(def.techRequired) && techNode
                ? t('farm.building.unlockedByTech', { tech: t(`tech.${techNode.id}`) })
                : t('farm.building.unlockedAt', { stage: t(`mascot.stages.${def.minTreeStage}`) });
              return (
                <AnimatedBuildingRow key={def.id} index={index} delay={availableBuildings.length * 80 + 60}>
                  <View
                    style={[
                      styles.buildingRow,
                      styles.lockedRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.borderLight,
                        opacity: 0.6,
                      },
                    ]}
                  >
                    <View style={[styles.spriteCircle, { backgroundColor: colors.cardAlt }]}>
                      {SHOP_SPRITES[def.id] ? (
                        <Image source={SHOP_SPRITES[def.id]} style={[styles.sprite, { opacity: 0.5 }]} />
                      ) : (
                        <Text style={styles.spriteEmoji}>{def.emoji}</Text>
                      )}
                    </View>
                    <View style={styles.infoBox}>
                      <Text style={[styles.buildingName, { color: colors.text }]}>
                        {t(def.labelKey)}
                      </Text>
                      <Text style={[styles.buildingDetail, { color: colors.textSub }]}>
                        {t('farm.building.frequency', {
                          resource: t(`farm.building.resource.${def.resourceType}`),
                          hours: tier0.productionRateHours,
                        })}
                      </Text>
                      <Text style={[styles.buildingCost, { color: colors.textMuted }]}>
                        {def.cost} 🍃
                      </Text>
                      <Text style={[styles.buildingDetail, { color: colors.textMuted }]}>
                        {'🔒 '}{lockReason}
                      </Text>
                    </View>
                  </View>
                </AnimatedBuildingRow>
              );
            })}
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
    marginBottom: Spacing.md,
  },
  // Header bannière décoratif
  headerBanner: {
    borderBottomWidth: 1,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  headerGoldOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    gap: Spacing.xl,
  },
  headerEmoji: {
    fontSize: FontSize.icon,
  },
  headerTextBlock: {
    flex: 1,
    gap: Spacing.xxs,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  headerCoins: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  closeBtn: {
    padding: Spacing.md,
  },
  closeBtnText: {
    fontSize: FontSize.lg,
  },
  list: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    gap: Spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginTop: Spacing['3xl'],
  },
  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    padding: Spacing['2xl'],
    gap: Spacing.xl,
  },
  lockedRow: {},
  // Fond circulaire derrière le sprite
  spriteCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
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
    gap: Spacing.xs,
  },
  buildingName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  buildingDetail: {
    fontSize: FontSize.label,
  },
  buildingCost: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  // Bouton 3D
  btn3DShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  btn3DBody: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginBottom: 3,
  },
  buildBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
