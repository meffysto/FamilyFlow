/**
 * WagerSealerSheet.tsx — Phase 40 Plan 02
 *
 * Modal pageSheet secondaire empilé après le seed picker : propose 3 durées
 * (Chill ×1.3 / Engagé ×1.7 / Sprint ×2.5) avec preview prorata (multiplier,
 * durée absolue, cadence requise, cumul cible), + option "Pas cette fois".
 *
 * Trois paths de sortie garantis :
 *   - onConfirmSeal(duration) → sceller Sporée (consomme 1 Sporée, plante wager)
 *   - onConfirmSkip()         → planter normalement (zéro Sporée consommée)
 *   - onCancel()              → annuler (header close / dismiss, aucune plantation)
 */

import React, { useCallback, useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ModalHeader } from '../ui/ModalHeader';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

import { computeWagerDurations, type WagerDurationOption } from '../../lib/mascot/wager-ui-helpers';
import { computeCumulTarget, filterTasksForWager } from '../../lib/mascot/wager-engine';
import { getLocalDateKey } from '../../lib/mascot/sporee-economy';
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
}

// ─────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────

/** Formatage heures → libellé court FR ("24h" / "3 j"). */
function formatDuration(hours: number): string {
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days} j`;
}

/** Cadence requise en tâches/jour arrondi supérieur (min 1). */
function computeCadence(option: WagerDurationOption): number {
  const days = Math.max(1, option.estimatedHours / 24);
  return Math.max(1, Math.ceil(option.targetTasks / days));
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
  cropId: _cropId,
  tasksPerStage,
  sealerProfileId,
  allProfiles,
  allTasks,
  sporeeCount,
}: WagerSealerSheetProps) {
  const { primary, colors } = useThemeColors();

  // Calcul des 3 options — stable tant que inputs identiques
  const durations = useMemo<WagerDurationOption[]>(() => {
    const today = getLocalDateKey(new Date());
    const wagerTasks = filterTasksForWager(allTasks);
    // Périmètre : tâches vraiment à faire (retard + aujourd'hui + sans date).
    // Exclut le futur pour ne pas gonfler le cumul avec des tâches pas encore dues.
    const pendingCount = wagerTasks.filter(t =>
      !t.completed && (!t.dueDate || t.dueDate <= today)
    ).length;

    // Adapter au contrat callback-based de computeWagerDurations
    const computeCumulTargetFn = () => computeCumulTarget({
      sealerProfileId,
      allProfiles,
      tasks: wagerTasks,
      today,
      pendingCount,
    });

    return computeWagerDurations(tasksPerStage, computeCumulTargetFn, undefined);
  }, [tasksPerStage, sealerProfileId, allProfiles, allTasks]);

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
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ModalHeader
          title="Sceller cette plantation ?"
          onClose={handleHeaderClose}
          closeLeft
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Sous-titre explicatif */}
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Consomme 1 Sporée 🍄 · reward × multiplier si le cumul est atteint
          </Text>

          {/* Compteur inventaire Sporée */}
          <View style={[styles.inventoryChip, { backgroundColor: colors.cardAlt, borderColor: colors.borderLight }]}>
            <Text style={[styles.inventoryText, { color: colors.text }]}>
              Inventaire : {sporeeCount} 🍄
            </Text>
          </View>

          {/* 3 cartes durée */}
          {durations.map((option) => {
            const meta = DURATION_META[option.duration];
            const cadence = computeCadence(option);
            const accessibilityLabel =
              `Sceller avec ${meta.labelKey}, multiplicateur ${option.multiplier}, ` +
              `durée ${formatDuration(option.estimatedHours)}, cible ${option.targetTasks} tâches`;

            return (
              <Pressable
                key={option.duration}
                onPress={() => handleConfirmDuration(option.duration)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: pressed ? primary : colors.borderLight,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
              >
                {/* Ligne 1 — Nom mode + multiplier */}
                <View style={styles.cardRow}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {meta.emoji}  {meta.labelKey}
                  </Text>
                  <Text style={[styles.cardMultiplier, { color: primary }]}>
                    ×{option.multiplier}
                  </Text>
                </View>

                {/* Ligne 2 — durée · cadence · cumul */}
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                  {formatDuration(option.estimatedHours)} · ~{cadence} tâches/jour · {option.targetTasks} tâches cible
                </Text>
              </Pressable>
            );
          })}

          {/* Bouton skip — planter normalement */}
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [
              styles.skipButton,
              {
                backgroundColor: pressed ? colors.borderLight : colors.cardAlt,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Pas cette fois, planter normalement sans consommer de Sporée"
          >
            <Text style={[styles.skipText, { color: colors.textSub }]}>
              Pas cette fois — planter normalement
            </Text>
          </Pressable>

          <View style={styles.footerSpace} />
        </ScrollView>
      </View>
    </Modal>
  );
});

// ─────────────────────────────────────────────
// Styles statiques (tokens design uniquement)
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing['2xl'],
  },
  inventoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: Spacing['3xl'],
  },
  inventoryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing['2xl'],
    marginBottom: Spacing.xl,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
  },
  cardMultiplier: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.heavy,
  },
  cardMeta: {
    fontSize: FontSize.caption,
  },
  skipButton: {
    marginTop: Spacing['2xl'],
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  skipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  footerSpace: {
    height: Spacing['4xl'],
  },
});
