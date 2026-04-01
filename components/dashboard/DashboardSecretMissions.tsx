/**
 * DashboardSecretMissions.tsx — Section dashboard missions secrètes
 *
 * Mode enfant : carte pulsante si missions actives.
 * Mode parent : carte si missions en attente de validation.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { SecretMissionCard } from '../SecretMissionCard';
import type { DashboardSectionProps } from './types';
import { Spacing } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

function DashboardSecretMissionsInner({ isChildMode }: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { secretMissions, activeProfile, validateSecretMission, completeSecretMission } = useVault();

  // Animation de pulsation pour le mode enfant
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  if (!activeProfile) return null;

  const isParent = activeProfile.role === 'adulte';

  // Mode enfant : missions actives pour cet enfant
  if (isChildMode) {
    const myMissions = secretMissions.filter(
      (m) => m.targetProfileId === activeProfile.id && m.secretStatus !== 'validated',
    );
    if (myMissions.length === 0) return null;

    return (
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/tasks')}
        activeOpacity={0.8}
      >
        <DashboardCard title={t('dashboard.secretMissions.title')} icon="🕵️" color={colors.catJeux} tinted>
          <Animated.View style={pulseStyle}>
            <Text style={[styles.childText, { color: colors.text }]}>
              {t('dashboard.secretMissions.childText', { count: myMissions.length })}
            </Text>
          </Animated.View>
        </DashboardCard>
      </TouchableOpacity>
    );
  }

  // Mode parent : missions en attente de validation
  if (isParent) {
    const pendingMissions = secretMissions.filter((m) => m.secretStatus === 'pending');
    if (pendingMissions.length === 0) return null;

    return (
      <DashboardCard
        title={t('dashboard.secretMissions.title')}
        icon="🕵️"
        count={pendingMissions.length}
        color={colors.catJeux}
        tinted
      >
        <Text style={[styles.parentSubtitle, { color: colors.textMuted }]}>
          {t('dashboard.secretMissions.pendingValidation', { count: pendingMissions.length })}
        </Text>
        {pendingMissions.slice(0, 3).map((mission) => (
          <SecretMissionCard
            key={mission.id}
            mission={mission}
            isParent
            onValidate={() => validateSecretMission(mission.id)}
            onComplete={() => completeSecretMission(mission.id)}
          />
        ))}
        {pendingMissions.length > 3 && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/tasks')}
            activeOpacity={0.7}
          >
            <Text style={[styles.seeAllText, { color: primary }]}>
              {t('dashboard.secretMissions.seeMore', { count: pendingMissions.length - 3 })}
            </Text>
          </TouchableOpacity>
        )}
      </DashboardCard>
    );
  }

  return null;
}

export const DashboardSecretMissions = React.memo(DashboardSecretMissionsInner);

const styles = StyleSheet.create({
  childText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  parentSubtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.md,
  },
});
