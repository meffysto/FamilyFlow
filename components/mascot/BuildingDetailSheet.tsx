/**
 * BuildingDetailSheet.tsx — Bottom sheet detail/collecte/amelioration d'un batiment
 *
 * S'ouvre quand l'utilisateur tape sur un batiment place sur la grille.
 * Affiche le detail du batiment, permet la collecte et l'amelioration.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
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

// ── Props ────────────────────────────────────────────────────────

interface BuildingDetailSheetProps {
  visible: boolean;
  building: PlacedBuilding;
  coins: number;
  techBonuses?: TechBonuses;
  onCollect: (cellId: string) => void;
  onUpgrade: (cellId: string) => void;
  onClose: () => void;
}

// ── Composant ────────────────────────────────────────────────────

export function BuildingDetailSheet({
  visible,
  building,
  coins,
  techBonuses,
  onCollect,
  onUpgrade,
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
  const resourceEmoji = def.resourceType === 'oeuf' ? '🥚' : def.resourceType === 'lait' ? '🥛' : def.resourceType === 'miel' ? '🍯' : '🌾';
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
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {def.emoji} {t(def.labelKey)} — {t('farm.building.level', { level: building.level })}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeBtnText, { color: colors.textSub }]}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Sprite */}
            <View style={styles.spriteContainer}>
              {sprite ? (
                <Image source={sprite} style={styles.sprite} />
              ) : (
                <Text style={styles.spriteEmoji}>{def.emoji}</Text>
              )}
            </View>

            {/* Section production */}
            <View style={[styles.section, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Production
              </Text>
              <Text style={[styles.sectionDetail, { color: colors.textSub }]}>
                {resourceEmoji} {t('farm.building.frequency', {
                  resource: resourceLabel,
                  hours: Math.round(effectiveRateHours * 10) / 10,
                })}
              </Text>
              {timerLabel ? (
                <>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.round(progressRatio * 100)}%`, backgroundColor: primary }]} />
                  </View>
                  <Text style={[styles.sectionDetail, { color: primary }]}>
                    {'⏳ '}{t('farm.building.nextIn', { time: timerLabel, defaultValue: `Prochain ${resourceLabel} dans ${timerLabel}` })}
                  </Text>
                </>
              ) : pendingCount > 0 ? null : (
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: '100%', backgroundColor: '#4ADE80' }]} />
                </View>
              )}
            </View>

            {/* Section collecte */}
            <View style={[styles.section, { backgroundColor: colors.cardAlt, borderColor: isFull ? '#F59E0B' : colors.borderLight }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {pendingCount > 0
                  ? t('farm.building.pendingOf', { count: pendingCount, max: effectiveMaxPending, resource: resourceLabel })
                  : t('farm.building.noPending')}
              </Text>
              {isFull && (
                <Text style={{ color: '#F59E0B', fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>
                  {t('farm.building.storageFull')}
                </Text>
              )}
              <TouchableOpacity
                onPress={pendingCount > 0 ? handleCollect : undefined}
                activeOpacity={pendingCount > 0 ? 0.7 : 1}
                style={[
                  styles.collectBtn,
                  {
                    backgroundColor: pendingCount > 0 ? '#4ADE80' : colors.borderLight,
                  },
                ]}
              >
                <Text style={[
                  styles.collectBtnText,
                  { color: pendingCount > 0 ? '#FFFFFF' : colors.textMuted },
                ]}>
                  {pendingCount > 0
                    ? t('farm.building.collect', { count: pendingCount, resource: resourceLabel })
                    : t('farm.building.noPending')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Section amelioration */}
            <View style={[styles.section, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
              {upgradable && nextTier ? (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Amelioration
                  </Text>
                  <Text style={[styles.sectionDetail, { color: colors.textSub }]}>
                    {t('farm.building.frequency', {
                      resource: resourceLabel,
                      hours: Math.round(nextTier.productionRateHours * (techBonuses?.productionIntervalMultiplier ?? 1.0) * 10) / 10,
                    })}
                  </Text>
                  <Text style={[styles.sectionDetail, { color: coins >= upgradeCost ? '#4ADE80' : colors.textMuted }]}>
                    {t('farm.building.upgradeCost', { cost: upgradeCost })}
                  </Text>
                  <TouchableOpacity
                    onPress={coins >= upgradeCost ? () => onUpgrade(building.cellId) : undefined}
                    activeOpacity={coins >= upgradeCost ? 0.7 : 1}
                    style={[
                      styles.upgradeBtn,
                      {
                        backgroundColor: coins >= upgradeCost ? primary : colors.borderLight,
                      },
                    ]}
                  >
                    <Text style={[
                      styles.upgradeBtnText,
                      { color: coins >= upgradeCost ? '#FFFFFF' : colors.textMuted },
                    ]}>
                      {t('farm.building.upgrade', { level: building.level + 1 })}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.maxLevelRow}>
                  <Text style={[styles.maxLevelBadge, { backgroundColor: '#FFD700', color: '#7B5300' }]}>
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
            </View>
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
    flex: 1,
    marginRight: Spacing.md,
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
  spriteContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  sprite: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },
  spriteEmoji: {
    fontSize: 56,
  },
  section: {
    borderRadius: Radius.lg,
    borderWidth: 1,
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
  collectBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  collectBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  upgradeBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  upgradeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
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
