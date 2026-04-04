import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ScrollView,
  Modal,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useThemeColors } from '../contexts/ThemeContext';
import type { AppRecipe, AppIngredient } from '../lib/cooklang';
import { scaleIngredients, formatIngredient, renderStepText } from '../lib/cooklang';
import RecipeCookingMode from './RecipeCookingMode';
import { useTranslation } from 'react-i18next';
import { FontSize, FontWeight } from '../constants/typography';

interface RecipeViewerProps {
  recipe: AppRecipe;
  onClose: () => void;
  onAddToShoppingList?: (ingredients: AppIngredient[]) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onRename?: (newTitle: string) => void;
  /** Nombre de personnes dans la famille — utilisé comme portions par défaut */
  familySize?: number;
  /** Appelé quand la recette est terminée en mode cuisine */
  onCookingFinished?: () => void;
  /** URI de l'image de couverture (file://) */
  imageUri?: string | null;
  /** Callback pour sauvegarder une nouvelle image */
  onSaveImage?: (imageUri: string) => Promise<void>;
  /** Callback pour changer la catégorie de la recette */
  onChangeCategory?: (newCategory: string) => void;
  /** Liste des catégories existantes pour le picker */
  availableCategories?: string[];
}

export default function RecipeViewer({ recipe, onClose, onAddToShoppingList, isFavorite, onToggleFavorite, onRename, familySize, onCookingFinished, imageUri, onSaveImage, onChangeCategory, availableCategories }: RecipeViewerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { primary, tint, colors } = useThemeColors();
  const [servings, setServings] = useState(familySize || recipe.servings || 1);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [showCookingMode, setShowCookingMode] = useState(false);

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

  const handlePickImage = async () => {
    if (!onSaveImage) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('recipeViewer.alert.permissionDenied'), t('recipeViewer.alert.permissionDeniedMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const asset = result.assets[0];
      const actions: ImageManipulator.Action[] = [];
      if ((asset.width ?? 0) > 1200) actions.push({ resize: { width: 1200 } });
      const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      await onSaveImage(manipulated.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('recipeViewer.alert.error'), t('recipeViewer.alert.saveImageError'));
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: Math.max(insets.top, 54) }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCenter}
            onPress={() => {
              if (!onRename) return;
              Alert.prompt(
                t('recipeViewer.renameTitle'),
                '',
                (text) => { if (text?.trim()) onRename(text.trim()); },
                'plain-text',
                recipe.title,
              );
            }}
            activeOpacity={onRename ? 0.6 : 1}
            disabled={!onRename}
          >
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {recipe.title}
              {onRename ? <Text style={[styles.editIcon, { color: colors.textFaint }]}> ✏️</Text> : null}
            </Text>
            {recipe.category ? (
              <TouchableOpacity
                disabled={!onChangeCategory}
                activeOpacity={onChangeCategory ? 0.6 : 1}
                onPress={() => {
                  if (!onChangeCategory || !availableCategories?.length) return;
                  const others = availableCategories.filter(c => c !== recipe.category);
                  if (others.length === 0) return;
                  Alert.alert(
                    'Changer de catégorie',
                    `Catégorie actuelle : ${recipe.category}`,
                    [
                      ...others.map(cat => ({
                        text: cat,
                        onPress: () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onChangeCategory(cat);
                        },
                      })),
                      { text: 'Annuler', style: 'cancel' as const },
                    ],
                  );
                }}
              >
                <Text style={[styles.category, { color: colors.textMuted }]}>
                  {recipe.category}{onChangeCategory ? ' 📁' : ''}
                </Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
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
          {/* Hero image */}
          {imageUri ? (
            <TouchableOpacity onPress={onSaveImage ? handlePickImage : undefined} activeOpacity={onSaveImage ? 0.7 : 1}>
              <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : onSaveImage ? (
            <TouchableOpacity
              style={[styles.addImageBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
              onPress={handlePickImage}
              activeOpacity={0.7}
            >
              <Text style={[styles.addImageText, { color: colors.textMuted }]}>{t('recipeViewer.addPhoto')}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Metadata row */}
          <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
            {recipe.servings > 0 && (
              <View style={styles.servingsControl}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{t('recipeViewer.portions')}</Text>
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
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{t('recipeViewer.prep')}</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>{recipe.prepTime}</Text>
              </View>
            ) : null}
            {recipe.cookTime ? (
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{t('recipeViewer.cooking')}</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>{recipe.cookTime}</Text>
              </View>
            ) : null}
          </View>

          {/* Ingredients */}
          {scaledIngredients.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('recipeViewer.ingredients')}</Text>
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
                        { borderColor: checked ? colors.success : colors.border },
                        checked && { backgroundColor: colors.success },
                      ]}
                    >
                      {checked && <Text style={[styles.checkmark, { color: colors.onPrimary }]}>✓</Text>}
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('recipeViewer.steps')}</Text>
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

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            {recipe.steps.length > 0 && (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: primary, flex: 1 }]}
                onPress={() => setShowCookingMode(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.addButtonText, { color: colors.onPrimary }]}>{t('recipeViewer.startRecipe')}</Text>
              </TouchableOpacity>
            )}
            {onAddToShoppingList && scaledIngredients.length > 0 && (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: primary, flex: 1 }]}
                onPress={() => onAddToShoppingList(scaledIngredients)}
                activeOpacity={0.8}
              >
                <Text style={[styles.addButtonText, { color: primary }]}>{t('recipeViewer.toShoppingList')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>

      {/* Cooking mode */}
      {showCookingMode && (
        <RecipeCookingMode
          recipe={recipe}
          scaleFactor={scaleFactor}
          servings={servings}
          onClose={() => setShowCookingMode(false)}
          onFinish={onCookingFinished}
        />
      )}
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
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
  },
  heartHeaderText: {
    fontSize: FontSize.titleLg,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  editIcon: {
    fontSize: FontSize.caption,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  category: {
    fontSize: FontSize.label,
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
  },
  addImageBtn: {
    width: '100%',
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addImageText: {
    fontSize: FontSize.body,
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
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
  },
  servingsValue: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    minWidth: 24,
    textAlign: 'center',
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: FontSize.code,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
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
    fontSize: FontSize.label,
    fontWeight: FontWeight.bold,
  },
  ingredientText: {
    fontSize: FontSize.body,
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
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: FontSize.body,
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
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
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
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  addButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  bottomSpacer: {
    height: 40,
  },
});
