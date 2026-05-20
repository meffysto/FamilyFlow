/**
 * BalanceCard — Carte hero balance Lightning (Surface 2 UI-SPEC).
 *
 * Plan 53-03a — composant visuel pur (consommé par /lightning-wallet Plan 03b).
 *
 * États :
 *   - errorMessage présent  → "—" + icône AlertTriangle + texte d'erreur warning
 *   - balanceSats === null  → skeleton 2 rectangles colors.cardAlt opacity 0.6
 *   - balanceSats: number   → "{N} sats" FontSize.display semibold
 *
 * Le bouton "Encaisser" est désactivé si `canCashOut === false` avec
 * accessibilityHint "Admin key requise pour encaisser" (REQ-10, UI-SPEC).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Shadows } from '../../constants/shadows';

interface BalanceCardProps {
  /** Balance en sats. `null` = état loading (skeleton). */
  balanceSats: number | null;
  /** Dernière mise à jour pour rendre "Mis à jour il y a X min". */
  lastUpdatedAt?: Date;
  /** Active le bouton "Encaisser" (REQ-10 — false si pas d'admin key). */
  canCashOut: boolean;
  /** Callback tap "Encaisser" — gated FaceID au niveau de l'appelant. */
  onCashOut: () => void;
  /** Si présent : remplace la balance par "—" + warning UI-SPEC Section 1. */
  errorMessage?: string;
}

/**
 * Helper local : "Mis à jour il y a X min" (UI-SPEC Surface 3 Section 1).
 * - < 1 min   → "à l'instant"
 * - < 60 min  → "il y a {N} min"
 * - >= 60 min → "il y a {N} h"
 */
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Mis à jour à l'instant";
  if (diffMin < 60) return `Mis à jour il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  return `Mis à jour il y a ${diffH} h`;
}

export function BalanceCard({
  balanceSats,
  lastUpdatedAt,
  canCashOut,
  onCashOut,
  errorMessage,
}: BalanceCardProps) {
  const { colors, primary } = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        Shadows.md,
        { backgroundColor: colors.card },
      ]}
    >
      {/* Bloc balance — 3 états : error / loading / valeur */}
      {errorMessage ? (
        <>
          <View style={styles.errorRow}>
            <Text
              style={[styles.balanceText, { color: colors.text }]}
              accessibilityLabel="Solde indisponible"
            >
              —
            </Text>
            <AlertTriangle size={16} color={colors.warning} strokeWidth={1.75} />
          </View>
          <Text style={[styles.errorMessage, { color: colors.warning }]}>
            {errorMessage}
          </Text>
        </>
      ) : balanceSats === null ? (
        <View accessibilityLabel="Chargement du solde">
          <View
            style={[
              styles.skeletonLarge,
              { backgroundColor: colors.cardAlt },
            ]}
          />
          <View
            style={[
              styles.skeletonSmall,
              { backgroundColor: colors.cardAlt },
            ]}
          />
        </View>
      ) : (
        <>
          <Text style={[styles.balanceText, { color: colors.text }]}>
            {balanceSats} sats
          </Text>
          {lastUpdatedAt ? (
            <Text style={[styles.timestamp, { color: colors.textMuted }]}>
              {formatRelativeTime(lastUpdatedAt)}
            </Text>
          ) : null}
        </>
      )}

      {/* Bouton Encaisser — disabled si pas d'admin key (REQ-10) */}
      <TouchableOpacity
        style={[
          styles.cashOutBtn,
          {
            backgroundColor: primary,
            opacity: canCashOut ? 1 : 0.5,
          },
        ]}
        onPress={onCashOut}
        disabled={!canCashOut}
        accessibilityRole="button"
        accessibilityLabel="Encaisser vers wallet externe"
        accessibilityHint={
          !canCashOut ? 'Admin key requise pour encaisser' : undefined
        }
        accessibilityState={{ disabled: !canCashOut }}
        activeOpacity={0.7}
      >
        <Text style={[styles.cashOutLabel, { color: colors.onPrimary }]}>
          Encaisser
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing['3xl'],
    gap: Spacing.xl,
  },
  balanceText: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.semibold,
  },
  timestamp: {
    fontSize: FontSize.caption,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorMessage: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.normal,
  },
  skeletonLarge: {
    width: 120,
    height: 28,
    borderRadius: Radius.sm,
    opacity: 0.6,
    marginBottom: Spacing.md,
  },
  skeletonSmall: {
    width: 80,
    height: 16,
    borderRadius: Radius.sm,
    opacity: 0.6,
  },
  cashOutBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  cashOutLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
