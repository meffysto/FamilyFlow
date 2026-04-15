/**
 * PlotUpgradeSheet.tsx — Bottom sheet d'amélioration de parcelle
 *
 * Affiché via long press sur une parcelle dans WorldGridView.
 * Montre le niveau actuel, le prochain bonus et le coût.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import {
  MAX_PLOT_LEVEL,
  PLOT_UPGRADE_COSTS,
  PLOT_LEVEL_BONUSES,
  getPlotLevel,
  getPlotUpgradeCost,
} from '../../lib/mascot/farm-engine';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { ModalHeader } from '../ui';

// ── Sprites ──────────────────────────────────────────────────────────────────

const DIRT_SPRITES: Record<number, number> = {
  1: require('../../assets/garden/ground/dirt_patch.png'),
  2: require('../../assets/garden/ground/dirt_enriched.png'),
  3: require('../../assets/garden/ground/dirt_fertile.png'),
  4: require('../../assets/garden/ground/dirt_golden.png'),
  5: require('../../assets/garden/ground/dirt_crystal.png'),
};

const LEVEL_NAMES: Record<number, string> = {
  1: 'Terre simple',
  2: 'Terre enrichie',
  3: 'Terre fertile',
  4: 'Terre dorée',
  5: 'Terre cristalline',
};

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'Parcelle de base',
  2: 'Pousse -1 tâche par stade',
  3: 'Pousse -1 tâche + chance doré ×2',
  4: 'Pousse -2 tâches + chance doré ×3',
  5: 'Pousse -2 tâches + double récolte garantie',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface PlotUpgradeSheetProps {
  visible: boolean;
  onClose: () => void;
  plotIndex: number;
  plotLevels?: number[];
  coins: number;
  onUpgrade: (plotIndex: number) => Promise<boolean>;
  onMessage?: (text: string, type?: 'success' | 'error') => void;
}

// ── Composant ────────────────────────────────────────────────────────────────

export function PlotUpgradeSheet({
  visible,
  onClose,
  plotIndex,
  plotLevels,
  coins,
  onUpgrade,
  onMessage,
}: PlotUpgradeSheetProps) {
  const { primary, colors } = useThemeColors();
  const currentLevel = getPlotLevel(plotLevels, plotIndex);
  const isMax = currentLevel >= MAX_PLOT_LEVEL;
  const upgradeCost = getPlotUpgradeCost(currentLevel);
  const canAfford = upgradeCost !== null && coins >= upgradeCost;
  const nextLevel = Math.min(currentLevel + 1, MAX_PLOT_LEVEL);

  const handleUpgrade = useCallback(() => {
    if (!upgradeCost) return;
    Alert.alert(
      'Améliorer la parcelle ?',
      `Niveau ${currentLevel} → ${nextLevel}\n${LEVEL_DESCRIPTIONS[nextLevel]}\n\nCoût : ${upgradeCost.toLocaleString('fr-FR')} 🍃`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Améliorer',
          style: 'default',
          onPress: async () => {
            try {
              await onUpgrade(plotIndex);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onMessage?.(`Parcelle ${plotIndex + 1} améliorée au niveau ${nextLevel} !`, 'success');
              onClose();
            } catch (e: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              onMessage?.(e.message ?? 'Erreur', 'error');
            }
          },
        },
      ],
    );
  }, [upgradeCost, currentLevel, nextLevel, plotIndex, onUpgrade, onMessage, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ModalHeader title={`Parcelle ${plotIndex + 1}`} onClose={onClose} />

        <View style={styles.content}>
          {/* Aperçu sprite actuel */}
          <View style={styles.previewRow}>
            <View style={styles.previewCard}>
              <Image
                source={DIRT_SPRITES[currentLevel] ?? DIRT_SPRITES[1]}
                style={styles.previewSprite}
              />
              <Text style={[styles.previewLabel, { color: colors.text }]}>
                Niv. {currentLevel}
              </Text>
              <Text style={[styles.previewName, { color: colors.textSub }]}>
                {LEVEL_NAMES[currentLevel]}
              </Text>
            </View>

            {!isMax && (
              <>
                <Text style={[styles.arrow, { color: colors.textSub }]}>→</Text>
                <View style={styles.previewCard}>
                  <Image
                    source={DIRT_SPRITES[nextLevel] ?? DIRT_SPRITES[1]}
                    style={styles.previewSprite}
                  />
                  <Text style={[styles.previewLabel, { color: primary }]}>
                    Niv. {nextLevel}
                  </Text>
                  <Text style={[styles.previewName, { color: colors.textSub }]}>
                    {LEVEL_NAMES[nextLevel]}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Bonus actuel */}
          <View style={[styles.bonusCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
            <Text style={[styles.bonusTitle, { color: colors.text }]}>Bonus actuel</Text>
            <Text style={[styles.bonusDesc, { color: colors.textSub }]}>
              {LEVEL_DESCRIPTIONS[currentLevel]}
            </Text>
          </View>

          {/* Prochain bonus */}
          {!isMax && (
            <View style={[styles.bonusCard, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
              <Text style={[styles.bonusTitle, { color: colors.successText }]}>Prochain niveau</Text>
              <Text style={[styles.bonusDesc, { color: colors.successText }]}>
                {LEVEL_DESCRIPTIONS[nextLevel]}
              </Text>
            </View>
          )}

          {/* Progression niveaux */}
          <View style={styles.levelBar}>
            {Array.from({ length: MAX_PLOT_LEVEL }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.levelDot,
                  {
                    backgroundColor: i < currentLevel ? colors.success : colors.borderLight,
                  },
                ]}
              />
            ))}
          </View>

          {/* Bouton upgrade ou MAX */}
          {isMax ? (
            <View style={[styles.maxBadge, { backgroundColor: colors.infoBg }]}>
              <Text style={[styles.maxText, { color: colors.info }]}>
                Niveau maximum atteint ✨
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.upgradeButton,
                { backgroundColor: canAfford ? colors.success : colors.borderLight },
              ]}
              onPress={handleUpgrade}
              disabled={!canAfford}
              activeOpacity={0.7}
            >
              <Text style={[styles.upgradeButtonText, { color: canAfford ? '#fff' : colors.textSub }]}>
                Améliorer — {upgradeCost?.toLocaleString('fr-FR')} 🍃
              </Text>
              {!canAfford && (
                <Text style={[styles.insufficientText, { color: colors.error }]}>
                  Il te manque {((upgradeCost ?? 0) - coins).toLocaleString('fr-FR')} 🍃
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Solde */}
          <Text style={[styles.balance, { color: colors.textSub }]}>
            Solde : {coins.toLocaleString('fr-FR')} 🍃
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing['2xl'],
    gap: Spacing.xl,
    alignItems: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  previewCard: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  previewSprite: {
    width: 80,
    height: 80,
  },
  previewLabel: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  previewName: {
    fontSize: FontSize.caption,
  },
  arrow: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
  },
  bonusCard: {
    width: '100%',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  bonusTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  bonusDesc: {
    fontSize: FontSize.caption,
  },
  levelBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  levelDot: {
    width: 24,
    height: 6,
    borderRadius: 3,
  },
  maxBadge: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.lg,
  },
  maxText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  upgradeButton: {
    width: '100%',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  upgradeButtonText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  insufficientText: {
    fontSize: FontSize.caption,
  },
  balance: {
    fontSize: FontSize.caption,
  },
});
