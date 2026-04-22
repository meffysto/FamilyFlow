/**
 * CompanionCard.tsx — Carte compagnon avec actions Nourrir + Changer espèce (Phase 42 D-26)
 *
 * Englobe le CompanionPicker existant comme sous-composant "Changer espèce".
 * Action primaire : Nourrir (déclenche FeedPicker — callback onPressFeed).
 * Affiche le buff XP actif si présent, et le cooldown si pas prêt.
 *
 * IMPORTANT : CompanionPicker rend déjà son propre Modal pageSheet, donc on ne le wrapper PAS
 * dans un autre Modal (double sheet gotcha).
 *
 * CompanionPicker reçoit UNIQUEMENT ses 5 props réelles : visible, onClose, onSelect,
 * unlockedSpecies, isInitialChoice. Les props currentSpecies/companionName n'existent pas.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { FontSize, FontWeight } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
import { CompanionPicker } from './CompanionPicker';
import { CompanionAvatarMini } from './CompanionAvatarMini';
import {
  getCompanionStage,
  getActiveFeedBuff,
} from '../../lib/mascot/companion-engine';
import {
  getCooldownRemainingMs,
  type CompanionData,
  type CompanionSpecies,
} from '../../lib/mascot/companion-types';

// ── Props ─────────────────────────────────────────────

interface CompanionCardProps {
  /** Profil actif avec companion */
  companion: CompanionData;
  /** Niveau du profil (pour afficher le stade) */
  level: number;
  /** Callback pour ouvrir le FeedPicker — plan 06 */
  onPressFeed: () => void;
  /** Callback pour confirmer un changement d'espèce (réutilisé de CompanionPicker) */
  onSelectSpecies: (species: CompanionSpecies, name: string) => void | Promise<void>;
}

// ── Helpers locaux ────────────────────────────────────

/** Formate un cooldown ms → "Xh Ym" ou "Ymin". */
function formatCooldown(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}`;
  return `${m}min`;
}

/** Formate le restant d'un buff (expiresAt ISO → ms restant → "Xmin" ou "Xh Ym"). */
function formatBuffRemaining(expiresAtIso: string, now: number): string {
  const exp = new Date(expiresAtIso).getTime();
  if (isNaN(exp)) return '0min';
  const remaining = Math.max(0, exp - now);
  return formatCooldown(remaining);
}

/** Emoji de fallback par espèce pour l'avatar (passé à CompanionAvatarMini). */
const SPECIES_FALLBACK_EMOJI: Record<CompanionSpecies, string> = {
  chat: '🐱',
  chien: '🐶',
  lapin: '🐰',
  renard: '🦊',
  herisson: '🦔',
};

// ── Composant ─────────────────────────────────────────

export function CompanionCard({
  companion,
  level,
  onPressFeed,
  onSelectSpecies,
}: CompanionCardProps) {
  const { t } = useTranslation();
  const { colors, primary } = useThemeColors();
  const [showPicker, setShowPicker] = useState(false);
  const [tick, setTick] = useState(0);

  // Refresh toutes les 30s pour mettre à jour cooldown/buff affiché
  useEffect(() => {
    const id = setInterval(() => setTick(v => v + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  // tick est dépendance volontaire pour recalcul périodique — ne pas retirer
  const cooldownMs = useMemo(
    () => getCooldownRemainingMs(companion.lastFedAt, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companion.lastFedAt, tick],
  );
  const activeBuff = useMemo(
    () => getActiveFeedBuff(companion, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companion.feedBuff, tick],
  );
  const stage = useMemo(() => getCompanionStage(level), [level]);

  const handleFeed = useCallback(() => {
    if (cooldownMs > 0) return;
    Haptics.selectionAsync().catch(() => {});
    onPressFeed();
  }, [cooldownMs, onPressFeed]);

  const handleChange = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setShowPicker(true);
  }, []);

  const handleClosePicker = useCallback(() => {
    setShowPicker(false);
  }, []);

  const handleSelectSpecies = useCallback(
    async (species: CompanionSpecies, name: string) => {
      await onSelectSpecies(species, name);
      setShowPicker(false);
    },
    [onSelectSpecies],
  );

  const feedDisabled = cooldownMs > 0;
  const buffPercent = activeBuff
    ? Math.round((activeBuff.multiplier - 1) * 100)
    : 0;

  const speciesLabel = t(`companion.species.${companion.activeSpecies}`);
  const stageLabel = t(`companion.stage.${stage}`);
  const fallbackEmoji = SPECIES_FALLBACK_EMOJI[companion.activeSpecies] ?? '🐾';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Avatar + infos */}
      <View style={styles.header}>
        <CompanionAvatarMini
          companion={companion}
          level={level}
          fallbackEmoji={fallbackEmoji}
          size={56}
        />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {companion.name || speciesLabel}
          </Text>
          <Text
            style={[styles.meta, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {speciesLabel} · {stageLabel}
          </Text>
        </View>
      </View>

      {/* Chip buff actif */}
      {activeBuff && (
        <View
          style={[
            styles.buffChip,
            { backgroundColor: primary + '22', borderColor: primary },
          ]}
          accessibilityLabel={`Buff XP actif +${buffPercent} pourcent`}
        >
          <Text style={[styles.buffText, { color: primary }]}>
            ✨ +{buffPercent}% XP · {formatBuffRemaining(activeBuff.expiresAt, now)}
          </Text>
        </View>
      )}

      {/* Boutons d'action */}
      <View style={styles.actions}>
        <Pressable
          onPress={handleFeed}
          disabled={feedDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: feedDisabled }}
          style={({ pressed }) => [
            styles.btnPrimary,
            {
              backgroundColor: feedDisabled ? colors.border : primary,
              opacity: pressed && !feedDisabled ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.btnPrimaryText,
              { color: feedDisabled ? colors.textFaint : '#FFFFFF' },
            ]}
          >
            {feedDisabled
              ? `😋 Rassasié · ${formatCooldown(cooldownMs)}`
              : '🥕 Nourrir'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleChange}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.btnSecondary,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.btnSecondaryText, { color: colors.text }]}>
            🔄 Changer d'espèce
          </Text>
        </Pressable>
      </View>

      {/* Sous-composant CompanionPicker — rend son propre Modal pageSheet.
          Signature RÉELLE : { visible, onClose, onSelect, unlockedSpecies, isInitialChoice }.
          On NE PAS wrapper dans un autre Modal (double sheet gotcha). */}
      <CompanionPicker
        visible={showPicker}
        onClose={handleClosePicker}
        onSelect={handleSelectSpecies}
        unlockedSpecies={companion.unlockedSpecies}
        isInitialChoice={false}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing['3xl'],
    gap: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  meta: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  buffChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  buffText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  actions: {
    gap: Spacing.md,
  },
  btnPrimary: {
    paddingVertical: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  btnSecondary: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
