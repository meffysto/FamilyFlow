/**
 * SeasonalBanner.tsx — Bandeau événement saisonnier
 *
 * Affiche un bandeau coloré quand un événement est actif.
 * Optionnellement affiche un bouton pour voir les récompenses exclusives.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SeasonalEvent } from '../lib/types';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

interface SeasonalBannerProps {
  event: SeasonalEvent;
  daysLeft?: number;
  onShowRewards?: () => void;
  compact?: boolean; // version réduite pour le dashboard
}

export function SeasonalBanner({ event, daysLeft, onShowRewards, compact }: SeasonalBannerProps) {
  const { colors } = useThemeColors();

  if (compact) {
    return (
      <View style={[styles.compact, { backgroundColor: event.themeColor + '20' }]}>
        <Text style={[styles.compactText, { color: event.themeColor }]}>
          {event.emoji} Événement {event.name} actif !
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, { backgroundColor: event.themeColor }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.onPrimary }]}>
          {event.emoji} ÉVÉNEMENT {event.name.toUpperCase()} ACTIF !
        </Text>
        <Text style={[styles.subtitle, { color: colors.onPrimaryMuted }]}>
          {daysLeft != null
            ? `Récompenses exclusives — encore ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
            : 'Récompenses exclusives disponibles !'}
        </Text>
      </View>
      {onShowRewards && (
        <TouchableOpacity
          style={styles.btn}
          onPress={onShowRewards}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.btnText, { color: colors.onPrimary }]}>Voir →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: FontSize.caption,
  },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.md,
  },
  btnText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  compact: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    alignSelf: 'flex-start',
    marginTop: Spacing.xxs,
  },
  compactText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
});
