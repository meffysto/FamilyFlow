/**
 * DashboardWishlist.tsx — Section souhaits / idées cadeaux
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import type { DashboardSectionProps } from './types';

function DashboardWishlistInner(_props: DashboardSectionProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { wishlistItems } = useVault();

  const unbought = wishlistItems.filter((w) => !w.bought).length;

  return (
    <DashboardCard key="wishlist" title="Souhaits" icon="🎁" color="#E11D48" onPressMore={() => router.push('/(tabs)/wishlist' as any)}>
      <Text style={[styles.defiMeta, { color: colors.textSub }]}>
        {unbought} idée{unbought !== 1 ? 's' : ''} cadeau
      </Text>
    </DashboardCard>
  );
}

export const DashboardWishlist = React.memo(DashboardWishlistInner);

const styles = StyleSheet.create({
  defiMeta: {
    fontSize: 12,
  },
});
