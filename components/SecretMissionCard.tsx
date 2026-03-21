/**
 * SecretMissionCard.tsx — Carte spéciale pour les missions secrètes
 *
 * Remplace TaskCard pour les missions secrètes : design sombre avec
 * bordure dorée, badge espion, et boutons d'action selon le statut.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Task } from '../lib/types';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight, LineHeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';

interface SecretMissionCardProps {
  mission: Task;
  onComplete?: () => void;
  onValidate?: () => void;
  isParent: boolean;
}

export const SecretMissionCard = React.memo(function SecretMissionCard({
  mission,
  onComplete,
  onValidate,
  isParent,
}: SecretMissionCardProps) {
  const { primary, colors } = useThemeColors();
  const status = mission.secretStatus ?? 'active';

  return (
    <Animated.View entering={FadeInRight.duration(400)}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.warning,
          },
        ]}
      >
        {/* Badge espion */}
        <View style={[styles.badge, { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.badgeText, { color: colors.warningText }]}>
            🕵️ Mission secrète
          </Text>
        </View>

        {/* Texte de la mission */}
        <Text style={[styles.missionText, { color: colors.text }]}>
          {mission.text}
        </Text>

        {/* Actions selon le statut */}
        <View style={styles.footer}>
          {status === 'active' && !isParent && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: primary }]}
              onPress={onComplete}
              activeOpacity={0.7}
              accessibilityLabel="Marquer la mission comme accomplie"
              accessibilityRole="button"
            >
              <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>
                Mission accomplie !
              </Text>
            </TouchableOpacity>
          )}

          {status === 'active' && isParent && (
            <Text style={[styles.statusText, { color: colors.textMuted }]}>
              🕵️ En cours...
            </Text>
          )}

          {status === 'pending' && !isParent && (
            <Text style={[styles.statusText, { color: colors.textMuted }]}>
              ⏳ En attente de validation...
            </Text>
          )}

          {status === 'pending' && isParent && (
            <View style={styles.parentActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.success }]}
                onPress={onValidate}
                activeOpacity={0.7}
                accessibilityLabel="Valider la mission"
                accessibilityRole="button"
              >
                <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>
                  Valider
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { backgroundColor: colors.cardAlt }]}
                onPress={onComplete}
                activeOpacity={0.7}
                accessibilityLabel="Remettre la mission en cours"
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>
                  Pas encore
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'validated' && (
            <Text style={[styles.validatedText, { color: colors.success }]}>
              ✅ Mission validée ! 🎉
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.lg,
    ...Shadows.md,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  missionText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    lineHeight: LineHeight.body,
  },
  footer: {
    gap: Spacing.md,
  },
  actionBtn: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  secondaryBtn: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
  parentActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  validatedText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
});
