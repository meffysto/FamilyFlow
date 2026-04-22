/**
 * CompanionCard.tsx — Carte compagnon farm-game (Phase 42 D-26, refonte visuelle parchemin)
 *
 * Sheet cozy dans le style TreeShop / BuildingShopSheet :
 *   - cadre bois + auvent rayé + parchemin + close bouton rond
 *   - action primaire "Nourrir" (bouton farm vert 3D)
 *   - action secondaire "Changer d'espèce" (bouton bois)
 *
 * Englobe le CompanionPicker existant pour l'action "Changer d'espèce".
 * Rend son propre Modal — pas besoin de wrapper externe dans tree.tsx.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Farm } from '../../constants/farm-theme';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

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

// ── Constants ─────────────────────────────────────────

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

const SPECIES_FALLBACK_EMOJI: Record<CompanionSpecies, string> = {
  chat: '🐱',
  chien: '🐶',
  lapin: '🐰',
  renard: '🦊',
  herisson: '🦔',
};

// ── Props ─────────────────────────────────────────────

interface CompanionCardProps {
  visible: boolean;
  onClose: () => void;
  companion: CompanionData;
  level: number;
  onPressFeed: () => void;
  onSelectSpecies: (species: CompanionSpecies, name: string) => void | Promise<void>;
}

// ── Helpers ───────────────────────────────────────────

function formatCooldown(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}`;
  return `${m}min`;
}

function formatBuffRemaining(expiresAtIso: string, now: number): string {
  const exp = new Date(expiresAtIso).getTime();
  if (isNaN(exp)) return '0min';
  const remaining = Math.max(0, exp - now);
  return formatCooldown(remaining);
}

// ── Auvent rayé (pattern farm) ────────────────────────

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

// ── Bouton farm 3D (vert primaire) ────────────────────

interface FarmButtonProps {
  label: string;
  enabled: boolean;
  onPress?: () => void;
  variant?: 'green' | 'wood';
}

function FarmButton({ label, enabled, onPress, variant = 'green' }: FarmButtonProps) {
  const pressedY = useSharedValue(0);

  const bg = variant === 'green'
    ? (enabled ? Farm.greenBtn : Farm.parchmentDark)
    : Farm.woodBtn;
  const shadow = variant === 'green'
    ? (enabled ? Farm.greenBtnShadow : '#D0CBC3')
    : Farm.woodBtnShadow;
  const highlight = variant === 'green'
    ? (enabled ? Farm.greenBtnHighlight : Farm.parchment)
    : Farm.woodBtnHighlight;
  const textColor = variant === 'green'
    ? (enabled ? '#FFFFFF' : Farm.brownTextSub)
    : Farm.parchment;

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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          pressedY.value = withSpring(4, SPRING_CONFIG);
        }
      }}
      onPressOut={() => {
        pressedY.value = withSpring(0, SPRING_CONFIG);
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      <Animated.View
        style={[styles.farmBtnShadow, { backgroundColor: shadow }, shadowStyle]}
      />
      <Animated.View
        style={[styles.farmBtnBody, { backgroundColor: bg }, btnStyle]}
      >
        <View style={[styles.farmBtnGloss, { backgroundColor: highlight }]} />
        <Text
          style={[
            styles.farmBtnText,
            { color: textColor, textShadowColor: enabled ? 'rgba(0,0,0,0.25)' : 'transparent' },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Composant principal ───────────────────────────────

export function CompanionCard({
  visible,
  onClose,
  companion,
  level,
  onPressFeed,
  onSelectSpecies,
}: CompanionCardProps) {
  const { t } = useTranslation();
  const { primary } = useThemeColors();
  const [showPicker, setShowPicker] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick(v => v + 1), 30_000);
    return () => clearInterval(id);
  }, [visible]);

  const now = Date.now();
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayBg}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Panneau farm cozy */}
        <View style={styles.woodFrame}>
          <View style={styles.woodFrameInner}>
            <AwningStripes />

            <View style={styles.parchment}>
              <View style={styles.handle} />

              <Animated.View
                entering={FadeIn.springify().damping(14).stiffness(200)}
                style={styles.farmTitle}
              >
                <Text style={styles.farmTitleText}>
                  Compagnon
                </Text>
              </Animated.View>

              {/* Avatar + infos */}
              <View style={styles.avatarCard}>
                <View style={styles.avatarCircle}>
                  <CompanionAvatarMini
                    companion={companion}
                    level={level}
                    fallbackEmoji={fallbackEmoji}
                    size={64}
                  />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {companion.name || speciesLabel}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {speciesLabel} · {stageLabel}
                  </Text>
                </View>
              </View>

              {/* Chip buff actif */}
              {activeBuff && (
                <Animated.View
                  entering={FadeIn.duration(250)}
                  style={[styles.buffChip, { borderColor: primary }]}
                >
                  <Text style={[styles.buffText, { color: primary }]}>
                    ✨ +{buffPercent}% XP · {formatBuffRemaining(activeBuff.expiresAt, now)}
                  </Text>
                </Animated.View>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <FarmButton
                  label={
                    feedDisabled
                      ? `😋 Rassasié · ${formatCooldown(cooldownMs)}`
                      : '🥕 Nourrir'
                  }
                  enabled={!feedDisabled}
                  onPress={handleFeed}
                  variant="green"
                />
                <FarmButton
                  label="🔄 Changer d'espèce"
                  enabled
                  onPress={handleChange}
                  variant="wood"
                />
              </View>
            </View>

            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>{'✕'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sous-composant CompanionPicker — rend son propre Modal pageSheet. */}
        <CompanionPicker
          visible={showPicker}
          onClose={handleClosePicker}
          onSelect={handleSelectSpecies}
          unlockedSpecies={companion.unlockedSpecies}
          isInitialChoice={false}
          currentSpecies={companion.activeSpecies}
          currentName={companion.name}
        />
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // ── Wood frame ──
  woodFrame: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['4xl'],
    borderRadius: Radius['2xl'],
    backgroundColor: Farm.woodDark,
    padding: 5,
    ...Shadows.xl,
  },
  woodFrameInner: {
    borderRadius: Radius.xl,
    backgroundColor: Farm.parchmentDark,
    borderWidth: 2,
    borderColor: Farm.woodHighlight,
    overflow: 'hidden',
  },

  // ── Auvent ──
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

  // ── Parchemin ──
  parchment: {
    backgroundColor: Farm.parchmentDark,
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

  // ── Avatar card ──
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    backgroundColor: Farm.parchmentDark,
    padding: Spacing.xl,
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.xl,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Farm.parchment,
    borderWidth: 1.5,
    borderColor: Farm.woodHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Farm.brownText,
  },
  meta: {
    fontSize: FontSize.label,
    color: Farm.brownTextSub,
    marginTop: 2,
  },

  // ── Buff chip ──
  buffChip: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    backgroundColor: Farm.parchment,
    marginBottom: Spacing.xl,
  },
  buffText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // ── Actions ──
  actions: {
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.lg,
  },

  // ── Bouton farm 3D ──
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
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  // ── Close button ──
  closeBtn: {
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
  closeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Farm.parchment,
  },
});
