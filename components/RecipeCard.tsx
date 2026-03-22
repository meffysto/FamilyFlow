import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text, ImageBackground } from 'react-native';
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
  imageUri?: string | null;
}

export default function RecipeCard({ recipe, onPress, onLongPress, isFavorite, onToggleFavorite, imageUri }: RecipeCardProps) {
  const { primary, colors } = useThemeColors();

  const handleToggleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleFavorite?.();
  };

  const hasImage = !!imageUri;

  // Carte avec image de couverture
  if (hasImage) {
    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: colors.borderLight }]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        <ImageBackground
          source={{ uri: imageUri! }}
          style={styles.imageCard}
          imageStyle={styles.imageRounded}
          resizeMode="cover"
        >
          <View style={styles.imageOverlay}>
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
            <View style={styles.imageContent}>
              <Text style={[styles.title, styles.imageTitle]} numberOfLines={2}>
                {recipe.title}
              </Text>
              <View style={styles.metaRow}>
                {recipe.servings > 0 && (
                  <View style={[styles.badge, styles.imageBadge]}>
                    <Text style={[styles.badgeText, { color: '#fff' }]}>
                      {recipe.servings} pers.
                    </Text>
                  </View>
                )}
                {recipe.prepTime ? (
                  <Text style={[styles.metaText, { color: 'rgba(255,255,255,0.85)' }]}>
                    Prep {recipe.prepTime}
                  </Text>
                ) : null}
                {recipe.cookTime ? (
                  <Text style={[styles.metaText, { color: 'rgba(255,255,255,0.85)' }]}>
                    Cuisson {recipe.cookTime}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  }

  // Carte texte classique (sans image)
  return (
    <TouchableOpacity
      style={[styles.card, styles.textCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
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
    borderWidth: StyleSheet.hairlineWidth,
    ...Shadows.md,
    marginBottom: 12,
    overflow: 'hidden',
  },
  textCard: {
    padding: 14,
  },
  imageCard: {
    height: 160,
  },
  imageRounded: {
    borderRadius: 16,
  },
  imageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    justifyContent: 'flex-end',
  },
  imageContent: {
    padding: 14,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  imageTitle: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  imageBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  category: {
    fontSize: FontSize.caption,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
