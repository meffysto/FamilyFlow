import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import { FontSize, FontWeight } from '../constants/typography';
import { Shadows } from '../constants/shadows';
import type { AppRecipe } from '../lib/cooklang';

interface RecipeCardProps {
  recipe: AppRecipe;
  onPress: () => void;
  onLongPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function RecipeCard({ recipe, onPress, onLongPress, isFavorite, onToggleFavorite }: RecipeCardProps) {
  const { primary, colors } = useThemeColors();

  const handleToggleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleFavorite?.();
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {onToggleFavorite && (
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={handleToggleFavorite}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Text style={styles.heartText}>{isFavorite ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.title, { color: colors.text }, onToggleFavorite && { paddingRight: 30 }]} numberOfLines={2}>
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

      {recipe.ingredients.length > 0 && (
        <Text style={[styles.ingredientCount, { color: colors.textMuted }]}>
          {recipe.ingredients.length} ingredient{recipe.ingredients.length > 1 ? 's' : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartText: {
    fontSize: FontSize.heading,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    ...Shadows.md,
    marginBottom: 12,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  category: {
    fontSize: FontSize.caption,
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
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  metaText: {
    fontSize: FontSize.caption,
  },
  ingredientCount: {
    fontSize: FontSize.caption,
  },
});
