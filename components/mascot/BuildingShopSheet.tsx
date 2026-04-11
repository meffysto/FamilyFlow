/**
 * BuildingShopSheet.tsx — Bottom sheet construction d'un batiment
 *
 * S'ouvre quand l'utilisateur tape sur une cellule batiment vide.
 * Affiche les batiments constructibles filtres par stade d'arbre et possession.
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

// ── Composant ────────────────────────────────────────────────────

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
  const { colors, primary, tint } = useThemeColors();

  const currentStageIdx = stageIndex(treeStage);

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
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('farm.building.constructTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeBtnText, { color: colors.textSub }]}>{'✕'}</Text>
            </TouchableOpacity>
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

            {availableBuildings.map(def => {
              const tier0 = def.tiers[0];
              const canAfford = coins >= def.cost;
              const sprite = SHOP_SPRITES[def.id];

              return (
                <View
                  key={def.id}
                  style={[
                    styles.buildingRow,
                    { backgroundColor: colors.cardAlt, borderColor: colors.borderLight },
                  ]}
                >
                  {/* Sprite */}
                  <View style={styles.spriteBox}>
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
                    <Text style={[styles.buildingCost, { color: canAfford ? '#4ADE80' : colors.textMuted }]}>
                      {t('farm.building.cost', { cost: def.cost })}
                    </Text>
                  </View>

                  {/* Bouton */}
                  <TouchableOpacity
                    onPress={canAfford ? () => onBuild(def.id) : undefined}
                    activeOpacity={canAfford ? 0.7 : 1}
                    style={[
                      styles.buildBtn,
                      {
                        backgroundColor: canAfford ? primary : colors.borderLight,
                      },
                    ]}
                  >
                    <Text style={[styles.buildBtnText, { color: canAfford ? '#FFFFFF' : colors.textMuted }]}>
                      {t('farm.building.construct')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Batiments verrouilles */}
            {lockedBuildings.map(def => {
              const tier0 = def.tiers[0];
              const stageOk = stageIndex(def.minTreeStage) <= currentStageIdx;
              const techNode = def.techRequired ? TECH_TREE.find(n => n.id === def.techRequired) : null;
              const lockReason = def.techRequired && !unlockedTechs.includes(def.techRequired) && techNode
                ? t('farm.building.unlockedByTech', { tech: t(`tech.${techNode.id}`) })
                : t('farm.building.unlockedAt', { stage: t(`mascot.stages.${def.minTreeStage}`) });
              return (
                <View
                  key={def.id}
                  style={[
                    styles.buildingRow,
                    styles.lockedRow,
                    { backgroundColor: colors.cardAlt, borderColor: colors.borderLight, opacity: 0.6 },
                  ]}
                >
                  <View style={styles.spriteBox}>
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
                      🔒 {lockReason}
                    </Text>
                  </View>
                </View>
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
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
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
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  lockedRow: {},
  spriteBox: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sprite: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  spriteEmoji: {
    fontSize: 28,
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
  buildBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
  },
  buildBtnText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
