/**
 * DashboardRecipes.tsx — Section idée recette du jour
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import type { AppRecipe } from '../../lib/cooklang';
import type { DashboardSectionProps } from './types';

interface DashboardRecipesProps extends DashboardSectionProps {
  onViewRecipe: (recipe: AppRecipe) => void;
}

function DashboardRecipesInner({ activateCardTemplate, onViewRecipe }: DashboardRecipesProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { recipes } = useVault();

  if (recipes.length === 0) return (
    <DashboardCard key="recipes" title="Idée recette" icon="📖" color={colors.info}>
      <DashboardEmptyState
        description="Ajoutez vos recettes favorites au format Cooklang"
        onActivate={() => activateCardTemplate('recipes')}
        activateLabel="Importer le modèle"
      />
    </DashboardCard>
  );

  // Pick a random recipe suggestion based on today's date (stable per day)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const suggestedRecipe = recipes[dayOfYear % recipes.length];

  return (
    <DashboardCard key="recipes" title="Idée recette" icon="📖" count={recipes.length} color={colors.info} onPressMore={() => router.push('/(tabs)/meals')}>
      <TouchableOpacity
        style={[styles.recipeSuggestion, { backgroundColor: colors.cardAlt }]}
        onPress={() => router.push('/(tabs)/meals')}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.recipeSuggestionTitle, { color: colors.text }]} numberOfLines={1}>
            {suggestedRecipe.title}
          </Text>
          <Text style={[styles.recipeSuggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {suggestedRecipe.category}
            {suggestedRecipe.servings > 0 ? ` · ${suggestedRecipe.servings} pers.` : ''}
            {suggestedRecipe.prepTime ? ` · ${suggestedRecipe.prepTime}` : ''}
          </Text>
          {suggestedRecipe.ingredients.length > 0 && (
            <Text style={[styles.recipeSuggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
              🥕 {suggestedRecipe.ingredients.length} ingrédient{suggestedRecipe.ingredients.length > 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 24 }}>🎲</Text>
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
    fontSize: 15,
    fontWeight: '700',
  },
  recipeSuggestionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});
