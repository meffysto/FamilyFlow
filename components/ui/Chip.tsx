import React, { useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../contexts/ThemeContext';
import { Spacing, Radius } from '../../constants/spacing';
import { FontSize, FontWeight } from '../../constants/typography';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  emoji?: string;
  /** Override la couleur d'accent (cas legacy — par défaut warm bois) */
  color?: string;
  size?: 'sm' | 'md';
  /** Variante visuelle. `warning` = teinte error-warm subtile. */
  variant?: 'default' | 'warning';
}

export const Chip = React.memo(function Chip({
  label,
  selected = false,
  onPress,
  emoji,
  color,
  size = 'md',
  variant = 'default',
}: ChipProps) {
  const { colors } = useThemeColors();

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress?.();
  }, [onPress]);

  // Palette warm : repos = wash + bark, sélectionné = soil + parchemin.
  // `color` (legacy) override l'accent sélectionné si fourni.
  const isWarning = variant === 'warning';
  const accentSelected = color ?? colors.brand.soil;

  let bg: string;
  let borderColor: string;
  let textColor: string;

  if (isWarning) {
    bg = selected ? colors.error : 'rgba(176,65,58,0.08)';
    borderColor = selected ? colors.error : 'rgba(176,65,58,0.30)';
    textColor = selected ? colors.onAccent : colors.error;
  } else if (selected) {
    bg = accentSelected;
    borderColor = accentSelected;
    textColor = color ? colors.onAccent : colors.brand.parchment;
  } else {
    bg = colors.brand.wash;
    borderColor = colors.brand.bark;
    textColor = colors.textMuted;
  }

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderColor,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: size === 'sm' ? Spacing.xs : Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    ...(selected && !isWarning
      ? {
          shadowColor: colors.brand.soil,
          shadowOpacity: 0.18,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }
      : null),
  };

  const textStyle: TextStyle = {
    fontSize: size === 'sm' ? FontSize.label : FontSize.body,
    fontWeight: selected ? FontWeight.semibold : FontWeight.medium,
    color: textColor,
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress ? handlePress : undefined}
      activeOpacity={0.7}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected } : undefined}
      hitSlop={6}
    >
      {emoji ? <Text style={styles.emoji}>{emoji} </Text> : null}
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  emoji: {
    fontSize: FontSize.sm,
  },
});
