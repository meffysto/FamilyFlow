import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { AppRecipe } from '../lib/cooklang';

interface RecipeCardProps {
  recipe: AppRecipe;
  onPress: () => void;
  onLongPress?: () => void;
}

export default function RecipeCard({ recipe, onPress, onLongPress }: RecipeCardProps) {
  const { primary, colors } = useThemeColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {recipe.title}
      </Text>

      {recipe.category ? (
        <Text style={[styles.category, { color: colors.textMuted }]}>
          {recipe.category}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        {recipe.servings > 0 && (
          <View style={[styles.badge, { backgroundColor: primary + '18' }]}>
            <Text style={[styles.badgeText, { color: primary }]}>
              {recipe.servings} pers.
            </Text>
          </View>
        )}
        {recipe.prepTime ? (
          <Text style={[styles.metaText, { color: colors.textSub }]}>
            Prep {recipe.prepTime}
          </Text>
        ) : null}
        {recipe.cookTime ? (
          <Text style={[styles.metaText, { color: colors.textSub }]}>
            Cuisson {recipe.cookTime}
          </Text>
        ) : null}
      </View>

      {recipe.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {recipe.tags.map((tag) => (
            <View key={tag} style={[styles.chip, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.chipText, { color: colors.textSub }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {recipe.ingredients.length > 0 && (
        <Text style={[styles.ingredientCount, { color: colors.textMuted }]}>
          {recipe.ingredients.length} ingredient{recipe.ingredients.length > 1 ? 's' : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ingredientCount: {
    fontSize: 12,
  },
});
