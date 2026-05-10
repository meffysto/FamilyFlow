/**
 * CraftGradePicker.tsx — Picker de grade par ingrédient (Phase B UI)
 *
 * Sous-composant contrôlé utilisé dans CraftSheet mini-modal détail recette.
 * Affiche un bouton compact qui expand inline les grades disponibles par ingrédient crop
 * avec qty possédées + grisage si qty insuffisante. Appelle onSelectionChange quand
 * l'utilisateur change un grade. Rend null si aucun ingrédient n'a ≥2 grades possédés
 * (équivalent fonctionnel à "tech culture-5 non débloquée").
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Platform, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import {
  GRADE_ORDER,
  countItemByGrade,
  getGradeEmoji,
  getGradeLabelKey,
  type HarvestGrade,
} from '../../lib/mascot/grade-engine';
import { CROP_CATALOG, type CraftRecipe, type HarvestInventory } from '../../lib/mascot/types';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import { Farm, FarmDarkPalette, useFarmTheme, type FarmPalette } from '../../constants/farm-theme';

const SPRING_CONFIG = { damping: 14, stiffness: 200 };

export interface CraftGradePickerProps {
  recipe: CraftRecipe;
  harvestInventory: HarvestInventory;
  craftQty: number;
  selection: Record<string, HarvestGrade>;
  onSelectionChange: (next: Record<string, HarvestGrade>) => void;
  outputGrade: HarvestGrade;
}

export function CraftGradePicker({
  recipe,
  harvestInventory,
  craftQty,
  selection,
  onSelectionChange,
  outputGrade,
}: CraftGradePickerProps) {
  const { t } = useTranslation();
  const { primary } = useThemeColors();
  const { farm, isDark } = useFarmTheme();
  const styles = isDark ? stylesDark : stylesLight;
  const [expanded, setExpanded] = useState(false);

  // Ingrédients crop uniquement (les ressources bâtiment n'ont pas de grade)
  const cropIngredients = useMemo(
    () => recipe.ingredients.filter(ing => ing.source === 'crop'),
    [recipe],
  );

  // Masquage : si aucun ingrédient crop n'a ≥2 grades possédés avec qty > 0,
  // on ne montre pas le picker (équivalent fonctionnel à "tech culture-5 non débloquée").
  const shouldShow = useMemo(() => {
    for (const ing of cropIngredients) {
      let count = 0;
      for (const g of GRADE_ORDER) {
        if (countItemByGrade(harvestInventory, ing.itemId, g) > 0) count++;
        if (count >= 2) return true;
      }
    }
    return false;
  }, [cropIngredients, harvestInventory]);

  const chevronRotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const toggleExpand = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    chevronRotation.value = withSpring(next ? 180 : 0, SPRING_CONFIG);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  }, [expanded, chevronRotation]);

  const handleSelectGrade = useCallback(
    (itemId: string, grade: HarvestGrade) => {
      onSelectionChange({ ...selection, [itemId]: grade });
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    },
    [selection, onSelectionChange],
  );

  if (!shouldShow) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Bouton compact : affiche le grade output (maillon faible) résumé */}
      <TouchableOpacity
        style={[
          styles.headerBtn,
          { borderColor: farm.woodHighlight, backgroundColor: farm.parchmentDark },
        ]}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text style={[styles.headerLabel, { color: farm.brownTextSub }]}>
          {t('craft.pickGrade')}
        </Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeEmoji}>{getGradeEmoji(outputGrade)}</Text>
          <Text style={[styles.headerBadgeLabel, { color: farm.brownText }]}>
            {t(getGradeLabelKey(outputGrade))}
          </Text>
        </View>
        <Animated.Text style={[styles.chevron, { color: farm.brownTextSub }, chevronStyle]}>
          ▾
        </Animated.Text>
      </TouchableOpacity>

      {/* Panneau expand : grades par ingrédient */}
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.panel,
            { borderColor: farm.woodHighlight, backgroundColor: farm.progressBg },
          ]}
        >
          <Text style={[styles.panelHint, { color: farm.brownTextSub }]}>
            {t('craft.gradesGrisesHint')}
          </Text>
          {cropIngredients.map(ing => {
            const cropDef = CROP_CATALOG.find(c => c.id === ing.itemId);
            const cropName = cropDef ? t(cropDef.labelKey) : ing.itemId;
            const need = ing.quantity * Math.max(1, craftQty);
            const selected = selection[ing.itemId] ?? 'ordinaire';
            return (
              <View key={ing.itemId} style={styles.ingredientRow}>
                <Text style={[styles.ingredientLabel, { color: farm.brownText }]}>
                  {cropDef?.emoji ?? '•'} {cropName}
                </Text>
                <View style={styles.chipsRow}>
                  {GRADE_ORDER.map(grade => {
                    const have = countItemByGrade(harvestInventory, ing.itemId, grade);
                    if (have <= 0) return null; // n'affiche que les grades possédés
                    const disabled = have < need;
                    const isSelected = selected === grade;
                    return (
                      <Pressable
                        key={grade}
                        onPress={disabled ? undefined : () => handleSelectGrade(ing.itemId, grade)}
                        disabled={disabled}
                        style={[
                          styles.chip,
                          {
                            borderColor: isSelected ? primary : farm.woodHighlight,
                            backgroundColor: isSelected
                              ? primary + '22'
                              : farm.parchmentDark,
                            opacity: disabled ? 0.4 : 1,
                          },
                        ]}
                      >
                        <Text style={styles.chipEmoji}>{getGradeEmoji(grade)}</Text>
                        <Text style={[styles.chipLabel, { color: farm.brownText }]}>
                          {t(getGradeLabelKey(grade))}
                        </Text>
                        <Text
                          style={[
                            styles.chipQty,
                            { color: disabled ? farm.brownTextSub : farm.brownText },
                          ]}
                        >
                          ×{have}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const makeStyles = (farm: FarmPalette) => StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  headerLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  headerBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBadgeEmoji: {
    fontSize: FontSize.body,
  },
  headerBadgeLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  chevron: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  panel: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  panelHint: {
    fontSize: FontSize.micro,
    fontStyle: 'italic',
  },
  ingredientRow: {
    gap: Spacing.xs,
  },
  ingredientLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    gap: 4,
  },
  chipEmoji: {
    fontSize: FontSize.sm,
  },
  chipLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
  },
  chipQty: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.bold,
  },
});

const stylesLight = makeStyles(Farm);
const stylesDark = makeStyles(FarmDarkPalette);
