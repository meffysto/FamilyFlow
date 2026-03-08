import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../contexts/ThemeContext';
import type { AppRecipe, AppIngredient } from '../lib/cooklang';
import { scaleIngredients, formatIngredient, renderStepText } from '../lib/cooklang';

interface RecipeViewerProps {
  recipe: AppRecipe;
  onClose: () => void;
  onAddToShoppingList?: (ingredients: AppIngredient[]) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function RecipeViewer({ recipe, onClose, onAddToShoppingList, isFavorite, onToggleFavorite }: RecipeViewerProps) {
  const { primary, tint, colors } = useThemeColors();
  const [servings, setServings] = useState(recipe.servings || 1);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const baseServings = recipe.servings || 1;
  const scaleFactor = baseServings > 0 ? servings / baseServings : 1;

  const scaledIngredients = useMemo(
    () => scaleIngredients(recipe.ingredients, servings, baseServings),
    [recipe.ingredients, servings, baseServings],
  );

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const decrementServings = () => {
    if (servings > 1) setServings(servings - 1);
  };

  const incrementServings = () => {
    setServings(servings + 1);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {recipe.title}
            </Text>
            {recipe.category ? (
              <Text style={[styles.category, { color: colors.textMuted }]}>{recipe.category}</Text>
            ) : null}
          </View>
          {onToggleFavorite ? (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleFavorite();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.heartHeaderText}>{isFavorite ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.closeBtn} />
          )}
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {/* Metadata row */}
          <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
            {recipe.servings > 0 && (
              <View style={styles.servingsControl}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Portions</Text>
                <View style={styles.servingsRow}>
                  <TouchableOpacity
                    onPress={decrementServings}
                    style={[styles.servingsBtn, { backgroundColor: primary + '18' }]}
                  >
                    <Text style={[styles.servingsBtnText, { color: primary }]}>-</Text>
                  </TouchableOpacity>
                  <Text style={[styles.servingsValue, { color: colors.text }]}>{servings}</Text>
                  <TouchableOpacity
                    onPress={incrementServings}
                    style={[styles.servingsBtn, { backgroundColor: primary + '18' }]}
                  >
                    <Text style={[styles.servingsBtnText, { color: primary }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {recipe.prepTime ? (
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Prep</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>{recipe.prepTime}</Text>
              </View>
            ) : null}
            {recipe.cookTime ? (
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Cuisson</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>{recipe.cookTime}</Text>
              </View>
            ) : null}
          </View>

          {/* Ingredients */}
          {scaledIngredients.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ingredients</Text>
              {scaledIngredients.map((ing, i) => {
                const checked = checkedIngredients.has(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.ingredientRow, { borderBottomColor: colors.borderLight }]}
                    onPress={() => toggleIngredient(i)}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: checked ? '#22C55E' : colors.border },
                        checked && { backgroundColor: '#22C55E' },
                      ]}
                    >
                      {checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text
                      style={[
                        styles.ingredientText,
                        { color: checked ? colors.textMuted : colors.text },
                        checked && styles.ingredientChecked,
                      ]}
                    >
                      {formatIngredient(ing)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Steps */}
          {recipe.steps.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Etapes</Text>
              {recipe.steps.map((step, i) => (
                <View key={i} style={[styles.stepRow, { borderBottomColor: colors.borderLight }]}>
                  <View style={[styles.stepNumber, { backgroundColor: primary + '18' }]}>
                    <Text style={[styles.stepNumberText, { color: primary }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepText, { color: colors.text }]}>
                      {step.tokens.length > 0 ? renderStepText(step.tokens, scaleFactor) : step.text}
                    </Text>
                    {step.timers && step.timers.length > 0 && (
                      <View style={styles.timersRow}>
                        {step.timers.map((timer, ti) => (
                          <View key={ti} style={[styles.timerBadge, { backgroundColor: tint + '20' }]}>
                            <Text style={[styles.timerText, { color: tint }]}>
                              ⏱ {timer.duration} {timer.unit}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <View style={styles.section}>
              <View style={styles.tagsRow}>
                {recipe.tags.map((tag) => (
                  <View key={tag} style={[styles.chip, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[styles.chipText, { color: colors.textSub }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Add to shopping list button */}
          {onAddToShoppingList && scaledIngredients.length > 0 && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: primary }]}
              onPress={() => onAddToShoppingList(scaledIngredients)}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>Ajouter aux courses</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: '600',
  },
  heartHeaderText: {
    fontSize: 22,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  category: {
    fontSize: 13,
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
  },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  servingsControl: {
    alignItems: 'center',
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  servingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  servingsValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  ingredientText: {
    fontSize: 15,
    flex: 1,
  },
  ingredientChecked: {
    textDecorationLine: 'line-through',
  },
  stepRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 15,
    lineHeight: 22,
  },
  timersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  timerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  addButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 40,
  },
});
