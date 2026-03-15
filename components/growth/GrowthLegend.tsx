/**
 * GrowthLegend.tsx — Legende pour le graphique de croissance
 *
 * Affiche : point enfant, ligne mediane P50, ligne pointillee P3/P97
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface GrowthLegendProps {
  /** Prenom de l'enfant affiche a cote du point */
  childName: string;
  /** Sexe pour la couleur de la mediane */
  sex: 'garçon' | 'fille';
}

const MEDIAN_COLORS = {
  'garçon': '#1D4ED8',
  fille: '#BE185D',
} as const;

const BORDER_COLORS = {
  'garçon': '#60A5FA',
  fille: '#F472B6',
} as const;

export function GrowthLegend({ childName, sex }: GrowthLegendProps) {
  const { primary, colors } = useThemeColors();
  const medianColor = MEDIAN_COLORS[sex];
  const borderColor = BORDER_COLORS[sex];

  return (
    <View style={[styles.container, { borderTopColor: colors.separator }]}>
      {/* Point enfant */}
      <View style={styles.item}>
        <Svg width={14} height={14}>
          <Circle cx={7} cy={7} r={5} fill={primary} />
        </Svg>
        <Text style={[styles.label, { color: colors.text }]}>{childName}</Text>
      </View>

      {/* Ligne mediane P50 */}
      <View style={styles.item}>
        <Svg width={24} height={14}>
          <Line
            x1={0}
            y1={7}
            x2={24}
            y2={7}
            stroke={medianColor}
            strokeWidth={1.5}
          />
        </Svg>
        <Text style={[styles.label, { color: colors.textSub }]}>P50</Text>
      </View>

      {/* Ligne pointillee P3/P97 */}
      <View style={styles.item}>
        <Svg width={24} height={14}>
          <Line
            x1={0}
            y1={7}
            x2={24}
            y2={7}
            stroke={borderColor}
            strokeWidth={0.8}
            strokeDasharray="4,3"
          />
        </Svg>
        <Text style={[styles.label, { color: colors.textSub }]}>P3/P97</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['2xl'],
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
});
