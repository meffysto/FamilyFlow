/**
 * WagerSealerSheet.tsx — Phase 40 Plan 02
 *
 * Modal pageSheet secondaire empilé après le seed picker : propose 3 durées
 * (Chill ×1.3 / Engagé ×1.7 / Sprint ×2.5) avec preview prorata (multiplier,
 * durée absolue, cadence requise, cumul cible), + option "Pas cette fois".
 *
 * Style cozy partagé avec CraftSheet (auvent, parchemin, bois).
 *
 * Trois paths de sortie garantis :
 *   - onConfirmSeal(duration) → sceller Sporée (consomme 1 Sporée, plante wager)
 *   - onConfirmSkip()         → planter normalement (zéro Sporée consommée)
 *   - onCancel()              → annuler (header close / dismiss, aucune plantation)
 */

import React, { useCallback, useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Farm } from '../../constants/farm-theme';

import { computeWagerDurations, type WagerDurationOption } from '../../lib/mascot/wager-ui-helpers';
import { classifyHarvestTier } from '../../lib/mascot/sporee-economy';
import type { WagerDuration } from '../../lib/mascot/types';
import type { Profile, Task } from '../../lib/types';

// ─────────────────────────────────────────────
// Cosmétique — pictogrammes par mode (non-bloquant si absent)
// ─────────────────────────────────────────────

const DURATION_META: Record<WagerDuration, { emoji: string; labelKey: string }> = {
  chill: { emoji: '🌱', labelKey: 'Chill' },
  engage: { emoji: '🔥', labelKey: 'Engagé' },
  sprint: { emoji: '⚡', labelKey: 'Sprint' },
};

// ─────────────────────────────────────────────
// Auvent rayé (cohérent avec CraftSheet)
// ─────────────────────────────────────────────

function AwningStripes() {
  return (
    <View style={awningStyles.container}>
      {Array.from({ length: Farm.awningStripeCount }).map((_, i) => (
        <View
          key={i}
          style={[
            awningStyles.stripe,
            { backgroundColor: i % 2 === 0 ? Farm.awningGreen : Farm.awningCream },
          ]}
        />
      ))}
      <View style={awningStyles.scallopRow}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={awningStyles.scallopDot} />
        ))}
      </View>
    </View>
  );
}

const awningStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 4,
  },
  stripe: {
    flex: 1,
  },
  scallopRow: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scallopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Farm.parchment,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
});

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface WagerSealerSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirmSeal: (duration: WagerDuration) => Promise<void> | void;
  onConfirmSkip: () => Promise<void> | void;
  onCancel?: () => void;
  cropId: string;
  tasksPerStage: number;
  sealerProfileId: string;
  allProfiles: Profile[];
  allTasks: Task[];
  sporeeCount: number;
  /** Historique gami pour détection "actif 7j" élargie (achats/récoltes/craft…) */
  gamiHistory?: ReadonlyArray<{ profileId: string; timestamp: string }>;
}

// ─────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────

