/**
 * FreeTimeBand.tsx — Bande affichée sous une section slot en mode Journée
 *
 * Phase quick-260516-oj6 — Time-blocking mode Journée.
 *
 * Affichée quand le slot a au moins 1h de libre. Icône contextuelle par slot
 * (Coffee/Sun/Leaf/Heart) ou Heart si soirée couple détectée.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Coffee, Sun, Leaf, Heart } from 'lucide-react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { SLOT_DEFINITIONS } from '../../lib/time-blocking';
import type { SlotId } from '../../lib/types';

interface FreeTimeBandProps {
  slot: SlotId;
  freeMinutes: number;
  sublabel: string;
  isCouple?: boolean;
}

const ICON_MAP = { Coffee, Sun, Leaf, Heart } as const;

function formatFreeMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export const FreeTimeBand = React.memo(function FreeTimeBand({
  slot,
  freeMinutes,
  sublabel,
  isCouple,
}: FreeTimeBandProps) {
  const { colors } = useThemeColors();
  const def = SLOT_DEFINITIONS[slot];
  const iconName = isCouple ? 'Heart' : def.freeTimeIconName;
  const Icon = ICON_MAP[iconName];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.successBg,
          borderColor: colors.success,
        },
      ]}
    >
      <View style={styles.row}>
        <Icon size={16} color={colors.success} strokeWidth={2} />
        <Text style={[styles.label, { color: colors.successText ?? colors.text }]}>
          Temps libre · {formatFreeMinutes(freeMinutes)}
        </Text>
        <Text style={[styles.sublabel, { color: colors.textMuted }]}>{sublabel}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing['2xl'],
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  label: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  sublabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
});
