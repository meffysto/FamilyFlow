// components/village/VillageBuildingModal.tsx
// Modal bâtiment village — production collective déclenchée par l'effort (tâches + récoltes).
// Pattern identique à BuildingDetailSheet (ferme) : pageSheet slide + handle + sections.

import React, { useMemo } from 'react';
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
import { useThemeColors } from '../../contexts/ThemeContext';
import { BUILDINGS_CATALOG } from '../../lib/village';
import type { UnlockedBuilding, VillageInventory, BuildingProductionState } from '../../lib/village/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import type { ImageSourcePropType } from 'react-native';

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
}

// ── Composant ────────────────────────────────────────────────────

export function VillageBuildingModal({
  visible,
  building,
  lifetimeContributions,
  productionState,
  inventory,
  onCollect,
  onClose,
  onOpenTrade,
}: VillageBuildingModalProps) {
  const { colors, primary } = useThemeColors();

  const entry = useMemo(
    () => BUILDINGS_CATALOG.find(b => b.id === building.buildingId),
    [building.buildingId],
  );

  if (!entry) return null;

  const { production } = entry;
  const consumed = productionState[building.buildingId] ?? 0;
  const available = Math.max(0, lifetimeContributions - consumed);
  const pendingItems = Math.floor(available / production.ratePerItem);
  const progressInCycle = available % production.ratePerItem;
  const progressRatio = production.ratePerItem > 0 ? progressInCycle / production.ratePerItem : 0;
  const contribsUntilNext = production.ratePerItem - progressInCycle;
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
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {entry.labelFR}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeBtnText, { color: colors.textSub }]}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Sprite bâtiment */}
            <View style={styles.spriteContainer}>
              <Image
                source={entry.sprite as ImageSourcePropType}
                style={styles.sprite}
                resizeMode="contain"
              />
            </View>

            {/* Section production — rythme effort collectif */}
            <View style={[styles.section, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Production
              </Text>
              <Text style={[styles.sectionDetail, { color: colors.textSub }]}>
                {production.itemEmoji} {production.itemLabel} — 1 par {production.ratePerItem} contribution{production.ratePerItem > 1 ? 's' : ''}
              </Text>
              {pendingItems === 0 && (
                <>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.round(progressRatio * 100)}%`, backgroundColor: primary },
                      ]}
                    />
                  </View>
                  <Text style={[styles.sectionDetail, { color: colors.textMuted }]}>
                    {'⏳ '}{contribsUntilNext} contribution{contribsUntilNext > 1 ? 's' : ''} avant le prochain {production.itemLabel.toLowerCase()}
                  </Text>
                </>
              )}
            </View>

            {/* Section collecte */}
            <View style={[
              styles.section,
              { backgroundColor: colors.cardAlt, borderColor: pendingItems > 0 ? '#4ADE80' : colors.borderLight },
            ]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {pendingItems > 0
                  ? `${pendingItems} ${production.itemEmoji} ${pendingItems === 1 ? production.itemLabel : production.itemLabel + 's'} prêt${pendingItems > 1 ? 's' : ''}`
                  : 'Rien à collecter'}
              </Text>
              <TouchableOpacity
                onPress={pendingItems > 0 ? handleCollect : undefined}
                activeOpacity={pendingItems > 0 ? 0.7 : 1}
                style={[
                  styles.collectBtn,
                  { backgroundColor: pendingItems > 0 ? '#4ADE80' : colors.borderLight },
                ]}
              >
                <Text style={[
                  styles.collectBtnText,
                  { color: pendingItems > 0 ? '#FFFFFF' : colors.textMuted },
                ]}>
                  {pendingItems > 0
                    ? `Collecter ${pendingItems} ${production.itemEmoji}`
                    : 'Aucun item disponible'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Section inventaire collectif */}
            <View style={[styles.section, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Inventaire collectif
              </Text>
              <View style={styles.inventoryRow}>
                <Text style={[styles.inventoryEmoji]}>{production.itemEmoji}</Text>
                <View style={styles.inventoryInfo}>
                  <Text style={[styles.sectionDetail, { color: colors.text }]}>
                    {production.itemLabel}
                  </Text>
                  <Text style={[styles.inventoryQty, { color: currentStock > 0 ? primary : colors.textMuted }]}>
                    {currentStock} en stock
                  </Text>
                </View>
              </View>
            </View>

            {/* Port — bouton échange inter-familles */}
            {building.buildingId === 'port' && onOpenTrade && (
              <TouchableOpacity
                style={[styles.tradeBtn, { backgroundColor: primary }]}
                onPress={onOpenTrade}
                activeOpacity={0.7}
              >
                <Text style={styles.tradeBtnText}>📦 Échange inter-familles</Text>
              </TouchableOpacity>
            )}

            {/* Palier de déblocage */}
            <View style={styles.palierRow}>
              <Text style={[styles.palierText, { color: colors.textMuted }]}>
                Débloqué à {entry.palier.toLocaleString('fr-FR')} feuilles familiales
              </Text>
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
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
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
  palierRow: {
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  tradeBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
  },
  tradeBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  palierText: {
    fontSize: FontSize.label,
  },
});
