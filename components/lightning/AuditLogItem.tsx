/**
 * AuditLogItem — Item liste audit log Lightning (UI-SPEC Surface 3 Section 2).
 *
 * Plan 53-03a — composant visuel pur memoïsé. Consommé par /lightning-wallet
 * (Plan 03b) qui filtre l'audit par profileId actif.
 *
 * Anatomie (UI-SPEC) :
 *   [Icône statut 24×24 Radius.full] [Titre tâche + Prénom · JJ/MM/AAAA] [Chip statut]
 *
 * STATUS_DISPLAY est exporté pour permettre à PayoutQueueItem et aux tests
 * futurs (Plan 03b) de partager la même source de vérité libellé+couleur.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  type LucideIcon,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';

import type { AuditEntry, AuditStatus } from '../../lib/lightning';
import { useThemeColors } from '../../contexts/ThemeContext';
import { getDateLocale } from '../../lib/date-locale';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

/**
 * Mapping statut → libellé + icône + clés couleurs sémantiques AppColors.
 * Les clés (`successText`, `successBg`, etc.) sont résolues via `colors[key]`
 * au render — typage `keyof AppColors` non-strict pour éviter un import
 * lourd ; toutes les valeurs sont des clés valides de `AppColors`.
 */
export const STATUS_DISPLAY: Record<
  AuditStatus,
  { label: string; icon: LucideIcon; chipFgKey: string; chipBgKey: string }
> = {
  paid: {
    label: 'Reçu',
    icon: CheckCircle2,
    chipFgKey: 'successText',
    chipBgKey: 'successBg',
  },
  cash_out: {
    label: 'Encaissé',
    icon: CheckCircle2,
    chipFgKey: 'successText',
    chipBgKey: 'successBg',
  },
  queued: {
    label: 'En attente',
    icon: Clock,
    chipFgKey: 'warningText',
    chipBgKey: 'warningBg',
  },
  capped: {
    label: 'Plafond',
    icon: AlertTriangle,
    chipFgKey: 'warningText',
    chipBgKey: 'warningBg',
  },
  failed: {
    label: 'Échoué',
    icon: XCircle,
    chipFgKey: 'errorText',
    chipBgKey: 'errorBg',
  },
  already_paid_today: {
    label: 'Déjà payé',
    icon: XCircle,
    chipFgKey: 'textMuted',
    chipBgKey: 'cardAlt',
  },
  undone: {
    label: 'Annulé',
    icon: XCircle,
    chipFgKey: 'textMuted',
    chipBgKey: 'cardAlt',
  },
  attribution_failed: {
    label: 'Non attribué',
    icon: XCircle,
    chipFgKey: 'textMuted',
    chipBgKey: 'cardAlt',
  },
};

interface AuditLogItemProps {
  entry: AuditEntry;
  /** Prénom résolu depuis profileId — "—" si orphelin. */
  profileName: string;
  /** Titre tâche résolu depuis taskId — "—" si non retrouvé. */
  taskTitle: string;
}

function AuditLogItemImpl({ entry, profileName, taskTitle }: AuditLogItemProps) {
  const { colors } = useThemeColors();
  const display = STATUS_DISPLAY[entry.status];
  const Icon = display.icon;

  // Résolution des couleurs sémantiques via clés string (sûr — toutes les
  // clés du STATUS_DISPLAY existent dans AppColors).
  const chipFg = (colors as unknown as Record<string, string>)[display.chipFgKey];
  const chipBg = (colors as unknown as Record<string, string>)[display.chipBgKey];

  const dateAffichee = (() => {
    try {
      return format(parseISO(entry.ts), 'dd/MM/yyyy', { locale: getDateLocale() });
    } catch {
      return '';
    }
  })();

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`${taskTitle}, ${display.label}, ${entry.sats} sats, ${dateAffichee}`}
    >
      {/* Pastille icône statut 24×24 — couleur de fond chipBg */}
      <View style={[styles.iconBadge, { backgroundColor: chipBg }]}>
        <Icon size={14} color={chipFg} strokeWidth={2} />
      </View>

      {/* Colonne centrale — titre + prénom·date */}
      <View style={styles.middle}>
        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
        >
          {taskTitle}
        </Text>
        <Text style={[styles.meta, { color: colors.textSub }]} numberOfLines={1}>
          {profileName} · {dateAffichee}
        </Text>
      </View>

      {/* Chip statut à droite */}
      <View
        style={[
          styles.chip,
          { backgroundColor: chipBg },
        ]}
      >
        <Text style={[styles.chipLabel, { color: chipFg }]}>{display.label}</Text>
      </View>
    </View>
  );
}

export const AuditLogItem = React.memo(AuditLogItemImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: Spacing.xxs,
  },
  title: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  meta: {
    fontSize: FontSize.caption,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  chipLabel: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
