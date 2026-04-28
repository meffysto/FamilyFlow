/**
 * CourseAutocomplete — dropdown de suggestions pendant la saisie d'un article.
 *
 * Affiché au-dessus de l'addBar quand l'input a le focus, que la requête fait
 * ≥2 caractères, et qu'il existe au moins une suggestion. Match par préfixe
 * (insensible à la casse + diacritiques), trié par fréquence d'usage.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

interface Props {
  query: string;
  suggestions: string[]; // déjà filtrées + triées + limitées (max 5)
  onPick: (name: string) => void;
}

export const CourseAutocomplete = React.memo(function CourseAutocomplete({
  query,
  suggestions,
  onPick,
}: Props) {
  const { colors } = useThemeColors();

  if (suggestions.length === 0) return null;

  const queryLen = query.trim().length;

  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      exiting={FadeOutDown.duration(100)}
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderTopColor: colors.borderLight },
      ]}
    >
      <ScrollView
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {suggestions.map((name, idx) => {
          const head = name.slice(0, queryLen);
          const tail = name.slice(queryLen);
          const isLast = idx === suggestions.length - 1;
          return (
            <TouchableOpacity
              key={name}
              style={[
                styles.row,
                !isLast && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
              activeOpacity={0.6}
              onPress={() => onPick(name)}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter ${name}`}
            >
              <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
                <Text style={[styles.bold, { color: colors.text }]}>{head}</Text>
                <Text style={{ color: colors.textSub }}>{tail}</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    maxHeight: 220,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
  },
  text: {
    fontSize: FontSize.body,
  },
  bold: {
    fontWeight: FontWeight.bold,
  },
});
