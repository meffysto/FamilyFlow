/**
 * DietaryAutocomplete.tsx — Champ de saisie avec dropdown catalogue
 *
 * Affiche un TextInput avec une liste de suggestions filtrées en temps réel
 * pour les allergies, intolérances et régimes (catalogues canoniques).
 * Pour les aversions, pas de catalogue : texte libre uniquement.
 *
 * Phase 15 — Préférences alimentaires
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';
import type { DietarySeverity, DietaryItem } from '../../lib/dietary/types';
import { findCatalogForSeverity } from '../../lib/dietary/catalogs';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Nombre maximum de suggestions visibles dans le dropdown */
const MAX_SUGGESTIONS = 5;

/** Placeholders par sévérité (per UI-SPEC ligne 181-184) */
const PLACEHOLDER_BY_SEVERITY: Record<DietarySeverity, string> = {
  allergie: '14 allergènes UE',
  intolerance: 'Intolérance courante…',
  regime: 'Végétarien, halal…',
  aversion: 'Texte libre…',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DietaryAutocompleteProps {
  severity: DietarySeverity;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (item: string) => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const DietaryAutocomplete = React.memo(function DietaryAutocomplete({
  severity,
  value,
  onChange,
  onSubmit,
}: DietaryAutocompleteProps) {
  const { primary, colors } = useThemeColors();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Catalogue correspondant à la sévérité ([] pour aversion)
  const catalog: DietaryItem[] = useMemo(() => findCatalogForSeverity(severity), [severity]);

  // Filtrage en temps réel : correspond si le label normalisé contient la saisie normalisée
  const suggestions = useMemo(() => {
    if (!value.trim() || catalog.length === 0) return [];
    const query = normalize(value);
    return catalog
      .filter((item) => normalize(item.label).includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [value, catalog]);

  const showDropdown = focused && suggestions.length > 0;

  // Soumission depuis le catalogue
  const handleSelectSuggestion = useCallback((item: DietaryItem) => {
    Haptics.selectionAsync();
    onSubmit(item.id);
    onChange('');
    inputRef.current?.blur();
  }, [onSubmit, onChange]);

  // Soumission texte libre (hors catalogue ou aversion)
  const handleSubmitEditing = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onChange('');
  }, [value, onSubmit, onChange]);

  return (
    <View style={styles.wrapper}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={handleSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Délai pour laisser le temps au tap sur la suggestion de se déclencher
          setTimeout(() => setFocused(false), 150);
        }}
        placeholder={PLACEHOLDER_BY_SEVERITY[severity]}
        placeholderTextColor={colors.textFaint}
        returnKeyType="done"
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: focused ? primary : colors.border,
            color: colors.text,
          },
        ]}
        accessibilityLabel="Saisir une préférence alimentaire"
      />

      {showDropdown && (
        <ScrollView
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={suggestions.length > MAX_SUGGESTIONS}
          accessibilityRole="list"
        >
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
              onPress={() => handleSelectSuggestion(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
});

// ─── Utilitaire ───────────────────────────────────────────────────────────────

/** Normalise une chaîne : lowercase + suppression des accents */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─── Styles statiques ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
    minHeight: 44,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginTop: Spacing.xs,
    maxHeight: MAX_SUGGESTIONS * 48,
    zIndex: 20,
  },
  suggestionItem: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.normal,
  },
});
