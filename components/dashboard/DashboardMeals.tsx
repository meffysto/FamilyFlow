/**
 * DashboardMeals.tsx — Section repas du jour
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVault } from '../../contexts/VaultContext';
import { useThemeColors } from '../../contexts/ThemeContext';
import { DashboardCard } from '../DashboardCard';
import { DashboardEmptyState } from '../DashboardEmptyState';
import type { AppRecipe } from '../../lib/cooklang';
import type { DashboardSectionProps } from './types';
import { FontSize, FontWeight } from '../../constants/typography';

interface DashboardMealsProps extends DashboardSectionProps {
  onViewRecipe: (recipe: AppRecipe) => void;
}

function DashboardMealsInner({ vaultFileExists, activateCardTemplate, onViewRecipe }: DashboardMealsProps) {
  const router = useRouter();
  const { primary, colors } = useThemeColors();
  const { meals, recipes } = useVault();

  const todayDayName = useMemo(() => {
    const name = format(new Date(), 'EEEE', { locale: fr });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  const todayMeals = meals.filter((m) => m.day === todayDayName && m.text.length > 0);

  if (!vaultFileExists.meals) return (
    <DashboardCard key="meals" title="Repas du jour" icon="🍽️" color="#EC4899">
      <DashboardEmptyState
        description="Planifiez les repas de la semaine pour toute la famille"
        onActivate={() => activateCardTemplate('meals')}
        activateLabel="Importer le modèle"
      />
    </DashboardCard>
  );

  if (todayMeals.length === 0) return (
    <DashboardCard key="meals" title="Repas du jour" icon="🍽️" color="#EC4899" onPressMore={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'repas' } })}>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>Aucun repas planifié aujourd'hui</Text>
    </DashboardCard>
  );

  return (
    <DashboardCard key="meals" title="Repas du jour" icon="🍽️" count={todayMeals.length} color="#EC4899" onPressMore={() => router.push({ pathname: '/(tabs)/meals', params: { tab: 'repas' } })}>
      {todayMeals.map((meal) => {
        const linkedRecipe = meal.recipeRef ? recipes.find(r => {
          const ref = r.sourceFile.replace('03 - Cuisine/Recettes/', '').replace('.cook', '');
          return ref === meal.recipeRef;
        }) : undefined;
        return (
          <TouchableOpacity
            key={meal.id}
            style={styles.mealRow}
            onPress={linkedRecipe
              ? () => onViewRecipe(linkedRecipe)
              : () => router.push({ pathname: '/(tabs)/meals', params: { tab: 'repas' } })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.mealEmoji}>
              {meal.mealType === 'Petit-déj' ? '🥐' : meal.mealType === 'Déjeuner' ? '🍽️' : '🌙'}
            </Text>
            <View style={styles.mealInfo}>
              <Text style={[styles.mealType, { color: colors.textMuted }]}>{meal.mealType}</Text>
              <Text style={[styles.mealText, { color: colors.text }]}>{meal.text}</Text>
            </View>
            {linkedRecipe && (
              <Text style={{ fontSize: FontSize.sm, color: primary }}>📖</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </DashboardCard>
  );
}

export const DashboardMeals = React.memo(DashboardMealsInner);

const styles = StyleSheet.create({
  emptyHint: {
    fontSize: FontSize.label,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  mealEmoji: {
    fontSize: FontSize.title,
    width: 28,
    textAlign: 'center',
  },
  mealInfo: {
    flex: 1,
    gap: 1,
  },
  mealType: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
  },
  mealText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
  },
});
