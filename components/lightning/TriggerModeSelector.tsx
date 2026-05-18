/**
 * TriggerModeSelector — 3 radio cards mode de déclenchement (UI-SPEC Surface 6).
 *
 * Plan 53-03a — composant visuel pur controllé.
 *
 * Trois options (REQ-3) :
 *   - 'instant'       : pay-out immédiat à chaque tâche
 *   - 'daily-review'  : validation parentale en batch 1×/jour
 *   - 'hybrid'        : instantané jusqu'à 100 sats/jour, puis en attente
 *
 * Visuel sélectionné (UI-SPEC) : borderColor primary borderWidth 1.5 + dot
 * blanc 8px centré sur disque primary 20×20.
 *
 * Visuel non sélectionné : borderColor colors.border borderWidth 1 + disque
 * 20×20 bg colors.cardAlt + border colors.border (creux).
 *
 * Accessibilité : `accessibilityRole="radio"` + `accessibilityState.checked`
 * sur chaque option (UI-SPEC Accessibility).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

export type TriggerMode = 'instant' | 'daily-review' | 'hybrid';

interface TriggerModeSelectorProps {
  value: TriggerMode;
  onChange: (mode: TriggerMode) => void;
}

interface ModeOption {
  id: TriggerMode;
  title: string;
  subtitle: string;
}

// Wording verbatim UI-SPEC Copywriting Contract.
const OPTIONS: readonly ModeOption[] = [
  {
    id: 'instant',
    title: 'Instantané',
    subtitle: 'Chaque tâche déclenche un pay-out immédiat',
  },
  {
    id: 'daily-review',
    title: 'Validation parentale',
    subtitle: 'Tu valides les pay-outs en batch une fois par jour',
  },
  {
    id: 'hybrid',
    title: 'Hybride',
    subtitle: "Instantané jusqu'à 100 sats/jour, puis en attente",
  },
] as const;

export function TriggerModeSelector({ value, onChange }: TriggerModeSelectorProps) {
  const { colors, primary } = useThemeColors();

  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel="Mode de déclenchement des pay-outs"
    >
      {OPTIONS.map((option) => {
        const isSelected = value === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: isSelected ? primary : colors.border,
                borderWidth: isSelected ? 1.5 : 1,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(option.id);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.title}
            accessibilityHint={option.subtitle}
            accessibilityState={{ checked: isSelected }}
            activeOpacity={0.7}
          >
            {/* Radio dot 20×20 — plein si selected, creux sinon */}
            <View
              style={[
                styles.radioOuter,
                isSelected
                  ? { backgroundColor: primary, borderColor: primary }
                  : { backgroundColor: colors.cardAlt, borderColor: colors.border },
              ]}
            >
              {isSelected ? (
                <View
                  style={[styles.radioDot, { backgroundColor: colors.onPrimary }]}
                />
              ) : null}
            </View>

            {/* Colonne titre + sous-titre */}
            <View style={styles.textCol}>
              <Text style={[styles.title, { color: colors.text }]}>
                {option.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSub }]}>
                {option.subtitle}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    borderRadius: Radius.md,
    padding: Spacing.xl,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  textCol: {
    flex: 1,
    gap: Spacing.xxs,
  },
  title: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    fontSize: FontSize.label,
  },
});
