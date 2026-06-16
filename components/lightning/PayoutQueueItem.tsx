/**
 * PayoutQueueItem — Item liste validation batch (UI-SPEC Surface 4).
 *
 * Plan 53-03a — composant visuel pur memoïsé. Consommé par PayoutQueueModal
 * (Plan 03b) pour rendre la liste des pay-outs en attente de validation
 * parentale (mode 'daily-review' ou 'hybrid' au-dessus du seuil).
 *
 * Layout (UI-SPEC Surface 4) :
 *   [Avatar emoji 36×36] [Prénom semibold]                        [{sats} sats]
 *                        [Titre tâche label textMuted]            [JJ/MM]
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';

import type { PayoutQueueItem as PayoutQueueItemType } from '../../lib/lightning';
import type { Profile } from '../../lib/types';
import { useThemeColors } from '../../contexts/ThemeContext';
import { getTheme } from '../../constants/themes';
import { AvatarIcon } from '../ui/AvatarIcon';
import { getDateLocale } from '../../lib/date-locale';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface PayoutQueueItemProps {
  item: PayoutQueueItemType;
  /** Profil destinataire — `undefined` si retrouvé orphelin (fallback emoji 👤). */
  profile: Profile | undefined;
  /** Titre tâche résolu — "—" si non retrouvé côté caller. */
  taskTitle: string;
}

function PayoutQueueItemImpl({ item, profile, taskTitle }: PayoutQueueItemProps) {
  const { colors } = useThemeColors();

  const avatarEmoji = profile?.avatar ?? '👤';
  const displayName = profile?.name ?? '—';

  const dateAffichee = (() => {
    try {
      return format(parseISO(item.queuedAt), 'dd/MM', { locale: getDateLocale() });
    } catch {
      return '';
    }
  })();

  return (
    <View
      style={[
        styles.card,
        Shadows.sm,
        { backgroundColor: colors.card },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${displayName}, ${item.sats} sats, ${taskTitle}, ${dateAffichee}`}
    >
      {/* Avatar 36×36 (UI-SPEC Surface 4) — emoji legacy + icônes Lucide */}
      <AvatarIcon
        name={avatarEmoji}
        color={profile ? getTheme(profile.theme).primary : colors.textMuted}
        size={36}
      />

      {/* Colonne droite — 2 lignes avec sats à droite */}
      <View style={styles.content}>
        <View style={styles.lineRow}>
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text style={[styles.sats, { color: colors.text }]}>
            {item.sats} sats
          </Text>
        </View>
        <View style={styles.lineRow}>
          <Text
            style={[styles.taskTitle, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {taskTitle}
          </Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>
            {dateAffichee}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const PayoutQueueItem = React.memo(PayoutQueueItemImpl);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  content: {
    flex: 1,
    gap: Spacing.xxs,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  name: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  sats: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  taskTitle: {
    flex: 1,
    fontSize: FontSize.label,
  },
  date: {
    fontSize: FontSize.label,
  },
});
