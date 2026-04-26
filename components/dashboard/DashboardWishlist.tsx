/**
 * DashboardWishlist.tsx — Section souhaits / idées cadeaux
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import type { DashboardSectionProps } from './types';
import { FontSize, FontFamily } from '../../constants/typography';

function DashboardWishlistInner(_props: DashboardSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { wishlistItems } = useVault();

  const unbought = wishlistItems.filter((w) => !w.bought).length;

  return (
    <DashboardCard key="wishlist" title={t('dashboard.wishlist.title')} color={colors.catFamille} tinted onPressMore={() => router.push('/(tabs)/wishlist' as any)}>
      <Text style={[styles.sentence, { color: colors.textMuted }]}>
        {t('dashboard.wishlist.giftIdeas', { count: unbought })}
      </Text>
    </DashboardCard>
  );
}

export const DashboardWishlist = React.memo(DashboardWishlistInner);

const styles = StyleSheet.create({
  sentence: {
    fontFamily: FontFamily.handwrite,
    fontSize: FontSize.subtitle,
  },
});
