// components/pdf/ExportCard.tsx
// Card item de la liste manifeste (écran "Mes impressions" — Phase 51-02).
//
// Affiche : titre histoire (italique si supprimée), date FR, format, hash court.
// React.memo + useCallback handler pour éviter re-renders en liste.

import React, { useCallback } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';
import type { BookManifestEntry } from '../../lib/pdf';

interface Props {
  entry: BookManifestEntry;
  /** Titre affiché — soit `story.titre`, soit `entry.id` si histoire supprimée. */
  storyTitle: string;
  /** Si true → titre rendu en italique + label "Histoire supprimée". */
  storyDeleted: boolean;
  onPress: (entry: BookManifestEntry) => void;
}

/** "2026-05-04" → "04/05/2026" (CLAUDE.md format JJ/MM/AAAA). */
function formatDateFR(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function ExportCardImpl({ entry, storyTitle, storyDeleted, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const handlePress = useCallback(() => onPress(entry), [entry, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${storyTitle}, ${formatDateFR(entry.date)}, ${entry.format}`}
    >
      <Text
        style={[
          styles.title,
          {
            color: colors.text,
            fontStyle: storyDeleted ? 'italic' : 'normal',
          },
        ]}
        numberOfLines={2}
      >
        {storyTitle}
      </Text>
      {storyDeleted && (
        <Text style={[styles.deletedHint, { color: colors.textMuted }]}>
          {t('impressions.card.deletedStory', {
            defaultValue: 'Histoire supprimée',
          })}
        </Text>
      )}
      <View style={styles.row}>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('impressions.card.exportedOn', {
            date: formatDateFR(entry.date),
            defaultValue: `Exporté le ${formatDateFR(entry.date)}`,
          })}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {entry.format}
        </Text>
      </View>
      <Text style={[styles.hash, { color: colors.textFaint }]}>
        #{entry.hash.slice(0, 8)}
      </Text>
    </Pressable>
  );
}

export const ExportCard = React.memo(ExportCardImpl);

const styles = StyleSheet.create({
  card: {
    padding: Spacing['3xl'],
    marginBottom: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
    ...Shadows.xs,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  deletedHint: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  meta: {
    fontSize: FontSize.caption,
  },
  hash: {
    fontSize: FontSize.code,
    fontFamily: 'monospace',
  },
});
