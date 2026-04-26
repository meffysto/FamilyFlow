/**
 * DashboardRecipes.tsx — Section idée recette du jour
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import type { AppRecipe } from '../../lib/cooklang';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

interface DashboardRecipesProps extends DashboardSectionProps {
  onViewRecipe: (recipe: AppRecipe) => void;
}

function DashboardRecipesInner({ activateCardTemplate, onViewRecipe }: DashboardRecipesProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { recipes, loadRecipes, isLoading } = useVault();

  // Relancer quand le vault finit de charger (loadRecipes sort silencieusement si vault pas prêt)
  useEffect(() => { if (!isLoading) loadRecipes(); }, [loadRecipes, isLoading]);

  if (recipes.length === 0) return (
    <DashboardCard key="recipes" title={t('dashboard.recipes.title')} color={colors.catOrganisation} tinted>
      <DashboardEmptyState
        description={t('dashboard.recipes.emptyDescription')}
        onActivate={() => activateCardTemplate('recipes')}
        activateLabel={t('dashboard.recipes.activateLabel')}
      />
    </DashboardCard>
  );

  // Pick a random recipe suggestion based on today's date (stable per day)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const suggestedRecipe = recipes[dayOfYear % recipes.length];

  return (
    <DashboardCard key="recipes" title={t('dashboard.recipes.title')} count={recipes.length} color={colors.catOrganisation} tinted onPressMore={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'recettes' } })}>
      <TouchableOpacity
        style={[styles.recipeSuggestion, { backgroundColor: colors.brand.wash, borderWidth: 1, borderColor: colors.brand.bark }]}
        onPress={() => onViewRecipe(suggestedRecipe)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.recipeSuggestionTitle, { color: colors.text }]} numberOfLines={1}>
            {suggestedRecipe.title}
          </Text>
          <Text style={[styles.recipeSuggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {suggestedRecipe.category}
            {suggestedRecipe.servings > 0 ? ` · ${t('dashboard.recipes.servings', { count: suggestedRecipe.servings })}` : ''}
            {suggestedRecipe.prepTime ? ` · ${suggestedRecipe.prepTime}` : ''}
          </Text>
          {suggestedRecipe.ingredients.length > 0 && (
            <Text style={[styles.recipeSuggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {t('dashboard.recipes.ingredients', { count: suggestedRecipe.ingredients.length })}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: FontSize.heading }}>🎲</Text>
      </TouchableOpacity>
    </DashboardCard>
  );
}

export const DashboardRecipes = React.memo(DashboardRecipesInner);

const styles = StyleSheet.create({
  recipeSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  recipeSuggestionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  recipeSuggestionMeta: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
});