export const WagerSealerSheet = React.memo(function WagerSealerSheet({
  visible,
  onClose,
  onConfirmSeal,
  onConfirmSkip,
  onCancel,
  cropId,
  tasksPerStage,
  sealerProfileId,
  allProfiles,
  allTasks,
  sporeeCount,
  gamiHistory,
}: WagerSealerSheetProps) {
  // Calcul des 3 options — déterministe (crop + durée), zéro dépendance famille/backlog
  const durations = useMemo<WagerDurationOption[]>(() => {
    const tier = classifyHarvestTier(cropId);
    return computeWagerDurations(tasksPerStage, tier);
  }, [tasksPerStage, cropId]);

  // Nombre total de tâches "normales" de la plante (sans modification wager)
  const normalTasks = Math.max(1, tasksPerStage) * 4;

  // Suppress unused props — gardés dans le shape pour compat mais plus utilisés
  void sealerProfileId;
  void allProfiles;
  void allTasks;
  void gamiHistory;

  // Handler confirm mode — factorisé (3 durées ≡ 1 handler paramétré)
  const handleConfirmDuration = useCallback(async (duration: WagerDuration) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* haptics non-critiques */
    }
    await onConfirmSeal(duration);
    onClose();
  }, [onConfirmSeal, onClose]);

  const handleSkip = useCallback(async () => {
    try {
      Haptics.selectionAsync();
    } catch {
      /* haptics non-critiques */
    }
    await onConfirmSkip();
    onClose();
  }, [onConfirmSkip, onClose]);

  // Close header → annuler (aucune plantation, retour seed picker)
  const handleHeaderClose = useCallback(() => {
    onCancel?.();
    onClose();
  }, [onCancel, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleHeaderClose}
    >
      <View style={styles.container}>
        <AwningStripes />

        <View style={styles.parchment}>
          {/* Bouton fermer */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleHeaderClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>{'✕'}</Text>
          </TouchableOpacity>

          {/* Handle + inventaire Sporée */}
          <View style={styles.handleRow}>
            <View style={styles.handleBadge}>
              <View style={styles.handle} />
              <View style={styles.handleCoinsRow}>
                <Text style={styles.handleCoins}>{sporeeCount}</Text>
                <Text style={styles.handleCoinsEmoji}>🍄</Text>
              </View>
            </View>
          </View>

          {/* Titre */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {'🍄 Sceller cette plantation ?'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Sous-titre explicatif */}
            <Text style={styles.subtitle}>
              Consomme 1 Sporée 🍄 · reward × multiplier si le cumul est atteint
            </Text>

            {/* 3 cartes durée */}
            {durations.map((option) => {
              const meta = DURATION_META[option.duration];
              const accessibilityLabel =
                `Sceller ${meta.labelKey}, récompense multipliée par ${option.multiplier}, ` +
                `${normalTasks} tâches normales pour mûrir, ${option.targetTasks} tâches pour gagner ×${option.multiplier}`;

              return (
                <Pressable
                  key={option.duration}
                  onPress={() => handleConfirmDuration(option.duration)}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && { borderColor: Farm.greenBtn, borderWidth: 2 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                >
                  {/* Ligne 1 — Nom mode + multiplier */}
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle}>
                      {meta.emoji}  {meta.labelKey}
                    </Text>
                    <Text style={styles.cardMultiplier}>
                      ×{option.multiplier}
                    </Text>
                  </View>

                  {/* Ligne 2 — tâches normales plant + cumul cible pour décrocher les gains */}
                  <Text style={styles.cardMeta}>
                    🌱 {normalTasks} pour mûrir · ✅ {option.targetTasks} pour gagner ×{option.multiplier}
                  </Text>
                </Pressable>
              );
            })}

            {/* Bouton skip — planter normalement */}
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Pas cette fois, planter normalement sans consommer de Sporée"
            >
              <Text style={styles.skipText}>
                Pas cette fois — planter normalement
              </Text>
            </Pressable>

            <View style={styles.footerSpace} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

// ─────────────────────────────────────────────
// Styles statiques (tokens design + Farm theme)
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Farm.parchmentDark,
  },
  parchment: {
    flex: 1,
    backgroundColor: Farm.parchmentDark,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing['2xl'],
    width: 32,
    height: 32,
    backgroundColor: Farm.woodDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: Farm.parchment,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },
  handleRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  handleBadge: {
    alignItems: 'center',
    backgroundColor: Farm.parchmentDark,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    gap: 4,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Farm.woodHighlight,
    borderRadius: 2,
  },
  handleCoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  handleCoins: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
    lineHeight: FontSize.caption * 1.2,
  },
  handleCoinsEmoji: {
    fontSize: FontSize.caption,
    lineHeight: FontSize.caption * 1.2,
    marginTop: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing['4xl'],
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    color: Farm.brownTextSub,
    marginBottom: Spacing.xl,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
    color: Farm.brownText,
  },
  cardMultiplier: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.heavy,
    color: Farm.greenBtn,
  },
  cardMeta: {
    fontSize: FontSize.caption,
    color: Farm.brownTextSub,
  },
  skipButton: {
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  skipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Farm.brownTextSub,
  },
  footerSpace: {
    height: Spacing['4xl'],
  },
});
