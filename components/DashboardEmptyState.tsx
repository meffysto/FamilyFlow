/**
 * DashboardEmptyState.tsx — État vide pour les cartes dashboard
 *
 * Affiché quand une section n'a pas encore de données.
 * Permet à l'utilisateur de découvrir la fonctionnalité et d'importer un modèle.
 */

import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useThemeColors } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/spacing';
import { FontSize, FontWeight } from '../constants/typography';

interface Props {
  description: string;
  onActivate: () => Promise<void>;
  activateLabel?: string;
}

export function DashboardEmptyState({ description, onActivate, activateLabel = 'Activer' }: Props) {
  const { primary, tint, colors } = useThemeColors();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      await onActivate();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.description, { color: colors.textMuted }]}>
        {description}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: tint, borderColor: primary }]}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={primary} />
        ) : (
          <Text style={[styles.buttonText, { color: primary }]}>
            {activateLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  description: {
    fontSize: FontSize.label,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  button: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
});
