/**
 * SectionHeader.tsx — En-tête de section warm pour listes et écrans.
 *
 * Remplace le pattern legacy `UPPERCASE letterSpacing: 0.5` qui sentait le
 * SaaS corporate. Ici : petit losange ◆ warm + titre serif sentence case +
 * sous-titre Caveat italique optionnel + slot action à droite (View All, +).
 *
 * Usage :
 *   <SectionHeader title="Tâches du matin" />
 *   <SectionHeader title="Repas" subtitle="3 prévus aujourd'hui" />
 *   <SectionHeader title="Photos" action={<Pressable>...</Pressable>} />
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight, FontFamily } from '../../constants/typography';

interface SectionHeaderProps {
  title: string;
  /** Sous-titre tendre Caveat (ex : "3 prévus aujourd'hui") */
  subtitle?: string;
  /** Slot droite : bouton "+", lien "Tout voir", chip count… */
  action?: React.ReactNode;
  /** Override la couleur du losange ◆ (par défaut `colors.brand.soilMuted`) */
  diamondColor?: string;
  /** Si false, masque le losange (titre nu) */
  showDiamond?: boolean;
  /** Slot icône brand (lucide) à la place du losange. Quand fourni, masque le ◆.
   * Convention d'usage : <Icon size={16} strokeWidth={1.75} color={colors.brand.soilMuted} /> */
  icon?: React.ReactNode;
  /** Si true, retire le padding horizontal (usage dans contextes déjà paddés
   * comme les panels settings). Garde le padding vertical pour la rythmique. */
  flush?: boolean;
}

export const SectionHeader = React.memo(function SectionHeader({
  title,
  subtitle,
  action,
  diamondColor,
  showDiamond = true,
  icon,
  flush = false,
}: SectionHeaderProps) {
  const { colors } = useThemeColors();

  return (
    <View style={[styles.row, flush && styles.rowFlush]}>
      <View style={styles.titleCol}>
        <View style={styles.titleRow}>
          {icon ? (
            <View style={styles.iconWrap}>{icon}</View>
          ) : showDiamond ? (
            <View
              style={[
                styles.diamond,
                { backgroundColor: diamondColor ?? colors.brand.soilMuted },
              ]}
            />
          ) : null}
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
            allowFontScaling
          >
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: colors.brand.soilMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  rowFlush: {
    paddingHorizontal: 0,
  },
  titleCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  diamond: {
    width: 6,
    height: 6,
    transform: [{ rotate: '45deg' }],
  },
  iconWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    fontFamily: FontFamily.serif,
    fontSize: FontSize.heading,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.normal,
    marginTop: 2,
    marginLeft: 14, // aligné après le losange (6px ◆ + 8px gap)
  },
  action: {
    flexShrink: 0,
  },
});
