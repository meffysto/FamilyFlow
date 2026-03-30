/**
 * BadgesSheet.tsx — Modal badges d'accomplissement
 *
 * Affiche les 8 badges avec paliers bronze/argent/or/diamant,
 * progression visuelle, et valeur actuelle.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useThemeColors } from '../../contexts/ThemeContext';
import {
  getAllBadgeProgress,
  TIER_EMOJI,
  TIER_ORDER,
  type BadgeProgress,
  type BadgeTier,
} from '../../lib/mascot/badges';
import type { Profile, GamificationData } from '../../lib/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

// ── Props ──────────────────────────────────────

interface BadgesSheetProps {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  gamiData: GamificationData;
}

// ── Couleurs par palier ──────────────────────────

const TIER_COLORS: Record<BadgeTier, { bg: string; border: string; text: string }> = {
  none: { bg: '#F3F4F6', border: '#E5E7EB', text: '#9CA3AF' },
  bronze: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  argent: { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' },
  or: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
  diamant: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
};

// ── Badge card ──────────────────────────────────

function BadgeCard({ bp, idx }: { bp: BadgeProgress; idx: number }) {
  const { colors, primary } = useThemeColors();
  const { t } = useTranslation();
  const tierColor = TIER_COLORS[bp.currentTier];
  const tierEmoji = TIER_EMOJI[bp.currentTier];

  return (
    <Animated.View entering={FadeInDown.delay(idx * 80).duration(250)}>
      <View
        style={[
          styles.badgeCard,
          {
            backgroundColor: bp.currentTier === 'none' ? colors.cardAlt : tierColor.bg,
            borderColor: bp.currentTier === 'none' ? colors.borderLight : tierColor.border,
          },
        ]}
      >
        {/* Icone + infos */}
        <View style={styles.badgeTop}>
          <View style={[
            styles.badgeIcon,
            { backgroundColor: bp.currentTier === 'none' ? colors.cardAlt : 'rgba(255,255,255,0.6)' },
          ]}>
            <Text style={[styles.badgeEmoji, bp.currentTier === 'none' && { opacity: 0.4 }]}>
              {bp.badge.emoji}
            </Text>
          </View>
          <View style={styles.badgeInfo}>
            <View style={styles.badgeNameRow}>
              <Text style={[styles.badgeName, { color: bp.currentTier === 'none' ? colors.textMuted : tierColor.text }]}>
                {t(bp.badge.labelKey)}
              </Text>
              {bp.currentTier !== 'none' && (
                <Text style={styles.tierBadge}>{tierEmoji}</Text>
              )}
            </View>
            <Text style={[styles.badgeDesc, { color: colors.textSub }]}>
              {t(bp.badge.descriptionKey)}
            </Text>
          </View>
        </View>

        {/* Barre de progression */}
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              {
                width: `${Math.round(bp.progress * 100)}%`,
                backgroundColor: bp.currentTier === 'none' ? colors.textMuted : tierColor.border,
              },
            ]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {bp.nextThreshold !== null
              ? `${bp.currentValue} / ${bp.nextThreshold}`
              : `${bp.currentValue} ✓`
            }
          </Text>
        </View>

        {/* Paliers en ligne */}
        <View style={styles.tiersRow}>
          {bp.badge.thresholds.map((threshold, i) => {
            const tier = TIER_ORDER[i + 1] as BadgeTier;
            const reached = bp.currentValue >= threshold;
            return (
              <View key={tier} style={styles.tierItem}>
                <Text style={[styles.tierIcon, !reached && { opacity: 0.3 }]}>
                  {TIER_EMOJI[tier]}
                </Text>
                <Text style={[styles.tierThreshold, { color: reached ? tierColor.text : colors.textMuted }]}>
                  {threshold}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// ── Composant principal ──────────────────────────

export function BadgesSheet({ visible, onClose, profile, gamiData }: BadgesSheetProps) {
  const { t } = useTranslation();
  const { primary, tint, colors } = useThemeColors();

  const badgeProgress = useMemo(
    () => getAllBadgeProgress(profile, gamiData),
    [profile, gamiData],
  );

  const totalBadges = badgeProgress.filter(bp => bp.currentTier !== 'none').length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: primary }]}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {'🏅 ' + t('badges.title', 'Badges')}
          </Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Resume */}
        <View style={[styles.summaryBar, { backgroundColor: tint }]}>
          <Text style={[styles.summaryText, { color: primary }]}>
            {t('badges.earned', { count: totalBadges, total: badgeProgress.length, defaultValue: `${totalBadges} / ${badgeProgress.length} badges obtenus` })}
          </Text>
        </View>

        {/* Liste */}
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {badgeProgress.map((bp, idx) => (
            <BadgeCard key={bp.badge.id} bp={bp} idx={idx} />
          ))}
          <View style={{ height: Spacing['3xl'] }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: FontSize.titleLg,
    fontWeight: FontWeight.bold,
  },
  summaryBar: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  badgeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  badgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badgeName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  tierBadge: {
    fontSize: 16,
  },
  badgeDesc: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    minWidth: 50,
    textAlign: 'right',
  },
  tiersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tierItem: {
    alignItems: 'center',
    gap: 2,
  },
  tierIcon: {
    fontSize: 16,
  },
  tierThreshold: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
  },
});
